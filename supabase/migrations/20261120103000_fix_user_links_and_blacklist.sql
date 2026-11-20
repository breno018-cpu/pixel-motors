-- Corrige vínculo conta de login <-> funcionário e remove da lista negra legada contratos reais.
-- Causa: employees.profile_id nulo => get_user_store_id() nulo => usuário não enxerga os contratos da loja.

-- 1) Halanna (shineraymoch@user.com): vincula funcionário à conta e cria o perfil ausente
INSERT INTO public.profiles (id, full_name, email)
SELECT u.id, 'Halanna', u.email FROM auth.users u
WHERE u.email = 'shineraymoch@user.com'
ON CONFLICT (id) DO NOTHING;

UPDATE public.employees
SET profile_id = (SELECT id FROM auth.users WHERE email = 'shineraymoch@user.com')
WHERE id = '02e3206a-a9b4-47b7-8d25-0c9092dc19dd' AND profile_id IS NULL;

-- 2) Breno Laurentino (backup): vincula funcionário (loja Divinópolis) à conta
UPDATE public.employees
SET profile_id = (SELECT id FROM auth.users WHERE email = 'laurentinobreno08@gmail.com')
WHERE id = 'e9d8d277-3698-4a6e-bed2-cbba3823bc1d' AND profile_id IS NULL;

-- 3) Contratos reais (existem no banco, is_deleted=false) bloqueados pela lista negra legada
UPDATE public.contracts
SET clause_variables = jsonb_set(
  clause_variables, '{deleted_ids}',
  COALESCE((
    SELECT jsonb_agg(v) FROM jsonb_array_elements(clause_variables->'deleted_ids') v
    WHERE v #>> '{}' NOT IN (
      '4502fb16-9f2b-4d23-87e9-06f320db6d89',
      '661156b7-a60d-4468-97da-09fc45318d19',
      'CTR-MU5WM0FB', 'MU5WM0FB', 'MOC-240', '240'
    )
  ), '[]'::jsonb))
WHERE contract_number = 'DEALFLOW_GLOBAL_SYNC';
