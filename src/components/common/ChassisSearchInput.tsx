import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Search,
  Bike,
  Car,
  Check,
  Sparkles,
  Loader2,
  Building2,
  X,
  SlidersHorizontal,
  ExternalLink,
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useVehicles } from '@/hooks/useVehicles';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { recognizeFromChassis, resolveModelYearFromVin } from '@/lib/chassisRecognition';
import { cn } from '@/lib/utils';

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
  placeholder = 'Digite ou pesquise o chassi (ex: 99HSHF...)',
  className,
  label,
  required = false,
  filterStoreId,
  autoRecognize = true,
}: ChassisSearchInputProps) {
  const { data: vehicles = [], isLoading: isLoadingVehicles } = useVehicles();
  const [modalOpen, setModalOpen] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [modalSearch, setModalSearch] = useState('');
  const [isDecoding, setIsDecoding] = useState(false);
  const [recognizedInfo, setRecognizedInfo] = useState<{
    brand?: string;
    model?: string;
    year?: number | null;
  } | null>(null);

  const lastDecodedRef = useRef<string>('');

  // Padrões cadastrados no catálogo mestre da Ala Master
  const { data: chassisPatterns = [] } = useQuery({
    queryKey: ['chassis-patterns-search'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chassis_patterns')
        .select('*');
      if (error) return [];
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Limpa o valor digitado
  const cleanVin = (vin: string) => vin.toUpperCase().replace(/[^A-Z0-9]/g, '');

  const handleInputChange = (raw: string) => {
    const cleaned = cleanVin(raw);
    onChange(cleaned);
    if (cleaned.length >= 2) {
      setPopoverOpen(true);
    } else {
      setPopoverOpen(false);
    }
  };

  // Reconhecimento autônomo ao digitar ou colar
  useEffect(() => {
    if (!autoRecognize) return;
    const vin = cleanVin(value);
    if (vin.length < 4) {
      setRecognizedInfo(null);
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

        if (pattern) {
          setRecognizedInfo({
            brand: pattern.brand,
            model: pattern.model,
            year: yearRes?.year,
          });

          if (onSelectVehicle && !vehicles.some((v) => v.chassis === vin)) {
            onSelectVehicle({
              id: '',
              brand: pattern.brand,
              model: pattern.model || '',
              year: yearRes?.year,
              chassis: vin,
              sale_price: pattern.default_sale_price,
              vehicle_type: pattern.vehicle_type,
            });
          }
        } else if (yearRes?.year) {
          setRecognizedInfo({
            year: yearRes.year,
          });
        } else {
          setRecognizedInfo(null);
        }
      } catch {
        if (isMounted) setRecognizedInfo(null);
      } finally {
        if (isMounted) setIsDecoding(false);
      }
    }, 400);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [value, autoRecognize]);

  // Veículos correspondentes no estoque
  const matchingVehicles = useMemo(() => {
    const q = cleanVin(value);
    if (!q) return [];
    return vehicles
      .filter((v) => {
        if (filterStoreId && filterStoreId !== 'all' && v.store_id !== filterStoreId) {
          return false;
        }
        const ch = (v.chassis || '').toUpperCase();
        const pl = (v.plate || '').toUpperCase();
        const md = `${v.brand} ${v.model}`.toUpperCase();
        return ch.includes(q) || pl.includes(q) || md.includes(q);
      })
      .slice(0, 6);
  }, [vehicles, value, filterStoreId]);

  // Padrões correspondentes no catálogo
  const matchingPatterns = useMemo(() => {
    const q = cleanVin(value);
    if (!q || q.length < 2) return [];
    return chassisPatterns
      .filter((p) => {
        const wmi = (p.wmi_code || '').toUpperCase();
        const pattern = (p.model_pattern || '').toUpperCase();
        const name = `${p.brand} ${p.model_name || ''}`.toUpperCase();
        return q.startsWith(wmi) || q.includes(pattern) || wmi.includes(q) || name.includes(q);
      })
      .slice(0, 4);
  }, [chassisPatterns, value]);

  // Veículos filtrados dentro do modal de pesquisa avançada
  const modalFilteredVehicles = useMemo(() => {
    const q = modalSearch.toLowerCase().trim();
    if (!q) return vehicles.slice(0, 50);
    return vehicles.filter((v) => {
      const ch = (v.chassis || '').toLowerCase();
      const pl = (v.plate || '').toLowerCase();
      const md = `${v.brand} ${v.model}`.toLowerCase();
      const col = (v.color || '').toLowerCase();
      return ch.includes(q) || pl.includes(q) || md.includes(q) || col.includes(q);
    });
  }, [vehicles, modalSearch]);

  const handleSelectFromList = (v: any) => {
    onChange(v.chassis || '');
    setPopoverOpen(false);
    setModalOpen(false);
    if (onSelectVehicle) {
      onSelectVehicle({
        id: v.id,
        brand: v.brand,
        model: v.model,
        year: v.year,
        color: v.color,
        chassis: v.chassis,
        sale_price: v.sale_price,
        plate: v.plate,
        store_id: v.store_id,
        vehicle_type: v.vehicle_type,
      });
    }
  };

  const handleSelectPatternFromList = (p: any) => {
    const prefix = p.wmi_code || '';
    onChange(prefix);
    setPopoverOpen(false);
    setModalOpen(false);
    if (onSelectVehicle) {
      onSelectVehicle({
        id: '',
        brand: p.brand,
        model: p.model_name || '',
        chassis: prefix,
        sale_price: p.default_sale_price,
        vehicle_type: p.vehicle_type,
      });
    }
  };

  return (
    <div className={cn('space-y-1.5 w-full', className)}>
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            {label}
            {required && <span className="text-destructive">*</span>}
          </label>
          <button
            type="button"
            onClick={() => {
              setModalSearch(value);
              setModalOpen(true);
            }}
            className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
          >
            <Search className="w-3 h-3" />
            Pesquisar Chassi
          </button>
        </div>
      )}

      <Popover open={popoverOpen && (matchingVehicles.length > 0 || matchingPatterns.length > 0)} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <div className="relative flex items-center">
            <Input
              value={value}
              onChange={(e) => handleInputChange(e.target.value)}
              onFocus={() => {
                if (cleanVin(value).length >= 2) setPopoverOpen(true);
              }}
              placeholder={placeholder}
              className="h-10 text-xs font-mono uppercase tracking-wider pr-16 bg-background rounded-xl border"
              maxLength={20}
              required={required}
            />

            <div className="absolute right-1 flex items-center gap-0.5">
              {value && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    onChange('');
                    setRecognizedInfo(null);
                    setPopoverOpen(false);
                  }}
                  title="Limpar"
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              )}

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-primary hover:bg-primary/10 rounded-lg"
                onClick={() => {
                  setModalSearch(value);
                  setModalOpen(true);
                }}
                title="Pesquisar Veículo por Chassi no Estoque"
              >
                <Search className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </PopoverTrigger>

        {/* Dropdown com resultados da busca em tempo real */}
        <PopoverContent
          align="start"
          sideOffset={4}
          className="w-[340px] sm:w-[420px] p-2 bg-card border shadow-xl rounded-2xl z-50 text-xs max-h-80 overflow-y-auto space-y-2"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {matchingVehicles.length > 0 && (
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2 flex items-center gap-1">
                <Bike className="w-3 h-3 text-primary" />
                Veículos no Estoque com esse Chassi
              </span>
              <div className="space-y-1">
                {matchingVehicles.map((v) => (
                  <div
                    key={v.id}
                    onClick={() => handleSelectFromList(v)}
                    className="p-2 rounded-xl hover:bg-primary/10 border border-transparent hover:border-primary/20 cursor-pointer transition-all flex items-center justify-between group"
                  >
                    <div className="space-y-0.5">
                      <div className="font-mono font-bold text-foreground text-xs flex items-center gap-1.5">
                        <span className="text-primary">{v.chassis || 'Sem chassi'}</span>
                        {v.plate && <Badge variant="outline" className="text-[9px] px-1 py-0">{v.plate}</Badge>}
                      </div>
                      <p className="text-[11px] text-muted-foreground font-medium">
                        {v.brand} {v.model} {v.color ? `• ${v.color}` : ''} {v.year ? `(${v.year})` : ''}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[11px] font-bold text-emerald-600 block">
                        R$ {(v.sale_price || 0).toLocaleString('pt-BR')}
                      </span>
                      <span className="text-[9px] text-muted-foreground">
                        {v.status === 'disponivel' ? 'Disponível' : v.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {matchingPatterns.length > 0 && (
            <div className="space-y-1 pt-1 border-t">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" />
                Padrões de Chassi Homologados (Catálogo Mestre)
              </span>
              <div className="space-y-1">
                {matchingPatterns.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => handleSelectPatternFromList(p)}
                    className="p-2 rounded-xl hover:bg-amber-500/10 border border-transparent hover:border-amber-500/20 cursor-pointer transition-all flex items-center justify-between"
                  >
                    <div>
                      <span className="font-mono font-bold text-xs text-amber-700 dark:text-amber-400">
                        {p.wmi_code} {p.model_pattern ? `• ${p.model_pattern}` : ''}
                      </span>
                      <p className="text-[11px] text-muted-foreground">
                        {p.brand} {p.model_name || ''} ({p.vehicle_type === 'moto' ? 'Moto' : 'Carro'})
                      </p>
                    </div>
                    {p.default_sale_price && (
                      <span className="text-[11px] font-bold text-muted-foreground">
                        Tab: R$ {p.default_sale_price.toLocaleString('pt-BR')}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* Badge de Reconhecimento Autônomo */}
      {isDecoding ? (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground animate-pulse">
          <Loader2 className="w-3 h-3 animate-spin text-primary" />
          <span>Consultando decodificador de chassi...</span>
        </div>
      ) : recognizedInfo && (recognizedInfo.brand || recognizedInfo.model || recognizedInfo.year) ? (
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-xl border border-emerald-500/20 w-fit">
          <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>
            Reconhecimento Autônomo:{' '}
            {[recognizedInfo.brand, recognizedInfo.model, recognizedInfo.year ? `Ano ${recognizedInfo.year}` : '']
              .filter(Boolean)
              .join(' ')}
          </span>
        </div>
      ) : null}

      {/* MODAL DE PESQUISA AVANÇADA DE CHASSI */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-5 rounded-3xl">
          <DialogHeader className="pb-3 border-b">
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Search className="w-4 h-4 text-primary" />
              Localizador de Veículos por Chassi (Estoque & Catálogo)
            </DialogTitle>
            <DialogDescription className="text-xs">
              Pesquise qualquer parte do chassi (número de série, WMI, modelo ou placa) para preenchimento instantâneo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Ex: 001222, 99HSHF, SHI 250, preta, placa..."
                value={modalSearch}
                onChange={(e) => setModalSearch(e.target.value)}
                className="pl-9 h-10 text-xs font-mono uppercase rounded-xl"
                autoFocus
              />
            </div>

            <div className="text-[11px] text-muted-foreground flex items-center justify-between">
              <span>{modalFilteredVehicles.length} veículo(s) encontrado(s) no estoque</span>
              <span className="font-semibold text-primary">Clique em qualquer veículo para selecionar</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 mt-2 max-h-[400px] pr-1">
            {isLoadingVehicles ? (
              <div className="text-center py-10 text-xs text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                Carregando estoque de veículos...
              </div>
            ) : modalFilteredVehicles.length === 0 ? (
              <div className="text-center py-12 text-xs text-muted-foreground bg-muted/20 rounded-2xl border border-dashed p-6">
                <p className="font-semibold text-foreground">Nenhum veículo encontrado com esse termo</p>
                <p className="mt-1">Tente pesquisar apenas os 4 ou 6 dígitos finais do chassi.</p>
              </div>
            ) : (
              modalFilteredVehicles.map((v) => (
                <div
                  key={v.id}
                  onClick={() => handleSelectFromList(v)}
                  className="p-3 rounded-2xl border border-border/70 hover:border-primary/50 bg-card hover:bg-primary/5 cursor-pointer transition-all flex items-center justify-between group"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        {v.vehicle_type === 'carro' ? <Car className="w-4 h-4" /> : <Bike className="w-4 h-4" />}
                      </div>
                      <div>
                        <span className="font-mono font-bold text-xs text-foreground group-hover:text-primary transition-colors">
                          {v.chassis || 'CHASSI NÃO INFORMADO'}
                        </span>
                        {v.plate && (
                          <Badge variant="outline" className="text-[10px] ml-2 px-1.5 py-0 font-mono">
                            {v.plate}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="text-xs text-muted-foreground flex items-center gap-2 pl-9">
                      <strong className="text-foreground">{v.brand} {v.model}</strong>
                      {v.color && <span>• {v.color}</span>}
                      {v.year && <span>• Ano {v.year}</span>}
                      <span className="text-[10px]">• Loja: {v.store_id === 'store-montesclaros' ? 'Montes Claros' : 'Divinópolis'}</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0 pl-3">
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 block">
                      R$ {(v.sale_price || 0).toLocaleString('pt-BR')}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[10px] font-bold rounded-lg mt-1 group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary"
                    >
                      Selecionar
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
