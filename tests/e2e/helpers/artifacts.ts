import type { Page, TestInfo } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { OverflowReport } from "./responsive";

const EVIDENCE_DIR = path.resolve("test-results/responsive/evidence");

function slug(input: string) {
  return (
    input
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "root"
  );
}

export type Evidence = {
  screenshot?: string;
  elementShots: string[];
  dump?: string;
  video?: string;
};

/**
 * Captures screenshots (page + elemento culpado), dump do HTML/estilos dos
 * offenders e anexa tudo ao relatório para depuração rápida.
 */
export async function captureEvidence(
  page: Page,
  testInfo: TestInfo,
  opts: {
    route: string;
    breakpoint: number;
    overflow: OverflowReport;
    layoutBreaks: string[];
  },
): Promise<Evidence> {
  const base = `${slug(opts.route)}_${opts.breakpoint}`;
  await mkdir(EVIDENCE_DIR, { recursive: true });
  const evidence: Evidence = { elementShots: [] };

  // 1) Screenshot da viewport inteira.
  const shot = path.join(EVIDENCE_DIR, `${base}_page.png`);
  await page.screenshot({ path: shot }).catch(() => undefined);
  evidence.screenshot = shot;
  await testInfo.attach(`${opts.route}@${opts.breakpoint} — página`, {
    path: shot,
    contentType: "image/png",
  });

  // 2) Screenshot dos elementos culpados (marcados via data-e2e-offender).
  for (const offender of opts.overflow.offenders.slice(0, 3)) {
    const locator = page.locator(`[data-e2e-offender="${offender.index}"]`).first();
    if (!(await locator.count())) continue;
    const file = path.join(EVIDENCE_DIR, `${base}_offender-${offender.index}.png`);
    const ok = await locator.screenshot({ path: file }).then(
      () => true,
      () => false,
    );
    if (!ok) continue;
    evidence.elementShots.push(file);
    await testInfo.attach(`offender ${offender.selector}`, {
      path: file,
      contentType: "image/png",
    });
  }

  // 3) Dump textual: HTML externo + estilos computados relevantes.
  const dumps = await page.evaluate(
    (indices: number[]) => {
      const out: string[] = [];
      for (const i of indices) {
        const el = document.querySelector<HTMLElement>(`[data-e2e-offender="${i}"]`);
        if (!el) continue;
        const cs = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        const chain: string[] = [];
        let p: HTMLElement | null = el.parentElement;
        while (p && chain.length < 6) {
          chain.push(
            `${p.tagName.toLowerCase()}${p.className && typeof p.className === "string" ? "." + p.className.trim().split(/\s+/).slice(0, 4).join(".") : ""}`,
          );
          p = p.parentElement;
        }
        out.push(
          [
            `--- offender #${i} ---`,
            `tag: ${el.tagName.toLowerCase()}`,
            `class: ${typeof el.className === "string" ? el.className : ""}`,
            `rect: left=${Math.round(rect.left)} right=${Math.round(rect.right)} width=${Math.round(rect.width)}`,
            `scrollWidth=${el.scrollWidth} clientWidth=${el.clientWidth}`,
            `computed: display=${cs.display} position=${cs.position} width=${cs.width} minWidth=${cs.minWidth} maxWidth=${cs.maxWidth} overflowX=${cs.overflowX} whiteSpace=${cs.whiteSpace} flex=${cs.flex} gridTemplateColumns=${cs.gridTemplateColumns} padding=${cs.padding} margin=${cs.margin} transform=${cs.transform}`,
            `ancestors: ${chain.join(" < ")}`,
            `outerHTML: ${el.outerHTML.slice(0, 1200)}`,
            "",
          ].join("\n"),
        );
      }
      return out;
    },
    opts.overflow.offenders.slice(0, 5).map((o) => o.index),
  );

  const dumpText = [
    `Rota: ${opts.route}`,
    `Breakpoint: ${opts.breakpoint}px`,
    `URL final: ${page.url()}`,
    `Overflow: +${opts.overflow.overflowPx}px (scrollWidth=${opts.overflow.scrollWidth}, clientWidth=${opts.overflow.clientWidth})`,
    opts.layoutBreaks.length
      ? `Quebras de layout:\n- ${opts.layoutBreaks.join("\n- ")}`
      : "Quebras de layout: nenhuma",
    "",
    ...dumps,
  ].join("\n");

  const dumpFile = path.join(EVIDENCE_DIR, `${base}_dump.txt`);
  await writeFile(dumpFile, dumpText, "utf8");
  evidence.dump = dumpFile;
  await testInfo.attach(`${opts.route}@${opts.breakpoint} — dump`, {
    body: dumpText,
    contentType: "text/plain",
  });

  return evidence;
}

/** Screenshot simples anexado ao relatório (usado nos testes funcionais). */
export async function snap(page: Page, testInfo: TestInfo, name: string) {
  const file = path.join(EVIDENCE_DIR, `${slug(testInfo.title)}_${slug(name)}.png`);
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await page.screenshot({ path: file }).catch(() => undefined);
  await testInfo.attach(name, { path: file, contentType: "image/png" }).catch(() => undefined);
}
