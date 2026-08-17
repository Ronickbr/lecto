import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { supabase } from "@/integrations/supabase/client";
import { stopImpersonation } from "@/lib/admin/impersonation";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { TriangleAlert } from "lucide-react";
import { toUserError } from "@/lib/errors/to-user-error";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-medium text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          O endereço acessado não existe ou foi movido.
        </p>
        <div className="mt-6">
          <Button asChild>
            <Link to="/">Voltar ao início</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  const friendly = toUserError(error);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <TriangleAlert className="mx-auto size-10 text-destructive" />
        <h1 className="mt-4 text-xl font-semibold text-foreground">{friendly.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{friendly.message}</p>
        {friendly.suggestion && (
          <p className="mt-1 text-sm text-muted-foreground/80">
            <span className="font-medium">Como resolver:</span> {friendly.suggestion}
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button
            onClick={() => {
              router.invalidate();
              reset();
            }}
          >
            Tentar novamente
          </Button>
          <Button variant="outline" asChild>
            <Link to="/">Início</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Lecto — Plataforma de Compreensão Leitora" },
      {
        name: "description",
        content:
          "Plataforma SaaS de simulados de compreensão leitora inspirada no ePIRLS. Multi-tenant, com IA, analytics e correção automatizada.",
      },
      { property: "og:title", content: "Lecto — Plataforma de Compreensão Leitora" },
      {
        property: "og:description",
        content:
          "Simulados PIRLS-aligned para escolas, professores e alunos. Multi-tenant, com IA e analytics.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      // Personificação de escola nunca pode sobreviver a uma troca de sessão.
      if (event !== "USER_UPDATED") stopImpersonation();
      router.invalidate();
      if (event === "SIGNED_OUT") queryClient.clear();
      else queryClient.invalidateQueries();
    });
    return () => sub.subscription.unsubscribe();
  }, [queryClient, router]);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}
