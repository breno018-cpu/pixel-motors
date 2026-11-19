import { supabase } from '@/integrations/supabase/client';
import { queryClient } from '@/lib/queryClient';
import { SheetRowV9, convertContractsSeedToSheetRows, SHEET_STORAGE_KEY_V9 } from '@/lib/dealershipSheetParser';
import { getLocalTodayDateString, normalizeDateToYMD, formatFiscalDate } from '@/lib/fiscalDates';
import { STORE_DIVINOPOLIS_UUID, STORE_MONTESCLAROS_UUID } from '@/hooks/useStores';
import { saveAttachmentToIdb, safeSaveToLocalStorage, cleanLocalStorageBloat } from '@/lib/invoiceAttachmentStorage';

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
  // Campos de Escrituração Fiscal da Diretoria
  fiscal_type?: 'entrada' | 'emissao' | 'cancelamento';
  party_name?: string;
  entry_or_cancel_date?: string;
  // Anexo oficial da NF
  attachment_name?: string;
  attachment_url?: string; // Data URL Base64 ou Link público do arquivo
  attachment_size?: number;
  attachment_type?: string;
  created_at: string;
  created_by?: string;
  // Cancelamento & Reemissão
  original_issue_date?: string;
  cancellation_date?: string;
  cancellation_reason?: string;
  cancellation_type?: 'estorno' | 'credito' | 'devolucao';
  sefaz_protocol?: string;
  reissued_as_invoice_number?: string; // Número da nova NF que substituiu esta
  reissue_of_invoice_number?: string;  // Número da NF anterior que deu origem a esta reemissão
  original_value?: number;             // Valor da 1ª NF original antes da alteração na reemissão
  value_difference?: number;           // Diferença de valor (2ª NF - 1ª NF, ex: +3000 ou -2000)
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

      // Mescla inteligente: NUNCA descarta itens locais mais recentes não sincronizados
      let mergedInvoices = registered_invoices;
      let mergedSheetRows = sheet_rows;

      try {
        // 1. Deleted & Cancelled: união com exclusões locais
        const rawDel = localStorage.getItem(LOCAL_DELETED_KEY);
        const localDel: string[] = rawDel ? JSON.parse(rawDel) : [];
        const allDeleted = Array.from(new Set([...deleted_ids, ...localDel]));
        localStorage.setItem(LOCAL_DELETED_KEY, JSON.stringify(allDeleted));

        const rawCanc = localStorage.getItem(LOCAL_CANCELLED_KEY);
        const localCanc: string[] = rawCanc ? JSON.parse(rawCanc) : [];
        const allCancelled = Array.from(new Set([...cancelled_ids, ...localCanc]));
        localStorage.setItem(LOCAL_CANCELLED_KEY, JSON.stringify(allCancelled));

        // 2. Invoices: deduplicação por ID e chave (loja + número da NF)
        const rawInvs = localStorage.getItem(LOCAL_INVOICES_KEY);
        const localInvs: RegisteredInvoice[] = rawInvs ? JSON.parse(rawInvs) : [];
        if (localInvs.length > 0) {
          const invMap = new Map<string, RegisteredInvoice>();
          registered_invoices.forEach((inv) => {
            if (inv.id) invMap.set(inv.id, inv);
            const numKey = `${inv.store_id || ''}::${inv.invoice_number || ''}`.toUpperCase();
            if (numKey !== '::') invMap.set(numKey, inv);
          });
          localInvs.forEach((localInv) => {
            const numKey = `${localInv.store_id || ''}::${localInv.invoice_number || ''}`.toUpperCase();
            const existing = invMap.get(localInv.id) || (numKey !== '::' ? invMap.get(numKey) : undefined);
            if (!existing) {
              invMap.set(localInv.id, localInv);
            } else if (localInv.attachment_url && !existing.attachment_url) {
              invMap.set(localInv.id, { ...existing, ...localInv });
            }
          });
          const seenIds = new Set<string>();
          mergedInvoices = Array.from(invMap.values()).filter((inv) => {
            if (!inv.id || seenIds.has(inv.id)) return false;
            seenIds.add(inv.id);
            return true;
          });
        }
        safeSaveToLocalStorage(LOCAL_INVOICES_KEY, mergedInvoices);

        // 3. Sheet rows: O Supabase é a autoridade máxima; nunca reintroduz linhas apagadas do cache local
        const rawSheet = localStorage.getItem(SHEET_STORAGE_KEY_V9);
        const localSheet: SheetRowV9[] = rawSheet ? JSON.parse(rawSheet) : [];
        if (sheet_rows && sheet_rows.length > 0) {
          const rowMap = new Map<string, SheetRowV9>();
          sheet_rows.forEach((r) => {
            if (r.id) rowMap.set(r.id, r);
            if (r.qt) rowMap.set(`qt::${String(r.qt).replace(/^[A-Z]+-/, '')}`, r);
          });

          // Apenas adiciona registros se forem explicitamente marcados como pendentes offline
          localSheet.forEach((lr) => {
            if ((lr as any).is_offline_pending) {
              const qtKey = lr.qt ? `qt::${String(lr.qt).replace(/^[A-Z]+-/, '')}` : '';
              const existing = (lr.id ? rowMap.get(lr.id) : undefined) || (qtKey ? rowMap.get(qtKey) : undefined);
              if (!existing) {
                rowMap.set(lr.id || `local-${Math.random()}`, lr);
              }
            }
          });

          const seenRowIds = new Set<string>();
          mergedSheetRows = Array.from(rowMap.values()).filter((r) => {
            const uniqueKey = r.id || `qt-${r.qt}`;
            if (seenRowIds.has(uniqueKey)) return false;
            seenRowIds.add(uniqueKey);
            return true;
          });
        } else if (localSheet.length > 0) {
          mergedSheetRows = localSheet;
        }
        if (mergedSheetRows && mergedSheetRows.length > 0) {
          localStorage.setItem(SHEET_STORAGE_KEY_V9, JSON.stringify(mergedSheetRows));
        }
      } catch (mergeErr) {
        console.warn('[cloudSalesSync] Aviso ao mesclar dados locais com remotos:', mergeErr);
      }

      return {
        deleted_ids,
        cancelled_ids,
        last_sync: cv.last_sync || new Date().toISOString(),
        sheet_rows: mergedSheetRows,
        registered_invoices: mergedInvoices,
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

    // 2. Busca estado atual para preservar notas fiscais cadastradas (mescla inteligente por ID)
    let localInvoices: RegisteredInvoice[] = [];
    try {
      const rawInvs = localStorage.getItem(LOCAL_INVOICES_KEY);
      if (rawInvs) localInvoices = JSON.parse(rawInvs);
    } catch {}

    const { data: currentMaster } = await supabase
      .from('contracts')
      .select('external_data')
      .eq('contract_number', GLOBAL_SYNC_CONTRACT_NUMBER)
      .maybeSingle();

    const masterExt = (currentMaster?.external_data || {}) as any;
    const remoteInvoices: RegisteredInvoice[] = Array.isArray(masterExt.registered_invoices) ? masterExt.registered_invoices : [];

    const mergedInvoices = remoteInvoices.length > 0 ? remoteInvoices : localInvoices;

    // 3. Salva na nuvem (Supabase) preservando registered_invoices
    const { error } = await supabase
      .from('contracts')
      .update({
        external_data: {
          ...masterExt,
          registered_invoices: mergedInvoices,
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

    const existingInvoices = currentState.registered_invoices || [];

    await supabase
      .from('contracts')
      .update({
        clause_variables: {
          deleted_ids: delArray,
          cancelled_ids: currentState.cancelled_ids,
          last_sync: new Date().toISOString(),
        },
        external_data: {
          registered_invoices: existingInvoices,
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

    const existingInvoices = currentState.registered_invoices || [];

    await supabase
      .from('contracts')
      .update({
        clause_variables: {
          deleted_ids: delArray,
          cancelled_ids: currentState.cancelled_ids,
          last_sync: new Date().toISOString(),
        },
        external_data: {
          registered_invoices: existingInvoices,
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
              safeSaveToLocalStorage(LOCAL_INVOICES_KEY, ext.registered_invoices);
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
 * Garante UUID válido no PostgreSQL e salvamento local instantâneo (0ms).
 */
export async function cloudSaveInvoice(inv: RegisteredInvoice): Promise<boolean> {
  const isUuid = (val: any) =>
    typeof val === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

  // Garante UUID válido para a chave primária no PostgreSQL
  const safeId = isUuid(inv.id)
    ? inv.id
    : typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : '00000000-0000-4000-8000-' + Date.now().toString(16).padStart(12, '0');

  // Mapeia store_id textual para UUID válido se necessário
  let resolvedStoreId = inv.store_id || STORE_DIVINOPOLIS_UUID;
  if (!isUuid(resolvedStoreId)) {
    if (resolvedStoreId.includes('montes')) {
      resolvedStoreId = STORE_MONTESCLAROS_UUID;
    } else {
      resolvedStoreId = STORE_DIVINOPOLIS_UUID;
    }
  }

  // Normalização estrita da data de emissão para YYYY-MM-DD
  const normalizedIssueDate = normalizeDateToYMD(inv.issue_date);

  const readyInvoice: RegisteredInvoice = {
    ...inv,
    id: safeId,
    store_id: resolvedStoreId,
    issue_date: normalizedIssueDate,
  };

  // 1. ATUALIZAÇÃO IMEDIATA (0ms) no LocalStorage e eventos locais para feedback instantâneo
  try {
    let localInvs: RegisteredInvoice[] = [];
    const raw = localStorage.getItem(LOCAL_INVOICES_KEY);
    if (raw) localInvs = JSON.parse(raw);

    // Se é uma reemissão substituta, remove a NF anterior de todas as listas locais (mantém apenas 1 cópia única)
    if (readyInvoice.reissue_of_invoice_number) {
      localInvs = localInvs.filter(
        (item) => item.invoice_number !== readyInvoice.reissue_of_invoice_number
      );
      // Também limpa do armazenamento de NFs da Diretoria
      try {
        const ownerRaw = localStorage.getItem('dealflow_store_fiscal_invoices_v1');
        if (ownerRaw) {
          const ownerList = JSON.parse(ownerRaw);
          if (Array.isArray(ownerList)) {
            const cleanOwner = ownerList.filter(
              (item: any) => item.invoice_number !== readyInvoice.reissue_of_invoice_number
            );
            safeSaveToLocalStorage('dealflow_store_fiscal_invoices_v1', cleanOwner);
          }
        }
      } catch {}
    }

    const existingIdx = localInvs.findIndex(
      (item) => item.id === readyInvoice.id || (item.invoice_number === readyInvoice.invoice_number && item.store_id === readyInvoice.store_id)
    );

    let updatedList: RegisteredInvoice[];
    if (existingIdx >= 0) {
      updatedList = [...localInvs];
      updatedList[existingIdx] = { ...updatedList[existingIdx], ...readyInvoice };
    } else {
      updatedList = [readyInvoice, ...localInvs];
    }

    // Salva anexo em IndexedDB para nunca perder o arquivo original mesmo se localStorage estourar
    if (readyInvoice.attachment_url) {
      saveAttachmentToIdb({
        id: readyInvoice.id,
        name: readyInvoice.attachment_name || `NF_${readyInvoice.invoice_number}`,
        url: readyInvoice.attachment_url,
        size: readyInvoice.attachment_size || 0,
        type: readyInvoice.attachment_type || 'application/pdf',
        updated_at: new Date().toISOString(),
      }).catch((idbErr) => console.warn('[cloudSaveInvoice] Aviso IDB:', idbErr));
    }

    safeSaveToLocalStorage(LOCAL_INVOICES_KEY, updatedList);

    // Atualiza imediatamente o cache em memória do React Query (0ms)
    queryClient.setQueryData<any[]>(['invoices'], (old = []) => {
      const isMoc = (readyInvoice.store_id || '').includes('montes') || (readyInvoice.store_name || '').toLowerCase().includes('montes');
      const mappedInv = {
        id: readyInvoice.id,
        invoice_number: readyInvoice.invoice_number,
        series: readyInvoice.series || '1',
        access_key: readyInvoice.access_key,
        sefaz_protocol: readyInvoice.sefaz_protocol || null,
        invoice_type: 'produto',
        issue_date: readyInvoice.issue_date,
        store_id: readyInvoice.store_id,
        sale_id: readyInvoice.sale_id || null,
        contract_number: readyInvoice.contract_number || null,
        customer_name: readyInvoice.customer_name,
        customer_document: readyInvoice.customer_document || null,
        customer_phone: readyInvoice.customer_phone || null,
        customer_email: readyInvoice.customer_email || null,
        customer_address: readyInvoice.customer_address || null,
        items: [
          {
            description: `${readyInvoice.vehicle_brand || 'SHINERAY'} ${readyInvoice.vehicle_model} (Chassi: ${readyInvoice.vehicle_chassis})`,
            quantity: 1,
            unit_value: readyInvoice.total_value,
            chassis: readyInvoice.vehicle_chassis,
            contract_number: readyInvoice.contract_number,
            sale_id: readyInvoice.sale_id,
            series: readyInvoice.series || '1',
            access_key: readyInvoice.access_key,
            sefaz_protocol: readyInvoice.sefaz_protocol || null,
            attachment_name: readyInvoice.attachment_name,
            attachment_url: readyInvoice.attachment_url,
            attachment_size: readyInvoice.attachment_size,
            attachment_type: readyInvoice.attachment_type,
            vehicle_model: readyInvoice.vehicle_model,
            vehicle_chassis: readyInvoice.vehicle_chassis,
            vehicle_brand: readyInvoice.vehicle_brand || 'SHINERAY',
            vehicle_color: readyInvoice.vehicle_color,
            vehicle_year: readyInvoice.vehicle_year,
            alienacao: readyInvoice.alienacao,
          },
        ],
        subtotal: readyInvoice.total_value,
        tax_rate: readyInvoice.tax_rate || 0,
        tax_value: readyInvoice.tax_value || 0,
        total: readyInvoice.total_value,
        status: readyInvoice.status || 'emitida',
        notes: readyInvoice.notes || null,
        attachment_name: readyInvoice.attachment_name || null,
        attachment_url: readyInvoice.attachment_url || null,
        attachment_size: readyInvoice.attachment_size || null,
        attachment_type: readyInvoice.attachment_type || null,
        created_at: readyInvoice.created_at,
        store: {
          id: readyInvoice.store_id,
          name: readyInvoice.store_name || (isMoc ? 'Concessionária Montes Claros' : 'Concessionária Divinópolis'),
          city: isMoc ? 'Montes Claros' : 'Divinópolis',
          state: 'MG',
        },
      };

      let baseOld = old;
      if (readyInvoice.reissue_of_invoice_number) {
        baseOld = old.filter((x) => x.invoice_number !== readyInvoice.reissue_of_invoice_number);
      }

      const idx = baseOld.findIndex(
        (x) => x.id === readyInvoice.id || (x.invoice_number === readyInvoice.invoice_number && x.store_id === readyInvoice.store_id)
      );
      if (idx >= 0) {
        const copy = [...baseOld];
        copy[idx] = { ...copy[idx], ...mappedInv };
        return copy;
      }
      return [mappedInv, ...baseOld];
    });

    // Notifica componentes imediatamente
    window.dispatchEvent(new CustomEvent('dealflow:invoices-updated'));
    window.dispatchEvent(new CustomEvent('dealflow:sales-updated'));
  } catch (localErr) {
    console.warn('[cloudSaveInvoice] Erro ao salvar localmente:', localErr);
  }

  // 2. SINCRONIZAÇÃO EM NUVEM EM PARALELO (Supabase DEALFLOW_GLOBAL_SYNC + contracts + invoices)
  try {
    const [currentState, existingContractRes] = await Promise.all([
      fetchCloudSyncState(),
      (readyInvoice.sale_id && isUuid(readyInvoice.sale_id))
        ? supabase.from('contracts').select('external_data').eq('id', readyInvoice.sale_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    if (readyInvoice.attachment_url && readyInvoice.attachment_url.startsWith('data:')) {
      try {
        const idbPointer = await saveAttachmentToIdb(
          readyInvoice.id,
          readyInvoice.attachment_name,
          readyInvoice.attachment_url,
          readyInvoice.attachment_type,
          readyInvoice.attachment_size
        );
        readyInvoice.attachment_url = idbPointer;
      } catch (e) {
        console.warn('Falha ao salvar anexo no IDB:', e);
      }
    }

    let currentInvoices = currentState.registered_invoices || [];
    if (readyInvoice.reissue_of_invoice_number) {
      currentInvoices = currentInvoices.filter(
        (item) => item.invoice_number !== readyInvoice.reissue_of_invoice_number
      );
      void supabase.from('invoices').delete().eq('invoice_number', readyInvoice.reissue_of_invoice_number);
    }
    const existingIdx = currentInvoices.findIndex(
      (item) => item.id === readyInvoice.id || (item.invoice_number === readyInvoice.invoice_number && item.store_id === readyInvoice.store_id)
    );

    let updatedList: RegisteredInvoice[];
    if (existingIdx >= 0) {
      updatedList = [...currentInvoices];
      updatedList[existingIdx] = { ...updatedList[existingIdx], ...readyInvoice };
    } else {
      updatedList = [readyInvoice, ...currentInvoices];
    }

    safeSaveToLocalStorage(LOCAL_INVOICES_KEY, updatedList);

    // Atualiza linha da planilha se existir
    let preservedSheetRows = currentState.sheet_rows || [];
    if (currentState.sheet_rows) {
      preservedSheetRows = currentState.sheet_rows.map((r) => {
        if (r.id === readyInvoice.sale_id || (readyInvoice.contract_number && r.qt === readyInvoice.contract_number)) {
          return {
            ...r,
            comp: readyInvoice.attachment_name ? `NF ${readyInvoice.invoice_number} Anexada` : r.comp,
            observacoes: `${r.observacoes || ''} [NF ${readyInvoice.invoice_number} emitida em ${readyInvoice.issue_date}]`.trim(),
          };
        }
        return r;
      });
      localStorage.setItem(SHEET_STORAGE_KEY_V9, JSON.stringify(preservedSheetRows));
    }

    // Objeto estritamente compatível com o schema da tabela public.invoices no Supabase
    const fiscalType = readyInvoice.fiscal_type || 'emissao';
    const invPayload: any = {
      id: readyInvoice.id,
      invoice_number: readyInvoice.invoice_number,
      invoice_type: fiscalType === 'entrada' ? 'entrada' : fiscalType === 'cancelamento' ? 'cancelamento' : 'produto',
      issue_date: readyInvoice.issue_date,
      store_id: isUuid(readyInvoice.store_id) ? readyInvoice.store_id : null,
      customer_name: readyInvoice.customer_name || readyInvoice.party_name || 'Consumidor Final',
      customer_document: readyInvoice.customer_document || null,
      customer_phone: readyInvoice.customer_phone || null,
      customer_email: readyInvoice.customer_email || null,
      customer_address: readyInvoice.customer_address || null,
      total: readyInvoice.total_value,
      subtotal: readyInvoice.total_value,
      tax_rate: readyInvoice.tax_rate || 0,
      tax_value: readyInvoice.tax_value || 0,
      status: readyInvoice.status || 'emitida',
      notes: readyInvoice.notes || `${fiscalType === 'entrada' ? '[remessa]' : '[moto]'} ${readyInvoice.vehicle_model || 'Operação Fiscal'}${readyInvoice.sefaz_protocol ? ` | Protocolo SEFAZ: ${readyInvoice.sefaz_protocol}` : ''}`,
      items: [
        {
          description: fiscalType === 'entrada'
            ? 'Entrada de Veículos / Peças (Remessa Montadora)'
            : `${readyInvoice.vehicle_brand || 'SHINERAY'} ${readyInvoice.vehicle_model || 'Motocicleta'} (Chassi: ${readyInvoice.vehicle_chassis || '—'})`,
          quantity: 1,
          unit_value: readyInvoice.total_value,
          chassis: readyInvoice.vehicle_chassis,
          contract_number: readyInvoice.contract_number,
          sale_id: readyInvoice.sale_id,
          series: readyInvoice.series || '1',
          access_key: readyInvoice.access_key || null,
          sefaz_protocol: readyInvoice.sefaz_protocol || null,
          attachment_name: readyInvoice.attachment_name || null,
          attachment_url: readyInvoice.attachment_url || null,
          attachment_size: readyInvoice.attachment_size || null,
          attachment_type: readyInvoice.attachment_type || null,
          vehicle_model: readyInvoice.vehicle_model,
          vehicle_chassis: readyInvoice.vehicle_chassis,
          vehicle_brand: readyInvoice.vehicle_brand || 'SHINERAY',
          vehicle_color: readyInvoice.vehicle_color || 'Padrão',
          vehicle_year: readyInvoice.vehicle_year || 2026,
          alienacao: readyInvoice.alienacao || 'À VISTA',
        },
      ],
    };

    const existingContract = existingContractRes?.data;
    const contractExt = (existingContract?.external_data || {}) as any;

    // Dispara gravações na nuvem simultaneamente (Promise.all)
    await Promise.all([
      // A. Mestre global DEALFLOW_GLOBAL_SYNC
      supabase
        .from('contracts')
        .update({
          external_data: {
            sheet_rows: preservedSheetRows,
            registered_invoices: updatedList,
            version: Date.now(),
            updated_at: new Date().toISOString(),
            is_system_record: true,
          },
        })
        .eq('contract_number', GLOBAL_SYNC_CONTRACT_NUMBER),

      // B. Contrato da venda (se vinculado)
      (readyInvoice.sale_id && isUuid(readyInvoice.sale_id))
        ? supabase
            .from('contracts')
            .update({
              external_data: {
                ...contractExt,
                invoice_number: readyInvoice.invoice_number,
                invoice_series: readyInvoice.series || '1',
                invoice_date: readyInvoice.issue_date,
                invoice_access_key: readyInvoice.access_key || contractExt.invoice_access_key || null,
                invoice_sefaz_protocol: readyInvoice.sefaz_protocol || contractExt.invoice_sefaz_protocol || null,
                sefaz_protocol: readyInvoice.sefaz_protocol || contractExt.sefaz_protocol || null,
                invoice_url: readyInvoice.attachment_url || null,
                invoice_name: readyInvoice.attachment_name || null,
                invoice_size: readyInvoice.attachment_size || null,
                invoice_type: readyInvoice.attachment_type || null,
                invoice_registered_at: readyInvoice.created_at,
              },
            })
            .eq('id', readyInvoice.sale_id)
        : Promise.resolve(null),

      // C. Tabela invoices do Supabase (ignora erro se RLS impedir para salvar mestre)
      (supabase as any)
        .from('invoices')
        .upsert([invPayload], { onConflict: 'id' })
        .then(() => null)
        .catch((invDbErr: any) => console.warn('[cloudSaveInvoice] Aviso ao salvar tabela invoices:', invDbErr)),
    ]);

    // Invalida em segundo plano sem travar
    queryClient.invalidateQueries({ queryKey: ['invoices'], refetchType: 'none' });
    queryClient.invalidateQueries({ queryKey: ['contracts'], refetchType: 'none' });

    return true;
  } catch (err: any) {
    console.error('[cloudSalesSync] Aviso de sincronização em nuvem da NF:', err);
    return true;
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

    safeSaveToLocalStorage(LOCAL_INVOICES_KEY, updated);

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

    safeSaveToLocalStorage(LOCAL_INVOICES_KEY, updated);

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

/**
 * Anexa ou atualiza a Nota Fiscal oficial de uma venda,
 * sincronizando tanto no contrato (external_data) quanto na lista global de NFs (registered_invoices e tabela invoices).
 */
export async function cloudAttachInvoiceToSale(
  saleId: string,
  data: {
    invoice_number: string;
    series?: string;
    access_key?: string;
    sefaz_protocol?: string;
    issue_date?: string;
    attachment_name: string;
    attachment_url: string;
    attachment_size?: number;
    attachment_type?: string;
    notes?: string;
  }
): Promise<boolean> {
  const issueDate = data.issue_date || getLocalTodayDateString();
  const series = data.series || '1';

  // 0. Atualização imediata em memória no React Query (0ms)
  try {
    queryClient.setQueryData<any[]>(['contracts'], (old = []) => {
      if (!Array.isArray(old)) return old;
      return old.map((c) => {
        if (c.id === saleId) {
          return {
            ...c,
            external_data: {
              ...((c.external_data as any) || {}),
              invoice_number: data.invoice_number,
              invoice_series: series,
              invoice_date: issueDate,
              invoice_access_key: data.access_key,
              invoice_sefaz_protocol: data.sefaz_protocol,
              sefaz_protocol: data.sefaz_protocol,
              invoice_url: data.attachment_url,
              invoice_name: data.attachment_name,
              invoice_size: data.attachment_size || 0,
              invoice_type: data.attachment_type || 'application/pdf',
              invoice_registered_at: new Date().toISOString(),
            },
          };
        }
        return c;
      });
    });
    window.dispatchEvent(new CustomEvent('dealflow:sales-updated'));
  } catch {}

  try {
    // 1. Obter dados atuais do contrato e cache de NFs em paralelo
    let localInvs: RegisteredInvoice[] = [];
    try {
      const raw = localStorage.getItem(LOCAL_INVOICES_KEY);
      if (raw) localInvs = JSON.parse(raw);
    } catch {}

    const { data: saleContract } = await supabase
      .from('contracts')
      .select('*, vehicle:vehicles(*)')
      .eq('id', saleId)
      .maybeSingle();

    const ext = (saleContract?.external_data || {}) as Record<string, any>;

    // 2. Montar RegisteredInvoice para a central de NFs (/moto-invoices)
    const existingInv = localInvs.find(
      (inv) => inv.sale_id === saleId || (saleContract?.contract_number && inv.contract_number === saleContract.contract_number)
    );

    const vehicle = saleContract?.vehicle as any;
    const vehicleModel = vehicle
      ? `${vehicle.brand || ''} ${vehicle.model || ''}`.trim()
      : ext.vehicle_model_custom || ext.modelo || 'Moto Shineray';
    const vehicleChassis = vehicle?.chassis || ext.chassi || ext.vehicle_chassis || '';
    const vehicleBrand = vehicle?.brand || ext.marca || 'SHINERAY';

    const invoicePayload: RegisteredInvoice = {
      id: existingInv?.id || crypto.randomUUID(),
      invoice_number: data.invoice_number,
      series: series,
      access_key: data.access_key || existingInv?.access_key || ext.invoice_access_key || undefined,
      sefaz_protocol: data.sefaz_protocol || existingInv?.sefaz_protocol || ext.sefaz_protocol || undefined,
      issue_date: issueDate,
      store_id: isUuid(saleContract?.store_id) ? saleContract.store_id : STORE_DIVINOPOLIS_UUID,
      sale_id: saleId,
      contract_number: saleContract?.contract_number || ext.contract_number || '',
      customer_name: saleContract?.buyer_name || ext.buyer_name || 'Comprador',
      customer_document: saleContract?.buyer_cpf || ext.buyer_cpf || '',
      customer_phone: saleContract?.buyer_phone || ext.buyer_phone || '',
      customer_email: saleContract?.buyer_email || ext.buyer_email || '',
      customer_address: saleContract?.buyer_address || ext.buyer_address || '',
      vehicle_model: vehicleModel,
      vehicle_chassis: vehicleChassis,
      vehicle_brand: vehicleBrand,
      vehicle_color: vehicle?.color || ext.cor || 'Padrão',
      vehicle_year: Number(vehicle?.year || ext.ano || 2026),
      alienacao: ext.alienacao || (saleContract?.payment_method === 'financiamento' ? (saleContract as any)?.financing_bank || 'Alienada' : 'À VISTA'),
      operation_nature: 'Venda de Moto Zero KM',
      total_value: Number(saleContract?.sale_price) || Number(ext.valor_total) || 0,
      tax_rate: 0,
      tax_value: 0,
      status: 'emitida',
      notes: data.notes || `[Anexada via Venda ${saleContract?.contract_number || saleId}] ${data.attachment_name}`,
      created_at: existingInv?.created_at || new Date().toISOString(),
      attachment_name: data.attachment_name,
      attachment_url: data.attachment_url,
      attachment_size: data.attachment_size,
      attachment_type: data.attachment_type,
    };

    // 3. Atualiza contrato e central de NFs
    await Promise.all([
      supabase
        .from('contracts')
        .update({
          external_data: {
            ...ext,
            invoice_number: data.invoice_number,
            invoice_series: series,
            invoice_date: issueDate,
            invoice_access_key: data.access_key || ext.invoice_access_key,
            sefaz_protocol: data.sefaz_protocol || ext.sefaz_protocol,
            invoice_url: data.attachment_url,
            invoice_name: data.attachment_name,
            invoice_size: data.attachment_size || 0,
            invoice_type: data.attachment_type || 'application/pdf',
            invoice_registered_at: new Date().toISOString(),
          },
        })
        .eq('id', saleId),
      cloudSaveInvoice(invoicePayload),
    ]);

    return true;
  } catch (err) {
    console.error('[cloudAttachInvoiceToSale] Erro ao anexar NF à venda:', err);
    return false;
  }
}

/**
 * Remove o anexo da Nota Fiscal de uma venda.
 */
export async function cloudDetachInvoiceFromSale(saleId: string): Promise<boolean> {
  try {
    const { data: saleContract } = await supabase
      .from('contracts')
      .select('external_data')
      .eq('id', saleId)
      .maybeSingle();

    const ext = (saleContract?.external_data || {}) as Record<string, any>;
    const updatedExt = { ...ext };
    delete updatedExt.invoice_url;
    delete updatedExt.invoice_name;
    delete updatedExt.invoice_size;
    delete updatedExt.invoice_type;

    await supabase
      .from('contracts')
      .update({ external_data: updatedExt })
      .eq('id', saleId);

    // Também limpa o anexo na lista de NFs se existir
    const existingInvoices = await fetchCloudInvoices();
    const existingInv = existingInvoices.find((inv) => inv.sale_id === saleId);
    if (existingInv) {
      await cloudSaveInvoice({
        ...existingInv,
        attachment_url: undefined,
        attachment_name: undefined,
        attachment_size: undefined,
        attachment_type: undefined,
      });
    }

    window.dispatchEvent(new CustomEvent('dealflow:sales-updated'));
    window.dispatchEvent(new CustomEvent('dealflow:invoices-updated'));
    queryClient.invalidateQueries({ queryKey: ['contracts'] });
    queryClient.invalidateQueries({ queryKey: ['invoices'] });
    return true;
  } catch (err) {
    console.error('[cloudDetachInvoiceFromSale] Erro:', err);
    return false;
  }
}
