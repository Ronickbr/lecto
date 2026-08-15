-- 0014 Storage
INSERT INTO storage.buckets (id, name, public)
VALUES ('text-images', 'text-images', false)
ON CONFLICT (id) DO NOTHING;
