export type BrowserVoice = {
  name: string;
  lang: string;
  default?: boolean;
  localService?: boolean;
};

export type EnglishAccent = "en-US" | "en-GB" | "en-AU";
export type SpeakingLanguage = "english" | "cantonese";
export type AssistantVoiceLocale = EnglishAccent | "zh-HK";
export type CantoneseVoice = "Danny" | "Tracy";

export const ENGLISH_ACCENT_OPTIONS: Array<{ label: string; lang: EnglishAccent }> = [
  { label: "US", lang: "en-US" },
  { label: "UK", lang: "en-GB" },
  { label: "AU", lang: "en-AU" },
];

export const CANTONESE_LOCALE: AssistantVoiceLocale = "zh-HK";
export const CANTONESE_VOICE_OPTIONS: Array<{ label: string; voice: CantoneseVoice }> = [
  { label: "Danny", voice: "Danny" },
  { label: "Tracy", voice: "Tracy" },
];

export function normalizeLang(lang: string) {
  return lang.toLowerCase();
}

function scoreVoice(voice: BrowserVoice) {
  if (voice.default) return 2;
  if (voice.localService) return 1;
  return 0;
}

export function selectBrowserVoice<TVoice extends BrowserVoice>(
  voices: TVoice[],
  requestedLang: AssistantVoiceLocale,
  preferredVoiceName?: CantoneseVoice,
) {
  const normalizedRequested = normalizeLang(requestedLang);
  const exactMatches = voices.filter((voice) => normalizeLang(voice.lang) === normalizedRequested);

  if (exactMatches.length > 0) {
    if (preferredVoiceName) {
      const normalizedPreferredName = preferredVoiceName.toLowerCase();
      const preferredVoice = exactMatches.find((voice) => voice.name.toLowerCase().includes(normalizedPreferredName));
      if (preferredVoice) {
        return preferredVoice;
      }
    }
    return exactMatches.toSorted((a, b) => scoreVoice(b) - scoreVoice(a))[0] ?? null;
  }

  if (requestedLang === CANTONESE_LOCALE) {
    return null;
  }

  const requestedLanguageFamily = normalizedRequested.split("-")[0];
  const languageMatches = voices.filter((voice) => normalizeLang(voice.lang).startsWith(`${requestedLanguageFamily}-`));
  if (languageMatches.length > 0) {
    return languageMatches.toSorted((a, b) => scoreVoice(b) - scoreVoice(a))[0] ?? null;
  }

  return voices.find((voice) => voice.default) ?? voices[0] ?? null;
}

export function hasBrowserVoiceForAccent(availableLangs: Set<string>, requestedLang: AssistantVoiceLocale) {
  return availableLangs.has(normalizeLang(requestedLang));
}

export function hasBrowserVoiceNamed(
  voices: BrowserVoice[],
  requestedLang: AssistantVoiceLocale,
  preferredVoiceName: CantoneseVoice,
) {
  const normalizedRequested = normalizeLang(requestedLang);
  const normalizedPreferredName = preferredVoiceName.toLowerCase();
  return voices.some(
    (voice) =>
      normalizeLang(voice.lang) === normalizedRequested && voice.name.toLowerCase().includes(normalizedPreferredName),
  );
}
