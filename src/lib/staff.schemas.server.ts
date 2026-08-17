import { z } from "zod";

export const CreateSchoolSchema = z.object({
  name: z.string().min(1),
  slug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/, "slug: use minúsculas, números e hífens"),
  cnpj: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  adminEmail: z.string().email(),
  adminName: z.string().min(1),
  adminPassword: z.string().min(6),
});

export const CreateTeacherSchema = z.object({
  schoolId: z.string().uuid(),
  fullName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  subjects: z.array(z.string()).default([]),
});
