import { useState, useEffect, useCallback, useMemo } from 'react';
import { InboundCargoBatch, InboundCargoItem, InboundDivergenceLog } from '@/types/inboundCargo';
import { createSampleBatch } from '@/lib/inboundSampleData';
import { playSuccessBeep, playErrorAlarm, playWarningTone } from '@/lib/audioFeedback';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { recognizeFromChassis } from '@/lib/chassisRecognition';

const STORAGE_KEY = 'pixel_inbound_cargo_batches_v2';
const LEGACY_STORAGE_KEY = 'pixel_inbound_cargo_batches_v1';
const EVENT_NAME = 'pixel_inbound_cargo_changed';

function loadStoredBatches(): InboundCargoBatch[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    }

    // Migração de v1 para v2: descarta lote demo '53880' automático se existir, mantendo apenas lotes reais
    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw) {
      try {
        const legacyParsed = JSON.parse(legacyRaw);
        if (Array.isArray(legacyParsed)) {
          const filtered = legacyParsed.filter(
            (b) => b.id !== 'batch_manifest_53880_l1ma' && b.batch_code !== '53880'
          );
          localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
          return filtered;
        }
      } catch {
        // ignora erro de parse
      }
    }

    // Por padrão o sistema inicia 100% limpo (0 chassis até o usuário importar a lista do caminhão)
    localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    return [];
  } catch (err) {
    console.error('Erro ao ler lotes de carga:', err);
    return [];
  }
}

function saveStoredBatches(batches: InboundCargoBatch[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(batches));
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  } catch (err) {
    console.error('Erro ao salvar lotes de carga:', err);
  }
}

export type ScanResult = 
  | { type: 'success'; item: InboundCargoItem; message: string }
  | { type: 'already_scanned'; item: InboundCargoItem; message: string }
  | { type: 'not_found'; scannedCode: string; message: string };

export function useInboundCargo() {
  const [batches, setBatches] = useState<InboundCargoBatch[]>(loadStoredBatches);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(() => {
    const initial = loadStoredBatches();
    return initial[0]?.id || null;
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    const handler = () => {
      setBatches(loadStoredBatches());
    };
    window.addEventListener(EVENT_NAME, handler);
    return () => window.removeEventListener(EVENT_NAME, handler);
  }, []);

  const activeBatch = useMemo(() => {
    return batches.find((b) => b.id === activeBatchId) || batches[0] || null;
  }, [batches, activeBatchId]);

  // Cria um novo lote de carga
  const createBatch = useCallback((newBatch: InboundCargoBatch) => {
    setBatches((prev) => {
      const updated = [newBatch, ...prev.filter((b) => b.id !== newBatch.id)];
      saveStoredBatches(updated);
      return updated;
    });
    setActiveBatchId(newBatch.id);
  }, []);

  // Deleta um lote
  const deleteBatch = useCallback((batchId: string) => {
    setBatches((prev) => {
      const updated = prev.filter((b) => b.id !== batchId);
      saveStoredBatches(updated);
      return updated;
    });
    if (activeBatchId === batchId) {
      setActiveBatchId(null);
    }
  }, [activeBatchId]);

  // Reinicia conferência do lote
  const resetBatchScans = useCallback((batchId: string) => {
    setBatches((prev) => {
      const updated = prev.map((b) => {
        if (b.id !== batchId) return b;
        return {
          ...b,
          status: 'aguardando_descarga' as const,
          scanned_items: 0,
          divergent_items: 0,
          updated_at: new Date().toISOString(),
          items: b.items.map((item) => ({
            ...item,
            scanned: false,
            scanned_at: null,
            scanned_by: null,
          })),
          divergence_logs: [],
        };
      });
      saveStoredBatches(updated);
      return updated;
    });
  }, []);

  /**
   * Bipa uma caixa / chassi no pátio com validação em tempo real e retorno sonoro/tátil
   */
  const scanBox = useCallback((rawCode: string, scannedBy: string = 'Conferente de Pátio'): ScanResult => {
    if (!rawCode || !activeBatch) {
      return {
        type: 'not_found',
        scannedCode: rawCode || '',
        message: 'Código inválido ou nenhum lote selecionado.',
      };
    }

    const cleanInput = rawCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!cleanInput) {
      return {
        type: 'not_found',
        scannedCode: rawCode,
        message: 'Código vazio.',
      };
    }

    // Procura a moto no manifesto ativo:
    // Aceita o chassi completo de 17 dígitos, ou correspondência exata, ou os últimos 6 a 8 dígitos do chassi
    const targetItem = activeBatch.items.find((item) => {
      const cleanChassis = item.chassis.toUpperCase().replace(/[^A-Z0-9]/g, '');
      const cleanEngine = item.engine_number.toUpperCase().replace(/[^A-Z0-9]/g, '');
      const cleanModel = item.model_code.toUpperCase().replace(/[^A-Z0-9]/g, '');

      return (
        cleanChassis === cleanInput ||
        cleanInput.includes(cleanChassis) ||
        cleanChassis.includes(cleanInput) ||
        cleanEngine === cleanInput ||
        cleanModel === cleanInput
      );
    });

    const now = new Date().toISOString();

    // CASO 1: A moto NÃO pertence a esta loja/manifesto!
    if (!targetItem) {
      playErrorAlarm();

      const newDivergence: InboundDivergenceLog = {
        id: `div_${Date.now()}`,
        timestamp: now,
        scanned_value: cleanInput,
        reason: 'not_in_manifest',
        message: `Chassi ou código ${cleanInput} não consta no manifesto desta loja! NÃO DESCARREGAR DO CAMINHÃO.`,
      };

      setBatches((prev) => {
        const updated = prev.map((b) => {
          if (b.id !== activeBatch.id) return b;
          return {
            ...b,
            status: 'divergente' as const,
            divergent_items: b.divergent_items + 1,
            updated_at: now,
            divergence_logs: [newDivergence, ...b.divergence_logs],
          };
        });
        saveStoredBatches(updated);
        return updated;
      });

      return {
        type: 'not_found',
        scannedCode: cleanInput,
        message: `ATENÇÃO! O código ${cleanInput} NÃO PERTENCE A ESTA LOJA! Não desça a caixa do caminhão.`,
      };
    }

    // CASO 2: A moto já foi bipada anteriormente!
    if (targetItem.scanned) {
      playWarningTone();
      return {
        type: 'already_scanned',
        item: targetItem,
        message: `Atenção: A moto ${targetItem.model_name || targetItem.model_code} (Chassi ${targetItem.chassis}) já foi bipada anteriormente.`,
      };
    }

    // CASO 3: Bipagem de Sucesso (Moto confirmada da loja!)
    playSuccessBeep();

    setBatches((prev) => {
      const updated = prev.map((b) => {
        if (b.id !== activeBatch.id) return b;
        const newItems = b.items.map((it) => {
          if (it.id === targetItem.id) {
            return {
              ...it,
              scanned: true,
              scanned_at: now,
              scanned_by: scannedBy,
            };
          }
          return it;
        });

        const scannedCount = newItems.filter((i) => i.scanned).length;
        const isComplete = scannedCount === newItems.length;

        return {
          ...b,
          status: isComplete ? ('concluido' as const) : ('em_conferencia' as const),
          scanned_items: scannedCount,
          updated_at: now,
          items: newItems,
        };
      });
      saveStoredBatches(updated);
      return updated;
    });

    return {
      type: 'success',
      item: { ...targetItem, scanned: true, scanned_at: now, scanned_by: scannedBy },
      message: `CONFIRMADO! ${targetItem.model_name || targetItem.model_code} (${targetItem.primary_color}${targetItem.secondary_color !== '-' ? ' / ' + targetItem.secondary_color : ''}) - Pode descarregar a caixa!`,
    };
  }, [activeBatch]);

  /**
   * Efetiva a entrada de todas as motos conferidas diretamente no estoque oficial da loja
   */
  const commitToStock = useCallback(async (batchId: string, storeId: string, storeName?: string) => {
    const batch = batches.find((b) => b.id === batchId);
    if (!batch) throw new Error('Lote não encontrado.');

    const scannedItems = batch.items.filter((i) => i.scanned && !i.stock_vehicle_id);
    if (scannedItems.length === 0) {
      throw new Error('Nenhuma moto conferida pendente de entrada no estoque.');
    }

    let successCount = 0;
    const now = new Date().toISOString();

    for (const item of scannedItems) {
      try {
        const pattern = await recognizeFromChassis(item.chassis);
        const modelName = pattern?.model_name || item.model_name || 'MOTO';
        const brand = pattern?.brand || item.brand || 'SHINERAY';
        const purchasePrice = pattern?.default_purchase_price || 0;
        const salePrice = pattern?.default_sale_price || 0;

        const vehiclePayload = {
          store_id: storeId,
          vehicle_type: 'moto',
          brand: brand,
          model: modelName,
          year: item.model_year || 2027,
          manufacture_year: item.manufacture_year || 2026,
          color: item.primary_color + (item.secondary_color && item.secondary_color !== '-' ? ` / ${item.secondary_color}` : ''),
          chassis: item.chassis,
          plate: '',
          renavam: item.engine_number || '', // Armazena o motor no renavam/registro
          mileage: 0,
          engine_cc: Number(item.group_cc) || pattern?.engine_cc || 125,
          fuel_type: 'gasolina',
          transmission: pattern?.transmission || 'manual',
          purchase_price: purchasePrice,
          sale_price: salePrice,
          status: 'disponivel',
          notes: `Entrada via Romaneio/Caminhão Lote ${item.code_id_1} (Transporte: ${item.transport_code}, Código Modelo: ${item.model_code}, Motor: ${item.engine_number}). Bipado em ${item.scanned_at ? new Date(item.scanned_at).toLocaleString('pt-BR') : 'descarga'}.`,
        };

        const { data, error } = await supabase
          .from('vehicles')
          .insert(vehiclePayload)
          .select('id')
          .single();

        if (!error && data?.id) {
          item.stock_vehicle_id = data.id;
          successCount++;
        }
      } catch (err) {
        console.error('Erro ao inserir veículo no estoque:', item.chassis, err);
      }
    }

    // Atualiza o lote
    setBatches((prev) => {
      const updated = prev.map((b) => {
        if (b.id !== batchId) return b;
        return {
          ...b,
          updated_at: now,
          items: [...b.items],
        };
      });
      saveStoredBatches(updated);
      return updated;
    });

    queryClient.invalidateQueries({ queryKey: ['vehicles'] });
    queryClient.invalidateQueries({ queryKey: ['vehicle-stats'] });

    toast({
      title: 'Entrada no estoque realizada!',
      description: `${successCount} motos conferidas foram cadastradas no estoque da loja ${storeName || 'selecionada'}.`,
    });

    return successCount;
  }, [batches, queryClient, toast]);

  // Carrega lote demonstrativo sob demanda (somente se o usuário clicar explicitamente)
  const loadSampleData = useCallback(() => {
    const sample = createSampleBatch();
    createBatch(sample);
    toast({
      title: 'Romaneio de Demonstração carregado',
      description: 'Carga de teste com 31 motos carregada para teste de bipagem.',
    });
  }, [createBatch, toast]);

  return {
    batches,
    activeBatch,
    activeBatchId,
    setActiveBatchId,
    createBatch,
    deleteBatch,
    resetBatchScans,
    scanBox,
    commitToStock,
    loadSampleData,
  };
}
