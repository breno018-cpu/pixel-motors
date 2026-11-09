
-- Commission tiers per employee (sales count -> value per sale)
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS commission_tiers jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Contract template branding
ALTER TABLE public.contract_templates
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS watermark_url text,
  ADD COLUMN IF NOT EXISTS signature_url text,
  ADD COLUMN IF NOT EXISTS watermark_opacity numeric NOT NULL DEFAULT 0.10;

-- Public bucket for logos / watermarks / signatures
INSERT INTO storage.buckets (id, name, public)
VALUES ('contract-assets', 'contract-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Public read
DROP POLICY IF EXISTS "Public read contract assets" ON storage.objects;
CREATE POLICY "Public read contract assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'contract-assets');

-- Elevated users (admin/gerente) can upload/update/delete
DROP POLICY IF EXISTS "Elevated upload contract assets" ON storage.objects;
CREATE POLICY "Elevated upload contract assets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'contract-assets' AND public.has_elevated_access(auth.uid()));

DROP POLICY IF EXISTS "Elevated update contract assets" ON storage.objects;
CREATE POLICY "Elevated update contract assets"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'contract-assets' AND public.has_elevated_access(auth.uid()));

DROP POLICY IF EXISTS "Elevated delete contract assets" ON storage.objects;
CREATE POLICY "Elevated delete contract assets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'contract-assets' AND public.has_elevated_access(auth.uid()));
