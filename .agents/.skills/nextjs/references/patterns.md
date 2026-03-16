# Next.js patterns

## App Router defaults
- New routes go under `app/`
- Shared UI goes in `layout.tsx`
- Page entry files use `page.tsx`

## Component choice
- Server Component by default
- Client Component only when interactivity is required

## Data fetching
- Prefer server fetching in Server Components
- Avoid moving fetch logic to client unless necessary

## Route handlers
- Use `app/api/.../route.ts` or route handlers near the route when suitable

## Validation
- Run:
  - `pnpm lint`
  - `pnpm typecheck`