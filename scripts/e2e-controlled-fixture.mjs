import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";

const APP_PORT = Number(process.env.E2E_APP_PORT ?? 3000);
const APP_ORIGIN = process.env.E2E_APP_ORIGIN ?? `http://127.0.0.1:${APP_PORT}`;
const FIXTURE_URL = `${APP_ORIGIN}/speaking/fixture`;
const HEADLESS = process.env.E2E_HEADLESS !== "0";
const REQUEST_TIMEOUT_MS = 1000;
const SERVER_TIMEOUT_MS = 45_000;
const FIXTURE_TIMEOUT_MS = 20_000;
const CDP_COMMAND_TIMEOUT_MS = 5_000;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(condition, timeoutMs, label) {
  const startedAt = Date.now();
  let lastError;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const result = await condition();
      if (result) return result;
    } catch (error) {
      lastError = error;
    }
    await delay(250);
  }
  throw new Error(`${label} timed out.${lastError ? ` Last error: ${lastError.message}` : ""}`);
}

async function fetchJson(url, init) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function getFreePort() {
  if (process.env.E2E_CDP_PORT) return Number(process.env.E2E_CDP_PORT);
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : undefined;
      server.close(() => {
        if (port) resolve(port);
        else reject(new Error("Unable to allocate a DevTools port."));
      });
    });
  });
}

async function isAppAvailable() {
  try {
    const response = await fetch(FIXTURE_URL, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    return response.ok;
  } catch {
    return false;
  }
}

async function ensureDevServer() {
  if (await isAppAvailable()) return undefined;

  const nextBin = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
  const server = spawn(process.execPath, [nextBin, "dev", "-p", String(APP_PORT)], {
    cwd: process.cwd(),
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  server.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  server.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });

  server.once("exit", (code) => {
    if (code && code !== 0) output += `\nDev server exited with code ${code}.`;
  });

  try {
    await waitFor(isAppAvailable, SERVER_TIMEOUT_MS, "Next dev server");
    return server;
  } catch (error) {
    server.kill();
    throw new Error(`${error.message}\n${output.trim()}`);
  }
}

function browserCandidates() {
  if (process.env.E2E_BROWSER_PATH) return [process.env.E2E_BROWSER_PATH];

  if (process.platform === "win32") {
    const programFiles = [
      process.env.LOCALAPPDATA,
      process.env.PROGRAMFILES,
      process.env["PROGRAMFILES(X86)"],
    ].filter(Boolean);
    return programFiles.flatMap((root) => [
      path.join(root, "Google", "Chrome", "Application", "chrome.exe"),
      path.join(root, "Microsoft", "Edge", "Application", "msedge.exe"),
    ]);
  }

  if (process.platform === "darwin") {
    return [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    ];
  }

  return [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/microsoft-edge",
    "/usr/bin/microsoft-edge-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ];
}

function findBrowserExecutable() {
  const executable = browserCandidates().find((candidate) => candidate && existsSync(candidate));
  if (!executable) {
    throw new Error("Unable to find Chrome or Edge. Set E2E_BROWSER_PATH to the browser executable.");
  }
  return executable;
}

function launchBrowser(executable, userDataDir, cdpPort) {
  const args = [
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${userDataDir}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-networking",
    "--disable-extensions",
    "--disable-sync",
    "about:blank",
  ];
  if (HEADLESS) args.unshift("--headless=new");

  return spawn(executable, args, {
    stdio: ["ignore", "pipe", "pipe"],
  });
}

async function stopProcess(child) {
  if (!child || child.exitCode !== null) return;
  child.kill();
  const exited = await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    delay(2_000).then(() => false),
  ]);
  if (exited !== false || child.exitCode !== null) return;

  if (process.platform === "win32" && child.pid) {
    await new Promise((resolve) => {
      const killer = spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
      });
      killer.once("exit", resolve);
    });
  }
}

async function removeDirectoryWithRetry(directory) {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      rmSync(directory, { recursive: true, force: true });
      return;
    } catch (error) {
      if (attempt === 5) throw error;
      await delay(300 * attempt);
    }
  }
}

class CdpClient {
  constructor(webSocketUrl) {
    this.id = 0;
    this.pending = new Map();
    this.socket = new WebSocket(webSocketUrl);
  }

  async connect() {
    await new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      const payload = JSON.parse(event.data);
      if (!payload.id) return;
      const pending = this.pending.get(payload.id);
      if (!pending) return;
      this.pending.delete(payload.id);
      if (payload.error) {
        pending.reject(new Error(payload.error.message));
      } else {
        pending.resolve(payload.result);
      }
    });
  }

  send(method, params = {}) {
    const id = (this.id += 1);
    this.socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP command ${method} timed out.`));
      }, CDP_COMMAND_TIMEOUT_MS);
      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timeout);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });
    });
  }

  close() {
    this.socket.close();
  }
}

async function createPageTarget(url, cdpPort) {
  const target = await fetchJson(`http://127.0.0.1:${cdpPort}/json/new?${encodeURIComponent(url)}`, {
    method: "PUT",
  });
  return target.webSocketDebuggerUrl;
}

async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text ?? "Runtime evaluation failed.");
  }
  return result.result.value;
}

async function runFixtureInBrowser(cdpPort) {
  const targetUrl = await createPageTarget(FIXTURE_URL, cdpPort);
  const client = new CdpClient(targetUrl);
  await client.connect();
  try {
    await client.send("Runtime.enable");
    await client.send("Page.enable");
    await client.send("Page.navigate", { url: FIXTURE_URL });
    await waitFor(
      () => evaluate(client, "document.querySelector('h1')?.textContent === 'Lesson E2E'"),
      SERVER_TIMEOUT_MS,
      "Fixture page load",
    );

    const pageTitle = await evaluate(client, "document.querySelector('h1')?.textContent");
    assert.equal(pageTitle, "Lesson E2E");

    await waitFor(
      () =>
        evaluate(
          client,
          `(() => {
            const button = document.querySelector('[data-testid="run-controlled-fixture"]');
            return Boolean(button && !button.disabled && button.textContent?.includes('Run controlled fixture'));
          })()`,
        ),
      SERVER_TIMEOUT_MS,
      "Fixture run button",
    );
    await delay(500);

    const clicked = await evaluate(
      client,
      `(() => {
        const button = document.querySelector('[data-testid="run-controlled-fixture"]');
        if (!button) return false;
        button.click();
        return true;
      })()`,
    );
    assert.equal(clicked, true);

    return await waitFor(
      async () =>
        evaluate(
          client,
          `(() => {
            const alert = document.querySelector('[role="alert"]');
            if (alert) return { error: alert.textContent };
            const result = document.querySelector('[data-testid="controlled-fixture-result"]');
            if (!result) return null;
            return {
              title: result.querySelector('strong')?.textContent,
              rows: Object.fromEntries([...result.querySelectorAll('dl > div')].map((row) => [
                row.querySelector('dt')?.textContent?.trim(),
                row.querySelector('dd')?.textContent?.trim(),
              ])),
            };
          })()`,
        ),
      FIXTURE_TIMEOUT_MS,
      "Controlled fixture",
    );
  } finally {
    client.close();
  }
}

async function main() {
  let server;
  let browser;
  let userDataDir;
  try {
    server = await ensureDevServer();
    const cdpPort = await getFreePort();
    userDataDir = await mkdtemp(path.join(tmpdir(), "gablab-fixture-e2e-"));
    browser = launchBrowser(findBrowserExecutable(), userDataDir, cdpPort);
    await waitFor(
      () => fetchJson(`http://127.0.0.1:${cdpPort}/json/version`),
      SERVER_TIMEOUT_MS,
      "Browser DevTools endpoint",
    );

    const result = await runFixtureInBrowser(cdpPort);
    if (result.error) throw new Error(result.error);

    assert.equal(result.title, "Fixture passed");
    assert.equal(result.rows.Session, "completed");
    assert.equal(result.rows["Learner turns"], "12");
    assert.equal(result.rows["Checkpoint saves"], "15");
    assert.equal(result.rows["Report ratings"], "4");
    assert.equal(result.rows["Review expressions"], "3");
    assert.equal(result.rows.Cleanup, "complete");
    console.log("Controlled fixture E2E passed.");
  } finally {
    await stopProcess(browser);
    await stopProcess(server);
    if (userDataDir) await removeDirectoryWithRetry(userDataDir);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
