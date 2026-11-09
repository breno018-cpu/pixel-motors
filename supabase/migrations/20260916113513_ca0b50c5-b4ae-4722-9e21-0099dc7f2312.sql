CREATE POLICY "Authenticated can read sale evidence"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'sale-evidence');

CREATE POLICY "Authenticated can upload sale evidence"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'sale-evidence');

CREATE POLICY "Authenticated can update sale evidence"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'sale-evidence');