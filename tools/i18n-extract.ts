/**
 * Collects every sentence the game can show into src/i18n/en.json, which is what gets translated.
 * Run it after changing any text: `npm run i18n`.
 *
 * It looks in four places: the game's data (names, descriptions, jokes), calls to tr() and trn()
 * in the source, text marked data-i18n in index.html, and the page's title and descriptions.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dataSlots } from '../src/i18n/data';
import { squash, translateMarkup } from '../src/i18n/markup';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const unescape = (text: string) => text.replace(/\\(['"\\])/g, '$1').replace(/\\n/g, '\n');
const STRING = `'((?:[^'\\\\]|\\\\.)*)'|"((?:[^"\\\\]|\\\\.)*)"`;

/** The page's title and descriptions: what a search engine or a shared link shows. */
export function metaStrings(html: string): string[] {
  const out: string[] = [];
  const title = /<title>([^<]*)<\/title>/.exec(html);
  if (title) out.push(squash(title[1]));
  const wanted = /(?:name|property)="(description|og:title|og:description|og:image:alt|twitter:title|twitter:description|twitter:image:alt)"/;
  for (const tag of html.match(/<meta\b[^>]*>/g) ?? []) {
    const content = /content="([^"]*)"/.exec(tag);
    if (wanted.test(tag) && content) out.push(squash(content[1]));
  }
  const ld = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html);
  if (ld) {
    for (const node of JSON.parse(ld[1])['@graph'] as Record<string, unknown>[]) {
      for (const field of ['description', 'caption']) if (typeof node[field] === 'string') out.push(squash(node[field] as string));
    }
  }
  return out;
}

export function extract(): Record<string, string | Record<string, string>> {
  const strings = new Set<string>();
  const plurals = new Map<string, [string, string]>();

  for (const [item, field] of dataSlots()) strings.add(item[field] as string);

  const walk = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith('.ts') ? [path.join(dir, e.name)] : []);
  for (const file of walk(path.join(root, 'src'))) {
    if (file.includes(`${path.sep}dev${path.sep}`)) continue;
    const src = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(new RegExp(`\\btr\\(\\s*(?:${STRING})`, 'g'))) strings.add(unescape(m[1] ?? m[2]));
    for (const m of src.matchAll(new RegExp(`\\btrn\\(\\s*[^,]+,\\s*(?:${STRING})\\s*,\\s*(?:${STRING})`, 'g'))) {
      const one = unescape(m[1] ?? m[2]), other = unescape(m[3] ?? m[4]);
      plurals.set(`${one} ||| ${other}`, [one, other]);
    }
  }

  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  translateMarkup(html, (english) => (strings.add(english), english));
  for (const s of metaStrings(html)) strings.add(s);

  const out: Record<string, string | Record<string, string>> = {};
  for (const s of [...strings].filter(Boolean).sort((a, b) => a.localeCompare(b, 'en'))) out[s] = s;
  for (const [key, [one, other]] of [...plurals].sort(([a], [b]) => a.localeCompare(b, 'en'))) out[key] = { one, other };
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const table = extract();
  fs.writeFileSync(path.join(root, 'src/i18n/en.json'), `${JSON.stringify(table, null, 2)}\n`);
  console.log(`${Object.keys(table).length} strings written to src/i18n/en.json`);
}
