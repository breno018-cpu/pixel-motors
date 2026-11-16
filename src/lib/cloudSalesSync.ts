import { supabase } from '@/integrations/supabase/client';
import { queryClient } from '@/lib/queryClient';
import { SheetRowV9, convertContractsSeedToSheetRows, SHEET_STORAGE_KEY_V9 } from '@/lib/dealershipSheetParser';

export const GLOBAL_SYNC_CONTRACT_NUMBER = 'DEALFLOW_GLOBAL_SYNC';
export const LOCAL_DELETED_KEY = 'dealflow_deleted_contract_ids';
export const LOCAL_CANCELLED_KEY = 'dealflow_cancelled_contract_ids';
export const LOCAL_INVOICES_KEY = 'dealflow_registered_invoices_v1';

export interface RegisteredInvoice {
  id: string;
  invoice_number: string;
  series?: string;
  access_key?: string; // Chave de acesso SEFAZ de 44 dígitos
  issue_date: string;
  store_id: string;
  store_name?: string;
  // Venda vinculada (opcional)
  sale_id?: string;
  contract_number?: string;
  // Dados do cliente
  customer_name: string;
  customer_document: string;
  customer_phone?: string;
  customer_email?: string;
  customer_address?: string;
  // Dados da motocicleta
  vehicle_model: string;
  vehicle_chassis: string;
  vehicle_brand?: string;
  vehicle_color?: string;
  vehicle_year?: number;
  alienacao?: string;
  // Valores fiscais
  operation_nature?: string; // Venda de Moto 0KM, Seminovos, etc.
  total_value: number;
  tax_rate?: number;
  tax_value?: number;
  status: 'emitida' | 'cancelada';
  notes?: string;
  // Anexo oficial da NF
  attachment_name?: string;
  attachment_url?: string; // Data URL Base64 ou Link público do arquivo
  attachment_size?: number;
  attachment_type?: string;
  created_at: string;
  created_by?: string;
  // Cancelamento
  cancellation_date?: string;
  cancellation_reason?: string;
  cancellation_type?: 'estorno' | 'credito' | 'devolucao';
  sefaz_protocol?: string;
}

export interface CloudSyncState {
  deleted_ids: string[];
  cancelled_ids: string[];
  last_sync: string;
  sheet_rows?: SheetRowV9[];
  registered_invoices?: RegisteredInvoice[];
  version?: number;
}

let syncInProgress = false;
let realtimeChannel: any = null;

/**
 * Lê o estado global da nuvem (Supabase contracts -> DEALFLOW_GLOBAL_SYNC).
 * Se não existir, inicializa automaticamente com a base canônica.
 */
export async function fetchCloudSyncState(): Promise<CloudSyncState> {
  try {
    const { data, error } = await supabase
      .from('contracts')
      .select('id, contract_number, clause_variables, external_data')
      .eq('contract_number', 'DEALFLOW_GLOBAL_SYNC')
      .maybeSingle();

    if (error) {
      console.warn('[cloudSalesSync] Erro ao buscar sync global no Supabase:', error.message);
      return getLocalSyncFallback();
    }

    if (data) {
      const cv = (data.clause_variables || {}) as any;
      const ext = (data.external_data || {}) as any;

      const deleted_ids = Array.isArray(cv.deleted_ids) ? cv.deleted_ids.map(String) : [];
      const cancelled_ids = Array.isArray(cv.cancelled_ids) ? cv.cancelled_ids.map(String) : [];
      const sheet_rows = Array.isArray(ext.sheet_rows) ? (ext.sheet_rows as SheetRowV9[]) : undefined;
      const registered_invoices = Array.isArray(ext.registered_invoices) ? (ext.registered_invoices as RegisteredInvoice[]) : [];

      // Mantém localStorage alinhado com a nuvem
      try {
        localStorage.setItem(LOCAL_DELETED_KEY, JSON.stringify(deleted_ids));
        localStorage.setItem(LOCAL_CANCELLED_KEY, JSON.stringify(cancelled_ids));
        localStorage.setItem(LOCAL_INVOICES_KEY, JSON.stringify(registered_invoices));
        if (sheet_rows && sheet_rows.length > 0) {
          localStorage.setItem(SHEET_STORAGE_KEY_V9, JSON.stringify(sheet_rows));
        }
      } catch {}

      return {
        deleted_ids,
        cancelled_ids,
        last_sync: cv.last_sync || new Date().toISOString(),
        sheet_rows,
        registered_invoices,
        version: ext.version || 1,
      };
    }

    // Registro ainda não existe no Supabase -> inicializa agora
    return await initializeCloudSyncRecord();
  } catch (err: any) {
    console.warn('[cloudSalesSync] Falha na consulta de sincronização:', err?.message);
    return getLocalSyncFallback();
  }
}

/** Fallback se a nuvem estiver indisponível no momento */
function getLocalSyncFallback(): CloudSyncState {
  let deleted_ids: string[] = [];
  let cancelled_ids: string[] = [];
  let sheet_rows: SheetRowV9[] | undefined;
  let registered_invoices: RegisteredInvoice[] = [];

  try {
    const rawDel = localStorage.getItem(LOCAL_DELETED_KEY);
    if (rawDel) deleted_ids = JSON.parse(rawDel);
    const rawCanc = localStorage.getItem(LOCAL_CANCELLED_KEY);
    if (rawCanc) cancelled_ids = JSON.parse(rawCanc);
    const rawSheet = localStorage.getItem(SHEET_STORAGE_KEY_V9);
    if (rawSheet) sheet_rows = JSON.parse(rawSheet);
    const rawInv = localStorage.getItem(LOCAL_INVOICES_KEY);
    if (rawInv) registered_invoices = JSON.parse(rawInv);
  } catch {}

  return {
    deleted_ids,
    cancelled_ids,
    last_sync: new Date().toISOString(),
    sheet_rows,
    registered_invoices,
  };
}

/** Inicializa o registro mestre de sincronização no Supabase */
async function initializeCloudSyncRecord(): Promise<CloudSyncState> {
  const initialRows = convertContractsSeedToSheetRows();
  let localDeleted: string[] = [];
  let localCancelled: string[] = [];

  try {
    const rawDel = localStorage.getItem(LOCAL_DELETED_KEY);
    if (rawDel) localDeleted = JSON.parse(rawDel);
    const rawCanc = localStorage.getItem(LOCAL_CANCELLED_KEY);
    if (rawCanc) localCancelled = JSON.parse(rawCanc);
  } catch {}

  // Pega store e vehicle válidos para chave estrangeira do Supabase
  let storeId = 'e8254a81-d669-464b-9806-457ba25ce7f0';
  let vehicleId = 'aa393680-94aa-4251-a06b-39a0da70c19a';
  try {
    const { data: s } = await supabase.from('stores').select('id').limit(1).maybeSingle();
    if (s?.id) storeId = s.id;
    const { data: v } = await supabase.from('vehicles').select('id').limit(1).maybeSingle();
    if (v?.id) vehicleId = v.id;
  } catch {}

  const payload: any = {
    contract_number: GLOBAL_SYNC_CONTRACT_NUMBER,
    buyer_name: 'DEALFLOW_SYNC_SYSTEM',
    buyer_cpf: '00000000000',
    sale_price: 0,
    store_id: storeId,
    vehicle_id: vehicleId,
    status: 'concluido',
    contract_type: 'system_state',
    notes: 'Configurações globais de sincronização entre dispositivos',
    clause_variables: {
      deleted_ids: localDeleted,
      cancelled_ids: localCancelled,
      last_sync: new Date().toISOString(),
    },
    external_data: {
      sheet_rows: initialRows,
      version: 1,
      updated_at: new Date().toISOString(),
      is_system_record: true,
    },
  };

  try {
    await supabase.from('contracts').upsert([payload], { onConflict: 'contract_number' });
  } catch (err) {
    console.warn('[cloudSalesSync] Falha ao upsert inicial de sincronização:', err);
  }

  return {
    deleted_ids: localDeleted,
    cancelled_ids: localCancelled,
    last_sync: new Date().toISOString(),
    sheet_rows: initialRows,
    version: 1,
  };
}

/**
 * Salva as linhas da planilha oficial diretamente no Supabase em tempo real.
 * Todos os dispositivos (gerentes, vendedores, donos) receberão esta versão atualizada.
 */
export async function cloudSaveSheetRows(rows: SheetRowV9[]): Promise<boolean> {
  try {
    // 1. Atualiza imediatamente cache local do navegador corrente
    localStorage.setItem(SHEET_STORAGE_KEY_V9, JSON.stringify(rows));

    // 2. Salva na nuvem (Supabase)
    const { error } = await supabase
      .from('contracts')
      .update({
        external_data: {
          sheet_rows: rows,
          version: Date.now(),
          updated_at: new Date().toISOString(),
          is_system_record: true,
        },
      })
      .eq('contract_number', GLOBAL_SYNC_CONTRACT_NUMBER);

    if (error) {
      console.warn('[cloudSalesSync] Aviso ao persistir sheet_rows na nuvem:', error.message);
    }

    // 3. Notifica componentes locais
    window.dispatchEvent(new CustomEvent('dealflow:sheet-updated'));
    window.dispatchEvent(new CustomEvent('dealflow:sales-updated'));
    queryClient.invalidateQueries({ queryKey: ['cloud-monthly-sheet-v9'] });
    queryClient.invalidateQueries({ queryKey: ['contracts'] });
    queryClient.invalidateQueries({ queryKey: ['contract-stats'] });

    return true;
  } catch (err: any) {
    console.error('[cloudSalesSync] Erro ao salvar linhas da planilha:', err?.message);
    return false;
  }
}

/**
 * Exclui uma venda globalmente em todos os dispositivos.
 * Atualiza o registro mestre de exclusões no Supabase, cancela/remove o contrato no DB,
 * remove a linha da planilha mensal na nuvem e libera o veículo no estoque.
 */
export async function cloudDeleteSale(params: {
  id?: string;
  contract_number?: string;
  chassis?: string;
  buyer_name?: string;
  vehicle_id?: string;
}): Promise<boolean> {
  const isUuid = (val: any) =>
    typeof val === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

  const idToDel = params.id ? String(params.id) : null;
  const numToDel = params.contract_number ? String(params.contract_number).trim() : null;
  const cleanQt = numToDel ? numToDel.replace(/^[A-Z]+-/, '').trim() : null;

  // 1. Atualiza lista de exclusão no Supabase (DEALFLOW_GLOBAL_SYNC)
  try {
    const currentState = await fetchCloudSyncState();
    const updatedDeleted = new Set(currentState.deleted_ids);

    if (idToDel) updatedDeleted.add(idToDel);
    if (numToDel) updatedDeleted.add(numToDel);
    if (cleanQt) {
      updatedDeleted.add(cleanQt);
      updatedDeleted.add(cleanQt.padStart(2, '0'));
    }

    const delArray = Array.from(updatedDeleted);
    localStorage.setItem(LOCAL_DELETED_KEY, JSON.stringify(delArray));

    // Remove também da lista de linhas da planilha na nuvem
    let updatedRows = currentState.sheet_rows || [];
    if (updatedRows.length === 0) {
      try {
        const raw = localStorage.getItem(SHEET_STORAGE_KEY_V9);
        if (raw) updatedRows = JSON.parse(raw);
      } catch {}
    }

    const cleanCh = String(params.chassis || '').trim().toUpperCase();
    const cleanBuyer = String(params.buyer_name || '').trim().toUpperCase();

    const filteredRows = updatedRows.filter((r) => {
      const matchId = idToDel && r.id === idToDel;
      const matchNum = numToDel && (r.qt === numToDel || `DIV-${r.qt}` === numToDel || `MOC-${r.qt}` === numToDel);
      const matchQt = cleanQt && String(r.qt).padStart(2, '0') === cleanQt.padStart(2, '0');
      const matchCh = cleanCh && cleanCh.length >= 6 && r.chassi && String(r.chassi).toUpperCase() === cleanCh;
      const matchBuyer = cleanBuyer && cleanBuyer.length >= 5 && r.cliente && String(r.cliente).toUpperCase().includes(cleanBuyer.slice(0, 5));
      return !(matchId || matchNum || matchQt || matchCh || matchBuyer);
    });

    localStorage.setItem(SHEET_STORAGE_KEY_V9, JSON.stringify(filteredRows));

    await supabase
      .from('contracts')
      .update({
        clause_variables: {
          deleted_ids: delArray,
          cancelled_ids: currentState.cancelled_ids,
          last_sync: new Date().toISOString(),
        },
        external_data: {
          sheet_rows: filteredRows,
          version: Date.now(),
          updated_at: new Date().toISOString(),
          is_system_record: true,
        },
      })
      .eq('contract_number', GLOBAL_SYNC_CONTRACT_NUMBER);
  } catch (err) {
    console.warn('[cloudSalesSync] Erro ao sincronizar exclusão mestre:', err);
  }

  // 2. Se for contrato com UUID no Supabase, tenta delete direto ou marca como excluído
  if (idToDel && isUuid(idToDel)) {
    try {
      const { error: delErr } = await supabase.from('contracts').delete().eq('id', idToDel);
      if (delErr) {
        await supabase
          .from('contracts')
          .update({ status: 'cancelado', notes: '[REGISTRO_EXCLUIDO]' })
          .eq('id', idToDel);
      }
    } catch {}
  }

  // 3. Retorna veículo ao estoque
  try {
    if (params.vehicle_id && isUuid(params.vehicle_id)) {
      await supabase.from('vehicles').update({ status: 'disponivel' }).eq('id', params.vehicle_id);
    }
    if (params.chassis && params.chassis.trim().length >= 4) {
      await supabase
        .from('vehicles')
        .update({ status: 'disponivel' })
        .ilike('chassis', `%${params.chassis.trim()}%`);
    }
  } catch {}

  // 4. Dispara eventos e atualiza queries
  window.dispatchEvent(new CustomEvent('dealflow:sales-updated'));
  window.dispatchEvent(new CustomEvent('dealflow:sheet-updated'));
  queryClient.invalidateQueries({ queryKey: ['contracts'] });
  queryClient.invalidateQueries({ queryKey: ['contract-stats'] });
  queryClient.invalidateQueries({ queryKey: ['cloud-monthly-sheet-v9'] });
  queryClient.invalidateQueries({ queryKey: ['vehicles'] });

  return true;
}

/**
 * Restaura uma venda (volta com uma venda) globalmente em todos os dispositivos.
 * Remove os IDs da lista negra de exclusões no Supabase e restaura a linha da planilha se fornecida.
 */
export async function cloudRestoreSale(params: {
  id: string;
  contract_number?: string;
  restoredRow?: SheetRowV9;
}): Promise<boolean> {
  const isUuid = (val: any) =>
    typeof val === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

  const idToRestore = String(params.id);
  const numToRestore = params.contract_number ? String(params.contract_number).trim() : null;
  const cleanQt = numToRestore ? numToRestore.replace(/^[A-Z]+-/, '').trim() : null;

  try {
    const currentState = await fetchCloudSyncState();
    const updatedDeleted = new Set(currentState.deleted_ids);

    updatedDeleted.delete(idToRestore);
    if (numToRestore) updatedDeleted.delete(numToRestore);
    if (cleanQt) {
      updatedDeleted.delete(cleanQt);
      updatedDeleted.delete(cleanQt.padStart(2, '0'));
    }

    const delArray = Array.from(updatedDeleted);
    localStorage.setItem(LOCAL_DELETED_KEY, JSON.stringify(delArray));

    // Se temos a linha a ser restaurada, recoloca na planilha
    let rows = currentState.sheet_rows || [];
    if (params.restoredRow) {
      const exists = rows.some((r) => r.id === params.restoredRow!.id || (cleanQt && r.qt === cleanQt));
      if (!exists) {
        rows = [...rows, params.restoredRow];
      }
      localStorage.setItem(SHEET_STORAGE_KEY_V9, JSON.stringify(rows));
    }

    await supabase
      .from('contracts')
      .update({
        clause_variables: {
          deleted_ids: delArray,
          cancelled_ids: currentState.cancelled_ids,
          last_sync: new Date().toISOString(),
        },
        external_data: {
          sheet_rows: rows,
          version: Date.now(),
          updated_at: new Date().toISOString(),
          is_system_record: true,
        },
      })
      .eq('contract_number', GLOBAL_SYNC_CONTRACT_NUMBER);

    // Se for contrato no DB com status cancelado/excluído, restaura para concluído
    if (isUuid(idToRestore)) {
      await supabase
        .from('contracts')
        .update({ status: 'concluido', notes: 'Venda restaurada' })
        .eq('id', idToRestore);
    }
  } catch (err) {
    console.warn('[cloudSalesSync] Erro ao restaurar venda:', err);
  }

  window.dispatchEvent(new CustomEvent('dealflow:sales-updated'));
  window.dispatchEvent(new CustomEvent('dealflow:sheet-updated'));
  queryClient.invalidateQueries({ queryKey: ['contracts'] });
  queryClient.invalidateQueries({ queryKey: ['contract-stats'] });
  queryClient.invalidateQueries({ queryKey: ['cloud-monthly-sheet-v9'] });

  return true;
}

/**
 * Registra o cancelamento de uma venda globalmente.
 */
export async function cloudCancelSale(params: {
  id: string;
  contract_number?: string;
  vehicle_id?: string;
  chassis?: string;
}): Promise<boolean> {
  const isUuid = (val: any) =>
    typeof val === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

  const idToCanc = String(params.id);
  const numToCanc = params.contract_number ? String(params.contract_number).trim() : null;

  try {
    const currentState = await fetchCloudSyncState();
    const updatedCancelled = new Set(currentState.cancelled_ids);

    updatedCancelled.add(idToCanc);
    if (numToCanc) updatedCancelled.add(numToCanc);

    const cancArray = Array.from(updatedCancelled);
    localStorage.setItem(LOCAL_CANCELLED_KEY, JSON.stringify(cancArray));

    await supabase
      .from('contracts')
      .update({
        clause_variables: {
          deleted_ids: currentState.deleted_ids,
          cancelled_ids: cancArray,
          last_sync: new Date().toISOString(),
        },
      })
      .eq('contract_number', GLOBAL_SYNC_CONTRACT_NUMBER);

    if (isUuid(idToCanc)) {
      await supabase.from('contracts').update({ status: 'cancelado' }).eq('id', idToCanc);
    }

    if (params.vehicle_id && isUuid(params.vehicle_id)) {
      await supabase.from('vehicles').update({ status: 'disponivel' }).eq('id', params.vehicle_id);
    }
    if (params.chassis && params.chassis.trim().length >= 4) {
      await supabase
        .from('vehicles')
        .update({ status: 'disponivel' })
        .ilike('chassis', `%${params.chassis.trim()}%`);
    }
  } catch (err) {
    console.warn('[cloudSalesSync] Erro ao sincronizar cancelamento:', err);
  }

  window.dispatchEvent(new CustomEvent('dealflow:sales-updated'));
  window.dispatchEvent(new CustomEvent('dealflow:sheet-updated'));
  queryClient.invalidateQueries({ queryKey: ['contracts'] });
  queryClient.invalidateQueries({ queryKey: ['contract-stats'] });
  queryClient.invalidateQueries({ queryKey: ['cloud-monthly-sheet-v9'] });
  queryClient.invalidateQueries({ queryKey: ['vehicles'] });

  return true;
}

/**
 * Inicializa a assinatura em tempo real (Supabase Realtime) para que alterações
 * feitas por qualquer usuário/dispositivo reflitam instantaneamente na tela dos outros.
 */
export function initCloudSalesRealtime() {
  if (realtimeChannel) return;

  try {
    realtimeChannel = supabase
      .channel('dealflow-cloud-sync-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contracts' },
        (payload: any) => {
          // Se for o registro de sincronização global
          if (payload?.new?.contract_number === GLOBAL_SYNC_CONTRACT_NUMBER) {
            const cv = payload.new.clause_variables || {};
            const ext = payload.new.external_data || {};

            if (Array.isArray(cv.deleted_ids)) {
              localStorage.setItem(LOCAL_DELETED_KEY, JSON.stringify(cv.deleted_ids));
            }
            if (Array.isArray(cv.cancelled_ids)) {
              localStorage.setItem(LOCAL_CANCELLED_KEY, JSON.stringify(cv.cancelled_ids));
            }
            if (Array.isArray(ext.sheet_rows) && ext.sheet_rows.length > 0) {
              localStorage.setItem(SHEET_STORAGE_KEY_V9, JSON.stringify(ext.sheet_rows));
            }
            if (Array.isArray(ext.registered_invoices)) {
              localStorage.setItem(LOCAL_INVOICES_KEY, JSON.stringify(ext.registered_invoices));
              window.dispatchEvent(new CustomEvent('dealflow:invoices-updated'));
              queryClient.invalidateQueries({ queryKey: ['invoices'] });
              queryClient.invalidateQueries({ queryKey: ['store-fiscal-invoices'] });
            }

            window.dispatchEvent(new CustomEvent('dealflow:sheet-updated'));
            window.dispatchEvent(new CustomEvent('dealflow:sales-updated'));
            queryClient.invalidateQueries({ queryKey: ['cloud-monthly-sheet-v9'] });
            queryClient.invalidateQueries({ queryKey: ['contracts'] });
            queryClient.invalidateQueries({ queryKey: ['contract-stats'] });
          } else {
            // Qualquer outro contrato atualizado ou inserido
            queryClient.invalidateQueries({ queryKey: ['contracts'] });
            queryClient.invalidateQueries({ queryKey: ['contract-stats'] });
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
          }
        }
      )
      .subscribe();

    // Re-sincroniza ao focar a janela ou reconectar à internet
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', () => {
        fetchCloudSyncState().then(() => {
          queryClient.invalidateQueries({ queryKey: ['contracts'] });
          queryClient.invalidateQueries({ queryKey: ['cloud-monthly-sheet-v9'] });
          queryClient.invalidateQueries({ queryKey: ['invoices'] });
        });
      });
    }
  } catch (e) {
    console.warn('[cloudSalesSync] Falha ao iniciar realtime:', e);
  }
}

/**
 * Retorna as Notas Fiscais cadastradas de forma semi-manual.
 * REGRA DE NEGÓCIO: Se nenhuma NF foi cadastrada pelo usuário, retorna lista vazia ([]).
 * NUNCA gera NFs automáticas ou fictícias a partir das vendas existentes.
 */
export async function fetchCloudInvoices(): Promise<RegisteredInvoice[]> {
  try {
    const state = await fetchCloudSyncState();
    if (Array.isArray(state.registered_invoices)) {
      return state.registered_invoices;
    }
  } catch (err) {
    console.warn('[cloudSalesSync] Erro ao buscar notas fiscais cadastradas:', err);
  }

  try {
    const raw = localStorage.getItem(LOCAL_INVOICES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}

  return [];
}

/**
 * Cadastra ou atualiza uma Nota Fiscal de forma semi-manual, vinculando-a à venda selecionada.
 * Atualiza o registro em nuvem compartilhado e o contrato/planilha da venda.
 */
export async function cloudSaveInvoice(inv: RegisteredInvoice): Promise<boolean> {
  try {
    const currentState = await fetchCloudSyncState();
    const currentInvoices = currentState.registered_invoices || [];

    // Se já existir NF com esse id ou número, atualiza; senão adiciona
    const existingIdx = currentInvoices.findIndex(
      (item) => item.id === inv.id || (item.invoice_number === inv.invoice_number && item.store_id === inv.store_id)
    );

    let updatedList: RegisteredInvoice[];
    if (existingIdx >= 0) {
      updatedList = [...currentInvoices];
      updatedList[existingIdx] = { ...updatedList[existingIdx], ...inv };
    } else {
      updatedList = [inv, ...currentInvoices];
    }

    // Salva em cache local
    localStorage.setItem(LOCAL_INVOICES_KEY, JSON.stringify(updatedList));

    // Se a NF estiver vinculada a uma venda, anota o número e o anexo na venda
    if (inv.sale_id) {
      const isUuid = (val: any) =>
        typeof val === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

      if (isUuid(inv.sale_id)) {
        try {
          const { data: existingContract } = await supabase
            .from('contracts')
            .select('external_data')
            .eq('id', inv.sale_id)
            .maybeSingle();

          const ext = (existingContract?.external_data || {}) as any;
          await supabase
            .from('contracts')
            .update({
              external_data: {
                ...ext,
                invoice_number: inv.invoice_number,
                invoice_url: inv.attachment_url || null,
                invoice_registered_at: inv.created_at,
              },
            })
            .eq('id', inv.sale_id);
        } catch (e) {
          console.warn('[cloudSaveInvoice] Erro ao vincular NF no contrato:', e);
        }
      }

      // Atualiza também na linha da planilha mensal
      if (currentState.sheet_rows) {
        const updatedRows = currentState.sheet_rows.map((r) => {
          if (r.id === inv.sale_id || (inv.contract_number && r.qt === inv.contract_number)) {
            return {
              ...r,
              comp: inv.attachment_name ? `NF ${inv.invoice_number} Anexada` : r.comp,
              observacoes: `${r.observacoes || ''} [NF ${inv.invoice_number} emitida em ${inv.issue_date}]`.trim(),
            };
          }
          return r;
        });
        localStorage.setItem(SHEET_STORAGE_KEY_V9, JSON.stringify(updatedRows));
      }
    }

    // Atualiza o mestre em nuvem (DEALFLOW_GLOBAL_SYNC)
    const { data: existingMaster } = await supabase
      .from('contracts')
      .select('external_data')
      .eq('contract_number', GLOBAL_SYNC_CONTRACT_NUMBER)
      .maybeSingle();

    const masterExt = (existingMaster?.external_data || {}) as any;

    await supabase
      .from('contracts')
      .update({
        external_data: {
          ...masterExt,
          registered_invoices: updatedList,
          version: Date.now(),
          updated_at: new Date().toISOString(),
          is_system_record: true,
        },
      })
      .eq('contract_number', GLOBAL_SYNC_CONTRACT_NUMBER);

    // Tenta também gravar na tabela invoices do Supabase (quando autenticado)
    try {
      const invPayload: any = {
        id: inv.id,
        invoice_number: inv.invoice_number,
        invoice_type: 'produto',
        issue_date: inv.issue_date,
        store_id: inv.store_id || null,
        customer_name: inv.customer_name,
        customer_document: inv.customer_document || null,
        customer_phone: inv.customer_phone || null,
        customer_email: inv.customer_email || null,
        customer_address: inv.customer_address || null,
        total: inv.total_value,
        subtotal: inv.total_value,
        tax_rate: inv.tax_rate || 0,
        tax_value: inv.tax_value || 0,
        status: inv.status || 'emitida',
        notes: `[moto] ${inv.vehicle_model} - Chassi: ${inv.vehicle_chassis}${inv.alienacao ? ` | Alienação: ${inv.alienacao}` : ''} | Venda: ${inv.contract_number || inv.sale_id || '—'}`,
        items: [
          {
            description: `${inv.vehicle_brand || 'SHINERAY'} ${inv.vehicle_model} (Chassi: ${inv.vehicle_chassis})`,
            quantity: 1,
            unit_value: inv.total_value,
            chassis: inv.vehicle_chassis,
            contract_number: inv.contract_number,
            sale_id: inv.sale_id,
            attachment_name: inv.attachment_name,
            attachment_url: inv.attachment_url,
          },
        ],
      };
      await (supabase as any).from('invoices').upsert([invPayload], { onConflict: 'id' });
    } catch {}

    window.dispatchEvent(new CustomEvent('dealflow:invoices-updated'));
    window.dispatchEvent(new CustomEvent('dealflow:sales-updated'));
    queryClient.invalidateQueries({ queryKey: ['invoices'] });
    queryClient.invalidateQueries({ queryKey: ['contracts'] });
    queryClient.invalidateQueries({ queryKey: ['store-fiscal-invoices'] });

    return true;
  } catch (err: any) {
    console.error('[cloudSalesSync] Erro ao salvar nota fiscal:', err);
    return false;
  }
}

/**
 * Cancela uma Nota Fiscal cadastrada.
 */
export async function cloudCancelInvoice(
  id: string,
  cancelData: {
    date: string;
    reason: string;
    type?: 'estorno' | 'credito' | 'devolucao';
    protocol?: string;
  }
): Promise<boolean> {
  try {
    const list = await fetchCloudInvoices();
    const updated = list.map((item) => {
      if (item.id === id) {
        return {
          ...item,
          status: 'cancelada' as const,
          cancellation_date: cancelData.date,
          cancellation_reason: cancelData.reason,
          cancellation_type: cancelData.type || 'estorno',
          sefaz_protocol: cancelData.protocol || item.sefaz_protocol,
        };
      }
      return item;
    });

    localStorage.setItem(LOCAL_INVOICES_KEY, JSON.stringify(updated));

    const { data: existingMaster } = await supabase
      .from('contracts')
      .select('external_data')
      .eq('contract_number', GLOBAL_SYNC_CONTRACT_NUMBER)
      .maybeSingle();

    const masterExt = (existingMaster?.external_data || {}) as any;

    await supabase
      .from('contracts')
      .update({
        external_data: {
          ...masterExt,
          registered_invoices: updated,
          version: Date.now(),
          updated_at: new Date().toISOString(),
          is_system_record: true,
        },
      })
      .eq('contract_number', GLOBAL_SYNC_CONTRACT_NUMBER);

    try {
      await (supabase as any)
        .from('invoices')
        .update({
          status: 'cancelada',
          notes: `[CANCELADA em ${cancelData.date} - ${cancelData.type?.toUpperCase()}: ${cancelData.reason}]`,
        })
        .eq('id', id);
    } catch {}

    window.dispatchEvent(new CustomEvent('dealflow:invoices-updated'));
    queryClient.invalidateQueries({ queryKey: ['invoices'] });
    queryClient.invalidateQueries({ queryKey: ['store-fiscal-invoices'] });

    return true;
  } catch (err) {
    console.error('[cloudSalesSync] Erro ao cancelar NF:', err);
    return false;
  }
}

/**
 * Exclui uma Nota Fiscal cadastrada.
 */
export async function cloudDeleteInvoice(id: string): Promise<boolean> {
  try {
    const list = await fetchCloudInvoices();
    const updated = list.filter((item) => item.id !== id);

    localStorage.setItem(LOCAL_INVOICES_KEY, JSON.stringify(updated));

    const { data: existingMaster } = await supabase
      .from('contracts')
      .select('external_data')
      .eq('contract_number', GLOBAL_SYNC_CONTRACT_NUMBER)
      .maybeSingle();

    const masterExt = (existingMaster?.external_data || {}) as any;

    await supabase
      .from('contracts')
      .update({
        external_data: {
          ...masterExt,
          registered_invoices: updated,
          version: Date.now(),
          updated_at: new Date().toISOString(),
          is_system_record: true,
        },
      })
      .eq('contract_number', GLOBAL_SYNC_CONTRACT_NUMBER);

    try {
      await (supabase as any).from('invoices').delete().eq('id', id);
    } catch {}

    window.dispatchEvent(new CustomEvent('dealflow:invoices-updated'));
    queryClient.invalidateQueries({ queryKey: ['invoices'] });
    queryClient.invalidateQueries({ queryKey: ['store-fiscal-invoices'] });

    return true;
  } catch (err) {
    console.error('[cloudSalesSync] Erro ao excluir NF:', err);
    return false;
  }
}
