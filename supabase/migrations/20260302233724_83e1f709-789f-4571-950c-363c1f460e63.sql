-- Add 'vendedor' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'vendedor';

-- Create storage bucket for system backups
INSERT INTO storage.buckets (id, name, public) VALUES ('system-backups', 'system-backups', false)
ON CONFLICT (id) DO NOTHING;

-- Allow admins to manage backups
CREATE POLICY "Admins can manage backups"
ON storage.objects
FOR ALL
USING (bucket_id = 'system-backups' AND public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (bucket_id = 'system-backups' AND public.has_role(auth.uid(), 'admin'::app_role));

-- Allow admins and managers to read backups  
CREATE POLICY "Elevated users can read backups"
ON storage.objects
FOR SELECT
USING (bucket_id = 'system-backups' AND public.has_elevated_access(auth.uid()));