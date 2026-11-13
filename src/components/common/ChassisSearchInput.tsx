import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Search,
  Bike,
  Car,
  Check,
  Sparkles,
  Loader2,
  X,
  ScanBarcode,
  Building2,
  FileSpreadsheet,
  ArrowRight,
  ShieldCheck,
  ChevronDown,
  AlertCircle,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useVehicles, isChassisAlreadySold } from '@/hooks/useVehicles';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { recognizeFromChassis, resolveModelYearFromVin } from '@/lib/chassisRecognition';
import { BarcodeScannerDialog } from '@/components/vehicles/BarcodeScannerDialog';
import { SheetRowV9 } from '@/lib/dealershipSheetParser';
import { isMatchingStore } from '@/lib/storeResolution';
import { isElectricVehicle } from '@/lib/vehicleCatalog';
import { cn } from '@/lib/utils';

export function getStoreDisplayName(storeId?: string | null): string {
  if (!storeId) return 'Divinópolis';
  const clean = storeId.toLowerCase().trim();
  if (
    clean === 'store-montesclaros' ||
    clean === 'e8254a81-d669-464b-9806-457ba25ce7f0' ||
    clean.includes('montes') ||
    clean.includes('moc') ||
    clean.includes('polo norte')
  ) {
    return 'Montes Claros';
  }
  return 'Divinópolis';
}

export interface SelectedChassisVehicle {
  id: string;
  brand: string;
  model: string;
  year?: number | null;
  color?: string | null;
  chassis?: string | null;
  sale_price?: number | null;
  plate?: string | null;
  store_id?: string | null;
  vehicle_type?: string | null;
}

interface ChassisSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onSelectVehicle?: (vehicle: SelectedChassisVehicle) => void;
  placeholder?: string;
  className?: string;
  label?: string;
  required?: boolean;
  filterStoreId?: string;
  autoRecognize?: boolean;
}

export function ChassisSearchInput({
  value,
  onChange,
  onSelectVehicle,
  placeholder = 'Digite o chassi ou número da moto...',
  className,
  label = 'Chassi / Número da Moto',
  required = false,
  filterStoreId,
  autoRecognize = true,
}: ChassisSearchInputProps) {
  const { toast } = useToast();
  const { data: vehicles = [], isLoading: isLoadingVehicles } = useVehicles();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [modalSearch, setModalSearch] = useState('');
  const [modalTab, setModalTab] = useState<'all' | 'stock' | 'sheet' | 'patterns'>('all');
  const [isDecoding, setIsDecoding] = useState(false);
  const [decodedInfo, setDecodedInfo] = useState<{
    brand?: string;
    model?: string;
    year?: number | null;
    salePrice?: number | null;
    vehicleType?: string | null;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const lastDecodedRef = useRef<string>('');

  const soldCheck = useMemo(() => {
    return isChassisAlreadySold(value, vehicles);
  }, [value, vehicles]);

  // Busca chassi gravados na planilha mensal local (para cobrir vendas e pré-vendas)
  const sheetRows: SheetRowV9[] = useMemo(() => {
    try {
      const stored = localStorage.getItem('dealflow_cloud_monthly_sheet_v9');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  }, [dropdownOpen, modalOpen]);

  // Padrões cadastrados no catálogo mestre
  const { data: chassisPatterns = [] } = useQuery({
    queryKey: ['chassis-patterns-search'],
    queryFn: async () => {
      const { data, error } = await supabase.from('chassis_patterns').select('*');
      if (error) return [];
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const cleanVin = (vin: string) =>
    (vin || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reconhecimento do Chassi (apenas informativo, não sobrescreve os campos silenciosamente)
  useEffect(() => {
    if (!autoRecognize) return;
    const vin = cleanVin(value);

    if (vin.length < 5 || vin === 'DISPENSADO') {
      setDecodedInfo(null);
      return;
    }
    if (lastDecodedRef.current === vin) return;

    let isMounted = true;
    const timer = setTimeout(async () => {
      setIsDecoding(true);
      try {
        const [pattern, yearRes] = await Promise.all([
          recognizeFromChassis(vin),
          resolveModelYearFromVin(vin),
        ]);

        if (!isMounted) return;
        lastDecodedRef.current = vin;

        if (pattern || yearRes?.year) {
          setDecodedInfo({
            brand: pattern?.brand || 'SHINERAY',
            model: pattern?.model || undefined,
            year: yearRes?.year || undefined,
            salePrice: pattern?.default_sale_price || undefined,
            vehicleType: pattern?.vehicle_type || 'moto',
          });
        } else {
          setDecodedInfo(null);
        }
      } catch {
        if (isMounted) setDecodedInfo(null);
      } finally {
        if (isMounted) setIsDecoding(false);
      }
    }, 350);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [value, autoRecognize]);

  // Lista unificada de sugestões rápidas
  const searchResults = useMemo(() => {
    const rawQ = (value || '').trim().toUpperCase();
    const q = cleanVin(value);
    if (!q && !rawQ) return [];

    const isMatch = (itemChassis?: string | null, itemPlate?: string | null, itemModel?: string | null, itemBrand?: string | null) => {
      const ch = cleanVin(itemChassis || '');
      const pl = cleanVin(itemPlate || '');
      const fullMd = `${itemBrand || ''} ${itemModel || ''}`.toUpperCase().trim();
      const cleanMd = cleanVin(fullMd);

      return (
        (q && ch.includes(q)) ||
        (q && pl.includes(q)) ||
        (q && cleanMd.includes(q)) ||
        (rawQ && fullMd.includes(rawQ))
      );
    };

    // 1. Veículos no Estoque (Pátio)
    const matchedVehicles = vehicles
      .filter((v) => isMatch(v.chassis, v.plate, v.model, v.brand))
      .sort((a, b) => {
        // Prioriza veículos da loja ativa
        const aStore = isMatchingStore(a.store_id, filterStoreId || 'all') ? 1 : 0;
        const bStore = isMatchingStore(b.store_id, filterStoreId || 'all') ? 1 : 0;
        if (aStore !== bStore) return bStore - aStore;

        // Se o chassi terminar exatamente com o termo digitado (ex: últimos 6 dígitos)
        const aCh = cleanVin(a.chassis || '');
        const bCh = cleanVin(b.chassis || '');
        const aEnds = q && aCh.endsWith(q) ? 1 : 0;
        const bEnds = q && bCh.endsWith(q) ? 1 : 0;
        if (aEnds !== bEnds) return bEnds - aEnds;

        // Veículos disponíveis antes de vendidos
        const aDisp = a.status === 'disponivel' ? 1 : 0;
        const bDisp = b.status === 'disponivel' ? 1 : 0;
        if (aDisp !== bDisp) return bDisp - aDisp;

        return 0;
      })
      .slice(0, 10)
      .map((v) => ({
        type: 'stock' as const,
        id: v.id,
        chassis: v.chassis || '',
        brand: v.brand,
        model: v.model,
        year: v.year,
        color: v.color,
        sale_price: v.sale_price,
        plate: v.plate,
        store_id: v.store_id,
        vehicle_type: v.vehicle_type,
        status: v.status,
      }));

    // 2. Chassi de vendas recentes na Planilha
    const seenChassis = new Set(matchedVehicles.map((m) => cleanVin(m.chassis)));
    const matchedSheet = sheetRows
      .filter((r) => {
        const ch = cleanVin(r.chassi || '');
        const fullMd = (r.modelo || '').toUpperCase().trim();
        const cleanMd = cleanVin(fullMd);
        const matches = (q && ch.includes(q)) || (q && cleanMd.includes(q)) || (rawQ && fullMd.includes(rawQ));
        return ch && !seenChassis.has(ch) && matches;
      })
      .slice(0, 3)
      .map((r) => ({
        type: 'sheet' as const,
        id: r.id,
        chassis: r.chassi,
        brand: 'SHINERAY',
        model: r.modelo,
        year: 2026,
        color: undefined,
        sale_price: r.valor,
        plate: undefined,
        store_id: (r as any).store_id,
        vehicle_type: 'moto',
        status: r.is_permitted ? 'faturada' : 'pre_venda',
      }));

    // 3. Padrões do Catálogo Mestre
    const matchedPatterns = chassisPatterns
      .filter((p) => {
        const wmi = cleanVin(p.wmi_code || '');
        const pat = cleanVin(p.model_pattern || '');
        const name = `${p.brand} ${p.model_name || ''}`.toUpperCase();
        return (
          (q && (q.startsWith(wmi) || q.includes(pat) || wmi.includes(q) || cleanVin(name).includes(q))) ||
          (rawQ && name.includes(rawQ))
        );
      })
      .slice(0, 3)
      .map((p) => ({
        type: 'pattern' as const,
        id: p.id,
        chassis: p.wmi_code,
        patternCode: p.model_pattern,
        brand: p.brand,
        model: p.model_name || 'Modelo Shineray',
        year: 2026,
        color: undefined,
        sale_price: p.default_sale_price,
        plate: undefined,
        store_id: undefined,
        vehicle_type: p.vehicle_type,
        status: 'catalogo',
      }));

    return [...matchedVehicles, ...matchedSheet, ...matchedPatterns];
  }, [value, vehicles, sheetRows, chassisPatterns, filterStoreId]);

  // Lista completa de busca dentro do Modal Avançado
  const modalResults = useMemo(() => {
    const rawSearch = (modalSearch || '').trim().toUpperCase();
    const cleanSearch = cleanVin(modalSearch);

    const isMatch = (itemChassis?: string | null, itemPlate?: string | null, itemModel?: string | null, itemBrand?: string | null, itemExtra?: string | null) => {
      if (!rawSearch && !cleanSearch) return true;
      const ch = cleanVin(itemChassis || '');
      const pl = cleanVin(itemPlate || '');
      const fullMd = `${itemBrand || ''} ${itemModel || ''} ${itemExtra || ''}`.toUpperCase().trim();
      const cleanMd = cleanVin(fullMd);

      return (
        (cleanSearch && ch.includes(cleanSearch)) ||
        (cleanSearch && pl.includes(cleanSearch)) ||
        (cleanSearch && cleanMd.includes(cleanSearch)) ||
        (rawSearch && fullMd.includes(rawSearch))
      );
    };

    const stockList = vehicles
      .filter((v) => isMatch(v.chassis, v.plate, v.model, v.brand, v.color))
      .sort((a, b) => {
        const aStore = isMatchingStore(a.store_id, filterStoreId || 'all') ? 1 : 0;
        const bStore = isMatchingStore(b.store_id, filterStoreId || 'all') ? 1 : 0;
        if (aStore !== bStore) return bStore - aStore;

        const aCh = cleanVin(a.chassis || '');
        const bCh = cleanVin(b.chassis || '');
        const aEnds = cleanSearch && aCh.endsWith(cleanSearch) ? 1 : 0;
        const bEnds = cleanSearch && bCh.endsWith(cleanSearch) ? 1 : 0;
        if (aEnds !== bEnds) return bEnds - aEnds;

        return 0;
      });

    const sheetList = sheetRows.filter((r) => isMatch(r.chassi, null, r.modelo, 'SHINERAY', r.cliente));

    const patternList = chassisPatterns.filter((p) => {
      if (!rawSearch && !cleanSearch) return true;
      const wmi = cleanVin(p.wmi_code || '');
      const pat = cleanVin(p.model_pattern || '');
      const md = `${p.brand} ${p.model_name || ''}`.toUpperCase();
      return (
        (cleanSearch && (wmi.includes(cleanSearch) || pat.includes(cleanSearch) || cleanSearch.startsWith(wmi))) ||
        (rawSearch && md.includes(rawSearch))
      );
    });

    return { stockList, sheetList, patternList };
  }, [modalSearch, vehicles, sheetRows, chassisPatterns, filterStoreId]);

  const handleSelectVehicle = (item: any) => {
    if (item.status === 'vendido') {
      toast({
        title: 'Chassi Já Vendido',
        description: `O veículo com chassi ${item.chassis || ''} já foi faturado anteriormente e não está mais disponível para venda.`,
        variant: 'destructive',
      });
      return;
    }

    const chassisToSet = item.type === 'pattern' ? value : (item.chassis || '');
    onChange(chassisToSet);
    setDropdownOpen(false);
    setModalOpen(false);

    if (onSelectVehicle) {
      onSelectVehicle({
        id: item.type === 'stock' ? item.id : '',
        brand: item.brand || 'SHINERAY',
        model: item.model || '',
        year: item.year || 2026,
        color: item.color || null,
        chassis: item.chassis || '',
        sale_price: item.sale_price || null,
        plate: item.plate || null,
        store_id: item.store_id || null,
        vehicle_type: item.vehicle_type || 'moto',
      });
    }
  };

  const handleApplyDecoded = () => {
    if (!decodedInfo || !onSelectVehicle) return;
    onSelectVehicle({
      id: '',
      brand: decodedInfo.brand || 'SHINERAY',
      model: decodedInfo.model || '',
      year: decodedInfo.year || 2026,
      chassis: cleanVin(value),
      sale_price: decodedInfo.salePrice || null,
      vehicle_type: decodedInfo.vehicleType || 'moto',
    });
  };

  const handleDispenseChassis = () => {
    onChange('DISPENSADO');
    setDecodedInfo(null);
    setDropdownOpen(false);
  };

  return (
    <div ref={containerRef} className={cn('relative space-y-1.5 w-full', className)}>
      {/* Label e Ações de Topo */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          {label || 'Chassi do Veículo'}
          {required && <span className="text-destructive">*</span>}
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDispenseChassis}
            className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
            title="Para bicicletas elétricas e ciclomotores dispensados de emplacamento e VIN (Res. 996/23)"
          >
            Dispensar VIN
          </button>
          <span className="text-muted-foreground/40">•</span>
          <button
            type="button"
            onClick={() => {
              setModalSearch(value);
              setModalOpen(true);
            }}
            className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
          >
            <Search className="w-3 h-3" />
            Localizador
          </button>
        </div>
      </div>

      {/* Input com Ações Integradas */}
      <div className="relative flex items-center">
        <Input
          value={value}
          onChange={(e) => {
            const clean = cleanVin(e.target.value);
            onChange(clean);
            setDropdownOpen(clean.length >= 2);
          }}
          onFocus={() => {
            if (cleanVin(value).length >= 2) setDropdownOpen(true);
          }}
          placeholder={placeholder}
          className="h-10 text-xs font-mono uppercase tracking-wider pr-24 bg-background rounded-xl border focus-visible:ring-1"
          maxLength={24}
          required={required}
        />

        {/* Botões rápidos na borda direita do input */}
        <div className="absolute right-1 flex items-center gap-0.5">
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground rounded-lg"
              onClick={() => {
                onChange('');
                setDecodedInfo(null);
                setDropdownOpen(false);
              }}
              title="Limpar chassi"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          )}

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-primary hover:bg-primary/10 rounded-lg"
            onClick={() => setScannerOpen(true)}
            title="Bipar / Escanear Chassi com a Câmera ou Leitor"
          >
            <ScanBarcode className="w-3.5 h-3.5" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg"
            onClick={() => {
              setModalSearch(value);
              setModalOpen(true);
            }}
            title="Abrir Localizador Avançado de Chassi"
          >
            <Search className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Dropdown de Sugestões Inteligentes */}
      {dropdownOpen && searchResults.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-card border rounded-2xl shadow-xl z-50 overflow-hidden divide-y divide-border/60 max-h-72 overflow-y-auto animate-in fade-in-50 zoom-in-95">
          <div className="p-2 bg-muted/40 text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
            <span>Resultados para "{value}"</span>
            <span className="text-[9px] lowercase font-normal">clique para preencher</span>
          </div>

          {searchResults.map((item, idx) => (
            <div
              key={`${item.type}-${item.id || idx}`}
              onClick={() => handleSelectVehicle(item)}
              className="p-2.5 hover:bg-primary/5 cursor-pointer transition-colors flex items-center justify-between gap-3 group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={cn(
                    'w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold',
                    item.type === 'stock'
                      ? 'bg-emerald-500/10 text-emerald-600'
                      : item.type === 'sheet'
                      ? 'bg-blue-500/10 text-blue-600'
                      : 'bg-amber-500/10 text-amber-600'
                  )}
                >
                  {item.vehicle_type === 'carro' ? <Car className="w-3.5 h-3.5" /> : <Bike className="w-3.5 h-3.5" />}
                </div>

                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs text-foreground group-hover:text-primary transition-colors truncate">
                      {!item.chassis || item.chassis.toUpperCase().includes('DEFINIR') || item.chassis.toUpperCase() === 'DISPENSADO'
                        ? '⚡ Sem Chassi (Inserir na venda)'
                        : item.chassis}
                    </span>
                    {item.type === 'stock' && (
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[9px] px-1 py-0 font-bold',
                          item.status === 'disponivel'
                            ? 'border-emerald-500/30 text-emerald-600 bg-emerald-500/5'
                            : item.status === 'reservado'
                            ? 'border-amber-500/30 text-amber-600 bg-amber-500/5'
                            : 'border-blue-500/30 text-blue-600 bg-blue-500/5'
                        )}
                      >
                        {item.status === 'disponivel' ? 'Disponível' : item.status === 'reservado' ? 'Reservado' : 'Estoque'}
                      </Badge>
                    )}
                    {item.type === 'stock' && item.store_id && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 border-primary/20 text-foreground bg-muted/40 font-medium">
                        {getStoreDisplayName(item.store_id)}
                      </Badge>
                    )}
                    {item.type === 'sheet' && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 border-blue-500/30 text-blue-600 bg-blue-500/5">
                        Na Planilha
                      </Badge>
                    )}
                    {item.type === 'pattern' && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 border-amber-500/30 text-amber-600 bg-amber-500/5">
                        Catálogo
                      </Badge>
                    )}
                  </div>

                  <p className="text-[11px] text-muted-foreground truncate">
                    <strong className="text-foreground">{item.brand} {item.model}</strong>
                    {item.color && <span> • {item.color}</span>}
                    {item.year && <span> • {item.year}</span>}
                    {item.type === 'stock' && <span> • Loja: {getStoreDisplayName(item.store_id)}</span>}
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0">
                {item.sale_price ? (
                  <span className="text-xs font-bold text-foreground block">
                    R$ {Number(item.sale_price).toLocaleString('pt-BR')}
                  </span>
                ) : null}
                <span className="text-[10px] text-primary opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                  Selecionar →
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Cartão de Reconhecimento Inteligente / Sugestão Não-Intrusiva */}
      {isDecoding ? (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-0.5">
          <Loader2 className="w-3 h-3 animate-spin text-primary" />
          <span>Decodificando padrão do chassi VIN...</span>
        </div>
      ) : decodedInfo && (decodedInfo.model || decodedInfo.year) ? (
        <div className="flex items-center justify-between gap-2 p-2 bg-primary/5 border border-primary/20 rounded-xl text-xs mt-1">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
            <div className="text-[11px] truncate">
              <span className="font-semibold text-foreground">
                {[decodedInfo.brand, decodedInfo.model].filter(Boolean).join(' ')}
              </span>
              {decodedInfo.year && <span className="text-muted-foreground"> • Ano {decodedInfo.year}</span>}
              {decodedInfo.salePrice && (
                <span className="text-emerald-600 font-bold ml-1">
                  • Sugerido R$ {decodedInfo.salePrice.toLocaleString('pt-BR')}
                </span>
              )}
            </div>
          </div>

          {onSelectVehicle && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleApplyDecoded}
              className="h-6 px-2 text-[10px] font-bold border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground shrink-0 rounded-lg"
            >
              Aplicar ao Formulário
            </Button>
          )}
        </div>
      ) : null}

      {/* Alerta de Chassi Já Vendido */}
      {soldCheck.isSold && (
        <div className="flex items-center gap-2 p-2.5 bg-destructive/10 border border-destructive/30 rounded-xl text-xs text-destructive mt-1 animate-in fade-in-50">
          <AlertCircle className="w-4 h-4 shrink-0 text-destructive" />
          <div className="space-y-0.5">
            <span className="font-bold block text-[11px]">Chassi Indisponível para Nova Venda</span>
            <span className="text-[11px] leading-tight block text-destructive/90">
              {soldCheck.reason}
            </span>
          </div>
        </div>
      )}

      {/* MODAL LOCALIZADOR AVANÇADO DE CHASSI */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-5 rounded-3xl">
          <DialogHeader className="pb-3 border-b">
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Search className="w-4 h-4 text-primary" />
              Localizador Completo de Chassi & Estoque
            </DialogTitle>
            <DialogDescription className="text-xs">
              Consulte motos e ciclomotores pelo final do chassi (ex: 1704), chassi completo, modelo ou placa.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Digite o final do chassi, modelo ou placa..."
                value={modalSearch}
                onChange={(e) => setModalSearch(e.target.value)}
                className="pl-9 pr-8 h-10 text-xs font-mono uppercase rounded-xl"
                autoFocus
              />
              {modalSearch && (
                <button
                  type="button"
                  onClick={() => setModalSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Abas Rápidas */}
            <div className="flex items-center gap-2 text-xs">
              <Button
                size="sm"
                variant={modalTab === 'all' ? 'default' : 'outline'}
                onClick={() => setModalTab('all')}
                className="h-7 text-[11px] rounded-lg"
              >
                Todos ({modalResults.stockList.length + modalResults.sheetList.length + modalResults.patternList.length})
              </Button>
              <Button
                size="sm"
                variant={modalTab === 'stock' ? 'default' : 'outline'}
                onClick={() => setModalTab('stock')}
                className="h-7 text-[11px] rounded-lg"
              >
                Pátio / Estoque ({modalResults.stockList.length})
              </Button>
              <Button
                size="sm"
                variant={modalTab === 'sheet' ? 'default' : 'outline'}
                onClick={() => setModalTab('sheet')}
                className="h-7 text-[11px] rounded-lg"
              >
                Planilha Mensal ({modalResults.sheetList.length})
              </Button>
              <Button
                size="sm"
                variant={modalTab === 'patterns' ? 'default' : 'outline'}
                onClick={() => setModalTab('patterns')}
                className="h-7 text-[11px] rounded-lg"
              >
                Catálogo ({modalResults.patternList.length})
              </Button>
            </div>
          </div>

          {/* Lista de Resultados no Modal */}
          <div className="flex-1 overflow-y-auto space-y-2 mt-2 max-h-[380px] pr-1">
            {isLoadingVehicles ? (
              <div className="text-center py-10 text-xs text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                Carregando inventário...
              </div>
            ) : (
              <>
                {/* 1. Estoque */}
                {(modalTab === 'all' || modalTab === 'stock') &&
                  modalResults.stockList.map((v) => (
                    <div
                      key={`modal-stock-${v.id}`}
                      onClick={() => handleSelectVehicle({ ...v, type: 'stock' })}
                      className="p-3 rounded-2xl border border-border/70 hover:border-emerald-500/50 bg-card hover:bg-emerald-500/5 cursor-pointer transition-all flex items-center justify-between group"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[9px] px-1.5 py-0 font-bold',
                              v.status === 'disponivel'
                                ? 'border-emerald-500/40 text-emerald-600 bg-emerald-500/5'
                                : v.status === 'reservado'
                                ? 'border-amber-500/40 text-amber-600 bg-amber-500/5'
                                : 'border-blue-500/40 text-blue-600 bg-blue-500/5'
                            )}
                          >
                            {v.status === 'disponivel' ? 'DISPONÍVEL' : v.status === 'reservado' ? 'RESERVADO' : 'ESTOQUE'}
                          </Badge>
                          <span className="font-mono font-bold text-xs text-foreground group-hover:text-primary">
                            {!v.chassis || v.chassis.toUpperCase().includes('DEFINIR') || v.chassis.toUpperCase() === 'DISPENSADO'
                              ? '⚡ Sem Chassi (Inserir na venda)'
                              : v.chassis}
                          </span>
                          {v.plate && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 font-mono">
                              {v.plate}
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          <strong className="text-foreground">{v.brand} {v.model}</strong>
                          {v.color && <span>• {v.color}</span>}
                          {v.year && <span>• {v.year}</span>}
                          <span className="text-[10px]">• Loja: {getStoreDisplayName(v.store_id)}</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-xs font-bold text-emerald-600 block">
                          R$ {(v.sale_price || 0).toLocaleString('pt-BR')}
                        </span>
                        <Button size="sm" variant="outline" className="h-6 text-[10px] font-bold rounded-md mt-1">
                          Selecionar
                        </Button>
                      </div>
                    </div>
                  ))}

                {/* 2. Planilha */}
                {(modalTab === 'all' || modalTab === 'sheet') &&
                  modalResults.sheetList.map((r) => (
                    <div
                      key={`modal-sheet-${r.id}`}
                      onClick={() =>
                        handleSelectVehicle({
                          type: 'sheet',
                          id: r.id,
                          chassis: r.chassi,
                          brand: 'SHINERAY',
                          model: r.modelo,
                          sale_price: r.valor,
                          year: 2026,
                        })
                      }
                      className="p-3 rounded-2xl border border-border/70 hover:border-blue-500/50 bg-card hover:bg-blue-500/5 cursor-pointer transition-all flex items-center justify-between group"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="border-blue-500/40 text-blue-600 text-[9px] px-1.5 py-0 font-bold">
                            PLANILHA
                          </Badge>
                          <span className="font-mono font-bold text-xs text-foreground group-hover:text-primary">
                            {r.chassi || 'SEM CHASSI'}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          <strong className="text-foreground">{r.modelo}</strong>
                          <span>• Cliente: {r.cliente}</span>
                          <span>• {r.is_permitted ? 'Faturada' : 'Pré-Venda'}</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-xs font-bold text-foreground block">
                          R$ {(r.valor || 0).toLocaleString('pt-BR')}
                        </span>
                        <Button size="sm" variant="outline" className="h-6 text-[10px] font-bold rounded-md mt-1">
                          Usar Chassi
                        </Button>
                      </div>
                    </div>
                  ))}

                {/* 3. Catálogo */}
                {(modalTab === 'all' || modalTab === 'patterns') &&
                  modalResults.patternList.map((p) => (
                    <div
                      key={`modal-pat-${p.id}`}
                      onClick={() =>
                        handleSelectVehicle({
                          type: 'pattern',
                          id: '',
                          chassis: p.wmi_code,
                          brand: p.brand,
                          model: p.model_name,
                          sale_price: p.default_sale_price,
                          year: 2026,
                          vehicle_type: p.vehicle_type,
                        })
                      }
                      className="p-3 rounded-2xl border border-border/70 hover:border-amber-500/50 bg-card hover:bg-amber-500/5 cursor-pointer transition-all flex items-center justify-between group"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="border-amber-500/40 text-amber-600 text-[9px] px-1.5 py-0 font-bold">
                            CATÁLOGO
                          </Badge>
                          <span className="font-mono font-bold text-xs text-amber-700 dark:text-amber-400">
                            WMI: {p.wmi_code} {p.model_pattern ? `• ${p.model_pattern}` : ''}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          <strong className="text-foreground">{p.brand} {p.model_name}</strong>
                          <span> • Padrão Homologado</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        {p.default_sale_price && (
                          <span className="text-xs font-bold text-foreground block">
                            Tabela: R$ {p.default_sale_price.toLocaleString('pt-BR')}
                          </span>
                        )}
                        <Button size="sm" variant="outline" className="h-6 text-[10px] font-bold rounded-md mt-1">
                          Selecionar Modelo
                        </Button>
                      </div>
                    </div>
                  ))}

                {modalResults.stockList.length === 0 &&
                  modalResults.sheetList.length === 0 &&
                  modalResults.patternList.length === 0 && (
                    <div className="text-center py-12 text-xs text-muted-foreground bg-muted/20 rounded-2xl border border-dashed p-6">
                      <p className="font-semibold text-foreground">Nenhum resultado com "{modalSearch}"</p>
                      <p className="mt-1">Dica: Tente pesquisar apenas os 4 ou 6 últimos dígitos do chassi gravado na moto.</p>
                    </div>
                  )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO INTEGRADO DE BIPAGEM / CÂMERA */}
      <BarcodeScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onChassisScanned={(scanned) => {
          const clean = cleanVin(scanned);
          onChange(clean);
          setDropdownOpen(false);
        }}
      />
    </div>
  );
}
