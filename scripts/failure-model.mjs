import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_LAYERS = new Set(["frontend", "backend", "database", "quality"]);

export function validateFailureModel(model) {
  const errors = [];
  if (!model || typeof model !== "object") {
    return { ok: false, errors: ["failure model must be an object"] };
  }

  if (!Array.isArray(model.failures) || model.failures.length === 0) {
    errors.push("failure model must include a non-empty failures array");
  }

  const seenIds = new Set();
  const seenLayers = new Set();

  for (const failure of model.failures ?? []) {
    if (!failure || typeof failure !== "object") {
      errors.push("each failure must be an object");
      continue;
    }

    if (typeof failure.id !== "string" || !failure.id.trim()) {
      errors.push("each failure needs a non-empty id");
    } else if (seenIds.has(failure.id)) {
      errors.push(`duplicate failure id: ${failure.id}`);
    } else {
      seenIds.add(failure.id);
    }

    if (!REQUIRED_LAYERS.has(failure.layer)) {
      errors.push(`failure ${failure.id ?? "<unknown>"} has unsupported layer: ${failure.layer}`);
    } else {
      seenLayers.add(failure.layer);
    }

    for (const field of ["risk", "signal", "detection", "response"]) {
      if (typeof failure[field] !== "string" || !failure[field].trim()) {
        errors.push(`failure ${failure.id ?? "<unknown>"} needs ${field}`);
      }
    }
  }

  for (const requiredLayer of REQUIRED_LAYERS) {
    if (!seenLayers.has(requiredLayer)) {
      errors.push(`failure model must cover ${requiredLayer}`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

export function loadFailureModel(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function main() {
  const scriptPath = fileURLToPath(import.meta.url);
  const repoRoot = path.dirname(path.dirname(scriptPath));
  const modelPath = path.join(repoRoot, ".agents", "ralph", "gablab-quality-loop", "failure-model.json");
  const result = validateFailureModel(loadFailureModel(modelPath));

  if (!result.ok) {
    console.error("Failure model validation failed:");
    for (const error of result.errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log("Failure model validation passed.");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}

