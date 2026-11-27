import { useEffect, useMemo, useRef, useState } from 'react';
import { DocxLivePreviewFrame } from '@/components/documents/DocxLivePreviewFrame';
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
  Upload,
  FileUp,
  Printer,
  Sparkles,
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
  buildCounterReceiptVariableMap,
  COUNTER_RECEIPT_VARIABLES,
  CounterReceiptData,
  CounterReceiptTemplate,
  DEFAULT_COUNTER_TEMPLATES,
  formatBRL,
  generateCounterReceiptPdf,
  resolveCounterReceiptBody,
} from '@/lib/counterReceiptPdf';
import {
  applyDocxTextBlockEdits,
  deleteDocxTemplateBlob,
  DocxTextBlock,
  downloadDocxBlob,
  extractDocxTextBlocks,
  fillDocxTemplate,
  getDocxTemplateBlob,
  inspectDocxPlaceholders,
  saveDocxTemplateBlob,
} from '@/lib/counterReceiptDocx';

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

const STANDARD_TOKEN_KEYS = new Set([
  'numero_recibo',
  'data_emissao',
  'loja_nome',
  'loja_cnpj',
  'loja_endereco',
  'loja_telefone',
  'cliente_nome',
  'cliente_documento',
  'cliente_endereco',
  'cliente_logradouro',
  'cliente_bairro',
  'cliente_cep',
  'cliente_cidade',
  'cliente_uf',
  'cliente_cidade_uf',
  'cliente_telefone',
  'produto_descricao',
  'produto_cor',
  'produto_motor_chassi',
  'quantidade',
  'valor_unitario',
  'valor_total',
  'forma_pagamento',
  'observacoes',
]);

function getNextReceiptNumber(seq: number): string {
  const year = new Date().getFullYear();
  return `REC-${year}-${String(seq).padStart(4, '0')}`;
}

function getTodayBr(): string {
  return new Date().toLocaleDateString('pt-BR');
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function CounterReceipts() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'emitir' | 'modelos' | 'historico'>('emitir');
  const docxUploadInputRef = useRef<HTMLInputElement | null>(null);
  const docxReplaceInputRef = useRef<HTMLInputElement | null>(null);
  const emitPreviewIframeRef = useRef<HTMLIFrameElement | null>(null);
  const [emitDocxBlob, setEmitDocxBlob] = useState<Blob | null>(null);
  const [editorDocxBlob, setEditorDocxBlob] = useState<Blob | null>(null);
  const [docxRevision, setDocxRevision] = useState(0);
  const [docxBlocks, setDocxBlocks] = useState<DocxTextBlock[]>([]);
  const [docxBlockEdits, setDocxBlockEdits] = useState<Record<string, string>>({});
  const [docxBlockSearch, setDocxBlockSearch] = useState('');
  const [focusedDocxBlockKey, setFocusedDocxBlockKey] = useState<string | null>(null);
  const [isRenderingEditorDocx, setIsRenderingEditorDocx] = useState(false);
  const [editorDocxMissing, setEditorDocxMissing] = useState(false);

  // Modelos editáveis (texto + Word .docx)
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

  // Campos personalizados detectados em modelos .docx (ex: {{vendedor}}, {{garantia}})
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});
  const [isRenderingDocx, setIsRenderingDocx] = useState(false);

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
  const isActiveDocx = activeTemplate?.kind === 'docx';

  // Variáveis customizadas (além das padrões) encontradas no .docx selecionado
  const extraDocxTokens = useMemo(() => {
    if (!isActiveDocx || !activeTemplate?.detectedVariables) return [];
    return activeTemplate.detectedVariables.filter((token) => {
      const clean = token.replace(/^\{\{\s*|\s*\}\}$/g, '').trim();
      return !STANDARD_TOKEN_KEYS.has(clean);
    });
  }, [isActiveDocx, activeTemplate]);

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

  const variableMap = useMemo(
    () => buildCounterReceiptVariableMap(draftDataWithoutBody, customFieldValues),
    [draftDataWithoutBody, customFieldValues]
  );

  const renderedPreview = useMemo(() => {
    if (!activeTemplate || isActiveDocx) return '';
    return resolveCounterReceiptBody(activeTemplate.body, draftDataWithoutBody);
  }, [activeTemplate, isActiveDocx, draftDataWithoutBody]);

  // Gera o Blob .docx preenchido em tempo real para o iframe isolado da aba Emitir
  useEffect(() => {
    if (activeTab !== 'emitir' || !isActiveDocx || !activeTemplate) {
      setEmitDocxBlob(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsRenderingDocx(true);
      try {
        const buffer = await getDocxTemplateBlob(activeTemplate.id);
        if (!buffer || cancelled) {
          if (!cancelled) setEmitDocxBlob(null);
          return;
        }
        const filledBlob = await fillDocxTemplate(buffer, variableMap);
        if (!cancelled) setEmitDocxBlob(filledBlob);
      } catch {
        if (!cancelled) setEmitDocxBlob(null);
      } finally {
        if (!cancelled) setIsRenderingDocx(false);
      }
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [activeTab, isActiveDocx, activeTemplate, variableMap, docxRevision]);

  // Carrega blocos editáveis e Blob do .docx na aba Modelos
  useEffect(() => {
    if (activeTab !== 'modelos' || editingTemplate?.kind !== 'docx') {
      setEditorDocxBlob(null);
      return;
    }
    let cancelled = false;
    setEditorDocxMissing(false);
    setDocxBlockSearch('');
    setFocusedDocxBlockKey(null);

    (async () => {
      const buffer = await getDocxTemplateBlob(editingTemplate.id);
      if (cancelled) return;
      if (!buffer) {
        setDocxBlocks([]);
        setDocxBlockEdits({});
        setEditorDocxBlob(null);
        setEditorDocxMissing(true);
        return;
      }
      const blocks = await extractDocxTextBlocks(buffer);
      if (cancelled) return;
      setDocxBlocks(blocks);
      const initialEdits: Record<string, string> = {};
      blocks.forEach((b) => {
        initialEdits[b.blockKey] = b.text;
      });
      setDocxBlockEdits(initialEdits);
      setEditorDocxBlob(
        new Blob([buffer.slice(0)], {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        })
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [activeTab, editingTemplate?.id, editingTemplate?.kind, docxRevision]);

  // Aplica edições feitas nos blocos do .docx em tempo real, salva e atualiza o iframe isolado
  const applyLiveDocxEdits = async (nextEdits: Record<string, string>) => {
    if (!editingTemplate || editingTemplate.kind !== 'docx') return;
    const buffer = await getDocxTemplateBlob(editingTemplate.id);
    if (!buffer) return;
    setIsRenderingEditorDocx(true);
    try {
      const updatedBuf = await applyDocxTextBlockEdits(buffer, nextEdits);
      await saveDocxTemplateBlob(editingTemplate.id, updatedBuf);
      const detectedVariables = await inspectDocxPlaceholders(updatedBuf);
      setTemplates((prev) =>
        prev.map((t) =>
          t.id === editingTemplate.id
            ? {
                ...t,
                detectedVariables,
                docxFileSize: updatedBuf.byteLength,
                subtitle: `Modelo Word (.docx) • ${detectedVariables.length} variável(is) detectada(s)`,
                updatedAt: new Date().toISOString(),
              }
            : t
        )
      );
      setEditorDocxBlob(
        new Blob([updatedBuf.slice(0)], {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        })
      );
    } finally {
      setIsRenderingEditorDocx(false);
    }
  };

  const editDebounceRef = useRef<number | null>(null);
  const handleEditDocxBlock = (blockKey: string, value: string) => {
    const nextEdits = { ...docxBlockEdits, [blockKey]: value };
    setDocxBlockEdits(nextEdits);
    if (editDebounceRef.current) window.clearTimeout(editDebounceRef.current);
    editDebounceRef.current = window.setTimeout(() => {
      void applyLiveDocxEdits(nextEdits);
    }, 260);
  };

  const handleGenerateOutput = async () => {
    if (!customerName.trim()) {
      toast({
        title: 'Informe o nome do cliente',
        description: 'Preencha ao menos o nome do cliente antes de gerar o documento.',
        variant: 'destructive',
      });
      return;
    }

    if (isActiveDocx && activeTemplate) {
      const buffer = await getDocxTemplateBlob(activeTemplate.id);
      if (!buffer) {
        toast({
          title: 'Arquivo Word não encontrado',
          description: 'Reimporte o arquivo .docx na aba Modelos e tente novamente.',
          variant: 'destructive',
        });
        return;
      }
      const filledBlob = await fillDocxTemplate(buffer, variableMap);
      const safeClient = customerName.replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 28);
      downloadDocxBlob(filledBlob, `Recibo_Balcao_${currentReceiptNumber}_${safeClient}.docx`);

      const finalDoc: CounterReceiptData = {
        ...draftDataWithoutBody,
        renderedBody: `[Modelo Word: ${activeTemplate.docxFileName || activeTemplate.name}]`,
      };
      setHistory((prev) => [finalDoc, ...prev]);
      setSequence((prev) => prev + 1);

      toast({
        title: `Word ${finalDoc.receiptNumber} gerado`,
        description: 'Arquivo .docx preenchido baixado com a formatação original preservada.',
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

  const handlePrintDocxPreview = () => {
    const iframe = emitPreviewIframeRef.current;
    if (!iframe?.contentWindow || !emitDocxBlob) {
      toast({
        title: 'Prévia ainda carregando',
        description: 'Aguarde o modelo Word terminar de renderizar para imprimir/salvar em PDF.',
      });
      return;
    }
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
  };

  // Upload de novo modelo Word (.docx)
  const handleUploadNewDocx = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.docx')) {
      toast({
        title: 'Formato inválido',
        description: 'Selecione um arquivo do Microsoft Word no formato .docx.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      const detectedVariables = await inspectDocxPlaceholders(buffer);
      const id = `docx-${Date.now()}`;
      await saveDocxTemplateBlob(id, buffer);

      const cleanName = file.name.replace(/\.docx$/i, '');
      const newTpl: CounterReceiptTemplate = {
        id,
        name: cleanName,
        subtitle: `Modelo Word (.docx) • ${detectedVariables.length} variável(is) detectada(s)`,
        kind: 'docx',
        body: '',
        docxFileName: file.name,
        docxFileSize: file.size,
        detectedVariables,
        updatedAt: new Date().toISOString(),
      };

      setTemplates((prev) => [newTpl, ...prev]);
      setEditingTemplateId(id);
      setSelectedTemplateId(id);
      setDocxRevision((r) => r + 1);
      setActiveTab('modelos');

      toast({
        title: 'Modelo Word importado com sucesso!',
        description:
          detectedVariables.length > 0
            ? `${detectedVariables.length} variável(is) encontrada(s). Você pode editar qualquer campo ao vivo agora.`
            : 'Arquivo carregado com formatação original. Edite qualquer texto diretamente no painel e veja a prévia em tempo real.',
      });
    } catch (err) {
      toast({
        title: 'Erro ao importar arquivo Word',
        description: err instanceof Error ? err.message : 'Verifique se o arquivo .docx não está corrompido.',
        variant: 'destructive',
      });
    }
  };

  // Substituir o arquivo .docx de um modelo existente
  const handleReplaceDocxFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !editingTemplate) return;
    if (!file.name.toLowerCase().endsWith('.docx')) {
      toast({
        title: 'Formato inválido',
        description: 'Selecione um arquivo .docx.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      const detectedVariables = await inspectDocxPlaceholders(buffer);
      await saveDocxTemplateBlob(editingTemplate.id, buffer);
      handleUpdateEditingTemplate({
        kind: 'docx',
        docxFileName: file.name,
        docxFileSize: file.size,
        detectedVariables,
        subtitle: `Modelo Word (.docx) • ${detectedVariables.length} variável(is) detectada(s)`,
      });
      setDocxRevision((r) => r + 1);
      toast({
        title: 'Arquivo Word atualizado',
        description: `${detectedVariables.length} variável(is) detectada(s). Prévia ao vivo atualizada.`,
      });
    } catch (err) {
      toast({
        title: 'Erro ao atualizar .docx',
        description: err instanceof Error ? err.message : 'Arquivo inválido.',
        variant: 'destructive',
      });
    }
  };

  const handleDownloadOriginalDocx = async (tpl: CounterReceiptTemplate) => {
    const buffer = await getDocxTemplateBlob(tpl.id);
    if (!buffer) {
      toast({
        title: 'Arquivo não encontrado',
        description: 'Reimporte o .docx para poder baixá-lo novamente.',
        variant: 'destructive',
      });
      return;
    }
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    downloadDocxBlob(blob, tpl.docxFileName || `${tpl.name}.docx`);
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
      kind: 'text',
      body: DEFAULT_COUNTER_TEMPLATES[1].body,
      updatedAt: new Date().toISOString(),
    };
    setTemplates((prev) => [...prev, newTpl]);
    setEditingTemplateId(newTpl.id);
    toast({ title: 'Novo modelo criado', description: 'Personalize o texto e as variáveis livremente.' });
  };

  const handleDuplicateTemplate = async (tpl: CounterReceiptTemplate) => {
    const newId = `${tpl.kind === 'docx' ? 'docx' : 'tpl'}-${Date.now()}`;
    if (tpl.kind === 'docx') {
      const buf = await getDocxTemplateBlob(tpl.id);
      if (buf) await saveDocxTemplateBlob(newId, buf);
    }
    const copy: CounterReceiptTemplate = {
      ...tpl,
      id: newId,
      name: `${tpl.name} (Cópia)`,
      updatedAt: new Date().toISOString(),
    };
    setTemplates((prev) => [...prev, copy]);
    setEditingTemplateId(copy.id);
    toast({ title: 'Modelo duplicado' });
  };

  const handleDeleteTemplate = async (id: string) => {
    if (templates.length <= 1) {
      toast({
        title: 'Ação bloqueada',
        description: 'É necessário manter pelo menos um modelo ativo.',
        variant: 'destructive',
      });
      return;
    }
    const target = templates.find((t) => t.id === id);
    if (target?.kind === 'docx') {
      await deleteDocxTemplateBlob(id).catch(() => {});
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
    if (editingTemplate.kind === 'docx') {
      if (focusedDocxBlockKey && focusedDocxBlockKey in docxBlockEdits) {
        const current = docxBlockEdits[focusedDocxBlockKey] || '';
        const nextVal = current ? `${current}${current.endsWith(' ') ? '' : ' '}${token}` : token;
        handleEditDocxBlock(focusedDocxBlockKey, nextVal);
        toast({
          title: `Variável inserida: ${token}`,
          description: 'Documento Word re-renderizado em tempo real.',
        });
        return;
      }
      navigator.clipboard?.writeText(token).catch(() => {});
      toast({
        title: `Copiado: ${token}`,
        description: 'Clique em qualquer campo do editor Word abaixo para inserir direto, ou cole onde preferir.',
      });
      return;
    }
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
      {/* Inputs ocultos de upload .docx */}
      <input
        ref={docxUploadInputRef}
        type="file"
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={handleUploadNewDocx}
      />
      <input
        ref={docxReplaceInputRef}
        type="file"
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={handleReplaceDocxFile}
      />

      <PageHeader
        title="Recibo de Balcão"
        description="Módulo administrativo exclusivo (Dono, Gerente e Admin) com suporte a modelos prontos em Word (.docx) mantendo 100% do formato original e preenchimento automático de variáveis."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => docxUploadInputRef.current?.click()}
            >
              <FileUp className="w-4 h-4" />
              Importar Modelo Word (.docx)
            </Button>
            <Badge variant="outline" className="gap-1.5 px-3 py-1 text-xs border-amber-500/40 text-amber-600 dark:text-amber-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              Acesso Restrito: Dono / Gerente / Admin
            </Badge>
          </div>
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
        {/* ABA 1: EMITIR RECIBO + PRÉVIA AO VIVO (TEXTO OU WORD .DOCX)     */}
        {/* =============================================================== */}
        <TabsContent value="emitir" className="space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            {/* Formulário */}
            <Card className="xl:col-span-6">
              <CardHeader className="pb-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">Dados do Recibo de Balcão</CardTitle>
                    <CardDescription>
                      Preencha os campos abaixo; o modelo escolhido (Texto ou Word .docx) é preenchido automaticamente.
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
                    <Label className="text-xs">Modelo Utilizado</Label>
                    <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.kind === 'docx' ? `[WORD] ${t.name}` : t.name}
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

                {/* Campos personalizados extras encontrados no .docx */}
                {extraDocxTokens.length > 0 && (
                  <div className="space-y-3 pt-2 border-t">
                    <p className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      3. Campos Personalizados do seu Modelo Word
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {extraDocxTokens.map((token) => (
                        <div key={token} className="space-y-1.5">
                          <Label className="text-xs font-mono">{token}</Label>
                          <Input
                            value={customFieldValues[token] || ''}
                            onChange={(e) =>
                              setCustomFieldValues((prev) => ({
                                ...prev,
                                [token]: e.target.value,
                              }))
                            }
                            placeholder={`Valor para ${token}`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                  {isActiveDocx && (
                    <Button variant="outline" onClick={handlePrintDocxPreview} className="gap-2">
                      <Printer className="w-4 h-4" />
                      Imprimir / Salvar PDF
                    </Button>
                  )}
                  <Button onClick={handleGenerateOutput} className="gap-2">
                    <Download className="w-4 h-4" />
                    {isActiveDocx
                      ? `Baixar Word Preenchido (.docx)`
                      : `Gerar e Baixar PDF (${currentReceiptNumber})`}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Pré-visualização ao vivo */}
            <Card className="xl:col-span-6 flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">
                      {isActiveDocx ? 'Prévia Fiel do Modelo Word (.docx)' : 'Prévia do Documento'}
                    </CardTitle>
                    <CardDescription>
                      {isActiveDocx
                        ? 'Visualização real do seu arquivo Word mantendo tabelas, logos, fontes e bordas.'
                        : 'Visualização em tempo real do texto preenchido antes de exportar o PDF.'}
                    </CardDescription>
                  </div>
                  {isActiveDocx && (
                    <Badge className="bg-blue-600 text-white hover:bg-blue-600 text-[10px]">
                      WORD .DOCX
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col gap-3">
                {isActiveDocx ? (
                  <DocxLivePreviewFrame
                    blob={emitDocxBlob}
                    loading={isRenderingDocx}
                    emptyMessage="Arquivo Word não encontrado neste navegador. Reimporte o arquivo .docx na aba Modelos."
                    heightClassName="h-[700px]"
                    onIframeReady={(iframe) => {
                      emitPreviewIframeRef.current = iframe;
                    }}
                  />
                ) : (
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
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* =============================================================== */}
        {/* ABA 2: MODELOS EDITÁVEIS (TEXTO + IMPORTAÇÃO WORD .DOCX)        */}
        {/* =============================================================== */}
        <TabsContent value="modelos" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Lista de modelos */}
            <Card className="lg:col-span-4">
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">Seus Modelos</CardTitle>
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => docxUploadInputRef.current?.click()}
                      className="gap-1 h-8 text-xs"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Word (.docx)
                    </Button>
                    <Button size="sm" onClick={handleCreateTemplate} className="gap-1 h-8 text-xs">
                      <Plus className="w-3.5 h-3.5" />
                      Texto
                    </Button>
                  </div>
                </div>
                <CardDescription>
                  Importe arquivos prontos em Word (.docx) mantendo toda a formatação, ou crie modelos de texto.
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
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <p className="font-medium text-sm truncate">{tpl.name}</p>
                            {tpl.kind === 'docx' && (
                              <Badge className="bg-blue-600 text-white hover:bg-blue-600 text-[9px] px-1.5 py-0 h-4 shrink-0">
                                DOCX
                              </Badge>
                            )}
                          </div>
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
                <CardTitle className="text-base">
                  {editingTemplate?.kind === 'docx' ? 'Configuração do Modelo Word (.docx)' : 'Editor de Modelo de Texto'}
                </CardTitle>
                <CardDescription>
                  {editingTemplate?.kind === 'docx'
                    ? 'Seu arquivo Word é mantido intacto (fontes, tabelas, logos e margens). Use as variáveis {{...}} dentro do Word para preenchimento automático.'
                    : 'Clique em qualquer variável abaixo para inseri-la no texto. As alterações são salvas automaticamente.'}
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

                    {editingTemplate.kind === 'docx' ? (
                      <div className="space-y-4">
                        <div className="rounded-lg border bg-blue-500/5 border-blue-500/30 p-4 flex flex-wrap items-center justify-between gap-3">
                          <div className="space-y-0.5">
                            <p className="text-sm font-semibold flex items-center gap-2">
                              <FileText className="w-4 h-4 text-blue-600" />
                              {editingTemplate.docxFileName || `${editingTemplate.name}.docx`}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Tamanho: {formatFileSize(editingTemplate.docxFileSize)} • Formatação Word preservada 100%
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5 text-xs"
                              onClick={() => handleDownloadOriginalDocx(editingTemplate)}
                            >
                              <Download className="w-3.5 h-3.5" />
                              Baixar Original
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              className="gap-1.5 text-xs"
                              onClick={() => docxReplaceInputRef.current?.click()}
                            >
                              <Upload className="w-3.5 h-3.5" />
                              Substituir .docx
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs">Variáveis detectadas neste arquivo Word</Label>
                          {editingTemplate.detectedVariables && editingTemplate.detectedVariables.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {editingTemplate.detectedVariables.map((v) => (
                                <Badge key={v} variant="secondary" className="font-mono text-[11px]">
                                  {v}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground bg-muted/50 rounded-md p-3">
                              Nenhuma variável <code>{'{{...}}'}</code> encontrada neste arquivo ainda. Para preencher campos automaticamente, abra o arquivo no Word, escreva as variáveis abaixo onde deseja que os dados apareçam (ex.: <code>{'{{cliente_nome}}'}</code>, <code>{'{{cliente_documento}}'}</code>, <code>{'{{valor_total}}'}</code>) e clique em <strong>Substituir .docx</strong>. Você também pode criar qualquer variável própria como <code>{'{{vendedor}}'}</code> que o sistema cria o campo na hora!
                            </p>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs">
                            Variáveis padrão (clique em um bloco de texto abaixo e depois clique na variável para inserir ao vivo)
                          </Label>
                          <div className="flex flex-wrap gap-1.5">
                            {COUNTER_RECEIPT_VARIABLES.map((v) => (
                              <Button
                                key={v.token}
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 text-[11px] font-mono px-2"
                                onClick={() => handleInsertVariable(v.token)}
                                title={`Inserir ${v.token}`}
                              >
                                {v.token}
                              </Button>
                            ))}
                          </div>
                        </div>

                        {/* Editor interno ao vivo + Renderização em tempo real do Word */}
                        {editorDocxMissing ? (
                          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-xs text-destructive flex flex-wrap items-center justify-between gap-2">
                            <span>Arquivo Word não encontrado neste navegador. Clique em Substituir .docx para recarregar o arquivo.</span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => docxReplaceInputRef.current?.click()}
                              className="gap-1.5 text-xs"
                            >
                              <Upload className="w-3.5 h-3.5" />
                              Reimportar .docx
                            </Button>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 pt-1">
                            {/* Lista de blocos/células editáveis do Word */}
                            <div className="xl:col-span-5 space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <Label className="text-xs font-semibold">
                                  Textos e Células do Word ({docxBlocks.length})
                                </Label>
                                {focusedDocxBlockKey && (
                                  <Badge variant="outline" className="text-[10px]">
                                    Editando campo
                                  </Badge>
                                )}
                              </div>
                              <div className="relative">
                                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                                <Input
                                  value={docxBlockSearch}
                                  onChange={(e) => setDocxBlockSearch(e.target.value)}
                                  placeholder="Filtrar texto no documento..."
                                  className="pl-8 h-8 text-xs"
                                />
                              </div>
                              <div className="space-y-2 max-h-[540px] overflow-y-auto pr-1">
                                {docxBlocks
                                  .filter((b) => {
                                    const q = docxBlockSearch.trim().toLowerCase();
                                    if (!q) return true;
                                    const val = (docxBlockEdits[b.blockKey] ?? b.text).toLowerCase();
                                    return val.includes(q) || b.text.toLowerCase().includes(q);
                                  })
                                  .map((b, idx) => {
                                    const val = docxBlockEdits[b.blockKey] ?? b.text;
                                    const isFocused = focusedDocxBlockKey === b.blockKey;
                                    const isMultiline = val.length > 70;
                                    return (
                                      <div
                                        key={b.blockKey}
                                        className={`rounded-md border p-2 space-y-1 transition-colors ${
                                          isFocused ? 'border-primary bg-primary/5' : 'border-border bg-background'
                                        }`}
                                      >
                                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                          <span>Bloco #{idx + 1}</span>
                                          {val.includes('{{') && (
                                            <Badge variant="secondary" className="text-[9px] h-4 px-1.5">
                                              Com variável
                                            </Badge>
                                          )}
                                        </div>
                                        {isMultiline ? (
                                          <Textarea
                                            rows={3}
                                            value={val}
                                            onFocus={() => setFocusedDocxBlockKey(b.blockKey)}
                                            onChange={(e) => handleEditDocxBlock(b.blockKey, e.target.value)}
                                            className="text-xs leading-snug"
                                          />
                                        ) : (
                                          <Input
                                            value={val}
                                            onFocus={() => setFocusedDocxBlockKey(b.blockKey)}
                                            onChange={(e) => handleEditDocxBlock(b.blockKey, e.target.value)}
                                            className="h-8 text-xs"
                                          />
                                        )}
                                      </div>
                                    );
                                  })}
                              </div>
                            </div>

                            {/* Renderização em tempo real do documento Word */}
                            <div className="xl:col-span-7 space-y-2">
                              <Label className="text-xs font-semibold">
                                Renderização em Tempo Real (Formato Original Isolado do Word)
                              </Label>
                              <DocxLivePreviewFrame
                                blob={editorDocxBlob}
                                loading={isRenderingEditorDocx}
                                heightClassName="h-[580px]"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="rounded-lg border border-dashed border-blue-500/40 bg-blue-500/5 p-3.5 flex flex-wrap items-center justify-between gap-3">
                          <div className="space-y-0.5">
                            <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                              <FileUp className="w-4 h-4 text-blue-600" />
                              Usar um arquivo pronto do Word (.docx) neste modelo
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              Anexe seu .docx pronto para manter 100% da formatação original (tabelas, logos, fontes e margens).
                            </p>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="gap-1.5 text-xs border-blue-500/40 text-blue-700 dark:text-blue-400 hover:bg-blue-500/10"
                            onClick={() => docxReplaceInputRef.current?.click()}
                          >
                            <Upload className="w-3.5 h-3.5" />
                            Anexar Word (.docx)
                          </Button>
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
                      </>
                    )}

                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
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
                    Consulte ou baixe novamente os recibos de balcão gerados.
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
