ALTER TABLE public.vehicle_colors
  ADD COLUMN IF NOT EXISTS vehicle_model_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS model_scope text NOT NULL DEFAULT 'todos';

ALTER TABLE public.vehicle_colors DROP CONSTRAINT IF EXISTS vehicle_colors_model_scope_check;
ALTER TABLE public.vehicle_colors
  ADD CONSTRAINT vehicle_colors_model_scope_check CHECK (model_scope IN ('todos', 'apenas', 'exceto'));

UPDATE public.vehicle_colors
SET vehicle_model_ids = ARRAY[vehicle_model_id],
    model_scope = 'apenas'
WHERE vehicle_model_id IS NOT NULL
  AND model_scope = 'todos'
  AND vehicle_model_ids = '{}'::uuid[];