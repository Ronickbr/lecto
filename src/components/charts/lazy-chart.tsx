import { lazy, Suspense, type ReactNode } from "react";

export function LazyChart({
  children,
  height = "300px",
}: {
  children: ReactNode;
  height?: string;
}) {
  return (
    <div style={{ minHeight: height }} className="w-full">
      <Suspense
        fallback={
          <div
            className="w-full h-full animate-pulse bg-muted/10 rounded-xl"
            style={{ minHeight: height }}
          />
        }
      >
        {children}
      </Suspense>
    </div>
  );
}
