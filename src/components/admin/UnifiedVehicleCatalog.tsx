import { useMemo, useState } from 'react';
import {
  Bike,
  Car,
  Pencil,
  Plus,
  Search,
  Trash2,
  Tag,
  Flame,
  Binary,
  CheckCircle2,
  AlertCircle,
  SlidersHorizontal,
  DollarSign,
  Sparkles,
  ShieldCheck,
  Calendar,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  useVehicleModels,
  useSaveVehicleModel,
  useDeleteVehicleModel,
  VehicleModel,
  effectiveModelPrice,
} from '@/hooks/useVehicleModels';
import { normalizeName, standardizeName } from '@/lib/vehicleCatalog';
import { maskCurrency, parseCurrency } from '@/lib/masks';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/contexts/ConfirmationContext';

interface ChassisPatternRow {
  id: string;
  wmi_code: string;
  brand: string;
  vehicle_type: string;
  model_pattern: string | null;
  model_name: string | null;
}

interface UnifiedFormState {
  // Modelo
  brand: string;
  model: string;
  vehicle_type: 'moto' | 'carro';
  engine_cc: string;
  fuel_type: string;
  transmission: string;
  warranty_months: string;
  revision_period_months: string;
  revision_period_km: string;
  is_active: boolean;

  // Preços & Promoções
  default_sale_price: string;
  default_purchase_price: string;
  promo_price: string;
  promo_active: boolean;
  promo_label: string;
  promo_ends_on: string;

  // Padrão de Chassi (VIN)
  wmi_code: string;
  model_pattern: string;
  existing_pattern_id?: string | null;
}

const emptyUnifiedForm: UnifiedFormState = {
  brand: 'SHINERAY',
  model: '',
  vehicle_type: 'moto',
  engine_cc: '',
  fuel_type: 'Gasolina',
  transmission: 'Manual',
  warranty_months: '12',
  revision_period_months: '',
  revision_period_km: '',
  is_active: true,

  default_sale_price: '',
  default_purchase_price: '',
  promo_price: '',
  promo_active: false,
  promo_label: '',
  promo_ends_on: '',

  wmi_code: '99H',
  model_pattern: '',
  existing_pattern_id: null,
};

const brl = (v: number | null | undefined) =>
  v == null || v === 0
    ? '—'
    : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

const toMask = (v: number | null | undefined) =>
  v != null && v > 0 ? maskCurrency(String(Math.round(v * 100))) : '';

const numOrNull = (v: string) => (v.trim() === '' ? null : Number(v));

export function UnifiedVehicleCatalog() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const { data: models = [], isLoading: loadingModels } = useVehicleModels();
  const saveModel = useSaveVehicleModel();
  const deleteModel = useDeleteVehicleModel();

  // Consulta de Padrões de Chassi (VIN)
  const { data: patterns = [], isLoading: loadingPatterns } = useQuery<ChassisPatternRow[]>({
    queryKey: ['chassis-patterns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chassis_patterns')
        .select('id, wmi_code, brand, vehicle_type, model_pattern, model_name')
        .order('brand', { ascending: true });
      if (error) throw error;
      return (data || []) as ChassisPatternRow[];
    },
  });

  // Estados de Busca e Filtro
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'moto' | 'carro'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'promo' | 'no_price' | 'has_vin' | 'no_vin'>('all');

  // Modal Unificado (Criação & Edição)
  const [modalOpen, setModalOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<VehicleModel | null>(null);
  const [form, setForm] = useState<UnifiedFormState>(emptyUnifiedForm);

  // Mapeamento Modelo -> Padrão de Chassi (VIN)
  const modelPatternMap = useMemo(() => {
    const map = new Map<string, ChassisPatternRow[]>();

    patterns.forEach((pat) => {
      if (!pat.model_name) return;
      const key = `${normalizeName(pat.brand || '')}_${normalizeName(pat.model_name)}`;
      const list = map.get(key) || [];
      list.push(pat);
      map.set(key, list);
    });

    return map;
  }, [patterns]);

  // Lista Filtrada com Dados Mesclados
  const enrichedList = useMemo(() => {
    const q = normalizeName(search);

    return models
      .map((m) => {
        const key = `${normalizeName(m.brand)}_${normalizeName(m.model)}`;
        const directPatterns = modelPatternMap.get(key) || [];

        // Fallback: busca por nome do modelo contido no padrão
        const matchingPatterns =
          directPatterns.length > 0
            ? directPatterns
            : patterns.filter(
                (p) =>
                  p.model_name &&
                  normalizeName(p.model_name) === normalizeName(m.model) &&
                  (!p.brand || normalizeName(p.brand) === normalizeName(m.brand)),
              );

        const eff = effectiveModelPrice(m);

        return {
          ...m,
          patterns: matchingPatterns,
          primaryPattern: matchingPatterns[0] || null,
          hasPattern: matchingPatterns.length > 0,
          effectivePrice: eff.price,
          isPromo: eff.isPromo,
        };
      })
      .filter((item) => {
        if (typeFilter !== 'all' && item.vehicle_type !== typeFilter) return false;

        if (statusFilter === 'promo' && !item.isPromo) return false;
        if (statusFilter === 'no_price' && item.default_sale_price && item.default_sale_price > 0) return false;
        if (statusFilter === 'has_vin' && !item.hasPattern) return false;
        if (statusFilter === 'no_vin' && item.hasPattern) return false;

        if (!q) return true;

        const inName = normalizeName(`${item.brand} ${item.model}`).includes(q);
        const inPattern = item.patterns.some(
          (p) =>
            normalizeName(p.wmi_code).includes(q) ||
            normalizeName(p.model_pattern || '').includes(q),
        );

        return inName || inPattern;
      })
      .sort((a, b) => `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`, 'pt-BR'));
  }, [models, modelPatternMap, patterns, search, typeFilter, statusFilter]);

  // KPIs Resumo
  const stats = useMemo(() => {
    const total = models.length;
    const promo = models.filter((m) => effectiveModelPrice(m).isPromo).length;
    const noPrice = models.filter((m) => !m.default_sale_price || m.default_sale_price <= 0).length;
    const withVin = models.filter((m) => {
      const key = `${normalizeName(m.brand)}_${normalizeName(m.model)}`;
      return (modelPatternMap.get(key) || []).length > 0;
    }).length;

    return { total, promo, noPrice, withVin };
  }, [models, modelPatternMap]);

  // Abrir Modal de Criação Completo
  const handleStartCreate = () => {
    setEditingModel(null);
    setForm(emptyUnifiedForm);
    setModalOpen(true);
  };

  // Abrir Modal de Edição Unificado
  const handleStartEdit = (item: (typeof enrichedList)[0]) => {
    setEditingModel(item);
    const primary = item.primaryPattern;

    setForm({
      brand: item.brand,
      model: item.model,
      vehicle_type: item.vehicle_type,
      engine_cc: item.engine_cc?.toString() || '',
      fuel_type: item.fuel_type || 'Gasolina',
      transmission: item.transmission || 'Manual',
      warranty_months: item.warranty_months?.toString() || '',
      revision_period_months: item.revision_period_months?.toString() || '',
      revision_period_km: item.revision_period_km?.toString() || '',
      is_active: item.is_active,

      default_sale_price: toMask(item.default_sale_price),
      default_purchase_price: toMask(item.default_purchase_price),
      promo_price: toMask(item.promo_price),
      promo_active: item.promo_active,
      promo_label: item.promo_label || '',
      promo_ends_on: item.promo_ends_on || '',

      wmi_code: primary ? primary.wmi_code : '99H',
      model_pattern: primary ? primary.model_pattern || '' : '',
      existing_pattern_id: primary ? primary.id : null,
    });
    setModalOpen(true);
  };

  // Salvar Dados Unificados (Modelo + Preços + Chassi VIN)
  const handleSubmitUnified = async () => {
    if (!form.brand.trim() || !form.model.trim()) {
      alert('Preencha a marca e o nome do modelo.');
      return;
    }

    const brandStd = standardizeName(form.brand);
    const modelStd = standardizeName(form.model);

    try {
      // 1. Salva ou atualiza o modelo com seus preços e especificações
      const modelPayload = {
        brand: brandStd,
        model: modelStd,
        vehicle_type: form.vehicle_type,
        engine_cc: numOrNull(form.engine_cc),
        fuel_type: form.fuel_type || null,
        transmission: form.transmission || null,
        warranty_months: numOrNull(form.warranty_months),
        revision_period_months: numOrNull(form.revision_period_months),
        revision_period_km: numOrNull(form.revision_period_km),
        default_sale_price: form.default_sale_price ? parseCurrency(form.default_sale_price) : null,
        default_purchase_price: form.default_purchase_price ? parseCurrency(form.default_purchase_price) : null,
        promo_price: form.promo_price ? parseCurrency(form.promo_price) : null,
        promo_active: form.promo_active && !!form.promo_price,
        promo_label: form.promo_label ? form.promo_label.toUpperCase().trim() : null,
        promo_ends_on: form.promo_ends_on || null,
        is_active: form.is_active,
      };

      await saveModel.mutateAsync({
        id: editingModel?.id,
        data: modelPayload,
      });

      // 2. Se o usuário preencheu WMI ou Padrão de Chassi, sincroniza na tabela chassis_patterns
      const wmiClean = form.wmi_code.trim().toUpperCase();
      const patternClean = form.model_pattern.trim().toUpperCase();

      if (wmiClean || patternClean) {
        const patternPayload = {
          wmi_code: wmiClean || '99H',
          brand: brandStd,
          vehicle_type: form.vehicle_type,
          model_pattern: patternClean || null,
          model_name: modelStd,
          engine_cc: numOrNull(form.engine_cc),
          fuel_type: form.fuel_type || null,
          transmission: form.transmission || null,
          warranty_months: numOrNull(form.warranty_months),
          default_sale_price: form.default_sale_price ? parseCurrency(form.default_sale_price) : null,
          default_purchase_price: form.default_purchase_price ? parseCurrency(form.default_purchase_price) : null,
        };

        if (form.existing_pattern_id) {
          await supabase
            .from('chassis_patterns')
            .update(patternPayload)
            .eq('id', form.existing_pattern_id);
        } else {
          await supabase.from('chassis_patterns').insert(patternPayload);
        }

        queryClient.invalidateQueries({ queryKey: ['chassis-patterns'] });
      }

      setModalOpen(false);
      toast({
        title: 'Modelo e Padrões Salvos!',
        description: `${modelStd} atualizado com especificações, preços e padrão VIN.`,
      });
    } catch (err: any) {
      console.error('Erro ao salvar veículo unificado:', err);
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: err.message || 'Verifique os campos e tente novamente.',
      });
    }
  };

  // Alternar Status Ativo
  const handleToggleActive = async (m: VehicleModel) => {
    await saveModel.mutateAsync({
      id: m.id,
      data: { is_active: !m.is_active },
    });
  };

  return (
    <div className="space-y-4">
      {/* KPIS NO TOPO */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl border bg-card space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
            Modelos Oficiais
          </span>
          <div className="text-xl font-black font-display text-foreground tracking-tight">
            {stats.total}
          </div>
          <span className="text-[10px] text-muted-foreground">Cadastrados no catálogo</span>
        </div>

        <div className="p-3.5 rounded-2xl border bg-card space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 block flex items-center gap-1">
            <Flame className="w-3.5 h-3.5 text-amber-500" /> Em Promoção
          </span>
          <div className="text-xl font-black font-display text-amber-600 dark:text-amber-400 tracking-tight">
            {stats.promo}
          </div>
          <span className="text-[10px] text-muted-foreground">Com desconto ativo</span>
        </div>

        <div className="p-3.5 rounded-2xl border bg-card space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-primary block flex items-center gap-1">
            <Binary className="w-3.5 h-3.5 text-primary" /> Padrões VIN Mapeados
          </span>
          <div className="text-xl font-black font-display text-primary tracking-tight">
            {stats.withVin}
          </div>
          <span className="text-[10px] text-muted-foreground">Reconhecimento por chassi</span>
        </div>

        <div className="p-3.5 rounded-2xl border bg-card space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
            Sem Preço Definido
          </span>
          <div className="text-xl font-black font-display text-muted-foreground tracking-tight">
            {stats.noPrice}
          </div>
          <span className="text-[10px] text-muted-foreground">Precisam de tabela</span>
        </div>
      </div>

      {/* BARRA DE FILTROS & AÇÃO PRINCIPAL */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-card p-3 rounded-2xl border shadow-sm">
        <div className="flex flex-wrap flex-1 w-full items-center gap-2">
          {/* Busca */}
          <div className="relative min-w-[200px] flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por modelo, marca, WMI ou prefixo VIN..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 pl-9 text-xs bg-background rounded-xl"
            />
          </div>

          {/* Filtro por Tipo */}
          <Select value={typeFilter} onValueChange={(v: any) => setTypeFilter(v)}>
            <SelectTrigger className="h-9 text-xs w-[120px] bg-background rounded-xl">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Motos & Carros</SelectItem>
              <SelectItem value="moto">Apenas Motos</SelectItem>
              <SelectItem value="carro">Apenas Carros</SelectItem>
            </SelectContent>
          </Select>

          {/* Filtro por Status */}
          <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
            <SelectTrigger className="h-9 text-xs w-[170px] bg-background rounded-xl">
              <SelectValue placeholder="Situação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Situações</SelectItem>
              <SelectItem value="promo">Com Promoção Ativa</SelectItem>
              <SelectItem value="has_vin">Com Padrão VIN</SelectItem>
              <SelectItem value="no_vin">Sem Padrão VIN</SelectItem>
              <SelectItem value="no_price">Sem Preço de Venda</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Botão Novo Veículo Unificado */}
        <Button
          size="sm"
          onClick={handleStartCreate}
          className="h-9 px-3 gap-1.5 text-xs font-bold bg-primary text-primary-foreground shadow-md shadow-primary/20 shrink-0"
        >
          <Plus className="w-4 h-4" />
          Novo Modelo Completo
        </Button>
      </div>

      {/* TABELA UNIFICADA: MODELOS + PREÇOS + PADRÕES DE CHASSI (VIN) */}
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[640px]">
          <Table className="text-xs">
            <TableHeader className="bg-muted/70 sticky top-0 z-10 backdrop-blur">
              <TableRow className="border-b font-bold text-foreground uppercase tracking-wider text-[10px]">
                <TableHead className="py-2.5">Veículo / Modelo</TableHead>
                <TableHead className="py-2.5">Padrão Chassi (VIN)</TableHead>
                <TableHead className="text-right py-2.5">Preço de Tabela</TableHead>
                <TableHead className="py-2.5">Promoção Vigente</TableHead>
                <TableHead className="py-2.5">Especificações</TableHead>
                <TableHead className="text-center py-2.5 w-16">Ativo</TableHead>
                <TableHead className="text-right pr-3 py-2.5 w-24">Ações</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {loadingModels || loadingPatterns ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground text-xs">
                    Carregando catálogo unificado de modelos e chassi...
                  </TableCell>
                </TableRow>
              ) : enrichedList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground text-xs">
                    Nenhum veículo encontrado para este filtro.
                  </TableCell>
                </TableRow>
              ) : (
                enrichedList.map((item) => {
                  return (
                    <TableRow
                      key={item.id}
                      className={`hover:bg-muted/40 transition-colors border-b ${
                        !item.is_active ? 'opacity-50 bg-muted/10' : ''
                      }`}
                    >
                      {/* Veículo / Modelo */}
                      <TableCell className="py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                            {item.vehicle_type === 'moto' ? (
                              <Bike className="w-4 h-4" />
                            ) : (
                              <Car className="w-4 h-4" />
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-foreground text-xs flex items-center gap-1.5">
                              {item.model}
                              <Badge variant="outline" className="text-[9px] py-0 px-1 font-mono uppercase">
                                {item.vehicle_type}
                              </Badge>
                            </div>
                            <div className="text-[10px] text-muted-foreground font-semibold">
                              {item.brand}
                            </div>
                          </div>
                        </div>
                      </TableCell>

                      {/* Padrão de Chassi (VIN) */}
                      <TableCell className="py-2.5">
                        {item.patterns.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-1">
                            {item.patterns.map((p) => (
                              <Badge
                                key={p.id}
                                variant="secondary"
                                className="font-mono text-[10px] py-0.5 px-2 bg-primary/5 text-primary border border-primary/20"
                                title={`WMI: ${p.wmi_code} • Prefixo: ${p.model_pattern || 'Geral'}`}
                              >
                                <Binary className="w-3 h-3 mr-1 opacity-70" />
                                {p.wmi_code}
                                {p.model_pattern ? ` • ${p.model_pattern}` : ''}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span
                            onClick={() => handleStartEdit(item)}
                            className="text-[11px] text-amber-600 dark:text-amber-400 cursor-pointer hover:underline flex items-center gap-1"
                            title="Clique para vincular o prefixo de chassi"
                          >
                            <AlertCircle className="w-3 h-3 text-amber-500" />
                            + Vincular VIN
                          </span>
                        )}
                      </TableCell>

                      {/* Preço de Tabela */}
                      <TableCell className="text-right py-2.5 whitespace-nowrap">
                        <span className="font-black text-foreground text-xs font-mono">
                          {brl(item.default_sale_price)}
                        </span>
                        {item.default_purchase_price && item.default_purchase_price > 0 && (
                          <div className="text-[10px] text-muted-foreground">
                            Custo: {brl(item.default_purchase_price)}
                          </div>
                        )}
                      </TableCell>

                      {/* Promoção Vigente */}
                      <TableCell className="py-2.5 whitespace-nowrap">
                        {item.isPromo ? (
                          <div className="flex items-center gap-1.5">
                            <Badge className="bg-amber-500 text-white font-mono font-bold text-[10px] py-0 px-1.5 gap-0.5">
                              <Flame className="w-3 h-3 fill-current" />
                              {brl(item.promo_price)}
                            </Badge>
                            {item.promo_label && (
                              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                                {item.promo_label}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-[11px]">Sem promoção</span>
                        )}
                      </TableCell>

                      {/* Especificações */}
                      <TableCell className="py-2.5 text-[11px] text-muted-foreground whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {item.engine_cc && <span>{item.engine_cc} cc</span>}
                          {item.fuel_type && <span>• {item.fuel_type}</span>}
                          {item.transmission && <span>• {item.transmission}</span>}
                        </div>
                      </TableCell>

                      {/* Switch Ativo/Inativo */}
                      <TableCell className="text-center py-2.5">
                        <Switch
                          checked={item.is_active}
                          onCheckedChange={() => handleToggleActive(item)}
                        />
                      </TableCell>

                      {/* Ações */}
                      <TableCell className="text-right pr-3 py-2.5 whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleStartEdit(item)}
                            className="h-7 px-2 text-[10px] gap-1 font-semibold text-primary hover:bg-primary/10 rounded-lg"
                            title="Editar Modelo, Preço e Chassi"
                          >
                            <Pencil className="w-3 h-3" /> Editar
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={async () => {
                              const ok = await confirm({
                                title: 'Excluir Modelo?',
                                description: `Deseja realmente excluir o modelo ${item.brand} ${item.model}?`,
                                confirmText: 'Excluir Modelo',
                                cancelText: 'Cancelar',
                                variant: 'destructive',
                              });
                              if (ok) {
                                deleteModel.mutate(item.id);
                              }
                            }}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive rounded-lg"
                            title="Excluir Modelo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* MODAL UNIFICADO: MODELO, PREÇOS E PADRÕES DE CHASSI */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-3xl rounded-3xl max-h-[92vh] overflow-y-auto p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Bike className="w-5 h-5 text-primary" />
              {editingModel
                ? `Editar Veículo — ${editingModel.brand} ${editingModel.model}`
                : 'Novo Veículo no Catálogo Unificado'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configure o modelo, sua precificação de venda/promoção e os padrões de chassi (VIN) em um só lugar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* SEÇÃO 1: DADOS DO MODELO */}
            <div className="p-3.5 rounded-2xl bg-muted/20 border space-y-3">
              <span className="font-bold text-xs uppercase text-foreground flex items-center gap-1.5">
                <Bike className="w-4 h-4 text-primary" /> 1. Dados Oficiais do Modelo
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs font-semibold">Marca *</Label>
                  <Input
                    value={form.brand}
                    onChange={(e) => setForm({ ...form, brand: e.target.value })}
                    placeholder="SHINERAY, HONDA, YAMAHA..."
                    className="h-9 mt-1 text-xs uppercase"
                  />
                </div>

                <div className="sm:col-span-2">
                  <Label className="text-xs font-semibold">Nome do Modelo *</Label>
                  <Input
                    value={form.model}
                    onChange={(e) => setForm({ ...form, model: e.target.value })}
                    placeholder="Ex: SHI 250, RIO 125, STORM 200..."
                    className="h-9 mt-1 text-xs uppercase font-bold"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">Tipo de Veículo</Label>
                  <Select
                    value={form.vehicle_type}
                    onValueChange={(v: any) => setForm({ ...form, vehicle_type: v })}
                  >
                    <SelectTrigger className="h-9 mt-1 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="moto">Moto</SelectItem>
                      <SelectItem value="carro">Carro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs font-semibold">Cilindradas (cc)</Label>
                  <Input
                    type="number"
                    value={form.engine_cc}
                    onChange={(e) => setForm({ ...form, engine_cc: e.target.value })}
                    placeholder="Ex: 250"
                    className="h-9 mt-1 text-xs"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">Combustível</Label>
                  <Select
                    value={form.fuel_type}
                    onValueChange={(v) => setForm({ ...form, fuel_type: v })}
                  >
                    <SelectTrigger className="h-9 mt-1 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Gasolina">Gasolina</SelectItem>
                      <SelectItem value="Flex">Flex (Álcool/Gasolina)</SelectItem>
                      <SelectItem value="Elétrico">Elétrico</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs font-semibold">Câmbio</Label>
                  <Select
                    value={form.transmission}
                    onValueChange={(v) => setForm({ ...form, transmission: v })}
                  >
                    <SelectTrigger className="h-9 mt-1 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Manual">Manual</SelectItem>
                      <SelectItem value="Automático">Automático</SelectItem>
                      <SelectItem value="Semi-Automático">Semi-Automático</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs font-semibold">Garantia (Meses)</Label>
                  <Input
                    type="number"
                    value={form.warranty_months}
                    onChange={(e) => setForm({ ...form, warranty_months: e.target.value })}
                    placeholder="Ex: 12"
                    className="h-9 mt-1 text-xs"
                  />
                </div>

                <div className="flex items-center gap-2 pt-6">
                  <Switch
                    checked={form.is_active}
                    onCheckedChange={(c) => setForm({ ...form, is_active: c })}
                  />
                  <Label className="text-xs font-semibold cursor-pointer">
                    Modelo Ativo no Catálogo
                  </Label>
                </div>
              </div>
            </div>

            {/* SEÇÃO 2: PREÇOS & PROMOÇÕES */}
            <div className="p-3.5 rounded-2xl bg-muted/20 border space-y-3">
              <span className="font-bold text-xs uppercase text-foreground flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-emerald-500" /> 2. Preços & Promoções Comerciais
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs font-semibold">Preço de Venda (Tabela R$)</Label>
                  <Input
                    value={form.default_sale_price}
                    onChange={(e) => setForm({ ...form, default_sale_price: maskCurrency(e.target.value) })}
                    placeholder="R$ 23.330,00"
                    className="h-9 mt-1 text-xs font-bold text-foreground"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">Preço de Custo (Compra R$)</Label>
                  <Input
                    value={form.default_purchase_price}
                    onChange={(e) => setForm({ ...form, default_purchase_price: maskCurrency(e.target.value) })}
                    placeholder="R$ 18.000,00"
                    className="h-9 mt-1 text-xs text-muted-foreground"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">Preço Promocional (R$)</Label>
                  <Input
                    value={form.promo_price}
                    onChange={(e) => setForm({ ...form, promo_price: maskCurrency(e.target.value) })}
                    placeholder="R$ 21.990,00"
                    className="h-9 mt-1 text-xs font-bold text-amber-600 dark:text-amber-400"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">Rótulo da Promoção</Label>
                  <Input
                    value={form.promo_label}
                    onChange={(e) => setForm({ ...form, promo_label: e.target.value })}
                    placeholder="Ex: BLACK FRIDAY, OFERTA MÊS"
                    className="h-9 mt-1 text-xs uppercase"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">Válido até (Data Limite)</Label>
                  <Input
                    type="date"
                    value={form.promo_ends_on}
                    onChange={(e) => setForm({ ...form, promo_ends_on: e.target.value })}
                    className="h-9 mt-1 text-xs"
                  />
                </div>

                <div className="flex items-center gap-2 pt-6">
                  <Switch
                    checked={form.promo_active}
                    onCheckedChange={(c) => setForm({ ...form, promo_active: c })}
                  />
                  <Label className="text-xs font-semibold cursor-pointer text-amber-600 dark:text-amber-400">
                    Ativar Promoção Agora
                  </Label>
                </div>
              </div>
            </div>

            {/* SEÇÃO 3: PADRÕES DE CHASSI (VIN) */}
            <div className="p-3.5 rounded-2xl bg-muted/20 border space-y-3">
              <span className="font-bold text-xs uppercase text-foreground flex items-center gap-1.5">
                <Binary className="w-4 h-4 text-primary" /> 3. Padrão de Chassi (VIN) para Auto-Reconhecimento
              </span>
              <p className="text-[11px] text-muted-foreground">
                Permite que o sistema reconheça automaticamente este modelo quando um chassi é digitado nas vendas, laudos e planilhas.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold">Código WMI (Fabricante - 3 dígitos)</Label>
                  <Input
                    value={form.wmi_code}
                    onChange={(e) => setForm({ ...form, wmi_code: e.target.value.toUpperCase() })}
                    placeholder="99H (Shineray), 9C2 (Honda)..."
                    className="h-9 mt-1 text-xs font-mono uppercase font-bold"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">Prefixo do Modelo no Chassi (VIN)</Label>
                  <Input
                    value={form.model_pattern}
                    onChange={(e) => setForm({ ...form, model_pattern: e.target.value.toUpperCase() })}
                    placeholder="Ex: SHF250, XY125, SH50..."
                    className="h-9 mt-1 text-xs font-mono uppercase font-bold"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" className="font-bold" onClick={handleSubmitUnified}>
              Salvar Veículo Completo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
