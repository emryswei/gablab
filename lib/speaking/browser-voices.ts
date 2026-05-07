export type BrowserVoice = {
  name: string;
  lang: string;
  default?: boolean;
  localService?: boolean;
};

export type EnglishAccent = "en-US" | "en-GB" | "en-AU";

export const ENGLISH_ACCENT_OPTIONS: Array<{ label: string; lang: EnglishAccent }> = [
  { label: "US", lang: "en-US" },
  { label: "UK", lang: "en-GB" },
  { label: "AU", lang: "en-AU" },
];

export function normalizeLang(lang: string) {
  return lang.toLowerCase();
}

function scoreVoice(voice: BrowserVoice) {
  if (voice.default) return 2;
  if (voice.localService) return 1;
  return 0;
}

export function selectBrowserVoice<TVoice extends BrowserVoice>(voices: TVoice[], requestedLang: EnglishAccent) {
  const normalizedRequested = normalizeLang(requestedLang);
  const exactMatches = voices.filter((voice) => normalizeLang(voice.lang) === normalizedRequested);

  if (exactMatches.length > 0) {
    return exactMatches.toSorted((a, b) => scoreVoice(b) - scoreVoice(a))[0] ?? null;
  }

  const englishMatches = voices.filter((voice) => normalizeLang(voice.lang).startsWith("en-"));
  if (englishMatches.length > 0) {
    return englishMatches.toSorted((a, b) => scoreVoice(b) - scoreVoice(a))[0] ?? null;
  }

  return voices.find((voice) => voice.default) ?? voices[0] ?? null;
}

export function hasBrowserVoiceForAccent(availableLangs: Set<string>, requestedLang: EnglishAccent) {
  return availableLangs.has(normalizeLang(requestedLang));
}
