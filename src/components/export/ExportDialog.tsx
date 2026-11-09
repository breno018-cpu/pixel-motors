import { useState } from 'react';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { 
  Download, Calendar as CalendarIcon, FileSpreadsheet, 
  Store, Users, Car, Loader2, CheckCircle
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useStores } from '@/hooks/useStores';
import { useResellers } from '@/hooks/useResellers';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { exportToXLSX, getExportColumns } from '@/lib/export';
import { useToast } from '@/hooks/use-toast';

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ExportModule = 'vehicles' | 'sales';
type DatePreset = 'this_month' | 'last_month' | 'last_3_months' | 'custom';

export function ExportDialog({ open, onOpenChange }: ExportDialogProps) {
  const { profile, isAdmin } = useAuth();
  const { data: stores } = useStores();
  const { data: resellers } = useResellers();
  const { toast } = useToast();
  
  const [module, setModule] = useState<ExportModule>('vehicles');
  const [storeId, setStoreId] = useState<string>('all');
  const [resellerId, setResellerId] = useState<string>('all');
  const [datePreset, setDatePreset] = useState<DatePreset>('this_month');
  const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(endOfMonth(new Date()));
  const [isExporting, setIsExporting] = useState(false);

  const handleDatePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    const now = new Date();
    
    switch (preset) {
      case 'this_month':
        setStartDate(startOfMonth(now));
        setEndDate(endOfMonth(now));
        break;
      case 'last_month':
        setStartDate(startOfMonth(subMonths(now, 1)));
        setEndDate(endOfMonth(subMonths(now, 1)));
        break;
      case 'last_3_months':
        setStartDate(startOfMonth(subMonths(now, 2)));
        setEndDate(endOfMonth(now));
        break;
      case 'custom':
        // Keep current dates
        break;
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    
    try {
      let data: Record<string, unknown>[] = [];
      const filters: Record<string, string> = {};
      
      // Build filters
      if (storeId !== 'all') {
        filters['Loja'] = stores?.find(s => s.id === storeId)?.name || storeId;
      }
      if (resellerId !== 'all') {
        filters['Revendedor'] = resellers?.find(r => r.id === resellerId)?.full_name || resellerId;
      }
      filters['Período'] = `${format(startDate, 'dd/MM/yyyy')} a ${format(endDate, 'dd/MM/yyyy')}`;
      
      if (module === 'vehicles') {
        let query = supabase
          .from('vehicles')
          .select(`
            *,
            store:stores(name),
            reseller:resellers(full_name)
          `)
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString());
        
        if (storeId !== 'all') {
          query = query.eq('store_id', storeId);
        }
        if (resellerId !== 'all') {
          query = query.eq('reseller_id', resellerId);
        }
        
        const { data: vehicles } = await query;
        data = (vehicles || []).map(v => ({
          ...v,
          store_name: (v.store as { name: string } | null)?.name || '',
          reseller_name: (v.reseller as { full_name: string } | null)?.full_name || '',
        }));
      } else if (module === 'sales') {
        let query = supabase
          .from('contracts')
          .select(`
            *,
            vehicle:vehicles(brand, model, year, plate, chassis, color, vehicle_type),
            store:stores(name),
            reseller:resellers(full_name)
          `)
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString());
        
        if (storeId !== 'all') {
          query = query.eq('store_id', storeId);
        }
        if (resellerId !== 'all') {
          query = query.eq('reseller_id', resellerId);
        }
        
        const { data: contracts } = await query;
        data = (contracts || []).map(c => {
          const vehicle = c.vehicle as { brand: string; model: string; year: number; plate: string | null; chassis: string | null; color: string | null; vehicle_type: string | null } | null;
          return {
            ...c,
            vehicle_info: vehicle ? `${vehicle.brand} ${vehicle.model} ${vehicle.year}` : '',
            vehicle_chassis: vehicle?.chassis || '',
            vehicle_plate: vehicle?.plate || '',
            vehicle_color: vehicle?.color || '',
            vehicle_type: vehicle?.vehicle_type || '',
            store_name: (c.store as { name: string } | null)?.name || '',
            reseller_name: (c.reseller as { full_name: string } | null)?.full_name || '',
          };
        });
      }

      const columns = module === 'vehicles' 
        ? [
            ...getExportColumns('vehicles'),
            { key: 'store_name', label: 'Loja', type: 'text' as const },
            { key: 'reseller_name', label: 'Revendedor', type: 'text' as const },
          ]
        : [
            ...getExportColumns('sales'),
            { key: 'store_name', label: 'Loja', type: 'text' as const },
            { key: 'reseller_name', label: 'Revendedor', type: 'text' as const },
          ];

      const result = await exportToXLSX({
        title: module === 'vehicles' ? 'Relatório de Estoque' : 'Relatório de Vendas',
        module: module === 'vehicles' ? 'vehicles' : 'sales',
        filters,
        columns,
        data,
        userName: profile?.full_name || 'Usuário',
        storeName: storeId !== 'all' ? stores?.find(s => s.id === storeId)?.name : 'Todas as Lojas',
      });

      if (result.success) {
        toast({
          title: 'Exportação concluída!',
          description: `${data.length} registros exportados com sucesso.`,
        });
        onOpenChange(false);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro na exportação',
        description: error instanceof Error ? error.message : 'Falha ao exportar dados.',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const selectedStore = stores?.find(s => s.id === storeId);
  const selectedReseller = resellers?.find(r => r.id === resellerId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            Exportar Relatório
          </DialogTitle>
          <DialogDescription>
            Selecione os filtros para gerar sua planilha Excel personalizada
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Module Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">O que deseja exportar?</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setModule('vehicles')}
                className={cn(
                  "p-4 rounded-lg border-2 text-left transition-all",
                  module === 'vehicles' 
                    ? "border-primary bg-primary/5" 
                    : "border-border hover:border-muted-foreground/50"
                )}
              >
                <Car className={cn("w-6 h-6 mb-2", module === 'vehicles' ? "text-primary" : "text-muted-foreground")} />
                <p className="font-medium text-sm">Estoque</p>
                <p className="text-xs text-muted-foreground">Veículos e motos cadastrados</p>
              </button>
              <button
                type="button"
                onClick={() => setModule('sales')}
                className={cn(
                  "p-4 rounded-lg border-2 text-left transition-all",
                  module === 'sales' 
                    ? "border-primary bg-primary/5" 
                    : "border-border hover:border-muted-foreground/50"
                )}
              >
                <FileSpreadsheet className={cn("w-6 h-6 mb-2", module === 'sales' ? "text-primary" : "text-muted-foreground")} />
                <p className="font-medium text-sm">Vendas</p>
                <p className="text-xs text-muted-foreground">Contratos e transações</p>
              </button>
            </div>
          </div>

          {/* Date Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Período</Label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'this_month', label: 'Este mês' },
                { value: 'last_month', label: 'Mês passado' },
                { value: 'last_3_months', label: 'Últimos 3 meses' },
                { value: 'custom', label: 'Personalizado' },
              ].map((preset) => (
                <Badge
                  key={preset.value}
                  variant={datePreset === preset.value ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => handleDatePresetChange(preset.value as DatePreset)}
                >
                  {preset.label}
                </Badge>
              ))}
            </div>
            
            {datePreset === 'custom' && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="space-y-1">
                  <Label className="text-xs">Data inicial</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start h-9 text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(startDate, 'dd/MM/yyyy', { locale: ptBR })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={(date) => date && setStartDate(date)}
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Data final</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start h-9 text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(endDate, 'dd/MM/yyyy', { locale: ptBR })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={(date) => date && setEndDate(date)}
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}
          </div>

          {/* Store Filter */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Store className="w-4 h-4" />
              Loja
            </Label>
            <Select value={storeId} onValueChange={setStoreId} disabled={!isAdmin}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a loja" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as lojas</SelectItem>
                {stores?.map((store) => (
                  <SelectItem key={store.id} value={store.id}>
                    {store.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Reseller Filter */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Users className="w-4 h-4" />
              Revendedor
            </Label>
            <Select value={resellerId} onValueChange={setResellerId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o revendedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os revendedores</SelectItem>
                {resellers?.filter(r => storeId === 'all' || r.store_id === storeId).map((reseller) => (
                  <SelectItem key={reseller.id} value={reseller.id}>
                    {reseller.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Summary */}
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-xs font-medium text-foreground mb-2">Resumo do relatório:</p>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>• <strong>Tipo:</strong> {module === 'vehicles' ? 'Estoque' : 'Vendas'}</p>
              <p>• <strong>Período:</strong> {format(startDate, 'dd/MM/yyyy')} a {format(endDate, 'dd/MM/yyyy')}</p>
              <p>• <strong>Loja:</strong> {selectedStore?.name || 'Todas'}</p>
              <p>• <strong>Revendedor:</strong> {selectedReseller?.full_name || 'Todos'}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancelar
            </Button>
            <Button onClick={handleExport} disabled={isExporting} className="flex-1">
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Exportando...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Exportar Excel
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
