import { createClient } from "@supabase/supabase-js";

// SECURITY: este script exige credenciais reais via variáveis de ambiente.
// Nunca cole chaves no código. Para o Supabase local, exporte SUPABASE_URL
// (default http://127.0.0.1:54321) e SUPABASE_SERVICE_ROLE_KEY antes de rodar.
const supabaseUrl = process.env.SUPABASE_URL || "http://127.0.0.1:54321";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  console.error(
    "Missing SUPABASE_SERVICE_ROLE_KEY. Exporte a chave service_role do seu Supabase local (supabase status) e rode novamente.",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function main() {
  console.log("Seeding users into local Supabase...");

  // 1. Get default plan
  const { data: plans } = await supabase.from("plans").select("id").limit(1);
  const planId = plans?.[0]?.id;

  // 2. Create or Get Demo School
  let schoolId = null;
  const { data: existingSchool } = await supabase
    .from("schools")
    .select("id")
    .eq("slug", "escola-demo")
    .maybeSingle();

  if (existingSchool) {
    schoolId = existingSchool.id;
  } else {
    const { data: newSchool, error: schoolErr } = await supabase
      .from("schools")
      .insert({
        name: "Escola Demo Lecto",
        slug: "escola-demo",
        city: "São Paulo",
        state: "SP",
        plan_id: planId,
        subscription_status: "active",
      })
      .select("id")
      .single();

    if (schoolErr) {
      console.error("Error creating school:", schoolErr);
    } else {
      schoolId = newSchool.id;
    }
  }

  // 3. Create Class
  let classId = null;
  if (schoolId) {
    const { data: existingClass } = await supabase
      .from("classes")
      .select("id")
      .eq("class_code", "TURMA-5A")
      .maybeSingle();

    if (existingClass) {
      classId = existingClass.id;
    } else {
      const { data: newClass, error: classErr } = await supabase
        .from("classes")
        .insert({
          school_id: schoolId,
          name: "5º Ano A",
          grade: "5º Ano",
          academic_year: 2026,
          class_code: "TURMA-5A",
        })
        .select("id")
        .single();

      if (classErr) console.error("Error creating class:", classErr);
      else classId = newClass.id;
    }
  }

  // Define users list
  const usersToCreate = [
    {
      email: "kmkz.clan@gmail.com",
      password: "nick@1103",
      fullName: "Super Admin Lecto",
      role: "super_admin",
      schoolId: null,
    },
    {
      email: "admin@escolademo.com",
      password: "password123",
      fullName: "Gestor Escola Demo",
      role: "school_admin",
      schoolId: schoolId,
    },
    {
      email: "prof.carlos@escolademo.com",
      password: "password123",
      fullName: "Prof. Carlos Silva",
      role: "teacher",
      schoolId: schoolId,
      subjects: ["Língua Portuguesa", "Leitura"],
    },
    {
      email: "prof.ana@escolademo.com",
      password: "password123",
      fullName: "Profa. Ana Souza",
      role: "teacher",
      schoolId: schoolId,
      subjects: ["Literatura", "Redação"],
    },
    {
      email: "aluno.joao@escolademo.com",
      password: "password123",
      fullName: "João Pedro Santos",
      role: "student",
      schoolId: schoolId,
      studentCode: "ALU-001",
      classId: classId,
    },
    {
      email: "aluno.maria@escolademo.com",
      password: "password123",
      fullName: "Maria Eduarda Lima",
      role: "student",
      schoolId: schoolId,
      studentCode: "ALU-002",
      classId: classId,
    },
  ];

  for (const u of usersToCreate) {
    console.log(`Processing user: ${u.email} (${u.role})...`);

    // Check if user already exists in Auth
    const { data: listUsers } = await supabase.auth.admin.listUsers();
    let userId = listUsers?.users?.find((usr) => usr.email === u.email)?.id;

    if (!userId) {
      const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: {
          full_name: u.fullName,
        },
      });

      if (createErr) {
        console.error(`Error creating auth user ${u.email}:`, createErr.message);
        continue;
      }
      userId = newUser.user.id;
      console.log(`Auth user created: ${u.email} (ID: ${userId})`);
    } else {
      // Update password just in case
      await supabase.auth.admin.updateUserById(userId, {
        password: u.password,
        user_metadata: { full_name: u.fullName },
      });
      console.log(`Auth user already exists, updated password for: ${u.email}`);
    }

    // Ensure Profile exists/updated
    await supabase.from("profiles").upsert({
      id: userId,
      email: u.email,
      full_name: u.fullName,
    });

    // Assign Role in user_roles
    const { error: roleErr } = await supabase.from("user_roles").upsert(
      {
        user_id: userId,
        role: u.role,
        school_id: u.schoolId,
      },
      { onConflict: "user_id,role,school_id" },
    );

    if (roleErr) {
      console.error(`Error assigning role ${u.role} to ${u.email}:`, roleErr.message);
    } else {
      console.log(`Role '${u.role}' assigned to ${u.email}`);
    }

    // Specific domain records (teachers / students)
    if (u.role === "teacher" && u.schoolId) {
      await supabase.from("teachers").upsert(
        {
          user_id: userId,
          school_id: u.schoolId,
          full_name: u.fullName,
          email: u.email,
          subjects: u.subjects || [],
        },
        { onConflict: "school_id,email" },
      );
    }

    if (u.role === "student" && u.schoolId) {
      const { data: studentRecord } = await supabase
        .from("students")
        .upsert(
          {
            user_id: userId,
            school_id: u.schoolId,
            class_id: u.classId,
            full_name: u.fullName,
            student_code: u.studentCode,
          },
          { onConflict: "school_id,student_code" },
        )
        .select("id")
        .single();

      if (studentRecord?.id) {
        // Create PIN credentials for student login
        const { error: pinErr } = await supabase.rpc("verify_student_pin", {
          _student_id: studentRecord.id,
          _pin: "1234",
        });
        // Also insert PIN credential hash directly if needed
        const { data: hashData } = await supabase.rpc("hash_pin", { _pin: "1234" });
        if (hashData) {
          await supabase.from("student_credentials").upsert({
            student_id: studentRecord.id,
            pin_hash: hashData,
            auth_email: u.email,
          });
        }
      }
    }
  }

  console.log("\nUser seeding complete successfully!");
}

main().catch((err) => {
  console.error("Fatal error seeding users:", err);
  process.exit(1);
});
