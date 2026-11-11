import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  fetchCatalog,
  syncCatalog,
  subscribeCatalogStream,
  getCatalogApiSettings,
} from "@/lib/catalogApi";
import {
  CatalogData,
  CatalogSyncAction,
  CatalogProduct,
  CatalogCampaign,
  CatalogConfig,
  CatalogEvent,
} from "@/types/catalog";

export function useCatalog() {
  const queryClient = useQueryClient();
  const [streamStatus, setStreamStatus] = useState<"connected" | "connecting" | "error">("connecting");
  const [liveEvents, setLiveEvents] = useState<CatalogEvent[]>([]);

  const catalogQuery = useQuery<CatalogData>({
    queryKey: ["catalog-data"],
    queryFn: fetchCatalog,
    staleTime: 1000 * 30, // 30s
    retry: 1,
  });

  // Conexão SSE em tempo real
  useEffect(() => {
    setStreamStatus("connecting");
    const unsubscribe = subscribeCatalogStream(
      (data) => {
        setStreamStatus("connected");
        if (data.events && data.events.length > 0) {
          setLiveEvents((prev) => [...data.events, ...prev].slice(0, 30));
        }
        // Invalida a query para carregar os dados atualizados
        queryClient.invalidateQueries({ queryKey: ["catalog-data"] });
      },
      () => {
        setStreamStatus("error");
      }
    );

    return () => {
      unsubscribe();
    };
  }, [queryClient]);

  // Mutação genérica
  const syncMutation = useMutation({
    mutationFn: (actions: CatalogSyncAction | CatalogSyncAction[]) => syncCatalog(actions),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["catalog-data"] });
      if (data.errors && data.errors.length > 0) {
        toast.warning(`Sincronizado com ${data.errors.length} avisos`);
      } else {
        toast.success("Catálogo atualizado com sucesso!");
      }
    },
    onError: (err: any) => {
      toast.error(`Falha ao sincronizar: ${err?.message || "Erro desconhecido"}`);
    },
  });

  // Ações atalho
  const toggleActive = (id: string, currentActive: boolean) => {
    return syncMutation.mutateAsync({
      action: "active",
      id,
      value: !currentActive,
    });
  };

  const updateStock = (id: string, value: number | null) => {
    return syncMutation.mutateAsync({
      action: "stock",
      id,
      value,
    });
  };

  const updatePrice = (id: string, value: number | null, keepOld = true) => {
    return syncMutation.mutateAsync({
      action: "price",
      id,
      value,
      keepOld,
    });
  };

  const updatePromo = (id: string, promo: { label: string; until?: string } | null) => {
    return syncMutation.mutateAsync({
      action: "promo",
      id,
      promo,
    });
  };

  const updateCampaign = (campaign: CatalogCampaign | null) => {
    return syncMutation.mutateAsync({
      action: "campaign",
      campaign,
    });
  };

  const updateConfig = (config: CatalogConfig) => {
    return syncMutation.mutateAsync({
      action: "config",
      config,
    });
  };

  const upsertProduct = (product: CatalogProduct) => {
    return syncMutation.mutateAsync({
      action: "upsert",
      product,
    });
  };

  const removeProduct = (id: string) => {
    return syncMutation.mutateAsync({
      action: "remove",
      id,
    });
  };

  const batchSync = (actions: CatalogSyncAction[]) => {
    return syncMutation.mutateAsync(actions);
  };

  return {
    ...catalogQuery,
    catalog: catalogQuery.data,
    streamStatus,
    liveEvents,
    syncMutation,
    toggleActive,
    updateStock,
    updatePrice,
    updatePromo,
    updateCampaign,
    updateConfig,
    upsertProduct,
    removeProduct,
    batchSync,
    apiSettings: getCatalogApiSettings(),
  };
}
