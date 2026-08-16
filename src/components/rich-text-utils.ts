export const TEXT_IMAGES_BUCKET = "text-images";

/** Markdown-ish image syntax used inside text bodies: ![legenda](storage:path | https://url) */
export const IMAGE_RE = /!\[([^\]]*)\]\(([^)\s]+)\)/g;

export type Segment = { kind: "text"; value: string } | { kind: "image"; alt: string; src: string };

export function parseTextBody(body: string): Segment[] {
  const segments: Segment[] = [];
  let last = 0;
  for (const match of body.matchAll(IMAGE_RE)) {
    const index = match.index ?? 0;
    if (index > last) segments.push({ kind: "text", value: body.slice(last, index) });
    segments.push({ kind: "image", alt: match[1] ?? "", src: match[2] ?? "" });
    last = index + match[0].length;
  }
  if (last < body.length) segments.push({ kind: "text", value: body.slice(last) });
  return segments;
}
