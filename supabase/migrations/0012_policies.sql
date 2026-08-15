-- 0012 Policies

-- plans
CREATE POLICY "Anyone can view active plans"
  ON public.plans FOR SELECT
  USING (active = true);

-- user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "Super admins can manage roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- profiles
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (id = auth.uid() OR public.is_super_admin(auth.uid()));
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid());
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- schools
CREATE POLICY "Super admin manages all schools"
  ON public.schools FOR ALL
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "School members view their school"
  ON public.schools FOR SELECT
  USING (id = public.user_school_id(auth.uid()));
CREATE POLICY "School admin updates own school"
  ON public.schools FOR UPDATE
  USING (id = public.user_school_id(auth.uid()) AND public.has_role(auth.uid(),'school_admin'));

-- subscriptions
CREATE POLICY "Super admin manages subscriptions"
  ON public.subscriptions FOR ALL
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "School members view own subscriptions"
  ON public.subscriptions FOR SELECT
  USING (school_id = public.user_school_id(auth.uid()));

-- classes
CREATE POLICY "Super admin manages all classes"
  ON public.classes FOR ALL
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "School members view classes"
  ON public.classes FOR SELECT
  USING (school_id = public.user_school_id(auth.uid()));
CREATE POLICY "School admin manages classes"
  ON public.classes FOR ALL
  USING (school_id = public.user_school_id(auth.uid()) AND public.has_role(auth.uid(),'school_admin'))
  WITH CHECK (school_id = public.user_school_id(auth.uid()) AND public.has_role(auth.uid(),'school_admin'));

-- teachers
CREATE POLICY "Super admin manages all teachers"
  ON public.teachers FOR ALL
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "School members view teachers"
  ON public.teachers FOR SELECT
  USING (school_id = public.user_school_id(auth.uid()));
CREATE POLICY "School admin manages teachers"
  ON public.teachers FOR ALL
  USING (school_id = public.user_school_id(auth.uid()) AND public.has_role(auth.uid(),'school_admin'))
  WITH CHECK (school_id = public.user_school_id(auth.uid()) AND public.has_role(auth.uid(),'school_admin'));

-- students
CREATE POLICY "Super admin manages all students"
  ON public.students FOR ALL
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "School members view students"
  ON public.students FOR SELECT
  USING (school_id = public.user_school_id(auth.uid()));
CREATE POLICY "School admin manages students"
  ON public.students FOR ALL
  USING (school_id = public.user_school_id(auth.uid()) AND public.has_role(auth.uid(),'school_admin'))
  WITH CHECK (school_id = public.user_school_id(auth.uid()) AND public.has_role(auth.uid(),'school_admin'));
CREATE POLICY "Student views own record"
  ON public.students FOR SELECT
  USING (user_id = auth.uid());

-- logs
CREATE POLICY "Super admin views logs"
  ON public.logs FOR SELECT USING (public.is_super_admin(auth.uid()));
CREATE POLICY "School admin views school logs"
  ON public.logs FOR SELECT
  USING (school_id = public.user_school_id(auth.uid()) AND public.has_role(auth.uid(),'school_admin'));
CREATE POLICY "Authenticated can insert logs"
  ON public.logs FOR INSERT
  WITH CHECK (actor_user_id = auth.uid());
CREATE POLICY "Logs are immutable"
  ON public.logs FOR UPDATE TO authenticated
  USING (false);
CREATE POLICY "Logs cannot be deleted"
  ON public.logs FOR DELETE TO authenticated
  USING (false);

-- texts
CREATE POLICY "Super admin manages all texts" ON public.texts
  FOR ALL USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "School members view school or public texts" ON public.texts
  FOR SELECT USING (is_public = true OR school_id = public.user_school_id(auth.uid()));
CREATE POLICY "School editors insert texts" ON public.texts
  FOR INSERT WITH CHECK (school_id = public.user_school_id(auth.uid()) AND public.is_school_editor(auth.uid(), school_id));
CREATE POLICY "School editors update texts" ON public.texts
  FOR UPDATE USING (school_id = public.user_school_id(auth.uid()) AND public.is_school_editor(auth.uid(), school_id))
  WITH CHECK (school_id = public.user_school_id(auth.uid()) AND public.is_school_editor(auth.uid(), school_id));
CREATE POLICY "School editors delete texts" ON public.texts
  FOR DELETE USING (school_id = public.user_school_id(auth.uid()) AND public.is_school_editor(auth.uid(), school_id));

-- questions
CREATE POLICY "Super admin manages all questions" ON public.questions
  FOR ALL USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "School members view questions" ON public.questions
  FOR SELECT USING (school_id = public.user_school_id(auth.uid()));
CREATE POLICY "School editors manage questions" ON public.questions
  FOR ALL USING (school_id = public.user_school_id(auth.uid()) AND public.is_school_editor(auth.uid(), school_id))
  WITH CHECK (school_id = public.user_school_id(auth.uid()) AND public.is_school_editor(auth.uid(), school_id));

-- simulados
CREATE POLICY "Super admin manages all simulados" ON public.simulados
  FOR ALL USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "School members view simulados" ON public.simulados
  FOR SELECT USING (school_id = public.user_school_id(auth.uid()));
CREATE POLICY "School editors manage simulados" ON public.simulados
  FOR ALL USING (school_id = public.user_school_id(auth.uid()) AND public.is_school_editor(auth.uid(), school_id))
  WITH CHECK (school_id = public.user_school_id(auth.uid()) AND public.is_school_editor(auth.uid(), school_id));

-- simulado_pages
CREATE POLICY "Super admin manages all pages" ON public.simulado_pages
  FOR ALL USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "School members view pages" ON public.simulado_pages
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.simulados s
    WHERE s.id = simulado_id AND s.school_id = public.user_school_id(auth.uid())
  ));
CREATE POLICY "School editors manage pages" ON public.simulado_pages
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.simulados s
    WHERE s.id = simulado_id
      AND s.school_id = public.user_school_id(auth.uid())
      AND public.is_school_editor(auth.uid(), s.school_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.simulados s
    WHERE s.id = simulado_id
      AND s.school_id = public.user_school_id(auth.uid())
      AND public.is_school_editor(auth.uid(), s.school_id)
  ));

-- simulado_blocks
CREATE POLICY "Super admin manages all blocks" ON public.simulado_blocks
  FOR ALL USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "School members view blocks" ON public.simulado_blocks
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.simulado_pages p
    JOIN public.simulados s ON s.id = p.simulado_id
    WHERE p.id = page_id AND s.school_id = public.user_school_id(auth.uid())
  ));
CREATE POLICY "School editors manage blocks" ON public.simulado_blocks
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.simulado_pages p
    JOIN public.simulados s ON s.id = p.simulado_id
    WHERE p.id = page_id
      AND s.school_id = public.user_school_id(auth.uid())
      AND public.is_school_editor(auth.uid(), s.school_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.simulado_pages p
    JOIN public.simulados s ON s.id = p.simulado_id
    WHERE p.id = page_id
      AND s.school_id = public.user_school_id(auth.uid())
      AND public.is_school_editor(auth.uid(), s.school_id)
  ));

-- simulado_attempts
-- Aluno gerencia os próprios attempts, mas apenas de simulados da própria escola
-- e vinculados ao seu registro de estudante (impede cross-school e tentativas de outra pessoa).
CREATE POLICY "Student manages own attempts" ON public.simulado_attempts
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND school_id = public.user_school_id(auth.uid())
    AND EXISTS (SELECT 1 FROM public.students st WHERE st.id = student_id AND st.user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.simulados s WHERE s.id = simulado_id AND s.school_id = public.user_school_id(auth.uid()))
  );
CREATE POLICY "School staff view attempts" ON public.simulado_attempts
  FOR SELECT TO authenticated
  USING (school_id = public.user_school_id(auth.uid())
         AND (public.has_role(auth.uid(),'school_admin') OR public.has_role(auth.uid(),'teacher')));
CREATE POLICY "Super admin all attempts" ON public.simulado_attempts
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- simulado_answers
CREATE POLICY "Student select own answers" ON public.simulado_answers
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.simulado_attempts a
                 WHERE a.id = attempt_id AND a.user_id = auth.uid()));
CREATE POLICY "Student insert own answers" ON public.simulado_answers
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.simulado_attempts a
    WHERE a.id = attempt_id AND a.user_id = auth.uid() AND a.submitted_at IS NULL
  ));
CREATE POLICY "Student update own answers" ON public.simulado_answers
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.simulado_attempts a
    WHERE a.id = attempt_id AND a.user_id = auth.uid() AND a.submitted_at IS NULL
  ));
CREATE POLICY "Student delete own answers" ON public.simulado_answers
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.simulado_attempts a
    WHERE a.id = attempt_id AND a.user_id = auth.uid() AND a.submitted_at IS NULL
  ));
CREATE POLICY "School staff view answers" ON public.simulado_answers
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.simulado_attempts a
                 WHERE a.id = attempt_id
                   AND a.school_id = public.user_school_id(auth.uid())
                   AND (public.has_role(auth.uid(),'school_admin') OR public.has_role(auth.uid(),'teacher'))));
CREATE POLICY "Super admin all answers" ON public.simulado_answers
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- student_credentials
CREATE POLICY "Service role manages credentials" ON public.student_credentials
  FOR ALL TO service_role USING (true);

-- simulado_retakes
CREATE POLICY "School editors manage retakes"
  ON public.simulado_retakes FOR ALL TO authenticated
  USING (public.is_school_editor(auth.uid(), school_id) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_school_editor(auth.uid(), school_id) OR public.is_super_admin(auth.uid()));
CREATE POLICY "Students view own retakes"
  ON public.simulado_retakes FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = simulado_retakes.student_id AND s.user_id = auth.uid()
  ));
-- Aluno só pode consumir uma retake própria ainda não consumida (consumed_at NULL -> SET consumed_at).
CREATE POLICY "Students consume own retakes"
  ON public.simulado_retakes FOR UPDATE TO authenticated
  USING (consumed_at IS NULL AND EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = simulado_retakes.student_id AND s.user_id = auth.uid()
  ))
  WITH CHECK (consumed_at IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = simulado_retakes.student_id AND s.user_id = auth.uid()
  ));

-- question_keys (gabaritos) — restrito a editores/super_admin.
CREATE POLICY "School editors manage question keys" ON public.question_keys
  FOR ALL TO authenticated
  USING (school_id = public.user_school_id(auth.uid()) AND public.is_school_editor(auth.uid(), school_id))
  WITH CHECK (school_id = public.user_school_id(auth.uid()) AND public.is_school_editor(auth.uid(), school_id));
CREATE POLICY "Super admin manages all question keys" ON public.question_keys
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- platform_settings — somente super_admin.
CREATE POLICY "Super admins manage platform settings" ON public.platform_settings
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- storage: imagens de textos por escola.
-- Pasta do bucket segue o padrão <school_id>/<arquivo>.
CREATE POLICY "text_images_read_same_school" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'text-images' AND (
    public.is_super_admin(auth.uid())
    OR (storage.foldername(name))[1] = public.user_school_id(auth.uid())::text));
CREATE POLICY "text_images_insert_same_school" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'text-images' AND owner = auth.uid() AND (
    public.is_super_admin(auth.uid())
    OR ((storage.foldername(name))[1] = public.user_school_id(auth.uid())::text
        AND public.is_school_editor(auth.uid(), public.user_school_id(auth.uid())))));
CREATE POLICY "text_images_update_same_school" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'text-images' AND (public.is_super_admin(auth.uid()) OR (owner = auth.uid() AND (storage.foldername(name))[1] = public.user_school_id(auth.uid())::text)))
  WITH CHECK (bucket_id = 'text-images' AND (public.is_super_admin(auth.uid()) OR (owner = auth.uid() AND (storage.foldername(name))[1] = public.user_school_id(auth.uid())::text)));
CREATE POLICY "text_images_delete_same_school" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'text-images' AND (
    public.is_super_admin(auth.uid())
    OR ((storage.foldername(name))[1] = public.user_school_id(auth.uid())::text
        AND public.is_school_editor(auth.uid(), public.user_school_id(auth.uid())))));
