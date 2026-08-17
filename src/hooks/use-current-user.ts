import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getImpersonation } from "@/lib/admin/impersonation";
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
        supabase.from("user_roles").select("role").eq("user_id", user.id),
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
    const schoolId = await resolveSchoolId(user.id, roleList);

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

/**
 * Resolve a escola do usuário pela mesma fonte autoritativa usada pelo RLS e
 * pelas server functions (`user_school_id`), evitando divergências entre o que
 * o cliente acredita ser a escola e o que o banco aceita.
 *
 * Super admin personificando uma escola: normaliza o valor gravado (aceita o
 * UUID real OU um slug legado) para o UUID da tabela schools — valores antigos
 * no localStorage podem não ser UUIDs e quebrariam qualquer filtro de escola.
 */
async function resolveSchoolId(userId: string, roleList: AppRole[]): Promise<string | null> {
  const imp = getImpersonation();

  if (roleList.includes("super_admin")) {
    if (!imp?.schoolId) return null;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      imp.schoolId,
    );
    const { data: school } = isUuid
      ? await supabase.from("schools").select("id").eq("id", imp.schoolId).maybeSingle()
      : await supabase.from("schools").select("id").eq("slug", imp.schoolId).maybeSingle();
    return school?.id ?? null;
  }

  const { data: resolved } = await supabase.rpc("user_school_id", { _user_id: userId });
  return resolved ?? null;
}

export function useCurrentUser() {
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

  return query;
}
