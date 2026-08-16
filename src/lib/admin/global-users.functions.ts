import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface GlobalUserRow {
  userId: string;
  name: string | null;
  email: string | null;
  role: string;
  schoolId: string | null;
  createdAt: string;
}

/**
 * Lista todos os usuários globais para o painel do super admin.
 * Usa service_role para ler `auth.users` (email é fonte canônica) e
 * `profiles`/`teachers`/`students` para o nome, sem depender de RLS.
 */
export const listGlobalUsersFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isSuper } = await context.supabase.rpc("is_super_admin", {
      _user_id: context.userId,
    });
    if (!isSuper) throw new Error("Apenas o administrador geral pode listar usuários");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [rolesRes, profilesRes, teachersRes, studentsRes] = await Promise.all([
      supabaseAdmin.from("user_roles").select("user_id, role, school_id, created_at"),
      supabaseAdmin.from("profiles").select("id, full_name, email, created_at"),
      supabaseAdmin.from("teachers").select("user_id, full_name, email, school_id, created_at"),
      supabaseAdmin.from("students").select("id, full_name, school_id, created_at, user_id"),
    ]);

    const emailById = new Map<string, string | null>();
    const nameById = new Map<string, string | null>();
    const PER_PAGE = 200;
    for (let page = 1; page <= 10; page++) {
      const { data: pageRes } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: PER_PAGE,
      });
      if (!pageRes?.users.length) break;
      pageRes.users.forEach((u) => {
        if (u.email) emailById.set(u.id, u.email);
        const meta = u.user_metadata as { full_name?: string; name?: string } | null;
        const metaName = meta?.full_name ?? meta?.name ?? null;
        if (metaName) nameById.set(u.id, metaName);
      });
      if (pageRes.users.length < PER_PAGE) break;
    }

    const identity = new Map<
      string,
      { name: string | null; email: string | null; createdAt: string }
    >();
    (profilesRes.data ?? []).forEach((p) =>
      identity.set(p.id, {
        name: p.full_name ?? nameById.get(p.id) ?? null,
        email: emailById.get(p.id) ?? p.email,
        createdAt: p.created_at,
      }),
    );
    (teachersRes.data ?? []).forEach((t) => {
      if (!t.user_id) return;
      const existing = identity.get(t.user_id);
      if (!existing || (!existing.name && !existing.email)) {
        identity.set(t.user_id, {
          name: existing?.name ?? t.full_name ?? nameById.get(t.user_id) ?? null,
          email: emailById.get(t.user_id) ?? existing?.email ?? t.email,
          createdAt: existing?.createdAt ?? t.created_at,
        });
      }
    });
    (studentsRes.data ?? []).forEach((s) => {
      if (!s.user_id) return;
      const existing = identity.get(s.user_id);
      if (!existing) {
        identity.set(s.user_id, {
          name: s.full_name ?? nameById.get(s.user_id) ?? null,
          email: emailById.get(s.user_id) ?? null,
          createdAt: s.created_at,
        });
      }
    });

    const staff = (rolesRes.data ?? []).map((r) => {
      const id = identity.get(r.user_id);
      return {
        userId: r.user_id,
        name: id?.name ?? nameById.get(r.user_id) ?? null,
        email: emailById.get(r.user_id) ?? id?.email ?? null,
        role: r.role,
        schoolId: r.school_id,
        createdAt: id?.createdAt ?? r.created_at,
      };
    });

    const studentRows = (studentsRes.data ?? [])
      .filter((s) => !s.user_id)
      .map((s) => ({
        userId: s.id,
        name: s.full_name,
        email: null,
        role: "student",
        schoolId: s.school_id,
        createdAt: s.created_at,
      }));

    return [...staff, ...studentRows] as GlobalUserRow[];
  });
