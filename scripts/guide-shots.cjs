// Run: npx vite preview --port 5173, then node scripts/guide-shots.cjs public/guia (test mode, fictional data).
// Guide screenshots (test mode, fictional data). Usage: node guide-shots.cjs <outdir>
const { chromium } = require('playwright');
const U = 'http://127.0.0.1:5173/';
const OUT = process.argv[2];
eval(require('fs').readFileSync(__dirname + '/guide-seed.cjs', 'utf8').replace(/^const \{ chromium \} = require\('playwright'\);\n/, '').replace(/^const out = .*\n/m, '').replace(/^const U = .*\n/m, '').replace('const seed =', 'global.seed ='));
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR' }); const d = await ctx.newPage(); d.setDefaultTimeout(9000);
  d.on('pageerror', (e) => console.log('ERR', e.message));
  const clean = () => d.evaluate(() => document.querySelectorAll('[role=timer], .ewvon-cookie').forEach(e => e.remove()));
  const shot = async (name, opts = {}) => { await clean(); await d.evaluate(() => document.querySelectorAll('input').forEach((i) => { if (/127\.0\.0\.1:5173/.test(i.value)) i.value = i.value.replace(/http:\/\/127\.0\.0\.1:5173/, 'https://ewvon.com'); })); await d.waitForTimeout(500); await d.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 80, ...opts }); console.log('ok', name); };
  const step = async (name, fn) => { try { await fn(); } catch (e) { console.log('FAIL', name, e.message.slice(0, 500).replace(/\n/g, ' | ')); } };
  await d.goto(U); await d.evaluate(seed); await d.goto(U + 'tarefas', { waitUntil: 'networkidle' }); await d.waitForTimeout(2500);
  await step('murais', async () => shot('murais'));
  await step('modelos', async () => { await d.locator('button:has-text("Modelos")').click(); await d.waitForTimeout(700); await d.locator('button.tp-item:has-text("Projeto com etapas")').click(); await d.waitForTimeout(300); await shot('modelos');
    await d.locator('button:has-text("Usar modelo")').click(); await d.waitForTimeout(4000); });
  await step('quadro', async () => shot('quadro'));
  await step('campos', async () => {
    await d.click('button[title="Campos personalizados"]'); await d.waitForTimeout(500);
    for (const [name, type, opts] of [['Valor do contrato', 'Valor (R$)', ''], ['Cliente', 'Texto', ''], ['Área', 'Lista de opções', 'Comercial, Operações, TI']]) {
      await d.locator('[role=dialog] button:has-text("Novo campo")').click(); await d.waitForTimeout(200);
      await d.locator('[role=dialog] input[aria-label="Nome do campo"]').fill(name);
      await d.locator('[role=dialog] .sel-btn').first().click(); await d.waitForTimeout(200); await d.locator(`.sel-list >> text="${type}"`).click(); await d.waitForTimeout(150);
      if (opts) await d.locator('[role=dialog] input[aria-label="Opções"]').fill(opts);
      await d.locator('[role=dialog] button:has-text("Criar campo")').click(); await d.waitForTimeout(500);
    }
    await shot('campos'); await d.keyboard.press('Escape'); await d.waitForTimeout(400); });
  if (process.env.ONLY_CAMPOS) { await b.close(); return; }
  await step('card', async () => {
    await d.locator('h4:has-text("Levantamento de requisitos")').first().click(); await d.waitForTimeout(1200);
    await d.locator('[role=dialog] button:has-text("Mais")').click(); await d.waitForTimeout(300);
    await d.locator('[data-radix-popper-content-wrapper] button:has-text("Tempo")').click(); await d.waitForTimeout(400);
    await d.locator('[role=dialog] button:has-text("Iniciar")').click(); await d.waitForTimeout(2200);
    await shot('card');
  });
  await step('card-campos', async () => {
    const dlg = d.locator('[role=dialog]');
    await dlg.locator('input[placeholder="0"]').nth(1).fill('15000'); await dlg.locator('input[placeholder="0"]').nth(1).press('Enter');
    await dlg.locator('input[placeholder="—"]').first().fill('Construtora Exemplo'); await dlg.locator('input[placeholder="—"]').first().press('Enter');
    await d.waitForTimeout(600);
    await d.evaluate(() => { const el = [...document.querySelectorAll('[role=dialog] *')].find(e => e.textContent?.trim() === 'Dependências'); el?.scrollIntoView({ block: 'center' }); });
    await d.waitForTimeout(500); await shot('card-campos');
    await d.keyboard.press('Escape'); await d.waitForTimeout(600);
  });
  const view = async (label, name) => { await d.click('button[title="Escolher como ver o mural"]'); await d.waitForTimeout(400); if (name === 'menu-visao') { await shot('menu-visao'); } await d.locator(`[role=menuitem]:has-text("${label}")`).click(); await d.waitForTimeout(1500); };
  await d.keyboard.press('Escape'); await d.waitForTimeout(300); await d.keyboard.press('Escape'); await d.waitForTimeout(400);
  await step('lista', async () => { await view('Lista', 'menu-visao'); await shot('lista'); });
  await step('calendario', async () => { await view('Calendário'); await shot('calendario'); });
  await step('linha', async () => { await view('Linha do tempo'); await shot('linha-do-tempo'); });
  await step('carga', async () => { await view('Carga de trabalho'); await shot('carga'); });
  await step('relatorios', async () => { await view('Relatórios'); await shot('relatorios'); await view('Quadro'); });
  await d.keyboard.press('Escape'); await d.waitForTimeout(400);
  await step('automacoes', async () => {
    await d.click('button[title="Automações do Board"]'); await d.waitForTimeout(600); await d.locator('text=Nova Regra').click(); await d.waitForTimeout(400);
    await d.locator('[role=combobox]').first().click(); await d.waitForTimeout(300); await d.locator('[role=option]:has-text("Card entrou na coluna")').click(); await d.waitForTimeout(300);
    await d.locator('[role=combobox]').nth(2).click(); await d.waitForTimeout(300); await d.locator('[role=option]:has-text("Definir prazo")').click(); await d.waitForTimeout(300);
    await shot('automacoes'); await d.keyboard.press('Escape'); await d.waitForTimeout(500); });
  let formUrl = '', guestUrl = '';
  await d.keyboard.press('Escape'); await d.waitForTimeout(400);
  await step('compartilhar', async () => {
    await d.click('button[title="Compartilhar quadro"]'); await d.waitForTimeout(800);
    await d.locator('[role=dialog] button:has-text("Criar link para convidados")').click(); await d.waitForTimeout(600);
    await d.locator('[role=dialog] label:has-text("Permitir que convidados") input').check(); await d.waitForTimeout(400);
    guestUrl = await d.locator('[role=dialog] input[readonly]').filter({ hasText: '' }).evaluateAll((els) => els.map(e => e.value).find(v => v.includes('/m/')) || '');
    await d.locator('[role=dialog] button:has-text("Criar formulário")').click(); await d.waitForTimeout(800);
    await d.locator('[role=dialog] button:has-text("Fechar edição")').click().catch(() => {}); await d.waitForTimeout(300);
    await d.locator('[role=dialog] button:has-text("Criar chave para receber cards")').click(); await d.waitForTimeout(600);
    formUrl = await d.locator('[role=dialog] input[readonly]').evaluateAll((els) => els.map(e => e.value).find(v => v.includes('/f/')) || '');
    await d.evaluate(() => { const el = [...document.querySelectorAll('[role=dialog] *')].find(e => e.textContent?.trim() === 'Link para convidados (somente leitura)'); el?.scrollIntoView({ block: 'start' }); });
    await d.waitForTimeout(400); await shot('compartilhar');
    await d.locator('[role=dialog] button:has-text("Editar formulário")').click(); await d.waitForTimeout(500);
    await d.evaluate(() => { const el = [...document.querySelectorAll('[role=dialog] *')].find(e => e.textContent?.trim() === 'Formulário do mural'); el?.scrollIntoView({ block: 'start' }); });
    await d.waitForTimeout(400); await shot('form-editor'); await d.keyboard.press('Escape'); await d.waitForTimeout(400);
  });
  console.log('urls', formUrl, guestUrl);
  await step('form-publico', async () => { if (!formUrl) throw new Error('sem link'); await d.goto(formUrl.replace(/^https?:\/\/[^/]+\//, U), { waitUntil: 'networkidle' }); await d.waitForTimeout(1500);
    await d.locator('label:has-text("Assunto") input').fill('Ajustar o cronograma da obra'); await d.locator('label:has-text("Seu nome") input').fill('Mariana Costa'); await d.locator('label:has-text("Seu e-mail") input').fill('mariana@exemplo.com');
    await shot('form-publico'); });
  await step('convidado', async () => { if (!guestUrl) throw new Error('sem link'); await d.goto(guestUrl.replace(/^https?:\/\/[^/]+\//, U), { waitUntil: 'networkidle' }); await d.waitForTimeout(1500);
    await d.locator('article:has-text("Revisão com o cliente")').click(); await d.waitForTimeout(400);
    await d.locator('input[placeholder="Seu nome"]').fill('Mariana (cliente)'); await d.locator('textarea').fill('Podemos antecipar a revisão para quinta-feira?'); await d.locator('button:has-text("Comentar")').click(); await d.waitForTimeout(900);
    await shot('convidado'); });
  await step('minhas', async () => { await d.goto(U + 'tarefas/minhas-tarefas', { waitUntil: 'networkidle' }); await d.waitForTimeout(2500); await shot('minhas'); });
  await step('importar', async () => { await d.goto(U + 'tarefas', { waitUntil: 'networkidle' }); await d.waitForTimeout(2000); await d.locator('button:has-text("Importar")').click(); await d.waitForTimeout(700); await shot('importar'); await d.keyboard.press('Escape'); });
  await step('agenda', async () => { await d.goto(U + 'calendario', { waitUntil: 'networkidle' }); await d.waitForTimeout(2000); await d.locator('button:has-text("Agenda no celular")').click(); await d.waitForTimeout(900); await shot('agenda'); await d.keyboard.press('Escape'); });
  await step('webhooks', async () => { await d.goto(U + 'integracoes', { waitUntil: 'networkidle' }); await d.waitForTimeout(2000); await clean(); await d.locator('text=Webhooks').first().click(); await d.waitForTimeout(800);
    await d.locator('.sel-btn').first().click(); await d.waitForTimeout(200); await d.locator('.sel-list >> text=/Discord/').click(); await d.waitForTimeout(300); await shot('webhooks'); });
  await b.close();
})();
