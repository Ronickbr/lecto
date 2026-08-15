import { z } from "zod";

export const SignInSchema = z.object({
  classCode: z.string().min(1),
  studentCode: z.string().min(1),
  pin: z.string().min(4).max(20),
});

export const CreateStudentSchema = z.object({
  schoolId: z.string().uuid(),
  classId: z.string().uuid().nullable(),
  fullName: z.string().min(1),
  studentCode: z.string().min(1),
  pin: z.string().min(4).max(10),
  birthDate: z.string().nullable().optional(),
  guardianEmail: z.string().email().nullable().optional().or(z.literal("")),
  guardianPhone: z.string().nullable().optional(),
});
