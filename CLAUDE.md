# idle.beer

A UK pub incremental game (Vite + TypeScript, no framework). The full design and build notes are in DESIGN.md.

## Rules

- **Never add Claude co-author attribution to commits.** No `Co-Authored-By: Claude …` trailer (or any
  other AI attribution line) in commit messages or PR descriptions, even if tooling suggests one.
- Every number in the UI uses tabular (fixed-width) digits, so fast-changing numbers don't flicker. Any
  font used for the UI must really support `tnum`.
- All game quantities are `Decimal` (break_infinity.js via `src/core/num.ts`); never compare them with `<`/`>`.

## Commands

- `npm run dev`: dev server (add `?debug` to the URL for the debug panel)
- `npm test`: unit tests, including stress tests at huge numbers
- `npm run simulate -- [activity] [target] [runs]`: pacing simulator
- `npm run build`: type-check and production build
