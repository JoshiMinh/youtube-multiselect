import { svg } from './dom.js';

const paths = {
  help: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z',
  info: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z',
  'select-all': 'M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41L6 19l1.41-1.41L1.83 12 .41 13.41z',
  'unselect-all': 'M1.79 12l5.58 5.59L5.96 19 .37 13.41 1.79 12zm.45-7.78L12.9 14.89l-1.28 1.28L7.44 12l-1.41 1.41L11.62 19l2.69-2.69 4.89 4.89 1.41-1.41L3.65 2.81 2.24 4.22zm14.9 9.27L23.62 7 22.2 5.59l-6.48 6.48 1.42 1.42zM17.96 7l-1.41-1.41-3.65 3.66 1.41 1.41L17.96 7z',
  'flip-list': 'M7 3v3h10v2H7v3L3 7l4-4zm10 8v3H7v2h10v3l4-4-4-4z',
};

export function iconSet(prefix) {
  return svg('svg', {}, svg('defs', {},
    Object.entries(paths).map(([name, d]) => svg('g', { id: `${prefix}-${name}` }, svg('path', { d }))),
    svg('g', { id: `${prefix}-shorts` },
      svg('rect', { x: 4, y: 3, width: 16, height: 18, rx: 4, fill: 'none', stroke: 'currentColor', 'stroke-width': 2 }),
      svg('path', { d: 'm10 7 6 5-6 5V7z' })),
    svg('g', { id: `${prefix}-video` },
      svg('rect', { x: 3, y: 5, width: 18, height: 14, rx: 2, fill: 'none', stroke: 'currentColor', 'stroke-width': 2 }),
      svg('path', { d: 'm10 8 6 4-6 4V8z' }))));
}
