/**
 * Languages.
 *
 * The game is written in English, and the English text is the key: `tr('Drink up')` looks that
 * sentence up in the active language and falls back to itself. So nothing needs a made-up key,
 * the source reads normally, and a missing translation shows English rather than a blank.
 * `tools/i18n-extract.ts` collects every such string into en.json for translating.
 *
 * English lives at the root of the site; every other language under its own path (/fr/, /jp/…).
 */
import { setNumberLocale } from '../core/format';

import { LOCALES, type Locale, type Messages } from './locales';
import { squash } from './markup';

export { LOCALES, localeUrl, type Locale, type Messages } from './locales';
export { squash } from './markup';

let messages: Messages = {};
let current: Locale = LOCALES[0];
let plurals = new Intl.PluralRules(current.lang);

/** Which language a URL is in. Anything that isn't a language's path is English. */
export function localeFromPath(pathname: string): Locale {
  const first = pathname.split('/')[1] ?? '';
  return LOCALES.find((l) => l.path !== '' && l.path === first) ?? LOCALES[0];
}

/** The language to offer a visitor, from their browser's list: the first one the game has, if any. */
export function preferredLocale(languages: readonly string[]): Locale | null {
  for (const tag of languages) {
    const lower = tag.toLowerCase();
    const base = lower.split('-')[0];
    const hit = LOCALES.find((l) => l.lang.toLowerCase() === lower)
      ?? LOCALES.find((l) => l.lang.toLowerCase().split('-')[0] === base)
      // Norwegian arrives as "no", "nb" or "nn"; they all get the one Norwegian we have.
      ?? (base === 'no' || base === 'nn' ? LOCALES.find((l) => l.lang === 'nb') : undefined);
    if (hit) return hit;
  }
  return null;
}

export function activate(locale: Locale, table: Messages = {}): void {
  current = locale;
  messages = table;
  plurals = new Intl.PluralRules(locale.lang);
  setNumberLocale(locale.lang);
}

export const currentLocale = (): Locale => current;

const fill = (text: string, params?: Record<string, string | number>): string =>
  params ? text.replace(/\{(\w+)\}/g, (whole, key: string) => (key in params ? String(params[key]) : whole)) : text;

/** Translate a sentence. `{name}` placeholders are filled from `params`. */
export function tr(english: string, params?: Record<string, string | number>): string {
  const found = messages[english];
  return fill(typeof found === 'string' && found ? found : english, params);
}

/**
 * Translate something that depends on a count: `trn(n, '{n} pint', '{n} pints')`.
 * Languages with more plural forms than English supply one for each of theirs. `{n}` is filled
 * with `shown` if given (a formatted number), else with `n`.
 */
export function trn(n: number, one: string, other: string, params?: Record<string, string | number>): string {
  const forms = messages[`${one} ||| ${other}`];
  const all = { n, ...params };
  if (forms && typeof forms === 'object') {
    // A count too big to be a whole number any more takes the form used after "million" and the like.
    const category = Math.abs(n) >= 1e6 ? (forms.many ? 'many' : 'other') : plurals.select(n);
    return fill(forms[category] ?? forms.other ?? other, all);
  }
  return fill(n === 1 ? one : other, all);
}

/**
 * Put the page's own text (index.html) into the active language. A built page arrives already
 * translated (vite.config.ts), so this is for a page that arrives in English. An element marked
 * `data-i18n` has its text translated; `data-i18n="html"` its markup; and `data-i18n-attr`
 * lists attributes to translate ("aria-label title").
 */
export function translatePage(root: ParentNode = document): void {
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n]')) {
    if (el.dataset.i18n === 'html') el.innerHTML = tr(squash(el.innerHTML));
    else el.textContent = tr(squash(el.textContent ?? ''));
  }
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n-attr]')) {
    for (const attr of (el.dataset.i18nAttr ?? '').split(/\s+/).filter(Boolean)) {
      const value = el.getAttribute(attr);
      if (value) el.setAttribute(attr, tr(squash(value)));
    }
  }
}
