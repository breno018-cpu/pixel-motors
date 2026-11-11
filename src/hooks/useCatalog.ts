import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  fetchCatalog,
  fetchCatalogEvents,
  syncCatalog,
  subscribeCatalogStream,
  sendCatalogChatMessage,
  getCatalogApiSettings,
} from "@/lib/catalogApi";
import {
  CatalogData,
  CatalogSyncAction,
  CatalogProduct,
  CatalogPromo,
  CatalogCampaign,
  CatalogConfig,
  CatalogEvent,
  CatalogChatMessage,
} from "@/types/catalog";

export function useCatalog() {
  const queryClient = useQueryClient();
  const [streamStatus, setStreamStatus] = useState<"connected" | "connecting" | "error">("connecting");
  const [liveEvents, setLiveEvents] = useState<CatalogEvent[]>([]);

  // Consulta Catálogo Geral
  const catalogQuery = useQuery<CatalogData>({
    queryKey: ["catalog-data"],
    queryFn: fetchCatalog,
    staleTime: 1000 * 30, // 30s
    retry: 1,
  });

  // Consulta Histórico de Auditoria (Últimos 60 eventos)
  const eventsQuery = useQuery<CatalogEvent[]>({
    queryKey: ["catalog-events"],
    queryFn: fetchCatalogEvents,
    staleTime: 1000 * 15,
    retry: 1,
  });

  // Conexão SSE em tempo real (<50ms de latência)
  useEffect(() => {
    setStreamStatus("connecting");
    const unsubscribe = subscribeCatalogStream(
      (data) => {
        setStreamStatus("connected");
        if (data.events && data.events.length > 0) {
          setLiveEvents((prev) => [...data.events, ...prev].slice(0, 60));
        }
        // Invalida as queries para atualizar instantaneamente na tela
        queryClient.invalidateQueries({ queryKey: ["catalog-data"] });
        queryClient.invalidateQueries({ queryKey: ["catalog-events"] });
      },
      () => {
        setStreamStatus("error");
      }
    );

    return () => {
      unsubscribe();
    };
  }, [queryClient]);

  // Mutação genérica de sincronização
  const syncMutation = useMutation({
    mutationFn: (actions: CatalogSyncAction | CatalogSyncAction[]) => syncCatalog(actions),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["catalog-data"] });
      queryClient.invalidateQueries({ queryKey: ["catalog-events"] });
      if (data.errors && data.errors.length > 0) {
        toast.warning(`Sincronizado com ${data.errors.length} avisos`);
      } else {
        toast.success("Catálogo L1MA atualizado com sucesso!");
      }
    },
    onError: (err: any) => {
      toast.error(`Falha ao sincronizar: ${err?.message || "Erro desconhecido"}`);
    },
  });

  // 1. Visibilidade pública (Liga/Desliga instantâneo)
  const toggleActive = (id: string, currentActive: boolean) => {
    return syncMutation.mutateAsync({
      action: "active",
      id,
      value: !currentActive,
    });
  };

  // 2. Controle de Estoque (0 = ESGOTADO, 1-2 = últimas unidades, >2 = normal, null = pronta entrega)
  const updateStock = (id: string, value: number | null) => {
    return syncMutation.mutateAsync({
      action: "stock",
      id,
      value,
    });
  };

  // 3. Alteração de Preços à vista e "De / Por"
  const updatePrice = (id: string, value: number | null, keepOld = true) => {
    return syncMutation.mutateAsync({
      action: "price",
      id,
      value,
      keepOld,
    });
  };

  // 4. Promoções em Destaque (Selo, Desconto R$, Data Limite)
  const updatePromo = (id: string, promo: CatalogPromo | null) => {
    return syncMutation.mutateAsync({
      action: "promo",
      id,
      promo,
    });
  };

  // 5. Carrossel Hero do Topo (Destaques)
  const toggleFeaturedHero = (id: string, featuredHero: boolean, heroOrder = 1) => {
    return syncMutation.mutateAsync({
      action: "featuredHero",
      id,
      value: featuredHero,
      heroOrder,
    });
  };

  const setHeroList = (items: Array<{ id: string; heroOrder: number }>) => {
    return syncMutation.mutateAsync({
      action: "hero_list",
      items,
    });
  };

  // 6. Campanha com Contagem Regressiva
  const updateCampaign = (campaign: CatalogCampaign | null) => {
    return syncMutation.mutateAsync({
      action: "campaign",
      campaign,
    });
  };

  // 7. Parâmetros da Loja (WhatsApp, Nome, Parcelas, etc.)
  const updateConfig = (config: CatalogConfig) => {
    return syncMutation.mutateAsync({
      action: "config",
      config,
    });
  };

  // 8. Taxas da Maquininha e Simulador de 1x a 21x
  const updateRates = (debitRate: number, installmentRates: number[], installmentNote?: string) => {
    return syncMutation.mutateAsync({
      action: "rates",
      debitRate,
      installmentRates,
      installmentNote,
    });
  };

  // 9. Cadastro/Edição Completa de Modelo
  const upsertProduct = (product: CatalogProduct) => {
    return syncMutation.mutateAsync({
      action: "upsert",
      product,
    });
  };

  // 10. Exclusão permanente do catálogo
  const removeProduct = (id: string) => {
    return syncMutation.mutateAsync({
      action: "remove",
      id,
    });
  };

  // 11. Sincronização em Lote (Batch)
  const batchSync = (actions: CatalogSyncAction[]) => {
    return syncMutation.mutateAsync(actions);
  };

  // 12. Assistente Virtual IA (Chatbot)
  const chatMutation = useMutation({
    mutationFn: (messages: CatalogChatMessage[]) => sendCatalogChatMessage(messages),
  });

  return {
    ...catalogQuery,
    catalog: catalogQuery.data,
    events: eventsQuery.data || catalogQuery.data?.events || [],
    streamStatus,
    liveEvents,
    syncMutation,
    chatMutation,
    toggleActive,
    updateStock,
    updatePrice,
    updatePromo,
    toggleFeaturedHero,
    setHeroList,
    updateCampaign,
    updateConfig,
    updateRates,
    upsertProduct,
    removeProduct,
    batchSync,
    apiSettings: getCatalogApiSettings(),
  };
}
