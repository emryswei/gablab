import fs from "node:fs";
import path from "node:path";

function parseScalar(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function parseFrontmatter(markdown) {
  const normalized = markdown.replace(/^\uFEFF/, "");
  if (!normalized.startsWith("---\n") && !normalized.startsWith("---\r\n")) {
    return { metadata: {}, body: markdown };
  }

  const lineEnding = normalized.includes("\r\n") ? "\r\n" : "\n";
  const endMarker = `${lineEnding}---${lineEnding}`;
  const endIndex = normalized.indexOf(endMarker, 4);
  if (endIndex === -1) {
    throw new Error("RALPH.md frontmatter is opened but not closed.");
  }

  const rawYaml = normalized.slice(4, endIndex);
  const body = normalized.slice(endIndex + endMarker.length);
  const metadata = {};
  let currentArrayKey = null;
  let currentObject = null;

  for (const rawLine of rawYaml.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (!line.trim() || line.trimStart().startsWith("#")) continue;

    const topLevelMatch = line.match(/^([A-Za-z][A-Za-z0-9_-]*):(?:\s*(.*))?$/);
    if (topLevelMatch) {
      currentObject = null;
      const [, key, rawValue = ""] = topLevelMatch;
      if (!rawValue.trim()) {
        metadata[key] = [];
        currentArrayKey = key;
      } else {
        metadata[key] = parseScalar(rawValue);
        currentArrayKey = null;
      }
      continue;
    }

    const objectItemMatch = line.match(/^\s*-\s+([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
    if (objectItemMatch && currentArrayKey) {
      const [, key, rawValue] = objectItemMatch;
      currentObject = { [key]: parseScalar(rawValue) };
      metadata[currentArrayKey].push(currentObject);
      continue;
    }

    const scalarItemMatch = line.match(/^\s*-\s+(.*)$/);
    if (scalarItemMatch && currentArrayKey) {
      currentObject = null;
      metadata[currentArrayKey].push(parseScalar(scalarItemMatch[1]));
      continue;
    }

    const nestedMatch = line.match(/^\s+([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
    if (nestedMatch && currentObject) {
      const [, key, rawValue] = nestedMatch;
      currentObject[key] = parseScalar(rawValue);
      continue;
    }

    throw new Error(`Unsupported RALPH.md frontmatter line: ${line}`);
  }

  return { metadata, body };
}

export function loadLoopPackage(loopDir) {
  const ralphPath = path.join(loopDir, "RALPH.md");
  if (!fs.existsSync(ralphPath)) {
    throw new Error(`Missing RALPH.md at ${ralphPath}`);
  }

  const source = fs.readFileSync(ralphPath, "utf8");
  const parsed = parseFrontmatter(source);
  return {
    root: loopDir,
    ralphPath,
    source,
    body: parsed.body,
    metadata: parsed.metadata,
  };
}

export function validateLoopPackage(loopPackage) {
  const errors = [];
  const { metadata, body } = loopPackage;

  if (typeof metadata.agent !== "string" || !metadata.agent.trim()) {
    errors.push("frontmatter.agent must be a non-empty string");
  }

  if (!Array.isArray(metadata.commands) || metadata.commands.length === 0) {
    errors.push("frontmatter.commands must contain at least one command");
  } else {
    const names = new Set();
    for (const command of metadata.commands) {
      if (!command || typeof command !== "object") {
        errors.push("each command must be an object with name and run");
        continue;
      }
      if (typeof command.name !== "string" || !command.name.trim()) {
        errors.push("each command.name must be a non-empty string");
      } else if (names.has(command.name)) {
        errors.push(`duplicate command name: ${command.name}`);
      } else {
        names.add(command.name);
      }
      if (typeof command.run !== "string" || !command.run.trim()) {
        errors.push(`command ${command.name ?? "<unknown>"} must define run`);
      }
    }
  }

  if (!Array.isArray(metadata.args)) {
    errors.push("frontmatter.args must be an array, even when empty");
  }

  if (!body.trim()) {
    errors.push("RALPH.md body must describe loop instructions");
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

export function renderLoopPrompt(loopPackage, commandResults = {}, args = {}) {
  return loopPackage.body.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, expression) => {
    const key = expression.trim();
    if (key.startsWith("commands.")) {
      const commandName = key.slice("commands.".length);
      return commandResults[commandName] ?? "";
    }
    if (key.startsWith("args.")) {
      const argName = key.slice("args.".length);
      return args[argName] ?? "";
    }
    return "";
  });
}

