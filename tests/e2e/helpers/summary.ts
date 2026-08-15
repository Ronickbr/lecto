import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export type Entry = {
  route: string;
  label: string;
  breakpoint: number;
  finalUrl?: string;
  overflowPx: number;
  offenders: string[];
  layoutBreaks: string[];
  smallTouchTargets: string[];
  evidence?: {
    screenshot?: string;
    elementShots: string[];
    dump?: string;
  };
};

const entries: Entry[] = [];

export function record(entry: Entry) {
  entries.push(entry);
}

/**
 * Writes a human-readable responsiveness summary (markdown + json) so the
 * whole audit can be reviewed at a glance instead of scrolling test output.
 */
export async function writeSummary() {
  if (!entries.length) return;
  const outDir = path.resolve("test-results/responsive");
  await mkdir(outDir, { recursive: true });

  const routes = [...new Set(entries.map((e) => e.route))];
  const breakpoints = [...new Set(entries.map((e) => e.breakpoint))].sort((a, b) => a - b);

  const header = `| Rota | ${breakpoints.map((b) => `${b}px`).join(" | ")} |`;
  const divider = `| --- | ${breakpoints.map(() => "---").join(" | ")} |`;
  const rows = routes.map((route) => {
    const cells = breakpoints.map((bp) => {
      const e = entries.find((x) => x.route === route && x.breakpoint === bp);
      if (!e) return "–";
      if (e.overflowPx > 2) return `❌ +${e.overflowPx}px`;
      if (e.layoutBreaks.length) return "⚠️ layout";
      return "✅";
    });
    return `| \`${route}\` | ${cells.join(" | ")} |`;
  });

  const problems = entries.filter(
    (e) => e.overflowPx > 2 || e.layoutBreaks.length || e.smallTouchTargets.length,
  );

  const details = problems.length
    ? problems
        .map(
          (e) =>
            `### \`${e.route}\` @ ${e.breakpoint}px\n` +
            (e.overflowPx > 2
              ? `- Overflow horizontal: **+${e.overflowPx}px** (${e.offenders.join(", ") || "n/d"})\n`
              : "") +
            (e.layoutBreaks.length ? `- Quebras: ${e.layoutBreaks.join("; ")}\n` : "") +
            (e.smallTouchTargets.length
              ? `- Alvos de toque pequenos: ${e.smallTouchTargets.join("; ")}\n`
              : "") +
            (e.evidence
              ? `- Evidências: ${[
                  e.evidence.screenshot &&
                    `[screenshot](${path.relative(path.resolve("test-results/responsive"), e.evidence.screenshot)})`,
                  ...(e.evidence.elementShots ?? []).map(
                    (s, i) =>
                      `[elemento ${i + 1}](${path.relative(path.resolve("test-results/responsive"), s)})`,
                  ),
                  e.evidence.dump &&
                    `[dump](${path.relative(path.resolve("test-results/responsive"), e.evidence.dump)})`,
                ]
                  .filter(Boolean)
                  .join(" · ")}\n`
              : ""),
        )
        .join("\n")
    : "Nenhum problema de responsividade detectado.";

  const md = [
    "# Resumo de responsividade",
    "",
    `Gerado em ${new Date().toISOString()}`,
    `Rotas auditadas: ${routes.length} · Breakpoints: ${breakpoints.join(", ")}px`,
    "",
    header,
    divider,
    ...rows,
    "",
    "## Detalhes",
    "",
    details,
    "",
  ].join("\n");

  await writeFile(path.join(outDir, "responsive-summary.md"), md, "utf8");
  await writeFile(
    path.join(outDir, "responsive-summary.json"),
    JSON.stringify(entries, null, 2),
    "utf8",
  );
}
