import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export const TEXT_IMAGES_BUCKET = "text-images";

/** Markdown-ish image syntax used inside text bodies: ![legenda](storage:path | https://url) */
const IMAGE_RE = /!\[([^\]]*)\]\(([^)\s]+)\)/g;

type Segment = { kind: "text"; value: string } | { kind: "image"; alt: string; src: string };

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

/** Clickable image that opens a full-screen modal so students can read small details. */
function ZoomableImage({ src, alt, onError }: { src: string; alt: string; onError?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Clique para ampliar"
        className="group block w-full cursor-zoom-in overflow-hidden rounded-md border border-border focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onError={onError}
          className="w-full transition-transform duration-300 group-hover:scale-[1.02]"
        />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[100vw] border-0 bg-background/95 p-2 sm:max-w-[95vw]">
          <DialogTitle className="sr-only">{alt || "Imagem do texto"}</DialogTitle>
          <div className="max-h-[90vh] overflow-auto">
            <img src={src} alt={alt} className="mx-auto h-auto w-auto max-w-none sm:max-w-full" />
          </div>
          {alt && <p className="pt-2 text-center text-xs text-muted-foreground">{alt}</p>}
        </DialogContent>
      </Dialog>
    </>
  );
}

function StorageImage({ path, alt }: { path: string; alt: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setFailed(false);
    setUrl(null);
    supabase.storage
      .from(TEXT_IMAGES_BUCKET)
      .createSignedUrl(path, 60 * 60)
      .then(({ data, error }) => {
        if (!active) return;
        if (error || !data?.signedUrl) setFailed(true);
        else setUrl(data.signedUrl);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [path]);

  // Antes, uma URL assinada com erro deixava um esqueleto pulsando para sempre.
  if (failed) {
    return (
      <div
        role="img"
        aria-label={alt ? `Imagem indisponível: ${alt}` : "Imagem indisponível"}
        className="grid h-24 w-full place-items-center rounded-md border border-dashed border-border bg-muted/40 px-3 text-center text-xs text-muted-foreground"
      >
        {alt ? `Imagem indisponível: ${alt}` : "Imagem indisponível"}
      </div>
    );
  }
  if (!url)
    return <div className="h-40 w-full animate-pulse rounded-md bg-muted" aria-hidden="true" />;
  return <ZoomableImage src={url} alt={alt} onError={() => setFailed(true)} />;
}

/** Renders a text body preserving line breaks and rendering inline images. */
export function RichTextBody({ body, className = "" }: { body: string; className?: string }) {
  const segments = parseTextBody(body ?? "");
  return (
    <div className={className}>
      {segments.map((s, i) =>
        s.kind === "text" ? (
          <span key={i} className="whitespace-pre-wrap">
            {s.value}
          </span>
        ) : (
          <figure key={i} className="my-4">
            {s.src.startsWith("storage:") ? (
              <StorageImage path={s.src.slice("storage:".length)} alt={s.alt} />
            ) : (
              <ZoomableImage src={s.src} alt={s.alt} />
            )}
            <figcaption className="mt-1 text-center text-xs text-muted-foreground">
              {s.alt ? s.alt : "Clique na imagem para ampliar"}
            </figcaption>
          </figure>
        ),
      )}
    </div>
  );
}
