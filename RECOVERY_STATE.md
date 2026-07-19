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
- Added a four-prompt, 3-5 minute non-scoring speaking baseline at `/baseline`.
- Baseline profiles store derived word metrics, focus areas, and a lesson recommendation without persisting audio or response transcripts.
- Added transient microphone activity tracking for answer duration, lead-in, speaking time, and pauses without persisting raw audio.
- Added validated per-turn timing metrics and session timing summaries as fluency-only report evidence.
- Added a development-only controlled browser fixture at `/speaking/fixture` with twelve fixed learner transcripts.
- The fixture verifies IndexedDB checkpoints, completed reports, and vocabulary-review enqueueing, then removes its test records.
- Added `npm run e2e:fixture` desktop Chrome/Edge coverage that runs the fixture through the real browser page and asserts the success summary.
- Expanded speaking coach evaluation to 20 cases: 10 English and 10 Cantonese, with fixture and live modes.
- Reviewed 20 live English and Cantonese model evaluation cases. English passed 10/10 consistently; the latest guarded live run passed 20/20 overall and 10/10 Cantonese.
- Strengthened Cantonese coach prompting, added one retry for empty model responses, and suppressed correction/feedback when the Cantonese learner sentence has no clear issue.
- Added stricter Cantonese quality guards for known bad advice, missing clear corrections, and English follow-up leakage in Cantonese mode.
- Started desktop microphone smoke testing: dev server loads `/speaking`, SenseVoice model assets exist locally, and `/api/speaking/stt` successfully transcribes the bundled Cantonese `yue.wav` sample.
- Verified Docker MySQL startup and imported `worddb.EnWords`; moved the host database port from Windows-reserved `9529` to `3307`.
- Moved the Next.js development port from Windows-reserved `9528` to `3000`; the homepage returns HTTP 200 and opens successfully in the in-app browser.

## Pending Work
- Complete the user-assisted real microphone smoke test for the English and Cantonese speaking workflow.

## Architecture Decisions
- English STT remains browser `SpeechRecognition`.
- Cantonese STT uses local SenseVoice (`language: "yue"`) through a Node.js Next API route.
- TTS remains browser `speechSynthesis`; Cantonese voice can prefer installed `Danny` or `Tracy` `zh-HK` voices.
- SenseVoice model assets are downloaded locally under `models/` and excluded from Git.
- Language changes start a new conversation session to prevent stale responses crossing modes.
- Speaking baseline transcripts remain in memory only; the local profile stores derived metrics and the recommended lesson ID.
- Lesson audio energy is processed transiently; only derived timing metrics are stored with learner turns and may support fluency evidence.
- Controlled browser fixtures are development-only, avoid microphone/model dependencies, and clean their local test data after verification.
- Local development uses `http://localhost:3000`; Docker MySQL is exposed on host port `3307`.

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
- `scripts/evaluate-speaking-coach.mjs`
- `lib/learning/review.ts`
- `lib/learning/storage.ts`
- `app/vocabulary/review-queue.tsx`
- `app/vocabulary/review/page.tsx`
- `lib/learning/baseline.ts`
- `app/baseline/baseline-assessment.tsx`
- `app/baseline/page.tsx`
- `lib/learning/speech-metrics.ts`
- `app/speaking/use-mic-visualizer.ts`
- `lib/learning/browser-fixture.ts`
- `app/speaking/fixture/controlled-fixture.tsx`
- `app/speaking/fixture/page.tsx`
- `scripts/e2e-controlled-fixture.mjs`
- `scripts/setup-sensevoice.mjs`
- `docker-compose.yml`
- `.env.local`

## Unresolved Bugs
- Console/test output has existing Node `MODULE_TYPELESS_PACKAGE_JSON` warnings.
- Browser Cantonese TTS naturalness depends on installed `zh-HK` system voices.
- The real microphone workflow still needs user-assisted browser microphone permission and spoken-input verification.
- Cloudflare Qwen Cantonese responses remain nondeterministic, so live eval should be re-run before release even though the latest guarded run passed 20/20.

## Rejected Approaches And Reasons
- Browser `SpeechRecognition` for Cantonese: produced unreliable transcription such as `你好` becoming `雷猴`.
- Treating `zh-TW` TTS voice as Cantonese fallback: risks Mandarin pronunciation for Cantonese text.
- Committing SenseVoice model binaries: too large; model remains local and gitignored.
- Focusing on premium voice quality now: user deferred TTS/intonation improvements in favor of smarter coaching.

## Exact Next Step
- With the browser open at `http://localhost:3000/speaking`, have the user allow microphone access and speak one English sentence plus one Cantonese sentence; verify browser STT, SenseVoice STT, and browser TTS in the UI.
