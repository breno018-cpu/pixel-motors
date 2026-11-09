import { useState, useMemo } from 'react';
import { Trash2, Calculator, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useStores } from '@/hooks/useStores';
import { useVehicles } from '@/hooks/useVehicles';
import {
  useBankCredentials, SUPPORTED_BANKS,
} from '@/hooks/useBankCredentials';
import {
  useFinancingSimulations, useRunSimulation, useDeleteSimulation,
} from '@/hooks/useFinancingSimulations';
import { maskCPFCNPJ, maskCurrency, parseCurrency } from '@/lib/masks';
import { useToast } from '@/hooks/use-toast';
import { PageHeader } from '@/components/layout/PageHeader';

const BANK_LABEL: Record<string, string> = Object.fromEntries(
  SUPPORTED_BANKS.map((b) => [b.code, b.name]),
);

const BANK_RATES: Record<string, number> = {
  altis: 1.89,
  motrix: 1.95,
  pan: 2.09,
  bradesco: 1.85,
  santander: 1.92,
  bv: 2.05,
  itau: 1.82,
  omni: 2.25,
  safra: 1.98,
  caixa: 1.69,
};

export default function Financing() {
  const { data: stores = [] } = useStores();
  const { data: vehicles = [] } = useVehicles();
  const { data: creds = [] } = useBankCredentials();
  const { data: sims = [], isLoading } = useFinancingSimulations();
  const runSim = useRunSimulation();
  const delSim = useDeleteSimulation();
  const { toast } = useToast();

  const availableVehicles = useMemo(
    () => vehicles.filter((v) => v.status !== 'vendido'),
    [vehicles],
  );

  // Simulation form with practical defaults
  const [simOpen, setSimOpen] = useState(false);
  const emptySim = {
    store_id: 'store-divinopolis',
    bank_code: 'altis',
    customer_name: '',
    customer_document: '',
    vehicle_value: 23330,
    down_payment: 9332,
    installments: 36,
  };
  const [simForm, setSimForm] = useState<any>(emptySim);

  const banksForStore = useMemo(
    () => creds.filter((c) => c.store_id === simForm.store_id && c.is_active),
    [creds, simForm.store_id],
  );

  // Live Price preview
  const livePreview = useMemo(() => {
    const vVal = Number(simForm.vehicle_value) || 0;
    const down = Number(simForm.down_payment) || 0;
    const financed = Math.max(0, vVal - down);
    const n = Number(simForm.installments) || 36;
    const monthlyRatePct = BANK_RATES[simForm.bank_code] || 1.95;
    const r = monthlyRatePct / 100;
    const pmt =
      financed > 0 && r > 0
        ? (financed * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
        : 0;
    return {
      financed,
      monthlyRatePct,
      pmt,
    };
  }, [simForm.vehicle_value, simForm.down_payment, simForm.installments, simForm.bank_code]);

  const handleSelectVehicle = (vehId: string) => {
    const v = availableVehicles.find((x) => x.id === vehId);
    if (!v) return;
    const price = Number(v.sale_price) || 20000;
    setSimForm({
      ...simForm,
      store_id: v.store_id || simForm.store_id,
      vehicle_value: price,
      down_payment: Math.round(price * 0.35),
    });
  };

  const submitSim = async () => {
    if (!simForm.customer_name?.trim()) {
      toast({ variant: 'destructive', title: 'Informe o nome do cliente para simular.' });
      return;
    }
    if (!simForm.store_id || !simForm.bank_code) {
      toast({ variant: 'destructive', title: 'Selecione a loja e o banco.' });
      return;
    }
    await runSim.mutateAsync({
      ...simForm,
      vehicle_value: Number(simForm.vehicle_value),
      down_payment: Number(simForm.down_payment),
      installments: Number(simForm.installments),
    });
    setSimForm(emptySim);
    setSimOpen(false);
  };

  const statusBadge = (s: string) => {
    if (s === 'aprovada') return <Badge className="bg-success/20 text-success">Aprovada</Badge>;
    if (s === 'recusada') return <Badge variant="destructive">Recusada</Badge>;
    if (s === 'erro') return <Badge variant="destructive">Erro</Badge>;
    return <Badge variant="secondary">Pendente</Badge>;
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4">
      <PageHeader
        title="Financiamentos"
        description="Simulações bancárias e cálculo de parcelas por concessionária."
        actions={
          <Button onClick={() => setSimOpen(true)} className="gap-2">
            <Calculator className="w-4 h-4" /> Nova Simulação
          </Button>
        }
      />

      <div className="space-y-3">
        <Alert>
          <AlertCircle className="w-4 h-4" />
          <AlertDescription className="text-xs">
            As credenciais bancárias por loja são configuradas em <strong>Configurações &rarr; Gestão</strong>.
            Simulações com ALTIS, MOTRIX, Banco Pan, Bradesco e Santander utilizam tabela Price atualizada.
          </AlertDescription>
        </Alert>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Banco</TableHead>
                  <TableHead className="text-right">Veículo</TableHead>
                  <TableHead className="text-right">Entrada</TableHead>
                  <TableHead className="text-right">Parcela</TableHead>
                  <TableHead>Prazo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Carregando…</TableCell></TableRow>
                ) : sims.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-10 text-muted-foreground">Nenhuma simulação realizada</TableCell></TableRow>
                ) : sims.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-xs">{new Date(s.created_at).toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">{s.customer_name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{s.customer_document}</div>
                    </TableCell>
                    <TableCell className="font-medium text-xs">{BANK_LABEL[s.bank_code] || s.bank_code.toUpperCase()}</TableCell>
                    <TableCell className="text-right text-xs">{maskCurrency(String(Math.round((s.vehicle_value || 0) * 100)))}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">{maskCurrency(String(Math.round((s.down_payment || 0) * 100)))}</TableCell>
                    <TableCell className="text-right font-bold text-primary">
                      {s.installment_value ? maskCurrency(String(Math.round(s.installment_value * 100))) : '—'}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{s.installments}x</TableCell>
                    <TableCell>{statusBadge(s.status)}</TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" onClick={() => delSim.mutate(s.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Simulation dialog */}
      <Dialog open={simOpen} onOpenChange={setSimOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Calculator className="w-5 h-5 text-primary" /> Nova Simulação de Financiamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            {/* Seleção rápida de moto do estoque */}
            <div className="bg-muted/30 border rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">Carregar valor de moto em estoque:</span>
              <Select onValueChange={handleSelectVehicle}>
                <SelectTrigger className="h-8 w-full sm:w-[250px] text-xs bg-background">
                  <SelectValue placeholder="Escolher moto (opcional)..." />
                </SelectTrigger>
                <SelectContent>
                  {availableVehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id} className="text-xs">
                      {v.brand} {v.model} — {maskCurrency(String(Math.round((v.sale_price || 0) * 100)))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Loja *</Label>
                <Select value={simForm.store_id} onValueChange={(v) => setSimForm({ ...simForm, store_id: v })}>
                  <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {stores.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Banco / Financeira *</Label>
                <Select value={simForm.bank_code} onValueChange={(v) => setSimForm({ ...simForm, bank_code: v })}>
                  <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="Selecione o banco" /></SelectTrigger>
                  <SelectContent>
                    {banksForStore.length > 0 ? banksForStore.map((c) => (
                      <SelectItem key={c.id} value={c.bank_code}>{BANK_LABEL[c.bank_code] || c.bank_name}</SelectItem>
                    )) : SUPPORTED_BANKS.map((b) => (
                      <SelectItem key={b.code} value={b.code}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Nome Completo do Cliente *</Label>
                <Input
                  className="h-9 mt-1"
                  placeholder="Ex: Marcos Antônio Silva"
                  value={simForm.customer_name}
                  onChange={(e) => setSimForm({ ...simForm, customer_name: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">CPF do Cliente</Label>
                <Input
                  className="h-9 mt-1 font-mono"
                  placeholder="000.000.000-00"
                  value={simForm.customer_document}
                  onChange={(e) => setSimForm({ ...simForm, customer_document: maskCPFCNPJ(e.target.value) })}
                />
              </div>
              <div>
                <Label className="text-xs">Valor da Motocicleta</Label>
                <Input
                  className="h-9 mt-1"
                  value={maskCurrency(String(Math.round((Number(simForm.vehicle_value) || 0) * 100)))}
                  onChange={(e) => setSimForm({ ...simForm, vehicle_value: parseCurrency(e.target.value) })}
                />
              </div>
              <div>
                <Label className="text-xs">Valor de Entrada</Label>
                <Input
                  className="h-9 mt-1"
                  value={maskCurrency(String(Math.round((Number(simForm.down_payment) || 0) * 100)))}
                  onChange={(e) => setSimForm({ ...simForm, down_payment: parseCurrency(e.target.value) })}
                />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Prazo (Parcelas)</Label>
                <Select value={String(simForm.installments)} onValueChange={(v) => setSimForm({ ...simForm, installments: Number(v) })}>
                  <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[12, 18, 24, 36, 48, 60].map((n) => <SelectItem key={n} value={String(n)}>{n}x mensais</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Prévia em tempo real */}
            <div className="rounded-xl bg-primary/5 border border-primary/20 p-3.5 grid grid-cols-3 gap-2 text-center">
              <div>
                <span className="text-[11px] text-muted-foreground block">Valor Financiado</span>
                <span className="text-sm font-bold text-foreground">
                  {maskCurrency(String(Math.round(livePreview.financed * 100)))}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground block">Taxa Mensal Est.</span>
                <span className="text-sm font-bold text-foreground">
                  {livePreview.monthlyRatePct.toFixed(2)}% a.m.
                </span>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground block">Parcela ({simForm.installments}x)</span>
                <span className="text-sm font-black text-primary">
                  {maskCurrency(String(Math.round(livePreview.pmt * 100)))}
                </span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSimOpen(false)}>Cancelar</Button>
            <Button onClick={submitSim} disabled={runSim.isPending}>
              <Calculator className="w-4 h-4 mr-1.5" /> Salvar e Simular
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
