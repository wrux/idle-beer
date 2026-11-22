/** The languages the game comes in. Plain data, so the build can read it too. */
export interface Locale {
  /** First segment of the URL ('' for English at the root). */
  path: string;
  /** BCP 47 tag, for `<html lang>`, Intl and hreflang. */
  lang: string;
  /** Its own name for itself, for the language picker. */
  name: string;
  /** Open Graph locale. */
  og: string;
}

export const LOCALES: Locale[] = [
  { path: '', lang: 'en-GB', name: 'English', og: 'en_GB' },
  { path: 'fr', lang: 'fr', name: 'Français', og: 'fr_FR' },
  { path: 'de', lang: 'de', name: 'Deutsch', og: 'de_DE' },
  { path: 'nl', lang: 'nl', name: 'Nederlands', og: 'nl_NL' },
  { path: 'cs', lang: 'cs', name: 'Čeština', og: 'cs_CZ' },
  { path: 'pl', lang: 'pl', name: 'Polski', og: 'pl_PL' },
  { path: 'it', lang: 'it', name: 'Italiano', og: 'it_IT' },
  { path: 'es', lang: 'es', name: 'Español', og: 'es_ES' },
  { path: 'pt', lang: 'pt', name: 'Português', og: 'pt_BR' },
  { path: 'jp', lang: 'ja', name: '日本語', og: 'ja_JP' },
  { path: 'zh', lang: 'zh-Hans', name: '中文', og: 'zh_CN' },
  { path: 'ko', lang: 'ko', name: '한국어', og: 'ko_KR' },
  { path: 'ru', lang: 'ru', name: 'Русский', og: 'ru_RU' },
  { path: 'da', lang: 'da', name: 'Dansk', og: 'da_DK' },
  { path: 'no', lang: 'nb', name: 'Norsk', og: 'nb_NO' },
  { path: 'sv', lang: 'sv', name: 'Svenska', og: 'sv_SE' },
];

/** A translation file: English → translation, or for plurals, English "one ||| other" → forms by plural category. */
export type Messages = Record<string, string | Record<string, string>>;

/** The address of the game in a language. */
export const localeUrl = (locale: Locale): string => (locale.path ? `/${locale.path}/` : '/');
