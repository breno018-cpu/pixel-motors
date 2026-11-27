import { useEffect, useMemo, useState } from 'react';
import {
  FileText,
  Download,
  Plus,
  Copy,
  Trash2,
  RotateCcw,
  CheckCircle2,
  History,
  Edit3,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import {
  COUNTER_RECEIPT_VARIABLES,
  CounterReceiptData,
  CounterReceiptTemplate,
  DEFAULT_COUNTER_TEMPLATES,
  formatBRL,
  generateCounterReceiptPdf,
  resolveCounterReceiptBody,
} from '@/lib/counterReceiptPdf';

const TEMPLATES_STORAGE_KEY = 'dealflow_counter_receipt_templates_v1';
const HISTORY_STORAGE_KEY = 'dealflow_counter_receipt_history_v1';
const SEQUENCE_STORAGE_KEY = 'dealflow_counter_receipt_seq_v1';

interface StorePreset {
  id: string;
  label: string;
  name: string;
  cnpj: string;
  address: string;
  cityUf: string;
  phone: string;
}

const STORE_PRESETS: StorePreset[] = [
  {
    id: 'moc',
    label: 'Shineray Montes Claros',
    name: 'LIMA MOTORS SHINERAY MONTES CLAROS LTDA',
    cnpj: '53.197.043/0001-75',
    address: 'Avenida João XXIII, 990 - Loja 5A - Edgar Pereira',
    cityUf: 'MONTES CLAROS - MG',
    phone: '(38) 99938-1522',
  },
  {
    id: 'div',
    label: 'Shineray Divinópolis',
    name: 'LIMA MOTORS SHINERAY DIVINÓPOLIS LTDA',
    cnpj: '53.197.043/0001-75',
    address: 'Av. Primeiro de Junho - Centro',
    cityUf: 'DIVINÓPOLIS - MG',
    phone: '(37) 99999-0000',
  },
  {
    id: 'mlt',
    label: 'L1MA Motors Multimarcas',
    name: 'L1MA MOTORS MULTIMARCAS LTDA',
    cnpj: '53.197.043/0001-75',
    address: 'Avenida João XXIII, 990 - Edgar Pereira',
    cityUf: 'MONTES CLAROS - MG',
    phone: '(38) 99938-1522',
  },
];

function getNextReceiptNumber(seq: number): string {
  const year = new Date().getFullYear();
  return `REC-${year}-${String(seq).padStart(4, '0')}`;
}

function getTodayBr(): string {
  return new Date().toLocaleDateString('pt-BR');
}

export default function CounterReceipts() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'emitir' | 'modelos' | 'historico'>('emitir');

  // Modelos editáveis (persistidos localmente)
  const [templates, setTemplates] = useState<CounterReceiptTemplate[]>(() => {
    try {
      const saved = localStorage.getItem(TEMPLATES_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback default
    }
    return DEFAULT_COUNTER_TEMPLATES;
  });

  // Histórico de recibos emitidos
  const [history, setHistory] = useState<CounterReceiptData[]>(() => {
    try {
      const saved = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // fallback empty
    }
    return [];
  });

  // Sequencial interno (REC-YYYY-0001)
  const [sequence, setSequence] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem(SEQUENCE_STORAGE_KEY));
      if (Number.isFinite(saved) && saved >= 1) return saved;
    } catch {
      // ignore
    }
    return 1;
  });

  useEffect(() => {
    try {
      localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
    } catch {
      // ignore
    }
  }, [templates]);

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
    } catch {
      // ignore
    }
  }, [history]);

  useEffect(() => {
    try {
      localStorage.setItem(SEQUENCE_STORAGE_KEY, String(sequence));
    } catch {
      // ignore
    }
  }, [sequence]);

  // Estado do formulário de emissão
  const [selectedStoreId, setSelectedStoreId] = useState<string>('moc');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(templates[0]?.id || '');
  const [issueDate, setIssueDate] = useState<string>(getTodayBr());

  const initialStore = STORE_PRESETS[0];
  const [storeName, setStoreName] = useState(initialStore.name);
  const [storeCnpj, setStoreCnpj] = useState(initialStore.cnpj);
  const [storeAddress, setStoreAddress] = useState(initialStore.address);
  const [storeCityUf, setStoreCityUf] = useState(initialStore.cityUf);
  const [storePhone, setStorePhone] = useState(initialStore.phone);

  const [customerName, setCustomerName] = useState('');
  const [customerDocument, setCustomerDocument] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerNeighborhood, setCustomerNeighborhood] = useState('');
  const [customerCep, setCustomerCep] = useState('');
  const [customerCity, setCustomerCity] = useState('MONTES CLAROS');
  const [customerUf, setCustomerUf] = useState('MG');

  const [productDescription, setProductDescription] = useState('MOTO ELÉTRICA QUATRO E 500W — BATERIA DE LÍTIO');
  const [productColor, setProductColor] = useState('BRANCA');
  const [productSerial, setProductSerial] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [unitValue, setUnitValue] = useState<number>(4500);
  const [paymentMethod, setPaymentMethod] = useState('À Vista - Dinheiro / PIX');
  const [notes, setNotes] = useState('VEÍCULO ENTREGUE E QUITADO NO ATO.');

  // Estado do editor de modelos
  const [editingTemplateId, setEditingTemplateId] = useState<string>(templates[0]?.id || '');
  const editingTemplate = useMemo(
    () => templates.find((t) => t.id === editingTemplateId) || templates[0],
    [templates, editingTemplateId]
  );

  // Filtro do histórico
  const [historySearch, setHistorySearch] = useState('');

  const handleSelectStore = (id: string) => {
    setSelectedStoreId(id);
    const preset = STORE_PRESETS.find((s) => s.id === id);
    if (preset) {
      setStoreName(preset.name);
      setStoreCnpj(preset.cnpj);
      setStoreAddress(preset.address);
      setStoreCityUf(preset.cityUf);
      setStorePhone(preset.phone);
    }
  };

  const activeTemplate = useMemo(
    () => templates.find((t) => t.id === selectedTemplateId) || templates[0],
    [templates, selectedTemplateId]
  );

  const totalValue = useMemo(() => Math.max(0, (quantity || 1) * (unitValue || 0)), [quantity, unitValue]);
  const currentReceiptNumber = useMemo(() => getNextReceiptNumber(sequence), [sequence]);

  const draftDataWithoutBody = useMemo(
    () => ({
      receiptNumber: currentReceiptNumber,
      issueDate,
      storeName,
      storeCnpj,
      storeAddress,
      storeCityUf,
      storePhone,
      customerName,
      customerDocument,
      customerAddress,
      customerNeighborhood,
      customerCep,
      customerCity,
      customerUf,
      customerPhone,
      productDescription,
      productColor,
      productSerial,
      quantity: quantity || 1,
      unitValue: unitValue || 0,
      totalValue,
      paymentMethod,
      notes,
      templateName: activeTemplate?.name || 'Recibo de Balcão',
    }),
    [
      currentReceiptNumber,
      issueDate,
      storeName,
      storeCnpj,
      storeAddress,
      storeCityUf,
      storePhone,
      customerName,
      customerDocument,
      customerAddress,
      customerNeighborhood,
      customerCep,
      customerCity,
      customerUf,
      customerPhone,
      productDescription,
      productColor,
      productSerial,
      quantity,
      unitValue,
      totalValue,
      paymentMethod,
      notes,
      activeTemplate,
    ]
  );

  const renderedPreview = useMemo(() => {
    if (!activeTemplate) return '';
    return resolveCounterReceiptBody(activeTemplate.body, draftDataWithoutBody);
  }, [activeTemplate, draftDataWithoutBody]);

  const handleGeneratePdf = () => {
    if (!customerName.trim()) {
      toast({
        title: 'Informe o nome do cliente',
        description: 'Preencha ao menos o nome do cliente antes de gerar o PDF.',
        variant: 'destructive',
      });
      return;
    }

    const finalDoc: CounterReceiptData = {
      ...draftDataWithoutBody,
      renderedBody: renderedPreview,
    };

    generateCounterReceiptPdf(finalDoc);
    setHistory((prev) => [finalDoc, ...prev]);
    setSequence((prev) => prev + 1);

    toast({
      title: `Recibo ${finalDoc.receiptNumber} gerado`,
      description: 'PDF baixado e salvo automaticamente no histórico.',
    });
  };

  // Ações de modelos
  const handleUpdateEditingTemplate = (patch: Partial<CounterReceiptTemplate>) => {
    if (!editingTemplate) return;
    setTemplates((prev) =>
      prev.map((t) =>
        t.id === editingTemplate.id
          ? { ...t, ...patch, updatedAt: new Date().toISOString() }
          : t
      )
    );
  };

  const handleCreateTemplate = () => {
    const newTpl: CounterReceiptTemplate = {
      id: `tpl-${Date.now()}`,
      name: `Novo Modelo (${templates.length + 1})`,
      subtitle: 'Modelo personalizado de recibo interno de balcão',
      body: DEFAULT_COUNTER_TEMPLATES[1].body,
      updatedAt: new Date().toISOString(),
    };
    setTemplates((prev) => [...prev, newTpl]);
    setEditingTemplateId(newTpl.id);
    toast({ title: 'Novo modelo criado', description: 'Personalize o texto e as variáveis livremente.' });
  };

  const handleDuplicateTemplate = (tpl: CounterReceiptTemplate) => {
    const copy: CounterReceiptTemplate = {
      ...tpl,
      id: `tpl-${Date.now()}`,
      name: `${tpl.name} (Cópia)`,
      updatedAt: new Date().toISOString(),
    };
    setTemplates((prev) => [...prev, copy]);
    setEditingTemplateId(copy.id);
    toast({ title: 'Modelo duplicado' });
  };

  const handleDeleteTemplate = (id: string) => {
    if (templates.length <= 1) {
      toast({
        title: 'Ação bloqueada',
        description: 'É necessário manter pelo menos um modelo ativo.',
        variant: 'destructive',
      });
      return;
    }
    const next = templates.filter((t) => t.id !== id);
    setTemplates(next);
    if (editingTemplateId === id) setEditingTemplateId(next[0].id);
    if (selectedTemplateId === id) setSelectedTemplateId(next[0].id);
    toast({ title: 'Modelo removido' });
  };

  const handleResetDefaultTemplates = () => {
    setTemplates(DEFAULT_COUNTER_TEMPLATES);
    setEditingTemplateId(DEFAULT_COUNTER_TEMPLATES[0].id);
    setSelectedTemplateId(DEFAULT_COUNTER_TEMPLATES[0].id);
    toast({ title: 'Modelos padrão restaurados' });
  };

  const handleInsertVariable = (token: string) => {
    if (!editingTemplate) return;
    handleUpdateEditingTemplate({
      body: `${editingTemplate.body}${editingTemplate.body.endsWith(' ') ? '' : ' '}${token}`,
    });
  };

  const filteredHistory = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    if (!q) return history;
    return history.filter(
      (item) =>
        item.receiptNumber.toLowerCase().includes(q) ||
        item.customerName.toLowerCase().includes(q) ||
        item.customerDocument.toLowerCase().includes(q) ||
        item.productDescription.toLowerCase().includes(q)
    );
  }, [history, historySearch]);

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Recibo de Balcão"
        description="Módulo administrativo exclusivo (Dono, Gerente e Admin) para modelos editáveis e emissão de comprovantes internos de balcão em PDF."
        actions={
          <Badge variant="outline" className="gap-1.5 px-3 py-1 text-xs border-amber-500/40 text-amber-600 dark:text-amber-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            Acesso Restrito: Dono / Gerente / Admin
          </Badge>
        }
      />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="space-y-4">
        <TabsList className="grid w-full max-w-lg grid-cols-3">
          <TabsTrigger value="emitir" className="gap-1.5">
            <FileText className="w-4 h-4" />
            Emitir Recibo
          </TabsTrigger>
          <TabsTrigger value="modelos" className="gap-1.5">
            <Edit3 className="w-4 h-4" />
            Modelos ({templates.length})
          </TabsTrigger>
          <TabsTrigger value="historico" className="gap-1.5">
            <History className="w-4 h-4" />
            Histórico ({history.length})
          </TabsTrigger>
        </TabsList>

        {/* =============================================================== */}
        {/* ABA 1: EMITIR RECIBO + PRÉVIA AO VIVO                           */}
        {/* =============================================================== */}
        <TabsContent value="emitir" className="space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            {/* Formulário */}
            <Card className="xl:col-span-7">
              <CardHeader className="pb-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">Dados do Recibo de Balcão</CardTitle>
                    <CardDescription>
                      Preencha os campos abaixo; o texto do modelo selecionado é atualizado automaticamente.
                    </CardDescription>
                  </div>
                  <Badge variant="secondary" className="font-mono text-xs">
                    Próximo Nº: {currentReceiptNumber}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Seleção de Loja, Modelo e Data */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Loja / Emitente</Label>
                    <Select value={selectedStoreId} onValueChange={handleSelectStore}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STORE_PRESETS.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Modelo de Texto</Label>
                    <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Data de Emissão</Label>
                    <Input value={issueDate} onChange={(e) => setIssueDate(e.target.value)} placeholder="DD/MM/AAAA" />
                  </div>
                </div>

                {/* Dados do Cliente */}
                <div className="space-y-3 pt-2 border-t">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    1. Dados do Cliente
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs">Nome Completo / Razão Social *</Label>
                      <Input
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Ex: Maria Silva Santos"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">CPF / CNPJ</Label>
                      <Input
                        value={customerDocument}
                        onChange={(e) => setCustomerDocument(e.target.value)}
                        placeholder="000.000.000-00"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Telefone / WhatsApp</Label>
                      <Input
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="(38) 99999-0000"
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs">Endereço (Rua, Nº)</Label>
                      <Input
                        value={customerAddress}
                        onChange={(e) => setCustomerAddress(e.target.value)}
                        placeholder="Rua Exemplo, 100"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Bairro</Label>
                      <Input
                        value={customerNeighborhood}
                        onChange={(e) => setCustomerNeighborhood(e.target.value)}
                        placeholder="Centro"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">CEP</Label>
                      <Input
                        value={customerCep}
                        onChange={(e) => setCustomerCep(e.target.value)}
                        placeholder="39400-000"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Cidade</Label>
                      <Input value={customerCity} onChange={(e) => setCustomerCity(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">UF</Label>
                      <Input
                        value={customerUf}
                        onChange={(e) => setCustomerUf(e.target.value.toUpperCase().slice(0, 2))}
                        maxLength={2}
                      />
                    </div>
                  </div>
                </div>

                {/* Dados do Item / Pagamento */}
                <div className="space-y-3 pt-2 border-t">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    2. Item / Veículo e Pagamento
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1.5 sm:col-span-3">
                      <Label className="text-xs">Descrição do Produto / Moto</Label>
                      <Input
                        value={productDescription}
                        onChange={(e) => setProductDescription(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Cor</Label>
                      <Input value={productColor} onChange={(e) => setProductColor(e.target.value)} />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs">Nº Motor / Chassi / Série</Label>
                      <Input
                        value={productSerial}
                        onChange={(e) => setProductSerial(e.target.value)}
                        placeholder="Ex: FV1582026BR"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Quantidade</Label>
                      <Input
                        type="number"
                        min={1}
                        value={quantity}
                        onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Valor Unitário (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        value={unitValue}
                        onChange={(e) => setUnitValue(Math.max(0, Number(e.target.value) || 0))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Valor Total</Label>
                      <Input readOnly value={`R$ ${formatBRL(totalValue)}`} className="font-semibold bg-muted/50" />
                    </div>
                    <div className="space-y-1.5 sm:col-span-3">
                      <Label className="text-xs">Forma de Pagamento</Label>
                      <Input value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} />
                    </div>
                    <div className="space-y-1.5 sm:col-span-3">
                      <Label className="text-xs">Observações</Label>
                      <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                  <Button onClick={handleGeneratePdf} className="gap-2">
                    <Download className="w-4 h-4" />
                    Gerar e Baixar PDF ({currentReceiptNumber})
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Pré-visualização ao vivo */}
            <Card className="xl:col-span-5 flex flex-col">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Prévia do Documento</CardTitle>
                <CardDescription>
                  Visualização em tempo real do texto preenchido antes de exportar o PDF.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col gap-3">
                <div className="rounded-lg border bg-white text-zinc-900 p-5 shadow-sm space-y-4 text-xs leading-relaxed">
                  <div className="flex items-start justify-between border-b pb-3 gap-2">
                    <div>
                      <p className="font-bold text-sm text-zinc-900">RECIBO / COMPROVANTE DE BALCÃO</p>
                      <p className="font-medium text-zinc-700">{storeName}</p>
                      <p className="text-[11px] text-zinc-500">CNPJ: {storeCnpj} • {storeCityUf}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono font-bold text-zinc-900">{currentReceiptNumber}</p>
                      <p className="text-[11px] text-zinc-500">{issueDate}</p>
                    </div>
                  </div>

                  <div className="rounded bg-amber-50 border border-amber-300 px-2.5 py-1.5 text-[10px] font-semibold text-amber-800 text-center">
                    COMPROVANTE ADMINISTRATIVO DE BALCÃO — SEM VALOR FISCAL (NÃO SUBSTITUI NF-e)
                  </div>

                  <div className="whitespace-pre-wrap text-[12px] text-zinc-800 min-h-[220px]">
                    {renderedPreview}
                  </div>

                  <div className="grid grid-cols-2 gap-6 pt-6 border-t text-center text-[10px] text-zinc-600">
                    <div>
                      <div className="border-t border-zinc-400 pt-1 font-medium text-zinc-800 truncate">
                        {storeName}
                      </div>
                      <span>Emitente</span>
                    </div>
                    <div>
                      <div className="border-t border-zinc-400 pt-1 font-medium text-zinc-800 truncate">
                        {customerName || 'Cliente / Comprador'}
                      </div>
                      <span>Comprador</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* =============================================================== */}
        {/* ABA 2: MODELOS EDITÁVEIS (IGUAL A CONTRATOS)                    */}
        {/* =============================================================== */}
        <TabsContent value="modelos" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Lista de modelos */}
            <Card className="lg:col-span-4">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">Seus Modelos</CardTitle>
                  <Button size="sm" onClick={handleCreateTemplate} className="gap-1.5 h-8">
                    <Plus className="w-3.5 h-3.5" />
                    Novo
                  </Button>
                </div>
                <CardDescription>
                  Crie ou personalize quantos modelos de recibo precisar.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {templates.map((tpl) => {
                  const isSelected = editingTemplate?.id === tpl.id;
                  return (
                    <div
                      key={tpl.id}
                      onClick={() => setEditingTemplateId(tpl.id)}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{tpl.name}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1">{tpl.subtitle}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Duplicar"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDuplicateTemplate(tpl);
                            }}
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            title="Excluir"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTemplate(tpl.id);
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetDefaultTemplates}
                  className="w-full mt-3 gap-1.5 text-xs"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Restaurar Modelos Padrão
                </Button>
              </CardContent>
            </Card>

            {/* Editor do modelo selecionado */}
            <Card className="lg:col-span-8">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Editor de Modelo</CardTitle>
                <CardDescription>
                  Clique em qualquer variável abaixo para inseri-la no texto. As alterações são salvas automaticamente.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {editingTemplate && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Nome do Modelo</Label>
                        <Input
                          value={editingTemplate.name}
                          onChange={(e) => handleUpdateEditingTemplate({ name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Descrição Curta</Label>
                        <Input
                          value={editingTemplate.subtitle}
                          onChange={(e) => handleUpdateEditingTemplate({ subtitle: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Variáveis Dinâmicas (clique para inserir)</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {COUNTER_RECEIPT_VARIABLES.map((v) => (
                          <Button
                            key={v.token}
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-[11px] font-mono px-2"
                            onClick={() => handleInsertVariable(v.token)}
                          >
                            {v.label}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Corpo do Documento</Label>
                      <Textarea
                        rows={14}
                        className="font-mono text-xs leading-relaxed"
                        value={editingTemplate.body}
                        onChange={(e) => handleUpdateEditingTemplate({ body: e.target.value })}
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Salvo automaticamente neste navegador
                      </span>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setSelectedTemplateId(editingTemplate.id);
                          setActiveTab('emitir');
                        }}
                      >
                        Usar este modelo agora
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* =============================================================== */}
        {/* ABA 3: HISTÓRICO DE RECIBOS EMITIDOS                            */}
        {/* =============================================================== */}
        <TabsContent value="historico" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Histórico de Recibos Emitidos</CardTitle>
                  <CardDescription>
                    Baixe novamente a 2ª via em PDF de qualquer recibo de balcão gerado.
                  </CardDescription>
                </div>
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
                  <Input
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    placeholder="Buscar por nº, cliente, CPF ou moto..."
                    className="pl-8 h-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredHistory.length === 0 ? (
                <div className="text-center py-10 text-sm text-muted-foreground">
                  Nenhum recibo de balcão emitido ainda.
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nº Interno</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right">Valor Total</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredHistory.map((item) => (
                        <TableRow key={item.receiptNumber}>
                          <TableCell className="font-mono font-medium text-xs">
                            {item.receiptNumber}
                          </TableCell>
                          <TableCell className="text-xs">{item.issueDate}</TableCell>
                          <TableCell>
                            <div className="text-xs font-medium">{item.customerName}</div>
                            <div className="text-[11px] text-muted-foreground">{item.customerDocument || '—'}</div>
                          </TableCell>
                          <TableCell className="text-xs max-w-[240px] truncate">
                            {item.productDescription}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-xs">
                            R$ {formatBRL(item.totalValue)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="inline-flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 gap-1 text-xs"
                                onClick={() => generateCounterReceiptPdf(item)}
                              >
                                <Download className="w-3.5 h-3.5" />
                                PDF
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() =>
                                  setHistory((prev) =>
                                    prev.filter((r) => r.receiptNumber !== item.receiptNumber)
                                  )
                                }
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
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
    </div>
  );
}
