# Recovery State

## Current Objective
- Improve the speaking coach intelligence using a free large language model, without changing the current STT/TTS priorities.

## Completed Work
- Refreshed the UI with a dark technology-oriented visual style across home, speaking, and vocabulary pages.
- Added English / Cantonese speaking modes.
- Added Cantonese coach prompting and localized conversation copy.
- Replaced Cantonese browser speech recognition with local SenseVoice STT through `/api/speaking/stt`.
- Added `npm run setup:sensevoice` to download the gitignored local SenseVoice int8 model.
- Added Cantonese browser voice selection for `Danny` and `Tracy`.
- Added focused tests for browser voice selection, Cantonese coach prompts, and WAV decoding.
- Pushed commit `d0747d2` (`Add Cantonese speaking mode with SenseVoice and refreshed UI`) to `origin/master`.

## Pending Work
- Upgrade the coach LLM from `@cf/meta/llama-3.1-8b-instruct` to a stronger free-tier candidate, preferably Cloudflare `@cf/qwen/qwen3-30b-a3b-fp8`.
- Redesign coach output contract to support natural reply plus optional correction and feedback.
- Add UI rendering for correction/feedback after the backend contract is implemented.
- Add English and Cantonese evaluation samples for model comparison.

## Architecture Decisions
- English STT remains browser `SpeechRecognition`.
- Cantonese STT uses local SenseVoice (`language: "yue"`) through a Node.js Next API route.
- TTS remains browser `speechSynthesis`; Cantonese voice can prefer installed `Danny` or `Tracy` `zh-HK` voices.
- SenseVoice model assets are downloaded locally under `models/` and excluded from Git.
- Language changes start a new conversation session to prevent stale responses crossing modes.

## Important Files
- `app/speaking/speaking-coach.tsx`
- `app/speaking/use-sensevoice-stt.ts`
- `app/speaking/use-assistant-speech.ts`
- `app/speaking/cantonese-voice-selector.tsx`
- `app/api/speaking/stt/route.ts`
- `lib/speaking/stt/sensevoice.ts`
- `lib/speaking/coach/providers.ts`
- `lib/speaking/coach/messages.ts`
- `lib/speaking/coach/service.ts`
- `scripts/setup-sensevoice.mjs`
- `.env.local`

## Unresolved Bugs
- Console/test output has existing Node `MODULE_TYPELESS_PACKAGE_JSON` warnings.
- Browser Cantonese TTS naturalness depends on installed `zh-HK` system voices.
- The latest coach intelligence upgrade has not been implemented or tested.

## Rejected Approaches And Reasons
- Browser `SpeechRecognition` for Cantonese: produced unreliable transcription such as `你好` becoming `雷猴`.
- Treating `zh-TW` TTS voice as Cantonese fallback: risks Mandarin pronunciation for Cantonese text.
- Committing SenseVoice model binaries: too large; model remains local and gitignored.
- Focusing on premium voice quality now: user deferred TTS/intonation improvements in favor of smarter coaching.

## Exact Next Step
- Change the configured Cloudflare coach model to `@cf/qwen/qwen3-30b-a3b-fp8`, then implement and test a structured coach response contract containing `reply`, `corrected`, `feedback`, and `followUpQuestion`.
