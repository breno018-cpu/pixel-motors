import { useState, useMemo } from 'react';
import { 
  Table as TableIcon, 
  Plus, 
  Trash2, 
  Download, 
  Upload, 
  Settings2, 
  Save, 
  FileSpreadsheet, 
  Edit3, 
  Check, 
  X,
  Search,
  Filter
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/contexts/ConfirmationContext';
import { exportToXLSX } from '@/lib/export';
import * as XLSX from 'xlsx';

export type ColumnType = 'text' | 'currency' | 'number' | 'date' | 'status';

export interface CustomColumn {
  id: string;
  name: string;
  type: ColumnType;
  width?: string;
  options?: string[]; // Para status
}

export interface CustomSpreadsheet {
  id: string;
  title: string;
  description?: string;
  columns: CustomColumn[];
  rows: Record<string, any>[];
  updated_at: string;
}

const DEFAULT_SPREADSHEET: CustomSpreadsheet = {
  id: 'sheet-patio-shineray-v2',
  title: 'Controle Operacional de Pátio, Montagem e Despesas (Shineray)',
  description: 'Planilha livre customizável para controle de ativação, frete e preparação das unidades de Divinópolis e Montes Claros.',
  columns: [
    { id: 'veiculo', name: 'Motocicleta / Modelo', type: 'text', width: '210px' },
    { id: 'chassi', name: 'Chassi / Lote', type: 'text', width: '160px' },
    { id: 'unidade', name: 'Concessionária', type: 'text', width: '150px' },
    { id: 'compra', name: 'Custo Fábrica', type: 'currency', width: '135px' },
    { id: 'oficina', name: 'Montagem / Ativação', type: 'currency', width: '145px' },
    { id: 'venda_alvo', name: 'Preço Tabela', type: 'currency', width: '135px' },
    { id: 'status', name: 'Situação', type: 'status', width: '130px', options: ['Pátio', 'Em Preparação', 'Vendido', 'Reservado'] },
    { id: 'data_entrada', name: 'Data Entrada', type: 'date', width: '120px' },
    { id: 'obs', name: 'Observações Operacionais', type: 'text', width: '240px' },
  ],
  rows: [
    {
      id: 'row-1',
      veiculo: 'SHINERAY SHI 175 EFI 2026',
      chassi: '99HSHF175VS003412',
      unidade: 'Divinópolis (Matriz)',
      compra: 15200,
      oficina: 280,
      venda_alvo: 19990,
      status: 'Vendido',
      data_entrada: '2026-10-05',
      obs: 'Revisão de entrega e ativação concluídas.',
    },
    {
      id: 'row-2',
      veiculo: 'SHINERAY SHI 250 EFI 2026',
      chassi: '99HSHF250VS001222',
      unidade: 'Divinópolis (Matriz)',
      compra: 18100,
      oficina: 320,
      venda_alvo: 23330,
      status: 'Pátio',
      data_entrada: '2026-10-10',
      obs: 'Pronta no showroom principal.',
    },
    {
      id: 'row-3',
      veiculo: 'SHINERAY STORM 200 EFI 2026',
      chassi: '99HSTF200VS002104',
      unidade: 'Montes Claros (MOC)',
      compra: 18900,
      oficina: 350,
      venda_alvo: 24500,
      status: 'Reservado',
      data_entrada: '2026-10-14',
      obs: 'Sinal recebido via PIX — aguardando emissão de NF.',
    },
    {
      id: 'row-4',
      veiculo: 'SHINERAY NEW JET 125 SS 2026',
      chassi: '99HNJ1125VS008964',
      unidade: 'Montes Claros (MOC)',
      compra: 10600,
      oficina: 220,
      venda_alvo: 14000,
      status: 'Em Preparação',
      data_entrada: '2026-10-18',
      obs: 'Em montagem de bateria e espelhos na oficina.',
    },
  ],
  updated_at: new Date().toISOString(),
};

const STORAGE_KEY = 'dealflow_custom_sheets_v2';

export function CustomSpreadsheetManager() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [sheet, setSheet] = useState<CustomSpreadsheet>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : DEFAULT_SPREADSHEET;
    } catch {
      return DEFAULT_SPREADSHEET;
    }
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [editingCell, setEditingCell] = useState<{ rowId: string; colId: string } | null>(null);
  const [tempValue, setTempValue] = useState<string>('');
  
  // Modal de Adicionar Coluna
  const [colModalOpen, setColModalOpen] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [newColType, setNewColType] = useState<ColumnType>('text');

  const saveSheet = (next: CustomSpreadsheet) => {
    setSheet(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // silent
    }
  };

  // Adicionar Linha
  const handleAddRow = () => {
    const newRow: Record<string, any> = {
      id: `row-${Date.now()}`,
    };
    sheet.columns.forEach((c) => {
      newRow[c.id] = c.type === 'currency' || c.type === 'number' ? 0 : '';
    });
    const next = {
      ...sheet,
      rows: [newRow, ...sheet.rows],
      updated_at: new Date().toISOString(),
    };
    saveSheet(next);
    toast({ title: 'Nova linha adicionada' });
  };

  // Excluir Linha
  const handleDeleteRow = (rowId: string) => {
    const next = {
      ...sheet,
      rows: sheet.rows.filter((r) => r.id !== rowId),
      updated_at: new Date().toISOString(),
    };
    saveSheet(next);
  };

  // Adicionar Coluna Customizada
  const handleAddColumn = () => {
    if (!newColName.trim()) return;
    const colId = `col_${Date.now()}`;
    const newCol: CustomColumn = {
      id: colId,
      name: newColName.trim(),
      type: newColType,
      options: newColType === 'status' ? ['Pendente', 'Em Andamento', 'Concluído'] : undefined,
    };
    const next = {
      ...sheet,
      columns: [...sheet.columns, newCol],
      updated_at: new Date().toISOString(),
    };
    saveSheet(next);
    setColModalOpen(false);
    setNewColName('');
    toast({ title: `Coluna "${newCol.name}" adicionada com sucesso` });
  };

  // Excluir Coluna
  const handleDeleteColumn = async (colId: string) => {
    if (sheet.columns.length <= 1) {
      toast({
        title: 'Ação não permitida',
        description: 'A planilha deve conter pelo menos 1 coluna.',
        variant: 'destructive',
      });
      return;
    }
    const confirmed = await confirm({
      title: 'Excluir Coluna?',
      description: 'Deseja realmente excluir esta coluna da planilha? Os dados contidos nela para todas as linhas serão perdidos.',
      confirmText: 'Excluir Coluna',
      cancelText: 'Cancelar',
      variant: 'destructive',
    });
    if (!confirmed) return;
    const next = {
      ...sheet,
      columns: sheet.columns.filter((c) => c.id !== colId),
      updated_at: new Date().toISOString(),
    };
    saveSheet(next);
  };

  // Salvar Edição de Célula
  const commitEdit = (rowId: string, colId: string, type: ColumnType) => {
    let parsed: any = tempValue;
    if (type === 'currency' || type === 'number') {
      const cleaned = tempValue.replace(/[^\d.,-]/g, '').replace(',', '.');
      parsed = parseFloat(cleaned) || 0;
    }
    const nextRows = sheet.rows.map((r) => {
      if (r.id === rowId) {
        return { ...r, [colId]: parsed };
      }
      return r;
    });
    saveSheet({ ...sheet, rows: nextRows, updated_at: new Date().toISOString() });
    setEditingCell(null);
  };

  // Importar arquivo Excel (.xlsx / .csv) para dentro do Editor Livre
  const handleImportCustomExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });
        if (!json || json.length === 0) {
          toast({
            title: 'Planilha vazia',
            description: 'Não foram encontradas linhas válidas no arquivo selecionado.',
            variant: 'destructive',
          });
          return;
        }
        const keys = Object.keys(json[0]);
        const newCols: CustomColumn[] = keys.map((k, idx) => ({
          id: `col_imp_${idx}`,
          name: k,
          type: typeof json[0][k] === 'number' ? 'number' : 'text',
          width: '150px',
        }));
        const newRows = json.map((item, rIdx) => {
          const rObj: Record<string, any> = { id: `row-imp-${Date.now()}-${rIdx}` };
          keys.forEach((k, idx) => {
            rObj[`col_imp_${idx}`] = item[k];
          });
          return rObj;
        });
        saveSheet({
          id: `sheet-imp-${Date.now()}`,
          title: file.name.replace(/\.(xlsx|xls|csv)$/i, ''),
          description: `Importado de ${file.name}`,
          columns: newCols,
          rows: newRows,
          updated_at: new Date().toISOString(),
        });
        toast({
          title: 'Planilha Excel Carregada no Editor!',
          description: `${newRows.length} linhas e ${newCols.length} colunas prontas para edição livre.`,
        });
      } catch (err: any) {
        toast({
          title: 'Erro ao importar planilha',
          description: err.message,
          variant: 'destructive',
        });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Exportar Planilha para Excel (.xlsx)
  const handleExportExcel = async () => {
    try {
      await exportToXLSX({
        title: sheet.title,
        module: 'vehicles',
        filters: { Planilha: sheet.title },
        columns: sheet.columns.map((c) => ({
          key: c.id,
          label: c.name,
          type: c.type === 'currency' ? 'currency' : c.type === 'date' ? 'date' : 'text',
        })),
        data: sheet.rows,
        userName: 'Administrador',
      });
      toast({ title: 'Planilha exportada com sucesso em formato Excel (.xlsx)' });
    } catch (err: any) {
      toast({
        title: 'Erro ao exportar Excel',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return sheet.rows;
    const q = searchTerm.toLowerCase();
    return sheet.rows.filter((r) => {
      return Object.values(r).some((val) => String(val).toLowerCase().includes(q));
    });
  }, [sheet.rows, searchTerm]);

  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="p-4 sm:p-5 pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                {sheet.title}
                <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary">
                  {sheet.rows.length} registros
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                {sheet.description || 'Planilha totalmente editável do seu jeito com colunas customizáveis.'}
              </CardDescription>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleImportCustomExcel}
                className="hidden"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="text-xs gap-1.5 h-8 bg-card pointer-events-none"
              >
                <Upload className="w-3.5 h-3.5 text-primary" />
                Abrir .XLSX
              </Button>
            </label>

            <Button
              size="sm"
              variant="outline"
              onClick={handleExportExcel}
              className="text-xs gap-1.5 h-8 bg-card"
            >
              <Download className="w-3.5 h-3.5" />
              Baixar Excel
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setColModalOpen(true)}
              className="text-xs gap-1.5 h-8 bg-card"
            >
              <Settings2 className="w-3.5 h-3.5" />
              Nova Coluna
            </Button>

            <Button
              size="sm"
              onClick={handleAddRow}
              className="text-xs gap-1.5 h-8 shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              Nova Linha
            </Button>
          </div>
        </div>

        {/* Barra de Busca de Linhas */}
        <div className="pt-3 max-w-sm">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Pesquisar em todas as colunas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 pl-8 text-xs bg-background"
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 border-t border-border/60">
        <div className="overflow-x-auto max-h-[600px] relative">
          <Table className="border-collapse">
            <TableHeader className="bg-muted/50 sticky top-0 z-10 backdrop-blur">
              <TableRow className="hover:bg-transparent">
                {sheet.columns.map((col) => (
                  <TableHead
                    key={col.id}
                    style={{ minWidth: col.width || '140px' }}
                    className="text-xs font-bold text-foreground py-2.5 group relative"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span>{col.name}</span>
                      <button
                        onClick={() => handleDeleteColumn(col.id)}
                        className="opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity p-0.5 rounded"
                        title="Remover Coluna"
                      >
                        <Trash2 className="w-3 h-3 text-muted-foreground hover:text-red-500" />
                      </button>
                    </div>
                  </TableHead>
                ))}
                <TableHead className="w-12 text-right py-2.5"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={sheet.columns.length + 1} className="text-center py-8 text-xs text-muted-foreground">
                    Nenhum registro encontrado. Clique em "+ Nova Linha" para começar.
                  </TableCell>
                </TableRow>
              ) : (
                filteredRows.map((row) => (
                  <TableRow key={row.id} className="hover:bg-muted/30 transition-colors">
                    {sheet.columns.map((col) => {
                      const isEditing = editingCell?.rowId === row.id && editingCell?.colId === col.id;
                      const val = row[col.id];

                      return (
                        <TableCell
                          key={col.id}
                          className="py-2 text-xs border-r border-border/30 last:border-r-0 cursor-pointer"
                          onClick={() => {
                            if (!isEditing) {
                              setEditingCell({ rowId: row.id, colId: col.id });
                              setTempValue(String(val ?? ''));
                            }
                          }}
                        >
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <Input
                                autoFocus
                                value={tempValue}
                                onChange={(e) => setTempValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') commitEdit(row.id, col.id, col.type);
                                  if (e.key === 'Escape') setEditingCell(null);
                                }}
                                onBlur={() => commitEdit(row.id, col.id, col.type)}
                                className="h-7 text-xs p-1.5 bg-background shadow-xs"
                              />
                            </div>
                          ) : col.type === 'currency' ? (
                            <span className="font-semibold text-foreground">
                              {Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                          ) : col.type === 'status' ? (
                            <Badge
                              variant="outline"
                              className={`text-[10px] font-medium ${
                                val === 'Vendido'
                                  ? 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                                  : val === 'Reservado'
                                  ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                                  : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                              }`}
                            >
                              {val || 'Pátio'}
                            </Badge>
                          ) : (
                            <span className="text-foreground">{val || '—'}</span>
                          )}
                        </TableCell>
                      );
                    })}

                    <TableCell className="text-right py-2 pr-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-red-500"
                        onClick={() => handleDeleteRow(row.id)}
                        title="Excluir Linha"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      {/* Modal para Adicionar Nova Coluna Customizada */}
      <Dialog open={colModalOpen} onOpenChange={setColModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-foreground">Nova Coluna Personalizada</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Defina o nome e o formato dos dados desta coluna.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Nome da Coluna *</Label>
              <Input
                placeholder="Ex: Responsável, Lucro Estimado, Categoria..."
                value={newColName}
                onChange={(e) => setNewColName(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Tipo do Campo *</Label>
              <Select value={newColType} onValueChange={(v: any) => setNewColType(v)}>
                <SelectTrigger className="h-8 text-xs bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Texto Livre</SelectItem>
                  <SelectItem value="currency">Moeda (R$)</SelectItem>
                  <SelectItem value="number">Número Inteiro / Decimal</SelectItem>
                  <SelectItem value="date">Data</SelectItem>
                  <SelectItem value="status">Status / Tag Colorida</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setColModalOpen(false)} className="text-xs">
              Cancelar
            </Button>
            <Button size="sm" onClick={handleAddColumn} disabled={!newColName.trim()} className="text-xs">
              Criar Coluna
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
