import 'bootstrap/dist/css/bootstrap.min.css';
import './assets/styles.css';
import { buildShell } from './layouts/shell';
import { notFound, ROUTES, type Route } from './pages/routes';

const app = document.getElementById('app');
if (!app) throw new Error('Elemento #app não encontrado.');

const shell = buildShell(app);
let cleanup: () => void = () => undefined;

function parseHash(): { path: string; query: URLSearchParams } {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, qs = ''] = raw.split('?');
  return { path: path || '/', query: new URLSearchParams(qs) };
}

function navigate(): void {
  cleanup();
  const { path, query } = parseHash();
  const route: Route | undefined = ROUTES.find((r) => r.path === path);
  shell.setActive(route ? route.path : '');
  document.title = route ? `${route.title} · RTC Lab` : 'RTC Lab';
  shell.view.replaceChildren();
  shell.view.classList.toggle('rtc-view--fill', Boolean(route?.fill));
  cleanup = route ? route.mount(shell.view, query) : notFound(shell.view);
  window.scrollTo({ top: 0 });
}

window.addEventListener('hashchange', navigate);
navigate();
