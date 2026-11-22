import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { format } from '../src/core/format';
import { D } from '../src/core/num';
import { LOCALES, activate, localeFromPath, localeUrl, preferredLocale, tr, trn, type Messages } from '../src/i18n';
import { checkLocale } from '../tools/i18n-check';
import { extract } from '../tools/i18n-extract';

const english: Messages = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../src/i18n/en.json'), 'utf8'));
afterEach(() => activate(LOCALES[0]));

describe('languages', () => {
  it('en.json lists exactly the text the game has now (run `npm run i18n` after changing any)', () => {
    expect(extract()).toEqual(english);
  });

  it('every language has a complete, well-formed translation', () => {
    const problems = LOCALES.filter((l) => l.path).flatMap((l) => checkLocale(l.path, english));
    expect(problems.slice(0, 20)).toEqual([]);
  });

  it('an address says which language it is in', () => {
    expect(localeFromPath('/').path).toBe('');
    expect(localeFromPath('/fr/').lang).toBe('fr');
    expect(localeFromPath('/jp').lang).toBe('ja');
    expect(localeFromPath('/no/').lang).toBe('nb');
    expect(localeFromPath('/banner.html').path).toBe('');
    expect(localeUrl(localeFromPath('/zh/'))).toBe('/zh/');
  });

  it("offers a visitor their browser's language when the game has it", () => {
    expect(preferredLocale(['de-AT', 'en'])?.path).toBe('de');
    expect(preferredLocale(['ja'])?.path).toBe('jp');
    expect(preferredLocale(['nn-NO'])?.path).toBe('no');
    expect(preferredLocale(['zh-TW'])?.path).toBe('zh');
    expect(preferredLocale(['fi', 'en-US'])?.path).toBe('');
    expect(preferredLocale(['fi'])).toBeNull();
  });

  it('falls back to English, fills placeholders and picks plural forms', () => {
    expect(tr('Welcome to {pub}', { pub: 'The Red Lion' })).toBe('Welcome to The Red Lion');
    expect(trn(1, '{n} pint', '{n} pints')).toBe('1 pint');
    expect(trn(3, '{n} pint', '{n} pints')).toBe('3 pints');
    activate(LOCALES.find((l) => l.path === 'ru')!, {
      'Drink up': 'Допивай',
      '{n} pint ||| {n} pints': { one: '{n} пинта', few: '{n} пинты', many: '{n} пинт', other: '{n} пинты' },
    });
    expect(tr('Drink up')).toBe('Допивай');
    expect(tr('Not translated')).toBe('Not translated');
    expect(trn(1, '{n} pint', '{n} pints')).toBe('1 пинта');
    expect(trn(3, '{n} pint', '{n} pints')).toBe('3 пинты');
    expect(trn(5, '{n} pint', '{n} pints')).toBe('5 пинт');
    // Past a million the count is shown with a number word, which takes the "many" form.
    expect(trn(1e6, '{n} pint', '{n} pints', { n: '1,5 миллиона' })).toBe('1,5 миллиона пинт');
  });

  it('numbers follow the language', () => {
    expect(format(D(1234567))).toBe('1.235 million');
    activate(LOCALES.find((l) => l.path === 'de')!);
    expect(format(D(1234))).toBe('1.234');
    expect(format(D(12.5))).toBe('12,5');
    expect(format(D(1234567))).toBe('1,235 Millionen');
    expect(format(D(2e9), 'short', true)).toBe('2 Milliarden');
    // Past what the language has words for: scientific, with its own decimal mark.
    expect(format(D('1.5e40'))).toBe('1,50e40');
    expect(format(D(1234567), 'scientific')).toBe('1,23e6');
    activate(LOCALES.find((l) => l.path === 'jp')!);
    expect(format(D(1234567))).toBe('123.457万');
  });
});
