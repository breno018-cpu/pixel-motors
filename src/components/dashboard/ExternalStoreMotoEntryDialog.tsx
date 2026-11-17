import { useState } from 'react';
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
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useStores } from '@/hooks/useStores';
import { useQueryClient } from '@tanstack/react-query';
import {
  Store,
  Bike,
  Building2,
  FileText,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  Truck,
  Sparkles,
  ShieldCheck,
  Tag,
} from 'lucide-react';
import { addExternalStoreMotoToStock } from '@/lib/stockTransfersManager';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const SHINERAY_MODELS = [
  'SHI 175 EFI',
  'NEW SHI 175 EFI',
  'JET 125',
  'NEW JET 125',
  'PHOENIX 50',
  'TITANIUM 250',
  'SHI 250 EFI',
  'JEF 150',
  'FREE 150',
  'NEW FREE 170',
  'SBM 250S',
  'SHE S (Elétrica)',
  'SE1 (Elétrica)',
  'OUTRO MODELO',
];

const COLORS_LIST = [
  'Preta',
  'Preta Fosca',
  'Branca',
  'Branca Perolizada',
  'Vermelha',
  'Azul',
  'Cinza Nardo',
  'Prata',
  'Amarela',
];

export function ExternalStoreMotoEntryDialog({ open, onOpenChange, onSuccess }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: stores = [] } = useStores();

  const [chassis, setChassis] = useState('');
  const [model, setModel] = useState('SHI 175 EFI');
  const [customModel, setCustomModel] = useState('');
  const [color, setColor] = useState('Preta');
  const [year, setYear] = useState(2025);
  const [condition, setCondition] = useState<'0km' | 'seminova'>('0km');
  const [mileage, setMileage] = useState(0);

  // Loja de Origem Externa (Sem App)
  const [externalStoreName, setExternalStoreName] = useState('');
  const [externalStoreCity, setExternalStoreCity] = useState('');
  const [externalStoreCnpj, setExternalStoreCnpj] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');

  // Loja de Destino da Nossa Rede
  const [destinationStoreId, setDestinationStoreId] = useState('store-divinopolis');

  // Valores
  const [agreedAmount, setAgreedAmount] = useState<number>(14000);
  const [salePrice, setSalePrice] = useState<number>(17990);
  const [pdiChecked, setPdiChecked] = useState(true);
  const [notes, setNotes] = useState('');

  const [saving, setSaving] = useState(false);

  const finalModel = model === 'OUTRO MODELO' ? customModel.trim() : model;

  const handleSave = async () => {
    if (!chassis.trim()) {
      toast({
        title: 'Chassi Obrigatório',
        description: 'Informe o número do chassi da motocicleta.',
        variant: 'destructive',
      });
      return;
    }

    if (!externalStoreName.trim()) {
      toast({
        title: 'Nome da Loja Externa Obrigatório',
        description: 'Identifique de qual loja parceira a moto veio (loja que não usa o app).',
        variant: 'destructive',
      });
      return;
    }

    if (!externalStoreCity.trim()) {
      toast({
        title: 'Cidade de Origem Obrigatória',
        description: 'Informe a cidade/UF da loja que enviou a moto.',
        variant: 'destructive',
      });
      return;
    }

    if (!finalModel) {
      toast({
        title: 'Modelo Obrigatório',
        description: 'Selecione ou digite o modelo da motocicleta.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const selectedStore = stores.find((s) => s.id === destinationStoreId);
      const destStoreName = selectedStore?.name || 'Shineray & Multimarcas Divinópolis';

      await addExternalStoreMotoToStock({
        chassis: chassis.trim().toUpperCase(),
        model: finalModel,
        color,
        year: Number(year) || 2025,
        externalStoreName: externalStoreName.trim(),
        externalStoreCity: externalStoreCity.trim(),
        externalStoreCnpj: externalStoreCnpj.trim() || undefined,
        destinationStoreId,
        destinationStoreName: destStoreName,
        invoiceNumber: invoiceNumber.trim() || undefined,
        agreedAmount: Number(agreedAmount) || 0,
        salePrice: Number(salePrice) || 0,
        mileage: condition === '0km' ? 0 : Number(mileage) || 0,
        condition,
        notes: notes.trim(),
      });

      // Invalida queries para atualização imediata dos estoques e transferências
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['vehicle-stats'] });
      queryClient.invalidateQueries({ queryKey: ['stock-transfers'] });

      toast({
        title: 'Moto Adicionada ao Estoque!',
        description: `${finalModel} (Chassi: ${chassis.toUpperCase()}) registrada com origem externa e alocada no pátio de ${destStoreName}.`,
      });

      onSuccess?.();
      onOpenChange(false);
      resetForm();
    } catch (err: any) {
      toast({
        title: 'Erro ao Adicionar Moto',
        description: err?.message || 'Falha ao registrar a entrada no estoque.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setChassis('');
    setModel('SHI 175 EFI');
    setCustomModel('');
    setColor('Preta');
    setExternalStoreName('');
    setExternalStoreCity('');
    setExternalStoreCnpj('');
    setInvoiceNumber('');
    setNotes('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="pb-3 border-b border-border/70">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center shrink-0 text-emerald-600 dark:text-emerald-400">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold font-display text-foreground flex items-center gap-2">
                Entrada de Moto no Estoque
                <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                  Origem: Loja Externa (Sem App)
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Cadastre a motocicleta recebida de outra concessionária ou filial parceira que não utiliza o aplicativo Dealflow.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* SEÇÃO 1: LOJA DE ORIGEM (SEM APP) E DESTINO */}
          <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/60 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <Building2 className="w-4 h-4 text-primary" />
              <span>Dados de Procedência da Loja Externa</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">
                  Nome da Loja Parceira de Origem <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={externalStoreName}
                  onChange={(e) => setExternalStoreName(e.target.value)}
                  placeholder="Ex: Shineray BH Matriz, Moto Norte Pirapora..."
                  className="h-8 text-xs font-medium"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">
                  Cidade / UF de Origem <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={externalStoreCity}
                  onChange={(e) => setExternalStoreCity(e.target.value)}
                  placeholder="Ex: Belo Horizonte - MG, Pirapora - MG..."
                  className="h-8 text-xs font-medium"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">CNPJ / Documento da Loja (Opcional)</Label>
                <Input
                  value={externalStoreCnpj}
                  onChange={(e) => setExternalStoreCnpj(e.target.value)}
                  placeholder="00.000.000/0000-00"
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Nº da Nota Fiscal / Guia de Transferência</Label>
                <Input
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="Ex: NF-e 004812"
                  className="h-8 text-xs font-bold"
                />
              </div>

              <div className="sm:col-span-2 space-y-1 pt-1 border-t border-border/50">
                <Label className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <Truck className="w-3.5 h-3.5" />
                  Loja de Destino na Nossa Rede (Onde a moto entrará no pátio)
                </Label>
                <Select value={destinationStoreId} onValueChange={setDestinationStoreId}>
                  <SelectTrigger className="h-8 text-xs font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="store-divinopolis">
                      Shineray &amp; Multimarcas Divinópolis (Matriz)
                    </SelectItem>
                    <SelectItem value="store-montesclaros">
                      Shineray Montes Claros (Filial Norte)
                    </SelectItem>
                    {stores
                      .filter((s) => s.id !== 'store-divinopolis' && s.id !== 'store-montesclaros')
                      .map((st) => (
                        <SelectItem key={st.id} value={st.id}>
                          {st.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* SEÇÃO 2: DADOS DA MOTOCICLETA */}
          <div className="p-3.5 rounded-2xl bg-card border border-border/70 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <Bike className="w-4 h-4 text-emerald-600" />
              <span>Especificações da Motocicleta</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="sm:col-span-2 space-y-1">
                <Label className="text-xs font-semibold">
                  Chassi / VIN da Motocicleta <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={chassis}
                  onChange={(e) => setChassis(e.target.value.toUpperCase())}
                  placeholder="Ex: 95VJA1250RB001188"
                  className="h-8 text-xs font-mono font-bold uppercase"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Condição</Label>
                <Select
                  value={condition}
                  onValueChange={(v) => setCondition(v as '0km' | 'seminova')}
                >
                  <SelectTrigger className="h-8 text-xs font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0km">0km / Nova de Fábrica</SelectItem>
                    <SelectItem value="seminova">Seminova / Usada</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Modelo</Label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger className="h-8 text-xs font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SHINERAY_MODELS.map((m) => (
                      <SelectItem key={m} value={m} className="text-xs font-medium">
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {model === 'OUTRO MODELO' && (
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Especifique o Modelo</Label>
                  <Input
                    value={customModel}
                    onChange={(e) => setCustomModel(e.target.value)}
                    placeholder="Digite o modelo..."
                    className="h-8 text-xs"
                  />
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Cor</Label>
                <Select value={color} onValueChange={setColor}>
                  <SelectTrigger className="h-8 text-xs font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COLORS_LIST.map((c) => (
                      <SelectItem key={c} value={c} className="text-xs">
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Ano Fabricação/Modelo</Label>
                <Input
                  type="number"
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value) || 2025)}
                  className="h-8 text-xs font-bold"
                />
              </div>

              {condition === 'seminova' && (
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">KM Atual</Label>
                  <Input
                    type="number"
                    value={mileage}
                    onChange={(e) => setMileage(Number(e.target.value) || 0)}
                    className="h-8 text-xs"
                  />
                </div>
              )}
            </div>
          </div>

          {/* SEÇÃO 3: VALORES FINANCEIROS & REPASSE */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-muted/40 border border-border/60">
            <div className="space-y-1">
              <Label className="text-xs font-semibold flex items-center gap-1 text-foreground">
                <DollarSign className="w-3.5 h-3.5 text-primary" />
                Valor de Custo / Repasse da Moto (R$)
              </Label>
              <Input
                type="number"
                step="50"
                value={agreedAmount}
                onChange={(e) => setAgreedAmount(Number(e.target.value) || 0)}
                className="h-8 text-xs font-bold text-foreground"
              />
              <span className="text-[10px] text-muted-foreground block">
                Valor pago ou acordado com a loja externa cedente.
              </span>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <Tag className="w-3.5 h-3.5 text-emerald-600" />
                Preço Sugerido de Venda no Pátio (R$)
              </Label>
              <Input
                type="number"
                step="50"
                value={salePrice}
                onChange={(e) => setSalePrice(Number(e.target.value) || 0)}
                className="h-8 text-xs font-bold text-emerald-600 dark:text-emerald-400"
              />
              <span className="text-[10px] text-muted-foreground block">
                Margem prevista: R$ {(salePrice - agreedAmount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="sm:col-span-2 space-y-1 pt-1">
              <Label className="text-xs font-semibold">Observações / Termo de Recebimento</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Moto recebida sem avarias, manual e chave reserva inclusos, bateria ativada..."
                className="text-xs min-h-[55px]"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="pt-3 border-t border-border/60">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="h-8 text-xs"
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs gap-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            {saving ? 'Registrando...' : 'Confirmar Entrada no Estoque'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
