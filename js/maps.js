// Map format: { w, h, rows: string[h] of length w, spawn:[x,y] }
// Tile chars: '.' floor  '#' wall  'T' tree/prop (solid)  '~' water (solid)
//             'R' rug (walkable)  'S' shared screen (solid, media plays here)
export const TILES = [
  { ch: '.', label: 'Sàn', solid: false },
  { ch: '#', label: 'Tường', solid: true },
  { ch: 'T', label: 'Cây/Prop', solid: true },
  { ch: '~', label: 'Nước', solid: true },
  { ch: 'R', label: 'Thảm', solid: false },
  { ch: 'S', label: 'Màn hình', solid: true },
];
const SOLID = new Set(TILES.filter(t => t.solid).map(t => t.ch));
export const isSolid = ch => SOLID.has(ch);

export function blankMap(w = 28, h = 18) {
  const rows = [];
  for (let y = 0; y < h; y++) {
    let r = '';
    for (let x = 0; x < w; x++) r += (x === 0 || y === 0 || x === w - 1 || y === h - 1) ? '#' : '.';
    rows.push(r);
  }
  return { w, h, rows, spawn: [Math.floor(w / 2), Math.floor(h / 2)] };
}

export function defaultMap() {
  const m = blankMap(28, 18);
  const set = (x, y, c) => { m.rows[y] = m.rows[y].slice(0, x) + c + m.rows[y].slice(x + 1); };
  for (let x = 10; x < 18; x++) { set(x, 2, 'S'); }
  for (let x = 9; x < 19; x++) for (let y = 4; y < 7; y++) set(x, y, 'R');
  for (const [x, y] of [[3, 3], [4, 4], [24, 3], [23, 4], [3, 14], [4, 13], [24, 14], [23, 13]]) set(x, y, 'T');
  for (let x = 12; x < 16; x++) for (let y = 11; y < 14; y++) set(x, y, '~');
  m.spawn = [14, 8];
  return m;
}

export function validMap(m) {
  return m && Number.isInteger(m.w) && Number.isInteger(m.h) && m.w >= 8 && m.h >= 8 && m.w <= 80 && m.h <= 80 &&
    Array.isArray(m.rows) && m.rows.length === m.h && m.rows.every(r => typeof r === 'string' && r.length === m.w);
}
