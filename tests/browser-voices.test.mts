import test from "node:test";
import assert from "node:assert/strict";
import { hasBrowserVoiceForAccent, hasBrowserVoiceNamed, selectBrowserVoice } from "../lib/speaking/browser-voices.ts";

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

test("selectBrowserVoice falls back to the requested language family before unrelated voices", () => {
  const voice = selectBrowserVoice(
    [
      { name: "French voice", lang: "fr-FR", default: true },
      { name: "US voice", lang: "en-US" },
    ],
    "en-AU",
  );

  assert.equal(voice?.name, "US voice");
});

test("selectBrowserVoice prefers a Cantonese voice for zh-HK sessions", () => {
  const voice = selectBrowserVoice(
    [
      { name: "UK voice", lang: "en-GB", default: true },
      { name: "HK voice", lang: "zh-HK" },
      { name: "TW voice", lang: "zh-TW" },
    ],
    "zh-HK",
  );

  assert.equal(voice?.name, "HK voice");
});

test("selectBrowserVoice uses selected Danny or Tracy Cantonese voice", () => {
  const voices = [
    { name: "Microsoft Danny - Chinese (Traditional, Hong Kong SAR)", lang: "zh-HK" },
    { name: "Microsoft Tracy Online (Natural) - Chinese (Traditional, Hong Kong SAR)", lang: "zh-HK" },
  ];

  assert.match(selectBrowserVoice(voices, "zh-HK", "Danny")?.name ?? "", /Danny/);
  assert.match(selectBrowserVoice(voices, "zh-HK", "Tracy")?.name ?? "", /Tracy/);
});

test("selectBrowserVoice does not replace Cantonese with another Chinese locale", () => {
  const voice = selectBrowserVoice(
    [
      { name: "UK voice", lang: "en-GB", default: true },
      { name: "TW voice", lang: "zh-TW" },
    ],
    "zh-HK",
  );

  assert.equal(voice, null);
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
  assert.equal(hasBrowserVoiceForAccent(new Set(["zh-hk"]), "zh-HK"), true);
});

test("hasBrowserVoiceNamed identifies installed Cantonese system voices", () => {
  const voices = [{ name: "Microsoft Tracy Online (Natural) - Chinese (Traditional, Hong Kong SAR)", lang: "zh-hk" }];

  assert.equal(hasBrowserVoiceNamed(voices, "zh-HK", "Tracy"), true);
  assert.equal(hasBrowserVoiceNamed(voices, "zh-HK", "Danny"), false);
});
