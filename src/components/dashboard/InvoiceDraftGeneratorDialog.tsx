import { useEffect, useState } from 'react';
import { Zap, RefreshCw, Download, ShieldAlert } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
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
import { useToast } from '@/hooks/use-toast';
import { generateDraftCode, generateInvoiceDraftPdf } from '@/lib/invoiceDraftPdf';
import { parseFlexibleCurrency } from '@/lib/masks';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ISSUER_PRESETS = {
  multimarcas: {
    label: 'L1MA MOTORS MULTIMARCAS (Montes Claros)',
    name: 'LIMA MOTORS SHINERAY MONTES CLAROS LTDA',
    cnpj: '53.197.043/0001-75',
    ie: '0054689570019',
    address: 'Avenida João XXIII, 990 - Loja 5A - Edgar Pereira',
    cityUf: 'MONTES CLAROS - MG',
    cep: '39400-162',
    phone: '(38) 99938-1522',
  },
  moc: {
    label: 'LIMA MOTORS SHINERAY MONTES CLAROS LTDA',
    name: 'LIMA MOTORS SHINERAY MONTES CLAROS LTDA',
    cnpj: '53.197.043/0001-75',
    ie: '0054689570019',
    address: 'Avenida João XXIII, 990 - Loja 5A - Edgar Pereira',
    cityUf: 'MONTES CLAROS - MG',
    cep: '39400-162',
    phone: '(38) 99938-1522',
  },
  div: {
    label: 'SHINERAY GRUPO L1MA MOTORS DIVINÓPOLIS',
    name: 'SHINERAY GRUPO L1MA MOTORS DIVINOPOLIS',
    cnpj: '18.456.789/0001-01',
    ie: '',
    address: 'Rua Espírito Santo, 307 - Via Belo Horizonte',
    cityUf: 'DIVINÓPOLIS - MG',
    cep: '35500-000',
    phone: '(37) 99843-9319',
  },
};

const ELECTRIC_MODEL_PRESETS = [
  {
    key: 'quatro_e',
    label: 'IBIKE QUATRO E 500W (DF1)',
    baseDesc: 'MOTO ELETRICA QUATRO E 500W / MOTO ELETRICA DF1 500W / Modelo: DF1 Motor: Eletrico Potencia: 500W BATERIA DE LITIO',
    defaultPrice: '4.500,00',
  },
  {
    key: 'foston_gt6x',
    label: 'FOSTON GT6X (Elétrica)',
    baseDesc: 'MOTO ELETRICA FOSTON GT6X / Motor: Eletrico BATERIA DE LITIO',
    defaultPrice: '7.990,00',
  },
  {
    key: 'ibike_goat',
    label: 'IBIKE GOAT (E-Bike)',
    baseDesc: 'MOTO ELETRICA IBIKE GOAT / E-BIKE Motor: Eletrico BATERIA DE LITIO',
    defaultPrice: '3.990,00',
  },
  {
    key: 'passion',
    label: 'PASSION (Elétrica)',
    baseDesc: 'MOTO ELETRICA PASSION / Motor: Eletrico BATERIA DE LITIO',
    defaultPrice: '7.990,00',
  },
  {
    key: 'x15_max',
    label: 'X15 MAX (Elétrica)',
    baseDesc: 'MOTO ELETRICA X15 MAX / Motor: Eletrico BATERIA DE LITIO',
    defaultPrice: '6.990,00',
  },
  {
    key: 'she_s',
    label: 'SHINERAY SHE S / SE1 (Elétrica)',
    baseDesc: 'MOTO ELETRICA SHINERAY SHE S / Motor: Eletrico 2000W BATERIA DE LITIO',
    defaultPrice: '12.990,00',
  },
  {
    key: 'custom',
    label: 'Outro Modelo Elétrico (Personalizado)',
    baseDesc: '',
    defaultPrice: '',
  },
];

export function InvoiceDraftGeneratorDialog({ open, onOpenChange }: Props) {
  const { toast } = useToast();
  const [issuerKey, setIssuerKey] = useState<'multimarcas' | 'moc' | 'div'>('multimarcas');
  const [draftCode, setDraftCode] = useState(generateDraftCode);
  const [modelPreset, setModelPreset] = useState('quatro_e');
  const [bikeColor, setBikeColor] = useState('BRANCA');
  const [motorNumber, setMotorNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerDocument, setCustomerDocument] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerNeighborhood, setCustomerNeighborhood] = useState('');
  const [customerCep, setCustomerCep] = useState('');
  const [customerCity, setCustomerCity] = useState('');
  const [customerUf, setCustomerUf] = useState('MG');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentDescription, setPaymentDescription] = useState('Pagamento (1): À Vista - Dinheiro');
  const [totalValueStr, setTotalValueStr] = useState('4.500,00');
  const [customProductDesc, setCustomProductDesc] = useState('');
  const [ncm, setNcm] = useState('87116000');
  const [cfop, setCfop] = useState('5102');
  const [additionalInfo, setAdditionalInfo] = useState('MOTO ENTREGUE E PAGA.');

  useEffect(() => {
    if (open) {
      setDraftCode(generateDraftCode());
    }
  }, [open]);

  // Ajusta CFOP automaticamente: 5102 (dentro de MG) vs 6102 (outro estado)
  const handleUfChange = (rawUf: string) => {
    const clean = rawUf.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
    setCustomerUf(clean);
    if (clean.length === 2) {
      setCfop(clean === 'MG' ? '5102' : '6102');
    }
  };

  const handleModelPresetChange = (key: string) => {
    setModelPreset(key);
    const preset = ELECTRIC_MODEL_PRESETS.find((p) => p.key === key);
    if (preset?.defaultPrice) {
      setTotalValueStr(preset.defaultPrice);
    }
  };

  const buildElectricDescription = (): string => {
    if (modelPreset === 'custom') {
      return customProductDesc.trim().toUpperCase();
    }
    const preset = ELECTRIC_MODEL_PRESETS.find((p) => p.key === modelPreset);
    const parts = [
      preset?.baseDesc || 'MOTO ELETRICA',
      bikeColor.trim() ? `COR: ${bikeColor.trim().toUpperCase()}` : '',
      motorNumber.trim() ? `NUMERO MOTOR: ${motorNumber.trim().toUpperCase()}` : '',
    ].filter(Boolean);
    return parts.join(' ');
  };

  const handleGenerate = () => {
    if (!customerName.trim()) {
      toast({ variant: 'destructive', title: 'Informe o nome do cliente' });
      return;
    }
    const val = parseFlexibleCurrency(totalValueStr);
    if (!val || val <= 0) {
      toast({ variant: 'destructive', title: 'Informe um valor total válido' });
      return;
    }
    const finalDescription = buildElectricDescription();
    if (!finalDescription) {
      toast({ variant: 'destructive', title: 'Informe a descrição da moto elétrica' });
      return;
    }

    const issuer = ISSUER_PRESETS[issuerKey];
    const todayBr = new Date().toLocaleDateString('pt-BR');

    generateInvoiceDraftPdf({
      draftCode,
      issueDate: todayBr,
      operationNature: 'Venda de mercadoria',
      issuerName: issuer.name,
      issuerCnpj: issuer.cnpj,
      issuerIe: issuer.ie,
      issuerAddress: issuer.address,
      issuerCityUf: issuer.cityUf,
      issuerCep: issuer.cep,
      issuerPhone: issuer.phone,
      customerName: customerName.trim().toUpperCase(),
      customerDocument: customerDocument.trim(),
      customerAddress: customerAddress.trim(),
      customerNeighborhood: customerNeighborhood.trim(),
      customerCep: customerCep.trim(),
      customerCity: customerCity.trim().toUpperCase(),
      customerUf: (customerUf.trim() || 'MG').toUpperCase().slice(0, 2),
      customerPhone: customerPhone.trim(),
      paymentDescription: paymentDescription.trim() || 'Pagamento (1): À Vista',
      totalValue: val,
      productCode: '001',
      productDescription: finalDescription,
      ncm: ncm.trim() || '87116000',
      cfop: cfop.trim() || (customerUf === 'MG' ? '5102' : '6102'),
      quantity: 1,
      unitValue: val,
      additionalInfo: additionalInfo.trim(),
    });

    toast({
      title: 'Prévia PDF de Moto Elétrica gerada!',
      description: `Código interno ${draftCode} (Sem Valor Fiscal — ambiente de teste).`,
    });
    setDraftCode(generateDraftCode());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b bg-muted/20 shrink-0">
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <Zap className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            Gerar Prévia PDF — Venda de Motos Elétricas (Teste)
          </DialogTitle>
          <DialogDescription className="text-xs">
            Módulo dedicado às <strong>motos elétricas</strong> (NCM 87116000 + Nº do Motor). Gera PDF com código interno novo e marca d&apos;água <strong>SEM VALOR FISCAL</strong> para validação antes de ativar a NF-e na SEFAZ.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-2.5 flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>Documento exclusivo para testes/conferência de elétricas — sem chave SEFAZ nem validade fiscal.</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Emitente</Label>
              <Select value={issuerKey} onValueChange={(v: any) => setIssuerKey(v)}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="multimarcas">L1MA MOTORS MULTIMARCAS (Elétricas)</SelectItem>
                  <SelectItem value="moc">LIMA MOTORS SHINERAY MOC</SelectItem>
                  <SelectItem value="div">SHINERAY DIVINÓPOLIS</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Código Interno Novo</Label>
              <div className="flex gap-1.5">
                <Input value={draftCode} onChange={(e) => setDraftCode(e.target.value)} className="h-9 text-xs font-mono font-bold" />
                <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => setDraftCode(generateDraftCode())} title="Gerar novo código">
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>

          {/* Dados da Moto Elétrica */}
          <div className="rounded-xl border bg-muted/20 p-3 space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" />
              Dados da Moto Elétrica
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs font-semibold">Modelo Elétrico *</Label>
                <Select value={modelPreset} onValueChange={handleModelPresetChange}>
                  <SelectTrigger className="h-9 text-xs bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ELECTRIC_MODEL_PRESETS.map((p) => (
                      <SelectItem key={p.key} value={p.key} className="text-xs">
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Cor</Label>
                <Input value={bikeColor} onChange={(e) => setBikeColor(e.target.value)} placeholder="BRANCA" className="h-9 text-xs bg-background uppercase" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs font-semibold">Número do Motor</Label>
                <Input value={motorNumber} onChange={(e) => setMotorNumber(e.target.value.toUpperCase())} placeholder="Ex: FV1582026BR" className="h-9 text-xs font-mono bg-background uppercase" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Valor Total (R$) *</Label>
                <Input value={totalValueStr} onChange={(e) => setTotalValueStr(e.target.value)} placeholder="4.500,00" className="h-9 text-xs font-mono bg-background" />
              </div>
            </div>

            {modelPreset === 'custom' && (
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Descrição Completa Personalizada *</Label>
                <Textarea
                  rows={2}
                  value={customProductDesc}
                  onChange={(e) => setCustomProductDesc(e.target.value)}
                  placeholder="Ex: MOTO ELETRICA ... COR: ... NUMERO MOTOR: ..."
                  className="text-xs bg-background"
                />
              </div>
            )}
          </div>

          {/* Dados do Cliente */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Nome / Razão Social do Cliente *</Label>
              <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Ex: ANA PAULA JESUS SANTOS" className="h-9 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">CPF / CNPJ</Label>
              <Input value={customerDocument} onChange={(e) => setCustomerDocument(e.target.value)} placeholder="000.000.000-00" className="h-9 text-xs font-mono" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs font-semibold">Endereço</Label>
              <Input value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} placeholder="Rua, número" className="h-9 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Bairro</Label>
              <Input value={customerNeighborhood} onChange={(e) => setCustomerNeighborhood(e.target.value)} placeholder="Bairro" className="h-9 text-xs" />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">CEP</Label>
              <Input value={customerCep} onChange={(e) => setCustomerCep(e.target.value)} placeholder="39400-000" className="h-9 text-xs font-mono" />
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs font-semibold">Município</Label>
              <Input value={customerCity} onChange={(e) => setCustomerCity(e.target.value)} placeholder="Montes Claros" className="h-9 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">UF (ajusta CFOP)</Label>
              <Input value={customerUf} onChange={(e) => handleUfChange(e.target.value)} placeholder="MG" className="h-9 text-xs uppercase" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs font-semibold">Forma de Pagamento</Label>
              <Input value={paymentDescription} onChange={(e) => setPaymentDescription(e.target.value)} className="h-9 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Telefone Cliente</Label>
              <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="(38) 99999-0000" className="h-9 text-xs" />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">NCM/SH (Elétrica)</Label>
              <Input value={ncm} onChange={(e) => setNcm(e.target.value)} className="h-9 text-xs font-mono" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">CFOP</Label>
              <Input value={cfop} onChange={(e) => setCfop(e.target.value)} className="h-9 text-xs font-mono" />
            </div>
            <div className="space-y-1 col-span-2 sm:col-span-1">
              <Label className="text-xs font-semibold">Info Complementar</Label>
              <Input value={additionalInfo} onChange={(e) => setAdditionalInfo(e.target.value)} className="h-9 text-xs" />
            </div>
          </div>
        </div>

        <DialogFooter className="px-5 py-3 border-t bg-muted/20 shrink-0 gap-2 sm:gap-0">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button type="button" size="sm" onClick={handleGenerate} className="gap-1.5 font-bold bg-emerald-600 hover:bg-emerald-700 text-white">
            <Download className="w-3.5 h-3.5" />
            Baixar Prévia Elétrica (PDF)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
