/**
 * The crowd behind the bar: one little character per drinker type, built from a shared
 * body plus a hat, face and shirt pattern. Local coords: feet at (0, 0), head at (0, -62).
 */
import type { Drinker } from '../../data/drinkers';

type Hat = 'flatcap' | 'mortarboard' | 'antlers' | 'scrumcap' | 'bobble' | 'bucket' | 'hanky' | 'crown'
  | 'party' | 'helmet' | 'antennae' | 'none';
type Face = 'plain' | 'glasses' | 'shades' | 'beard' | 'cyclops';
type Pattern = 'none' | 'flames' | 'hoops' | 'scarf' | 'tie' | 'bunting' | 'lanyard';

interface Look {
  shirt: string;
  skin: string;
  hat: Hat;
  hatColour?: string;
  face?: Face;
  pattern?: Pattern;
  glow?: string;
  rainbow?: boolean;
}

const SKIN = '#f0c39d';

const LOOKS: Record<string, Look> = {
  regular: { shirt: '#6b6f78', skin: SKIN, hat: 'flatcap', hatColour: '#5d4a3a', face: 'glasses' },
  student: { shirt: '#5b3f8c', skin: '#e8b48f', hat: 'mortarboard', hatColour: '#1d1d24' },
  darts: { shirt: '#1f1f2a', skin: SKIN, hat: 'none', pattern: 'flames' },
  stag: { shirt: '#ff79b0', skin: '#f3c9a6', hat: 'antlers', hatColour: '#8a5a2b' },
  rugby: { shirt: '#1f7a3a', skin: '#d9a07a', hat: 'scrumcap', hatColour: '#1b2a4a', pattern: 'hoops' },
  supporters: { shirt: '#1f4fa8', skin: SKIN, hat: 'bobble', hatColour: '#c0392b', pattern: 'scarf' },
  wmc: { shirt: '#7a5232', skin: '#eab896', hat: 'flatcap', hatColour: '#3e3a35', face: 'glasses' },
  beerfest: { shirt: '#2f2f2f', skin: SKIN, hat: 'none', face: 'beard' },
  musicfest: { shirt: '#f2c94c', skin: '#c98a62', hat: 'bucket', hatColour: '#3b7dd8', face: 'shades', pattern: 'lanyard' },
  chain: { shirt: '#2b3a55', skin: SKIN, hat: 'none', pattern: 'tie' },
  bankhol: { shirt: '#f4f4f4', skin: '#f08f7a', hat: 'hanky', hatColour: '#ffffff', face: 'shades' },
  streetparty: { shirt: '#c0392b', skin: '#e8b48f', hat: 'crown', hatColour: '#f2c94c', pattern: 'bunting' },
  toast: { shirt: '#16a085', skin: '#a86b4a', hat: 'party', hatColour: '#e84393' },
  lunar: { shirt: '#e8edf2', skin: SKIN, hat: 'helmet' },
  crawl: { shirt: '#6c3fa0', skin: '#7bd36f', hat: 'antennae', hatColour: '#7bd36f' },
  galactic: { shirt: '#1d1b4f', skin: '#a58cff', hat: 'antennae', hatColour: '#a58cff', face: 'cyclops' },
  blackhole: { shirt: '#0d0b14', skin: '#1a1626', hat: 'none', glow: '#9b6bff' },
  multiverse: { shirt: '#3b82f6', skin: SKIN, hat: 'party', hatColour: '#f59e0b', rainbow: true },
};

function hat(h: Hat, c = '#333'): string {
  switch (h) {
    case 'flatcap':
      return `<path d="M-13,-66 Q-12,-79 0,-79 Q12,-79 14,-69 L23,-66 Q17,-61 12,-64 L-13,-63 Z" fill="${c}"/>`;
    case 'mortarboard':
      return `<rect x="-9" y="-79" width="18" height="7" fill="${c}"/>` +
        `<polygon points="-17,-79 0,-85 17,-79 0,-74" fill="${c}"/>` +
        `<path d="M0,-80 L12,-78 L12,-68" stroke="#f2c94c" stroke-width="1.5" fill="none"/>`;
    case 'antlers':
      return `<path d="M-6,-72 L-10,-86 M-10,-86 L-15,-90 M-10,-86 L-8,-92 M6,-72 L10,-86 M10,-86 L15,-90 M10,-86 L8,-92"
        stroke="${c}" stroke-width="2.5" stroke-linecap="round" fill="none"/>`;
    case 'scrumcap':
      return `<path d="M-13,-60 A13,13 0 0 1 13,-60 Z" fill="${c}"/>` +
        `<path d="M-12,-60 L-12,-52 M12,-60 L12,-52" stroke="${c}" stroke-width="3"/>`;
    case 'bobble':
      return `<path d="M-12,-64 A12,12 0 0 1 12,-64 Z" fill="${c}"/><rect x="-12" y="-66" width="24" height="4" fill="#fff"/>` +
        `<circle cx="0" cy="-77" r="4" fill="#fff"/>`;
    case 'bucket':
      return `<ellipse cx="0" cy="-68" rx="17" ry="4" fill="${c}"/><rect x="-10" y="-79" width="20" height="11" rx="4" fill="${c}"/>`;
    case 'hanky':
      return `<path d="M-12,-64 A12,12 0 0 1 12,-64 Z" fill="${c}"/>` +
        `<circle cx="-12" cy="-64" r="2.5" fill="${c}"/><circle cx="12" cy="-64" r="2.5" fill="${c}"/>`;
    case 'crown':
      return `<polygon points="-11,-70 -11,-80 -6,-75 0,-82 6,-75 11,-80 11,-70" fill="${c}"/>`;
    case 'party':
      return `<polygon points="-8,-72 8,-72 0,-92" fill="${c}"/><circle cx="0" cy="-92" r="3" fill="#fff"/>`;
    case 'antennae':
      return `<path d="M-5,-72 L-9,-86 M5,-72 L9,-86" stroke="${c}" stroke-width="2"/>` +
        `<circle cx="-9" cy="-87" r="3" fill="${c}"/><circle cx="9" cy="-87" r="3" fill="${c}"/>`;
    case 'helmet':
      return `<circle cx="0" cy="-62" r="17" fill="#bfe3ff" opacity="0.35" stroke="#ffffff" stroke-width="2.5"/>` +
        `<path d="M-9,-72 Q0,-77 9,-72" stroke="#fff" stroke-width="2" fill="none" opacity="0.8"/>`;
    default:
      return '';
  }
}

function face(f: Face = 'plain'): string {
  const eyes = `<circle cx="-4" cy="-63" r="1.6" fill="#2b1d14"/><circle cx="4" cy="-63" r="1.6" fill="#2b1d14"/>`;
  const mouth = `<path d="M-4,-56 Q0,-53 4,-56" stroke="#2b1d14" stroke-width="1.5" fill="none"/>`;
  switch (f) {
    case 'glasses':
      return `<circle cx="-4" cy="-63" r="3.5" fill="none" stroke="#2b1d14" stroke-width="1.2"/>` +
        `<circle cx="4" cy="-63" r="3.5" fill="none" stroke="#2b1d14" stroke-width="1.2"/>` + eyes + mouth;
    case 'shades':
      return `<rect x="-9" y="-66" width="18" height="5" rx="2" fill="#111"/>` + mouth;
    case 'beard':
      return eyes + `<path d="M-11,-60 Q-11,-44 0,-44 Q11,-44 11,-60 Q6,-55 0,-55 Q-6,-55 -11,-60 Z" fill="#8a7a6a"/>`;
    case 'cyclops':
      return `<circle cx="0" cy="-64" r="5" fill="#fff"/><circle cx="0" cy="-64" r="2.5" fill="#111"/>` + mouth;
    default:
      return eyes + mouth;
  }
}

function pattern(p: Pattern = 'none'): string {
  switch (p) {
    case 'flames':
      return `<path d="M-14,-16 L-10,-30 L-6,-20 L-2,-34 L2,-20 L6,-30 L10,-18 L14,-28 L14,-8 L-14,-8 Z" fill="#ff7a1a"/>`;
    case 'hoops':
      return [-44, -34, -24, -14].map((y) => `<rect x="-14" y="${y}" width="28" height="4" fill="#ffffff" opacity="0.9"/>`).join('');
    case 'scarf':
      return `<rect x="-11" y="-50" width="22" height="6" rx="2" fill="#c0392b"/>` +
        `<rect x="4" y="-46" width="6" height="18" fill="#c0392b"/><rect x="4" y="-38" width="6" height="3" fill="#fff"/>`;
    case 'tie':
      return `<polygon points="-3,-48 3,-48 2,-26 0,-22 -2,-26" fill="#c0392b"/>`;
    case 'bunting':
      return [-12, -4, 4].map((x, i) =>
        `<polygon points="${x},-44 ${x + 8},-44 ${x + 4},-37" fill="${['#2f6fd6', '#ffffff', '#f2c94c'][i]}"/>`).join('');
    case 'lanyard':
      return `<path d="M-6,-50 L0,-36 L6,-50" stroke="#e84393" stroke-width="1.5" fill="none"/><rect x="-4" y="-37" width="8" height="10" fill="#fff"/>`;
    default:
      return '';
  }
}

function body(l: Look): string {
  return `
    <rect x="-14" y="-50" width="28" height="52" rx="9" fill="${l.shirt}"/>
    ${pattern(l.pattern)}
    <rect x="-4" y="-53" width="8" height="5" fill="${l.skin}"/>
    <circle cx="0" cy="-62" r="12" fill="${l.skin}"/>
    ${face(l.face)}
    ${hat(l.hat, l.hatColour)}
    <g class="c-arm">
      <path d="M10,-44 L18,-30" stroke="${l.shirt}" stroke-width="6" stroke-linecap="round"/>
      <rect x="15" y="-40" width="9" height="13" rx="1.5" fill="#e6a53a" stroke="#f4fbff" stroke-width="1.2"/>
      <rect x="15" y="-40" width="9" height="3" fill="#fbf6e9"/>
      <circle cx="18" cy="-30" r="3" fill="${l.skin}"/>
    </g>`;
}

/** SVG markup for one drinker's character. */
export function figureMarkup(d: Drinker): string {
  const l = LOOKS[d.id] ?? LOOKS.regular;
  if (l.rainbow) {
    // A few slightly offset versions of itself from other universes.
    return ['#ff5c8a', '#5cd6ff', '#ffe15c'].map((shirt, i) =>
      `<g transform="translate(${(i - 1) * 4} 0)" opacity="${i === 1 ? 1 : 0.45}">${body({ ...l, shirt })}</g>`).join('');
  }
  const glow = l.glow ? ` style="filter: drop-shadow(0 0 3px ${l.glow})"` : '';
  return `<g${glow}>${body(l)}</g>`;
}
