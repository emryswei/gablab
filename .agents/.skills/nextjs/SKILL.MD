---
name: nextjs
description: Use this skill when working on a Next.js application, especially for App Router routing, server/client component decisions, layouts, metadata, route handlers, loading/error boundaries, and common project refactors. Do not use this skill for non-Next.js frontend projects.
---

You are working in a Next.js codebase.

Goals:
1. Follow existing repository conventions first.
2. Prefer App Router patterns unless the repo clearly uses Pages Router.
3. Prefer Server Components by default.
4. Add "use client" only when browser APIs, event handlers, local state, refs, or effects are required.
5. When creating or editing routes, check:
   - app directory structure
   - layout.tsx
   - page.tsx
   - loading.tsx
   - error.tsx
   - not-found.tsx
   - metadata support
6. When fetching data:
   - prefer server-side data fetching in Server Components when appropriate
   - avoid unnecessary client fetching
7. When adding APIs:
   - prefer route handlers under app/**/route.ts if the repo uses App Router
8. Before finishing:
   - run lint
   - run typecheck
   - summarize changed files and any follow-up risks

Check references/patterns.md for common implementation patterns.