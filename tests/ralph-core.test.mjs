import test from "node:test";
import assert from "node:assert/strict";
import { parseFrontmatter, renderLoopPrompt, validateLoopPackage } from "../scripts/ralph-core.mjs";

test("parseFrontmatter reads agent, command objects, args, and body", () => {
  const parsed = parseFrontmatter(`---
agent: "codex"
commands:
  - name: tests
    run: npm test
args:
  - focus
---
# Loop
{{ commands.tests }}
{{ args.focus }}
`);

  assert.equal(parsed.metadata.agent, "codex");
  assert.deepEqual(parsed.metadata.commands, [{ name: "tests", run: "npm test" }]);
  assert.deepEqual(parsed.metadata.args, ["focus"]);
  assert.match(parsed.body, /# Loop/);
});

test("validateLoopPackage rejects incomplete loop metadata", () => {
  const result = validateLoopPackage({
    metadata: {
      agent: "",
      commands: [{ name: "tests", run: "" }],
      args: [],
    },
    body: "",
  });

  assert.equal(result.ok, false);
  assert.deepEqual(result.errors, [
    "frontmatter.agent must be a non-empty string",
    "command tests must define run",
    "RALPH.md body must describe loop instructions",
  ]);
});

test("renderLoopPrompt injects deterministic command feedback and args", () => {
  const prompt = renderLoopPrompt(
    {
      body: "Tests:\n{{ commands.tests }}\nFocus: {{ args.focus }}",
    },
    { tests: "exit 1\nmissing assertion" },
    { focus: "speaking flow" },
  );

  assert.equal(prompt, "Tests:\nexit 1\nmissing assertion\nFocus: speaking flow");
});

