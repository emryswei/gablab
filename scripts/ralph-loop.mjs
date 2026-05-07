import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadLoopPackage, renderLoopPrompt, validateLoopPackage } from "./ralph-core.mjs";

function parseArgs(argv) {
  const options = {
    loopDir: argv[2],
    maxIterations: 1,
  };

  for (const arg of argv.slice(3)) {
    const match = arg.match(/^--max-iterations=(\d+)$/);
    if (match) {
      options.maxIterations = Number(match[1]);
    }
  }

  return options;
}

function runCommand(command, cwd) {
  const startedAt = new Date().toISOString();
  const result = spawnSync(command.run, {
    cwd,
    shell: true,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  return {
    name: command.name,
    run: command.run,
    status: result.status ?? 1,
    startedAt,
    endedAt: new Date().toISOString(),
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function saveRun(repoRoot, record) {
  const runsDir = path.join(repoRoot, ".agents", "ralph", "runs");
  fs.mkdirSync(runsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filePath = path.join(runsDir, `${stamp}.json`);
  fs.writeFileSync(filePath, `${JSON.stringify(record, null, 2)}\n`);
  return filePath;
}

function main() {
  const scriptPath = fileURLToPath(import.meta.url);
  const repoRoot = path.dirname(path.dirname(scriptPath));
  const options = parseArgs(process.argv);
  const loopDir = path.resolve(repoRoot, options.loopDir ?? ".agents/ralph/gablab-quality-loop");
  const loopPackage = loadLoopPackage(loopDir);
  const validation = validateLoopPackage(loopPackage);

  if (!validation.ok) {
    console.error("Ralph loop package is invalid:");
    for (const error of validation.errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  const iterations = [];
  let passed = false;

  for (let iteration = 1; iteration <= options.maxIterations; iteration += 1) {
    console.log(`Ralph iteration ${iteration}/${options.maxIterations}`);
    const commandResults = {};
    const results = [];

    for (const command of loopPackage.metadata.commands) {
      console.log(`> ${command.name}: ${command.run}`);
      const result = runCommand(command, repoRoot);
      results.push(result);
      commandResults[command.name] = [
        `exit ${result.status}`,
        result.stdout.trim(),
        result.stderr.trim(),
      ]
        .filter(Boolean)
        .join("\n");

      if (result.status !== 0) {
        break;
      }
    }

    passed = results.every((result) => result.status === 0);
    iterations.push({
      iteration,
      passed,
      results,
      prompt: renderLoopPrompt(loopPackage, commandResults, {
        focus: "Keep changes small, tested, typed, and aligned with the failure model.",
      }),
    });

    if (passed) break;
  }

  const recordPath = saveRun(repoRoot, {
    loop: loopDir,
    passed,
    iterations,
  });

  console.log(`Ralph run record: ${recordPath}`);
  process.exitCode = passed ? 0 : 1;
}

main();

