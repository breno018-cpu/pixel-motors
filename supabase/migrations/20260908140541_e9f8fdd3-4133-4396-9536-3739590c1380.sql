CREATE POLICY "Authenticated can view ad creatives" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'ad-creatives');
CREATE POLICY "Elevated can upload ad creatives" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'ad-creatives' AND public.has_elevated_access(auth.uid()));
CREATE POLICY "Elevated can update ad creatives" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'ad-creatives' AND public.has_elevated_access(auth.uid()));
CREATE POLICY "Elevated can delete ad creatives" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'ad-creatives' AND public.has_elevated_access(auth.uid()));