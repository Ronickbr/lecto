-- 0022 Storage: avatares de usuário.
-- Bucket privado; pasta padrão <user_id>/<arquivo>. Usa URLs assinadas para exibição.
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "avatars_read_own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND (
    public.is_super_admin(auth.uid())
    OR (storage.foldername(name))[1] = auth.uid()::text));

CREATE POLICY "avatars_insert_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND owner = auth.uid() AND (
    public.is_super_admin(auth.uid())
    OR (storage.foldername(name))[1] = auth.uid()::text));

CREATE POLICY "avatars_update_own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (public.is_super_admin(auth.uid()) OR owner = auth.uid()))
  WITH CHECK (bucket_id = 'avatars' AND (public.is_super_admin(auth.uid()) OR owner = auth.uid()));

CREATE POLICY "avatars_delete_own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (public.is_super_admin(auth.uid()) OR owner = auth.uid()));