/**
 * One page per language.
 *
 * English is the page at the root. Every other language is the same page at its own address
 * (/fr/, /de/, /jp/ …) with its own `<html lang>`, title, descriptions, sharing tags and page
 * text, so a search engine, a shared link or "view source" sees the right language without
 * running the game. The game itself reads the address and loads that language's text for
 * everything it draws (src/boot.ts).
 *
 * In development the dev server answers those addresses from index.html; a build writes a
 * dist/<language>/index.html for each, and a sitemap that lists them all as alternates.
 */
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { LOCALES, localeUrl, type Locale, type Messages } from './src/i18n/locales';
import { squash, translateMarkup } from './src/i18n/markup';

const SITE = 'https://idle.beer';

function messagesFor(locale: Locale): Messages {
  const file = path.resolve(__dirname, 'src/i18n/locales', `${locale.path}.json`);
  try {
    return locale.path ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  } catch {
    return {}; // Not translated yet: the page keeps its English tags.
  }
}

/** Every language's address, as the tags that tell a search engine they are the same page. */
const alternates = () => [
  ...LOCALES.map((l) => `    <link rel="alternate" hreflang="${l.lang}" href="${SITE}${localeUrl(l)}" />`),
  `    <link rel="alternate" hreflang="x-default" href="${SITE}/" />`,
].join('\n');

/** The English page, as that language's page. */
function localise(html: string, locale: Locale): string {
  const table = messagesFor(locale);
  const say = (english: string) => {
    const found = table[squash(english)];
    return typeof found === 'string' && found ? found : english;
  };
  // The page's own text first (everything marked data-i18n), then the tags in its head.
  if (locale.path) html = translateMarkup(html, say);
  const attr = (text: string) => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const url = `${SITE}${localeUrl(locale)}`;
  let out = html
    .replace(/<html lang="[^"]*"/, `<html lang="${locale.lang}"`)
    .replace(/<title>([^<]*)<\/title>/, (_all, t: string) => `<title>${attr(say(t))}</title>`)
    .replace(/<meta\b[^>]*>/g, (tag) => {
      if (/(?:name|property)="(?:description|og:title|og:description|og:image:alt|twitter:title|twitter:description|twitter:image:alt)"/.test(tag)) {
        return tag.replace(/content="([^"]*)"/, (_all, c: string) => `content="${attr(say(c))}"`);
      }
      if (/property="og:url"/.test(tag)) return tag.replace(/content="[^"]*"/, `content="${url}"`);
      if (/property="og:locale"/.test(tag)) return tag.replace(/content="[^"]*"/, `content="${locale.og}"`);
      return tag;
    })
    .replace(/<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${url}" />`)
    .replace(/(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/, (_all, open: string, json: string, close: string) => {
      // Every node's words go into the language; the page and the game point at this address.
      const data = JSON.parse(json);
      for (const node of data['@graph'] as Record<string, any>[]) {
        for (const field of ['description', 'name', 'caption']) {
          if (typeof node[field] === 'string') node[field] = say(node[field]);
        }
        const types = ([] as string[]).concat(node['@type']);
        if (types.includes('WebPage')) {
          node.url = url;
          node.inLanguage = locale.lang;
        }
        if (types.includes('VideoGame')) {
          node.url = url;
          node.offers.url = url;
        }
      }
      return `${open}\n${JSON.stringify(data, null, 2).replace(/^/gm, '      ')}\n    ${close}`;
    });
  if (!out.includes('hreflang=')) out = out.replace(/(\s*)<\/head>/, `\n${alternates()}$1</head>`);
  return out;
}

const localePath = (url: string | undefined): Locale | undefined => {
  const first = (url ?? '').split('?')[0].split('/')[1];
  return LOCALES.find((l) => l.path && l.path === first);
};

function languages(): Plugin {
  return {
    name: 'idle-beer-languages',
    configureServer(server) {
      // /fr and /fr/ are index.html; everything under them is the same files as at the root.
      server.middlewares.use((req, _res, next) => {
        const locale = localePath(req.url);
        if (locale) {
          const rest = req.url!.slice(locale.path.length + 1);
          req.url = rest === '' || rest.startsWith('?') || rest === '/' || rest.startsWith('/?') ? `/index.html${rest.replace(/^\//, '')}` : rest;
        }
        next();
      });
    },
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        return localise(html, localePath(ctx.originalUrl) ?? LOCALES[0]);
      },
    },
    writeBundle(options) {
      const dir = options.dir ?? path.resolve(__dirname, 'dist');
      const english = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
      for (const locale of LOCALES) {
        if (!locale.path) continue;
        fs.mkdirSync(path.join(dir, locale.path), { recursive: true });
        fs.writeFileSync(path.join(dir, locale.path, 'index.html'), localise(english, locale));
      }
      const links = LOCALES.map((l) => `    <xhtml:link rel="alternate" hreflang="${l.lang}" href="${SITE}${localeUrl(l)}" />`).join('\n');
      fs.writeFileSync(path.join(dir, 'sitemap.xml'), [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
        ...LOCALES.map((l) => `  <url>\n    <loc>${SITE}${localeUrl(l)}</loc>\n${links}\n    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE}/" />\n  </url>`),
        '</urlset>',
        '',
      ].join('\n'));
    },
  };
}

export default defineConfig({
  plugins: [languages()],
  test: {
    // Translators' scratch files and the like are not tests.
    include: ['tests/**/*.test.ts'],
  },
});
