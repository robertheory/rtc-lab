import { expect, test, type Page } from '@playwright/test';
import { resolve } from 'node:path';
import { ROOT_XML } from './paths';

const run = (page: Page) => page.locator('[data-action="run-operation"]').click();
const pickScenario = (page: Page, id: string) => page.getByTestId('scenario-select').selectOption(id);

test('dashboard shows real availability and pinned versions for all engines', async ({ page }) => {
  await page.goto('/');
  for (const id of ['regular', 'simples', 'danfse']) {
    await expect(page.locator(`[data-engine="${id}"] [data-health]`)).toHaveAttribute('data-health', 'up');
  }
  await expect(page.getByTestId('version-regular')).toContainText('1.7.2');
  await expect(page.getByTestId('disclaimer')).toContainText('Não é um sistema oficial da Receita Federal');
});

test('footer is a thin single line across the full width', async ({ page }) => {
  await page.goto('/#/regular');
  const footer = page.getByTestId('disclaimer');
  const box = await footer.boundingBox();
  const viewport = page.viewportSize()!;
  expect(box!.x).toBe(0);
  expect(Math.round(box!.width)).toBe(viewport.width);
  expect(box!.height).toBeLessThan(32);
  expect(await footer.evaluate((el) => getComputedStyle(el).whiteSpace)).toBe('nowrap');
  expect(await footer.textContent()).toContain('devem ser utilizados apenas para fins de experimentação e aprendizado.');
  expect(box!.y + box!.height).toBeCloseTo(viewport.height, 0);
});

test('sidebar collapses to icons and remembers the choice', async ({ page }) => {
  await page.goto('/');
  const shell = page.locator('.rtc-shell');
  const before = (await page.locator('.rtc-sidebar').boundingBox())!.width;
  await page.getByTestId('sidebar-toggle').click();
  await expect(shell).toHaveAttribute('data-collapsed', 'true');
  await expect.poll(async () => (await page.locator('.rtc-sidebar').boundingBox())!.width).toBeLessThan(before / 2);
  await page.reload();
  await expect(shell).toHaveAttribute('data-collapsed', 'true');
  await page.getByTestId('sidebar-toggle').click();
  await expect(shell).toHaveAttribute('data-collapsed', 'false');
});

test('workbench opens blank; a scenario fills the form and shows its description', async ({ page }) => {
  await page.goto('/#/regular');
  await expect(page.getByTestId('scenario-card')).toHaveCount(0);
  await expect(page.getByTestId('response-empty')).toBeVisible();
  await expect(page.locator('[data-abs="id"]')).toHaveValue('');
  await pickScenario(page, 'cesta-basica');
  await expect(page.getByTestId('scenario-card')).toContainText('Cesta básica com redução');
  await expect(page.locator('[data-abs="itens.0.ncm"]')).toHaveValue('10063021');
});

test('the response appears beside the form without scrolling the page', async ({ page }) => {
  await page.goto('/#/regular');
  await pickScenario(page, 'cesta-basica');
  await run(page);
  const status = page.getByTestId('http-status');
  await expect(status).toContainText('HTTP 200');
  const box = (await status.boundingBox())!;
  const vp = page.viewportSize()!;
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(vp.height);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  const form = (await page.getByTestId('operation-form').boundingBox())!;
  expect(box.x).toBeGreaterThan(form.x + form.width * 0.5);
});

test('clear resets form, description and response, and can be undone', async ({ page }) => {
  await page.goto('/#/regular');
  await pickScenario(page, 'cesta-basica');
  await run(page);
  await expect(page.getByTestId('http-status')).toBeVisible();
  await page.locator('[data-action="clear-form"]').click();
  await expect(page.getByTestId('scenario-card')).toHaveCount(0);
  await expect(page.getByTestId('response-empty')).toBeVisible();
  await expect(page.locator('[data-abs="itens.0.ncm"]')).toHaveValue('');
  await page.locator('[data-action="undo-clear"]').click();
  await expect(page.getByTestId('scenario-card')).toBeVisible();
  await expect(page.locator('[data-abs="itens.0.ncm"]')).toHaveValue('10063021');
});

test('editing a loaded scenario marks it as modified and restore brings it back', async ({ page }) => {
  await page.goto('/#/regular');
  await pickScenario(page, 'cesta-basica');
  await expect(page.getByTestId('scenario-dirty')).toBeHidden();
  await page.locator('[data-abs="itens.0.baseCalculo"]').fill('555');
  await expect(page.getByTestId('scenario-dirty')).toBeVisible();
  await page.locator('[data-action="restore"]').click();
  await expect(page.locator('[data-abs="itens.0.baseCalculo"]')).toHaveValue('100');
  await expect(page.getByTestId('scenario-dirty')).toBeHidden();
});

test('advanced mode is a toggle that reveals the body editor, in sync with the form, per engine', async ({ page }) => {
  await page.goto('/#/simples');
  await expect(page.getByTestId('operation-editor')).toBeHidden();
  await page.getByTestId('advanced-toggle').check();
  await page.locator('[data-view="editor"]').click();
  await expect(page.getByTestId('operation-editor')).toBeVisible();
  await page.locator('[data-view="form"]').click();
  await page.locator('[data-abs="id"]').fill('abc-123');
  await page.locator('[data-view="editor"]').click();
  await expect(page.getByTestId('operation-editor').locator('.cm-content')).toContainText('"id": "abc-123"');
  await page.reload();
  await expect(page.getByTestId('advanced-toggle')).toBeChecked();
  await page.goto('/#/regular');
  await expect(page.getByTestId('advanced-toggle')).not.toBeChecked();
});

test('dates are date inputs and annexes are chips', async ({ page }) => {
  await page.goto('/#/simples');
  await expect(page.locator('[data-abs="data"]')).toHaveAttribute('type', 'date');
  await page.locator('[data-tab-link="consultas"]').click();
  await page.getByTestId('tool-select').selectOption('atividades');
  await expect(page.locator('[data-param="data"]')).toHaveAttribute('type', 'date');
  await expect(page.locator('[data-chip]')).toHaveCount(5);
  await page.goto('/#/regular');
  await expect(page.locator('[data-abs="dhFatoGerador"]')).toHaveAttribute('type', 'datetime-local');
});

test('datetime keeps the offset required by the engine', async ({ page }) => {
  await page.goto('/#/regular');
  await page.getByTestId('advanced-toggle').check();
  await page.locator('[data-abs="dhFatoGerador"]').fill('2027-03-10T10:00');
  await page.locator('[data-view="editor"]').click();
  await expect(page.getByTestId('operation-editor').locator('.cm-content')).toContainText('2027-03-10T10:00:00-03:00');
});

test('engine errors mark the field next to the input and clear when edited', async ({ page }) => {
  await page.goto('/#/regular');
  await pickScenario(page, 'erro-classificacao-observabilidade');
  await run(page);
  const ncm = page.locator('[data-abs="itens.0.ncm"]');
  await expect(ncm).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('.rtc-f-error').first()).toContainText('NCM não vinculada');
  await ncm.fill('24021000');
  await expect(ncm).not.toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('.rtc-f-error')).toHaveCount(0);
});

test('the divider can be moved with the keyboard and is remembered', async ({ page }) => {
  await page.goto('/#/regular');
  const split = page.getByTestId('splitter');
  const before = Number(await split.getAttribute('aria-valuenow'));
  await split.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  expect(Number(await split.getAttribute('aria-valuenow'))).toBe(before + 4);
  await page.reload();
  await expect.poll(async () => Number(await page.getByTestId('splitter').getAttribute('aria-valuenow'))).toBe(before + 4);
});

test('simples scenario shows per-item state', async ({ page }) => {
  await page.goto('/#/simples');
  await pickScenario(page, 'multiplos-itens');
  await run(page);
  await expect(page.getByTestId('item-summary').locator('tbody tr')).toHaveCount(3);
  await expect(page.getByTestId('item-summary')).toContainText('CALCULADO');
});

test('activities lookup applies the chosen code to the operation items', async ({ page }) => {
  await page.goto('/#/simples');
  await page.locator('[data-tab-link="consultas"]').click();
  await page.getByTestId('tool-select').selectOption('atividades');
  await page.locator('[data-action="run-tool"]').click();
  await page.locator('[data-activity="09"] [data-action="use-activity"]').click();
  await expect(page.locator('[data-abs="itens.0.cAtivSN"]')).toHaveValue('09');
});

test('consultas: xml validation tool runs against the engine', async ({ page }) => {
  await page.goto('/#/regular');
  await page.locator('[data-tab-link="consultas"]').click();
  await page.getByTestId('tool-select').selectOption('xml-validar');
  await page.getByTestId('example-select').selectOption('xml-validar-nfse');
  await page.locator('[data-action="run-tool"]').click();
  await expect(page.getByTestId('http-status')).toContainText('HTTP 200');
});

test('danfse: scenario, PDF preview, download and Object URL release', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __revoked: string[] };
    w.__revoked = [];
    const orig = URL.revokeObjectURL.bind(URL);
    URL.revokeObjectURL = (u: string) => { w.__revoked.push(u); orig(u); };
  });
  await page.goto('/#/danfse');
  await page.getByTestId('xml-file').setInputFiles(resolve(ROOT_XML, 'nfse-completa.xml'));
  await page.locator('[data-action="generate-pdf"]').click();
  await expect(page.getByTestId('pdf-frame')).toBeVisible();
  expect(await page.getByTestId('pdf-frame').getAttribute('src')).toMatch(/^blob:/);
  const download = page.waitForEvent('download');
  await page.getByTestId('download-pdf').click();
  expect((await download).suggestedFilename()).toBe('danfse.pdf');
  await page.locator('[data-action="generate-pdf"]').click();
  await expect.poll(async () => page.evaluate(() => (window as unknown as { __revoked: string[] }).__revoked.length)).toBeGreaterThan(0);
});

test('danfse: choosing a scenario sets the options and shows the PDF beside the form', async ({ page }) => {
  await page.goto('/#/danfse');
  await pickScenario(page, 'nfse-cancelada');
  await expect(page.getByTestId('stc')).toHaveValue('2');
  await expect(page.getByTestId('canhoto')).not.toBeChecked();
  await page.locator('[data-action="generate-pdf"]').click();
  await expect(page.getByTestId('pdf-frame')).toBeVisible();
  const pdf = (await page.getByTestId('pdf-frame').boundingBox())!;
  const form = (await page.getByTestId('operation-form').count()) ? null : (await page.getByTestId('workbench').boundingBox())!;
  expect(pdf.x).toBeGreaterThan(form!.x + form!.width * 0.4);
});

test('danfse: rejects non-xml files and oversized files before sending', async ({ page }) => {
  await page.goto('/#/danfse');
  await page.getByTestId('xml-file').setInputFiles({ name: 'nota.txt', mimeType: 'text/plain', buffer: Buffer.from('x') });
  await expect(page.getByTestId('file-error')).toContainText('.xml');
  await page.getByTestId('xml-file').setInputFiles({ name: 'grande.xml', mimeType: 'text/xml', buffer: Buffer.alloc(6 * 1024 * 1024, 'a') });
  await expect(page.getByTestId('file-error')).toContainText('limite');
});

test('danfse: malformed XML is reported without calling the engine', async ({ page }) => {
  await page.goto('/#/danfse');
  await page.getByTestId('xml-file').setInputFiles({ name: 'quebrado.xml', mimeType: 'text/xml', buffer: Buffer.from('<NFSe><aberto>') });
  await page.locator('[data-action="generate-pdf"]').click();
  await expect(page.locator('.alert-danger')).toContainText('bem formado');
});

test('history persists across reload and never stores XML', async ({ page }) => {
  await page.goto('/#/simples');
  await pickScenario(page, 'nfe-basica');
  await run(page);
  await expect(page.getByTestId('http-status')).toContainText('200');
  await page.goto('/#/danfse');
  await pickScenario(page, 'nfse-simples');
  await page.locator('[data-action="generate-pdf"]').click();
  await expect(page.getByTestId('pdf-frame')).toBeVisible();
  await page.reload();
  await page.goto('/#/historico');
  const rows = page.locator('[data-history-id]');
  await expect(rows).toHaveCount(2);
  expect(await page.evaluate(() => localStorage.getItem('rtc-lab:history:v1') ?? '')).not.toContain('<NFSe');
  await rows.filter({ hasText: 'NF-e básica' }).locator('[data-action="rerun"]').click();
  await expect(page.getByTestId('history-detail').getByTestId('http-status')).toContainText('200');
  page.once('dialog', (d) => d.accept());
  await page.locator('[data-action="clear-history"]').click();
  await expect(page.getByTestId('history-table')).toContainText('Nenhuma execução');
});

test('comparator shows differences coming from the engine responses', async ({ page, request }) => {
  await page.goto('/#/comparador');
  await page.getByTestId('cmp-engine').selectOption('simples');
  await page.getByTestId('cmp-scenario').selectOption('nfe-basica');
  const original = await (await request.get('/scenarios/simples/payloads/nfe-basica.json')).text();
  await expect(page.locator('.cm-content').nth(1)).toContainText('1000.00');
  await page.locator('.cm-content').nth(1).click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.insertText(original.replaceAll('1000.00', '2000.00'));
  await page.locator('[data-action="compare"]').click();
  const diff = page.getByTestId('diff');
  await expect(diff).toContainText('diferença(s)');
  await expect(diff.locator('tr[data-diff-kind="changed"]').first()).toBeVisible();
  await expect(diff).toContainText('1000.00');
  await expect(diff).toContainText('2000.00');
});

test('playground blocks destinations outside the engines', async ({ page }) => {
  await page.goto('/#/playground');
  await page.getByTestId('url').fill('/etc/passwd');
  await page.locator('[data-action="send"]').click();
  await expect(page.locator('.alert-danger')).toContainText('playground só fala com os motores');
  await page.getByTestId('url').fill('/api/simples/versao');
  await page.getByTestId('method').selectOption('GET');
  await page.locator('[data-action="send"]').click();
  await expect(page.getByTestId('http-status')).toContainText('200');
});
