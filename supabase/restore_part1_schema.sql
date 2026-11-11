-- ============================================================================
-- PARTE 1: ESTRUTURA, TABELAS E SEGURANÇA (100% PUBLIC SCHEMA)
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
SET check_function_bodies = false;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.6 (Debian 18.6-3)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: app_role; Type: TYPE; Schema: public; Owner: postgres
--

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE public.app_role AS ENUM (
            'admin',
            'gerente',
            'revendedor',
            'visualizador',
            'vendedor',
            'vendedor_plus',
            'vendedor_externo'
        );
    END IF;
END $$;


ALTER TYPE public.app_role OWNER TO postgres;

--
-- Name: contract_template_type; Type: TYPE; Schema: public; Owner: postgres
--

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contract_template_type') THEN
        CREATE TYPE public.contract_template_type AS ENUM (
            'venda_carro',
            'venda_moto',
            'repasse',
            'consignacao',
            'distrato'
        );
    END IF;
END $$;


ALTER TYPE public.contract_template_type OWNER TO postgres;

--
-- Name: apply_stock_transfer(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION public.apply_stock_transfer() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.status = 'concluida' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'concluida') THEN
    IF NEW.transfer_type = 'parceiro_externo' THEN
      UPDATE public.vehicles SET status = 'transferido' WHERE id = NEW.vehicle_id;
    ELSE
      UPDATE public.vehicles
      SET store_id = COALESCE(NEW.to_store_id, store_id),
          reseller_id = CASE WHEN NEW.transfer_type = 'revendedor_para_loja' THEN NULL ELSE COALESCE(NEW.to_reseller_id, reseller_id) END
      WHERE id = NEW.vehicle_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.apply_stock_transfer() OWNER TO postgres;

--
-- Name: can_create_sales(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION public.can_create_sales(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT public.has_permission(_user_id,'sales.create') OR EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND custom_role_id IS NULL
      AND role::text IN ('admin','gerente','vendedor','vendedor_plus','vendedor_externo'))
$$;


ALTER FUNCTION public.can_create_sales(_user_id uuid) OWNER TO postgres;

--
-- Name: can_register_vehicles(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION public.can_register_vehicles(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT public.has_elevated_access(_user_id) OR public.has_permission(_user_id,'vehicles.create') OR EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND custom_role_id IS NULL
      AND role::text IN ('vendedor','vendedor_plus','vendedor_externo'))
$$;


ALTER FUNCTION public.can_register_vehicles(_user_id uuid) OWNER TO postgres;

--
-- Name: get_user_store_id(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION public.get_user_store_id(_user_id uuid) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT COALESCE(
    (SELECT store_id FROM public.employees
      WHERE profile_id = _user_id AND is_active AND store_id IS NOT NULL LIMIT 1),
    (SELECT store_id FROM public.resellers
      WHERE user_id = _user_id AND store_id IS NOT NULL LIMIT 1)
  )
$$;


ALTER FUNCTION public.get_user_store_id(_user_id uuid) OWNER TO postgres;

--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    NEW.email
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

--
-- Name: has_elevated_access(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION public.has_elevated_access(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT public.has_role(_user_id,'admin') OR public.has_permission(_user_id,'access.elevated')
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role='gerente' AND custom_role_id IS NULL)
$$;


ALTER FUNCTION public.has_elevated_access(_user_id uuid) OWNER TO postgres;

--
-- Name: has_permission(uuid, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _perm text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT public.has_role(_user_id,'admin') OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.custom_roles cr ON cr.id = ur.custom_role_id AND cr.is_active
    JOIN public.role_permissions rp ON rp.role_id = cr.id
    WHERE ur.user_id = _user_id AND rp.permission = _perm)
$$;


ALTER FUNCTION public.has_permission(_user_id uuid, _perm text) OWNER TO postgres;

--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;


ALTER FUNCTION public.has_role(_user_id uuid, _role public.app_role) OWNER TO postgres;

--
-- Name: is_external_seller(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION public.is_external_seller(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text = 'vendedor_externo'
  )
$$;


ALTER FUNCTION public.is_external_seller(_user_id uuid) OWNER TO postgres;

--
-- Name: normalize_contract_payment_values(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION public.normalize_contract_payment_values() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.down_payment_pix := COALESCE(NEW.down_payment_pix, 0);
  NEW.down_payment_cash := COALESCE(NEW.down_payment_cash, 0);
  NEW.down_payment_card := COALESCE(NEW.down_payment_card, 0);
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.normalize_contract_payment_values() OWNER TO postgres;

--
-- Name: notify_stock_sync(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION public.notify_stock_sync() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
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


ALTER FUNCTION public.notify_stock_sync() OWNER TO postgres;

--
-- Name: sync_vehicle_status_from_reservation(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION public.sync_vehicle_status_from_reservation() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.vehicles SET status = 'reservado' WHERE id = NEW.vehicle_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'cancelada' AND OLD.status <> 'cancelada' THEN
      UPDATE public.vehicles SET status = 'disponivel' WHERE id = NEW.vehicle_id;
    ELSIF NEW.status = 'convertida' AND OLD.status <> 'convertida' THEN
      UPDATE public.vehicles SET status = 'vendido' WHERE id = NEW.vehicle_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.sync_vehicle_status_from_reservation() OWNER TO postgres;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO postgres;

--
-- Name: user_data_scope(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION public.user_data_scope(_user_id uuid) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT CASE WHEN public.has_role(_user_id,'admin') THEN 'all' ELSE COALESCE((
    SELECT CASE MAX(CASE cr.data_scope WHEN 'all' THEN 3 WHEN 'store' THEN 2 ELSE 1 END)
      WHEN 3 THEN 'all' WHEN 2 THEN 'store' ELSE 'own' END
    FROM public.user_roles ur JOIN public.custom_roles cr ON cr.id = ur.custom_role_id AND cr.is_active
    WHERE ur.user_id = _user_id), 'own') END
$$;


ALTER FUNCTION public.user_data_scope(_user_id uuid) OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: activity_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS public.activity_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    action text NOT NULL,
    entity_type text,
    entity_id uuid,
    details jsonb,
    ip_address text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.activity_logs OWNER TO postgres;

--
-- Name: api_keys; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS public.api_keys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    key_prefix text NOT NULL,
    key_hash text NOT NULL,
    scopes text[] DEFAULT ARRAY['read'::text] NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    last_used_at timestamp with time zone,
    expires_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.api_keys OWNER TO postgres;

--
-- Name: bank_credentials; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS public.bank_credentials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    bank_code text NOT NULL,
    bank_name text NOT NULL,
    client_id text,
    client_secret text,
    api_environment text DEFAULT 'sandbox'::text NOT NULL,
    partner_code text,
    extra_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.bank_credentials OWNER TO postgres;

--
-- Name: chassis_patterns; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS public.chassis_patterns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    wmi_code text NOT NULL,
    brand text NOT NULL,
    vehicle_type text DEFAULT 'moto'::text NOT NULL,
    model_pattern text,
    model_name text,
    engine_cc integer,
    fuel_type text DEFAULT 'Flex'::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    transmission text,
    warranty_months integer,
    service_interval_months integer,
    service_interval_km integer,
    default_purchase_price numeric,
    default_sale_price numeric
);


ALTER TABLE public.chassis_patterns OWNER TO postgres;

--
-- Name: chassis_year_codes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS public.chassis_year_codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    year_code text NOT NULL,
    model_year integer NOT NULL,
    brand text,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    manufacture_year integer
);


ALTER TABLE public.chassis_year_codes OWNER TO postgres;

--
-- Name: contract_acceptances; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS public.contract_acceptances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    contract_id uuid NOT NULL,
    acceptance_token uuid DEFAULT gen_random_uuid() NOT NULL,
    revision_number integer DEFAULT 1 NOT NULL,
    accepted_at timestamp with time zone,
    accepted_ip text,
    accepted_user_agent text,
    buyer_name_typed text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid
);


ALTER TABLE public.contract_acceptances OWNER TO postgres;

--
-- Name: contract_revisions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS public.contract_revisions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    contract_id uuid NOT NULL,
    revision_number integer NOT NULL,
    active_clause_ids text[] DEFAULT ARRAY[]::text[] NOT NULL,
    clause_variables jsonb DEFAULT '{}'::jsonb NOT NULL,
    change_reason text,
    changed_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.contract_revisions OWNER TO postgres;

--
-- Name: contract_templates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS public.contract_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    template_type public.contract_template_type NOT NULL,
    is_active boolean DEFAULT false NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    header_content text,
    body_content text NOT NULL,
    clauses_content text,
    signature_content text,
    fixed_clauses text[] DEFAULT ARRAY[]::text[],
    store_id uuid,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    logo_url text,
    watermark_url text,
    signature_url text,
    watermark_opacity numeric DEFAULT 0.10 NOT NULL,
    optional_clauses jsonb DEFAULT '[]'::jsonb NOT NULL,
    vehicle_types text[] DEFAULT ARRAY['carro'::text, 'moto'::text] NOT NULL,
    clause_categories text[] DEFAULT ARRAY['Fiscal'::text, 'Garantia'::text, 'Financeiro'::text, 'Documentação'::text, 'Outros'::text] NOT NULL
);


ALTER TABLE public.contract_templates OWNER TO postgres;

--
-- Name: contracts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS public.contracts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    contract_number text NOT NULL,
    vehicle_id uuid NOT NULL,
    reseller_id uuid,
    store_id uuid NOT NULL,
    buyer_name text NOT NULL,
    buyer_cpf text NOT NULL,
    buyer_phone text,
    buyer_email text,
    buyer_address text,
    sale_price numeric(12,2) NOT NULL,
    down_payment numeric(12,2) DEFAULT 0,
    installments integer DEFAULT 1,
    installment_value numeric(12,2),
    status text DEFAULT 'pendente'::text NOT NULL,
    signed_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    signed_contract_url text,
    template_id uuid,
    contract_type text DEFAULT 'venda'::text,
    created_by uuid,
    financing_bank text,
    active_clause_ids text[] DEFAULT ARRAY[]::text[] NOT NULL,
    clause_variables jsonb DEFAULT '{}'::jsonb NOT NULL,
    revision_number integer DEFAULT 1 NOT NULL,
    payment_method text,
    down_payment_pix numeric DEFAULT 0 NOT NULL,
    down_payment_cash numeric DEFAULT 0 NOT NULL,
    down_payment_card numeric DEFAULT 0 NOT NULL,
    down_payment_card_installments integer,
    financing_installments integer,
    financing_installment_value numeric,
    lead_source text,
    lead_source_detail text,
    review_status text DEFAULT 'ok'::text NOT NULL,
    review_note text,
    review_requested_by uuid,
    review_requested_at timestamp with time zone,
    review_resolved_by uuid,
    review_resolved_at timestamp with time zone,
    review_response text,
    ad_id uuid,
    campaign_name text,
    sale_group_id uuid,
    sale_channel text DEFAULT 'interna'::text NOT NULL,
    evidence_paths text[] DEFAULT '{}'::text[] NOT NULL,
    external_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT contracts_review_status_check CHECK ((review_status = ANY (ARRAY['ok'::text, 'questionada'::text, 'corrigida'::text]))),
    CONSTRAINT contracts_status_check CHECK ((status = ANY (ARRAY['pre_venda'::text, 'pendente'::text, 'assinado'::text, 'cancelado'::text, 'concluido'::text])))
);


ALTER TABLE public.contracts OWNER TO postgres;

--
-- Name: custom_roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS public.custom_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    color text DEFAULT 'neutral'::text NOT NULL,
    data_scope text DEFAULT 'own'::text NOT NULL,
    system_key text,
    base_role public.app_role DEFAULT 'visualizador'::public.app_role NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT custom_roles_data_scope_check CHECK ((data_scope = ANY (ARRAY['own'::text, 'store'::text, 'all'::text])))
);


ALTER TABLE public.custom_roles OWNER TO postgres;

--
-- Name: employees; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS public.employees (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_id uuid,
    store_id uuid,
    full_name text NOT NULL,
    cpf text,
    role text DEFAULT 'funcionario'::text NOT NULL,
    "position" text,
    base_salary numeric DEFAULT 0 NOT NULL,
    commission_rate numeric DEFAULT 0 NOT NULL,
    hire_date date,
    phone text,
    email text,
    pix_key text,
    bank_info text,
    is_active boolean DEFAULT true NOT NULL,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    commission_tiers jsonb DEFAULT '[]'::jsonb NOT NULL,
    commission_type text DEFAULT 'percentage'::text NOT NULL,
    manager_commission_rate numeric DEFAULT 0 NOT NULL,
    transport_allowance numeric DEFAULT 0 NOT NULL,
    meal_allowance numeric DEFAULT 0 NOT NULL,
    other_allowance numeric DEFAULT 0 NOT NULL,
    salary_additions jsonb DEFAULT '[]'::jsonb NOT NULL
);


ALTER TABLE public.employees OWNER TO postgres;

--
-- Name: eula_acceptances; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS public.eula_acceptances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    version text NOT NULL,
    accepted_at timestamp with time zone DEFAULT now() NOT NULL,
    accepted_ip text,
    user_agent text,
    full_name_typed text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.eula_acceptances OWNER TO postgres;

--
-- Name: financing_banks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS public.financing_banks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    lien_holder text
);


ALTER TABLE public.financing_banks OWNER TO postgres;

--
-- Name: financing_simulations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS public.financing_simulations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    vehicle_id uuid,
    bank_code text NOT NULL,
    customer_name text NOT NULL,
    customer_document text NOT NULL,
    customer_phone text,
    customer_email text,
    customer_income numeric,
    customer_birthdate date,
    vehicle_value numeric NOT NULL,
    down_payment numeric DEFAULT 0 NOT NULL,
    installments integer NOT NULL,
    financed_amount numeric NOT NULL,
    monthly_rate numeric,
    installment_value numeric,
    total_amount numeric,
    cet numeric,
    status text DEFAULT 'pendente'::text NOT NULL,
    response_data jsonb,
    error_message text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.financing_simulations OWNER TO postgres;

--
-- Name: invoices; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS public.invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_number text NOT NULL,
    invoice_type text DEFAULT 'servico'::text NOT NULL,
    issue_date date DEFAULT CURRENT_DATE NOT NULL,
    store_id uuid,
    customer_name text NOT NULL,
    customer_document text,
    customer_address text,
    customer_email text,
    customer_phone text,
    items jsonb DEFAULT '[]'::jsonb NOT NULL,
    subtotal numeric DEFAULT 0 NOT NULL,
    tax_rate numeric DEFAULT 0 NOT NULL,
    tax_value numeric DEFAULT 0 NOT NULL,
    total numeric DEFAULT 0 NOT NULL,
    status text DEFAULT 'emitida'::text NOT NULL,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.invoices OWNER TO postgres;

--
-- Name: payroll_batches; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS public.payroll_batches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    month smallint NOT NULL,
    year smallint NOT NULL,
    status text DEFAULT 'rascunho'::text NOT NULL,
    total_bruto numeric(12,2) DEFAULT 0 NOT NULL,
    total_liquido numeric(12,2) DEFAULT 0 NOT NULL,
    total_encargos numeric(12,2) DEFAULT 0 NOT NULL,
    employee_count integer DEFAULT 0 NOT NULL,
    closed_at timestamp with time zone,
    closed_by uuid,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT payroll_batches_month_check CHECK (((month >= 1) AND (month <= 12))),
    CONSTRAINT payroll_batches_status_check CHECK ((status = ANY (ARRAY['rascunho'::text, 'aprovado'::text, 'fechado'::text]))),
    CONSTRAINT payroll_batches_year_check CHECK (((year >= 2020) AND (year <= 2100)))
);


ALTER TABLE public.payroll_batches OWNER TO postgres;

--
-- Name: payroll_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS public.payroll_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    closing_day smallint DEFAULT 30 NOT NULL,
    reminder_days_before smallint DEFAULT 5 NOT NULL,
    auto_reminder_enabled boolean DEFAULT true NOT NULL,
    default_dependents smallint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.payroll_settings OWNER TO postgres;

--
-- Name: payslips; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS public.payslips (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    payslip_number text NOT NULL,
    employee_id uuid NOT NULL,
    store_id uuid,
    reference_month integer NOT NULL,
    reference_year integer NOT NULL,
    base_salary numeric DEFAULT 0 NOT NULL,
    commission_amount numeric DEFAULT 0 NOT NULL,
    commission_sales_total numeric DEFAULT 0 NOT NULL,
    bonus numeric DEFAULT 0 NOT NULL,
    overtime numeric DEFAULT 0 NOT NULL,
    inss_discount numeric DEFAULT 0 NOT NULL,
    irrf_discount numeric DEFAULT 0 NOT NULL,
    other_discounts numeric DEFAULT 0 NOT NULL,
    net_total numeric DEFAULT 0 NOT NULL,
    payment_date date,
    payment_method text,
    status text DEFAULT 'pendente'::text NOT NULL,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    transport_allowance numeric DEFAULT 0 NOT NULL,
    meal_allowance numeric DEFAULT 0 NOT NULL,
    other_allowance numeric DEFAULT 0 NOT NULL,
    manager_commission numeric DEFAULT 0 NOT NULL,
    additions jsonb DEFAULT '[]'::jsonb NOT NULL,
    batch_id uuid,
    breakdown jsonb DEFAULT '{}'::jsonb,
    sent_email_at timestamp with time zone,
    sent_whatsapp_at timestamp with time zone,
    CONSTRAINT payslips_reference_month_check CHECK (((reference_month >= 1) AND (reference_month <= 12)))
);


ALTER TABLE public.payslips OWNER TO postgres;

--
-- Name: profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid NOT NULL,
    full_name text NOT NULL,
    email text NOT NULL,
    phone text,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    must_change_password boolean DEFAULT false
);


ALTER TABLE public.profiles OWNER TO postgres;

--
-- Name: reseller_consignment_contracts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS public.reseller_consignment_contracts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vehicle_id uuid NOT NULL,
    reseller_id uuid NOT NULL,
    store_id uuid NOT NULL,
    vehicle_cost numeric NOT NULL,
    payment_type text DEFAULT 'percentage'::text NOT NULL,
    upfront_percentage numeric DEFAULT 0,
    upfront_amount numeric DEFAULT 0,
    remaining_percentage numeric DEFAULT 0,
    remaining_amount numeric DEFAULT 0,
    full_payment_amount numeric DEFAULT 0,
    upfront_paid boolean DEFAULT false,
    upfront_paid_at timestamp with time zone,
    remaining_paid boolean DEFAULT false,
    remaining_paid_at timestamp with time zone,
    status text DEFAULT 'ativo'::text NOT NULL,
    terms text,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.reseller_consignment_contracts OWNER TO postgres;

--
-- Name: resellers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS public.resellers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    store_id uuid,
    full_name text NOT NULL,
    cpf text,
    phone text,
    email text,
    commission_rate numeric(5,2) DEFAULT 0,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    partner_type text DEFAULT 'parceiro_externo'::text NOT NULL,
    CONSTRAINT resellers_partner_type_check CHECK ((partner_type = ANY (ARRAY['parceiro_externo'::text, 'consignado'::text, 'interno'::text])))
);


ALTER TABLE public.resellers OWNER TO postgres;

--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS public.role_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    role_id uuid NOT NULL,
    permission text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.role_permissions OWNER TO postgres;

--
-- Name: sales_targets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS public.sales_targets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid,
    user_id uuid,
    month smallint NOT NULL,
    year smallint NOT NULL,
    target_qty integer DEFAULT 0 NOT NULL,
    target_value numeric DEFAULT 0 NOT NULL,
    bonus_on_target numeric DEFAULT 0 NOT NULL,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.sales_targets OWNER TO postgres;

--
-- Name: stock_sync_config; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS public.stock_sync_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    spreadsheet_id text,
    sheet_name text DEFAULT 'Estoque'::text NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    function_url text,
    function_token text,
    last_pushed_at timestamp with time zone,
    last_pulled_at timestamp with time zone,
    last_error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.stock_sync_config OWNER TO postgres;

--
-- Name: stock_transfers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS public.stock_transfers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vehicle_id uuid NOT NULL,
    transfer_type text DEFAULT 'loja_para_revendedor'::text NOT NULL,
    from_store_id uuid,
    to_store_id uuid,
    from_reseller_id uuid,
    to_reseller_id uuid,
    partner_name text,
    agreed_amount numeric DEFAULT 0 NOT NULL,
    received_amount numeric DEFAULT 0 NOT NULL,
    status text DEFAULT 'pendente'::text NOT NULL,
    transfer_date date DEFAULT CURRENT_DATE NOT NULL,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT stock_transfers_status_check CHECK ((status = ANY (ARRAY['pendente'::text, 'concluida'::text, 'cancelada'::text]))),
    CONSTRAINT stock_transfers_transfer_type_check CHECK ((transfer_type = ANY (ARRAY['loja_para_loja'::text, 'loja_para_revendedor'::text, 'revendedor_para_loja'::text, 'parceiro_externo'::text])))
);


ALTER TABLE public.stock_transfers OWNER TO postgres;

--
-- Name: store_ads; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS public.store_ads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    campaign_name text NOT NULL,
    title text NOT NULL,
    platform text DEFAULT 'instagram'::text NOT NULL,
    image_url text,
    caption text,
    ad_url text,
    started_at date,
    ended_at date,
    budget_spent numeric DEFAULT 0 NOT NULL,
    status text DEFAULT 'ativo'::text NOT NULL,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.store_ads OWNER TO postgres;

--
-- Name: stores; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS public.stores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    address text,
    city text,
    state text,
    phone text,
    email text,
    manager_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    cnpj text,
    instagram_handle text
);


ALTER TABLE public.stores OWNER TO postgres;

--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role DEFAULT 'visualizador'::public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    custom_role_id uuid
);


ALTER TABLE public.user_roles OWNER TO postgres;

--
-- Name: vehicle_colors; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS public.vehicle_colors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    hex text,
    vehicle_model_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    hex_secondary text,
    vehicle_model_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    model_scope text DEFAULT 'todos'::text NOT NULL,
    CONSTRAINT vehicle_colors_model_scope_check CHECK ((model_scope = ANY (ARRAY['todos'::text, 'apenas'::text, 'exceto'::text])))
);


ALTER TABLE public.vehicle_colors OWNER TO postgres;

--
-- Name: vehicle_models; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS public.vehicle_models (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    brand text NOT NULL,
    model text NOT NULL,
    vehicle_type text DEFAULT 'moto'::text NOT NULL,
    engine_cc integer,
    fuel_type text,
    transmission text,
    warranty_months integer,
    revision_period_months integer,
    revision_period_km integer,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    default_purchase_price numeric,
    default_sale_price numeric,
    promo_price numeric,
    promo_active boolean DEFAULT false NOT NULL,
    promo_label text,
    promo_ends_on date
);


ALTER TABLE public.vehicle_models OWNER TO postgres;

--
-- Name: vehicle_reservations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS public.vehicle_reservations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reservation_number text NOT NULL,
    vehicle_id uuid NOT NULL,
    store_id uuid NOT NULL,
    reseller_id uuid,
    created_by uuid,
    buyer_name text NOT NULL,
    buyer_cpf text NOT NULL,
    buyer_phone text,
    buyer_email text,
    buyer_address text,
    vehicle_price numeric NOT NULL,
    reservation_amount numeric DEFAULT 0 NOT NULL,
    payment_method text,
    reservation_date date DEFAULT CURRENT_DATE NOT NULL,
    expires_at date,
    status text DEFAULT 'ativa'::text NOT NULL,
    converted_contract_id uuid,
    signed_contract_url text,
    template_id uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.vehicle_reservations OWNER TO postgres;

--
-- Name: vehicles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS public.vehicles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid,
    brand text NOT NULL,
    model text NOT NULL,
    year integer NOT NULL,
    color text,
    plate text,
    chassis text,
    renavam text,
    mileage integer DEFAULT 0,
    fuel_type text,
    transmission text,
    purchase_price numeric(12,2),
    sale_price numeric(12,2),
    status text DEFAULT 'disponivel'::text NOT NULL,
    images text[],
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    vehicle_type text DEFAULT 'carro'::text,
    engine_cc integer,
    reseller_id uuid,
    warranty_months integer,
    revision_period_months integer,
    revision_period_km integer,
    manufacture_year integer,
    CONSTRAINT vehicles_status_check CHECK ((status = ANY (ARRAY['disponivel'::text, 'reservado'::text, 'vendido'::text, 'transferido'::text]))),
    CONSTRAINT vehicles_vehicle_type_check CHECK ((vehicle_type = ANY (ARRAY['carro'::text, 'moto'::text])))
);


ALTER TABLE public.vehicles OWNER TO postgres;

--
-- Name: COLUMN vehicles.reseller_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.vehicles.reseller_id IS 'ID do revendedor responsável pelo veículo (null = estoque da loja)';


--
-- Name: COLUMN vehicles.manufacture_year; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.vehicles.manufacture_year IS 'Ano de fabricacao (controle interno). A coluna year representa o ano modelo usado em contratos.';


--
-- Name: activity_logs activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activity_logs DROP CONSTRAINT IF EXISTS activity_logs_pkey;
ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_pkey PRIMARY KEY (id);


--
-- Name: api_keys api_keys_key_hash_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.api_keys DROP CONSTRAINT IF EXISTS api_keys_key_hash_key;
ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_key_hash_key UNIQUE (key_hash);


--
-- Name: api_keys api_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.api_keys DROP CONSTRAINT IF EXISTS api_keys_pkey;
ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_pkey PRIMARY KEY (id);


--
-- Name: bank_credentials bank_credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bank_credentials DROP CONSTRAINT IF EXISTS bank_credentials_pkey;
ALTER TABLE ONLY public.bank_credentials
    ADD CONSTRAINT bank_credentials_pkey PRIMARY KEY (id);


--
-- Name: bank_credentials bank_credentials_store_id_bank_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bank_credentials DROP CONSTRAINT IF EXISTS bank_credentials_store_id_bank_code_key;
ALTER TABLE ONLY public.bank_credentials
    ADD CONSTRAINT bank_credentials_store_id_bank_code_key UNIQUE (store_id, bank_code);


--
-- Name: chassis_patterns chassis_patterns_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chassis_patterns DROP CONSTRAINT IF EXISTS chassis_patterns_pkey;
ALTER TABLE ONLY public.chassis_patterns
    ADD CONSTRAINT chassis_patterns_pkey PRIMARY KEY (id);


--
-- Name: chassis_year_codes chassis_year_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chassis_year_codes DROP CONSTRAINT IF EXISTS chassis_year_codes_pkey;
ALTER TABLE ONLY public.chassis_year_codes
    ADD CONSTRAINT chassis_year_codes_pkey PRIMARY KEY (id);


--
-- Name: contract_acceptances contract_acceptances_acceptance_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contract_acceptances DROP CONSTRAINT IF EXISTS contract_acceptances_acceptance_token_key;
ALTER TABLE ONLY public.contract_acceptances
    ADD CONSTRAINT contract_acceptances_acceptance_token_key UNIQUE (acceptance_token);


--
-- Name: contract_acceptances contract_acceptances_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contract_acceptances DROP CONSTRAINT IF EXISTS contract_acceptances_pkey;
ALTER TABLE ONLY public.contract_acceptances
    ADD CONSTRAINT contract_acceptances_pkey PRIMARY KEY (id);


--
-- Name: contract_revisions contract_revisions_contract_id_revision_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contract_revisions DROP CONSTRAINT IF EXISTS contract_revisions_contract_id_revision_number_key;
ALTER TABLE ONLY public.contract_revisions
    ADD CONSTRAINT contract_revisions_contract_id_revision_number_key UNIQUE (contract_id, revision_number);


--
-- Name: contract_revisions contract_revisions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contract_revisions DROP CONSTRAINT IF EXISTS contract_revisions_pkey;
ALTER TABLE ONLY public.contract_revisions
    ADD CONSTRAINT contract_revisions_pkey PRIMARY KEY (id);


--
-- Name: contract_templates contract_templates_name_template_type_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contract_templates DROP CONSTRAINT IF EXISTS contract_templates_name_template_type_key;
ALTER TABLE ONLY public.contract_templates
    ADD CONSTRAINT contract_templates_name_template_type_key UNIQUE (name, template_type);


--
-- Name: contract_templates contract_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contract_templates DROP CONSTRAINT IF EXISTS contract_templates_pkey;
ALTER TABLE ONLY public.contract_templates
    ADD CONSTRAINT contract_templates_pkey PRIMARY KEY (id);


--
-- Name: contracts contracts_contract_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contracts DROP CONSTRAINT IF EXISTS contracts_contract_number_key;
ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_contract_number_key UNIQUE (contract_number);


--
-- Name: contracts contracts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contracts DROP CONSTRAINT IF EXISTS contracts_pkey;
ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_pkey PRIMARY KEY (id);


--
-- Name: custom_roles custom_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.custom_roles DROP CONSTRAINT IF EXISTS custom_roles_pkey;
ALTER TABLE ONLY public.custom_roles
    ADD CONSTRAINT custom_roles_pkey PRIMARY KEY (id);


--
-- Name: custom_roles custom_roles_system_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.custom_roles DROP CONSTRAINT IF EXISTS custom_roles_system_key_key;
ALTER TABLE ONLY public.custom_roles
    ADD CONSTRAINT custom_roles_system_key_key UNIQUE (system_key);


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees DROP CONSTRAINT IF EXISTS employees_pkey;
ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);


--
-- Name: eula_acceptances eula_acceptances_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.eula_acceptances DROP CONSTRAINT IF EXISTS eula_acceptances_pkey;
ALTER TABLE ONLY public.eula_acceptances
    ADD CONSTRAINT eula_acceptances_pkey PRIMARY KEY (id);


--
-- Name: eula_acceptances eula_acceptances_user_id_version_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.eula_acceptances DROP CONSTRAINT IF EXISTS eula_acceptances_user_id_version_key;
ALTER TABLE ONLY public.eula_acceptances
    ADD CONSTRAINT eula_acceptances_user_id_version_key UNIQUE (user_id, version);


--
-- Name: financing_banks financing_banks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.financing_banks DROP CONSTRAINT IF EXISTS financing_banks_pkey;
ALTER TABLE ONLY public.financing_banks
    ADD CONSTRAINT financing_banks_pkey PRIMARY KEY (id);


--
-- Name: financing_simulations financing_simulations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.financing_simulations DROP CONSTRAINT IF EXISTS financing_simulations_pkey;
ALTER TABLE ONLY public.financing_simulations
    ADD CONSTRAINT financing_simulations_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices DROP CONSTRAINT IF EXISTS invoices_pkey;
ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: payroll_batches payroll_batches_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payroll_batches DROP CONSTRAINT IF EXISTS payroll_batches_pkey;
ALTER TABLE ONLY public.payroll_batches
    ADD CONSTRAINT payroll_batches_pkey PRIMARY KEY (id);


--
-- Name: payroll_batches payroll_batches_year_month_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payroll_batches DROP CONSTRAINT IF EXISTS payroll_batches_year_month_key;
ALTER TABLE ONLY public.payroll_batches
    ADD CONSTRAINT payroll_batches_year_month_key UNIQUE (year, month);


--
-- Name: payroll_settings payroll_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payroll_settings DROP CONSTRAINT IF EXISTS payroll_settings_pkey;
ALTER TABLE ONLY public.payroll_settings
    ADD CONSTRAINT payroll_settings_pkey PRIMARY KEY (id);


--
-- Name: payslips payslips_employee_id_reference_month_reference_year_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payslips DROP CONSTRAINT IF EXISTS payslips_employee_id_reference_month_reference_year_key;
ALTER TABLE ONLY public.payslips
    ADD CONSTRAINT payslips_employee_id_reference_month_reference_year_key UNIQUE (employee_id, reference_month, reference_year);


--
-- Name: payslips payslips_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payslips DROP CONSTRAINT IF EXISTS payslips_pkey;
ALTER TABLE ONLY public.payslips
    ADD CONSTRAINT payslips_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles DROP CONSTRAINT IF EXISTS profiles_pkey;
ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: reseller_consignment_contracts reseller_consignment_contracts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reseller_consignment_contracts DROP CONSTRAINT IF EXISTS reseller_consignment_contracts_pkey;
ALTER TABLE ONLY public.reseller_consignment_contracts
    ADD CONSTRAINT reseller_consignment_contracts_pkey PRIMARY KEY (id);


--
-- Name: resellers resellers_cpf_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resellers DROP CONSTRAINT IF EXISTS resellers_cpf_key;
ALTER TABLE ONLY public.resellers
    ADD CONSTRAINT resellers_cpf_key UNIQUE (cpf);


--
-- Name: resellers resellers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resellers DROP CONSTRAINT IF EXISTS resellers_pkey;
ALTER TABLE ONLY public.resellers
    ADD CONSTRAINT resellers_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions DROP CONSTRAINT IF EXISTS role_permissions_pkey;
ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_role_id_permission_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions DROP CONSTRAINT IF EXISTS role_permissions_role_id_permission_key;
ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_permission_key UNIQUE (role_id, permission);


--
-- Name: sales_targets sales_targets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales_targets DROP CONSTRAINT IF EXISTS sales_targets_pkey;
ALTER TABLE ONLY public.sales_targets
    ADD CONSTRAINT sales_targets_pkey PRIMARY KEY (id);


--
-- Name: stock_sync_config stock_sync_config_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_sync_config DROP CONSTRAINT IF EXISTS stock_sync_config_pkey;
ALTER TABLE ONLY public.stock_sync_config
    ADD CONSTRAINT stock_sync_config_pkey PRIMARY KEY (id);


--
-- Name: stock_transfers stock_transfers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_transfers DROP CONSTRAINT IF EXISTS stock_transfers_pkey;
ALTER TABLE ONLY public.stock_transfers
    ADD CONSTRAINT stock_transfers_pkey PRIMARY KEY (id);


--
-- Name: store_ads store_ads_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.store_ads DROP CONSTRAINT IF EXISTS store_ads_pkey;
ALTER TABLE ONLY public.store_ads
    ADD CONSTRAINT store_ads_pkey PRIMARY KEY (id);


--
-- Name: stores stores_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stores DROP CONSTRAINT IF EXISTS stores_pkey;
ALTER TABLE ONLY public.stores
    ADD CONSTRAINT stores_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles DROP CONSTRAINT IF EXISTS user_roles_pkey;
ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_role_key;
ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: vehicle_colors vehicle_colors_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vehicle_colors DROP CONSTRAINT IF EXISTS vehicle_colors_pkey;
ALTER TABLE ONLY public.vehicle_colors
    ADD CONSTRAINT vehicle_colors_pkey PRIMARY KEY (id);


--
-- Name: vehicle_models vehicle_models_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vehicle_models DROP CONSTRAINT IF EXISTS vehicle_models_pkey;
ALTER TABLE ONLY public.vehicle_models
    ADD CONSTRAINT vehicle_models_pkey PRIMARY KEY (id);


--
-- Name: vehicle_reservations vehicle_reservations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vehicle_reservations DROP CONSTRAINT IF EXISTS vehicle_reservations_pkey;
ALTER TABLE ONLY public.vehicle_reservations
    ADD CONSTRAINT vehicle_reservations_pkey PRIMARY KEY (id);


--
-- Name: vehicle_reservations vehicle_reservations_reservation_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vehicle_reservations DROP CONSTRAINT IF EXISTS vehicle_reservations_reservation_number_key;
ALTER TABLE ONLY public.vehicle_reservations
    ADD CONSTRAINT vehicle_reservations_reservation_number_key UNIQUE (reservation_number);


--
-- Name: vehicles vehicles_chassis_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vehicles DROP CONSTRAINT IF EXISTS vehicles_chassis_key;
ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_chassis_key UNIQUE (chassis);


--
-- Name: vehicles vehicles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vehicles DROP CONSTRAINT IF EXISTS vehicles_pkey;
ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_pkey PRIMARY KEY (id);


--
-- Name: vehicles vehicles_plate_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vehicles DROP CONSTRAINT IF EXISTS vehicles_plate_key;
ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_plate_key UNIQUE (plate);


--
-- Name: chassis_year_codes_code_brand_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX IF NOT EXISTS chassis_year_codes_code_brand_idx ON public.chassis_year_codes USING btree (upper(year_code), COALESCE(upper(brand), ''::text));


--
-- Name: contract_acceptances_contract_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX IF NOT EXISTS contract_acceptances_contract_id_idx ON public.contract_acceptances USING btree (contract_id);


--
-- Name: contracts_sale_channel_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX IF NOT EXISTS contracts_sale_channel_idx ON public.contracts USING btree (sale_channel);


--
-- Name: contracts_sale_group_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX IF NOT EXISTS contracts_sale_group_id_idx ON public.contracts USING btree (sale_group_id);


--
-- Name: employees_profile_id_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX IF NOT EXISTS employees_profile_id_unique ON public.employees USING btree (profile_id) WHERE (profile_id IS NOT NULL);


--
-- Name: financing_banks_name_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX IF NOT EXISTS financing_banks_name_key ON public.financing_banks USING btree (upper(name));


--
-- Name: idx_activity_logs_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs USING btree (created_at DESC);


--
-- Name: idx_activity_logs_entity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON public.activity_logs USING btree (entity_type, entity_id);


--
-- Name: idx_contracts_ad; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX IF NOT EXISTS idx_contracts_ad ON public.contracts USING btree (ad_id);


--
-- Name: idx_contracts_review_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX IF NOT EXISTS idx_contracts_review_status ON public.contracts USING btree (review_status);


--
-- Name: idx_payslips_batch; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX IF NOT EXISTS idx_payslips_batch ON public.payslips USING btree (batch_id);


--
-- Name: idx_store_ads_store; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX IF NOT EXISTS idx_store_ads_store ON public.store_ads USING btree (store_id, status);


--
-- Name: idx_vehicles_reseller_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX IF NOT EXISTS idx_vehicles_reseller_id ON public.vehicles USING btree (reseller_id);


--
-- Name: vehicle_colors_unique_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX IF NOT EXISTS vehicle_colors_unique_name ON public.vehicle_colors USING btree (upper(name), COALESCE(vehicle_model_id, '00000000-0000-0000-0000-000000000000'::uuid));


--
-- Name: vehicle_models_unique_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX IF NOT EXISTS vehicle_models_unique_idx ON public.vehicle_models USING btree (lower(brand), lower(model), vehicle_type);


--
-- Name: api_keys api_keys_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

DROP TRIGGER IF EXISTS api_keys_updated_at ON public.api_keys;
CREATE TRIGGER api_keys_updated_at BEFORE UPDATE ON public.api_keys FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: bank_credentials bank_credentials_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

DROP TRIGGER IF EXISTS bank_credentials_updated_at ON public.bank_credentials;
CREATE TRIGGER bank_credentials_updated_at BEFORE UPDATE ON public.bank_credentials FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: chassis_year_codes chassis_year_codes_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

DROP TRIGGER IF EXISTS chassis_year_codes_updated_at ON public.chassis_year_codes;
CREATE TRIGGER chassis_year_codes_updated_at BEFORE UPDATE ON public.chassis_year_codes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: custom_roles custom_roles_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

DROP TRIGGER IF EXISTS custom_roles_updated_at ON public.custom_roles;
CREATE TRIGGER custom_roles_updated_at BEFORE UPDATE ON public.custom_roles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: financing_banks financing_banks_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

DROP TRIGGER IF EXISTS financing_banks_updated_at ON public.financing_banks;
CREATE TRIGGER financing_banks_updated_at BEFORE UPDATE ON public.financing_banks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: financing_simulations financing_simulations_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

DROP TRIGGER IF EXISTS financing_simulations_updated_at ON public.financing_simulations;
CREATE TRIGGER financing_simulations_updated_at BEFORE UPDATE ON public.financing_simulations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: contracts normalize_contract_payment_values_before_write; Type: TRIGGER; Schema: public; Owner: postgres
--

DROP TRIGGER IF EXISTS normalize_contract_payment_values_before_write ON public.contracts;
CREATE TRIGGER normalize_contract_payment_values_before_write BEFORE INSERT OR UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.normalize_contract_payment_values();


--
-- Name: payroll_batches payroll_batches_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

DROP TRIGGER IF EXISTS payroll_batches_updated_at ON public.payroll_batches;
CREATE TRIGGER payroll_batches_updated_at BEFORE UPDATE ON public.payroll_batches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: payroll_settings payroll_settings_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

DROP TRIGGER IF EXISTS payroll_settings_updated_at ON public.payroll_settings;
CREATE TRIGGER payroll_settings_updated_at BEFORE UPDATE ON public.payroll_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: store_ads store_ads_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

DROP TRIGGER IF EXISTS store_ads_updated_at ON public.store_ads;
CREATE TRIGGER store_ads_updated_at BEFORE UPDATE ON public.store_ads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: stock_transfers trg_apply_stock_transfer_ins; Type: TRIGGER; Schema: public; Owner: postgres
--

DROP TRIGGER IF EXISTS trg_apply_stock_transfer_ins ON public.stock_transfers;
CREATE TRIGGER trg_apply_stock_transfer_ins AFTER INSERT ON public.stock_transfers FOR EACH ROW EXECUTE FUNCTION public.apply_stock_transfer();


--
-- Name: stock_transfers trg_apply_stock_transfer_upd; Type: TRIGGER; Schema: public; Owner: postgres
--

DROP TRIGGER IF EXISTS trg_apply_stock_transfer_upd ON public.stock_transfers;
CREATE TRIGGER trg_apply_stock_transfer_upd AFTER UPDATE ON public.stock_transfers FOR EACH ROW EXECUTE FUNCTION public.apply_stock_transfer();


--
-- Name: stock_sync_config trg_stock_sync_config_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

DROP TRIGGER IF EXISTS trg_stock_sync_config_updated_at ON public.stock_sync_config;
CREATE TRIGGER trg_stock_sync_config_updated_at BEFORE UPDATE ON public.stock_sync_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: vehicle_reservations trg_sync_vehicle_status_from_reservation_ins; Type: TRIGGER; Schema: public; Owner: postgres
--

DROP TRIGGER IF EXISTS trg_sync_vehicle_status_from_reservation_ins ON public.vehicle_reservations;
CREATE TRIGGER trg_sync_vehicle_status_from_reservation_ins AFTER INSERT ON public.vehicle_reservations FOR EACH ROW EXECUTE FUNCTION public.sync_vehicle_status_from_reservation();


--
-- Name: vehicle_reservations trg_sync_vehicle_status_from_reservation_upd; Type: TRIGGER; Schema: public; Owner: postgres
--

DROP TRIGGER IF EXISTS trg_sync_vehicle_status_from_reservation_upd ON public.vehicle_reservations;
CREATE TRIGGER trg_sync_vehicle_status_from_reservation_upd AFTER UPDATE ON public.vehicle_reservations FOR EACH ROW EXECUTE FUNCTION public.sync_vehicle_status_from_reservation();


--
-- Name: chassis_patterns update_chassis_patterns_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

DROP TRIGGER IF EXISTS update_chassis_patterns_updated_at ON public.chassis_patterns;
CREATE TRIGGER update_chassis_patterns_updated_at BEFORE UPDATE ON public.chassis_patterns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: contract_templates update_contract_templates_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

DROP TRIGGER IF EXISTS update_contract_templates_updated_at ON public.contract_templates;
CREATE TRIGGER update_contract_templates_updated_at BEFORE UPDATE ON public.contract_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: contracts update_contracts_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

DROP TRIGGER IF EXISTS update_contracts_updated_at ON public.contracts;
CREATE TRIGGER update_contracts_updated_at BEFORE UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: employees update_employees_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

DROP TRIGGER IF EXISTS update_employees_updated_at ON public.employees;
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: invoices update_invoices_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

DROP TRIGGER IF EXISTS update_invoices_updated_at ON public.invoices;
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: payslips update_payslips_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

DROP TRIGGER IF EXISTS update_payslips_updated_at ON public.payslips;
CREATE TRIGGER update_payslips_updated_at BEFORE UPDATE ON public.payslips FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: reseller_consignment_contracts update_reseller_consignment_contracts_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

DROP TRIGGER IF EXISTS update_reseller_consignment_contracts_updated_at ON public.reseller_consignment_contracts;
CREATE TRIGGER update_reseller_consignment_contracts_updated_at BEFORE UPDATE ON public.reseller_consignment_contracts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: resellers update_resellers_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

DROP TRIGGER IF EXISTS update_resellers_updated_at ON public.resellers;
CREATE TRIGGER update_resellers_updated_at BEFORE UPDATE ON public.resellers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: sales_targets update_sales_targets_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

DROP TRIGGER IF EXISTS update_sales_targets_updated_at ON public.sales_targets;
CREATE TRIGGER update_sales_targets_updated_at BEFORE UPDATE ON public.sales_targets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: stock_transfers update_stock_transfers_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

DROP TRIGGER IF EXISTS update_stock_transfers_updated_at ON public.stock_transfers;
CREATE TRIGGER update_stock_transfers_updated_at BEFORE UPDATE ON public.stock_transfers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: stores update_stores_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

DROP TRIGGER IF EXISTS update_stores_updated_at ON public.stores;
CREATE TRIGGER update_stores_updated_at BEFORE UPDATE ON public.stores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: vehicle_reservations update_vehicle_reservations_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

DROP TRIGGER IF EXISTS update_vehicle_reservations_updated_at ON public.vehicle_reservations;
CREATE TRIGGER update_vehicle_reservations_updated_at BEFORE UPDATE ON public.vehicle_reservations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: vehicles update_vehicles_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

DROP TRIGGER IF EXISTS update_vehicles_updated_at ON public.vehicles;
CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: vehicle_colors vehicle_colors_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

DROP TRIGGER IF EXISTS vehicle_colors_updated_at ON public.vehicle_colors;
CREATE TRIGGER vehicle_colors_updated_at BEFORE UPDATE ON public.vehicle_colors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: vehicle_models vehicle_models_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

DROP TRIGGER IF EXISTS vehicle_models_updated_at ON public.vehicle_models;
CREATE TRIGGER vehicle_models_updated_at BEFORE UPDATE ON public.vehicle_models FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: activity_logs activity_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activity_logs DROP CONSTRAINT IF EXISTS activity_logs_user_id_fkey;
ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: contract_acceptances contract_acceptances_contract_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contract_acceptances DROP CONSTRAINT IF EXISTS contract_acceptances_contract_id_fkey;
ALTER TABLE ONLY public.contract_acceptances
    ADD CONSTRAINT contract_acceptances_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.contracts(id) ON DELETE CASCADE;


--
-- Name: contract_acceptances contract_acceptances_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contract_acceptances DROP CONSTRAINT IF EXISTS contract_acceptances_created_by_fkey;
ALTER TABLE ONLY public.contract_acceptances
    ADD CONSTRAINT contract_acceptances_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: contract_revisions contract_revisions_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contract_revisions DROP CONSTRAINT IF EXISTS contract_revisions_changed_by_fkey;
ALTER TABLE ONLY public.contract_revisions
    ADD CONSTRAINT contract_revisions_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES auth.users(id);


--
-- Name: contract_revisions contract_revisions_contract_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contract_revisions DROP CONSTRAINT IF EXISTS contract_revisions_contract_id_fkey;
ALTER TABLE ONLY public.contract_revisions
    ADD CONSTRAINT contract_revisions_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.contracts(id) ON DELETE CASCADE;


--
-- Name: contract_templates contract_templates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contract_templates DROP CONSTRAINT IF EXISTS contract_templates_created_by_fkey;
ALTER TABLE ONLY public.contract_templates
    ADD CONSTRAINT contract_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: contract_templates contract_templates_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contract_templates DROP CONSTRAINT IF EXISTS contract_templates_store_id_fkey;
ALTER TABLE ONLY public.contract_templates
    ADD CONSTRAINT contract_templates_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE SET NULL;


--
-- Name: contract_templates contract_templates_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contract_templates DROP CONSTRAINT IF EXISTS contract_templates_updated_by_fkey;
ALTER TABLE ONLY public.contract_templates
    ADD CONSTRAINT contract_templates_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);


--
-- Name: contracts contracts_ad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contracts DROP CONSTRAINT IF EXISTS contracts_ad_id_fkey;
ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_ad_id_fkey FOREIGN KEY (ad_id) REFERENCES public.store_ads(id) ON DELETE SET NULL;


--
-- Name: contracts contracts_reseller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contracts DROP CONSTRAINT IF EXISTS contracts_reseller_id_fkey;
ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_reseller_id_fkey FOREIGN KEY (reseller_id) REFERENCES public.resellers(id) ON DELETE RESTRICT;


--
-- Name: contracts contracts_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contracts DROP CONSTRAINT IF EXISTS contracts_store_id_fkey;
ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE RESTRICT;


--
-- Name: contracts contracts_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contracts DROP CONSTRAINT IF EXISTS contracts_template_id_fkey;
ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.contract_templates(id);


--
-- Name: contracts contracts_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contracts DROP CONSTRAINT IF EXISTS contracts_vehicle_id_fkey;
ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE RESTRICT;


--
-- Name: employees employees_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees DROP CONSTRAINT IF EXISTS employees_profile_id_fkey;
ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: employees employees_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees DROP CONSTRAINT IF EXISTS employees_store_id_fkey;
ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE SET NULL;


--
-- Name: eula_acceptances eula_acceptances_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.eula_acceptances DROP CONSTRAINT IF EXISTS eula_acceptances_user_id_fkey;
ALTER TABLE ONLY public.eula_acceptances
    ADD CONSTRAINT eula_acceptances_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: payroll_batches payroll_batches_closed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payroll_batches DROP CONSTRAINT IF EXISTS payroll_batches_closed_by_fkey;
ALTER TABLE ONLY public.payroll_batches
    ADD CONSTRAINT payroll_batches_closed_by_fkey FOREIGN KEY (closed_by) REFERENCES auth.users(id);


--
-- Name: payroll_batches payroll_batches_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payroll_batches DROP CONSTRAINT IF EXISTS payroll_batches_created_by_fkey;
ALTER TABLE ONLY public.payroll_batches
    ADD CONSTRAINT payroll_batches_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: payslips payslips_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payslips DROP CONSTRAINT IF EXISTS payslips_batch_id_fkey;
ALTER TABLE ONLY public.payslips
    ADD CONSTRAINT payslips_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.payroll_batches(id) ON DELETE SET NULL;


--
-- Name: payslips payslips_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payslips DROP CONSTRAINT IF EXISTS payslips_employee_id_fkey;
ALTER TABLE ONLY public.payslips
    ADD CONSTRAINT payslips_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: payslips payslips_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payslips DROP CONSTRAINT IF EXISTS payslips_store_id_fkey;
ALTER TABLE ONLY public.payslips
    ADD CONSTRAINT payslips_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE SET NULL;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: reseller_consignment_contracts reseller_consignment_contracts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reseller_consignment_contracts DROP CONSTRAINT IF EXISTS reseller_consignment_contracts_created_by_fkey;
ALTER TABLE ONLY public.reseller_consignment_contracts
    ADD CONSTRAINT reseller_consignment_contracts_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: reseller_consignment_contracts reseller_consignment_contracts_reseller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reseller_consignment_contracts DROP CONSTRAINT IF EXISTS reseller_consignment_contracts_reseller_id_fkey;
ALTER TABLE ONLY public.reseller_consignment_contracts
    ADD CONSTRAINT reseller_consignment_contracts_reseller_id_fkey FOREIGN KEY (reseller_id) REFERENCES public.resellers(id) ON DELETE CASCADE;


--
-- Name: reseller_consignment_contracts reseller_consignment_contracts_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reseller_consignment_contracts DROP CONSTRAINT IF EXISTS reseller_consignment_contracts_store_id_fkey;
ALTER TABLE ONLY public.reseller_consignment_contracts
    ADD CONSTRAINT reseller_consignment_contracts_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;


--
-- Name: reseller_consignment_contracts reseller_consignment_contracts_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reseller_consignment_contracts DROP CONSTRAINT IF EXISTS reseller_consignment_contracts_vehicle_id_fkey;
ALTER TABLE ONLY public.reseller_consignment_contracts
    ADD CONSTRAINT reseller_consignment_contracts_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;


--
-- Name: resellers resellers_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resellers DROP CONSTRAINT IF EXISTS resellers_store_id_fkey;
ALTER TABLE ONLY public.resellers
    ADD CONSTRAINT resellers_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE SET NULL;


--
-- Name: resellers resellers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resellers DROP CONSTRAINT IF EXISTS resellers_user_id_fkey;
ALTER TABLE ONLY public.resellers
    ADD CONSTRAINT resellers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: role_permissions role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions DROP CONSTRAINT IF EXISTS role_permissions_role_id_fkey;
ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.custom_roles(id) ON DELETE CASCADE;


--
-- Name: sales_targets sales_targets_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales_targets DROP CONSTRAINT IF EXISTS sales_targets_store_id_fkey;
ALTER TABLE ONLY public.sales_targets
    ADD CONSTRAINT sales_targets_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;


--
-- Name: stock_transfers stock_transfers_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_transfers DROP CONSTRAINT IF EXISTS stock_transfers_created_by_fkey;
ALTER TABLE ONLY public.stock_transfers
    ADD CONSTRAINT stock_transfers_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: stock_transfers stock_transfers_from_reseller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_transfers DROP CONSTRAINT IF EXISTS stock_transfers_from_reseller_id_fkey;
ALTER TABLE ONLY public.stock_transfers
    ADD CONSTRAINT stock_transfers_from_reseller_id_fkey FOREIGN KEY (from_reseller_id) REFERENCES public.resellers(id);


--
-- Name: stock_transfers stock_transfers_from_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_transfers DROP CONSTRAINT IF EXISTS stock_transfers_from_store_id_fkey;
ALTER TABLE ONLY public.stock_transfers
    ADD CONSTRAINT stock_transfers_from_store_id_fkey FOREIGN KEY (from_store_id) REFERENCES public.stores(id);


--
-- Name: stock_transfers stock_transfers_to_reseller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_transfers DROP CONSTRAINT IF EXISTS stock_transfers_to_reseller_id_fkey;
ALTER TABLE ONLY public.stock_transfers
    ADD CONSTRAINT stock_transfers_to_reseller_id_fkey FOREIGN KEY (to_reseller_id) REFERENCES public.resellers(id);


--
-- Name: stock_transfers stock_transfers_to_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_transfers DROP CONSTRAINT IF EXISTS stock_transfers_to_store_id_fkey;
ALTER TABLE ONLY public.stock_transfers
    ADD CONSTRAINT stock_transfers_to_store_id_fkey FOREIGN KEY (to_store_id) REFERENCES public.stores(id);


--
-- Name: stock_transfers stock_transfers_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_transfers DROP CONSTRAINT IF EXISTS stock_transfers_vehicle_id_fkey;
ALTER TABLE ONLY public.stock_transfers
    ADD CONSTRAINT stock_transfers_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;


--
-- Name: store_ads store_ads_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.store_ads DROP CONSTRAINT IF EXISTS store_ads_store_id_fkey;
ALTER TABLE ONLY public.store_ads
    ADD CONSTRAINT store_ads_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;


--
-- Name: stores stores_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stores DROP CONSTRAINT IF EXISTS stores_manager_id_fkey;
ALTER TABLE ONLY public.stores
    ADD CONSTRAINT stores_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES auth.users(id);


--
-- Name: user_roles user_roles_custom_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles DROP CONSTRAINT IF EXISTS user_roles_custom_role_id_fkey;
ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_custom_role_id_fkey FOREIGN KEY (custom_role_id) REFERENCES public.custom_roles(id) ON DELETE SET NULL;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;
ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: vehicle_colors vehicle_colors_vehicle_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vehicle_colors DROP CONSTRAINT IF EXISTS vehicle_colors_vehicle_model_id_fkey;
ALTER TABLE ONLY public.vehicle_colors
    ADD CONSTRAINT vehicle_colors_vehicle_model_id_fkey FOREIGN KEY (vehicle_model_id) REFERENCES public.vehicle_models(id) ON DELETE CASCADE;


--
-- Name: vehicles vehicles_reseller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vehicles DROP CONSTRAINT IF EXISTS vehicles_reseller_id_fkey;
ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_reseller_id_fkey FOREIGN KEY (reseller_id) REFERENCES public.resellers(id) ON DELETE SET NULL;


--
-- Name: vehicles vehicles_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vehicles DROP CONSTRAINT IF EXISTS vehicles_store_id_fkey;
ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE SET NULL;


--
-- Name: resellers Admins and managers can manage resellers; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins and managers can manage resellers" ON public.resellers TO authenticated USING (public.has_elevated_access(auth.uid())) WITH CHECK (public.has_elevated_access(auth.uid()));


--
-- Name: vehicles Admins and managers can manage vehicles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins and managers can manage vehicles" ON public.vehicles TO authenticated USING (public.has_elevated_access(auth.uid())) WITH CHECK (public.has_elevated_access(auth.uid()));


--
-- Name: contracts Admins and sellers can update contracts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins and sellers can update contracts" ON public.contracts FOR UPDATE TO authenticated USING ((public.has_elevated_access(auth.uid()) OR (created_by = auth.uid()))) WITH CHECK ((public.has_elevated_access(auth.uid()) OR (created_by = auth.uid())));


--
-- Name: payroll_batches Admins can delete batches; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can delete batches" ON public.payroll_batches FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: vehicle_reservations Admins can delete reservations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can delete reservations" ON public.vehicle_reservations FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can delete roles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: profiles Admins can insert profiles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can insert profiles" ON public.profiles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can insert roles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: chassis_patterns Admins can manage patterns; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage patterns" ON public.chassis_patterns TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: stores Admins can manage stores; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage stores" ON public.stores TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can update roles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: activity_logs Admins can view all logs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can view all logs" ON public.activity_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can view all roles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR (user_id = auth.uid())));


--
-- Name: api_keys Admins manage api keys; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins manage api keys" ON public.api_keys TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: role_permissions Admins manage perms; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins manage perms" ON public.role_permissions TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: custom_roles Admins manage roles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins manage roles" ON public.custom_roles TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: contracts Admins or permitted owners can delete contracts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins or permitted owners can delete contracts" ON public.contracts FOR DELETE TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR ((created_by = auth.uid()) AND (public.has_permission(auth.uid(), 'sales.delete'::text) OR (EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.custom_role_id IS NULL) AND ((user_roles.role)::text = 'vendedor_plus'::text))))))));


--
-- Name: contract_templates Anyone can view active templates; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can view active templates" ON public.contract_templates FOR SELECT TO authenticated USING (((is_active = true) OR public.has_elevated_access(auth.uid())));


--
-- Name: vehicle_colors Authenticated can view colors; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated can view colors" ON public.vehicle_colors FOR SELECT TO authenticated USING (true);


--
-- Name: financing_banks Authenticated can view financing banks; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated can view financing banks" ON public.financing_banks FOR SELECT TO authenticated USING (true);


--
-- Name: store_ads Authenticated can view store ads; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated can view store ads" ON public.store_ads FOR SELECT TO authenticated USING (true);


--
-- Name: vehicle_models Authenticated can view vehicle models; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated can view vehicle models" ON public.vehicle_models FOR SELECT TO authenticated USING (true);


--
-- Name: chassis_year_codes Authenticated can view year codes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated can view year codes" ON public.chassis_year_codes FOR SELECT TO authenticated USING (true);


--
-- Name: role_permissions Authenticated read perms; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated read perms" ON public.role_permissions FOR SELECT TO authenticated USING (true);


--
-- Name: custom_roles Authenticated read roles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated read roles" ON public.custom_roles FOR SELECT TO authenticated USING (true);


--
-- Name: stores Authenticated users can view active stores; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated users can view active stores" ON public.stores FOR SELECT TO authenticated USING (((is_active = true) OR public.has_elevated_access(auth.uid())));


--
-- Name: chassis_patterns Authenticated users can view patterns; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated users can view patterns" ON public.chassis_patterns FOR SELECT TO authenticated USING (true);


--
-- Name: contract_acceptances Create acceptance tokens for own contracts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Create acceptance tokens for own contracts" ON public.contract_acceptances FOR INSERT TO authenticated WITH CHECK (((created_by = auth.uid()) AND (contract_id IN ( SELECT c.id
   FROM public.contracts c
  WHERE (public.has_elevated_access(auth.uid()) OR (c.created_by = auth.uid()))))));


--
-- Name: contracts Create contracts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Create contracts" ON public.contracts FOR INSERT TO authenticated WITH CHECK ((public.has_elevated_access(auth.uid()) OR (created_by = auth.uid()) OR (reseller_id IN ( SELECT r.id
   FROM public.resellers r
  WHERE (r.user_id = auth.uid())))));


--
-- Name: vehicle_reservations Create reservations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Create reservations" ON public.vehicle_reservations FOR INSERT TO authenticated WITH CHECK ((public.has_elevated_access(auth.uid()) OR (created_by = auth.uid()) OR (reseller_id IN ( SELECT r.id
   FROM public.resellers r
  WHERE (r.user_id = auth.uid())))));


--
-- Name: contract_revisions Create revisions for own contracts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Create revisions for own contracts" ON public.contract_revisions FOR INSERT TO authenticated WITH CHECK (((changed_by = auth.uid()) AND (contract_id IN ( SELECT c.id
   FROM public.contracts c
  WHERE (public.has_elevated_access(auth.uid()) OR (c.created_by = auth.uid()))))));


--
-- Name: financing_simulations Create simulations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Create simulations" ON public.financing_simulations FOR INSERT TO authenticated WITH CHECK ((public.has_elevated_access(auth.uid()) OR (created_by = auth.uid())));


--
-- Name: vehicle_colors Elevated can delete colors; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Elevated can delete colors" ON public.vehicle_colors FOR DELETE TO authenticated USING (public.has_elevated_access(auth.uid()));


--
-- Name: financing_banks Elevated can delete financing banks; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Elevated can delete financing banks" ON public.financing_banks FOR DELETE TO authenticated USING (public.has_elevated_access(auth.uid()));


--
-- Name: store_ads Elevated can delete store ads; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Elevated can delete store ads" ON public.store_ads FOR DELETE TO authenticated USING (public.has_elevated_access(auth.uid()));


--
-- Name: vehicle_models Elevated can delete vehicle models; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Elevated can delete vehicle models" ON public.vehicle_models FOR DELETE TO authenticated USING (public.has_elevated_access(auth.uid()));


--
-- Name: chassis_year_codes Elevated can delete year codes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Elevated can delete year codes" ON public.chassis_year_codes FOR DELETE TO authenticated USING (public.has_elevated_access(auth.uid()));


--
-- Name: payroll_batches Elevated can insert batches; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Elevated can insert batches" ON public.payroll_batches FOR INSERT TO authenticated WITH CHECK (public.has_elevated_access(auth.uid()));


--
-- Name: vehicle_colors Elevated can insert colors; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Elevated can insert colors" ON public.vehicle_colors FOR INSERT TO authenticated WITH CHECK (public.has_elevated_access(auth.uid()));


--
-- Name: financing_banks Elevated can insert financing banks; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Elevated can insert financing banks" ON public.financing_banks FOR INSERT TO authenticated WITH CHECK (public.has_elevated_access(auth.uid()));


--
-- Name: store_ads Elevated can insert store ads; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Elevated can insert store ads" ON public.store_ads FOR INSERT TO authenticated WITH CHECK (public.has_elevated_access(auth.uid()));


--
-- Name: vehicle_models Elevated can insert vehicle models; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Elevated can insert vehicle models" ON public.vehicle_models FOR INSERT TO authenticated WITH CHECK (public.has_elevated_access(auth.uid()));


--
-- Name: chassis_year_codes Elevated can insert year codes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Elevated can insert year codes" ON public.chassis_year_codes FOR INSERT TO authenticated WITH CHECK (public.has_elevated_access(auth.uid()));


--
-- Name: payroll_batches Elevated can update batches; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Elevated can update batches" ON public.payroll_batches FOR UPDATE TO authenticated USING (public.has_elevated_access(auth.uid())) WITH CHECK (public.has_elevated_access(auth.uid()));


--
-- Name: vehicle_colors Elevated can update colors; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Elevated can update colors" ON public.vehicle_colors FOR UPDATE TO authenticated USING (public.has_elevated_access(auth.uid()));


--
-- Name: financing_banks Elevated can update financing banks; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Elevated can update financing banks" ON public.financing_banks FOR UPDATE TO authenticated USING (public.has_elevated_access(auth.uid()));


--
-- Name: store_ads Elevated can update store ads; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Elevated can update store ads" ON public.store_ads FOR UPDATE TO authenticated USING (public.has_elevated_access(auth.uid()));


--
-- Name: vehicle_models Elevated can update vehicle models; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Elevated can update vehicle models" ON public.vehicle_models FOR UPDATE TO authenticated USING (public.has_elevated_access(auth.uid())) WITH CHECK (public.has_elevated_access(auth.uid()));


--
-- Name: chassis_year_codes Elevated can update year codes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Elevated can update year codes" ON public.chassis_year_codes FOR UPDATE TO authenticated USING (public.has_elevated_access(auth.uid())) WITH CHECK (public.has_elevated_access(auth.uid()));


--
-- Name: payroll_batches Elevated can view batches; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Elevated can view batches" ON public.payroll_batches FOR SELECT TO authenticated USING (public.has_elevated_access(auth.uid()));


--
-- Name: financing_simulations Elevated delete simulations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Elevated delete simulations" ON public.financing_simulations FOR DELETE TO authenticated USING (public.has_elevated_access(auth.uid()));


--
-- Name: payroll_settings Elevated manage payroll settings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Elevated manage payroll settings" ON public.payroll_settings TO authenticated USING (public.has_elevated_access(auth.uid())) WITH CHECK (public.has_elevated_access(auth.uid()));


--
-- Name: financing_simulations Elevated update simulations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Elevated update simulations" ON public.financing_simulations FOR UPDATE TO authenticated USING (public.has_elevated_access(auth.uid())) WITH CHECK (public.has_elevated_access(auth.uid()));


--
-- Name: contract_templates Elevated users can create templates; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Elevated users can create templates" ON public.contract_templates FOR INSERT TO authenticated WITH CHECK (public.has_elevated_access(auth.uid()));


--
-- Name: contract_templates Elevated users can delete templates; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Elevated users can delete templates" ON public.contract_templates FOR DELETE TO authenticated USING (public.has_elevated_access(auth.uid()));


--
-- Name: reseller_consignment_contracts Elevated users can manage consignment contracts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Elevated users can manage consignment contracts" ON public.reseller_consignment_contracts USING (public.has_elevated_access(auth.uid())) WITH CHECK (public.has_elevated_access(auth.uid()));


--
-- Name: employees Elevated users can manage employees; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Elevated users can manage employees" ON public.employees TO authenticated USING (public.has_elevated_access(auth.uid())) WITH CHECK (public.has_elevated_access(auth.uid()));


--
-- Name: invoices Elevated users can manage invoices; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Elevated users can manage invoices" ON public.invoices TO authenticated USING (public.has_elevated_access(auth.uid())) WITH CHECK (public.has_elevated_access(auth.uid()));


--
-- Name: payslips Elevated users can manage payslips; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Elevated users can manage payslips" ON public.payslips TO authenticated USING (public.has_elevated_access(auth.uid())) WITH CHECK (public.has_elevated_access(auth.uid()));


--
-- Name: contract_templates Elevated users can update templates; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Elevated users can update templates" ON public.contract_templates FOR UPDATE TO authenticated USING (public.has_elevated_access(auth.uid()));


--
-- Name: bank_credentials Elevated users manage bank credentials; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Elevated users manage bank credentials" ON public.bank_credentials TO authenticated USING (public.has_elevated_access(auth.uid())) WITH CHECK (public.has_elevated_access(auth.uid()));


--
-- Name: stock_transfers Elevated users manage transfers; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Elevated users manage transfers" ON public.stock_transfers TO authenticated USING (public.has_elevated_access(auth.uid())) WITH CHECK (public.has_elevated_access(auth.uid()));


--
-- Name: payslips Employees can view own payslips; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Employees can view own payslips" ON public.payslips FOR SELECT TO authenticated USING ((public.has_elevated_access(auth.uid()) OR (employee_id IN ( SELECT employees.id
   FROM public.employees
  WHERE (employees.profile_id = auth.uid())))));


--
-- Name: employees Employees can view own record; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Employees can view own record" ON public.employees FOR SELECT TO authenticated USING ((public.has_elevated_access(auth.uid()) OR (profile_id = auth.uid())));


--
-- Name: vehicles Sales roles can update vehicles of their store; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Sales roles can update vehicles of their store" ON public.vehicles FOR UPDATE TO authenticated USING ((public.can_create_sales(auth.uid()) AND (public.has_elevated_access(auth.uid()) OR (store_id = public.get_user_store_id(auth.uid()))))) WITH CHECK ((public.can_create_sales(auth.uid()) AND (public.has_elevated_access(auth.uid()) OR (store_id = public.get_user_store_id(auth.uid())))));


--
-- Name: activity_logs System can insert logs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "System can insert logs" ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: vehicle_reservations Update reservations based on role; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Update reservations based on role" ON public.vehicle_reservations FOR UPDATE TO authenticated USING ((public.has_elevated_access(auth.uid()) OR (created_by = auth.uid()))) WITH CHECK ((public.has_elevated_access(auth.uid()) OR (created_by = auth.uid())));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING ((id = auth.uid()));


--
-- Name: profiles Users can view profiles based on role; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view profiles based on role" ON public.profiles FOR SELECT TO authenticated USING (((id = auth.uid()) OR public.has_elevated_access(auth.uid())));


--
-- Name: stock_transfers Users view transfers of their store; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users view transfers of their store" ON public.stock_transfers FOR SELECT TO authenticated USING (((from_store_id = public.get_user_store_id(auth.uid())) OR (to_store_id = public.get_user_store_id(auth.uid()))));


--
-- Name: vehicles Vendedor plus can register vehicles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Vendedor plus can register vehicles" ON public.vehicles FOR INSERT TO authenticated WITH CHECK ((public.can_register_vehicles(auth.uid()) AND (public.has_elevated_access(auth.uid()) OR (store_id = public.get_user_store_id(auth.uid())))));


--
-- Name: contract_acceptances View acceptances of accessible contracts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "View acceptances of accessible contracts" ON public.contract_acceptances FOR SELECT TO authenticated USING ((contract_id IN ( SELECT c.id
   FROM public.contracts c
  WHERE (public.has_elevated_access(auth.uid()) OR (c.created_by = auth.uid()) OR (c.reseller_id IN ( SELECT r.id
           FROM public.resellers r
          WHERE (r.user_id = auth.uid())))))));


--
-- Name: reseller_consignment_contracts View consignment contracts based on role; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "View consignment contracts based on role" ON public.reseller_consignment_contracts FOR SELECT USING ((public.has_elevated_access(auth.uid()) OR (reseller_id IN ( SELECT resellers.id
   FROM public.resellers
  WHERE (resellers.user_id = auth.uid()))) OR (store_id = public.get_user_store_id(auth.uid()))));


--
-- Name: contracts View contracts based on role; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "View contracts based on role" ON public.contracts FOR SELECT TO authenticated USING ((public.has_elevated_access(auth.uid()) OR (created_by = auth.uid()) OR (reseller_id IN ( SELECT r.id
   FROM public.resellers r
  WHERE (r.user_id = auth.uid())))));


--
-- Name: contracts View contracts by role scope; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "View contracts by role scope" ON public.contracts FOR SELECT TO authenticated USING (((public.user_data_scope(auth.uid()) = 'all'::text) OR ((public.user_data_scope(auth.uid()) = 'store'::text) AND (store_id = public.get_user_store_id(auth.uid())))));


--
-- Name: resellers View resellers based on role; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "View resellers based on role" ON public.resellers FOR SELECT TO authenticated USING ((public.has_elevated_access(auth.uid()) OR (user_id = auth.uid()) OR (store_id = public.get_user_store_id(auth.uid()))));


--
-- Name: vehicle_reservations View reservations based on role; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "View reservations based on role" ON public.vehicle_reservations FOR SELECT TO authenticated USING ((public.has_elevated_access(auth.uid()) OR (created_by = auth.uid()) OR (reseller_id IN ( SELECT r.id
   FROM public.resellers r
  WHERE (r.user_id = auth.uid())))));


--
-- Name: contract_revisions View revisions of accessible contracts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "View revisions of accessible contracts" ON public.contract_revisions FOR SELECT TO authenticated USING ((contract_id IN ( SELECT c.id
   FROM public.contracts c
  WHERE (public.has_elevated_access(auth.uid()) OR (c.created_by = auth.uid()) OR (c.reseller_id IN ( SELECT r.id
           FROM public.resellers r
          WHERE (r.user_id = auth.uid())))))));


--
-- Name: financing_simulations View simulations by role; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "View simulations by role" ON public.financing_simulations FOR SELECT TO authenticated USING ((public.has_elevated_access(auth.uid()) OR (created_by = auth.uid())));


--
-- Name: vehicles View vehicles based on role; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "View vehicles based on role" ON public.vehicles FOR SELECT TO authenticated USING ((public.has_elevated_access(auth.uid()) OR (store_id = public.get_user_store_id(auth.uid())) OR (reseller_id IN ( SELECT r.id
   FROM public.resellers r
  WHERE (r.user_id = auth.uid())))));


--
-- Name: activity_logs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: api_keys; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

--
-- Name: bank_credentials; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.bank_credentials ENABLE ROW LEVEL SECURITY;

--
-- Name: chassis_patterns; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.chassis_patterns ENABLE ROW LEVEL SECURITY;

--
-- Name: chassis_year_codes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.chassis_year_codes ENABLE ROW LEVEL SECURITY;

--
-- Name: contract_acceptances; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.contract_acceptances ENABLE ROW LEVEL SECURITY;

--
-- Name: contract_revisions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.contract_revisions ENABLE ROW LEVEL SECURITY;

--
-- Name: contract_templates; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: contracts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

--
-- Name: custom_roles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: employees; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

--
-- Name: eula_acceptances; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.eula_acceptances ENABLE ROW LEVEL SECURITY;

--
-- Name: eula_acceptances eula_insert_own; Type: POLICY; Schema: public; Owner: postgres
--

DROP POLICY IF EXISTS eula_insert_own ON public.eula_acceptances;
CREATE POLICY eula_insert_own ON public.eula_acceptances FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: eula_acceptances eula_select_own; Type: POLICY; Schema: public; Owner: postgres
--

DROP POLICY IF EXISTS eula_select_own ON public.eula_acceptances;
CREATE POLICY eula_select_own ON public.eula_acceptances FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: financing_banks; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.financing_banks ENABLE ROW LEVEL SECURITY;

--
-- Name: financing_simulations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.financing_simulations ENABLE ROW LEVEL SECURITY;

--
-- Name: invoices; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

--
-- Name: payroll_batches; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.payroll_batches ENABLE ROW LEVEL SECURITY;

--
-- Name: payroll_settings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.payroll_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: payslips; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: reseller_consignment_contracts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.reseller_consignment_contracts ENABLE ROW LEVEL SECURITY;

--
-- Name: resellers; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.resellers ENABLE ROW LEVEL SECURITY;

--
-- Name: role_permissions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: sales_targets; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.sales_targets ENABLE ROW LEVEL SECURITY;

--
-- Name: stock_sync_config; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.stock_sync_config ENABLE ROW LEVEL SECURITY;

--
-- Name: stock_sync_config stock_sync_config_manage; Type: POLICY; Schema: public; Owner: postgres
--

DROP POLICY IF EXISTS stock_sync_config_manage ON public.stock_sync_config;
CREATE POLICY stock_sync_config_manage ON public.stock_sync_config TO authenticated USING (public.has_elevated_access(auth.uid())) WITH CHECK (public.has_elevated_access(auth.uid()));


--
-- Name: stock_sync_config stock_sync_config_select; Type: POLICY; Schema: public; Owner: postgres
--

DROP POLICY IF EXISTS stock_sync_config_select ON public.stock_sync_config;
CREATE POLICY stock_sync_config_select ON public.stock_sync_config FOR SELECT TO authenticated USING (true);


--
-- Name: stock_transfers; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;

--
-- Name: store_ads; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.store_ads ENABLE ROW LEVEL SECURITY;

--
-- Name: stores; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

--
-- Name: sales_targets targets_manage_elevated; Type: POLICY; Schema: public; Owner: postgres
--

DROP POLICY IF EXISTS targets_manage_elevated ON public.sales_targets;
CREATE POLICY targets_manage_elevated ON public.sales_targets TO authenticated USING (public.has_elevated_access(auth.uid())) WITH CHECK (public.has_elevated_access(auth.uid()));


--
-- Name: sales_targets targets_select_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

DROP POLICY IF EXISTS targets_select_authenticated ON public.sales_targets;
CREATE POLICY targets_select_authenticated ON public.sales_targets FOR SELECT TO authenticated USING (true);


--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: vehicle_colors; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.vehicle_colors ENABLE ROW LEVEL SECURITY;

--
-- Name: vehicle_models; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.vehicle_models ENABLE ROW LEVEL SECURITY;

--
-- Name: vehicle_reservations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.vehicle_reservations ENABLE ROW LEVEL SECURITY;

--
-- Name: vehicles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

--
-- Name: FUNCTION apply_stock_transfer(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.apply_stock_transfer() TO anon;
GRANT ALL ON FUNCTION public.apply_stock_transfer() TO authenticated;
GRANT ALL ON FUNCTION public.apply_stock_transfer() TO service_role;


--
-- Name: FUNCTION can_create_sales(_user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.can_create_sales(_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.can_create_sales(_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.can_create_sales(_user_id uuid) TO service_role;


--
-- Name: FUNCTION can_register_vehicles(_user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.can_register_vehicles(_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.can_register_vehicles(_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.can_register_vehicles(_user_id uuid) TO service_role;


--
-- Name: FUNCTION get_user_store_id(_user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_user_store_id(_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_user_store_id(_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_user_store_id(_user_id uuid) TO service_role;


--
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.handle_new_user() TO anon;
GRANT ALL ON FUNCTION public.handle_new_user() TO authenticated;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;


--
-- Name: FUNCTION has_elevated_access(_user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.has_elevated_access(_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.has_elevated_access(_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.has_elevated_access(_user_id uuid) TO service_role;


--
-- Name: FUNCTION has_permission(_user_id uuid, _perm text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.has_permission(_user_id uuid, _perm text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.has_permission(_user_id uuid, _perm text) TO authenticated;
GRANT ALL ON FUNCTION public.has_permission(_user_id uuid, _perm text) TO service_role;


--
-- Name: FUNCTION has_role(_user_id uuid, _role public.app_role); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.has_role(_user_id uuid, _role public.app_role) TO anon;
GRANT ALL ON FUNCTION public.has_role(_user_id uuid, _role public.app_role) TO authenticated;
GRANT ALL ON FUNCTION public.has_role(_user_id uuid, _role public.app_role) TO service_role;


--
-- Name: FUNCTION is_external_seller(_user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.is_external_seller(_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.is_external_seller(_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_external_seller(_user_id uuid) TO service_role;


--
-- Name: FUNCTION normalize_contract_payment_values(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.normalize_contract_payment_values() TO anon;
GRANT ALL ON FUNCTION public.normalize_contract_payment_values() TO authenticated;
GRANT ALL ON FUNCTION public.normalize_contract_payment_values() TO service_role;


--
-- Name: FUNCTION notify_stock_sync(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.notify_stock_sync() TO anon;
GRANT ALL ON FUNCTION public.notify_stock_sync() TO authenticated;
GRANT ALL ON FUNCTION public.notify_stock_sync() TO service_role;


--
-- Name: FUNCTION sync_vehicle_status_from_reservation(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.sync_vehicle_status_from_reservation() TO anon;
GRANT ALL ON FUNCTION public.sync_vehicle_status_from_reservation() TO authenticated;
GRANT ALL ON FUNCTION public.sync_vehicle_status_from_reservation() TO service_role;


--
-- Name: FUNCTION update_updated_at_column(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_updated_at_column() TO anon;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO authenticated;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO service_role;


--
-- Name: FUNCTION user_data_scope(_user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.user_data_scope(_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.user_data_scope(_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.user_data_scope(_user_id uuid) TO service_role;


--
-- Name: TABLE activity_logs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.activity_logs TO anon;
GRANT ALL ON TABLE public.activity_logs TO authenticated;
GRANT ALL ON TABLE public.activity_logs TO service_role;


--
-- Name: TABLE api_keys; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.api_keys TO anon;
GRANT ALL ON TABLE public.api_keys TO authenticated;
GRANT ALL ON TABLE public.api_keys TO service_role;


--
-- Name: TABLE bank_credentials; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.bank_credentials TO anon;
GRANT ALL ON TABLE public.bank_credentials TO authenticated;
GRANT ALL ON TABLE public.bank_credentials TO service_role;


--
-- Name: TABLE chassis_patterns; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.chassis_patterns TO anon;
GRANT ALL ON TABLE public.chassis_patterns TO authenticated;
GRANT ALL ON TABLE public.chassis_patterns TO service_role;


--
-- Name: TABLE chassis_year_codes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.chassis_year_codes TO anon;
GRANT ALL ON TABLE public.chassis_year_codes TO authenticated;
GRANT ALL ON TABLE public.chassis_year_codes TO service_role;


--
-- Name: TABLE contract_acceptances; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.contract_acceptances TO anon;
GRANT ALL ON TABLE public.contract_acceptances TO authenticated;
GRANT ALL ON TABLE public.contract_acceptances TO service_role;


--
-- Name: TABLE contract_revisions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.contract_revisions TO anon;
GRANT ALL ON TABLE public.contract_revisions TO authenticated;
GRANT ALL ON TABLE public.contract_revisions TO service_role;


--
-- Name: TABLE contract_templates; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.contract_templates TO anon;
GRANT ALL ON TABLE public.contract_templates TO authenticated;
GRANT ALL ON TABLE public.contract_templates TO service_role;


--
-- Name: TABLE contracts; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.contracts TO anon;
GRANT ALL ON TABLE public.contracts TO authenticated;
GRANT ALL ON TABLE public.contracts TO service_role;


--
-- Name: TABLE custom_roles; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.custom_roles TO anon;
GRANT ALL ON TABLE public.custom_roles TO authenticated;
GRANT ALL ON TABLE public.custom_roles TO service_role;


--
-- Name: TABLE employees; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.employees TO anon;
GRANT ALL ON TABLE public.employees TO authenticated;
GRANT ALL ON TABLE public.employees TO service_role;


--
-- Name: TABLE eula_acceptances; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.eula_acceptances TO anon;
GRANT ALL ON TABLE public.eula_acceptances TO authenticated;
GRANT ALL ON TABLE public.eula_acceptances TO service_role;


--
-- Name: TABLE financing_banks; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.financing_banks TO anon;
GRANT ALL ON TABLE public.financing_banks TO authenticated;
GRANT ALL ON TABLE public.financing_banks TO service_role;


--
-- Name: TABLE financing_simulations; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.financing_simulations TO anon;
GRANT ALL ON TABLE public.financing_simulations TO authenticated;
GRANT ALL ON TABLE public.financing_simulations TO service_role;


--
-- Name: TABLE invoices; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.invoices TO anon;
GRANT ALL ON TABLE public.invoices TO authenticated;
GRANT ALL ON TABLE public.invoices TO service_role;


--
-- Name: TABLE payroll_batches; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.payroll_batches TO anon;
GRANT ALL ON TABLE public.payroll_batches TO authenticated;
GRANT ALL ON TABLE public.payroll_batches TO service_role;


--
-- Name: TABLE payroll_settings; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.payroll_settings TO anon;
GRANT ALL ON TABLE public.payroll_settings TO authenticated;
GRANT ALL ON TABLE public.payroll_settings TO service_role;


--
-- Name: TABLE payslips; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.payslips TO anon;
GRANT ALL ON TABLE public.payslips TO authenticated;
GRANT ALL ON TABLE public.payslips TO service_role;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;


--
-- Name: TABLE reseller_consignment_contracts; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.reseller_consignment_contracts TO anon;
GRANT ALL ON TABLE public.reseller_consignment_contracts TO authenticated;
GRANT ALL ON TABLE public.reseller_consignment_contracts TO service_role;


--
-- Name: TABLE resellers; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.resellers TO anon;
GRANT ALL ON TABLE public.resellers TO authenticated;
GRANT ALL ON TABLE public.resellers TO service_role;


--
-- Name: TABLE role_permissions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.role_permissions TO anon;
GRANT ALL ON TABLE public.role_permissions TO authenticated;
GRANT ALL ON TABLE public.role_permissions TO service_role;


--
-- Name: TABLE sales_targets; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.sales_targets TO anon;
GRANT ALL ON TABLE public.sales_targets TO authenticated;
GRANT ALL ON TABLE public.sales_targets TO service_role;


--
-- Name: TABLE stock_sync_config; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.stock_sync_config TO anon;
GRANT ALL ON TABLE public.stock_sync_config TO authenticated;
GRANT ALL ON TABLE public.stock_sync_config TO service_role;


--
-- Name: TABLE stock_transfers; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.stock_transfers TO anon;
GRANT ALL ON TABLE public.stock_transfers TO authenticated;
GRANT ALL ON TABLE public.stock_transfers TO service_role;


--
-- Name: TABLE store_ads; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.store_ads TO anon;
GRANT ALL ON TABLE public.store_ads TO authenticated;
GRANT ALL ON TABLE public.store_ads TO service_role;


--
-- Name: TABLE stores; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.stores TO anon;
GRANT ALL ON TABLE public.stores TO authenticated;
GRANT ALL ON TABLE public.stores TO service_role;


--
-- Name: TABLE user_roles; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.user_roles TO anon;
GRANT ALL ON TABLE public.user_roles TO authenticated;
GRANT ALL ON TABLE public.user_roles TO service_role;


--
-- Name: TABLE vehicle_colors; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.vehicle_colors TO anon;
GRANT ALL ON TABLE public.vehicle_colors TO authenticated;
GRANT ALL ON TABLE public.vehicle_colors TO service_role;


--
-- Name: TABLE vehicle_models; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.vehicle_models TO anon;
GRANT ALL ON TABLE public.vehicle_models TO authenticated;
GRANT ALL ON TABLE public.vehicle_models TO service_role;


--
-- Name: TABLE vehicle_reservations; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.vehicle_reservations TO anon;
GRANT ALL ON TABLE public.vehicle_reservations TO authenticated;
GRANT ALL ON TABLE public.vehicle_reservations TO service_role;


--
-- Name: TABLE vehicles; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.vehicles TO anon;
GRANT ALL ON TABLE public.vehicles TO authenticated;
GRANT ALL ON TABLE public.vehicles TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--



--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--



--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--



--
-- PostgreSQL database dump complete
--


