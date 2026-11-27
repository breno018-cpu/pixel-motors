import { useEffect, useState } from 'react';
import { FileText, RefreshCw, Download, ShieldAlert } from 'lucide-react';
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

export function InvoiceDraftGeneratorDialog({ open, onOpenChange }: Props) {
  const { toast } = useToast();
  const [issuerKey, setIssuerKey] = useState<'moc' | 'multimarcas' | 'div'>('moc');
  const [draftCode, setDraftCode] = useState(generateDraftCode);
  const [customerName, setCustomerName] = useState('');
  const [customerDocument, setCustomerDocument] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerNeighborhood, setCustomerNeighborhood] = useState('');
  const [customerCep, setCustomerCep] = useState('');
  const [customerCity, setCustomerCity] = useState('');
  const [customerUf, setCustomerUf] = useState('MG');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentDescription, setPaymentDescription] = useState('Pagamento (1): À Vista - Dinheiro');
  const [totalValueStr, setTotalValueStr] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [ncm, setNcm] = useState('87116000');
  const [cfop, setCfop] = useState('5102');
  const [additionalInfo, setAdditionalInfo] = useState('MOTO ENTREGUE E PAGA.');

  useEffect(() => {
    if (open) {
      setDraftCode(generateDraftCode());
    }
  }, [open]);

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
    if (!productDescription.trim()) {
      toast({ variant: 'destructive', title: 'Informe a descrição do veículo/produto' });
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
      productDescription: productDescription.trim().toUpperCase(),
      ncm: ncm.trim() || '87116000',
      cfop: cfop.trim() || '5102',
      quantity: 1,
      unitValue: val,
      additionalInfo: additionalInfo.trim(),
    });

    toast({
      title: 'Prévia PDF gerada com sucesso!',
      description: `Código interno ${draftCode} (Sem Valor Fiscal — ambiente de teste).`,
    });
    setDraftCode(generateDraftCode());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b bg-muted/20 shrink-0">
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            Gerar Prévia / Espelho PDF (Teste NF-e)
          </DialogTitle>
          <DialogDescription className="text-xs">
            Gera um PDF estruturado com código interno novo e marca d&apos;água <strong>SEM VALOR FISCAL</strong> para validar o layout antes de integrar a emissão oficial NF-e na SEFAZ.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-2.5 flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>Documento exclusivo para testes/conferência — não possui chave SEFAZ nem validade fiscal.</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Emitente</Label>
              <Select value={issuerKey} onValueChange={(v: any) => setIssuerKey(v)}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="moc">LIMA MOTORS SHINERAY MOC</SelectItem>
                  <SelectItem value="multimarcas">L1MA MOTORS MULTIMARCAS</SelectItem>
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
              <Label className="text-xs font-semibold">UF</Label>
              <Input value={customerUf} onChange={(e) => setCustomerUf(e.target.value.toUpperCase().slice(0, 2))} placeholder="MG" className="h-9 text-xs uppercase" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs font-semibold">Forma de Pagamento</Label>
              <Input value={paymentDescription} onChange={(e) => setPaymentDescription(e.target.value)} className="h-9 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Valor Total (R$) *</Label>
              <Input value={totalValueStr} onChange={(e) => setTotalValueStr(e.target.value)} placeholder="4.500,00" className="h-9 text-xs font-mono" />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold">Descrição Completa do Produto / Moto *</Label>
            <Textarea
              rows={3}
              value={productDescription}
              onChange={(e) => setProductDescription(e.target.value)}
              placeholder="Ex: MOTO ELETRICA QUATRO E 500W - COR: BRANCA - NUMERO MOTOR: FV1582026BR"
              className="text-xs"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">NCM/SH</Label>
              <Input value={ncm} onChange={(e) => setNcm(e.target.value)} className="h-9 text-xs font-mono" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">CFOP</Label>
              <Input value={cfop} onChange={(e) => setCfop(e.target.value)} className="h-9 text-xs font-mono" />
            </div>
            <div className="space-y-1 col-span-2 sm:col-span-1">
              <Label className="text-xs font-semibold">Telefone Cliente</Label>
              <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="(38) 99999-0000" className="h-9 text-xs" />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold">Informações Complementares</Label>
            <Input value={additionalInfo} onChange={(e) => setAdditionalInfo(e.target.value)} className="h-9 text-xs" />
          </div>
        </div>

        <DialogFooter className="px-5 py-3 border-t bg-muted/20 shrink-0 gap-2 sm:gap-0">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button type="button" size="sm" onClick={handleGenerate} className="gap-1.5 font-bold">
            <Download className="w-3.5 h-3.5" />
            Baixar Prévia PDF (Sem Valor Fiscal)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
