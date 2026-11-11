import { useState, useRef } from 'react';
import {
  Bike,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Calculator,
  ShieldCheck,
  Wrench,
  Sparkles,
  Loader2,
  Search,
  FileText,
  Upload,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import {
  UsedMotoInspectionData,
  InspectionFinalStatus,
  AuctionStatus,
  RenajudStatus,
  TheftStatus,
  FinanceStatus,
  VehicleDebt,
} from '@/types/inspection';
import { maskCurrency, parseCurrency } from '@/lib/masks';
import { formatPlate } from '@/lib/vehicleCatalog';
import { lookupMotoByPlate } from '@/lib/plateLookup';
import { extractTextFromCrlvFile, parseCrlvText } from '@/lib/crlvParser';
import { OFFICIAL_FREE_PORTALS } from '@/lib/officialLinks';
import { useToast } from '@/hooks/use-toast';

interface NewInspectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: Omit<UsedMotoInspectionData, 'id' | 'code' | 'created_at' | 'updated_at'>) => Promise<unknown>;
}

export function NewInspectionDialog({
  open,
  onOpenChange,
  onSave,
}: NewInspectionDialogProps) {
  const { profile, userStore } = useAuth();

  // 1. Dados da Moto Usada
  const [brand, setBrand] = useState('HONDA');
  const [model, setModel] = useState('');
  const [year, setYear] = useState(new Date().getFullYear() - 2);
  const [color, setColor] = useState('Vermelho');
  const [plate, setPlate] = useState('');
  const [chassis, setChassis] = useState('');
  const [renavam, setRenavam] = useState('');
  const [mileage, setMileage] = useState<number>(25000);
  const [inspectorName, setInspectorName] = useState(profile?.full_name || 'Avaliador de Seminovos');

  // Cliente da Troca
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');

  // 2. Procedência Legal & Multas
  const [theftStatus, setTheftStatus] = useState<TheftStatus>('nada_consta');
  const [renajudStatus, setRenajudStatus] = useState<RenajudStatus>('nada_consta');
  const [auctionStatus, setAuctionStatus] = useState<AuctionStatus>('sem_passagem');
  const [financeStatus, setFinanceStatus] = useState<FinanceStatus>('quitado');

  // Débitos a Abater
  const [debts, setDebts] = useState<VehicleDebt[]>([]);
  const [debtDesc, setDebtDesc] = useState('');
  const [debtAmount, setDebtAmount] = useState('');

  // 3. Vistoria da Moto
  const [frameChassis, setFrameChassis] = useState<'alinhado_original' | 'soldado_reparado' | 'empenado_batido'>('alinhado_original');
  const [engineCondition, setEngineCondition] = useState<'otimo_silencioso' | 'fumando_queimando_oleo' | 'vazamento_junta' | 'barulho_biela'>('otimo_silencioso');
  const [transmissionGears, setTransmissionGears] = useState<'engates_perfeitos' | 'arranhando_escapando'>('engates_perfeitos');
  const [frontFork, setFrontFork] = useState<'alinhada_sem_vazamento' | 'retentor_vazando' | 'empenada'>('alinhada_sem_vazamento');
  const [chainKit, setChainKit] = useState<'otimo' | 'meia_vida' | 'gasto_trocar'>('otimo');
  const [tires, setTires] = useState<'bons' | 'meia_vida' | 'gastos_trocar'>('bons');
  const [fairingsPaint, setFairingsPaint] = useState<'original_impecavel' | 'riscos_ralados_leves' | 'carenagens_quebradas'>('original_impecavel');
  const [numbersMatch, setNumbersMatch] = useState(true);

  // 4. Financeiro
  const [workshopCost, setWorkshopCost] = useState('R$ 250,00');
  const [suggestedTradeIn, setSuggestedTradeIn] = useState('R$ 0,00');
  const [notes, setNotes] = useState('');
  const { toast } = useToast();
  const [isSearchingPlate, setIsSearchingPlate] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isParsingCrlv, setIsParsingCrlv] = useState(false);
  const [copiedInfo, setCopiedInfo] = useState(false);

  const handleCrlvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsingCrlv(true);
    try {
      const text = await extractTextFromCrlvFile(file);
      const parsed = parseCrlvText(text);

      if (parsed) {
        if (parsed.plate && parsed.plate !== 'SEM PLACA') setPlate(parsed.plate);
        if (parsed.brand) setBrand(parsed.brand);
        if (parsed.model) setModel(parsed.model);
        if (parsed.year) setYear(parsed.year);
        if (parsed.color) setColor(parsed.color);
        if (parsed.chassis) setChassis(parsed.chassis);
        if (parsed.renavam) setRenavam(parsed.renavam);
        if (parsed.client_name) setClientName(parsed.client_name);
        if (parsed.theft_status) setTheftStatus(parsed.theft_status);
        if (parsed.renajud_status) setRenajudStatus(parsed.renajud_status);
        if (parsed.auction_status) setAuctionStatus(parsed.auction_status);
        if (parsed.finance_status) setFinanceStatus(parsed.finance_status);
        if (parsed.notes) setNotes(parsed.notes);

        toast({
          title: 'CRLV-e Digital Lido com Sucesso!',
          description: `Placa: ${parsed.plate} • Chassi: ${parsed.chassis} • Análise jurídica oficial concluída.`,
        });
      } else {
        toast({
          title: 'Não foi possível ler o documento',
          description: 'Envie o arquivo PDF original do CRLV-e emitido pela Carteira Digital de Trânsito ou Gov.br.',
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Erro na leitura de CRLV:', err);
      toast({
        title: 'Falha na leitura do arquivo',
        description: 'Verifique o arquivo ou preencha manualmente.',
        variant: 'destructive',
      });
    } finally {
      setIsParsingCrlv(false);
      if (e.target) e.target.value = '';
    }
  };

  const copyPlateAndRenavam = () => {
    const text = `Placa: ${plate || 'N/A'}\nRenavam: ${renavam || 'N/A'}\nChassi: ${chassis || 'N/A'}`;
    navigator.clipboard.writeText(text);
    setCopiedInfo(true);
    setTimeout(() => setCopiedInfo(false), 2500);
    toast({
      title: 'Placa e Renavam copiados!',
      description: 'Pronto para colar nos portais oficiais de consulta de débitos (DETRAN / PRF).',
    });
  };

  const handlePlateSearch = async (targetPlate?: string) => {
    const raw = targetPlate || plate;
    const clean = (raw || '').replace(/[^A-Z0-9]/g, '');
    if (clean.length < 7) {
      alert('Digite uma placa válida com 7 caracteres (ex: RZA2E19 ou ABC1234).');
      return;
    }

    setIsSearchingPlate(true);
    try {
      const res = await lookupMotoByPlate(clean);
      setPlate(res.plate);

      if (res.found === true) {
        setBrand(res.brand);
        setModel(res.model);
        setYear(res.year);
        setColor(res.color);
        setChassis(res.chassis);
        setRenavam(res.renavam);
        setMileage(res.mileage);
        setTheftStatus(res.theft_status);
        setRenajudStatus(res.renajud_status);
        setAuctionStatus(res.auction_status);
        setFinanceStatus(res.finance_status);
        setDebts(res.debts);
        toast({
          title: 'Dados reais localizados!',
          description: `Fonte: ${res.sourceName}`,
        });
      } else {
        toast({
          title: 'Atenção aos Dados Oficiais',
          description: res.message,
          variant: 'default',
        });
      }
    } finally {
      setIsSearchingPlate(false);
    }
  };

  const handleAddDebt = () => {
    const val = parseCurrency(debtAmount);
    if (!debtDesc.trim() || val <= 0) return;
    setDebts([
      ...debts,
      {
        id: `d-${Date.now()}`,
        description: debtDesc.trim(),
        amount: val,
        type: 'multa',
      },
    ]);
    setDebtDesc('');
    setDebtAmount('');
  };

  const handleRemoveDebt = (id: string) => {
    setDebts(debts.filter((d) => d.id !== id));
  };

  const totalDebts = debts.reduce((acc, d) => acc + d.amount, 0);

  // Score Simples e Preciso de Moto Usada
  const calculatedScore = (() => {
    let score = 100;
    if (theftStatus !== 'nada_consta') score -= 80;
    if (renajudStatus !== 'nada_consta') score -= 45;
    if (auctionStatus === 'sinistro_grave') score -= 50;
    if (auctionStatus === 'leilao_seguradora') score -= 25;
    if (auctionStatus === 'recuperado_financeira') score -= 10;
    if (frameChassis === 'soldado_reparado') score -= 35;
    if (frameChassis === 'empenado_batido') score -= 50;
    if (engineCondition === 'fumando_queimando_oleo') score -= 30;
    if (engineCondition === 'barulho_biela') score -= 35;
    if (engineCondition === 'vazamento_junta') score -= 15;
    if (transmissionGears === 'arranhando_escapando') score -= 20;
    if (frontFork === 'retentor_vazando') score -= 10;
    if (frontFork === 'empenada') score -= 30;
    if (chainKit === 'gasto_trocar') score -= 10;
    if (tires === 'gastos_trocar') score -= 15;
    if (fairingsPaint === 'carenagens_quebradas') score -= 15;
    if (!numbersMatch) score -= 60;
    return Math.max(0, Math.min(100, score));
  })();

  const calculatedFinalStatus: InspectionFinalStatus = (() => {
    if (
      theftStatus === 'alerta_furto_roubo' ||
      renajudStatus !== 'nada_consta' ||
      frameChassis === 'empenado_batido' ||
      !numbersMatch ||
      calculatedScore < 50
    ) {
      return 'reprovado';
    }
    if (
      calculatedScore < 85 ||
      totalDebts > 0 ||
      engineCondition !== 'otimo_silencioso' ||
      frameChassis === 'soldado_reparado' ||
      auctionStatus !== 'sem_passagem' ||
      chainKit === 'gasto_trocar' ||
      tires === 'gastos_trocar'
    ) {
      return 'aprovado_com_apontamentos';
    }
    return 'aprovado';
  })();

  const handleSubmit = async () => {
    if (!model.trim()) {
      alert('Informe o modelo da moto (ex: CG 160 Fan, Biz 125, SHI 175).');
      return;
    }

    const payload: Omit<UsedMotoInspectionData, 'id' | 'code' | 'created_at' | 'updated_at'> = {
      store_name: userStore?.name || 'Concessionária Shineray',
      inspector_name: inspectorName || 'Avaliador Técnico',
      brand: brand.toUpperCase(),
      model: model.toUpperCase(),
      year,
      color,
      plate: plate.toUpperCase(),
      chassis: chassis.toUpperCase() || 'CHASSI-CONFERIDO',
      renavam,
      mileage: mileage || 0,
      client_name: clientName || undefined,
      client_phone: clientPhone || undefined,

      theft_status: theftStatus,
      renajud_status: renajudStatus,
      auction_status: auctionStatus,
      finance_status: financeStatus,
      debts,
      total_debts: totalDebts,

      frame_chassis: frameChassis,
      engine_condition: engineCondition,
      transmission_gears: transmissionGears,
      front_fork: frontFork,
      chain_kit: chainKit,
      tires,
      fairings_paint: fairingsPaint,
      numbers_match: numbersMatch,

      score: calculatedScore,
      final_status: calculatedFinalStatus,
      estimated_workshop_cost: parseCurrency(workshopCost),
      suggested_trade_in_value: parseCurrency(suggestedTradeIn) || undefined,
      notes: notes || undefined,
    };

    await onSave(payload);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto rounded-3xl p-6 sm:p-8">
        <DialogHeader className="flex-row items-center justify-between space-y-0 pb-3 border-b">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <Bike className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="font-display text-xl font-black">
                Laudo & Avaliação de Moto Usada
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                Vistoria essencial de quadro, motor, multas e procedência para entrada na troca
              </p>
            </div>
          </div>

          <Badge
            variant={
              calculatedFinalStatus === 'aprovado'
                ? 'outline'
                : calculatedFinalStatus === 'aprovado_com_apontamentos'
                ? 'secondary'
                : 'destructive'
            }
            className="text-xs font-bold"
          >
            {calculatedFinalStatus === 'aprovado' && '🟢 APROVADA'}
            {calculatedFinalStatus === 'aprovado_com_apontamentos' && '🟡 COM RESSALVAS'}
            {calculatedFinalStatus === 'reprovado' && '🔴 REPROVADA'}
            {' '}• Score {calculatedScore}/100
          </Badge>
        </DialogHeader>

        <div className="space-y-4 pt-3 text-xs">
          {/* ENTRADA AUTOMATIZADA: CRLV-E DIGITAL & BUSCA DE PLACA */}
          <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <span className="font-bold text-foreground text-sm flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-primary" />
                  Preenchimento Automático Oficial (Sem Custo)
                </span>
                <span className="text-[11px] text-muted-foreground block mt-0.5">
                  Importe o PDF do CRLV-e da Carteira Digital do cliente ou busque a placa já cadastrada.
                </span>
              </div>

              {/* Botão de Importar CRLV-e */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".pdf,.txt"
                  className="hidden"
                  onChange={handleCrlvUpload}
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isParsingCrlv}
                  className="h-9 px-3.5 gap-2 font-bold bg-primary text-primary-foreground shadow-sm shrink-0"
                >
                  {isParsingCrlv ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Lendo CRLV-e...
                    </>
                  ) : (
                    <>
                      <FileText className="w-3.5 h-3.5" />
                      Importar CRLV-e (PDF Gov.br)
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Ou busca por placa */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-primary/10">
              <div className="flex items-center gap-2">
                <Input
                  value={plate}
                  onChange={(e) => setPlate(formatPlate(e.target.value))}
                  placeholder="Placa (Ex: RZA2E19)"
                  maxLength={8}
                  className="h-8 w-32 uppercase font-mono font-bold text-center bg-background"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1 text-xs font-semibold"
                  disabled={isSearchingPlate}
                  onClick={() => handlePlateSearch()}
                >
                  {isSearchingPlate ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                  Buscar Placa
                </Button>
              </div>

              {/* Atalhos Rápidos para Consulta Gratuita de Multas */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={copyPlateAndRenavam}
                  className="h-8 px-2.5 gap-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                >
                  {copiedInfo ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  Copiar Placa + Renavam
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    copyPlateAndRenavam();
                    window.open('https://nada-consta.prf.gov.br/nada_consta/index.jsf', '_blank');
                  }}
                  className="h-8 px-2.5 gap-1 text-[11px] text-primary"
                >
                  <ExternalLink className="w-3 h-3" />
                  Nada Consta PRF (Grátis)
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    copyPlateAndRenavam();
                    window.open('https://servicos.dnit.gov.br/multas/', '_blank');
                  }}
                  className="h-8 px-2.5 gap-1 text-[11px] text-primary"
                >
                  <ExternalLink className="w-3 h-3" />
                  DNIT (Grátis)
                </Button>
              </div>
            </div>
          </div>

          {/* 1. DADOS DA MOTO USADA & CLIENTE */}
          <div className="p-4 rounded-2xl bg-muted/30 border space-y-3">
            <span className="font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Bike className="w-3.5 h-3.5 text-primary" />
              1. Dados da Moto Usada & Vendedor da Troca
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div>
                <Label className="text-[11px]">Marca *</Label>
                <Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Ex: HONDA, YAMAHA" className="h-8 text-xs mt-1" />
              </div>
              <div>
                <Label className="text-[11px]">Modelo *</Label>
                <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Ex: CG 160 Fan, Biz 125" className="h-8 text-xs mt-1" />
              </div>
              <div>
                <Label className="text-[11px]">Placa</Label>
                <Input value={plate} onChange={(e) => setPlate(formatPlate(e.target.value))} placeholder="ABC-1234" maxLength={8} className="h-8 text-xs uppercase mt-1" />
              </div>
              <div>
                <Label className="text-[11px]">Ano / Km Rodado</Label>
                <div className="flex gap-1 mt-1">
                  <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="h-8 text-xs w-20" placeholder="Ano" />
                  <Input type="number" value={mileage} onChange={(e) => setMileage(Number(e.target.value))} className="h-8 text-xs flex-1" placeholder="Km" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              <div>
                <Label className="text-[11px]">Chassi (no canote)</Label>
                <Input value={chassis} onChange={(e) => setChassis(e.target.value.toUpperCase())} placeholder="17 dígitos do chassi" className="h-8 text-xs font-mono uppercase mt-1" />
              </div>
              <div>
                <Label className="text-[11px]">Cliente / Dono da Troca</Label>
                <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Nome do cliente" className="h-8 text-xs mt-1" />
              </div>
              <div>
                <Label className="text-[11px]">Telefone / WhatsApp</Label>
                <Input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="(00) 00000-0000" className="h-8 text-xs mt-1" />
              </div>
            </div>
          </div>

          {/* 2. PROCEDÊNCIA LEGAL & MULTAS (ONDE MORA O PREJUÍZO) */}
          <div className="p-4 rounded-2xl bg-muted/30 border space-y-3">
            <span className="font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-primary" />
              2. Procedência Legal & Débitos a Abater
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div>
                <Label className="text-[11px]">Furto / Roubo (SINESP)</Label>
                <Select value={theftStatus} onValueChange={(v) => setTheftStatus(v as TheftStatus)}>
                  <SelectTrigger className="h-8 rounded-lg mt-1 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nada_consta">✓ Nada Consta</SelectItem>
                    <SelectItem value="alerta_furto_roubo">🚨 QUEIXA ATIVA</SelectItem>
                    <SelectItem value="recuperado">Recuperado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-[11px]">Bloqueio RENAJUD</Label>
                <Select value={renajudStatus} onValueChange={(v) => setRenajudStatus(v as RenajudStatus)}>
                  <SelectTrigger className="h-8 rounded-lg mt-1 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nada_consta">✓ Nada Consta</SelectItem>
                    <SelectItem value="bloqueio_transferencia">🚨 Bloqueio Judicial</SelectItem>
                    <SelectItem value="penhora">Penhora Ativa</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-[11px]">Histórico de Leilão</Label>
                <Select value={auctionStatus} onValueChange={(v) => setAuctionStatus(v as AuctionStatus)}>
                  <SelectTrigger className="h-8 rounded-lg mt-1 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sem_passagem">✓ Sem Leilão</SelectItem>
                    <SelectItem value="recuperado_financeira">Financeira</SelectItem>
                    <SelectItem value="leilao_seguradora">Seguradora</SelectItem>
                    <SelectItem value="sinistro_grave">🚨 Sinistro Grave</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-[11px]">Situação Financeira</Label>
                <Select value={financeStatus} onValueChange={(v) => setFinanceStatus(v as FinanceStatus)}>
                  <SelectTrigger className="h-8 rounded-lg mt-1 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="quitado">✓ Quitado / Livre</SelectItem>
                    <SelectItem value="alienacao_fiduciaria">Alienação Ativa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Débitos e Multas */}
            <div className="p-3 rounded-xl bg-background border space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-muted-foreground flex items-center gap-1">
                  <Calculator className="w-3.5 h-3.5 text-primary" />
                  Multas e IPVA a Descontar:
                </span>
                <span className="font-black text-rose-600 dark:text-rose-400">
                  Total Débitos: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalDebts)}
                </span>
              </div>

              <div className="flex gap-2">
                <Input
                  value={debtDesc}
                  onChange={(e) => setDebtDesc(e.target.value)}
                  placeholder="Ex: Licenciamento 2026, Multa radar"
                  className="h-8 text-xs flex-1"
                />
                <Input
                  value={debtAmount}
                  onChange={(e) => setDebtAmount(maskCurrency(e.target.value))}
                  placeholder="R$ 0,00"
                  className="h-8 text-xs w-28"
                />
                <Button type="button" size="sm" onClick={handleAddDebt} className="h-8 text-xs font-bold gap-1">
                  <Plus className="w-3 h-3" /> Abater
                </Button>
              </div>

              {debts.length > 0 && (
                <div className="divide-y text-xs pt-1">
                  {debts.map((d) => (
                    <div key={d.id} className="py-1 flex items-center justify-between">
                      <span>{d.description}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-rose-600 dark:text-rose-400">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(d.amount)}
                        </span>
                        <Button type="button" variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-destructive" onClick={() => handleRemoveDebt(d.id)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 3. VISTORIA MECÂNICA & FÍSICA ESPECÍFICA DE MOTO */}
          <div className="p-4 rounded-2xl bg-muted/30 border space-y-3">
            <span className="font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5 text-primary" />
              3. Checklist da Moto (Quadro, Motor, Relação e Pneus)
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div>
                <Label className="text-[11px]">Quadro / Chassi</Label>
                <Select value={frameChassis} onValueChange={(v) => setFrameChassis(v as never)}>
                  <SelectTrigger className="h-8 rounded-lg mt-1 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alinhado_original">✓ Alinhado e Original</SelectItem>
                    <SelectItem value="soldado_reparado">⚡ Soldado / Reparado</SelectItem>
                    <SelectItem value="empenado_batido">🚨 Empenado / Batido</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-[11px]">Estado do Motor</Label>
                <Select value={engineCondition} onValueChange={(v) => setEngineCondition(v as never)}>
                  <SelectTrigger className="h-8 rounded-lg mt-1 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="otimo_silencioso">✓ Sereno / Sem Ruído</SelectItem>
                    <SelectItem value="fumando_queimando_oleo">🚨 Fumando / Baixando Óleo</SelectItem>
                    <SelectItem value="vazamento_junta">⚠️ Vazamento em Junta</SelectItem>
                    <SelectItem value="barulho_biela">🚨 Barulho de Biela/Válvula</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-[11px]">Bengalas / Suspensão</Label>
                <Select value={frontFork} onValueChange={(v) => setFrontFork(v as never)}>
                  <SelectTrigger className="h-8 rounded-lg mt-1 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alinhada_sem_vazamento">✓ Alinhada / Sem Vazamento</SelectItem>
                    <SelectItem value="retentor_vazando">⚠️ Retentor Vazando Óleo</SelectItem>
                    <SelectItem value="empenada">🚨 Bengala Empenada</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-[11px]">Kit Relação</Label>
                <Select value={chainKit} onValueChange={(v) => setChainKit(v as never)}>
                  <SelectTrigger className="h-8 rounded-lg mt-1 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="otimo">✓ Ótima / Nova</SelectItem>
                    <SelectItem value="meia_vida">Meia-vida</SelectItem>
                    <SelectItem value="gasto_trocar">⚠️ Gasta (Trocar na loja)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
              <div>
                <Label className="text-[11px]">Pneus Diant. / Traseiro</Label>
                <Select value={tires} onValueChange={(v) => setTires(v as never)}>
                  <SelectTrigger className="h-8 rounded-lg mt-1 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bons">✓ Bons</SelectItem>
                    <SelectItem value="meia_vida">Meia-vida</SelectItem>
                    <SelectItem value="gastos_trocar">⚠️ Gastos (Trocar)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-[11px]">Carenagens & Pintura</Label>
                <Select value={fairingsPaint} onValueChange={(v) => setFairingsPaint(v as never)}>
                  <SelectTrigger className="h-8 rounded-lg mt-1 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="original_impecavel">✓ Original Impecável</SelectItem>
                    <SelectItem value="riscos_ralados_leves">Riscos Leves de Uso</SelectItem>
                    <SelectItem value="carenagens_quebradas">⚠️ Quebrada / Ralada</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-[11px]">Numeração Canote e Motor</Label>
                <Button
                  type="button"
                  variant={numbersMatch ? 'outline' : 'destructive'}
                  size="sm"
                  className="h-8 text-xs font-semibold w-full mt-1"
                  onClick={() => setNumbersMatch(!numbersMatch)}
                >
                  {numbersMatch ? '✓ Chassi e Motor Conferem' : '✗ Numeração Adulterada'}
                </Button>
              </div>
            </div>
          </div>

          {/* 4. FECHAMENTO FINANCEIRO DA TROCA */}
          <div className="p-4 rounded-2xl bg-muted/40 border space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px] font-bold">Custo de Oficina / Revisão da Moto (R$)</Label>
                <Input
                  value={workshopCost}
                  onChange={(e) => setWorkshopCost(maskCurrency(e.target.value))}
                  placeholder="R$ 0,00"
                  className="h-8 text-xs mt-1"
                />
                <span className="text-[10px] text-muted-foreground">Troca de óleo, relação, pneus ou retentor na loja</span>
              </div>
              <div>
                <Label className="text-[11px] font-bold">Preço Sugerido a Pagar na Troca (R$)</Label>
                <Input
                  value={suggestedTradeIn}
                  onChange={(e) => setSuggestedTradeIn(maskCurrency(e.target.value))}
                  placeholder="R$ 0,00"
                  className="h-8 text-xs mt-1 font-bold text-emerald-600 dark:text-emerald-400"
                />
                <span className="text-[10px] text-muted-foreground">Valor líquido para abater na moto nova</span>
              </div>
            </div>

            <div>
              <Label className="text-[11px]">Observações Comerciais</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Moto aceita na troca da Worker 125 0km com abatimento acordado..."
                rows={2}
                className="text-xs resize-none mt-1"
              />
            </div>
          </div>
        </div>

        {/* Ações */}
        <div className="flex items-center justify-between pt-4 border-t mt-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSubmit} className="h-10 px-8 font-bold shadow-md shadow-primary/20">
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Concluir Laudo da Moto
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
