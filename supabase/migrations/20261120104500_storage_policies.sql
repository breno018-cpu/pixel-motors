-- =============================================================================
-- MIGRAÇÃO: Políticas de acesso para storage.objects
-- Versão corrigida — usa CREATE POLICY ON storage.objects (não storage.policies)
-- Data: 2026-11-20
-- =============================================================================

-- Remove políticas antigas com nome igual antes de recriar (idempotente)
-- Nota: ALTER TABLE storage.objects não é permitido no Supabase Cloud (já habilitado por padrão)
DO $$
DECLARE
  pol_name TEXT;
  pol_names TEXT[] := ARRAY[
    'contract-assets select authenticated',
    'contract-assets insert elevated',
    'contract-assets update elevated',
    'contract-assets delete admin',
    'signed-contracts select store or admin',
    'signed-contracts insert authenticated',
    'sale-evidence select store or admin',
    'sale-evidence insert authenticated',
    'ad-creatives select elevated',
    'ad-creatives insert elevated',
    'ad-creatives update elevated',
    'ad-creatives delete admin',
    'system-backups select admin',
    'system-backups insert admin',
    'database-export select admin'
  ];
BEGIN
  FOREACH pol_name IN ARRAY pol_names LOOP
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol_name);
    EXCEPTION WHEN OTHERS THEN
      NULL; -- ignora se não existir
    END;
  END LOOP;
END;
$$;

-- =============================================================================
-- BUCKET: contract-assets
-- Logos, templates e imagens de contratos — leitura pública autenticada,
-- escrita apenas para elevated (gerente/admin)
-- =============================================================================

CREATE POLICY "contract-assets select authenticated"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'contract-assets');

CREATE POLICY "contract-assets insert elevated"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'contract-assets'
  AND public.has_elevated_access(auth.uid())
);

CREATE POLICY "contract-assets update elevated"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'contract-assets'
  AND public.has_elevated_access(auth.uid())
)
WITH CHECK (
  bucket_id = 'contract-assets'
  AND public.has_elevated_access(auth.uid())
);

CREATE POLICY "contract-assets delete admin"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'contract-assets'
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

-- =============================================================================
-- BUCKET: signed-contracts
-- Contratos assinados — apenas usuários da mesma loja ou admin/gerente
-- O path deve ter o store_id como primeira pasta: {store_id}/{filename}
-- =============================================================================

CREATE POLICY "signed-contracts select store or admin"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'signed-contracts'
  AND (
    public.has_elevated_access(auth.uid())
    OR (storage.foldername(name))[1] = public.get_user_store_id(auth.uid())::text
  )
);

CREATE POLICY "signed-contracts insert authenticated"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'signed-contracts'
  AND public.can_create_sales(auth.uid())
);

-- =============================================================================
-- BUCKET: sale-evidence
-- Comprovantes de venda — apenas usuários da mesma loja ou admin/gerente
-- O path deve ter o store_id como primeira pasta: {store_id}/{filename}
-- =============================================================================

CREATE POLICY "sale-evidence select store or admin"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'sale-evidence'
  AND (
    public.has_elevated_access(auth.uid())
    OR (storage.foldername(name))[1] = public.get_user_store_id(auth.uid())::text
  )
);

CREATE POLICY "sale-evidence insert authenticated"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'sale-evidence'
  AND public.can_create_sales(auth.uid())
);

-- =============================================================================
-- BUCKET: ad-creatives
-- Anúncios e criativos — apenas elevated (gerente/admin)
-- =============================================================================

CREATE POLICY "ad-creatives select elevated"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'ad-creatives'
  AND public.has_elevated_access(auth.uid())
);

CREATE POLICY "ad-creatives insert elevated"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'ad-creatives'
  AND public.has_elevated_access(auth.uid())
);

CREATE POLICY "ad-creatives update elevated"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'ad-creatives'
  AND public.has_elevated_access(auth.uid())
)
WITH CHECK (
  bucket_id = 'ad-creatives'
  AND public.has_elevated_access(auth.uid())
);

CREATE POLICY "ad-creatives delete admin"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'ad-creatives'
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

-- =============================================================================
-- BUCKET: system-backups
-- Backups do sistema — apenas admin
-- =============================================================================

CREATE POLICY "system-backups select admin"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'system-backups'
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "system-backups insert admin"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'system-backups'
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

-- =============================================================================
-- BUCKETS: database_export_* (backups antigos — somente admin)
-- =============================================================================

CREATE POLICY "database-export select admin"
ON storage.objects FOR SELECT
TO authenticated
USING (
  (bucket_id LIKE 'database_export_%')
  AND public.has_role(auth.uid(), 'admin'::app_role)
);
