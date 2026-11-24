import { useState, useMemo, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ArrowLeftRight,
  ArrowUpRight,
  ArrowDownLeft,
  Plus,
  Search,
  Building2,
  Store,
  Bike,
  CheckCircle2,
  Clock,
  Copy,
  Check,
  RotateCcw,
  Tag,
  DollarSign,
  Truck,
  Filter,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  StockExchangeRecord,
  getStockExchangeRecords,
  saveStockExchangeRecords,
  type ExchangeDirection,
} from '@/lib/stockTransfersManager';
import { ExternalStoreMotoEntryDialog } from './ExternalStoreMotoEntryDialog';
import { StockTransferDialog } from '@/components/vehicles/StockTransferDialog';
import { cn } from '@/lib/utils';

export function ExecutiveStockExchangePanel() {
  const { toast } = useToast();

  const [records, setRecords] = useState<StockExchangeRecord[]>([]);
  const [filterDirection, setFilterDirection] = useState<'all' | 'saida' | 'entrada' | 'sem_app'>('all');
  const [selectedStore, setSelectedStore] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [copiedChassis, setCopiedChassis] = useState<string | null>(null);

  // Modais
  const [externalEntryOpen, setExternalEntryOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);

  const loadData = () => {
    const list = getStockExchangeRecords();
    setRecords(list);
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('dealflow:vehicle-status-updated', handleUpdate);
    window.addEventListener('dealflow:sales-updated', handleUpdate);
    return () => {
      window.removeEventListener('dealflow:vehicle-status-updated', handleUpdate);
      window.removeEventListener('dealflow:sales-updated', handleUpdate);
    };
  }, []);

  const handleCopyChassis = (chassis: string) => {
    navigator.clipboard.writeText(chassis);
    setCopiedChassis(chassis);
    toast({
      title: 'Chassi Copiado!',
      description: `${chassis} copiado para a área de transferência.`,
    });
    setTimeout(() => setCopiedChassis(null), 2000);
  };

  const handleConfirmArrival = (recordId: string) => {
    const updated = records.map((r) =>
      r.id === recordId ? { ...r, status: 'concluida' as const } : r
    );
    saveStockExchangeRecords(updated);
    setRecords(updated);
    toast({
      title: 'Recebimento Confirmado!',
      description: 'A motocicleta foi confirmada e está disponível no pátio.',
    });
  };

  // Métricas
  const stats = useMemo(() => {
    const total = records.length;
    const saidas = records.filter((r) => r.direction === 'saida').length;
    const entradas = records.filter((r) => r.direction === 'entrada').length;
    const semApp = records.filter((r) => r.is_external_store).length;
    const valorTotal = records.reduce((acc, r) => acc + (Number(r.agreed_amount) || 0), 0);

    return { total, saidas, entradas, semApp, valorTotal };
  }, [records]);

  // Lista Filtrada
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      // Filtro de Direção
      if (filterDirection === 'saida' && r.direction !== 'saida') return false;
      if (filterDirection === 'entrada' && r.direction !== 'entrada') return false;
      if (filterDirection === 'sem_app' && !r.is_external_store) return false;

      // Filtro de Loja
      if (selectedStore !== 'all') {
        const matchesOrigin = r.from_store_id === selectedStore || r.from_store_name?.includes(selectedStore);
        const matchesDest = r.to_store_id === selectedStore || r.to_store_name?.includes(selectedStore);
        if (!matchesOrigin && !matchesDest) return false;
      }

      // Busca
      if (searchTerm.trim()) {
        const s = searchTerm.toLowerCase();
        const matchChassis = r.chassis?.toLowerCase().includes(s);
        const matchModel = r.model?.toLowerCase().includes(s);
        const matchFrom = r.from_store_name?.toLowerCase().includes(s);
        const matchTo = r.to_store_name?.toLowerCase().includes(s);
        const matchExt = r.external_store_name?.toLowerCase().includes(s);
        const matchNf = r.invoice_number?.toLowerCase().includes(s);
        return matchChassis || matchModel || matchFrom || matchTo || matchExt || matchNf;
      }

      return true;
    });
  }, [records, filterDirection, selectedStore, searchTerm]);

  return (
    <div className="space-y-6">
      {/* HEADER EXECUTIVO */}
      <Card className="border-border/70 bg-gradient-to-r from-card to-muted/20 shadow-xs">
        <CardHeader className="p-4 sm:p-6 pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center shrink-0 text-emerald-600 dark:text-emerald-400 shadow-xs">
                <ArrowLeftRight className="w-6 h-6" />
              </div>
              <div>
                <CardTitle className="text-base sm:text-lg font-bold font-display text-foreground flex items-center gap-2">
                  Controle de Troca de Estoque &amp; Transferências Interlojas
                  <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                    Diretoria
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Acompanhamento executivo de motos remetidas para cada filial, motos que chegam de outras lojas e módulo de entrada de motos vindas de lojas parceiras sem o app.
                </CardDescription>
              </div>
            </div>

          </div>
        </CardHeader>
      </Card>

      {/* BANNER: EM PRODUÇÃO */}
      <div className="rounded-2xl border border-dashed border-amber-400/50 bg-amber-50/40 dark:bg-amber-950/20 p-8 flex flex-col items-center justify-center gap-4 text-center min-h-[320px]">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-400/30 flex items-center justify-center text-amber-500">
          <Truck className="w-8 h-8" />
        </div>
        <div className="space-y-1.5 max-w-md">
          <h3 className="text-base font-black text-foreground tracking-tight">
            Módulo em Desenvolvimento
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            O controle de <strong className="text-foreground">Troca de Estoque & Transferências Interlojas</strong> está sendo desenvolvido e será disponibilizado em breve. As movimentações já estão sendo registradas e estarão disponíveis quando o módulo for ativado.
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-400/30">
          <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">Em Produção • Em Breve</span>
        </div>
      </div>
    </div>
  );
}
