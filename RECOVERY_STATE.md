# Recovery State

## Current Objective
- Complete the local-first English learning MVP progression and review loop.

## Completed Work
- Refreshed the UI with a dark technology-oriented visual style across home, speaking, and vocabulary pages.
- Added English / Cantonese speaking modes.
- Added Cantonese coach prompting and localized conversation copy.
- Replaced Cantonese browser speech recognition with local SenseVoice STT through `/api/speaking/stt`.
- Added `npm run setup:sensevoice` to download the gitignored local SenseVoice int8 model.
- Added Cantonese browser voice selection for `Danny` and `Tracy`.
- Added focused tests for browser voice selection, Cantonese coach prompts, and WAV decoding.
- Pushed commit `d0747d2` (`Add Cantonese speaking mode with SenseVoice and refreshed UI`) to `origin/master`.
- Upgraded the default Cloudflare coach model to `@cf/qwen/qwen3-30b-a3b-fp8`.
- Added structured coach responses with correction and feedback UI.
- Added lesson sessions, privacy consent, reports, dashboard progress, and completed-transcript cleanup.
- Added deduplicated day 1, 3, 7, and 14 expression review at `/vocabulary/review`.

## Pending Work
- Add the 3-5 minute speaking baseline.
- Add transient audio timing and pause metrics without storing raw audio.
- Add the controlled transcript browser fixture and desktop end-to-end coverage.
- Review 20 live English and Cantonese model evaluation cases.

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
- `lib/learning/review.ts`
- `lib/learning/storage.ts`
- `app/vocabulary/review-queue.tsx`
- `app/vocabulary/review/page.tsx`
- `scripts/setup-sensevoice.mjs`
- `.env.local`

## Unresolved Bugs
- Console/test output has existing Node `MODULE_TYPELESS_PACKAGE_JSON` warnings.
- Browser Cantonese TTS naturalness depends on installed `zh-HK` system voices.
- The real microphone workflow still needs a desktop smoke test.

## Rejected Approaches And Reasons
- Browser `SpeechRecognition` for Cantonese: produced unreliable transcription such as `你好` becoming `雷猴`.
- Treating `zh-TW` TTS voice as Cantonese fallback: risks Mandarin pronunciation for Cantonese text.
- Committing SenseVoice model binaries: too large; model remains local and gitignored.
- Focusing on premium voice quality now: user deferred TTS/intonation improvements in favor of smarter coaching.

## Exact Next Step
- Add a 3-5 minute speaking baseline that produces a non-scoring starting profile and feeds the first lesson recommendation.
