// Cliente-seguro (sem imports de servidor): usado tanto no formulário para
// pré-visualizar o código quanto nas server functions para gerá-lo no insert.

export interface ClassCodeInput {
  name: string;
  grade?: string | null;
  academicYear?: number | null;
}

/**
 * Gera o código base da turma a partir dos dados informados, ex.:
 * nome "5º ano A", série "5º", ano 2026 -> "5A-26".
 * A unicidade é resolvida no servidor (apêndice "-1", "-2", … em colisão).
 */
export function buildClassCode({ name, grade, academicYear }: ClassCodeInput): string {
  const year = academicYear ? String(academicYear) : String(new Date().getFullYear());
  const yy = year.slice(-2);

  const gradeDigits = grade?.match(/\d+/)?.[0] ?? name.match(/\d+/)?.[0] ?? "";

  const words = name
    .replace(/[º°ª./]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  let letter = "";
  for (let i = words.length - 1; i >= 0; i -= 1) {
    const match = words[i].match(/\p{L}/u);
    if (match) {
      letter = match[0].toUpperCase();
      break;
    }
  }
  if (!letter) letter = "T";

  const core = `${gradeDigits}${letter}`.toUpperCase();
  return `${core || "TURMA"}-${yy}`;
}
