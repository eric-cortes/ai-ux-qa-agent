# AI UX QA Agent

Local QA monorepo: `apps/web` is the English Next.js dashboard, `apps/api` is FastAPI,
`workers/browser` collects Playwright evidence, `workers/ai` analyzes it, and
`packages/shared-types` contains Zod schemas. Docker provides PostgreSQL and Redis.

Runs live in the API’s in-memory `_RUNS` list in `apps/api/app/services/runs.py` and are
lost on API restart. Artifacts are files under `storage/artifacts`. PostgreSQL and Redis are
provisioned by `infrastructure/docker` but are not used by the current code.

## Commands

Use Node 26 and pnpm 12.23.0. `pnpm dev` starts API and web; `pnpm dev:web` starts only web;
`pnpm dev:browser-worker` invokes the browser worker. `pnpm build` and `pnpm start` build and
serve web. `pnpm lint`, `pnpm lint:fix`, `pnpm format`, `pnpm format:check`, `pnpm typecheck`,
and `pnpm check:tailwind` are individual checks; `pnpm validate` combines lint, formatting,
type checking and Tailwind. `pnpm test` runs workspace Vitest; `pnpm e2e` runs web Playwright.
Python checks remain `ruff check apps workers`, `ruff format --check apps workers` and
`python -m pytest -v` from each of `apps/api` and `workers/ai`.

## Gotchas

- Lefthook runs ESLint with package roots `apps/web/`, `workers/browser/` and
  `packages/shared-types/`; staged paths must be relative to those roots.
- Python is outside the JavaScript tooling scope. Do not change Python to fix JS validation.
- CI uses `master` and `development`, with `master` retained by explicit user decision.
- Existing tracked generated files include `apps/web/tsconfig.tsbuildinfo`,
  `apps/web/next-env.d.ts` and `apps/api/ai_ux_qa_api.egg-info`. Do not casually regenerate or delete them.
- Live web needs the API at `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:8000/api`).
  Provide the value to the Next.js process; root `.env` alone is not Next.js configuration.
- E2E mocks the API and artifacts; it does not require Python, PostgreSQL or Redis.
- Text is English only, without locale routing. Register all twelve message namespaces in
  both `i18n/request.ts` and the shared test render helper.
- Polling runs every four seconds. Abort requests on selection changes/unmount and guard
  responses against stale selection; never display raw API or worker errors.
- Theme follows the system, without a toggle. Increased contrast uses `contrast-more`.

## Rules

- Talk by default. Don't edit files or run commands until asked. Read-only commands (like `git status`) are always OK.
- Use pnpm only (pnpm, pnpm exec, pnpm dlx); never npm, npx or yarn.
- File names: components PascalCase, hooks camelCase, tests `<name>.test.ts(x)`, other code kebab-case.
- Add test setup only after user approval. Once the test setup exists, every new component, hook or function gets its own tests in the same change. Web tests were approved for this app.
- No `!important` and no `!` modifier; never edit scripts/check-tailwind.mjs to make it pass.
- Tailwind apps: only Tailwind, no hand-written CSS. The main CSS holds only `@import`, `@theme` (with `--animate-*` and `@keyframes`), `@custom-variant` and the `:root` variant blocks. No own selectors, `<style>` tags or `style` props for looks. If CSS seems needed (CSS file, `style` props or `<style>` tags), it goes in the plan with the reason, and is written only after the plan is approved.
- Theme tokens (colors, fonts) are defined in @theme in the main CSS; mode-specific values live as backing variables in :root variant blocks in the same file. Components use the token names or Tailwind's standard colors.
- Shared UI parts live in components/UI/ on Base UI, with variant and size props, and pass className (also the function form) and all other props through.
- Reuse shared UI components. No one-off copies of markup or styles.
- Use Base UI for every UI part it has. If it has no fitting part, say so clearly before building one yourself.
- Reuse existing styles: copy the classes from a component that does the same job. For the first component of a kind, use sizes from the Tailwind default scale. After that, copy from existing components. Never invent arbitrary sizes like text-[13px].
- Use the theme's color names (`bg-surface`, `text-ink`) or Tailwind's standard colors (`text-white`). No `#hex`, no arbitrary color values like `text-[#ffffff]`, no `dark:` for colors.
- Use `cn` to combine classes.
- Icons only from the icon library. Never hand-drawn SVG icons. This app uses react-icons/rx; the approved circular favicon is the static brand asset exception.
- Respect "reduce motion": use `motion-safe:` on Tailwind transitions, animations and smooth scroll (`motion-safe:scroll-smooth`). With it on, content shows at once in its final state. This app has no Motion animations or animation studio.
- Apps with a UI: no text typed into code. All user-facing text lives in `messages/<locale>/<namespace>.json` (next-intl; `use-intl` without Next). Line breaks: `\n` in the JSON plus `whitespace-pre-line`, never `<br>`.
- Check every UI state (loading, empty, error, disabled, …). Each shows something meant for the user, never internal codes or raw errors. No layout jumps or shifts between states.
- Next.js apps: Keep shared UI (nav, sidebar, footer) in the nearest shared `layout.tsx`, so it stays in place when moving between pages.
- Next.js apps: internal links: use `<Link>` or the Next.js router. Never `window.location` or a plain `<a>`, which reloads the whole page. A plain `<a>` is fine for outside links and downloads.
- Keep state in the component that uses it. Move it up only when several components need it.
- Re-renders are normal. Avoid remounts (component rebuilt, its state lost) and full page reloads.
- Don't add `memo` by default. Only when a measured slowdown needs it.
- Don't touch the DOM directly in React (`document.getElementById`, `querySelector` and the like). Use state, props and refs. Only as a last resort, when there is no React way.
- Never install tools or packages without asking first.
- Keep `docs/app-overview.html` updated when sections, stack or concepts change.
- Never say a change is clean, passing or ready unless you ran the check and saw the result. If you didn't run it, say so.
- Before editing, check `git status`. Never overwrite changes you didn't make.
- When you use an exception to any of these rules (for example direct DOM access or `memo`), explain why in your reply and in a short code comment next to it.
