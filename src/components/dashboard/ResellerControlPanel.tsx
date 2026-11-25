import { useMemo, useState } from 'react';
import {
  Store,
  Package,
  CheckCircle2,
  Clock,
  Landmark,
  Send,
  Plus,
  Trash2,
  UserPlus,
  Search,
  DollarSign,
  Wallet,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useStores } from '@/hooks/useStores';
import { useVehicles } from '@/hooks/useVehicles';
import {
  useResellerControl,
  type ResellerStockItem,
  type ResellerFinancing,
  type ResellerPayment,
} from '@/hooks/useResellerControl';
import { cn } from '@/lib/utils';

const fmtBRL = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val) || 0);

const fmtDate = (d?: string | null) => {
  if (!d) return '—';
  const parts = d.slice(0, 10).split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return d;
};

const PAYMENT_STATUS_META: Record<ResellerStockItem['payment_status'], { label: string; cls: string }> = {
  pago: { label: 'Pago', cls: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' },
  parcial: { label: 'Parcial', cls: 'bg-amber-500/10 text-amber-600 border-amber-500/30' },
  pendente: { label: 'Em Aberto', cls: 'bg-rose-500/10 text-rose-600 border-rose-500/30' },
};

const STOCK_STATUS_META: Record<ResellerStockItem['stock_status'], { label: string; cls: string }> = {
  em_estoque: { label: 'Em Estoque', cls: 'bg-blue-500/10 text-blue-600 border-blue-500/30' },
  vendido: { label: 'Vendido', cls: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' },
  devolvido: { label: 'Devolvido', cls: 'bg-muted text-muted-foreground border-border' },
};

const FIN_STATUS_META: Record<ResellerFinancing['status'], { label: string; cls: string }> = {
  em_analise: { label: 'Em Análise', cls: 'bg-amber-500/10 text-amber-600 border-amber-500/30' },
  aprovado: { label: 'Aprovado', cls: 'bg-blue-500/10 text-blue-600 border-blue-500/30' },
  liberado: { label: 'Liberado', cls: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' },
  quitado: { label: 'Quitado', cls: 'bg-emerald-600/15 text-emerald-700 border-emerald-600/30' },
  recusado: { label: 'Recusado', cls: 'bg-rose-500/10 text-rose-600 border-rose-500/30' },
};

const PAY_TYPE_LABELS: Record<ResellerPayment['payment_type'], string> = {
  pagamento_estoque: 'Pagamento de Estoque',
  repasse_financiamento: 'Repasse de Financiamento',
  comissao: 'Comissão',
  adiantamento: 'Adiantamento',
  outro: 'Outro',
};

const PAY_METHOD_LABELS: Record<ResellerPayment['payment_method'], string> = {
  pix: 'PIX',
  transferencia: 'Transferência (TED/DOC)',
  dinheiro: 'Dinheiro',
  boleto: 'Boleto',
  cartao: 'Cartão',
  outro: 'Outro',
};

export function ResellerControlPanel() {
  const { toast } = useToast();
  const { data: stores = [] } = useStores();
  const { data: allVehicles = [] } = useVehicles();
  const {
    resellers,
    stockItems,
    financings,
    payments,
    isLoading,
    createReseller,
    createStockItem,
    updateStockItem,
    deleteStockItem,
    createFinancing,
    updateFinancingStatus,
    deleteFinancing,
    createPayment,
    deletePayment,
  } = useResellerControl();

  const [selectedResellerId, setSelectedResellerId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [subTab, setSubTab] = useState<'estoque' | 'financiamentos' | 'pagamentos'>('estoque');

  // Modais
  const [newResellerOpen, setNewResellerOpen] = useState(false);
  const [newStockOpen, setNewStockOpen] = useState(false);
  const [newFinOpen, setNewFinOpen] = useState(false);
  const [newPayOpen, setNewPayOpen] = useState(false);
  const [editingStockPayment, setEditingStockPayment] = useState<ResellerStockItem | null>(null);
  const [editPaidValue, setEditPaidValue] = useState('');

  // Form states — Novo Revendedor
  const [resForm, setResForm] = useState({ full_name: '', phone: '', cpf: '', email: '', store_id: '' });

  // Form states — Novo Item de Estoque
  const [stockForm, setStockForm] = useState({
    reseller_id: '',
    vehicle_id: 'manual',
    vehicle_model: '',
    chassis: '',
    color: '',
    year: String(new Date().getFullYear()),
    total_value: '',
    paid_amount: '0',
    entry_date: new Date().toISOString().slice(0, 10),
    notes: '',
  });

  // Form states — Novo Financiamento
  const [finForm, setFinForm] = useState({
    reseller_id: '',
    client_name: '',
    vehicle_model: '',
    chassis: '',
    bank_name: 'PAN',
    financed_amount: '',
    down_payment: '0',
    installments: '48',
    status: 'em_analise' as ResellerFinancing['status'],
    financing_date: new Date().toISOString().slice(0, 10),
    notes: '',
  });

  // Form states — Novo Pagamento Enviado
  const [payForm, setPayForm] = useState({
    reseller_id: '',
    stock_item_id: 'none',
    payment_type: 'pagamento_estoque' as ResellerPayment['payment_type'],
    payment_method: 'pix' as ResellerPayment['payment_method'],
    amount: '',
    payment_date: new Date().toISOString().slice(0, 10),
    reference_code: '',
    description: '',
  });

  const resellerMap = useMemo(() => {
    const m = new Map<string, string>();
    resellers.forEach((r) => m.set(r.id, r.full_name));
    return m;
  }, [resellers]);

  const filteredStock = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return stockItems.filter((item) => {
      if (selectedResellerId !== 'all' && item.reseller_id !== selectedResellerId) return false;
      if (q) {
        const hay = `${item.vehicle_model} ${item.chassis || ''} ${resellerMap.get(item.reseller_id) || ''} ${item.notes || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [stockItems, selectedResellerId, searchTerm, resellerMap]);

  const filteredFinancings = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return financings.filter((item) => {
      if (selectedResellerId !== 'all' && item.reseller_id !== selectedResellerId) return false;
      if (q) {
        const hay = `${item.client_name} ${item.vehicle_model} ${item.chassis || ''} ${item.bank_name} ${resellerMap.get(item.reseller_id) || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [financings, selectedResellerId, searchTerm, resellerMap]);

  const filteredPayments = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return payments.filter((item) => {
      if (selectedResellerId !== 'all' && item.reseller_id !== selectedResellerId) return false;
      if (q) {
        const hay = `${item.reference_code || ''} ${item.description || ''} ${PAY_TYPE_LABELS[item.payment_type]} ${resellerMap.get(item.reseller_id) || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [payments, selectedResellerId, searchTerm, resellerMap]);

  // KPIs consolidados
  const kpis = useMemo(() => {
    const activeStock = filteredStock.filter((s) => s.stock_status === 'em_estoque');
    const totalStockUnits = activeStock.length;
    const totalStockValue = filteredStock
      .filter((s) => s.stock_status !== 'devolvido')
      .reduce((acc, s) => acc + s.total_value, 0);
    const totalStockPaid = filteredStock
      .filter((s) => s.stock_status !== 'devolvido')
      .reduce((acc, s) => acc + s.paid_amount, 0);
    const totalStockOpen = Math.max(0, totalStockValue - totalStockPaid);
    const paidPct = totalStockValue > 0 ? Math.min(100, (totalStockPaid / totalStockValue) * 100) : 0;

    const activeFin = filteredFinancings.filter((f) => f.status !== 'recusado');
    const totalFinAmount = activeFin.reduce((acc, f) => acc + f.financed_amount, 0);
    const releasedFinAmount = activeFin
      .filter((f) => f.status === 'liberado' || f.status === 'quitado')
      .reduce((acc, f) => acc + f.financed_amount, 0);

    const totalPaymentsSent = filteredPayments.reduce((acc, p) => acc + p.amount, 0);

    return {
      totalStockUnits,
      totalStockValue,
      totalStockPaid,
      totalStockOpen,
      paidPct,
      totalFinCount: activeFin.length,
      totalFinAmount,
      releasedFinAmount,
      totalPaymentsSent,
      totalPaymentsCount: filteredPayments.length,
    };
  }, [filteredStock, filteredFinancings, filteredPayments]);

  // Resumo por revendedor
  const resellerSummaries = useMemo(() => {
    return resellers
      .map((r) => {
        const rStock = stockItems.filter((s) => s.reseller_id === r.id && s.stock_status !== 'devolvido');
        const inStockCount = rStock.filter((s) => s.stock_status === 'em_estoque').length;
        const stockVal = rStock.reduce((a, b) => a + b.total_value, 0);
        const stockPaid = rStock.reduce((a, b) => a + b.paid_amount, 0);
        const stockOpen = Math.max(0, stockVal - stockPaid);

        const rFin = financings.filter((f) => f.reseller_id === r.id && f.status !== 'recusado');
        const finTotal = rFin.reduce((a, b) => a + b.financed_amount, 0);

        const rPay = payments.filter((p) => p.reseller_id === r.id);
        const payTotal = rPay.reduce((a, b) => a + b.amount, 0);

        const hasActivity = rStock.length > 0 || rFin.length > 0 || rPay.length > 0 || r.partner_type === 'revendedor';
        return {
          reseller: r,
          inStockCount,
          totalItems: rStock.length,
          stockVal,
          stockPaid,
          stockOpen,
          finCount: rFin.length,
          finTotal,
          payTotal,
          hasActivity,
        };
      })
      .filter((s) => s.hasActivity || s.reseller.is_active)
      .sort((a, b) => b.stockVal + b.finTotal + b.payTotal - (a.stockVal + a.finTotal + a.payTotal));
  }, [resellers, stockItems, financings, payments]);

  const handleCreateReseller = async () => {
    if (!resForm.full_name.trim()) {
      toast({ variant: 'destructive', title: 'Informe o nome do revendedor' });
      return;
    }
    try {
      await createReseller.mutateAsync({
        full_name: resForm.full_name,
        phone: resForm.phone,
        cpf: resForm.cpf,
        email: resForm.email,
        store_id: resForm.store_id && resForm.store_id !== 'none' ? resForm.store_id : null,
      });
      toast({ title: 'Revendedor cadastrado com sucesso!' });
      setResForm({ full_name: '', phone: '', cpf: '', email: '', store_id: '' });
      setNewResellerOpen(false);
    } catch (e: any) {
      const raw = String(e?.message || '');
      const friendly = raw.includes('resellers_cpf_key')
        ? 'Já existe um revendedor com este CPF/CNPJ.'
        : raw.toLowerCase().includes('row-level security')
          ? 'Sem permissão para cadastrar revendedores com este usuário.'
          : raw.includes('resellers_partner_type_check')
            ? 'Tipo de parceiro inválido.'
            : raw;
      toast({ variant: 'destructive', title: 'Erro ao cadastrar revendedor', description: friendly });
    }
  };

  const handleCreateStock = async () => {
    const rId = stockForm.reseller_id || (selectedResellerId !== 'all' ? selectedResellerId : '');
    if (!rId || !stockForm.vehicle_model.trim()) {
      toast({ variant: 'destructive', title: 'Selecione o revendedor e informe o modelo da moto' });
      return;
    }
    try {
      await createStockItem.mutateAsync({
        reseller_id: rId,
        vehicle_id: stockForm.vehicle_id !== 'manual' ? stockForm.vehicle_id : null,
        vehicle_model: stockForm.vehicle_model,
        chassis: stockForm.chassis,
        color: stockForm.color,
        year: stockForm.year ? parseInt(stockForm.year, 10) : null,
        total_value: Number(stockForm.total_value.replace(',', '.')) || 0,
        paid_amount: Number(stockForm.paid_amount.replace(',', '.')) || 0,
        entry_date: stockForm.entry_date,
        notes: stockForm.notes,
      });
      toast({ title: 'Moto adicionada ao estoque do revendedor!' });
      setStockForm({
        reseller_id: rId,
        vehicle_id: 'manual',
        vehicle_model: '',
        chassis: '',
        color: '',
        year: String(new Date().getFullYear()),
        total_value: '',
        paid_amount: '0',
        entry_date: new Date().toISOString().slice(0, 10),
        notes: '',
      });
      setNewStockOpen(false);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao adicionar estoque', description: e?.message });
    }
  };

  const handleCreateFinancing = async () => {
    const rId = finForm.reseller_id || (selectedResellerId !== 'all' ? selectedResellerId : '');
    if (!rId || !finForm.client_name.trim() || !finForm.vehicle_model.trim()) {
      toast({ variant: 'destructive', title: 'Preencha revendedor, cliente e modelo' });
      return;
    }
    try {
      await createFinancing.mutateAsync({
        reseller_id: rId,
        client_name: finForm.client_name,
        vehicle_model: finForm.vehicle_model,
        chassis: finForm.chassis,
        bank_name: finForm.bank_name || 'BANCO',
        financed_amount: Number(finForm.financed_amount.replace(',', '.')) || 0,
        down_payment: Number(finForm.down_payment.replace(',', '.')) || 0,
        installments: parseInt(finForm.installments, 10) || 48,
        status: finForm.status,
        financing_date: finForm.financing_date,
        notes: finForm.notes,
      });
      toast({ title: 'Financiamento do revendedor registrado!' });
      setFinForm({
        reseller_id: rId,
        client_name: '',
        vehicle_model: '',
        chassis: '',
        bank_name: 'PAN',
        financed_amount: '',
        down_payment: '0',
        installments: '48',
        status: 'em_analise',
        financing_date: new Date().toISOString().slice(0, 10),
        notes: '',
      });
      setNewFinOpen(false);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao registrar financiamento', description: e?.message });
    }
  };

  const handleCreatePayment = async () => {
    const rId = payForm.reseller_id || (selectedResellerId !== 'all' ? selectedResellerId : '');
    const amountNum = Number(payForm.amount.replace(',', '.')) || 0;
    if (!rId || amountNum <= 0) {
      toast({ variant: 'destructive', title: 'Selecione o revendedor e informe um valor válido' });
      return;
    }
    try {
      await createPayment.mutateAsync({
        reseller_id: rId,
        stock_item_id: payForm.stock_item_id !== 'none' ? payForm.stock_item_id : null,
        payment_type: payForm.payment_type,
        payment_method: payForm.payment_method,
        amount: amountNum,
        payment_date: payForm.payment_date,
        reference_code: payForm.reference_code,
        description: payForm.description,
      });
      toast({
        title: 'Pagamento enviado registrado!',
        description: payForm.stock_item_id !== 'none'
          ? 'O valor pago da moto vinculada foi atualizado automaticamente.'
          : undefined,
      });
      setPayForm({
        reseller_id: rId,
        stock_item_id: 'none',
        payment_type: 'pagamento_estoque',
        payment_method: 'pix',
        amount: '',
        payment_date: new Date().toISOString().slice(0, 10),
        reference_code: '',
        description: '',
      });
      setNewPayOpen(false);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao registrar pagamento', description: e?.message });
    }
  };

  const handleSaveEditedPaid = async () => {
    if (!editingStockPayment) return;
    const val = Number(editPaidValue.replace(',', '.')) || 0;
    try {
      await updateStockItem.mutateAsync({ id: editingStockPayment.id, paid_amount: val });
      toast({ title: 'Pagamento do estoque atualizado!' });
      setEditingStockPayment(null);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao atualizar', description: e?.message });
    }
  };

  const stockOptionsForPayment = useMemo(() => {
    const targetReseller = payForm.reseller_id || (selectedResellerId !== 'all' ? selectedResellerId : '');
    return stockItems.filter(
      (s) => (!targetReseller || s.reseller_id === targetReseller) && s.payment_status !== 'pago' && s.stock_status !== 'devolvido'
    );
  }, [stockItems, payForm.reseller_id, selectedResellerId]);

  return (
    <div className="space-y-6">
      {/* Cabeçalho e Filtros */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-display font-bold text-foreground flex items-center gap-2">
            <Store className="w-5 h-5 text-primary" />
            Controle de Revendedores
          </h2>
          <p className="text-xs text-muted-foreground">
            Estoque alocado, valor pago vs. em aberto, financiamentos e pagamentos enviados aos revendedores.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-52">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar modelo, chassi, banco..."
              className="h-9 pl-8 text-xs"
            />
          </div>

          <Select value={selectedResellerId} onValueChange={setSelectedResellerId}>
            <SelectTrigger className="h-9 w-full sm:w-52 text-xs font-medium">
              <SelectValue placeholder="Todos os Revendedores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Revendedores</SelectItem>
              {resellers.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button size="sm" variant="outline" onClick={() => setNewResellerOpen(true)} className="h-9 text-xs gap-1.5">
            <UserPlus className="w-3.5 h-3.5" />
            Novo Revendedor
          </Button>
        </div>
      </div>

      {/* KPIs Consolidados */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
        <Card className="border-border/60">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Em Estoque nos Revendedores</span>
              <Package className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-xl font-display font-bold text-foreground">{fmtBRL(kpis.totalStockValue)}</p>
            <p className="text-[11px] text-muted-foreground">
              <strong>{kpis.totalStockUnits}</strong> moto(s) ativa(s) em pátio de revendedores
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Estoque Pago vs. Em Aberto</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-xl font-display font-bold text-emerald-600">{fmtBRL(kpis.totalStockPaid)}</p>
              <span className="text-[11px] font-semibold text-muted-foreground">{kpis.paidPct.toFixed(0)}% pago</span>
            </div>
            <Progress value={kpis.paidPct} className="h-1.5" />
            <p className="text-[11px] text-rose-600 font-medium">
              Em aberto: {fmtBRL(kpis.totalStockOpen)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Financiamentos de Revendedores</span>
              <Landmark className="w-4 h-4 text-indigo-500" />
            </div>
            <p className="text-xl font-display font-bold text-foreground">{fmtBRL(kpis.totalFinAmount)}</p>
            <p className="text-[11px] text-muted-foreground">
              <strong>{kpis.totalFinCount}</strong> contrato(s) · Liberado: <strong className="text-emerald-600">{fmtBRL(kpis.releasedFinAmount)}</strong>
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Pagamentos Enviados</span>
              <Send className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-xl font-display font-bold text-foreground">{fmtBRL(kpis.totalPaymentsSent)}</p>
            <p className="text-[11px] text-muted-foreground">
              <strong>{kpis.totalPaymentsCount}</strong> repasse(s) registrado(s)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Resumo por Revendedor */}
      {resellerSummaries.length > 0 && (
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Resumo Consolidado por Revendedor</CardTitle>
            <CardDescription className="text-xs">Clique em um revendedor para filtrar estoque, financiamentos e pagamentos</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Revendedor</TableHead>
                    <TableHead className="text-xs text-center">Em Estoque</TableHead>
                    <TableHead className="text-xs text-right">Total Estoque</TableHead>
                    <TableHead className="text-xs text-right">Pago</TableHead>
                    <TableHead className="text-xs text-right">Em Aberto</TableHead>
                    <TableHead className="text-xs text-right">Financiamentos</TableHead>
                    <TableHead className="text-xs text-right">Pagamentos Enviados</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resellerSummaries.map((row) => {
                    const isSelected = selectedResellerId === row.reseller.id;
                    return (
                      <TableRow
                        key={row.reseller.id}
                        onClick={() => setSelectedResellerId(isSelected ? 'all' : row.reseller.id)}
                        className={cn(
                          'cursor-pointer transition-colors',
                          isSelected ? 'bg-primary/10 hover:bg-primary/15' : 'hover:bg-muted/40'
                        )}
                      >
                        <TableCell className="py-2.5 text-xs font-semibold">
                          <div className="flex items-center gap-2">
                            <span>{row.reseller.full_name}</span>
                            {isSelected && <Badge variant="default" className="text-[10px] py-0">Filtrado</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="py-2.5 text-xs text-center font-medium">{row.inStockCount} un.</TableCell>
                        <TableCell className="py-2.5 text-xs text-right font-medium">{fmtBRL(row.stockVal)}</TableCell>
                        <TableCell className="py-2.5 text-xs text-right font-semibold text-emerald-600">{fmtBRL(row.stockPaid)}</TableCell>
                        <TableCell className="py-2.5 text-xs text-right font-semibold text-rose-600">{fmtBRL(row.stockOpen)}</TableCell>
                        <TableCell className="py-2.5 text-xs text-right">
                          {fmtBRL(row.finTotal)} <span className="text-muted-foreground">({row.finCount})</span>
                        </TableCell>
                        <TableCell className="py-2.5 text-xs text-right font-semibold text-amber-600">{fmtBRL(row.payTotal)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sub-abas operacionais */}
      <Tabs value={subTab} onValueChange={(v: any) => setSubTab(v)} className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <TabsList className="h-9">
            <TabsTrigger value="estoque" className="text-xs gap-1.5">
              <Package className="w-3.5 h-3.5" />
              Estoque & Pagamento ({filteredStock.length})
            </TabsTrigger>
            <TabsTrigger value="financiamentos" className="text-xs gap-1.5">
              <Landmark className="w-3.5 h-3.5" />
              Financiamentos ({filteredFinancings.length})
            </TabsTrigger>
            <TabsTrigger value="pagamentos" className="text-xs gap-1.5">
              <Send className="w-3.5 h-3.5" />
              Pagamentos Enviados ({filteredPayments.length})
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            {subTab === 'estoque' && (
              <Button
                size="sm"
                onClick={() => {
                  setStockForm((p) => ({ ...p, reseller_id: selectedResellerId !== 'all' ? selectedResellerId : p.reseller_id }));
                  setNewStockOpen(true);
                }}
                className="h-9 text-xs gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar Moto ao Estoque
              </Button>
            )}
            {subTab === 'financiamentos' && (
              <Button
                size="sm"
                onClick={() => {
                  setFinForm((p) => ({ ...p, reseller_id: selectedResellerId !== 'all' ? selectedResellerId : p.reseller_id }));
                  setNewFinOpen(true);
                }}
                className="h-9 text-xs gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Novo Financiamento
              </Button>
            )}
            {subTab === 'pagamentos' && (
              <Button
                size="sm"
                onClick={() => {
                  setPayForm((p) => ({ ...p, reseller_id: selectedResellerId !== 'all' ? selectedResellerId : p.reseller_id }));
                  setNewPayOpen(true);
                }}
                className="h-9 text-xs gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Registrar Pagamento Enviado
              </Button>
            )}
          </div>
        </div>

        {/* SUB-ABA 1: ESTOQUE & PAGAMENTO */}
        <TabsContent value="estoque" className="mt-0">
          <Card className="border-border/60">
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-8 text-center text-xs text-muted-foreground">Carregando estoque dos revendedores...</div>
              ) : filteredStock.length === 0 ? (
                <div className="p-10 text-center space-y-2">
                  <Package className="w-8 h-8 text-muted-foreground/40 mx-auto" />
                  <p className="text-sm font-medium text-foreground">Nenhuma moto registrada no estoque de revendedores</p>
                  <p className="text-xs text-muted-foreground">Clique em "Adicionar Moto ao Estoque" para começar o controle real.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Entrada</TableHead>
                        <TableHead className="text-xs">Revendedor</TableHead>
                        <TableHead className="text-xs">Moto / Chassi</TableHead>
                        <TableHead className="text-xs text-right">Valor Total</TableHead>
                        <TableHead className="text-xs text-right">Valor Pago</TableHead>
                        <TableHead className="text-xs text-right">Saldo Aberto</TableHead>
                        <TableHead className="text-xs">Pgto</TableHead>
                        <TableHead className="text-xs">Situação</TableHead>
                        <TableHead className="text-xs text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStock.map((item) => {
                        const openVal = Math.max(0, item.total_value - item.paid_amount);
                        const payMeta = PAYMENT_STATUS_META[item.payment_status];
                        const stMeta = STOCK_STATUS_META[item.stock_status];
                        return (
                          <TableRow key={item.id}>
                            <TableCell className="text-xs text-muted-foreground">{fmtDate(item.entry_date)}</TableCell>
                            <TableCell className="text-xs font-semibold">{resellerMap.get(item.reseller_id) || '—'}</TableCell>
                            <TableCell className="text-xs">
                              <div className="font-medium text-foreground">{item.vehicle_model}</div>
                              {item.chassis && <div className="text-[11px] font-mono text-muted-foreground">{item.chassis}</div>}
                            </TableCell>
                            <TableCell className="text-xs text-right font-medium">{fmtBRL(item.total_value)}</TableCell>
                            <TableCell className="text-xs text-right font-semibold text-emerald-600">{fmtBRL(item.paid_amount)}</TableCell>
                            <TableCell className="text-xs text-right font-semibold text-rose-600">{fmtBRL(openVal)}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={cn('text-[10px]', payMeta.cls)}>{payMeta.label}</Badge>
                            </TableCell>
                            <TableCell>
                              <Select
                                value={item.stock_status}
                                onValueChange={(val: any) => updateStockItem.mutate({ id: item.id, stock_status: val })}
                              >
                                <SelectTrigger className="h-7 w-28 text-[11px]">
                                  <Badge variant="outline" className={cn('text-[10px] border-0 px-0', stMeta.cls)}>{stMeta.label}</Badge>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="em_estoque">Em Estoque</SelectItem>
                                  <SelectItem value="vendido">Vendido</SelectItem>
                                  <SelectItem value="devolvido">Devolvido</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-[11px]"
                                  onClick={() => {
                                    setEditingStockPayment(item);
                                    setEditPaidValue(String(item.paid_amount || 0));
                                  }}
                                >
                                  <DollarSign className="w-3 h-3 mr-1" />
                                  Pago
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                  onClick={() => deleteStockItem.mutate(item.id)}
                                  title="Remover item"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* SUB-ABA 2: FINANCIAMENTOS */}
        <TabsContent value="financiamentos" className="mt-0">
          <Card className="border-border/60">
            <CardContent className="p-0">
              {filteredFinancings.length === 0 ? (
                <div className="p-10 text-center space-y-2">
                  <Landmark className="w-8 h-8 text-muted-foreground/40 mx-auto" />
                  <p className="text-sm font-medium text-foreground">Nenhum financiamento de revendedor registrado</p>
                  <p className="text-xs text-muted-foreground">Clique em "Novo Financiamento" para acompanhar aprovações e liberações.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Data</TableHead>
                        <TableHead className="text-xs">Revendedor</TableHead>
                        <TableHead className="text-xs">Cliente</TableHead>
                        <TableHead className="text-xs">Moto / Chassi</TableHead>
                        <TableHead className="text-xs">Banco</TableHead>
                        <TableHead className="text-xs text-right">Financiado</TableHead>
                        <TableHead className="text-xs text-right">Entrada</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredFinancings.map((fin) => {
                        const fMeta = FIN_STATUS_META[fin.status];
                        return (
                          <TableRow key={fin.id}>
                            <TableCell className="text-xs text-muted-foreground">{fmtDate(fin.financing_date)}</TableCell>
                            <TableCell className="text-xs font-semibold">{resellerMap.get(fin.reseller_id) || '—'}</TableCell>
                            <TableCell className="text-xs font-medium">{fin.client_name}</TableCell>
                            <TableCell className="text-xs">
                              <div>{fin.vehicle_model}</div>
                              {fin.chassis && <div className="text-[11px] font-mono text-muted-foreground">{fin.chassis}</div>}
                            </TableCell>
                            <TableCell className="text-xs font-medium">
                              {fin.bank_name} {fin.installments ? <span className="text-muted-foreground">({fin.installments}x)</span> : ''}
                            </TableCell>
                            <TableCell className="text-xs text-right font-semibold">{fmtBRL(fin.financed_amount)}</TableCell>
                            <TableCell className="text-xs text-right text-muted-foreground">{fmtBRL(fin.down_payment)}</TableCell>
                            <TableCell>
                              <Select
                                value={fin.status}
                                onValueChange={(val: any) => updateFinancingStatus.mutate({ id: fin.id, status: val })}
                              >
                                <SelectTrigger className="h-7 w-28 text-[11px]">
                                  <Badge variant="outline" className={cn('text-[10px] border-0 px-0', fMeta.cls)}>{fMeta.label}</Badge>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="em_analise">Em Análise</SelectItem>
                                  <SelectItem value="aprovado">Aprovado</SelectItem>
                                  <SelectItem value="liberado">Liberado</SelectItem>
                                  <SelectItem value="quitado">Quitado</SelectItem>
                                  <SelectItem value="recusado">Recusado</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={() => deleteFinancing.mutate(fin.id)}
                                title="Remover financiamento"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* SUB-ABA 3: PAGAMENTOS ENVIADOS */}
        <TabsContent value="pagamentos" className="mt-0">
          <Card className="border-border/60">
            <CardContent className="p-0">
              {filteredPayments.length === 0 ? (
                <div className="p-10 text-center space-y-2">
                  <Wallet className="w-8 h-8 text-muted-foreground/40 mx-auto" />
                  <p className="text-sm font-medium text-foreground">Nenhum pagamento enviado registrado</p>
                  <p className="text-xs text-muted-foreground">Clique em "Registrar Pagamento Enviado" para controlar PIX, repasses e quitações.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Data</TableHead>
                        <TableHead className="text-xs">Revendedor</TableHead>
                        <TableHead className="text-xs">Tipo</TableHead>
                        <TableHead className="text-xs">Forma</TableHead>
                        <TableHead className="text-xs">Referência / Observação</TableHead>
                        <TableHead className="text-xs text-right">Valor Enviado</TableHead>
                        <TableHead className="text-xs text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPayments.map((pay) => (
                        <TableRow key={pay.id}>
                          <TableCell className="text-xs text-muted-foreground">{fmtDate(pay.payment_date)}</TableCell>
                          <TableCell className="text-xs font-semibold">{resellerMap.get(pay.reseller_id) || '—'}</TableCell>
                          <TableCell className="text-xs">
                            <Badge variant="outline" className="text-[10px]">{PAY_TYPE_LABELS[pay.payment_type]}</Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{PAY_METHOD_LABELS[pay.payment_method]}</TableCell>
                          <TableCell className="text-xs">
                            {pay.reference_code && <div className="font-mono text-[11px]">{pay.reference_code}</div>}
                            {pay.description && <div className="text-muted-foreground text-[11px]">{pay.description}</div>}
                            {!pay.reference_code && !pay.description && '—'}
                          </TableCell>
                          <TableCell className="text-xs text-right font-bold text-emerald-600">{fmtBRL(pay.amount)}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => deletePayment.mutate(pay.id)}
                              title="Remover pagamento"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* MODAL: NOVO REVENDEDOR */}
      <Dialog open={newResellerOpen} onOpenChange={setNewResellerOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-primary" />
              Cadastrar Revendedor
            </DialogTitle>
            <DialogDescription>Cadastre um parceiro/revendedor para controlar estoque, financiamentos e pagamentos.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Nome / Razão Social *</Label>
              <Input value={resForm.full_name} onChange={(e) => setResForm({ ...resForm, full_name: e.target.value })} placeholder="Ex: Moto Center Parceiro" className="h-9" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Telefone / WhatsApp</Label>
                <Input value={resForm.phone} onChange={(e) => setResForm({ ...resForm, phone: e.target.value })} placeholder="(38) 99999-0000" className="h-9" />
              </div>
              <div>
                <Label className="text-xs">CPF / CNPJ</Label>
                <Input value={resForm.cpf} onChange={(e) => setResForm({ ...resForm, cpf: e.target.value })} placeholder="Documento" className="h-9" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Loja de Referência (Opcional)</Label>
              <Select value={resForm.store_id} onValueChange={(v) => setResForm({ ...resForm, store_id: v })}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Todas / Nenhuma" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Grupo / Todas</SelectItem>
                  {stores.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewResellerOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateReseller} disabled={createReseller.isPending}>
              {createReseller.isPending ? 'Salvando...' : 'Salvar Revendedor'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: ADICIONAR MOTO AO ESTOQUE DO REVENDEDOR */}
      <Dialog open={newStockOpen} onOpenChange={setNewStockOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" />
              Adicionar Moto ao Estoque do Revendedor
            </DialogTitle>
            <DialogDescription>Informe a moto alocada ao revendedor, o valor total e quanto já foi pago.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Revendedor *</Label>
              <Select value={stockForm.reseller_id} onValueChange={(v) => setStockForm({ ...stockForm, reseller_id: v })}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecionar revendedor" /></SelectTrigger>
                <SelectContent>
                  {resellers.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Vincular a Moto do Estoque (Opcional)</Label>
              <Select
                value={stockForm.vehicle_id}
                onValueChange={(v) => {
                  if (v === 'manual') {
                    setStockForm({ ...stockForm, vehicle_id: 'manual' });
                    return;
                  }
                  const veh = allVehicles.find((x) => x.id === v);
                  setStockForm({
                    ...stockForm,
                    vehicle_id: v,
                    vehicle_model: veh ? `${veh.brand || ''} ${veh.model}`.trim() : stockForm.vehicle_model,
                    chassis: veh?.chassis || stockForm.chassis,
                    color: veh?.color || stockForm.color,
                    year: veh?.year ? String(veh.year) : stockForm.year,
                    total_value: veh?.sale_price ? String(veh.sale_price) : stockForm.total_value,
                  });
                }}
              >
                <SelectTrigger className="h-9"><SelectValue placeholder="Digitar manualmente" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Digitar manualmente</SelectItem>
                  {allVehicles
                    .filter((v) => v.status !== 'vendido')
                    .slice(0, 60)
                    .map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.model} {v.chassis ? `— ${v.chassis}` : ''}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Modelo *</Label>
                <Input value={stockForm.vehicle_model} onChange={(e) => setStockForm({ ...stockForm, vehicle_model: e.target.value })} placeholder="Ex: SHI 175 EFI" className="h-9" />
              </div>
              <div>
                <Label className="text-xs">Chassi</Label>
                <Input value={stockForm.chassis} onChange={(e) => setStockForm({ ...stockForm, chassis: e.target.value })} placeholder="Chassi da moto" className="h-9 font-mono" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Valor Total (R$) *</Label>
                <Input type="number" step="0.01" value={stockForm.total_value} onChange={(e) => setStockForm({ ...stockForm, total_value: e.target.value })} placeholder="18000" className="h-9" />
              </div>
              <div>
                <Label className="text-xs">Valor Já Pago (R$)</Label>
                <Input type="number" step="0.01" value={stockForm.paid_amount} onChange={(e) => setStockForm({ ...stockForm, paid_amount: e.target.value })} placeholder="0" className="h-9" />
              </div>
              <div>
                <Label className="text-xs">Data Entrada</Label>
                <Input type="date" value={stockForm.entry_date} onChange={(e) => setStockForm({ ...stockForm, entry_date: e.target.value })} className="h-9" />
              </div>
            </div>

            <div>
              <Label className="text-xs">Observações</Label>
              <Textarea value={stockForm.notes} onChange={(e) => setStockForm({ ...stockForm, notes: e.target.value })} placeholder="Condições de pagamento, prazo, etc." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewStockOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateStock} disabled={createStockItem.isPending}>
              {createStockItem.isPending ? 'Salvando...' : 'Adicionar ao Estoque'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: EDITAR VALOR PAGO DO ESTOQUE */}
      <Dialog open={Boolean(editingStockPayment)} onOpenChange={(o) => !o && setEditingStockPayment(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Atualizar Valor Pago</DialogTitle>
            <DialogDescription>
              {editingStockPayment?.vehicle_model} {editingStockPayment?.chassis ? `(${editingStockPayment.chassis})` : ''} — Total: {fmtBRL(editingStockPayment?.total_value || 0)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Valor Pago até o momento (R$)</Label>
              <Input type="number" step="0.01" value={editPaidValue} onChange={(e) => setEditPaidValue(e.target.value)} className="h-9" />
            </div>
            {editingStockPayment && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full text-xs text-emerald-600 border-emerald-500/30"
                onClick={() => setEditPaidValue(String(editingStockPayment.total_value))}
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                Quitar 100% ({fmtBRL(editingStockPayment.total_value)})
              </Button>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingStockPayment(null)}>Cancelar</Button>
            <Button onClick={handleSaveEditedPaid} disabled={updateStockItem.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: NOVO FINANCIAMENTO */}
      <Dialog open={newFinOpen} onOpenChange={setNewFinOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Landmark className="w-4 h-4 text-primary" />
              Registrar Financiamento de Revendedor
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Revendedor *</Label>
                <Select value={finForm.reseller_id} onValueChange={(v) => setFinForm({ ...finForm, reseller_id: v })}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {resellers.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Banco *</Label>
                <Input value={finForm.bank_name} onChange={(e) => setFinForm({ ...finForm, bank_name: e.target.value })} placeholder="PAN, SANTANDER, ALTIS..." className="h-9" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Cliente *</Label>
              <Input value={finForm.client_name} onChange={(e) => setFinForm({ ...finForm, client_name: e.target.value })} placeholder="Nome do cliente final" className="h-9" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Modelo da Moto *</Label>
                <Input value={finForm.vehicle_model} onChange={(e) => setFinForm({ ...finForm, vehicle_model: e.target.value })} placeholder="Ex: NEW JET 125" className="h-9" />
              </div>
              <div>
                <Label className="text-xs">Chassi</Label>
                <Input value={finForm.chassis} onChange={(e) => setFinForm({ ...finForm, chassis: e.target.value })} placeholder="Chassi" className="h-9 font-mono" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Valor Financiado (R$) *</Label>
                <Input type="number" step="0.01" value={finForm.financed_amount} onChange={(e) => setFinForm({ ...finForm, financed_amount: e.target.value })} className="h-9" />
              </div>
              <div>
                <Label className="text-xs">Entrada (R$)</Label>
                <Input type="number" step="0.01" value={finForm.down_payment} onChange={(e) => setFinForm({ ...finForm, down_payment: e.target.value })} className="h-9" />
              </div>
              <div>
                <Label className="text-xs">Parcelas</Label>
                <Input type="number" value={finForm.installments} onChange={(e) => setFinForm({ ...finForm, installments: e.target.value })} className="h-9" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={finForm.status} onValueChange={(v: any) => setFinForm({ ...finForm, status: v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="em_analise">Em Análise</SelectItem>
                    <SelectItem value="aprovado">Aprovado</SelectItem>
                    <SelectItem value="liberado">Liberado</SelectItem>
                    <SelectItem value="quitado">Quitado</SelectItem>
                    <SelectItem value="recusado">Recusado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Data</Label>
                <Input type="date" value={finForm.financing_date} onChange={(e) => setFinForm({ ...finForm, financing_date: e.target.value })} className="h-9" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewFinOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateFinancing} disabled={createFinancing.isPending}>
              {createFinancing.isPending ? 'Salvando...' : 'Salvar Financiamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: REGISTRAR PAGAMENTO ENVIADO */}
      <Dialog open={newPayOpen} onOpenChange={setNewPayOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-4 h-4 text-primary" />
              Registrar Pagamento Enviado ao Revendedor
            </DialogTitle>
            <DialogDescription>Se vincular a uma moto do estoque, o valor pago dela será abatido automaticamente.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Revendedor *</Label>
                <Select value={payForm.reseller_id} onValueChange={(v) => setPayForm({ ...payForm, reseller_id: v, stock_item_id: 'none' })}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {resellers.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Valor Enviado (R$) *</Label>
                <Input type="number" step="0.01" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} placeholder="0,00" className="h-9" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Tipo de Pagamento</Label>
                <Select value={payForm.payment_type} onValueChange={(v: any) => setPayForm({ ...payForm, payment_type: v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pagamento_estoque">Pagamento de Estoque</SelectItem>
                    <SelectItem value="repasse_financiamento">Repasse de Financiamento</SelectItem>
                    <SelectItem value="comissao">Comissão</SelectItem>
                    <SelectItem value="adiantamento">Adiantamento</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Forma de Pagamento</Label>
                <Select value={payForm.payment_method} onValueChange={(v: any) => setPayForm({ ...payForm, payment_method: v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="transferencia">Transferência (TED/DOC)</SelectItem>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="boleto">Boleto</SelectItem>
                    <SelectItem value="cartao">Cartão</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs">Vincular a Moto do Estoque (Abate automaticamente o saldo)</Label>
              <Select value={payForm.stock_item_id} onValueChange={(v) => setPayForm({ ...payForm, stock_item_id: v })}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Não vincular" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Não vincular a uma moto específica</SelectItem>
                  {stockOptionsForPayment.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.vehicle_model} {s.chassis ? `(${s.chassis})` : ''} — Falta {fmtBRL(Math.max(0, s.total_value - s.paid_amount))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Data do Pagamento</Label>
                <Input type="date" value={payForm.payment_date} onChange={(e) => setPayForm({ ...payForm, payment_date: e.target.value })} className="h-9" />
              </div>
              <div>
                <Label className="text-xs">Comprovante / Referência</Label>
                <Input value={payForm.reference_code} onChange={(e) => setPayForm({ ...payForm, reference_code: e.target.value })} placeholder="ID PIX, NF, recibo..." className="h-9" />
              </div>
            </div>

            <div>
              <Label className="text-xs">Descrição / Observação</Label>
              <Textarea value={payForm.description} onChange={(e) => setPayForm({ ...payForm, description: e.target.value })} rows={2} placeholder="Detalhes do repasse..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewPayOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreatePayment} disabled={createPayment.isPending}>
              {createPayment.isPending ? 'Registrando...' : 'Registrar Pagamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
