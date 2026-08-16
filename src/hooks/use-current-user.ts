import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useImpersonation } from "@/lib/admin/impersonation";
import type { Database } from "@/integrations/supabase/types";
import type { Session } from "@supabase/supabase-js";

export type AppRole = Database["public"]["Enums"]["app_role"];

export interface CurrentUserData {
  userId: string;
  email: string | null;
  profile: {
    full_name: string | null;
    avatar_url: string | null;
    phone: string | null;
  } | null;
  roles: AppRole[];
  primaryRole: AppRole | null;
  schoolId: string | null;
}

/**
 * Na primeira carga o cliente Supabase pode ainda não ter restaurado a sessão
 * do localStorage (ou estar renovando o token). `getSession()` devolve `null`
 * nesse instante — por isso aguardamos brevemente o evento INITIAL_SESSION
 * antes de considerar que não há usuário.
 */
async function waitForSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session;

  return await new Promise<Session | null>((resolve) => {
    let done = false;
    const finish = (s: Session | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      sub.subscription.unsubscribe();
      resolve(s);
    };
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) finish(session);
    });
    const timer = setTimeout(async () => {
      const { data: retry } = await supabase.auth.getSession();
      finish(retry.session);
    }, 1500);
  });
}

async function fetchCurrentUser(): Promise<CurrentUserData | null> {
  const session = await waitForSession();
  const user = session?.user;
  if (!user) return null;

  try {
    const [{ data: profile, error: profileError }, { data: roles, error: rolesError }] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, avatar_url, phone")
          .eq("id", user.id)
          .maybeSingle(),
        supabase.from("user_roles").select("role, school_id").eq("user_id", user.id),
      ]);

    if (rolesError) {
      console.error("Erro ao carregar papéis do usuário:", rolesError);
      throw new Error(`Falha ao buscar papéis: ${rolesError.message}`);
    }

    if (profileError) {
      console.warn("Erro ao carregar perfil do usuário:", profileError);
    }

    const roleList = (roles ?? []).map((r) => r.role as AppRole);
    const priority: AppRole[] = ["super_admin", "school_admin", "teacher", "student"];
    const primaryRole = priority.find((p) => roleList.includes(p)) ?? null;
    const schoolId = (roles ?? []).find((r) => r.school_id)?.school_id ?? null;

    return {
      userId: user.id,
      email: user.email ?? null,
      profile: profile ?? null,
      roles: roleList,
      primaryRole,
      schoolId,
    };
  } catch (err) {
    console.error("Erro em fetchCurrentUser:", err);
    throw err;
  }
}

export function useCurrentUser() {
  const impersonation = useImpersonation();
  const query = useQuery({
    queryKey: ["current-user"],
    queryFn: fetchCurrentUser,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    retry: (failureCount, error) => {
      // Retry até 3 vezes caso a conexão ou restauração do token do Supabase falhe temporariamente no login
      return failureCount < 3;
    },
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  // Super admin "entrar como administrador da escola": mantém o papel real,
  // mas passa a resolver a escola do tenant selecionado.
  const data = useMemo(() => {
    if (!query.data) return query.data;
    if (!impersonation || !query.data.roles.includes("super_admin")) return query.data;
    return { ...query.data, schoolId: impersonation.schoolId };
  }, [query.data, impersonation]);

  return { ...query, data } as typeof query;
}
