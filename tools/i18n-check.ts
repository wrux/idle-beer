/**
 * Checks translation files against src/i18n/en.json: every sentence present, nothing extra,
 * placeholders intact, and plurals given in the forms the language actually has.
 *   npx tsx tools/i18n-check.ts          (all languages)
 *   npx tsx tools/i18n-check.ts de fr    (just these)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOCALES, type Messages } from '../src/i18n/locales';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort().join(' ');

/** Problems with one language's file ("" if it has none). A missing file is one problem. */
export function checkLocale(code: string, english: Messages): string[] {
  const locale = LOCALES.find((l) => l.path === code);
  if (!locale) return [`${code}: not a language the game has`];
  const file = path.join(root, 'src/i18n/locales', `${code}.json`);
  if (!fs.existsSync(file)) return [`${code}: no file at src/i18n/locales/${code}.json`];
  let table: Messages;
  try {
    table = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return [`${code}: not valid JSON (${(e as Error).message})`];
  }
  const problems: string[] = [];
  const categories = new Intl.PluralRules(locale.lang).resolvedOptions().pluralCategories;
  for (const [key, source] of Object.entries(english)) {
    const got = table[key];
    if (got === undefined) {
      problems.push(`${code}: missing "${key}"`);
    } else if (typeof source === 'string') {
      if (typeof got !== 'string' || !got.trim()) problems.push(`${code}: "${key}" should be a sentence`);
      else if (placeholders(got) !== placeholders(source)) problems.push(`${code}: "${key}" has different {placeholders}: "${got}"`);
    } else if (typeof got !== 'object') {
      problems.push(`${code}: "${key}" should give plural forms (${categories.join(', ')})`);
    } else {
      for (const c of categories) if (!got[c]?.trim()) problems.push(`${code}: "${key}" is missing the "${c}" form`);
      for (const [c, text] of Object.entries(got)) {
        if (!categories.includes(c as Intl.LDMLPluralRule)) problems.push(`${code}: "${key}" has a "${c}" form this language doesn't use`);
        // A form may leave {n} out ("a pint"), but must not invent placeholders.
        const allowed = new Set(Object.values(source).flatMap((s) => s.match(/\{\w+\}/g) ?? []));
        for (const p of text.match(/\{\w+\}/g) ?? []) if (!allowed.has(p)) problems.push(`${code}: "${key}" (${c}) has an unknown ${p}`);
      }
    }
  }
  for (const key of Object.keys(table)) if (!(key in english)) problems.push(`${code}: "${key}" is not in en.json any more`);
  return problems;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const english: Messages = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/en.json'), 'utf8'));
  const codes = process.argv.slice(2).length ? process.argv.slice(2) : LOCALES.filter((l) => l.path).map((l) => l.path);
  const problems = codes.flatMap((c) => checkLocale(c, english));
  for (const p of problems.slice(0, 60)) console.log(p);
  if (problems.length > 60) console.log(`…and ${problems.length - 60} more`);
  console.log(problems.length ? `${problems.length} problems` : `OK: ${codes.join(', ')}`);
  process.exit(problems.length ? 1 : 0);
}
