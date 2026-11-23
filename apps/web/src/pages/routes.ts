import { mountComparator } from '../modules/comparator';
import { mountDanfse } from '../modules/danfse';
import { mountDashboard } from '../modules/dashboard';
import { mountHistory } from '../modules/history';
import { mountPlayground } from '../modules/playground';
import { mountRegular } from '../modules/regular';
import { mountSimples } from '../modules/simples';

export type Mount = (root: HTMLElement, query: URLSearchParams) => () => void;

export interface Route {
  path: string;
  title: string;
  nav: string;
  group: 'engines' | 'tools' | 'home';
  /** Inline SVG (24x24, stroke) used by the sidebar. */
  icon: string;
  /** The page fills the viewport and its panes scroll on their own. */
  fill?: boolean;
  mount: Mount;
}

const svg = (body: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const ICONS = {
  home: svg('<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>'),
  calc: svg('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h2M12 12h2M16 12h0M8 16h2M12 16h2M16 16h0"/>'),
  coin: svg('<circle cx="12" cy="12" r="8"/><path d="M12 7.5v9M9.5 10c0-1 1-1.5 2.5-1.5s2.500.5 2.500 1.500-1 1.300-2.500 1.500-2.500.6-2.500 1.600 1 1.400 2.500 1.400 2.500-.5 2.500-1.400"/>'),
  doc: svg('<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M9.5 13h5M9.5 17h5"/>'),
  plug: svg('<path d="m8 8 3-3 8 8-3 3zM5 19l4-4M12 12l-2-2"/>'),
  compare: svg('<path d="M8 4v16M16 4v16M4 8h8M12 16h8"/>'),
  clock: svg('<circle cx="12" cy="12" r="8.500"/><path d="M12 7v5l3 2"/>'),
};

export const ROUTES: Route[] = [
  { path: '/', icon: ICONS.home, title: 'Painel', nav: 'Painel', group: 'home', mount: mountDashboard },
  { path: '/regular', icon: ICONS.calc, fill: true, title: 'Regime Regular', nav: 'Regime Regular', group: 'engines', mount: mountRegular },
  { path: '/simples', icon: ICONS.coin, fill: true, title: 'Simples Nacional', nav: 'Simples Nacional', group: 'engines', mount: mountSimples },
  { path: '/danfse', icon: ICONS.doc, fill: true, title: 'Gerador DANFSe', nav: 'DANFSe', group: 'engines', mount: mountDanfse },
  { path: '/playground', icon: ICONS.plug, fill: true, title: 'Playground de APIs', nav: 'Playground', group: 'tools', mount: mountPlayground },
  { path: '/comparador', icon: ICONS.compare, title: 'Comparador de cenários', nav: 'Comparador', group: 'tools', mount: mountComparator },
  { path: '/historico', icon: ICONS.clock, fill: true, title: 'Histórico local', nav: 'Histórico', group: 'tools', mount: mountHistory },
];

export function notFound(root: HTMLElement): () => void {
  root.innerHTML = '<div class="alert alert-warning">Página não encontrada. <a href="#/">Voltar ao painel</a>.</div>';
  return () => undefined;
}
