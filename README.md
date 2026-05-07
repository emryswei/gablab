GabLab is a [Next.js](https://nextjs.org) App Router project for speaking and vocabulary practice.

## File Structure

```text
app/                         Next.js routes, pages, and API route handlers
components/                  Shared UI components
lib/                         Shared backend/data access helpers
scripts/                     Local quality and Ralph loop tooling
tests/                       Node test runner tests for project tooling
.agents/ralph/               Ralph loop packages, failure models, and run records
public/                      Static assets and seed word files
```

## Ralph Loop Quality Flow

Core idea: a Ralph loop is a repeatable engineering loop that uses deterministic feedback instead of only trusting a single model response or a narrow unit test.

Fundamental facts:
- Frontend code is under `app/` and browser interactivity must stay in Client Components.
- Backend API routes are under `app/api/` and must validate request input.
- Database access is isolated behind `lib/mysql.ts`.
- Quality is not only unit tests; lint, TypeScript, and failure-model coverage are separate signals.

Step-by-step flow:
1. Write or update a failing test for the smallest behavior.
2. Implement the smallest production change.
3. Run `npm run quality`.
4. If any gate fails, treat the iteration as failed and fix the first concrete signal.
5. Run `npm run ralph` to execute the project Ralph loop and save a run record under `.agents/ralph/runs/`.

Useful commands:

```bash
npm test
npm run failure-model
npm run quality
npm run ralph
```

Analogy: unit tests are like checking a door key. The failure model is like checking the door frame, lock, alarm, and escape route too. A key can turn and still not mean the building is safe.

## Getting Started

First, run the development server:

```bash
npm run dev
```

Open [http://localhost:9528](http://localhost:9528) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
