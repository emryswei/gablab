# GabLab Speaking MVP Specification

## Product Goal

GabLab is a local-first speaking practice MVP for Cantonese-speaking learners at CEFR A2-B1 level. The product goal is to validate whether learners return for structured English speaking practice, not to prove every speech technology feature at once.

The primary success criterion is:

- Complete three standard lessons in the first seven days after onboarding.
- Return and complete at least one standard lesson during days 8-14.

## Target Experience

- Desktop Chrome and Edge are the supported MVP browsers.
- English courses are the primary product path.
- Cantonese speaking remains available under Labs as a beta feature.
- UK English is the default voice, with a fallback to another installed English voice.
- AI conversation and corrected expressions use English.
- Coaching explanations use Traditional Chinese or written Cantonese.

## Course Structure

- Four-week curriculum with three standard lessons per week.
- Twelve lessons progress from description to narration, opinions, and problem solving.
- The recommended sequence is visible but not hard-locked.
- Standard practice targets 20-30 minutes and at least 12 learner turns.
- Quick practice targets 5-10 minutes and uses a random unlocked topic.
- Quick practice is tracked separately and does not advance the weekly `3/3` goal.

The first vertical slice is `Introducing Yourself and Daily Life`. It uses fixed learning checkpoints with adaptive AI follow-up questions.

## Coaching Rules

- Correct immediately only when an error blocks understanding or a pattern recurs.
- Minor errors are recorded for the final report without interrupting the learner.
- Low-confidence or abnormal transcripts must be confirmed before they affect scoring.
- Standard reports contain four 1-5 ratings: fluency, accuracy, vocabulary, and responsiveness.
- Every rating requires evidence and one practical improvement suggestion.
- Reports show two strengths, no more than three priority errors, and one next-session goal.
- Quick practice receives a short response and one improvement focus, without long-term ratings.
- MVP does not claim pronunciation scoring.

## Learning Data

- Raw audio is never persisted.
- Audio may be processed during a session to derive timing and pause metrics.
- `localStorage` stores consent, preferences, and lightweight indexes.
- IndexedDB stores sessions, reports, learner profile data, and transcripts.
- Full transcripts expire after 30 days; reports and progress remain.
- Users can view, export, and delete all local learning data.
- If IndexedDB fails, the learner may continue in an explicit non-persistent mode and export the report as JSON.
- Every session records schema, lesson, rubric, and model versions.

## Session Behavior

- Active practice time excludes explicit pauses and provider failure waits.
- A standard session ended before its completion threshold is stored as incomplete and can be resumed.
- Session state is checkpointed after each completed turn.
- Refreshing or reopening the app offers to resume; it never starts the microphone automatically.
- LLM failures retry once, then pause the session without losing progress.
- Standard controls are pause, replay AI, skip question, and end practice.

## Privacy And Evaluation

- Before first practice, explain that transcript text and necessary context are sent to Cloudflare while raw audio is not sent to the LLM.
- Usage data stays local unless the user explicitly exports an anonymous evaluation package.
- Fixture evaluation validates parsing and response contracts.
- Live model evaluation uses at least 20 fixed samples with human review.
- Release requires 20/20 valid contracts, at least 17/20 acceptable responses, and zero severe corrections or unintended language switches.

## Explicit Non-Goals

- Multi-user accounts or cloud sync.
- Full offline LLM support.
- Mobile Safari as an MVP acceptance target.
- Phoneme-level pronunciation assessment.
- Full WCAG audit, although keyboard controls, focus states, transcripts, non-color status indicators, and reduced motion are required.

