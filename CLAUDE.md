# idle.beer

A UK pub incremental game (Vite + TypeScript, no framework). The full design and build notes are in DESIGN.md.

## Rules

- **Never add Claude co-author attribution to commits.** No `Co-Authored-By: Claude …` trailer (or any
  other AI attribution line) in commit messages or PR descriptions, even if tooling suggests one.
- Every number in the UI uses tabular (fixed-width) digits, so fast-changing numbers don't flicker. Any
  font used for the UI must really support `tnum`.
- All game quantities are `Decimal` (break_infinity.js via `src/core/num.ts`); never compare them with `<`/`>`.
- Every piece of text a player can see goes through `tr()` / `trn()` (`src/i18n`), or is marked `data-i18n` in
  `index.html`. The English text is the key. After adding or changing any, run `npm run i18n` and add the
  new sentences to each file in `src/i18n/locales/` (a test fails until every language has them).
- Numbers shown to players go through `format()` (`src/core/format.ts`), which follows the page's language.
  Don't build them with `toFixed` or `toLocaleString('en-GB')`.

## Commands

- `npm run dev`: dev server (add `?debug` to the URL for the debug panel)
- `npm test`: unit tests, including stress tests at huge numbers
- `npm run simulate -- [activity] [target] [runs]`: pacing simulator
- `npm run i18n`: collect every translatable sentence into `src/i18n/en.json`
- `npx tsx tools/i18n-check.ts [language…]`: check translation files against it
- `npm run build`: type-check and production build (one page per language)
- `npm run stats -- [days]`: play statistics from Cloudflare (needs `CF_ACCOUNT_ID` and `CF_API_TOKEN`)
