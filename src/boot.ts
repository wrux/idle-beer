/**
 * First thing to run. Works out which language this address is in, loads its translations,
 * makes sure the page's own text is in it, and only then starts the game, so nothing is ever
 * built in the wrong language.
 */
import { activate, localeFromPath, translatePage, type Messages } from './i18n';

const tables = import.meta.glob<{ default: Messages }>('./i18n/locales/*.json');

void (async () => {
  const locale = localeFromPath(location.pathname);
  if (locale.path) {
    let table: Messages = {};
    try {
      table = (await tables[`./i18n/locales/${locale.path}.json`]?.())?.default ?? {};
    } catch {
      // No translations to be had: the game still runs, in English, with this language's numbers.
    }
    // The game's content is generated in English (some of it with numbers in it) and translated
    // as finished sentences, so it has to be built before the language is switched on.
    await import('./i18n/data');
    activate(locale, table);
  }
  // A page built for this language already has its text in it (vite.config.ts), and says so in
  // `<html lang>`. Only a page that arrived in another language needs putting into this one.
  if (document.documentElement.lang !== locale.lang) {
    document.documentElement.lang = locale.lang;
    translatePage();
  }
  await import('./main');
})();
