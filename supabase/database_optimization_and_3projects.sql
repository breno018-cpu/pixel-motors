-- ============================================================================
-- GRUPO L1MA / PIXEL MOTORS - OTIMIZAÇÃO GERAL DO BANCO E SEGREGAÇÃO EM 3 PROJETOS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. TABELAS NATIVAS DE ROMANEIO DE CARGAS E PÁTIO (QR CODE UNLOADING)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.inbound_cargo_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_code TEXT NOT NULL UNIQUE,
    truck_identifier TEXT NOT NULL,
    driver_name TEXT,
    origin_supplier TEXT DEFAULT 'FÁBRICA SHINERAY',
    target_store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
    total_boxes INTEGER DEFAULT 0,
    unloaded_boxes INTEGER DEFAULT 0,
    rejected_boxes INTEGER DEFAULT 0,
    status TEXT DEFAULT 'in_progress' CHECK (status IN ('draft', 'in_progress', 'completed', 'cancelled')),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    started_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.inbound_cargo_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES public.inbound_cargo_batches(id) ON DELETE CASCADE,
    box_sequence_id TEXT,
    chassis_number TEXT NOT NULL,
    engine_number TEXT,
    model_name TEXT NOT NULL,
    engine_cc TEXT,
    color TEXT,
    belongs_to_our_store BOOLEAN DEFAULT true,
    destination_store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
    destination_store_name TEXT,
    is_unloaded BOOLEAN DEFAULT false,
    unloaded_at TIMESTAMPTZ,
    unloaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'unloaded', 'rejected_wrong_store', 'damaged', 'divergent')),
    raw_qr_content TEXT,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.inbound_divergence_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID REFERENCES public.inbound_cargo_batches(id) ON DELETE CASCADE,
    scanned_code TEXT NOT NULL,
    detected_chassis TEXT,
    divergence_type TEXT NOT NULL, -- 'not_found', 'not_our_store', 'damaged', 'duplicate'
    message TEXT NOT NULL,
    scanned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS para Romaneio
ALTER TABLE public.inbound_cargo_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inbound_cargo_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inbound_divergence_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Todos autenticados podem ver lotes de carga" ON public.inbound_cargo_batches;
CREATE POLICY "Todos autenticados podem ver lotes de carga" ON public.inbound_cargo_batches
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Usuários autenticados podem gerenciar lotes de carga" ON public.inbound_cargo_batches;
CREATE POLICY "Usuários autenticados podem gerenciar lotes de carga" ON public.inbound_cargo_batches
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Todos autenticados podem ver itens do romaneio" ON public.inbound_cargo_items;
CREATE POLICY "Todos autenticados podem ver itens do romaneio" ON public.inbound_cargo_items
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Usuários autenticados podem atualizar itens do romaneio" ON public.inbound_cargo_items;
CREATE POLICY "Usuários autenticados podem atualizar itens do romaneio" ON public.inbound_cargo_items
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Todos autenticados podem registrar divergências" ON public.inbound_divergence_logs;
CREATE POLICY "Todos autenticados podem registrar divergências" ON public.inbound_divergence_logs
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 2. ÍNDICES DE ULTRA PERFORMANCE PARA BUSCAS EM MILISSEGUNDOS
-- ----------------------------------------------------------------------------

-- Busca ultra-rápida de Chassi (QR Code do pátio e consulta de motos)
CREATE INDEX IF NOT EXISTS idx_vehicles_chassis_upper ON public.vehicles (UPPER(chassis));
CREATE INDEX IF NOT EXISTS idx_vehicles_store_status ON public.vehicles (store_id, status);
CREATE INDEX IF NOT EXISTS idx_vehicles_created_at_desc ON public.vehicles (created_at DESC);

-- Busca rápida de contratos e clientes
CREATE INDEX IF NOT EXISTS idx_contracts_number_upper ON public.contracts (UPPER(contract_number));
CREATE INDEX IF NOT EXISTS idx_contracts_buyer_cpf_clean ON public.contracts (buyer_cpf);
CREATE INDEX IF NOT EXISTS idx_contracts_store_status ON public.contracts (store_id, status);

-- Busca do romaneio
CREATE INDEX IF NOT EXISTS idx_inbound_items_chassis ON public.inbound_cargo_items (UPPER(chassis_number));
CREATE INDEX IF NOT EXISTS idx_inbound_items_batch_status ON public.inbound_cargo_items (batch_id, status);
CREATE INDEX IF NOT EXISTS idx_inbound_batches_store ON public.inbound_cargo_batches (target_store_id, status);

-- ----------------------------------------------------------------------------
-- 3. SEGREGAÇÃO DOS 3 PROJETOS COM SEGURANÇA BLINDADA
-- ----------------------------------------------------------------------------

-- Tabela central de controle de projetos/aplicações da concessionária
CREATE TABLE IF NOT EXISTS public.dealership_apps (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    schema_name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO public.dealership_apps (id, name, description, schema_name) VALUES
    ('pixel_motors_core', 'Projeto 1: Pixel Motors Principal', 'Sistema central de vendas, estoque MOC/Divinópolis, contratos e RH', 'public'),
    ('portal_repasse_b2b', 'Projeto 2: Portal de Repasse B2B', 'Área isolada para revendedores parceiros comprarem lotes de repasse com preços de atacado', 'portal_repasse'),
    ('patio_operacional_app', 'Projeto 3: App Operacional de Pátio', 'App mobile para conferência rápida de descida de caminhão via QR code sem acesso financeiro', 'patio_operacional')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    schema_name = EXCLUDED.schema_name;

-- ----------------------------------------------------------------------------
-- PROJETO 2: SCHEMA portal_repasse (Isolamento para Revendedores)
-- ----------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS portal_repasse;

-- Visão segura: revendedor só enxerga veículos disponíveis para repasse, NUNCA vê margem/custo!
CREATE OR REPLACE VIEW portal_repasse.veiculos_repasse AS
SELECT 
    v.id,
    v.brand,
    v.model,
    v.year,
    v.color,
    v.plate,
    v.chassis,
    v.status,
    v.repasse_price,
    s.name AS loja_nome,
    s.city AS loja_cidade,
    v.created_at
FROM public.vehicles v
LEFT JOIN public.stores s ON s.id = v.store_id
WHERE v.status = 'disponivel' 
  AND (v.repasse_price IS NOT NULL AND v.repasse_price > 0);

-- Visão segura: revendedor só enxerga seus próprios contratos
CREATE OR REPLACE VIEW portal_repasse.meus_contratos AS
SELECT 
    c.id,
    c.contract_number,
    c.created_at,
    c.status,
    c.sale_price,
    c.buyer_name,
    c.signed_contract_url
FROM public.contracts c
WHERE c.reseller_id IN (
    SELECT r.id FROM public.resellers r WHERE r.user_id = auth.uid()
);

-- Permissões do Projeto 2
GRANT USAGE ON SCHEMA portal_repasse TO authenticated, anon;
GRANT SELECT ON ALL TABLES IN SCHEMA portal_repasse TO authenticated;

-- ----------------------------------------------------------------------------
-- PROJETO 3: SCHEMA patio_operacional (Isolamento para Operadores de Pátio)
-- ----------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS patio_operacional;

-- Visão segura: pátio só enxerga os lotes de caminhão e itens de conferência
CREATE OR REPLACE VIEW patio_operacional.lotes_ativos AS
SELECT 
    b.id,
    b.batch_code,
    b.truck_identifier,
    b.driver_name,
    b.origin_supplier,
    b.total_boxes,
    b.unloaded_boxes,
    b.rejected_boxes,
    b.status,
    b.started_at,
    s.name AS loja_destino
FROM public.inbound_cargo_batches b
LEFT JOIN public.stores s ON s.id = b.target_store_id
WHERE b.status IN ('in_progress', 'draft');

CREATE OR REPLACE VIEW patio_operacional.itens_conferencia AS
SELECT 
    i.id,
    i.batch_id,
    i.box_sequence_id,
    i.chassis_number,
    i.engine_number,
    i.model_name,
    i.engine_cc,
    i.color,
    i.belongs_to_our_store,
    i.is_unloaded,
    i.unloaded_at,
    i.status
FROM public.inbound_cargo_items i;

-- Permissões do Projeto 3
GRANT USAGE ON SCHEMA patio_operacional TO authenticated, anon;
GRANT SELECT ON ALL TABLES IN SCHEMA patio_operacional TO authenticated;

-- ----------------------------------------------------------------------------
-- 4. FUNÇÃO PARA ATUALIZAR CONTADORES DO ROMANEIO AUTOMATICAMENTE
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sync_inbound_batch_counters()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.inbound_cargo_batches
    SET 
        unloaded_boxes = (
            SELECT count(*) 
            FROM public.inbound_cargo_items 
            WHERE batch_id = COALESCE(NEW.batch_id, OLD.batch_id) 
              AND is_unloaded = true
        ),
        rejected_boxes = (
            SELECT count(*) 
            FROM public.inbound_cargo_items 
            WHERE batch_id = COALESCE(NEW.batch_id, OLD.batch_id) 
              AND status = 'rejected_wrong_store'
        ),
        updated_at = now()
    WHERE id = COALESCE(NEW.batch_id, OLD.batch_id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_inbound_counters ON public.inbound_cargo_items;
CREATE TRIGGER trg_sync_inbound_counters
AFTER INSERT OR UPDATE OR DELETE ON public.inbound_cargo_items
FOR EACH ROW EXECUTE FUNCTION public.sync_inbound_batch_counters();

-- ============================================================================
-- FIM DA OTIMIZAÇÃO
-- ============================================================================
