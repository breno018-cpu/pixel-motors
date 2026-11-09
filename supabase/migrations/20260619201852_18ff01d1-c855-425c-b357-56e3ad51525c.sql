
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE TABLE public.stock_sync_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spreadsheet_id text,
  sheet_name text NOT NULL DEFAULT 'Estoque',
  enabled boolean NOT NULL DEFAULT false,
  function_url text,
  function_token text,
  last_pushed_at timestamptz,
  last_pulled_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_sync_config TO authenticated;
GRANT ALL ON public.stock_sync_config TO service_role;

ALTER TABLE public.stock_sync_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stock_sync_config_select" ON public.stock_sync_config
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "stock_sync_config_manage" ON public.stock_sync_config
  FOR ALL TO authenticated
  USING (public.has_elevated_access(auth.uid()))
  WITH CHECK (public.has_elevated_access(auth.uid()));

CREATE TRIGGER trg_stock_sync_config_updated_at
  BEFORE UPDATE ON public.stock_sync_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.stock_sync_config (sheet_name, enabled) VALUES ('Estoque', false);

CREATE OR REPLACE FUNCTION public.notify_stock_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  cfg record;
BEGIN
  SELECT enabled, function_url, function_token, spreadsheet_id
    INTO cfg
  FROM public.stock_sync_config
  LIMIT 1;

  IF cfg IS NULL OR NOT cfg.enabled OR cfg.function_url IS NULL OR cfg.spreadsheet_id IS NULL THEN
    RETURN NULL;
  END IF;

  PERFORM extensions.http_post(
    url := cfg.function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(cfg.function_token, '')
    ),
    body := jsonb_build_object('action', 'push')
  );
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_vehicles_stock_sync
AFTER INSERT OR UPDATE OR DELETE ON public.vehicles
FOR EACH STATEMENT EXECUTE FUNCTION public.notify_stock_sync();
