import { useState, useMemo, useRef } from 'react';
import {
  Cloud,
  RefreshCw,
  CheckCircle2,
  Clock,
  Plus,
  Trash2,
  Download,
  ExternalLink,
  Search,
  Calendar,
  FileSpreadsheet,
  ShieldAlert,
  Check,
  Settings2,
  DollarSign,
  Bike,
  Filter,
  Lock,
  Unlock,
  Upload,
  User,
  MapPin,
  Landmark,
  CreditCard,
  Banknote,
  FileText,
  AlertCircle,
  Trophy,
  Copy,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Percent,
  Pencil,
  Image as ImageIcon,
  LayoutGrid,
  Kanban,
  Activity,
  GripVertical,
  SlidersHorizontal,
  ArrowUpDown,
  Sparkles,
  Paperclip,
  ZoomIn,
  Building2,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/contexts/ConfirmationContext';
import { useAuth } from '@/contexts/AuthContext';
import { exportToXLSX, exportDealershipWorksheetMultiStore } from '@/lib/export';
import { useStores } from '@/hooks/useStores';
import { TabTransition } from '@/components/ui/TabTransition';
import * as XLSX from 'xlsx';
import {
  SheetRowV9,
  parseBackupCsv,
  INITIAL_USER_BACKUP_CSV,
  parseCurrencyBRL,
  formatCurrencyBRL,
} from '@/lib/dealershipSheetParser';
import {
  ReceiptAttachmentManager,
  getSaleReceipts,
  addReceiptFileToSale,
} from '@/components/sales/ReceiptAttachmentManager';

const MONTHS_LABELS: Record<string, string> = {
  '01': 'Janeiro',
  '02': 'Fevereiro',
  '03': 'Março',
  '04': 'Abril',
  '05': 'Maio',
  '06': 'Junho',
  '07': 'Julho',
  '08': 'Agosto',
  '09': 'Setembro',
  '10': 'Outubro',
  '11': 'Novembro',
  '12': 'Dezembro',
};

const STORAGE_KEY = 'dealflow_cloud_monthly_sheet_v9';
const DRIVE_URL_KEY = 'dealflow_google_drive_url_v1';

type ViewMode = 'grid' | 'kanban' | 'timeline';
type GroupByOption = 'none' | 'vendedor' | 'banco' | 'status';
type SortField = 'qt' | 'data' | 'cliente' | 'vendedor' | 'valor' | 'financiamento';

interface CloudMonthlySpreadsheetProps {
  onedriveUrl?: string;
}

export function CloudMonthlySpreadsheet({
  onedriveUrl = 'https://1drv.ms/x/c/b5177ebc01be67e9/IQCk_omgPi8VSJ0OGrk3iPR2AWd0LdLxQxkKIyA7KtAZhbE?e=bWHhCy',
}: CloudMonthlySpreadsheetProps = {}) {
  const { toast } = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const { profile, isAdmin, isManager } = useAuth();
  const hasManagementAccess = isAdmin || isManager;

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Modos de Visualização & Organização
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-10');
  const [selectedStoreFilter, setSelectedStoreFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSellerFilter, setSelectedSellerFilter] = useState<string>('all');
  const { data: storesList = [] } = useStores();
  const [selectedBankFilter, setSelectedBankFilter] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'permitted'>('all');
  const [receiptFilter, setReceiptFilter] = useState<'all' | 'with_receipt' | 'without_receipt'>('all');
  const [groupBy, setGroupBy] = useState<GroupByOption>('none');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // Ordenação
  const [sortField, setSortField] = useState<SortField>('qt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Arrastar e Soltar Linhas (Reordenação)
  const [draggedRowId, setDraggedRowId] = useState<string | null>(null);
  const [dragOverRowId, setDragOverRowId] = useState<string | null>(null);

  // Arrastar Arquivo diretamente para a linha (Dropzone de comprovante na célula)
  const [fileDropTargetRowId, setFileDropTargetRowId] = useState<string | null>(null);

  // Modal Importador de Backup CSV
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [csvInput, setCsvInput] = useState('');

  // Modal Novo Lançamento v9.0
  const [newRowModalOpen, setNewRowModalOpen] = useState(false);
  const [newRowForm, setNewRowForm] = useState({
    vendedor: 'Geibriel',
    data: new Date().toLocaleDateString('pt-BR'),
    modelo: 'SHI 250',
    chassi: '',
    cliente: '',
    regiao: 'DIVINOPOLIS',
    valor: '',
    financiamento: '',
    banco: 'PAN',
    dinheiro: '',
    pix: '',
    carta_credito: '',
    cartao: '',
    comp: '',
    boleto: '',
    custos: '',
    lead_mapping: '',
    observacoes: '',
    tipo: 'venda' as 'venda' | 'pre_venda' | 'emissao_nf',
  });

  // Modal de Comprovantes de Pagamento (Anexos e Imagens)
  const [compModalOpen, setCompModalOpen] = useState(false);
  const [activeCompRow, setActiveCompRow] = useState<SheetRowV9 | null>(null);

  // Modal de Edição Completa da Venda pelo Vendedor
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<SheetRowV9 | null>(null);

  // Edição Direta de Célula na Grade (Estilo Excel na Web)
  const [inlineCell, setInlineCell] = useState<{
    rowId: string;
    field: keyof SheetRowV9;
    value: string;
  } | null>(null);

  // Consulta das Linhas na Nuvem + Cache Local v9.0
  const { data: sheetRows = [], isLoading } = useQuery<SheetRowV9[]>({
    queryKey: ['cloud-monthly-sheet-v9'],
    queryFn: async () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      } catch (e) {
        console.warn('Erro ao ler cache de planilhas v9:', e);
      }

      // Inicializa com todos os 18 lançamentos reais e de teste
      const { rows } = parseBackupCsv(INITIAL_USER_BACKUP_CSV, '2026-10');
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
      return rows;
    },
    staleTime: 30_000,
  });

  // Mutação para Salvar Atualizações e Sincronizar com Vendas / Dashboard
  const saveRowsMutation = useMutation({
    mutationFn: async (updatedRows: SheetRowV9[]) => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedRows));
      return updatedRows;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(['cloud-monthly-sheet-v9'], updated);
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['contract-stats'] });
    },
  });

  // Confirmar edição inline de célula na grade (Excel Web)
  const commitInlineCellEdit = () => {
    if (!inlineCell) return;
    const { rowId, field, value } = inlineCell;
    const numericFields: (keyof SheetRowV9)[] = [
      'valor',
      'financiamento',
      'dinheiro',
      'pix',
      'carta_credito',
      'cartao',
      'boleto',
      'custos',
      'total',
    ];

    const updated = sheetRows.map((r) => {
      if (r.id !== rowId) return r;
      const nextRow: SheetRowV9 = { ...r };
      if (numericFields.includes(field)) {
        (nextRow as any)[field] = parseCurrencyBRL(value);
        // Recalcula total automaticamente quando um meio de pagamento ou valor muda
        if (field !== 'total') {
          const sumPayments =
            (nextRow.financiamento || 0) +
            (nextRow.dinheiro || 0) +
            (nextRow.pix || 0) +
            (nextRow.carta_credito || 0) +
            (nextRow.cartao || 0) +
            (nextRow.boleto || 0);
          nextRow.total = sumPayments > 0 ? sumPayments : nextRow.valor;
        }
      } else {
        const cleanVal =
          field === 'modelo' || field === 'cliente' || field === 'regiao' || field === 'chassi' || field === 'banco'
            ? value.trim().toUpperCase()
            : value.trim();
        (nextRow as any)[field] = cleanVal;
      }
      return nextRow;
    });

    saveRowsMutation.mutate(updated);
    setInlineCell(null);
  };

  // Alternar Permissão (Pré-venda / Faturada)
  const togglePermit = (rowId: string) => {
    const updated = sheetRows.map((r) => {
      if (r.id === rowId) {
        const nextState = !r.is_permitted;
        return {
          ...r,
          is_permitted: nextState,
          permitted_by: nextState ? profile?.full_name || 'Gerência' : null,
          permitted_at: nextState ? new Date().toISOString() : null,
        };
      }
      return r;
    });

    saveRowsMutation.mutate(updated);
    toast({
      title: 'Status da Venda Atualizado',
      description: 'A linha agora reflete o estado na planilha online.',
    });
  };

  // Mover no Kanban por Drag and Drop
  const handleKanbanDrop = (rowId: string, targetStatus: 'pending' | 'no_receipt' | 'faturada') => {
    const updated = sheetRows.map((r) => {
      if (r.id === rowId) {
        if (targetStatus === 'pending') {
          return { ...r, is_permitted: false, tipo_registro: 'pre_venda' as const };
        } else if (targetStatus === 'faturada') {
          return { ...r, is_permitted: true, tipo_registro: 'venda' as const };
        } else {
          return { ...r, is_permitted: true, comp: '' };
        }
      }
      return r;
    });

    saveRowsMutation.mutate(updated);
    toast({
      title: 'Venda Movimentada no Pipeline!',
      description: 'Status atualizado com sucesso.',
    });
  };

  // Soltar arquivo de imagem/comprovante diretamente sobre uma linha da planilha
  const handleDropFileOnRow = async (e: React.DragEvent, targetRow: SheetRowV9) => {
    e.preventDefault();
    e.stopPropagation();
    setFileDropTargetRowId(null);

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    try {
      let count = 0;
      for (let i = 0; i < files.length; i++) {
        await addReceiptFileToSale(targetRow.id, files[i]);
        count++;
      }

      const updated = sheetRows.map((r) =>
        r.id === targetRow.id ? { ...r, comp: 'Imagem' } : r
      );
      saveRowsMutation.mutate(updated);

      toast({
        title: `✨ ${count} comprovante(s) anexado(s) com sucesso!`,
        description: `Vinculado à venda #${targetRow.qt} (${targetRow.cliente}).`,
      });
    } catch (err) {
      console.error('Erro ao soltar comprovante na linha:', err);
      toast({
        title: 'Erro ao anexar arquivo',
        description: 'Tente novamente abrindo o modal de comprovantes.',
        variant: 'destructive',
      });
    }
  };

  // Reordenação de Linhas por Drag and Drop
  const handleRowDrop = (targetRowId: string) => {
    if (!draggedRowId || draggedRowId === targetRowId) {
      setDraggedRowId(null);
      setDragOverRowId(null);
      return;
    }

    const currentMonthItems = sheetRows.filter((r) => r.month_key === selectedMonth);
    const otherItems = sheetRows.filter((r) => r.month_key !== selectedMonth);

    const fromIdx = currentMonthItems.findIndex((r) => r.id === draggedRowId);
    const toIdx = currentMonthItems.findIndex((r) => r.id === targetRowId);

    if (fromIdx !== -1 && toIdx !== -1) {
      const reordered = [...currentMonthItems];
      const [moved] = reordered.splice(fromIdx, 1);
      reordered.splice(toIdx, 0, moved);

      // Reatribui QT sequencial se desejar
      const withUpdatedSeq = reordered.map((r, i) => ({
        ...r,
        qt: String(i + 1).padStart(2, '0'),
      }));

      saveRowsMutation.mutate([...withUpdatedSeq, ...otherItems]);
      toast({
        title: 'Linhas Reordenadas',
        description: 'A ordem da planilha foi atualizada.',
      });
    }

    setDraggedRowId(null);
    setDragOverRowId(null);
  };

  // Importar arquivo .xlsx ou .csv diretamente
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.endsWith('.csv') || file.name.endsWith('.txt')) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const text = evt.target?.result as string;
        setCsvInput(text);
      };
      reader.readAsText(file);
    } else {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = new Uint8Array(evt.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const csvText = XLSX.utils.sheet_to_csv(worksheet, { FS: ';' });
          setCsvInput(csvText);
          toast({
            title: 'Planilha Excel Lida com Sucesso!',
            description: `Arquivo "${file.name}" carregado. Clique em Processar para sincronizar.`,
          });
        } catch (err: any) {
          toast({
            title: 'Erro ao ler arquivo Excel',
            description: err?.message || 'Verifique o formato da planilha.',
            variant: 'destructive',
          });
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  // Injetar Preenchimentos de Teste na Planilha (18 vendas com todos os formatos e métodos)
  const handlePopulateTestData = () => {
    const { rows: testRows } = parseBackupCsv(INITIAL_USER_BACKUP_CSV, selectedMonth);
    const otherMonths = sheetRows.filter((r) => r.month_key !== selectedMonth);
    const updated = [...testRows, ...otherMonths];

    saveRowsMutation.mutate(updated);
    toast({
      title: 'Preenchimento de Teste Realizado!',
      description: `${testRows.length} lançamentos de teste sincronizados para ${selectedMonth}.`,
    });
  };

  // Importar Backup CSV / TSV Colado (Excel Online ou CSV)
  const handleImportBackup = () => {
    if (!csvInput.trim()) {
      toast({
        title: 'Texto vazio',
        description: 'Cole o texto copiado do Excel Online (Ctrl+V) ou selecione um arquivo .XLSX/.CSV.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { rows: importedRows } = parseBackupCsv(csvInput, selectedMonth);
      if (importedRows.length === 0) {
        toast({
          title: 'Nenhuma linha válida encontrada',
          description: 'Verifique se as linhas começam pelo número sequencial (QT) e estão separadas por Tab (Excel) ou ponto e vírgula (;).',
          variant: 'destructive',
        });
        return;
      }

      const otherMonths = sheetRows.filter((r) => r.month_key !== selectedMonth);
      const updated = [...importedRows, ...otherMonths];

      saveRowsMutation.mutate(updated);
      setImportModalOpen(false);
      setCsvInput('');
      toast({
        title: 'Planilha Sincronizada com Sucesso!',
        description: `${importedRows.length} lançamentos importados para o mês ${selectedMonth}.`,
      });
    } catch (err: any) {
      toast({
        title: 'Erro ao processar planilha',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  // Criar Nova Linha no Formulário v9.0
  const handleCreateRowV9 = () => {
    if (!newRowForm.cliente.trim() || !newRowForm.modelo.trim()) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha o nome do cliente e o modelo da moto.',
        variant: 'destructive',
      });
      return;
    }

    const currentRowsInMonth = sheetRows.filter((r) => r.month_key === selectedMonth);
    const nextSeq = String(currentRowsInMonth.length + 1).padStart(2, '0');

    const valorNum = parseCurrencyBRL(newRowForm.valor);
    const finNum = parseCurrencyBRL(newRowForm.financiamento);
    const dinNum = parseCurrencyBRL(newRowForm.dinheiro);
    const pixNum = parseCurrencyBRL(newRowForm.pix);
    const cartaNum = parseCurrencyBRL(newRowForm.carta_credito);
    const cartaoNum = parseCurrencyBRL(newRowForm.cartao);
    const boletoNum = parseCurrencyBRL(newRowForm.boleto);
    const custosNum = parseCurrencyBRL(newRowForm.custos);

    const totalRec = finNum + dinNum + pixNum + cartaNum + cartaoNum + boletoNum || valorNum;
    const isPending = newRowForm.tipo !== 'venda';

    const newRecord: SheetRowV9 = {
      id: `row-v9-${selectedMonth}-${Date.now()}`,
      month_key: selectedMonth,
      qt: nextSeq,
      lead_mapping: newRowForm.lead_mapping.trim(),
      data: newRowForm.data || new Date().toLocaleDateString('pt-BR'),
      vendedor: newRowForm.vendedor,
      chassi: newRowForm.chassi.trim().toUpperCase() || '—',
      modelo: newRowForm.modelo.trim().toUpperCase(),
      cliente: newRowForm.cliente.trim().toUpperCase(),
      regiao: newRowForm.regiao.trim().toUpperCase(),
      valor: valorNum,
      financiamento: finNum,
      banco: newRowForm.banco.trim().toUpperCase(),
      dinheiro: dinNum,
      pix: pixNum,
      carta_credito: cartaNum,
      cartao: cartaoNum,
      comp: newRowForm.comp.trim(),
      boleto: boletoNum,
      custos: custosNum,
      total: totalRec,
      observacoes: newRowForm.observacoes.trim(),
      tipo_registro: newRowForm.tipo,
      is_permitted: !isPending,
    };

    const updated = [newRecord, ...sheetRows];
    saveRowsMutation.mutate(updated);
    setNewRowModalOpen(false);
    setNewRowForm({
      vendedor: 'Geibriel',
      data: new Date().toLocaleDateString('pt-BR'),
      modelo: 'SHI 250',
      chassi: '',
      cliente: '',
      regiao: 'DIVINOPOLIS',
      valor: '',
      financiamento: '',
      banco: 'PAN',
      dinheiro: '',
      pix: '',
      carta_credito: '',
      cartao: '',
      comp: '',
      boleto: '',
      custos: '',
      lead_mapping: '',
      observacoes: '',
      tipo: 'venda',
    });
    toast({
      title: 'Lançamento adicionado à planilha!',
      description: `Venda #${nextSeq} registrada em ${selectedMonth}.`,
    });
  };

  // Excluir Linha
  const handleDeleteRow = async (id: string) => {
    const ok = await confirm({
      title: 'Excluir Lançamento da Planilha?',
      description: 'Deseja realmente remover esta linha de venda da planilha mensal?',
      confirmText: 'Excluir Linha',
      cancelText: 'Cancelar',
      variant: 'destructive',
    });
    if (!ok) return;

    const updated = sheetRows.filter((r) => r.id !== id);
    saveRowsMutation.mutate(updated);
    toast({ title: 'Lançamento removido' });
  };

  // Meses Disponíveis
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    set.add('2026-10');
    set.add(currentMonthKey);
    sheetRows.forEach((r) => {
      if (r.month_key) set.add(r.month_key);
    });
    return Array.from(set).sort().reverse();
  }, [sheetRows, currentMonthKey]);

  // Linhas do Mês Selecionado
  const monthRows = useMemo(() => {
    return sheetRows.filter((r) => r.month_key === selectedMonth);
  }, [sheetRows, selectedMonth]);

  // Lista de Bancos presentes no mês
  const availableBanks = useMemo(() => {
    const set = new Set<string>();
    monthRows.forEach((r) => {
      if (r.banco) set.add(r.banco);
    });
    return Array.from(set).sort();
  }, [monthRows]);

  // Placar / Ranking de Vendedores
  const sellerScoreboard = useMemo(() => {
    const stats: Record<string, { count: number; totalVolume: number }> = {};
    const sellersOrder = ['Geibriel', 'Daniel', 'Lilian', 'Breno'];

    sellersOrder.forEach((s) => {
      stats[s] = { count: 0, totalVolume: 0 };
    });

    monthRows.forEach((r) => {
      const v = r.vendedor || 'Outros';
      if (!stats[v]) stats[v] = { count: 0, totalVolume: 0 };
      stats[v].count += 1;
      stats[v].totalVolume += r.valor || 0;
    });

    return Object.entries(stats).sort((a, b) => b[1].count - a[1].count);
  }, [monthRows]);

  // Totais Financeiros do Mês
  const monthFinancials = useMemo(() => {
    let totalValor = 0;
    let totalFinanciamento = 0;
    let totalDinheiro = 0;
    let totalPix = 0;
    let totalCartao = 0;
    let totalCarta = 0;
    let totalBoleto = 0;
    let totalCustos = 0;

    let permittedCount = 0;
    let pendingCount = 0;
    let withReceiptCount = 0;

    monthRows.forEach((r) => {
      totalValor += r.valor || 0;
      totalFinanciamento += r.financiamento || 0;
      totalDinheiro += r.dinheiro || 0;
      totalPix += r.pix || 0;
      totalCartao += r.cartao || 0;
      totalCarta += r.carta_credito || 0;
      totalBoleto += r.boleto || 0;
      totalCustos += r.custos || 0;

      if (r.is_permitted) permittedCount++;
      else pendingCount++;

      const hasRec = getSaleReceipts(r.id).length > 0 || (r.comp && r.comp.toLowerCase() === 'imagem');
      if (hasRec) withReceiptCount++;
    });

    return {
      totalValor,
      totalFinanciamento,
      totalDinheiro,
      totalPix,
      totalCartao,
      totalCarta,
      totalBoleto,
      totalCustos,
      totalAVista: totalDinheiro + totalPix + totalCartao,
      permittedCount,
      pendingCount,
      withReceiptCount,
      count: monthRows.length,
    };
  }, [monthRows]);

  // Linhas Filtradas
  const filteredRows = useMemo(() => {
    return monthRows.filter((r) => {
      if (selectedStoreFilter !== 'all') {
        const reg = (r.regiao || '').toUpperCase();
        if (selectedStoreFilter === 'MOC' && !reg.includes('MOC') && !reg.includes('MONTES CLAROS')) return false;
        else if (selectedStoreFilter !== 'MOC' && (reg.includes('MOC') || reg.includes('MONTES CLAROS'))) return false;
      }
      if (selectedSellerFilter !== 'all' && r.vendedor !== selectedSellerFilter) return false;
      if (selectedBankFilter !== 'all' && r.banco !== selectedBankFilter) return false;

      if (filterStatus === 'permitted' && !r.is_permitted) return false;
      if (filterStatus === 'pending' && r.is_permitted) return false;

      const hasReceipt = getSaleReceipts(r.id).length > 0 || (r.comp && r.comp.toLowerCase() === 'imagem');
      if (receiptFilter === 'with_receipt' && !hasReceipt) return false;
      if (receiptFilter === 'without_receipt' && hasReceipt) return false;

      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase().trim();
      return (
        r.qt.toLowerCase().includes(q) ||
        r.cliente.toLowerCase().includes(q) ||
        r.modelo.toLowerCase().includes(q) ||
        r.chassi.toLowerCase().includes(q) ||
        r.vendedor.toLowerCase().includes(q) ||
        r.regiao.toLowerCase().includes(q) ||
        r.banco.toLowerCase().includes(q) ||
        r.observacoes.toLowerCase().includes(q)
      );
    });
  }, [monthRows, selectedSellerFilter, selectedBankFilter, filterStatus, receiptFilter, searchTerm]);

  // Linhas Ordenadas
  const sortedRows = useMemo(() => {
    const list = [...filteredRows];
    list.sort((a, b) => {
      let compA: any = a[sortField];
      let compB: any = b[sortField];

      if (sortField === 'qt') {
        compA = parseInt(a.qt, 10) || 0;
        compB = parseInt(b.qt, 10) || 0;
      }

      if (compA < compB) return sortDirection === 'asc' ? -1 : 1;
      if (compA > compB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [filteredRows, sortField, sortDirection]);

  // Alternar Ordenação
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Grupos (quando groupBy !== 'none')
  const groupedData = useMemo(() => {
    if (groupBy === 'none') return null;

    const map: Record<string, SheetRowV9[]> = {};
    sortedRows.forEach((r) => {
      let key = 'Outros';
      if (groupBy === 'vendedor') key = r.vendedor || 'Sem Vendedor';
      else if (groupBy === 'banco') key = r.banco || 'Sem Financiamento';
      else if (groupBy === 'status') key = r.is_permitted ? 'Faturadas & Permitidas' : 'Pré-Vendas (Em Análise)';

      if (!map[key]) map[key] = [];
      map[key].push(r);
    });

    return map;
  }, [sortedRows, groupBy]);

  // Dados para Linearidade / Ritmo Mensal
  const timelineData = useMemo(() => {
    const daysMap: Record<string, { dateStr: string; dayNum: number; rows: SheetRowV9[]; total: number }> = {};

    sortedRows.forEach((r) => {
      const parts = r.data.split('/');
      const dayNum = parts.length === 3 ? parseInt(parts[0], 10) : 1;
      const key = r.data;

      if (!daysMap[key]) {
        daysMap[key] = { dateStr: key, dayNum, rows: [], total: 0 };
      }
      daysMap[key].rows.push(r);
      daysMap[key].total += r.valor || 0;
    });

    return Object.values(daysMap).sort((a, b) => a.dayNum - b.dayNum);
  }, [sortedRows]);

  // Exportar para Excel Nativo Multi-Abas (.xlsx) Dividido por Concessionária
  const handleExportMonth = () => {
    try {
      const fileName = exportDealershipWorksheetMultiStore({
        rows: monthRows,
        monthKey: selectedMonth,
        selectedStoreFilter,
        userName: profile?.full_name || 'Gestor Comercial',
      });
      toast({
        title: 'Planilha Excel (.xlsx) Multi-Abas Gerada!',
        description: `Arquivo salvo com abas de Todas as Vendas, Concessionária MOC, Demais Lojas e Resumo Executivo: ${fileName}`,
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro na exportação',
        description: err.message || 'Falha ao gerar arquivo Excel.',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* CABEÇALHO DA PLANILHA V9.0 COM SELETOR DE MODOS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black tracking-tight text-foreground flex items-center gap-2 font-display">
              <FileSpreadsheet className="w-5 h-5 text-primary" />
              Planilha de Vendas & Faturamento v9.0
            </h2>
            <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] uppercase font-black tracking-wider px-2 py-0.5">
              Online • Nuvem Ativa
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Mapeamento completo com 21 colunas, arrastar e soltar de comprovantes e modos dinâmicos (Grade, Kanban e Ritmo Linear).
          </p>
        </div>

        {/* Botoes de Ação Superior */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Seletor de Modos (Grade, Kanban, Linha do Tempo) */}
          <div className="flex items-center bg-muted/40 p-1 rounded-xl border">
            <Button
              size="sm"
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              onClick={() => setViewMode('grid')}
              className="h-8 px-2.5 text-xs font-bold gap-1.5 rounded-lg"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Grade
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'kanban' ? 'default' : 'ghost'}
              onClick={() => setViewMode('kanban')}
              className="h-8 px-2.5 text-xs font-bold gap-1.5 rounded-lg"
            >
              <Kanban className="w-3.5 h-3.5" />
              Kanban
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'timeline' ? 'default' : 'ghost'}
              onClick={() => setViewMode('timeline')}
              className="h-8 px-2.5 text-xs font-bold gap-1.5 rounded-lg"
            >
              <Activity className="w-3.5 h-3.5" />
              Linearidade
            </Button>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setImportModalOpen(true)}
            className="text-xs gap-1.5 h-8 bg-card font-semibold"
          >
            <Upload className="w-3.5 h-3.5 text-primary" />
            Backup CSV
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleExportMonth}
            className="text-xs gap-1.5 h-8 bg-card font-semibold"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar XLSX
          </Button>

          <Button
            size="sm"
            onClick={() => setNewRowModalOpen(true)}
            className="text-xs gap-1.5 h-8 font-bold bg-primary text-primary-foreground shadow-md shadow-primary/20"
          >
            <Plus className="w-4 h-4" />
            Novo Lançamento
          </Button>
        </div>
      </div>

      {/* PLACAR & RANKING DE VENDEDORES (PÓDIO DO MÊS) */}
      <div className="rounded-2xl border bg-card p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-black uppercase tracking-wider text-foreground">
              Placar de Vendedores • {MONTHS_LABELS[selectedMonth.split('-')[1]] || selectedMonth}
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground">
            Total do Mês: <strong className="text-foreground">{monthFinancials.count} motos vendidas</strong>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {sellerScoreboard.map(([name, stat], idx) => {
            const isSelected = selectedSellerFilter === name;
            return (
              <div
                key={name}
                onClick={() => setSelectedSellerFilter(isSelected ? 'all' : name)}
                className={`p-3 rounded-xl border transition-all cursor-pointer relative overflow-hidden ${
                  isSelected
                    ? 'border-primary bg-primary/10 shadow-sm ring-2 ring-primary/30'
                    : 'bg-muted/20 hover:bg-muted/40 hover:border-primary/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] ${
                        idx === 0
                          ? 'bg-amber-500 text-white shadow-xs'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {idx + 1}º
                    </div>
                    <span className="font-bold text-xs text-foreground">{name}</span>
                  </div>
                  <Badge variant="secondary" className="font-mono font-bold text-xs">
                    {stat.count} {stat.count === 1 ? 'moto' : 'motos'}
                  </Badge>
                </div>
                <div className="text-[11px] text-muted-foreground mt-1.5 flex justify-between">
                  <span>Volume:</span>
                  <strong className="text-foreground">{formatCurrencyBRL(stat.totalVolume)}</strong>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* PAINEL DE KPIs FINANCEIROS DO MÊS */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {/* Seletor de Mês */}
        <div className="p-3.5 rounded-2xl border bg-card space-y-1.5">
          <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-primary" /> Mês de Competência
          </Label>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="h-9 text-xs font-semibold bg-background rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableMonths.map((mKey) => {
                const [y, m] = mKey.split('-');
                const label = `${MONTHS_LABELS[m] || m} de ${y}`;
                return (
                  <SelectItem key={mKey} value={mKey} className="text-xs font-medium">
                    {label}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <span className="text-[10px] text-muted-foreground block truncate">
            {monthFinancials.count} vendas no mês
          </span>
        </div>

        {/* Faturamento Geral */}
        <div className="p-3.5 rounded-2xl border bg-card space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
            Faturamento Geral
          </span>
          <div className="text-xl font-black font-display text-foreground tracking-tight">
            {formatCurrencyBRL(monthFinancials.totalValor)}
          </div>
          <span className="text-[10px] text-muted-foreground">Volume total faturado</span>
        </div>

        {/* Financiamentos */}
        <div className="p-3.5 rounded-2xl border bg-card space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-primary block">
            Financiado (Bancos)
          </span>
          <div className="text-xl font-black font-display text-primary tracking-tight">
            {formatCurrencyBRL(monthFinancials.totalFinanciamento)}
          </div>
          <span className="text-[10px] text-muted-foreground">PAN, Santander, Altis...</span>
        </div>

        {/* Entradas À Vista */}
        <div className="p-3.5 rounded-2xl border bg-card space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
            Entradas (Pix / Dinheiro)
          </span>
          <div className="text-xl font-black font-display text-emerald-600 dark:text-emerald-400 tracking-tight">
            {formatCurrencyBRL(monthFinancials.totalAVista)}
          </div>
          <span className="text-[10px] text-muted-foreground">Recebido diretamente</span>
        </div>

        {/* Situação: Permitidas vs Pendentes */}
        <div className="p-3.5 rounded-2xl border bg-card space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 block">
            Pré-Vendas & NF
          </span>
          <div className="text-xl font-black font-display text-amber-600 dark:text-amber-400 tracking-tight">
            {monthFinancials.pendingCount} pendentes
          </div>
          <span className="text-[10px] text-muted-foreground">{monthFinancials.permittedCount} já liberadas</span>
        </div>
      </div>

      {/* BARRA DE FILTROS AVANÇADOS, BUSCA & AGRUPAMENTO */}
      <div className="flex flex-col lg:flex-row gap-3 items-center justify-between bg-card p-3 rounded-2xl border shadow-sm">
        <div className="flex flex-wrap flex-1 w-full items-center gap-2">
          {/* Busca por Texto */}
          <div className="relative min-w-[220px] flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente, modelo, chassi, vendedor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9 pl-9 text-xs bg-background rounded-xl"
            />
          </div>

          {/* Filtro de Concessionária (Ex: MOC - Montes Claros / Matriz / Filiais) */}
          <Select value={selectedStoreFilter} onValueChange={setSelectedStoreFilter}>
            <SelectTrigger className="h-9 text-xs w-[190px] bg-background rounded-xl font-medium">
              <Building2 className="w-3.5 h-3.5 mr-1 text-primary shrink-0" />
              <SelectValue placeholder="Concessionária" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">🏢 Todas as Lojas</SelectItem>
              <SelectItem value="MOC">📍 Concessionária MOC (Montes Claros)</SelectItem>
              <SelectItem value="MATRIZ">🏢 Demais Lojas / Matriz</SelectItem>
            </SelectContent>
          </Select>

          {/* Filtro de Status (Faturada vs Pré-venda) */}
          <Select value={filterStatus} onValueChange={(v: any) => setFilterStatus(v)}>
            <SelectTrigger className="h-9 text-xs w-[160px] bg-background rounded-xl">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              <SelectItem value="permitted">Faturadas / Liberadas</SelectItem>
              <SelectItem value="pending">Pré-Vendas (Claras)</SelectItem>
            </SelectContent>
          </Select>

          {/* Filtro de Bancos */}
          <Select value={selectedBankFilter} onValueChange={setSelectedBankFilter}>
            <SelectTrigger className="h-9 text-xs w-[140px] bg-background rounded-xl">
              <SelectValue placeholder="Banco" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Bancos</SelectItem>
              {availableBanks.map((b) => (
                <SelectItem key={b} value={b}>{b}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Filtro de Comprovantes */}
          <Select value={receiptFilter} onValueChange={(v: any) => setReceiptFilter(v)}>
            <SelectTrigger className="h-9 text-xs w-[160px] bg-background rounded-xl">
              <SelectValue placeholder="Comprovantes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Comprovantes</SelectItem>
              <SelectItem value="with_receipt">Com Fotos / Recibo</SelectItem>
              <SelectItem value="without_receipt">Sem Comprovante</SelectItem>
            </SelectContent>
          </Select>

          {/* Agrupar por */}
          {viewMode === 'grid' && (
            <div className="flex items-center gap-1.5 bg-muted/30 px-2 py-1 rounded-xl border">
              <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[11px] font-semibold text-muted-foreground">Agrupar:</span>
              <Select value={groupBy} onValueChange={(v: any) => setGroupBy(v)}>
                <SelectTrigger className="h-7 text-[11px] border-none shadow-none font-bold bg-transparent">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  <SelectItem value="vendedor">Por Vendedor</SelectItem>
                  <SelectItem value="banco">Por Banco</SelectItem>
                  <SelectItem value="status">Por Status</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Limpar Vendedor selecionado se ativo */}
          {selectedSellerFilter !== 'all' && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setSelectedSellerFilter('all')}
              className="h-9 text-xs gap-1 rounded-xl font-semibold"
            >
              Vendedor: {selectedSellerFilter} ✕
            </Button>
          )}
        </div>

        {/* Indicadores de Legenda */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            Normal (Faturada)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 opacity-60" />
            Mais Clara (Pré-Venda)
          </span>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 1. MODO GRADE: PLANILHA EXECUTIVA DINÂMICA V9.0         */}
      {/* ======================================================== */}
      {viewMode === 'grid' && (
        <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
          <div className="p-3 bg-muted/40 border-b flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="font-bold text-foreground">
                Grade Operacional ({sortedRows.length} {sortedRows.length === 1 ? 'lançamento' : 'lançamentos'})
              </span>
              <span className="text-muted-foreground">• Clique em qualquer célula para editar ao vivo (estilo Excel Web) ou arraste comprovantes para a linha</span>
            </div>
            <span className="text-[11px] text-muted-foreground">
              Total Visível: <strong className="text-foreground">{formatCurrencyBRL(sortedRows.reduce((acc, r) => acc + (r.valor || 0), 0))}</strong>
            </span>
          </div>

          <div className="overflow-x-auto max-h-[680px] relative">
            <Table className="text-xs">
              <TableHeader className="bg-muted/80 sticky top-0 z-10 backdrop-blur">
                <TableRow className="border-b font-bold text-foreground uppercase tracking-wider text-[10px]">
                  <TableHead className="w-10 text-center py-2.5">#</TableHead>
                  <TableHead className="w-12 text-center py-2.5 cursor-pointer hover:text-primary" onClick={() => handleSort('qt')}>
                    <span className="flex items-center justify-center gap-1">QT <ArrowUpDown className="w-3 h-3" /></span>
                  </TableHead>
                  <TableHead className="w-24 text-center py-2.5">Status / Ação</TableHead>
                  <TableHead className="w-24 py-2.5 cursor-pointer hover:text-primary" onClick={() => handleSort('data')}>
                    <span className="flex items-center gap-1">Data <ArrowUpDown className="w-3 h-3" /></span>
                  </TableHead>
                  <TableHead className="py-2.5 cursor-pointer hover:text-primary" onClick={() => handleSort('vendedor')}>
                    <span className="flex items-center gap-1">Vendedor <ArrowUpDown className="w-3 h-3" /></span>
                  </TableHead>
                  <TableHead className="py-2.5">Chassi</TableHead>
                  <TableHead className="py-2.5">Modelo</TableHead>
                  <TableHead className="py-2.5 cursor-pointer hover:text-primary" onClick={() => handleSort('cliente')}>
                    <span className="flex items-center gap-1">Cliente <ArrowUpDown className="w-3 h-3" /></span>
                  </TableHead>
                  <TableHead className="py-2.5">Região</TableHead>
                  <TableHead className="text-right py-2.5 cursor-pointer hover:text-primary" onClick={() => handleSort('valor')}>
                    <span className="flex items-center justify-end gap-1">Valor <ArrowUpDown className="w-3 h-3" /></span>
                  </TableHead>
                  <TableHead className="text-right py-2.5 cursor-pointer hover:text-primary" onClick={() => handleSort('financiamento')}>
                    <span className="flex items-center justify-end gap-1">Financ. <ArrowUpDown className="w-3 h-3" /></span>
                  </TableHead>
                  <TableHead className="py-2.5">Banco</TableHead>
                  <TableHead className="text-right py-2.5">Dinheiro</TableHead>
                  <TableHead className="text-right py-2.5">Pix</TableHead>
                  <TableHead className="text-right py-2.5">Cartão</TableHead>
                  <TableHead className="text-center py-2.5">Comp (Fotos)</TableHead>
                  <TableHead className="text-right py-2.5">Total</TableHead>
                  <TableHead className="py-2.5 min-w-[200px]">Mapeamento / Observações</TableHead>
                  <TableHead className="w-16 text-right pr-3 py-2.5">Ações</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {sortedRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={19} className="text-center py-12 text-muted-foreground text-xs">
                      Nenhum registro encontrado para este filtro.
                    </TableCell>
                  </TableRow>
                ) : groupedData ? (
                  // RENDERIZAÇÃO AGRUPADA
                  Object.entries(groupedData).map(([groupTitle, groupRows]) => {
                    const isCollapsed = collapsedGroups[groupTitle] || false;
                    const groupTotal = groupRows.reduce((acc, r) => acc + (r.valor || 0), 0);

                    return (
                      <>
                        <TableRow
                          key={`group-header-${groupTitle}`}
                          className="bg-muted/60 hover:bg-muted font-bold cursor-pointer border-t-2"
                          onClick={() =>
                            setCollapsedGroups((prev) => ({
                              ...prev,
                              [groupTitle]: !prev[groupTitle],
                            }))
                          }
                        >
                          <TableCell colSpan={19} className="py-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {isCollapsed ? (
                                  <ChevronRight className="w-4 h-4 text-primary" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-primary" />
                                )}
                                <span className="text-xs uppercase tracking-wider text-foreground">
                                  {groupTitle}
                                </span>
                                <Badge variant="secondary" className="text-[10px] font-mono">
                                  {groupRows.length} {groupRows.length === 1 ? 'venda' : 'vendas'}
                                </Badge>
                              </div>
                              <span className="text-xs font-black text-foreground">
                                Subtotal: {formatCurrencyBRL(groupTotal)}
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>

                        {!isCollapsed &&
                          groupRows.map((row) => renderTableRow(row))}
                      </>
                    );
                  })
                ) : (
                  // RENDERIZAÇÃO NORMAL (COM SUPORTE A REORDENAÇÃO VIA DRAG & DROP)
                  sortedRows.map((row) => renderTableRow(row))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. MODO KANBAN INTERATIVO: FUNIL DE FATURAMENTO          */}
      {/* ======================================================== */}
      {viewMode === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Coluna 1: Pré-Vendas (Em Análise / Tom Claro) */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData('text/plain');
              if (id) handleKanbanDrop(id, 'pending');
            }}
            className="rounded-2xl border bg-amber-500/5 p-4 space-y-3 min-h-[500px] flex flex-col border-dashed border-amber-500/40"
          >
            <div className="flex items-center justify-between pb-2 border-b border-amber-500/20">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" />
                <h3 className="font-black text-xs uppercase tracking-wider text-amber-700 dark:text-amber-400">
                  Pré-Vendas (Tom Claro)
                </h3>
              </div>
              <Badge variant="secondary" className="font-mono text-xs font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300">
                {sortedRows.filter((r) => !r.is_permitted).length}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Aguardando confirmação bancária ou liberação gerencial.
            </p>

            <div className="space-y-3 flex-1 overflow-y-auto max-h-[600px] pr-1">
              {sortedRows
                .filter((r) => !r.is_permitted)
                .map((row) => renderKanbanCard(row))}
            </div>
          </div>

          {/* Coluna 2: Aguardando Comprovantes */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData('text/plain');
              if (id) handleKanbanDrop(id, 'no_receipt');
            }}
            className="rounded-2xl border bg-card p-4 space-y-3 min-h-[500px] flex flex-col border-primary/20"
          >
            <div className="flex items-center justify-between pb-2 border-b">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <h3 className="font-black text-xs uppercase tracking-wider text-foreground">
                  Aguardando Comprovante
                </h3>
              </div>
              <Badge variant="secondary" className="font-mono text-xs font-bold">
                {
                  sortedRows.filter((r) => {
                    const recs = getSaleReceipts(r.id);
                    return r.is_permitted && recs.length === 0 && (!r.comp || r.comp.toLowerCase() !== 'imagem');
                  }).length
                }
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Vendas liberadas que ainda não tiveram foto de comprovante anexada.
            </p>

            <div className="space-y-3 flex-1 overflow-y-auto max-h-[600px] pr-1">
              {sortedRows
                .filter((r) => {
                  const recs = getSaleReceipts(r.id);
                  return r.is_permitted && recs.length === 0 && (!r.comp || r.comp.toLowerCase() !== 'imagem');
                })
                .map((row) => renderKanbanCard(row))}
            </div>
          </div>

          {/* Coluna 3: Faturadas & 100% Concluídas */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData('text/plain');
              if (id) handleKanbanDrop(id, 'faturada');
            }}
            className="rounded-2xl border bg-emerald-500/5 p-4 space-y-3 min-h-[500px] flex flex-col border-emerald-500/30"
          >
            <div className="flex items-center justify-between pb-2 border-b border-emerald-500/20">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <h3 className="font-black text-xs uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  Faturadas & Concluídas
                </h3>
              </div>
              <Badge variant="secondary" className="font-mono text-xs font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                {
                  sortedRows.filter((r) => {
                    const recs = getSaleReceipts(r.id);
                    return r.is_permitted && (recs.length > 0 || (r.comp && r.comp.toLowerCase() === 'imagem'));
                  }).length
                }
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Vendas formalizadas com comprovantes ou pagamento garantido.
            </p>

            <div className="space-y-3 flex-1 overflow-y-auto max-h-[600px] pr-1">
              {sortedRows
                .filter((r) => {
                  const recs = getSaleReceipts(r.id);
                  return r.is_permitted && (recs.length > 0 || (r.comp && r.comp.toLowerCase() === 'imagem'));
                })
                .map((row) => renderKanbanCard(row))}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. MODO LINEARIDADE: RITMO DE VENDAS & LINHA DO TEMPO    */}
      {/* ======================================================== */}
      {viewMode === 'timeline' && (
        <div className="space-y-4">
          <div className="rounded-2xl border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                <div>
                  <h3 className="font-black text-sm text-foreground">
                    Linearidade & Ritmo Comercial • {MONTHS_LABELS[selectedMonth.split('-')[1]] || selectedMonth}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Distribuição cronológica das vendas e ritmo de entrada financeira dia a dia.
                  </p>
                </div>
              </div>
              <Badge className="bg-primary/10 text-primary border-primary/20 font-mono font-bold">
                Média: {(sortedRows.length / 22).toFixed(1)} motos/dia útil
              </Badge>
            </div>
          </div>

          {/* Linha do Tempo Visual */}
          <div className="space-y-4 relative before:absolute before:inset-0 before:left-7 before:w-0.5 before:bg-border">
            {timelineData.map((dayGroup) => (
              <div key={dayGroup.dateStr} className="relative flex items-start gap-4">
                {/* Marcador do Dia */}
                <div className="w-14 h-14 rounded-2xl bg-primary text-primary-foreground flex flex-col items-center justify-center font-bold shadow-md shadow-primary/20 shrink-0 z-10">
                  <span className="text-[10px] uppercase tracking-wider opacity-80">DIA</span>
                  <span className="text-lg leading-tight font-black">{dayGroup.dayNum}</span>
                </div>

                {/* Conteúdo do Dia */}
                <div className="flex-1 rounded-2xl border bg-card p-4 shadow-sm space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-foreground">
                        {dayGroup.dateStr}
                      </span>
                      <Badge variant="outline" className="text-[10px] font-bold">
                        {dayGroup.rows.length} {dayGroup.rows.length === 1 ? 'venda' : 'vendas'}
                      </Badge>
                    </div>
                    <span className="text-xs font-black text-primary">
                      Volume: {formatCurrencyBRL(dayGroup.total)}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {dayGroup.rows.map((row) => (
                      <div
                        key={row.id}
                        className={`p-3 rounded-xl border transition-all ${
                          row.is_permitted
                            ? 'bg-muted/10 hover:border-primary/50'
                            : 'bg-amber-500/5 border-dashed border-amber-500/40 opacity-70'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-foreground">{row.modelo}</span>
                          <span className="font-mono text-xs font-black text-primary">{formatCurrencyBRL(row.valor)}</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-1 flex justify-between">
                          <span>{row.cliente}</span>
                          <span className="font-semibold">{row.vendedor}</span>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t mt-2 text-[10px]">
                          <Badge variant="outline" className="py-0 px-1 font-bold">
                            {row.banco || 'À Vista'}
                          </Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setActiveCompRow(row);
                              setCompModalOpen(true);
                            }}
                            className="h-6 px-1.5 text-[10px] gap-1 text-primary"
                          >
                            <ImageIcon className="w-3 h-3" />
                            {getSaleReceipts(row.id).length} Fotos
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: IMPORTAR BACKUP DA PLANILHA (CSV) */}
      <Dialog open={importModalOpen} onOpenChange={setImportModalOpen}>
        <DialogContent className="max-w-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Upload className="w-5 h-5 text-primary" />
              Importar Backup da Planilha
            </DialogTitle>
            <DialogDescription className="text-xs">
              Cole o conteúdo copiado da sua planilha oficial (delimitado por ponto e vírgula).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Opção de Enviar Arquivo .xlsx diretamente */}
            <div className="p-3 border rounded-xl bg-muted/30 flex items-center justify-between gap-3">
              <div>
                <p className="font-bold text-foreground">Importar arquivo do Excel (.xlsx / .csv)</p>
                <p className="text-[11px] text-muted-foreground">Selecione o arquivo baixado do Excel Online ou gerado no seu computador.</p>
              </div>
              <label className="cursor-pointer shrink-0">
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 font-bold pointer-events-none">
                  <Upload className="w-3.5 h-3.5 text-primary" />
                  Escolher Arquivo .XLSX
                </Button>
              </label>
            </div>

            <div className="flex justify-between items-center">
              <Label className="text-xs font-semibold">Ou cole o conteúdo da Planilha (CSV / Excel):</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCsvInput(INITIAL_USER_BACKUP_CSV)}
                className="h-7 text-[11px] gap-1 font-semibold text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
              >
                Carregar Dados Divinópolis (Out/2026)
              </Button>
            </div>

            <Textarea
              rows={8}
              value={csvInput}
              onChange={(e) => setCsvInput(e.target.value)}
              placeholder="QT;MAPEAMENTO DE LEAD;DATA;VENDEDOR;CHASSI;MODELO;CLIENTE;REGIÃO;VALOR;FINANCIAMENTO..."
              className="font-mono text-[11px] bg-muted/20"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setImportModalOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" className="font-bold" onClick={handleImportBackup}>
              Processar & Sincronizar Linhas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: NOVO LANÇAMENTO V9.0 */}
      <Dialog open={newRowModalOpen} onOpenChange={setNewRowModalOpen}>
        <DialogContent className="max-w-3xl rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" />
              Novo Lançamento na Planilha v9.0
            </DialogTitle>
            <DialogDescription className="text-xs">
              Cadastre a venda com todas as colunas operacionais da concessionária.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* 1. Dados Básicos */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs font-semibold">Vendedor</Label>
                <Select
                  value={newRowForm.vendedor}
                  onValueChange={(v) => setNewRowForm({ ...newRowForm, vendedor: v })}
                >
                  <SelectTrigger className="h-9 mt-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Geibriel">Geibriel</SelectItem>
                    <SelectItem value="Daniel">Daniel</SelectItem>
                    <SelectItem value="Lilian">Lilian</SelectItem>
                    <SelectItem value="Breno">Breno</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold">Data da Venda</Label>
                <Input
                  value={newRowForm.data}
                  onChange={(e) => setNewRowForm({ ...newRowForm, data: e.target.value })}
                  placeholder="01/10/2026"
                  className="h-9 mt-1 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Tipo de Registro</Label>
                <Select
                  value={newRowForm.tipo}
                  onValueChange={(v: any) => setNewRowForm({ ...newRowForm, tipo: v })}
                >
                  <SelectTrigger className="h-9 mt-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="venda">Venda Concluída (Normal)</SelectItem>
                    <SelectItem value="pre_venda">Pré-Venda (Mais Clara)</SelectItem>
                    <SelectItem value="emissao_nf">Emissão de NF (Mais Clara)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 2. Moto & Cliente */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-2">
                <Label className="text-xs font-semibold">Modelo da Moto *</Label>
                <Input
                  value={newRowForm.modelo}
                  onChange={(e) => setNewRowForm({ ...newRowForm, modelo: e.target.value })}
                  placeholder="Ex: SHI 250, RIO 125, STORM 200..."
                  className="h-9 mt-1 text-xs uppercase"
                />
              </div>

              <div className="sm:col-span-2">
                <Label className="text-xs font-semibold">Número do Chassi</Label>
                <Input
                  value={newRowForm.chassi}
                  onChange={(e) => setNewRowForm({ ...newRowForm, chassi: e.target.value })}
                  placeholder="99HSHF250VS..."
                  className="h-9 mt-1 text-xs font-mono uppercase"
                />
              </div>

              <div className="sm:col-span-2">
                <Label className="text-xs font-semibold">Nome do Cliente *</Label>
                <Input
                  value={newRowForm.cliente}
                  onChange={(e) => setNewRowForm({ ...newRowForm, cliente: e.target.value })}
                  placeholder="Nome completo do comprador"
                  className="h-9 mt-1 text-xs uppercase"
                />
              </div>

              <div className="sm:col-span-2">
                <Label className="text-xs font-semibold">Região / Cidade</Label>
                <Input
                  value={newRowForm.regiao}
                  onChange={(e) => setNewRowForm({ ...newRowForm, regiao: e.target.value })}
                  placeholder="DIVINOPOLIS, BELO HORIZONTE..."
                  className="h-9 mt-1 text-xs uppercase"
                />
              </div>
            </div>

            {/* 3. Pagamento & Valores */}
            <div className="p-3.5 rounded-2xl bg-muted/20 border space-y-3">
              <span className="font-bold text-xs uppercase text-foreground block">
                Composição do Pagamento
              </span>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <Label className="text-[11px] font-semibold">Valor da Venda (R$)</Label>
                  <Input
                    value={newRowForm.valor}
                    onChange={(e) => setNewRowForm({ ...newRowForm, valor: e.target.value })}
                    placeholder="23.330,00"
                    className="h-8 mt-1 text-xs font-bold"
                  />
                </div>

                <div>
                  <Label className="text-[11px] font-semibold">Financiamento (R$)</Label>
                  <Input
                    value={newRowForm.financiamento}
                    onChange={(e) => setNewRowForm({ ...newRowForm, financiamento: e.target.value })}
                    placeholder="13.998,00"
                    className="h-8 mt-1 text-xs"
                  />
                </div>

                <div>
                  <Label className="text-[11px] font-semibold">Banco Operador</Label>
                  <Select
                    value={newRowForm.banco}
                    onValueChange={(v) => setNewRowForm({ ...newRowForm, banco: v })}
                  >
                    <SelectTrigger className="h-8 mt-1 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PAN">BANCO PAN</SelectItem>
                      <SelectItem value="SANTANDER">SANTANDER</SelectItem>
                      <SelectItem value="ALTIS">ALTIS</SelectItem>
                      <SelectItem value="MOTRIX">MOTRIX</SelectItem>
                      <SelectItem value="BRADESCO M">BRADESCO M</SelectItem>
                      <SelectItem value="OUTRO">OUTRO</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-[11px] font-semibold">Dinheiro (R$)</Label>
                  <Input
                    value={newRowForm.dinheiro}
                    onChange={(e) => setNewRowForm({ ...newRowForm, dinheiro: e.target.value })}
                    placeholder="0,00"
                    className="h-8 mt-1 text-xs"
                  />
                </div>

                <div>
                  <Label className="text-[11px] font-semibold">PIX (R$)</Label>
                  <Input
                    value={newRowForm.pix}
                    onChange={(e) => setNewRowForm({ ...newRowForm, pix: e.target.value })}
                    placeholder="0,00"
                    className="h-8 mt-1 text-xs"
                  />
                </div>

                <div>
                  <Label className="text-[11px] font-semibold">Cartão (R$)</Label>
                  <Input
                    value={newRowForm.cartao}
                    onChange={(e) => setNewRowForm({ ...newRowForm, cartao: e.target.value })}
                    placeholder="0,00"
                    className="h-8 mt-1 text-xs"
                  />
                </div>

                <div>
                  <Label className="text-[11px] font-semibold">Carta de Crédito (R$)</Label>
                  <Input
                    value={newRowForm.carta_credito}
                    onChange={(e) => setNewRowForm({ ...newRowForm, carta_credito: e.target.value })}
                    placeholder="0,00"
                    className="h-8 mt-1 text-xs"
                  />
                </div>

                <div>
                  <Label className="text-[11px] font-semibold">Custos da Venda (R$)</Label>
                  <Input
                    value={newRowForm.custos}
                    onChange={(e) => setNewRowForm({ ...newRowForm, custos: e.target.value })}
                    placeholder="0,00"
                    className="h-8 mt-1 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* 4. Mapeamento & Observações */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Mapeamento de Lead / Origem</Label>
                <Input
                  value={newRowForm.lead_mapping}
                  onChange={(e) => setNewRowForm({ ...newRowForm, lead_mapping: e.target.value })}
                  placeholder="Ex: WhatsApp, Instagram, Balcão, Site..."
                  className="h-9 mt-1 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Observações Operacionais</Label>
                <Input
                  value={newRowForm.observacoes}
                  onChange={(e) => setNewRowForm({ ...newRowForm, observacoes: e.target.value })}
                  placeholder="Ex: 3k serão pagos na entrega..."
                  className="h-9 mt-1 text-xs"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setNewRowModalOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" className="font-bold" onClick={handleCreateRowV9}>
              Salvar na Planilha v9.0
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: COMPROVANTES DE PAGAMENTO DA LINHA (GALERIA & LIGHTBOX) */}
      <Dialog open={compModalOpen} onOpenChange={setCompModalOpen}>
        <DialogContent className="max-w-3xl rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-primary" />
              Galeria de Comprovantes — Venda #{activeCompRow?.qt}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {activeCompRow?.cliente} • {activeCompRow?.modelo} • Total: {formatCurrencyBRL(activeCompRow?.valor)}
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            {activeCompRow && (
              <ReceiptAttachmentManager
                saleId={activeCompRow.id}
                saleTitle={`${activeCompRow.cliente} (${activeCompRow.modelo})`}
                onReceiptsChange={(recs) => {
                  const updated = sheetRows.map((r) =>
                    r.id === activeCompRow.id
                      ? { ...r, comp: recs.length > 0 ? 'Imagem' : '' }
                      : r
                  );
                  saveRowsMutation.mutate(updated);
                }}
              />
            )}
          </div>

          <DialogFooter>
            <Button size="sm" onClick={() => setCompModalOpen(false)} className="font-bold">
              Concluir & Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: EDIÇÃO DA VENDA PELO VENDEDOR */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-3xl rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Pencil className="w-5 h-5 text-primary" />
              Editar Venda #{editingRow?.qt} — {editingRow?.cliente}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Altere dados da venda, renegociações de entrada, banco ou observações da entrega.
            </DialogDescription>
          </DialogHeader>

          {editingRow && (
            <div className="space-y-4 py-2 text-xs">
              {/* 1. Dados Básicos */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs font-semibold">Vendedor</Label>
                  <Select
                    value={editingRow.vendedor}
                    onValueChange={(v) => setEditingRow({ ...editingRow, vendedor: v })}
                  >
                    <SelectTrigger className="h-9 mt-1 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Geibriel">Geibriel</SelectItem>
                      <SelectItem value="Daniel">Daniel</SelectItem>
                      <SelectItem value="Lilian">Lilian</SelectItem>
                      <SelectItem value="Breno">Breno</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs font-semibold">Data da Venda</Label>
                  <Input
                    value={editingRow.data}
                    onChange={(e) => setEditingRow({ ...editingRow, data: e.target.value })}
                    className="h-9 mt-1 text-xs"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">Status de Liberação</Label>
                  <Select
                    value={editingRow.is_permitted ? 'permitted' : 'pending'}
                    onValueChange={(v) => setEditingRow({ ...editingRow, is_permitted: v === 'permitted' })}
                  >
                    <SelectTrigger className="h-9 mt-1 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="permitted">Faturada / Permitida (Normal)</SelectItem>
                      <SelectItem value="pending">Pré-Venda / Em Análise (Mais Clara)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* 2. Moto & Cliente */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-2">
                  <Label className="text-xs font-semibold">Modelo da Moto</Label>
                  <Input
                    value={editingRow.modelo}
                    onChange={(e) => setEditingRow({ ...editingRow, modelo: e.target.value.toUpperCase() })}
                    className="h-9 mt-1 text-xs font-bold uppercase"
                  />
                </div>

                <div className="sm:col-span-2">
                  <Label className="text-xs font-semibold">Número do Chassi</Label>
                  <Input
                    value={editingRow.chassi}
                    onChange={(e) => setEditingRow({ ...editingRow, chassi: e.target.value.toUpperCase() })}
                    className="h-9 mt-1 text-xs font-mono uppercase"
                  />
                </div>

                <div className="sm:col-span-2">
                  <Label className="text-xs font-semibold">Nome do Cliente</Label>
                  <Input
                    value={editingRow.cliente}
                    onChange={(e) => setEditingRow({ ...editingRow, cliente: e.target.value.toUpperCase() })}
                    className="h-9 mt-1 text-xs uppercase"
                  />
                </div>

                <div className="sm:col-span-2">
                  <Label className="text-xs font-semibold">Região / Cidade</Label>
                  <Input
                    value={editingRow.regiao}
                    onChange={(e) => setEditingRow({ ...editingRow, regiao: e.target.value.toUpperCase() })}
                    className="h-9 mt-1 text-xs uppercase"
                  />
                </div>
              </div>

              {/* 3. Pagamento & Valores */}
              <div className="p-3.5 rounded-2xl bg-muted/20 border space-y-3">
                <span className="font-bold text-xs uppercase text-foreground block">
                  Valores & Meios de Pagamento
                </span>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <Label className="text-[11px] font-semibold">Valor da Venda (R$)</Label>
                    <Input
                      type="number"
                      value={editingRow.valor || 0}
                      onChange={(e) => setEditingRow({ ...editingRow, valor: Number(e.target.value) })}
                      className="h-8 mt-1 text-xs font-bold"
                    />
                  </div>

                  <div>
                    <Label className="text-[11px] font-semibold">Financiamento (R$)</Label>
                    <Input
                      type="number"
                      value={editingRow.financiamento || 0}
                      onChange={(e) => setEditingRow({ ...editingRow, financiamento: Number(e.target.value) })}
                      className="h-8 mt-1 text-xs font-semibold text-primary"
                    />
                  </div>

                  <div>
                    <Label className="text-[11px] font-semibold">Banco Operador</Label>
                    <Select
                      value={editingRow.banco}
                      onValueChange={(v) => setEditingRow({ ...editingRow, banco: v })}
                    >
                      <SelectTrigger className="h-8 mt-1 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PAN">BANCO PAN</SelectItem>
                        <SelectItem value="SANTANDER">SANTANDER</SelectItem>
                        <SelectItem value="ALTIS">ALTIS</SelectItem>
                        <SelectItem value="MOTRIX">MOTRIX</SelectItem>
                        <SelectItem value="BRADESCO M">BRADESCO M</SelectItem>
                        <SelectItem value="OUTRO">OUTRO</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-[11px] font-semibold">Dinheiro (R$)</Label>
                    <Input
                      type="number"
                      value={editingRow.dinheiro || 0}
                      onChange={(e) => setEditingRow({ ...editingRow, dinheiro: Number(e.target.value) })}
                      className="h-8 mt-1 text-xs"
                    />
                  </div>

                  <div>
                    <Label className="text-[11px] font-semibold">PIX (R$)</Label>
                    <Input
                      type="number"
                      value={editingRow.pix || 0}
                      onChange={(e) => setEditingRow({ ...editingRow, pix: Number(e.target.value) })}
                      className="h-8 mt-1 text-xs"
                    />
                  </div>

                  <div>
                    <Label className="text-[11px] font-semibold">Cartão (R$)</Label>
                    <Input
                      type="number"
                      value={editingRow.cartao || 0}
                      onChange={(e) => setEditingRow({ ...editingRow, cartao: Number(e.target.value) })}
                      className="h-8 mt-1 text-xs"
                    />
                  </div>

                  <div>
                    <Label className="text-[11px] font-semibold">Carta de Crédito (R$)</Label>
                    <Input
                      type="number"
                      value={editingRow.carta_credito || 0}
                      onChange={(e) => setEditingRow({ ...editingRow, carta_credito: Number(e.target.value) })}
                      className="h-8 mt-1 text-xs"
                    />
                  </div>

                  <div>
                    <Label className="text-[11px] font-semibold">Custos da Venda (R$)</Label>
                    <Input
                      type="number"
                      value={editingRow.custos || 0}
                      onChange={(e) => setEditingRow({ ...editingRow, custos: Number(e.target.value) })}
                      className="h-8 mt-1 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* 4. Observações */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold">Mapeamento de Lead</Label>
                  <Input
                    value={editingRow.lead_mapping}
                    onChange={(e) => setEditingRow({ ...editingRow, lead_mapping: e.target.value })}
                    className="h-9 mt-1 text-xs"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">Observações (Ex: 3k pagos na entrega)</Label>
                  <Input
                    value={editingRow.observacoes}
                    onChange={(e) => setEditingRow({ ...editingRow, observacoes: e.target.value })}
                    className="h-9 mt-1 text-xs"
                  />
                </div>
              </div>

              {/* 5. Comprovantes Anexados a Esta Venda */}
              <div className="pt-2 border-t">
                <ReceiptAttachmentManager
                  saleId={editingRow.id}
                  saleTitle={`${editingRow.cliente} (${editingRow.modelo})`}
                  onReceiptsChange={(recs) => {
                    setEditingRow({ ...editingRow, comp: recs.length > 0 ? 'Imagem' : '' });
                  }}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setEditModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              className="font-bold"
              onClick={() => {
                if (!editingRow) return;
                const updated = sheetRows.map((r) => (r.id === editingRow.id ? editingRow : r));
                saveRowsMutation.mutate(updated);
                setEditModalOpen(false);
                setEditingRow(null);
                toast({
                  title: 'Alterações da venda salvas com sucesso!',
                  description: `A venda #${editingRow.qt} foi atualizada na planilha.`,
                });
              }}
            >
              Salvar Alterações da Venda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  // ========================================================
  // RENDERIZADORES AUXILIARES
  // ========================================================

  // Renderizador de Célula Editável Inline (Estilo Excel na Web)
  function renderEditableCell(
    row: SheetRowV9,
    field: keyof SheetRowV9,
    displayContent: React.ReactNode,
    className = ''
  ) {
    const isEditingThis = inlineCell?.rowId === row.id && inlineCell?.field === field;
    const rawVal = row[field];

    return (
      <TableCell
        className={`${className} cursor-pointer hover:bg-primary/5 transition-colors`}
        title="Clique para editar diretamente na célula (Enter para salvar)"
        onClick={(e) => {
          if (!isEditingThis) {
            e.stopPropagation();
            setInlineCell({
              rowId: row.id,
              field,
              value: rawVal === undefined || rawVal === null || rawVal === 0 ? '' : String(rawVal),
            });
          }
        }}
      >
        {isEditingThis ? (
          <Input
            autoFocus
            value={inlineCell.value}
            onChange={(e) => setInlineCell({ ...inlineCell, value: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitInlineCellEdit();
              } else if (e.key === 'Escape') {
                setInlineCell(null);
              }
            }}
            onBlur={commitInlineCellEdit}
            className="h-7 px-1.5 py-0 text-xs font-semibold bg-background border-primary ring-1 ring-primary min-w-[85px]"
          />
        ) : (
          displayContent
        )}
      </TableCell>
    );
  }

  // Renderizador de Linha da Grade (Tabela) com Suporte a Drag & Drop de Arquivos, Reordenação e Edição Inline Excel Web
  function renderTableRow(row: SheetRowV9) {
    const isPermitted = row.is_permitted;
    const receipts = getSaleReceipts(row.id);
    const hasReceipts = receipts.length > 0 || (row.comp && row.comp.toLowerCase() === 'imagem');
    const isFileDropTarget = fileDropTargetRowId === row.id;
    const isDragOverReorder = dragOverRowId === row.id;

    return (
      <TableRow
        key={row.id}
        draggable={!inlineCell}
        onDragStart={(e) => {
          if (inlineCell) return;
          e.dataTransfer.setData('text/plain', row.id);
          setDraggedRowId(row.id);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (e.dataTransfer.types.includes('Files')) {
            setFileDropTargetRowId(row.id);
          } else {
            setDragOverRowId(row.id);
          }
        }}
        onDragLeave={() => {
          setFileDropTargetRowId(null);
          setDragOverRowId(null);
        }}
        onDrop={(e) => {
          if (e.dataTransfer.types.includes('Files')) {
            handleDropFileOnRow(e, row);
          } else {
            e.preventDefault();
            handleRowDrop(row.id);
          }
        }}
        className={`transition-all border-b font-medium select-none relative ${
          isFileDropTarget
            ? 'ring-2 ring-primary bg-primary/20 scale-[1.01] z-20 shadow-lg'
            : isDragOverReorder
            ? 'border-t-4 border-t-primary bg-primary/10'
            : isPermitted
            ? 'opacity-100 bg-card hover:bg-muted/30 border-l-4 border-l-emerald-500'
            : 'opacity-55 hover:opacity-95 bg-amber-500/5 border-l-4 border-l-amber-500 border-dashed'
        }`}
      >
        {/* Grip Handle para Arrastar Linha */}
        <TableCell className="text-center py-2 px-1 text-muted-foreground/50 hover:text-foreground cursor-grab active:cursor-grabbing">
          <GripVertical className="w-3.5 h-3.5 mx-auto" />
        </TableCell>

        {/* QT */}
        <TableCell className="text-center font-mono font-bold text-xs text-muted-foreground">
          {row.qt}
        </TableCell>

        {/* Status / Permissão */}
        <TableCell className="text-center">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => togglePermit(row.id)}
            className={`h-7 px-2 text-[10px] font-bold rounded-lg ${
              isPermitted
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
                : 'bg-amber-500/20 text-amber-700 dark:text-amber-400 hover:bg-amber-500/30'
            }`}
          >
            {isPermitted ? (
              <span className="flex items-center gap-1">
                <Check className="w-3 h-3 text-emerald-500" /> Faturada
              </span>
            ) : (
              <span className="flex items-center gap-1 animate-pulse">
                <Clock className="w-3 h-3 text-amber-500" /> Permitir
              </span>
            )}
          </Button>
        </TableCell>

        {/* Data */}
        {renderEditableCell(row, 'data', row.data, 'whitespace-nowrap text-muted-foreground text-[11px]')}

        {/* Vendedor */}
        {renderEditableCell(row, 'vendedor', row.vendedor, 'font-bold text-foreground')}

        {/* Chassi */}
        {renderEditableCell(
          row,
          'chassi',
          row.chassi ? `#${row.chassi.slice(-6)}` : '—',
          'font-mono text-[11px] text-muted-foreground truncate max-w-[120px]'
        )}

        {/* Modelo */}
        {renderEditableCell(row, 'modelo', row.modelo, 'font-bold text-primary whitespace-nowrap')}

        {/* Cliente */}
        {renderEditableCell(row, 'cliente', row.cliente, 'font-semibold text-foreground truncate max-w-[150px]')}

        {/* Região */}
        {renderEditableCell(row, 'regiao', row.regiao || '—', 'text-muted-foreground text-[11px] whitespace-nowrap')}

        {/* Valor */}
        {renderEditableCell(row, 'valor', formatCurrencyBRL(row.valor), 'text-right font-black text-foreground whitespace-nowrap')}

        {/* Financiamento */}
        {renderEditableCell(
          row,
          'financiamento',
          formatCurrencyBRL(row.financiamento),
          'text-right font-semibold text-primary whitespace-nowrap'
        )}

        {/* Banco */}
        {renderEditableCell(
          row,
          'banco',
          row.banco ? (
            <Badge variant="outline" className="text-[10px] font-bold uppercase py-0 px-1.5">
              {row.banco}
            </Badge>
          ) : (
            <span className="text-muted-foreground text-[11px]">—</span>
          ),
          ''
        )}

        {/* Dinheiro */}
        {renderEditableCell(row, 'dinheiro', formatCurrencyBRL(row.dinheiro), 'text-right font-mono text-[11px]')}

        {/* PIX */}
        {renderEditableCell(row, 'pix', formatCurrencyBRL(row.pix), 'text-right font-mono text-[11px]')}

        {/* Cartão */}
        {renderEditableCell(row, 'cartao', formatCurrencyBRL(row.cartao), 'text-right font-mono text-[11px]')}

        {/* Comp (Comprovantes / Fotos) */}
        <TableCell className="text-center">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setActiveCompRow(row);
              setCompModalOpen(true);
            }}
            className={`h-7 px-2 text-[10px] gap-1 font-bold rounded-lg transition-all ${
              hasReceipts
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 ring-1 ring-emerald-500/30'
                : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            {receipts.length > 0 ? (
              <span>📷 {receipts.length}</span>
            ) : hasReceipts ? (
              <span>Ver Comp.</span>
            ) : (
              <span>+ Anexar</span>
            )}
          </Button>
        </TableCell>

        {/* Total */}
        <TableCell className="text-right font-bold text-foreground whitespace-nowrap">
          {formatCurrencyBRL(row.total || row.valor)}
        </TableCell>

        {/* Mapeamento / Observações */}
        {renderEditableCell(
          row,
          'observacoes',
          row.observacoes || row.lead_mapping ? (
            <span>
              {row.lead_mapping && <strong className="text-foreground">{row.lead_mapping} </strong>}
              {row.observacoes}
            </span>
          ) : (
            '—'
          ),
          'text-[11px] text-muted-foreground max-w-[240px] truncate'
        )}

        {/* Ações */}
        <TableCell className="text-right pr-3 whitespace-nowrap">
          <div className="flex items-center justify-end gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditingRow({ ...row });
                setEditModalOpen(true);
              }}
              className="h-7 px-2 text-[10px] gap-1 font-semibold text-primary hover:bg-primary/10 rounded-lg"
            >
              <Pencil className="w-3 h-3" /> Editar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleDeleteRow(row.id)}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive rounded-lg"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  // Renderizador de Card no Kanban
  function renderKanbanCard(row: SheetRowV9) {
    const receipts = getSaleReceipts(row.id);
    const hasReceipts = receipts.length > 0 || (row.comp && row.comp.toLowerCase() === 'imagem');

    return (
      <div
        key={row.id}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', row.id);
        }}
        className={`p-3.5 rounded-2xl border bg-card shadow-xs hover:shadow-md transition-all cursor-grab active:cursor-grabbing space-y-2.5 relative ${
          row.is_permitted
            ? 'border-border hover:border-primary/50'
            : 'border-amber-500/40 bg-amber-500/5 opacity-80'
        }`}
      >
        {/* Topo do Card: Sequencial, Vendedor e Modelo */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-xs font-black text-muted-foreground">
              #{row.qt}
            </span>
            <Badge variant="secondary" className="text-[10px] font-bold">
              {row.vendedor}
            </Badge>
          </div>
          <span className="text-[10px] text-muted-foreground">{row.data}</span>
        </div>

        {/* Modelo e Cliente */}
        <div>
          <h4 className="font-bold text-sm text-foreground leading-tight">{row.modelo}</h4>
          <p className="text-xs text-muted-foreground truncate">{row.cliente}</p>
        </div>

        {/* Financeiro */}
        <div className="bg-muted/30 p-2 rounded-xl text-xs space-y-1">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground text-[10px]">Total:</span>
            <strong className="text-foreground font-black">{formatCurrencyBRL(row.valor)}</strong>
          </div>
          {row.financiamento > 0 && (
            <div className="flex justify-between items-center text-[11px] text-primary">
              <span>{row.banco || 'Financ.'}:</span>
              <span className="font-bold">{formatCurrencyBRL(row.financiamento)}</span>
            </div>
          )}
        </div>

        {/* Rodapé: Comprovantes & Ações */}
        <div className="flex items-center justify-between pt-1 border-t text-[11px]">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setActiveCompRow(row);
              setCompModalOpen(true);
            }}
            className={`h-7 px-2 text-[10px] gap-1 font-bold rounded-lg ${
              hasReceipts
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
                : 'text-muted-foreground hover:bg-muted/40'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            {receipts.length > 0 ? `${receipts.length} Fotos` : hasReceipts ? 'Comprovante' : '+ Anexar'}
          </Button>

          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditingRow({ ...row });
                setEditModalOpen(true);
              }}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            >
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => togglePermit(row.id)}
              className={`h-7 px-2 text-[10px] font-bold rounded-lg ${
                row.is_permitted
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-amber-600 dark:text-amber-400'
              }`}
            >
              {row.is_permitted ? 'Faturada' : 'Permitir'}
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
