-- Remove acesso do papel anon (chave pública) de todas as políticas RLS do schema public.
-- Antes: "Public full access" permitia que qualquer pessoa com a anon key lesse, alterasse
-- e (via user_roles/profiles) escalasse privilégios.
-- Rollback: ALTER POLICY <nome> ON public.<tabela> TO anon, authenticated;  (lista em backups/)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND 'anon' = ANY(roles)
  LOOP
    EXECUTE format('ALTER POLICY %I ON %I.%I TO authenticated', r.policyname, r.schemaname, r.tablename);
    RAISE NOTICE 'anon removido: %.% (%)', r.schemaname, r.tablename, r.policyname;
  END LOOP;
END $$;
