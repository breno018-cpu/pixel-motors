
ALTER TABLE public.chassis_patterns
  ADD COLUMN IF NOT EXISTS transmission text,
  ADD COLUMN IF NOT EXISTS warranty_months integer,
  ADD COLUMN IF NOT EXISTS service_interval_months integer,
  ADD COLUMN IF NOT EXISTS service_interval_km integer;

-- Sanitize any spreadsheet_id containing a full URL or /edit path
UPDATE public.stock_sync_config
SET spreadsheet_id = substring(spreadsheet_id from 'spreadsheets/d/([a-zA-Z0-9_-]+)')
WHERE spreadsheet_id ~ 'spreadsheets/d/';

UPDATE public.stock_sync_config
SET spreadsheet_id = split_part(split_part(spreadsheet_id, '/', 1), '?', 1)
WHERE spreadsheet_id ~ '[/?]';
