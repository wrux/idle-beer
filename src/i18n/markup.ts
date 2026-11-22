/**
 * The page's own text (index.html), found in its source rather than in a live document.
 *
 * The build uses this to write each language's page already in that language, and the extractor
 * uses it to collect the English, so both always agree on what the page's text is. The browser
 * does the same job on a live document with translatePage() (./index.ts).
 *
 * An element marked `data-i18n` has its text translated; `data-i18n="html"` its markup; and
 * `data-i18n-attr` lists attributes to translate ("aria-label title").
 */

/** Text as written in the HTML source wraps and indents; the key is the sentence on one line. */
export const squash = (text: string): string => text.replace(/\s+/g, ' ').trim();

const text = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const attribute = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/**
 * `html` with every marked sentence passed through `say` (English in, translation out).
 * A marked element must not contain another element of its own kind (a span in a span).
 */
export function translateMarkup(html: string, say: (english: string) => string): string {
  return html
    .replace(/(<(\w+)\b[^<>]*\sdata-i18n(="html")?(?=[\s>])[^<>]*>)([\s\S]*?)(<\/\2>)/g,
      (_all, open: string, _tag: string, asHtml: string | undefined, inner: string, close: string) => {
        const english = squash(inner);
        if (!english) return open + inner + close;
        const said = say(english);
        // Untranslated text stays exactly as written; a translation is plain text unless marked as markup.
        return open + (said === english ? inner : asHtml ? said : text(said)) + close;
      })
    .replace(/<\w+\b[^<>]*\sdata-i18n-attr="([^"]*)"[^<>]*>/g, (tag, names: string) => {
      let out = tag;
      for (const name of names.split(/\s+/).filter(Boolean)) {
        out = out.replace(new RegExp(`(\\s${name}=")([^"]*)(")`), (all, before: string, value: string, after: string) => {
          const english = squash(value);
          if (!english) return all;
          const said = say(english);
          return said === english ? all : before + attribute(said) + after;
        });
      }
      return out;
    });
}
