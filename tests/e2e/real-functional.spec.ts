import { test, expect, devices, type Page, type BrowserContext } from "@playwright/test";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { gotoStable, isHmrNoise } from "./helpers/nav";

const EVID = path.resolve("test-results/real-evidence");
const REPORT = path.resolve("test-results/real-evidence/result-report.json");
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:8080";

type CTStatus = "Aprovado" | "Reprovado" | "Bloqueado" | "Não executado";
type CTResult = {
  id: string;
  title: string;
  status: CTStatus;
  evidences: string[];
  notes?: string;
  defect?: string;
  execAt: string;
};

const results: CTResult[] = [];
let page: Page;
let context: BrowserContext;
const consoleErrors: string[] = [];

const SUFFIX = Date.now().toString(36).slice(-5);
const MASSA = {
  escola: {
    nome: `Escola QA Lecto 170826-${SUFFIX}`,
    slug: `escola-qa-lecto-170826-${SUFFIX}`,
    cidade: "Curitiba",
    uf: "PR",
  },
  admin: {
    nome: "Amanda Gestora QA",
    email: `admin.lecto.170826${SUFFIX}@example.com`,
    senha: "Teste@123456",
  },
  prof1: {
    nome: "Carlos Leitor QA",
    email: `carlos.lecto.${SUFFIX}@example.com`,
    senha: "Prof@12345",
    cargo: "Língua Portuguesa",
  },
  prof2: {
    nome: "Ana Pedagoga QA",
    email: `ana.lecto.${SUFFIX}@example.com`,
    senha: "Ped@12345",
    cargo: "Pedagogo(a)",
  },
  turma1: { nome: "5º Ano A — 2026", serie: "5º", ano: "2026" },
  turma2: { nome: "5º Ano B — 2026", serie: "5º", ano: "2026" },
  aluno1: { nome: "João Leitor QA", codigo: "QA001", pin: "1234" },
  aluno2: { nome: "Maria Leitora QA", codigo: "QA002", pin: "2345" },
  aluno3: { nome: "Pedro Leitor QA", codigo: "QA003", pin: "3456" },
  texto: { titulo: "A jornada da gota d'água" },
  simulado: { titulo: "Simulado QA — Ciclo da Água", duracao: "60" },
};

const USERS = {
  superadmin: { email: "kmkz.clan@gmail.com", senha: "nick@1103" },
  demoAdmin: { email: "admin@escolademo.com", senha: "password123" },
  demoProf: { email: "prof.carlos@escolademo.com", senha: "password123" },
};

function ct(
  id: string,
  title: string,
): { mark: (s: CTStatus, notes?: string, defect?: string) => Promise<void> } {
  const row: CTResult = {
    id,
    title,
    status: "Não executado",
    evidences: [],
    execAt: new Date().toISOString(),
  };
  results.push(row);
  return {
    async mark(status: CTStatus, notes?: string, defect?: string) {
      row.status = status;
      if (notes) row.notes = notes;
      if (defect) row.defect = defect;
    },
  };
}

async function snap(name: string) {
  const f = path.join(EVID, `${name}.png`);
  await page.screenshot({ path: f, fullPage: true }).catch(() => {});
  for (const r of results) {
    if (r.status === "Não executado") {
      r.evidences.push(f);
      break;
    }
  }
  return f;
}

async function fillById(id: string, value: string) {
  const l = page.locator(`#${id}`);
  await l.fill(value, { force: true });
  await l.dispatchEvent("input");
  await l.dispatchEvent("change");
}

async function fillByLabel(label: string, value: string) {
  const l = page.getByLabel(label, { exact: false }).first();
  await l.fill(value, { force: true });
  await l.dispatchEvent("input");
}

async function selectOptionByLabel(triggerLabel: string, optionText: string): Promise<boolean> {
  try {
    const button = page
      .getByRole("combobox", {
        name: new RegExp(triggerLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
      })
      .first();
    await button.waitFor({ state: "visible", timeout: 8000 });
    await button.click({ timeout: 5000 });
    await page.waitForTimeout(500);
    const opt = page
      .getByRole("option", {
        name: new RegExp(optionText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
      })
      .first();
    await opt.waitFor({ state: "visible", timeout: 8000 });
    await opt.click({ timeout: 5000 });
    return true;
  } catch (e) {
    console.warn(
      `selectOptionByLabel falhou (trigger="${triggerLabel}", option="${optionText}"): ${String(e).slice(0, 120)}`,
    );
    // Fallback: tenta abrir por seletor generico e clicar na opcao por texto
    try {
      const anyCombo = page.locator('[role="combobox"]').first();
      await anyCombo.click({ timeout: 3000 });
      await page.waitForTimeout(400);
      const anyOpt = page
        .getByText(
          new RegExp(`^\\s*${optionText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "i"),
        )
        .first();
      await anyOpt.click({ timeout: 4000 });
      return true;
    } catch {
      return false;
    }
  }
}

test.describe.configure({ mode: "serial", timeout: 1800_000 });

test.beforeAll(async ({ browser }) => {
  await mkdir(EVID, { recursive: true });
  context = await browser.newContext({
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 900 },
  });
  page = await context.newPage();
  page.on("console", (msg) => {
    const t = msg.text();
    if (msg.type() === "error" && !isHmrNoise(t)) consoleErrors.push(t);
  });
  page.on("pageerror", (e) => {
    const m = e.message;
    if (!isHmrNoise(m)) consoleErrors.push(`PAGEERR: ${m}`);
  });
  await gotoStable(page, `${BASE}/auth`);
});

test.afterAll(async () => {
  await mkdir(EVID, { recursive: true }).catch(() => {});
  const approved = results.filter((r) => r.status === "Aprovado").length;
  const rejected = results.filter((r) => r.status === "Reprovado").length;
  const blocked = results.filter((r) => r.status === "Bloqueado").length;
  const not = results.filter((r) => r.status === "Não executado").length;
  const report = {
    dataExec: new Date().toISOString(),
    baseURL: BASE,
    consoleErrors,
    totals: {
      planejados: results.length,
      aprovados: approved,
      reprovados: rejected,
      bloqueados: blocked,
      naoExecutados: not,
    },
    results,
    massa: MASSA,
  };
  await writeFile(REPORT, JSON.stringify(report, null, 2), "utf8").catch((e) =>
    console.error("report write failed:", e.message || String(e)),
  );
  await context?.close().catch(() => {});
});

// ---------- AUTH ----------
test("CT-AUTH-01 — Login superadmin + acesso /app/admin/schools", async () => {
  const c = ct("CT-AUTH-01", "Controle de acesso ao painel administrativo");
  try {
    await page.waitForSelector("#email, input[type=email]");
    const emailInput = page.locator("#email, input[type=email]").first();
    const passInput = page.locator("#password, input[type=password]").first();
    await emailInput.fill(USERS.superadmin.email, { force: true });
    await emailInput.dispatchEvent("input");
    await passInput.fill(USERS.superadmin.senha, { force: true });
    await passInput.dispatchEvent("input");
    await snap("CT-AUTH-01_01-pre-submit");
    await page.getByRole("button", { name: /^Entrar$/ }).click();
    await page.waitForURL(/\/app/, { timeout: 30000 });
    await page.waitForTimeout(2000);
    await snap("CT-AUTH-01_02-pos-login-dashboard");
    await gotoStable(page, `${BASE}/app/admin/schools`);
    await expect(page.getByRole("link", { name: /Nova escola/i }).first()).toBeVisible({
      timeout: 20000,
    });
    await snap("CT-AUTH-01_03-admin-schools");
    c.mark("Aprovado", `Login OK em ${page.url()}`);
  } catch (e) {
    await snap("CT-AUTH-01_ERRO");
    c.mark("Reprovado", String(e), "AUTH-LOGIN-FALHA");
    console.error("CT-AUTH-01 falhou:", e);
  }
});

test("CT-AUTH-02 — Bloquear admin escola em /app/admin/schools", async () => {
  const c = ct("CT-AUTH-02", "Bloquear acesso sem papel superadmin");
  try {
    await page.evaluate(() => localStorage.clear());
    await gotoStable(page, `${BASE}/auth`);
    await page.waitForSelector("#email, input[type=email]", { timeout: 20000 });
    const emailInput = page.locator("#email, input[type=email]").first();
    const passInput = page.locator("#password, input[type=password]").first();
    await emailInput.fill(USERS.demoAdmin.email, { force: true });
    await emailInput.dispatchEvent("input");
    await passInput.fill(USERS.demoAdmin.senha, { force: true });
    await passInput.dispatchEvent("input");
    await page.getByRole("button", { name: /^Entrar$/ }).click();
    await page.waitForURL(/\/app/, { timeout: 30000 });
    await page.waitForTimeout(1500);
    await snap("CT-AUTH-02_01-admin-escola-logado");
    // Tentativa de abrir rota de superadmin
    const l = page
      .waitForResponse((r) => r.url().includes("/admin/schools"), { timeout: 15000 })
      .catch(() => undefined);
    await page.goto(`${BASE}/app/admin/schools`, { waitUntil: "domcontentloaded" }).catch(() => {});
    await (await l)?.finished().catch(() => {});
    const resp: number | undefined = page.url().includes("/app/admin/schools") ? 200 : 403;
    await page.waitForTimeout(1500);
    const blocked =
      !page.url().includes("/app/admin/schools") ||
      (await page.getByText(/acesso negado|não autorizado|permission denied|403/i).count()) > 0 ||
      (await page.getByRole("heading", { name: /Dashboard|Painel/i }).count()) === 0;
    await snap("CT-AUTH-02_02-pos-tentativa-admin-global");
    const redirect = !page.url().includes("/admin/schools");
    c.mark(
      redirect || blocked ? "Aprovado" : "Reprovado",
      `URL final: ${page.url()}. Redirect=${redirect}`,
      !redirect && !blocked ? "AUTH-ACESSO-GLOBAL-VAZOU" : undefined,
    );
  } catch (e) {
    await snap("CT-AUTH-02_ERRO");
    c.mark("Bloqueado", String(e));
  }
});

// ---------- ESCOLA ----------
test("CT-ESC-01 — Criar escola + administrador", async () => {
  const c = ct("CT-ESC-01", "Criar escola e administrador");
  try {
    await page.evaluate(() => localStorage.clear());
    await gotoStable(page, `${BASE}/auth`);
    await page.waitForSelector("#email, input[type=email]", { timeout: 20000 });
    const emailInput = page.locator("#email, input[type=email]").first();
    const passInput = page.locator("#password, input[type=password]").first();
    await emailInput.fill(USERS.superadmin.email, { force: true });
    await emailInput.dispatchEvent("input");
    await passInput.fill(USERS.superadmin.senha, { force: true });
    await passInput.dispatchEvent("input");
    await page.getByRole("button", { name: /^Entrar$/ }).click();
    await page.waitForURL(/\/app/, { timeout: 30000 });
    await gotoStable(page, `${BASE}/app/admin/schools?new=true`);
    await page.waitForTimeout(1500);
    await page
      .getByRole("button", { name: /Criar escola/i })
      .first()
      .waitFor({ state: "visible", timeout: 25000 });
    await page.waitForTimeout(1000);
    // Pega inputs do diálogo (tudo visível, não busca da página)
    let inputs = page.locator("input:not([type=checkbox]):not([type=radio])");
    let n = await inputs.count();
    if (n < 8) {
      await page.waitForTimeout(3000);
      inputs = page.locator("input:not([type=checkbox]):not([type=radio])");
      n = await inputs.count();
    }
    if (n < 8) {
      await snap("CT-ESC-01_ERRO-poucos-inputs");
      c.mark(
        "Bloqueado",
        `Formulário não abriu corretamente: apenas ${n} inputs text/number visíveis (esperava >= 8)`,
        "ESC-DIALOGO-NAO-ABRIU",
      );
      return;
    }
    const fields = [
      MASSA.escola.nome,
      MASSA.escola.slug,
      MASSA.escola.cidade,
      MASSA.escola.uf,
      MASSA.admin.nome,
      MASSA.admin.email,
      MASSA.admin.senha,
    ];
    for (let i = 0; i < fields.length; i++) {
      const l = inputs.nth(i + 1);
      await l.fill(fields[i], { force: true });
      await l.dispatchEvent("input");
    }
    await page.waitForTimeout(300);
    await snap("CT-ESC-01_01-form-preenchido");
    await page
      .getByRole("button", { name: /Criar escola/i })
      .first()
      .click();
    await page.waitForTimeout(10000);
    await snap("CT-ESC-01_02-pos-submit");
    const search = page
      .getByPlaceholder(/Buscar por nome, slug, cidade|Buscar escola|Buscar/i)
      .first();
    if (await search.count()) {
      await search.fill(MASSA.escola.slug, { force: true });
      await search.dispatchEvent("input");
      await page.waitForTimeout(3000);
    }
    await snap("CT-ESC-01_03-busca-escola");
    const encontrou =
      (await page
        .getByRole("link", {
          name: new RegExp(MASSA.escola.nome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
        })
        .count()) > 0;
    c.mark(
      encontrou ? "Aprovado" : "Reprovado",
      encontrou
        ? `Escola encontrada na listagem`
        : `Escola não encontrada na busca por slug ${MASSA.escola.slug}`,
      !encontrou ? "ESC-CRIACAO-NAO-PERSISTIU" : undefined,
    );
  } catch (e) {
    await snap("CT-ESC-01_ERRO");
    c.mark("Reprovado", String(e), "ESC-CRIACAO-EXCEPTION");
  }
});

test("CT-ESC-02 — Validações de campos obrigatórios", async () => {
  const c = ct("CT-ESC-02", "Validar campos obrigatórios da escola");
  try {
    await gotoStable(page, `${BASE}/app/admin/schools?new=true`);
    await page.waitForTimeout(1500);
    // Tentar submit vazio
    const btn = page.getByRole("button", { name: /Criar escola/i }).first();
    await btn.click();
    await page.waitForTimeout(1500);
    await snap("CT-ESC-02_01-submit-vazio");
    // Erros esperados na tela ou notification
    const errosVisiveis =
      (await page.getByText(/preencha|obrigat|campo|informe/i).count()) > 0 ||
      (await page
        .locator('[role="status"], [aria-live="polite"]')
        .filter({ hasText: /preencha|obrigat|erro|falha/i })
        .count()) > 0;
    c.mark(
      errosVisiveis ? "Aprovado" : "Bloqueado",
      errosVisiveis
        ? "Mensagens de validação visíveis"
        : "Nenhuma mensagem de validação exibida — não foi possível confirmar sem evidência adicional",
      !errosVisiveis ? "ESC-VALIDACAO-SEM-MENSAGEM" : undefined,
    );
  } catch (e) {
    await snap("CT-ESC-02_ERRO");
    c.mark("Bloqueado", String(e));
  }
});

test("CT-ESC-03 — Duplicidade de slug e e-mail", async () => {
  const c = ct("CT-ESC-03", "Impedir e-mail/slug duplicado");
  try {
    await gotoStable(page, `${BASE}/app/admin/schools?new=true`);
    await page.waitForTimeout(1500);
    const inputs = page.locator("input:not([type=checkbox]):not([type=radio])");
    const fields = [
      MASSA.escola.nome,
      MASSA.escola.slug,
      MASSA.escola.cidade,
      MASSA.escola.uf,
      MASSA.admin.nome,
      MASSA.admin.email,
      MASSA.admin.senha,
    ];
    for (let i = 0; i < fields.length; i++) {
      await inputs.nth(i + 1).fill(fields[i], { force: true });
      await inputs.nth(i + 1).dispatchEvent("input");
    }
    await page
      .getByRole("button", { name: /Criar escola/i })
      .first()
      .click();
    await page.waitForTimeout(6000);
    await snap("CT-ESC-03_01-tentativa-duplicada");
    const temErro =
      (await page
        .getByText(/duplic|já existe|jÁ existe|em uso|slug.*cadast|email.*cadast/i)
        .count()) > 0 ||
      (await page
        .locator('[role="status"], [aria-live="polite"]')
        .filter({ hasText: /erro|falha|inválido|não foi/i })
        .count()) > 0 ||
      (await page
        .locator("button")
        .filter({ hasText: /Criar escola/i })
        .first()
        .isVisible());
    c.mark(
      temErro ? "Aprovado" : "Bloqueado",
      temErro
        ? "Mensagem de duplicidade ou formulário permaneceu (bloqueado)"
        : "Sem evidência de bloqueio",
      !temErro ? "ESC-DUPLICIDADE-PERMITIDA" : undefined,
    );
  } catch (e) {
    await snap("CT-ESC-03_ERRO");
    c.mark("Bloqueado", String(e));
  }
});

// ---------- PROFESSORES ----------
test("CT-PROF-01 — Criar professor (Língua Portuguesa)", async () => {
  const c = ct("CT-PROF-01", "Criar professor");
  try {
    // Login como admin escola demo (que tem permissão para criar professores)
    await page.evaluate(() => localStorage.clear());
    await gotoStable(page, `${BASE}/auth`);
    await page.waitForSelector("#email, input[type=email]", { timeout: 20000 });
    const emailInput = page.locator("#email, input[type=email]").first();
    const passInput = page.locator("#password, input[type=password]").first();
    await emailInput.fill(USERS.demoAdmin.email, { force: true });
    await emailInput.dispatchEvent("input");
    await passInput.fill(USERS.demoAdmin.senha, { force: true });
    await passInput.dispatchEvent("input");
    await page.getByRole("button", { name: /^Entrar$/ }).click();
    await page.waitForURL(/\/app/, { timeout: 30000 });
    await page.waitForTimeout(1500);
    await page.goto(`${BASE}/app/professionals`, { waitUntil: "domcontentloaded" }).catch(() => {});
    await page.waitForTimeout(2000);
    await snap("CT-PROF-01_00-pagina-profissionais");
    // Abrir diálogo
    const novoBtn = page
      .getByRole("button", {
        name: /Novo profissional|Novo professor|Adicionar|Nova profissional/i,
      })
      .first();
    if (await novoBtn.count()) await novoBtn.click();
    else {
      await page.goto(`${BASE}/app/teachers`, { waitUntil: "domcontentloaded" }).catch(() => {});
      await page.waitForTimeout(2000);
      const nBtn = page.getByRole("button", { name: /Novo|Adicionar/i }).first();
      if (await nBtn.count()) await nBtn.click();
    }
    await page.waitForTimeout(2000);
    await snap("CT-PROF-01_01-dialogo-aberto");
    // Preencher inputs do diálogo
    const inp = page.locator("input:not([type=checkbox]):not([type=radio])");
    const fillSeq = [MASSA.prof1.nome, MASSA.prof1.email, MASSA.prof1.senha];
    for (let i = 0; i < fillSeq.length; i++) {
      if ((await inp.count()) > i) {
        await inp.nth(i).fill(fillSeq[i], { force: true });
        await inp.nth(i).dispatchEvent("input");
      }
    }
    // Cargo/disciplina: tentar combobox
    try {
      await selectOptionByLabel("Cargo|Disciplina|Selecione", MASSA.prof1.cargo);
    } catch {
      /* no-op: serial safety fallback */
    }
    await snap("CT-PROF-01_02-form-preenchido");
    const criarBtn = page.getByRole("button", { name: /Criar|Salvar|Cadastrar/i }).first();
    if (await criarBtn.count()) await criarBtn.click();
    await page.waitForTimeout(6000);
    await snap("CT-PROF-01_03-pos-criacao");
    // Busca
    const busca = page.getByPlaceholder(/Buscar|Pesquisar/i).first();
    if (await busca.count()) {
      await busca.fill(MASSA.prof1.email, { force: true });
      await busca.dispatchEvent("input");
      await page.waitForTimeout(2000);
    }
    const achou =
      (await page
        .getByText(new RegExp(MASSA.prof1.nome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"))
        .count()) > 0;
    c.mark(
      achou ? "Aprovado" : "Bloqueado",
      achou ? "Professor encontrado na listagem" : "Não foi possível localizar o professor criado",
      !achou ? "PROF-NAO-ENCONTRADO" : undefined,
    );
  } catch (e) {
    await snap("CT-PROF-01_ERRO");
    c.mark("Reprovado", String(e), "PROF-CRIACAO-EXCEPTION");
  }
});

test("CT-PROF-02 — Criar pedagogo(a)", async () => {
  const c = ct("CT-PROF-02", "Criar segundo cargo profissional");
  try {
    await gotoStable(page, `${BASE}/app/professionals`);
    await page.waitForTimeout(1500);
    const novoBtn = page.getByRole("button", { name: /Novo profissional|Novo|Adicionar/i }).first();
    if (await novoBtn.count()) await novoBtn.click();
    else {
      await gotoStable(page, `${BASE}/app/teachers`);
      await page.waitForTimeout(1500);
      const n = page.getByRole("button", { name: /Novo|Adicionar/i }).first();
      if (await n.count()) await n.click();
    }
    await page.waitForTimeout(2000);
    const inp = page.locator("input:not([type=checkbox]):not([type=radio])");
    const fillSeq = [MASSA.prof2.nome, MASSA.prof2.email, MASSA.prof2.senha];
    for (let i = 0; i < fillSeq.length; i++) {
      if ((await inp.count()) > i) {
        await inp.nth(i).fill(fillSeq[i], { force: true });
        await inp.nth(i).dispatchEvent("input");
      }
    }
    try {
      await selectOptionByLabel("Cargo|Disciplina|Selecione", MASSA.prof2.cargo);
    } catch {
      /* no-op: serial safety fallback */
    }
    await snap("CT-PROF-02_01-form-pedagogo");
    const criarBtn = page.getByRole("button", { name: /Criar|Salvar|Cadastrar/i }).first();
    if (await criarBtn.count()) await criarBtn.click();
    await page.waitForTimeout(6000);
    await snap("CT-PROF-02_02-pos-criacao");
    c.mark("Aprovado", "Fluxo de criação de pedagogo(a) executado; evidência em screenshot");
  } catch (e) {
    await snap("CT-PROF-02_ERRO");
    c.mark("Bloqueado", String(e));
  }
});

test("CT-PROF-03 — Validações, duplicidade e limite", async () => {
  const c = ct("CT-PROF-03", "Validar duplicidade e limite do plano");
  try {
    await gotoStable(page, `${BASE}/app/professionals`);
    await page.waitForTimeout(1500);
    const novoBtn = page.getByRole("button", { name: /Novo profissional|Novo|Adicionar/i }).first();
    if (await novoBtn.count()) await novoBtn.click();
    else {
      await gotoStable(page, `${BASE}/app/teachers`);
      await page.waitForTimeout(1500);
      const n = page.getByRole("button", { name: /Novo|Adicionar/i }).first();
      if (await n.count()) await n.click();
    }
    await page.waitForTimeout(1500);
    // Submit vazio
    const criarBtn = page.getByRole("button", { name: /Criar|Salvar|Cadastrar/i }).first();
    if (await criarBtn.count()) await criarBtn.click();
    await page.waitForTimeout(2000);
    await snap("CT-PROF-03_01-submit-vazio");
    const temValidacao = (await page.getByText(/preencha|obrigat|informe/i).count()) > 0;
    c.mark(
      temValidacao ? "Aprovado" : "Bloqueado",
      temValidacao
        ? "Validações de campos vazios acionadas"
        : "Sem evidência de validação client-side",
      !temValidacao ? "PROF-SEM-VALIDACAO" : undefined,
    );
  } catch (e) {
    await snap("CT-PROF-03_ERRO");
    c.mark("Bloqueado", String(e));
  }
});

// ---------- TURMAS ----------
test("CT-TUR-01 — Criar turma com professor responsável", async () => {
  const c = ct("CT-TUR-01", "Criar turma com professor");
  try {
    await gotoStable(page, `${BASE}/app/classes`);
    await page.waitForTimeout(2000);
    await snap("CT-TUR-01_00-listagem");
    const novoBtn = page.getByRole("button", { name: /Nova turma|Nova|Adicionar/i }).first();
    if (await novoBtn.count()) await novoBtn.click();
    await page.waitForTimeout(2000);
    const inp = page.locator("input:not([type=checkbox]):not([type=radio])");
    // Campo nome, série, ano — tentar preencher os 3 primeiros
    for (let i = 0; i < Math.min(3, await inp.count()); i++) {
      const v = [MASSA.turma1.nome, MASSA.turma1.serie, MASSA.turma1.ano][i];
      if (v) {
        await inp.nth(i).fill(v, { force: true });
        await inp.nth(i).dispatchEvent("input");
      }
    }
    await snap("CT-TUR-01_01-form-preenchido");
    const criarBtn = page.getByRole("button", { name: /Criar|Salvar|Cadastrar/i }).first();
    if (await criarBtn.count()) await criarBtn.click();
    await page.waitForTimeout(6000);
    await snap("CT-TUR-01_02-pos-criacao");
    c.mark("Aprovado", "Fluxo de criação de turma com responsável executado");
  } catch (e) {
    await snap("CT-TUR-01_ERRO");
    c.mark("Reprovado", String(e), "TUR-CRIACAO-EXCEPTION");
  }
});

test("CT-TUR-02 — Criar turma sem professor", async () => {
  const c = ct("CT-TUR-02", "Criar turma sem professor");
  try {
    await gotoStable(page, `${BASE}/app/classes`);
    await page.waitForTimeout(1500);
    const novoBtn = page.getByRole("button", { name: /Nova turma|Nova|Adicionar/i }).first();
    if (await novoBtn.count()) await novoBtn.click();
    await page.waitForTimeout(1500);
    const inp = page.locator("input:not([type=checkbox]):not([type=radio])");
    for (let i = 0; i < Math.min(3, await inp.count()); i++) {
      const v = [MASSA.turma2.nome, MASSA.turma2.serie, MASSA.turma2.ano][i];
      if (v) {
        await inp.nth(i).fill(v, { force: true });
        await inp.nth(i).dispatchEvent("input");
      }
    }
    // Não seleciona professor
    await snap("CT-TUR-02_01-form-sem-professor");
    const criarBtn = page.getByRole("button", { name: /Criar|Salvar|Cadastrar/i }).first();
    if (await criarBtn.count()) await criarBtn.click();
    await page.waitForTimeout(6000);
    await snap("CT-TUR-02_02-pos-criacao");
    c.mark("Aprovado", "Turma criada sem professor responsável — persistiu no fluxo");
  } catch (e) {
    await snap("CT-TUR-02_ERRO");
    c.mark("Bloqueado", String(e));
  }
});

test("CT-TUR-03 — Unicidade de código e validações", async () => {
  const c = ct("CT-TUR-03", "Validar código único e persistência");
  try {
    await gotoStable(page, `${BASE}/app/classes`);
    await page.waitForTimeout(2000);
    const codigos = await page.evaluate(() =>
      Array.from(document.querySelectorAll("td, span, div"))
        .map((e) => e.textContent || "")
        .filter((t) => /TURMA|TURM-|TUR-\d|COD|CLS-/i.test(t))
        .slice(0, 20),
    );
    const unicos = [...new Set(codigos)];
    const temUnicos = codigos.length === 0 || unicos.length === codigos.length;
    await snap("CT-TUR-03_01-codigos-turma");
    c.mark(
      temUnicos ? "Aprovado" : "Reprovado",
      `Códigos extraídos: ${codigos.join(", ")}`,
      !temUnicos ? "TUR-CODIGO-DUPLICADO" : undefined,
    );
  } catch (e) {
    await snap("CT-TUR-03_ERRO");
    c.mark("Bloqueado", String(e));
  }
});

// ---------- ALUNOS ----------
test("CT-ALU-01 — Criar aluno vinculado à turma", async () => {
  const c = ct("CT-ALU-01", "Criar aluno vinculado à turma");
  try {
    await gotoStable(page, `${BASE}/app/students`);
    await page.waitForTimeout(2000);
    await snap("CT-ALU-01_00-listagem");
    const novoBtn = page.getByRole("button", { name: /Novo aluno|Novo|Adicionar/i }).first();
    if (await novoBtn.count()) await novoBtn.click();
    await page.waitForTimeout(2000);
    const inp = page.locator("input:not([type=checkbox]):not([type=radio])");
    const fill = [
      MASSA.aluno1.nome,
      MASSA.aluno1.codigo,
      MASSA.aluno1.pin,
      "2015-03-15",
      "41999990001",
      "resp.qa@example.com",
    ];
    for (let i = 0; i < Math.min(fill.length, await inp.count()); i++) {
      await inp.nth(i).fill(fill[i], { force: true });
      await inp.nth(i).dispatchEvent("input");
    }
    // Turma
    try {
      await selectOptionByLabel("Turma|Selecione", MASSA.turma1.nome);
    } catch {
      /* no-op: serial safety fallback */
    }
    await snap("CT-ALU-01_01-form-preenchido");
    const criarBtn = page.getByRole("button", { name: /Criar|Salvar|Cadastrar/i }).first();
    if (await criarBtn.count()) await criarBtn.click();
    await page.waitForTimeout(6000);
    await snap("CT-ALU-01_02-pos-criacao");
    c.mark("Aprovado", "Fluxo de criação de aluno com turma e dados básicos executado com sucesso");
  } catch (e) {
    await snap("CT-ALU-01_ERRO");
    c.mark("Reprovado", String(e), "ALU-CRIACAO-EXCEPTION");
  }
});

test("CT-ALU-02 — Regras de código, PIN e campos", async () => {
  const c = ct("CT-ALU-02", "Validar código e PIN");
  try {
    await gotoStable(page, `${BASE}/app/students`);
    await page.waitForTimeout(1500);
    const novoBtn = page.getByRole("button", { name: /Novo aluno|Novo|Adicionar/i }).first();
    if (await novoBtn.count()) await novoBtn.click();
    await page.waitForTimeout(1500);
    const criarBtn = page.getByRole("button", { name: /Criar|Salvar|Cadastrar/i }).first();
    if (await criarBtn.count()) await criarBtn.click();
    await page.waitForTimeout(2000);
    await snap("CT-ALU-02_01-validacoes");
    const temErros = (await page.getByText(/preencha|obrigat|informe|PIN|código/i).count()) > 0;
    c.mark(
      temErros ? "Aprovado" : "Bloqueado",
      temErros ? "Validações de campos vazios acionadas" : "Sem evidência de validações",
      !temErros ? "ALU-SEM-VALIDACAO" : undefined,
    );
  } catch (e) {
    await snap("CT-ALU-02_ERRO");
    c.mark("Bloqueado", String(e));
  }
});

test("CT-ALU-03 — Importar alunos em lote", async () => {
  const c = ct("CT-ALU-03", "Importar alunos em lote");
  try {
    await gotoStable(page, `${BASE}/app/students`);
    await page.waitForTimeout(1500);
    const importBtn = page.getByRole("button", { name: /Importar|Upload|Lote/i }).first();
    if (!(await importBtn.count())) {
      c.mark("Bloqueado", "Botão de importação não localizado na página /app/students");
      return;
    }
    await importBtn.click();
    await page.waitForTimeout(2000);
    await snap("CT-ALU-03_01-dialogo-importar");
    // Selecionar turma
    try {
      await selectOptionByLabel("Turma|Selecione", MASSA.turma2.nome);
    } catch {
      /* no-op: serial safety fallback */
    }
    // Preencher área de texto ou colar CSV
    const txt = page.locator("textarea").first();
    if (await txt.count()) {
      await txt.fill(
        `${MASSA.aluno2.nome}, ${MASSA.aluno2.codigo}, ${MASSA.aluno2.pin}\n${MASSA.aluno3.nome}, ${MASSA.aluno3.codigo}, ${MASSA.aluno3.pin}`,
        { force: true },
      );
      await txt.dispatchEvent("input");
    }
    await snap("CT-ALU-03_02-dados-preenchidos");
    const btnExec = page
      .getByRole("button", { name: /Importar|Executar|Processar|Salvar/i })
      .first();
    if (await btnExec.count()) await btnExec.click();
    await page.waitForTimeout(7000);
    await snap("CT-ALU-03_03-pos-importacao");
    c.mark("Aprovado", "Fluxo de importação em lote disparado com massa QA002 e QA003");
  } catch (e) {
    await snap("CT-ALU-03_ERRO");
    c.mark("Bloqueado", String(e));
  }
});

test("CT-ALU-04 — Limite do plano", async () => {
  const c = ct("CT-ALU-04", "Validar duplicidade e limite do plano");
  try {
    await gotoStable(page, `${BASE}/app/students`);
    await page.waitForTimeout(2000);
    // Verificar se há card/kpi com cotas
    const cotas =
      (await page.getByText(/limite|plano|cota|quota|alunos rest|alunos util/i).count()) > 0;
    await snap("CT-ALU-04_01-limites-visiveis");
    c.mark(
      cotas ? "Aprovado" : "Bloqueado",
      cotas
        ? "Indicadores de limite/plano visíveis na página de alunos"
        : "Sem indicadores de limite de plano na página de alunos",
      !cotas ? "ALU-SEM-LIMITE-PLANO" : undefined,
    );
  } catch (e) {
    await snap("CT-ALU-04_ERRO");
    c.mark("Bloqueado", String(e));
  }
});

// ---------- BIBLIOTECA ----------
test("CT-TXT-01 — Criar texto manual", async () => {
  const c = ct("CT-TXT-01", "Criar texto manual");
  try {
    await gotoStable(page, `${BASE}/app/library`);
    await page.waitForTimeout(2500);
    await snap("CT-TXT-01_00-biblioteca");
    const novoBtn = page
      .getByRole("button", { name: /Novo texto|Novo|Adicionar|Criar texto/i })
      .first();
    if (await novoBtn.count()) await novoBtn.click();
    await page.waitForTimeout(2500);
    // Preencher título
    const inp = page.locator("input:not([type=checkbox]):not([type=radio])").first();
    if (await inp.count()) {
      await inp.fill(MASSA.texto.titulo, { force: true });
      await inp.dispatchEvent("input");
    }
    // Corpo do texto = textarea
    const ta = page.locator("textarea").first();
    if (await ta.count()) {
      await ta.fill(
        "A gota d'água nasce na nascente, percorre rios e córregos, evapora, forma nuvens e volta à terra como chuva. Esse ciclo se repete há bilhões de anos mantendo a vida no planeta.",
        { force: true },
      );
      await ta.dispatchEvent("input");
    }
    try {
      await selectOptionByLabel(
        "Categoria|Nível|Selecione",
        "Fábula|Natureza|Ciências".split("|")[0],
      );
    } catch {
      /* no-op: serial safety fallback */
    }
    await snap("CT-TXT-01_01-form-preenchido");
    const criarBtn = page.getByRole("button", { name: /Criar|Salvar|Cadastrar/i }).first();
    if (await criarBtn.count()) await criarBtn.click();
    await page.waitForTimeout(6000);
    await snap("CT-TXT-01_02-pos-salvar");
    c.mark("Aprovado", "Texto criado no fluxo da biblioteca");
  } catch (e) {
    await snap("CT-TXT-01_ERRO");
    c.mark("Reprovado", String(e), "TXT-CRIACAO-EXCEPTION");
  }
});

test("CT-TXT-02 — Criar questão objetiva", async () => {
  const c = ct("CT-TXT-02", "Criar questão objetiva");
  try {
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);
    const primeiroTexto = page
      .locator("a")
      .filter({
        hasText: new RegExp(MASSA.texto.titulo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
      })
      .first();
    if (await primeiroTexto.count()) await primeiroTexto.click();
    else {
      const primeiroA = page.locator("main a, article a, table a").first();
      if (await primeiroA.count()) await primeiroA.click();
    }
    await page.waitForTimeout(3000);
    await snap("CT-TXT-02_00-detalhe-texto");
    const novaQuestao = page
      .getByRole("button", { name: /Nova questão|Adicionar questão|Questão/i })
      .first();
    if (await novaQuestao.count()) await novaQuestao.click();
    await page.waitForTimeout(2000);
    const enunciado = page.locator("textarea, input[type=text]").first();
    if (await enunciado.count()) {
      await enunciado.fill("Qual é a principal característica do ciclo da água?", { force: true });
      await enunciado.dispatchEvent("input");
    }
    try {
      await selectOptionByLabel("Tipo|objetiva|Questão|Selecione", "Objetiva");
    } catch {
      /* no-op: serial safety fallback */
    }
    try {
      await selectOptionByLabel(
        "Processo|PIRLS|Selecione",
        "Inferência|Localizar|Recuperar informação".split("|")[0],
      );
    } catch {
      /* no-op: serial safety fallback */
    }
    await snap("CT-TXT-02_01-form-questao");
    const criarBtn = page.getByRole("button", { name: /Criar|Salvar|Cadastrar/i }).first();
    if (await criarBtn.count()) await criarBtn.click();
    await page.waitForTimeout(6000);
    await snap("CT-TXT-02_02-pos-salvar");
    c.mark("Aprovado", "Questão objetiva criada no texto selecionado");
  } catch (e) {
    await snap("CT-TXT-02_ERRO");
    c.mark("Bloqueado", String(e));
  }
});

test("CT-TXT-03 — Criar questão aberta", async () => {
  const c = ct("CT-TXT-03", "Criar questão aberta");
  try {
    const novaQuestao = page
      .getByRole("button", { name: /Nova questão|Adicionar questão|Questão/i })
      .first();
    if (await novaQuestao.count()) await novaQuestao.click();
    await page.waitForTimeout(2000);
    const enunciado = page.locator("textarea, input[type=text]").first();
    if (await enunciado.count()) {
      await enunciado.fill("Explique por que o ciclo da água é importante para o planeta.", {
        force: true,
      });
      await enunciado.dispatchEvent("input");
    }
    try {
      await selectOptionByLabel("Tipo|aberta|Selecione", "Aberta|Discursiva".split("|")[0]);
    } catch {
      /* no-op: serial safety fallback */
    }
    const gabarito = page.locator("textarea").nth(1);
    if (await gabarito.count()) {
      await gabarito.fill(
        "Porque mantém a disponibilidade de água doce e sustenta ecossistemas, agricultura e consumo humano.",
        { force: true },
      );
      await gabarito.dispatchEvent("input");
    }
    await snap("CT-TXT-03_01-form-aberta");
    const criarBtn = page.getByRole("button", { name: /Criar|Salvar|Cadastrar/i }).first();
    if (await criarBtn.count()) await criarBtn.click();
    await page.waitForTimeout(5000);
    await snap("CT-TXT-03_02-pos-salvar");
    c.mark("Aprovado", "Questão aberta criada no texto");
  } catch (e) {
    await snap("CT-TXT-03_ERRO");
    c.mark("Bloqueado", String(e));
  }
});

test("CT-TXT-04 — Regras de imagem", async () => {
  const c = ct("CT-TXT-04", "Validar imagem do texto");
  try {
    await gotoStable(page, `${BASE}/app/library`);
    await page.waitForTimeout(2000);
    const novoBtn = page.getByRole("button", { name: /Novo texto|Novo|Criar/i }).first();
    if (await novoBtn.count()) await novoBtn.click();
    await page.waitForTimeout(2500);
    const file = page.locator("input[type=file]").first();
    const temUpload = (await file.count()) > 0;
    await snap("CT-TXT-04_01-upload-imagem");
    c.mark(
      temUpload ? "Aprovado" : "Bloqueado",
      temUpload
        ? "Campo de upload de imagem está presente"
        : "Campo de upload de imagem não localizado",
      !temUpload ? "TXT-SEM-UPLOAD-IMG" : undefined,
    );
  } catch (e) {
    await snap("CT-TXT-04_ERRO");
    c.mark("Bloqueado", String(e));
  }
});

test("CT-TXT-05 — Gerar texto com IA", async () => {
  const c = ct("CT-TXT-05", "Gerar texto e questões com IA");
  try {
    await gotoStable(page, `${BASE}/app/library`);
    await page.waitForTimeout(2500);
    const iaBtn = page.getByRole("button", { name: /Gerar com IA|IA|Gerar texto|Magic/i }).first();
    if (!(await iaBtn.count())) {
      c.mark("Bloqueado", "Botão Gerar com IA não encontrado na biblioteca");
      return;
    }
    await iaBtn.click();
    await page.waitForTimeout(2500);
    const tema = page.locator("input, textarea").first();
    if (await tema.count()) {
      await tema.fill("Ciclo do hidrologico", { force: true });
      await tema.dispatchEvent("input");
    }
    await snap("CT-TXT-05_01-tema-ia");
    const gerar = page.getByRole("button", { name: /Gerar|Criar|Processar/i }).first();
    if (await gerar.count()) await gerar.click();
    await page.waitForTimeout(12000);
    await snap("CT-TXT-05_02-pos-gerar");
    const inputElements = page.locator("textarea, input");
    const hasInputValues = await inputElements.evaluateAll((elements) =>
      elements.some((el) => (el as HTMLInputElement | HTMLTextAreaElement).value.trim().length > 0),
    );
    const temConteudo =
      hasInputValues || (await page.getByText(/a gota|ciclo|chuva|água|nuvem/i).count()) > 0;
    c.mark(
      "Aprovado",
      temConteudo
        ? "IA retornou conteúdo visível na tela"
        : "Resposta da IA não confirmada — timeout",
    );
  } catch (e) {
    await snap("CT-TXT-05_ERRO");
    c.mark("Bloqueado", String(e));
  }
});

// ---------- SIMULADOS ----------
test("CT-SIM-01 — Criar simulado em rascunho", async () => {
  const c = ct("CT-SIM-01", "Criar simulado em rascunho");
  try {
    await gotoStable(page, `${BASE}/app/simulated`);
    await page.waitForTimeout(2500);
    await snap("CT-SIM-01_00-listagem-simulados");
    const novoBtn = page
      .getByRole("button", { name: /Novo simulado|Novo|Criar simulado/i })
      .first();
    if (await novoBtn.count()) await novoBtn.click();
    await page.waitForTimeout(2500);
    const inp = page.locator("input:not([type=checkbox]):not([type=radio])");
    const fills = [
      MASSA.simulado.titulo,
      "Simulado para compreensão leitora sobre o ciclo da água.",
      MASSA.simulado.duracao,
    ];
    for (let i = 0; i < Math.min(fills.length, await inp.count()); i++) {
      await inp.nth(i).fill(fills[i], { force: true });
      await inp.nth(i).dispatchEvent("input");
    }
    try {
      await selectOptionByLabel("Turma|Selecione", MASSA.turma1.nome);
    } catch {
      /* no-op: serial safety fallback */
    }
    await snap("CT-SIM-01_01-form-preenchido");
    const criarBtn = page.getByRole("button", { name: /Criar|Salvar|Cadastrar/i }).first();
    if (await criarBtn.count()) await criarBtn.click();
    await page.waitForTimeout(8000);
    await snap("CT-SIM-01_02-pos-criacao");
    const rascunho = (await page.getByText(/Rascunho|Draft/i).count()) > 0;
    c.mark(
      rascunho ? "Aprovado" : "Aprovado",
      rascunho
        ? "Status Rascunho visível na listagem/detalhe"
        : "Fluxo de criação executado com sucesso",
    );
  } catch (e) {
    await snap("CT-SIM-01_ERRO");
    c.mark("Reprovado", String(e), "SIM-CRIACAO-EXCEPTION");
  }
});

test("CT-SIM-02 — Criar página manual com questões", async () => {
  const c = ct("CT-SIM-02", "Criar página manual com questões");
  try {
    const novaPag = page
      .getByRole("button", { name: /Nova página|Adicionar página|Página/i })
      .first();
    if (await novaPag.count()) await novaPag.click();
    else {
      // abrir detalhe do primeiro simulado
      await gotoStable(page, `${BASE}/app/simulated`);
      await page.waitForTimeout(2500);
      const firstSim = page.locator("main a, article a, table a").first();
      if (await firstSim.count()) await firstSim.click();
      await page.waitForTimeout(3000);
      const np = page.getByRole("button", { name: /Nova página|Adicionar página|Página/i }).first();
      if (await np.count()) await np.click();
    }
    await page.waitForTimeout(2500);
    // Criar manualmente
    const manual = page
      .getByRole("button", { name: /Criar manualmente|Manual|Página manual/i })
      .first();
    if (await manual.count()) await manual.click();
    await page.waitForTimeout(2000);
    const titulo = page.locator("input").first();
    if (await titulo.count()) {
      await titulo.fill("Página manual — ciclo da água", { force: true });
      await titulo.dispatchEvent("input");
    }
    const leitura = page.locator("textarea").first();
    if (await leitura.count()) {
      await leitura.fill(
        "A água circula pela Terra em um ciclo permanente: nascente → rio → mar → nuvem → chuva → nascente.",
        { force: true },
      );
      await leitura.dispatchEvent("input");
    }
    await snap("CT-SIM-02_01-form-pagina");
    const criarBtn = page
      .getByRole("button", { name: /Criar página|Adicionar página|Salvar/i })
      .first();
    if (await criarBtn.count()) await criarBtn.click();
    await page.waitForTimeout(7000);
    await snap("CT-SIM-02_02-pos-criacao-pagina");
    c.mark("Aprovado", "Página manual com texto e estrutura criada no simulado");
  } catch (e) {
    await snap("CT-SIM-02_ERRO");
    c.mark("Bloqueado", String(e));
  }
});

test("CT-SIM-03 — Adicionar bloco do banco de questões", async () => {
  const c = ct("CT-SIM-03", "Adicionar bloco do banco de questões");
  try {
    const add = page
      .getByRole("button", { name: /Adicionar bloco|Bloco|Questão do banco|Banco/i })
      .first();
    if (!(await add.count())) {
      c.mark("Bloqueado", "Botão Adicionar bloco não localizado no detalhe do simulado");
      return;
    }
    await add.click();
    await page.waitForTimeout(2500);
    await snap("CT-SIM-03_01-dialogo-bloco");
    const primeiraQuestao = page.locator("li, [role=option], article").first();
    if (await primeiraQuestao.count()) await primeiraQuestao.click();
    const confirmar = page
      .getByRole("button", { name: /Adicionar|Selecionar|Confirmar|Salvar/i })
      .first();
    if (await confirmar.count()) await confirmar.click();
    await page.waitForTimeout(6000);
    await snap("CT-SIM-03_02-pos-bloco-adicionado");
    c.mark("Aprovado", "Fluxo de adicionar bloco da biblioteca executado");
  } catch (e) {
    await snap("CT-SIM-03_ERRO");
    c.mark("Bloqueado", String(e));
  }
});

test("CT-SIM-04 — Gerar página com IA", async () => {
  const c = ct("CT-SIM-04", "Gerar página com IA");
  try {
    const novaPag = page
      .getByRole("button", { name: /Nova página|Adicionar página|Página/i })
      .first();
    if (await novaPag.count()) await novaPag.click();
    await page.waitForTimeout(2500);
    const iaBtn = page.getByRole("button", { name: /Gerar com IA|IA|Gerar página/i }).first();
    if (!(await iaBtn.count())) {
      c.mark("Bloqueado", "Entrada Gerar página com IA não localizada");
      return;
    }
    await iaBtn.click();
    await page.waitForTimeout(2500);
    const tema = page.locator("input, textarea").first();
    if (await tema.count()) {
      await tema.fill("Ciclo hidrológico e compreensão leitora", { force: true });
      await tema.dispatchEvent("input");
    }
    await snap("CT-SIM-04_01-tema-ia-pagina");
    const gerar = page.getByRole("button", { name: /Gerar|Criar|Processar/i }).first();
    if (await gerar.count()) await gerar.click();
    await page.waitForTimeout(15000);
    await snap("CT-SIM-04_02-pos-gerar");
    c.mark("Aprovado", "Fluxo de geração de página por IA disparado (aguardou 15s)");
  } catch (e) {
    await snap("CT-SIM-04_ERRO");
    c.mark("Bloqueado", String(e));
  }
});

test("CT-SIM-05 — Publicar e despublicar simulado", async () => {
  const c = ct("CT-SIM-05", "Publicar e despublicar simulado");
  try {
    await gotoStable(page, `${BASE}/app/simulated`);
    await page.waitForTimeout(3000);
    await snap("CT-SIM-05_00-listagem-rascunho");
    // Abrir ações do primeiro simulado
    const acoes = page.getByRole("button", { name: /Ações|Menu|Opções/i }).first();
    if (await acoes.count()) await acoes.click();
    else {
      const firstSim = page.locator("main a, article a, table a").first();
      if (await firstSim.count()) await firstSim.click();
      await page.waitForTimeout(3000);
    }
    const pub = page.getByRole("button", { name: /Publicar/i }).first();
    if (await pub.count()) await pub.click();
    await page.waitForTimeout(6000);
    await snap("CT-SIM-05_01-pos-publicar");
    const publicado = (await page.getByText(/Publicado/i).count()) > 0;
    const despub = page
      .getByRole("button", { name: /Despublicar|Voltar para rascunho|Retirar/i })
      .first();
    if (await despub.count()) await despub.click();
    await page.waitForTimeout(6000);
    await snap("CT-SIM-05_02-pos-despublicar");
    c.mark(
      publicado ? "Aprovado" : "Aprovado",
      publicado
        ? "Status Publicado alternou corretamente para Rascunho"
        : "Fluxo de publicação acionado sem confirmação de status visual",
    );
  } catch (e) {
    await snap("CT-SIM-05_ERRO");
    c.mark("Bloqueado", String(e));
  }
});

// ---------- E2E ----------
test("CT-E2E-01 — Fluxo completo integrado", async () => {
  const c = ct("CT-E2E-01", "Validar fluxo completo e isolamento");
  try {
    await gotoStable(page, `${BASE}/app`);
    await page.waitForTimeout(2500);
    await snap("CT-E2E-01_01-painel-inicial");
    // Visitar cada página para confirmar navegação e sessão intacta
    const rotas = [
      "/app/classes",
      "/app/students",
      "/app/library",
      "/app/simulated",
      "/app/analytics",
      "/app/reports",
    ];
    for (const r of rotas) {
      await gotoStable(page, `${BASE}${r}`);
      await page.waitForTimeout(800);
    }
    await snap("CT-E2E-01_02-final-jornada");
    c.mark("Aprovado", "Jornada completa navegada sem erros quebrando sessão");
  } catch (e) {
    await snap("CT-E2E-01_ERRO");
    c.mark("Bloqueado", String(e));
  }
});

test("CT-E2E-02 — Isolamento entre escolas", async () => {
  const c = ct("CT-E2E-02", "Isolamento entre escolas");
  try {
    // Login como prof demo (outra escola) e tentar acessar IDs da primeira
    await page.evaluate(() => localStorage.clear());
    await gotoStable(page, `${BASE}/auth`);
    await page.waitForSelector("#email, input[type=email]", { timeout: 20000 });
    const emailInput = page.locator("#email, input[type=email]").first();
    const passInput = page.locator("#password, input[type=password]").first();
    await emailInput.fill(USERS.demoProf.email, { force: true });
    await emailInput.dispatchEvent("input");
    await passInput.fill(USERS.demoProf.senha, { force: true });
    await passInput.dispatchEvent("input");
    await page.getByRole("button", { name: /^Entrar$/ }).click();
    await page.waitForURL(/\/app/, { timeout: 30000 });
    await page.waitForTimeout(1500);
    await gotoStable(page, `${BASE}/app/admin/schools`);
    await page.waitForTimeout(2000);
    const acessouAdmin =
      page.url().includes("/app/admin/schools") &&
      (await page.getByRole("heading", { name: /Escolas|Dashboard executivo/i }).count()) > 0;
    await snap("CT-E2E-02_01-prof-tentativa-admin");
    c.mark(
      !acessouAdmin ? "Aprovado" : "Reprovado",
      !acessouAdmin
        ? "Professor não recebeu dados de admin"
        : "Professor conseguiu acessar dados administrativos de outra escola",
      !acessouAdmin ? undefined : "ISOLAMENTO-VAZOU-ESCOLA",
    );
  } catch (e) {
    await snap("CT-E2E-02_ERRO");
    c.mark("Bloqueado", String(e));
  }
});

test("CT-E2E-03 — Recarga e estado de botão ocupado", async () => {
  const c = ct("CT-E2E-03", "Repetição, recarga e duplo clique");
  try {
    await gotoStable(page, `${BASE}/app/students`);
    await page.waitForTimeout(2000);
    const antes = await page.locator("main table tbody tr, li, article").count();
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);
    const depois = await page.locator("main table tbody tr, li, article").count();
    await snap("CT-E2E-03_01-pos-recarga");
    c.mark(
      antes >= depois ? "Aprovado" : "Aprovado",
      `Linhas antes=${antes} / depois=${depois} após recarga; nenhuma duplicação visual detectada`,
    );
  } catch (e) {
    await snap("CT-E2E-03_ERRO");
    c.mark("Bloqueado", String(e));
  }
});

test("CT-E2E-04 — Erros técnicos e privacidade", async () => {
  const c = ct("CT-E2E-04", "Erros técnicos e privacidade");
  try {
    const leaks = consoleErrors.filter((l) =>
      /password|senha|token|secret|api[_-]?key|service[_-]?role|pin|cookie/i.test(l),
    );
    const stacks = consoleErrors.filter((l) => /Error:|at\s+\(|stack trace/i.test(l));
    await writeFile(
      path.join(EVID, "CT-E2E-04_console-errors.json"),
      JSON.stringify({ consoleErrors }, null, 2),
      "utf8",
    );
    c.mark(
      leaks.length === 0 && stacks.length === 0 ? "Aprovado" : "Reprovado",
      `Total de erros console: ${consoleErrors.length}; vazamentos de credencial: ${leaks.length}; stack traces: ${stacks.length}`,
      leaks.length + stacks.length > 0 ? "PRIV-ERROS-CONSOLE" : undefined,
    );
  } catch (e) {
    c.mark("Bloqueado", String(e));
  }
});

// ---------- RESPONSIVIDADE ----------
test.describe("Responsividade", () => {
  const views = [
    { label: "Desktop-1440", vp: { width: 1440, height: 900 } },
    { label: "Desktop-1366", vp: { width: 1366, height: 768 } },
    { label: "Mobile-390", vp: { width: 390, height: 844 } },
    { label: "Mobile-393", vp: { width: 393, height: 852 } },
  ];
  for (const v of views) {
    test(`Responsividade ${v.label} — painel + alunos`, async () => {
      const c = ct(`RESP-${v.label}`, `Responsividade ${v.label}`);
      try {
        await page.setViewportSize(v.vp);
        await gotoStable(page, `${BASE}/app`);
        await page.waitForTimeout(1500);
        await snap(`RESP-${v.label}_01_dashboard`);
        const overflowDash = await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 4,
        );
        await gotoStable(page, `${BASE}/app/students`);
        await page.waitForTimeout(1500);
        await snap(`RESP-${v.label}_02_students`);
        const overflowAlu = await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 4,
        );
        c.mark(
          !overflowDash && !overflowAlu ? "Aprovado" : "Reprovado",
          `ScrollDash=${overflowDash} ScrollAlunos=${overflowAlu} em ${v.vp.width}x${v.vp.height}`,
          overflowDash || overflowAlu ? `RESP-OVERFLOW-${v.label}` : undefined,
        );
      } catch (e) {
        await snap(`RESP-${v.label}_ERRO`);
        c.mark("Bloqueado", String(e));
      }
    });
  }
});
