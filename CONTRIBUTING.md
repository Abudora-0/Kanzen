# Contributing to Kanzen

Thanks for taking a look. This is a portfolio grade project but contributions are welcome.

## Setup

```bash
pnpm install
cp .env.example .env
docker compose up -d
pnpm seed
pnpm dev
```

## Ground rules

- **No em dashes or en dashes.** Use a plain hyphen. `pnpm check:prose` enforces this and runs in
  the pre commit hook and CI.
- **Types are strict.** `pnpm typecheck` must pass. Prefer `zod` schemas at the edges.
- **Keep the adapter interface honest.** New providers implement `MediaProvider` in
  `packages/providers` and add fixtures so the demo still works with zero credentials.
- **Aggregation stays in pipeline builders.** New insights are a named function in
  `apps/api/src/insights/pipelines.ts` with a Vitest case.

## Before opening a pull request

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm check:prose
```

Conventional commit messages (`feat:`, `fix:`, `chore:`, `docs:`) are appreciated.

## Project layout

See the monorepo layout section in the [README](./README.md#monorepo-layout).
