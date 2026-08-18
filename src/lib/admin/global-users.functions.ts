import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
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
 * `auth.users` é a fonte canônica: TODO usuário cadastrado (Auth ou criação
 * via service role) aparece, mesmo sem papel atribuído. Nome vem de
 * `profiles`/`teachers`/`students`/metadata; papel vem de `user_roles`.
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
      supabaseAdmin.from("user_roles").select("user_id, role, school_id"),
      supabaseAdmin.from("profiles").select("id, full_name, email"),
      supabaseAdmin.from("teachers").select("user_id, full_name, email"),
      supabaseAdmin.from("students").select("id, full_name, school_id, user_id"),
    ]);

    const rolesByUser = new Map<string, { role: string; schoolId: string | null }[]>();
    (rolesRes.data ?? []).forEach((r) => {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push({ role: r.role, schoolId: r.school_id });
      rolesByUser.set(r.user_id, arr);
    });

    // Fonte canônica: todos os usuários do auth.users.
    const authUsers: {
      id: string;
      email: string | null;
      name: string | null;
      createdAt: string;
    }[] = [];
    const PER_PAGE = 200;
    for (let page = 1; page <= 10; page++) {
      const { data: pageRes } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: PER_PAGE,
      });
      if (!pageRes?.users.length) break;
      pageRes.users.forEach((u) => {
        const meta = u.user_metadata as { full_name?: string; name?: string } | null;
        authUsers.push({
          id: u.id,
          email: u.email ?? null,
          name: meta?.full_name ?? meta?.name ?? null,
          createdAt: u.created_at ?? new Date().toISOString(),
        });
      });
      if (pageRes.users.length < PER_PAGE) break;
    }

    // Nome/email enriquecidos com profiles/teachers/students.
    const identity = new Map<string, { name: string | null; email: string | null }>();
    (profilesRes.data ?? []).forEach((p) =>
      identity.set(p.id, { name: p.full_name, email: p.email }),
    );
    (teachersRes.data ?? []).forEach((t) => {
      if (!t.user_id) return;
      const existing = identity.get(t.user_id);
      if (!existing || (!existing.name && !existing.email)) {
        identity.set(t.user_id, {
          name: existing?.name ?? t.full_name,
          email: existing?.email ?? t.email,
        });
      }
    });
    (studentsRes.data ?? []).forEach((s) => {
      if (!s.user_id) return;
      const existing = identity.get(s.user_id);
      if (!existing) identity.set(s.user_id, { name: s.full_name, email: null });
    });

    const staff: GlobalUserRow[] = [];
    for (const u of authUsers) {
      const id = identity.get(u.id);
      const roles = rolesByUser.get(u.id) ?? [];
      const name = id?.name ?? u.name ?? null;
      const email = u.email ?? id?.email ?? null;
      if (roles.length === 0) {
        // Cadastrado mas sem papel atribuído (ex.: signup antes do
        // provisionamento) — aparece para o super admin poder agir.
        staff.push({
          userId: u.id,
          name,
          email,
          role: "no_role",
          schoolId: null,
          createdAt: u.createdAt,
        });
        continue;
      }
      for (const r of roles) {
        staff.push({
          userId: u.id,
          name,
          email,
          role: r.role,
          schoolId: r.schoolId,
          createdAt: u.createdAt,
        });
      }
    }

    const studentRows = (studentsRes.data ?? [])
      .filter((s) => !s.user_id)
      .map((s) => ({
        userId: s.id,
        name: s.full_name,
        email: null,
        role: "student",
        schoolId: s.school_id,
        createdAt: new Date().toISOString(),
      }));

    return [...staff, ...studentRows] as GlobalUserRow[];
  });

/**
 * Deleta um usuário da plataforma (auth.users + dados relacionados via cascade).
 * Apenas super_admin pode executar. Bloqueia auto-deleção.
 */
export const deleteGlobalUserFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ targetUserId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { data: isSuper } = await context.supabase.rpc("is_super_admin", {
      _user_id: context.userId,
    });
    if (!isSuper) throw new Error("Apenas o administrador geral pode deletar usuários");
    if (data.targetUserId === context.userId)
      throw new Error("Você não pode deletar sua própria conta");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Remove da tabela students (alunos sem auth user usam id direto)
    await supabaseAdmin.from("students").delete().eq("user_id", data.targetUserId);
    // Remove roles, profiles, teachers — cascade via FK fará o resto
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.targetUserId);
    await supabaseAdmin.from("teachers").delete().eq("user_id", data.targetUserId);
    await supabaseAdmin.from("profiles").delete().eq("id", data.targetUserId);
    // Deleta o usuário do Auth (operação final e irreversível)
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.targetUserId);
    if (error) throw new Error(`Falha ao deletar usuário: ${error.message}`);

    return { ok: true };
  });
