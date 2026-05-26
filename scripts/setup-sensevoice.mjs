import { createWriteStream, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { spawnSync } from "node:child_process";

const archiveName = "sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2024-07-17.tar.bz2";
const modelDirectory = "sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2024-07-17";
const downloadUrl = `https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/${archiveName}`;
const root = path.join(process.cwd(), "models", "sensevoice");
const archivePath = path.join(root, archiveName);
const modelPath = path.join(root, modelDirectory, "model.int8.onnx");
const tokensPath = path.join(root, modelDirectory, "tokens.txt");

async function main() {
  if (existsSync(modelPath) && existsSync(tokensPath)) {
    console.log(`SenseVoice model is ready at ${path.join(root, modelDirectory)}.`);
    return;
  }

  mkdirSync(root, { recursive: true });
  console.log("Downloading SenseVoice-Small int8 model...");
  const response = await fetch(downloadUrl);
  if (!response.ok || !response.body) {
    throw new Error(`Unable to download model: HTTP ${response.status}.`);
  }
  await pipeline(response.body, createWriteStream(archivePath));

  console.log("Extracting SenseVoice model...");
  const extraction = spawnSync("tar", ["-xf", archivePath, "-C", root], { stdio: "inherit" });
  if (extraction.status !== 0) {
    throw new Error("Model extraction failed. Install a tar-compatible extractor and retry.");
  }
  rmSync(archivePath, { force: true });

  if (!existsSync(modelPath) || !existsSync(tokensPath)) {
    throw new Error("Downloaded archive did not contain the expected SenseVoice files.");
  }
  console.log(`SenseVoice model is ready at ${path.join(root, modelDirectory)}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
