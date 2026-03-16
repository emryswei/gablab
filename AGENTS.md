# AGENTS.md

## Project rules
- This repo uses Next.js App Router.
- Prefer TypeScript.
- Prefer Server Components by default; use Client Components only when browser interactivity is required.
- Use `npm` for package management.
- After code changes, run:
  - `npm lint`
  - `npm typecheck`
- Keep route files under `app/`.
- Do not add new dependencies unless necessary.
- Prefer absolute imports if the repo already uses them.