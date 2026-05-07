import test from "node:test";
import assert from "node:assert/strict";
import { hasBrowserVoiceForAccent, selectBrowserVoice } from "../lib/speaking/browser-voices.ts";

test("selectBrowserVoice prefers the requested English accent", () => {
  const voice = selectBrowserVoice(
    [
      { name: "US voice", lang: "en-US" },
      { name: "UK voice", lang: "en-GB" },
    ],
    "en-GB",
  );

  assert.equal(voice?.name, "UK voice");
});

test("selectBrowserVoice falls back to another English voice before non-English voices", () => {
  const voice = selectBrowserVoice(
    [
      { name: "French voice", lang: "fr-FR", default: true },
      { name: "US voice", lang: "en-US" },
    ],
    "en-AU",
  );

  assert.equal(voice?.name, "US voice");
});

test("selectBrowserVoice uses default voice when no English voice exists", () => {
  const voice = selectBrowserVoice(
    [
      { name: "French voice", lang: "fr-FR" },
      { name: "German voice", lang: "de-DE", default: true },
    ],
    "en-US",
  );

  assert.equal(voice?.name, "German voice");
});

test("hasBrowserVoiceForAccent compares normalized language codes", () => {
  assert.equal(hasBrowserVoiceForAccent(new Set(["en-gb"]), "en-GB"), true);
  assert.equal(hasBrowserVoiceForAccent(new Set(["en-us"]), "en-AU"), false);
});
