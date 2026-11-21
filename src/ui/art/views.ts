/** What you can see through the pub window at each location. Drawn into the 76×76 pane at (40, 30). */
import type { WindowView } from '../../data/locations';

const X = 40, Y = 30, W = 76, H = 76;
const sky = (c: string) => `<rect x="${X}" y="${Y}" width="${W}" height="${H}" fill="${c}"/>`;
const stars = (pts: [number, number][], c = '#f4e9c1') =>
  pts.map(([x, y]) => `<circle cx="${X + x}" cy="${Y + y}" r="1" fill="${c}"/>`).join('');

export function windowView(view: WindowView): string {
  switch (view) {
    case 'night':
      return sky('#1f2c4d') + `<circle cx="96" cy="50" r="9" fill="#f4e9c1"/>` + stars([[16, 14], [30, 50], [60, 64]]);
    case 'garden':
      return sky('#8fd0f2') +
        `<circle cx="102" cy="44" r="8" fill="#ffe27a"/>` +
        `<rect x="${X}" y="88" width="${W}" height="18" fill="#5fae4a"/>` +
        `<rect x="60" y="62" width="4" height="28" fill="#6b4a2a"/><circle cx="62" cy="58" r="13" fill="#3f8f3a"/>` +
        `<path d="M84,74 L104,74 L94,66 Z" fill="#d94f4f"/><rect x="93" y="74" width="2" height="16" fill="#ddd"/>`;
    case 'street':
      return sky('#f2b880') +
        `<rect x="${X}" y="58" width="22" height="48" fill="#8a4b3a"/><rect x="62" y="50" width="22" height="56" fill="#b98a5a"/>` +
        `<rect x="84" y="62" width="32" height="44" fill="#6a7a8a"/>` +
        `<rect x="44" y="66" width="6" height="8" fill="#ffe7a8"/><rect x="66" y="58" width="6" height="8" fill="#ffe7a8"/>` +
        `<rect x="92" y="70" width="6" height="8" fill="#ffe7a8"/><rect x="${X}" y="98" width="${W}" height="8" fill="#555"/>`;
    case 'city':
      return sky('#14203a') +
        `<rect x="${X}" y="60" width="14" height="46" fill="#26324d"/><rect x="56" y="44" width="16" height="62" fill="#2e3b5c"/>` +
        `<rect x="74" y="54" width="12" height="52" fill="#22304a"/><rect x="88" y="38" width="18" height="68" fill="#2b3856"/>` +
        `<rect x="106" y="64" width="10" height="42" fill="#26324d"/>` +
        [[59, 50], [65, 58], [91, 44], [99, 52], [91, 62], [77, 60], [43, 66], [99, 72]]
          .map(([x, y]) => `<rect x="${x}" y="${y}" width="3" height="3" fill="#ffd97a"/>`).join('');
    case 'festival':
      return sky('#2a1b4a') +
        `<path d="M${X},106 L${X},96 L116,96 L116,106 Z" fill="#3f6b3a"/>` +
        `<path d="M48,96 L58,80 L68,96 Z" fill="#e84393"/><path d="M70,96 L80,78 L90,96 Z" fill="#f2c94c"/>` +
        `<path d="M92,96 L100,84 L108,96 Z" fill="#3b7dd8"/>` +
        `<path d="M62,30 L54,70 M94,30 L102,70" stroke="#c77dff" stroke-width="3" opacity="0.6"/>` +
        stars([[10, 10], [40, 6], [66, 14]], '#ffffff');
    case 'town':
      return sky('#f0a36b') +
        [[0, 70, 18], [18, 64, 16], [34, 72, 14], [48, 60, 16], [64, 68, 12]]
          .map(([x, y, w]) =>
            `<rect x="${X + x}" y="${y}" width="${w}" height="${106 - y}" fill="#7a4a3a"/>` +
            `<polygon points="${X + x - 2},${y} ${X + x + w / 2},${y - 9} ${X + x + w + 2},${y}" fill="#5a2f25"/>`).join('') +
        `<rect x="58" y="44" width="5" height="18" fill="#6a6a6a"/><polygon points="55,44 60.5,34 66,44" fill="#6a6a6a"/>`;
    case 'britain':
      return sky('#9fcde8') +
        `<path d="M${X},106 L${X},84 Q60,76 78,84 Q96,72 116,82 L116,106 Z" fill="#5f9e4f"/>` +
        `<path d="M${X},106 L${X},96 Q72,90 116,98 L116,106 Z" fill="#3f7fbf"/>` +
        `<path d="M96,80 L104,80 L104,96 L96,96 Z" fill="#f4f4f4"/>` +
        `<circle cx="56" cy="46" r="5" fill="#fff"/><circle cx="62" cy="44" r="6" fill="#fff"/><circle cx="68" cy="47" r="4" fill="#fff"/>`;
    case 'earth':
      return sky('#05070f') + stars([[8, 10], [66, 12], [12, 60], [70, 70], [40, 6]], '#ffffff') +
        `<circle cx="78" cy="70" r="26" fill="#2f6fd6"/>` +
        `<path d="M64,56 Q72,50 78,58 Q74,66 66,64 Z M84,72 Q94,68 98,78 Q90,86 84,80 Z" fill="#3f9e4f"/>` +
        `<circle cx="78" cy="70" r="26" fill="none" stroke="#9fd3ff" stroke-width="2" opacity="0.5"/>`;
    case 'moon':
      return sky('#05070f') + stars([[10, 10], [30, 24], [66, 8]], '#ffffff') +
        `<circle cx="96" cy="46" r="9" fill="#2f6fd6"/><path d="M92,42 Q96,40 98,46 Q94,48 92,42 Z" fill="#3f9e4f"/>` +
        `<path d="M${X},106 L${X},88 Q66,82 86,88 Q100,92 116,86 L116,106 Z" fill="#a9acb5"/>` +
        `<ellipse cx="58" cy="96" rx="7" ry="2.5" fill="#8a8d96"/><ellipse cx="96" cy="99" rx="5" ry="2" fill="#8a8d96"/>`;
    case 'solar':
      return sky('#0a0614') + `<circle cx="${X}" cy="68" r="22" fill="#ffb347"/>` +
        `<circle cx="74" cy="60" r="3" fill="#c9a27a"/><circle cx="88" cy="78" r="4" fill="#2f6fd6"/>` +
        `<circle cx="104" cy="52" r="6" fill="#d9a066"/><ellipse cx="104" cy="52" rx="10" ry="2.5" fill="none" stroke="#e8d3a8" stroke-width="1.2"/>` +
        stars([[50, 8], [70, 64], [20, 6]], '#ffffff');
    case 'galaxy':
      return sky('#07051a') +
        `<ellipse cx="78" cy="68" rx="30" ry="12" fill="#5b3fbf" opacity="0.5" transform="rotate(-20 78 68)"/>` +
        `<ellipse cx="78" cy="68" rx="18" ry="6" fill="#c7a8ff" opacity="0.6" transform="rotate(-20 78 68)"/>` +
        `<circle cx="78" cy="68" r="4" fill="#fff6d8"/>` + stars([[6, 8], [70, 10], [14, 66], [60, 70], [36, 16]], '#ffffff');
    case 'multiverse':
      return sky('#12051f') +
        [['#ff5c8a', 58, 52, 12], ['#5cd6ff', 92, 48, 10], ['#ffe15c', 70, 82, 14], ['#8cff9e', 104, 84, 8], ['#c77dff', 50, 92, 6]]
          .map(([c, x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" opacity="0.55"/>` +
            `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${c}" stroke-width="1"/>`).join('');
    default:
      return sky('#1f2c4d');
  }
}
