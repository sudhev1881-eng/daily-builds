<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

- This is the AgendaTax project (a client-side meeting cost calculator). Standard commands live in `package.json` and `README.md`: `npm run dev` (port 3000), `npm run build`, `npm run lint`, `npm run verify` (cost-engine sanity checks, no test runner). Run all of them from this `agendatax/` directory.
- Node 22 is the supported runtime (matches CI in `.github/workflows/deploy-agendatax.yml`). Dependencies are refreshed automatically by the startup update script, so you don't normally need to run `npm ci` yourself.
- `.env.local` is optional for local dev — the app falls back to sane defaults. Copy `.env.example` if you want to set `NEXT_PUBLIC_APP_URL` etc.
- The dev server (Turbopack) hot-reloads source edits automatically. If you change dependencies or `next.config.ts`, restart it.
- Static-export gotcha: `npm run build` produces a normal server build (including the `POST /api/report` route). The GitHub Pages artifact is different — it sets `NEXT_PUBLIC_STATIC_EXPORT=1` and temporarily removes `src/app/api` before `next build` (see the deploy workflow / `scripts/static-build.mjs`). The client `Export report` button falls back to local Markdown generation when the API route is absent, so both hosted and static builds work.
