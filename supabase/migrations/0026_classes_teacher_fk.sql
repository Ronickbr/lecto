-- 0026 classes.teacher_id nunca teve FK para teachers, então o PostgREST
-- não conseguia embutir teacher:teachers(...) (erro "Could not find a
-- relationship between 'classes' and 'teachers' in the schema cache").
-- NOT VALID pula a validação das linhas existentes (não falha se houver
-- teacher_id órfão) e ainda expõe a relação ao PostgREST após reload do cache.

ALTER TABLE public.classes
  ADD CONSTRAINT classes_teacher_id_fkey
  FOREIGN KEY (teacher_id) REFERENCES public.teachers(id)
  ON DELETE SET NULL
  NOT VALID;