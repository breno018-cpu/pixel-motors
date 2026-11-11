import { useState } from 'react';
import { 
  Search, FileText, Plus, Calendar, Eye, Download, 
  Edit, Copy, ToggleLeft, ToggleRight, MoreHorizontal,
  FileCheck, ArrowRightLeft, Car, Bike, FileQuestion,
  Sparkles, TestTube2
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { TemplateEditorDialog } from '@/components/contracts/TemplateEditorDialog';
import { ContractPreviewDialog } from '@/components/contracts/ContractPreviewDialog';
import { 
  useContractTemplates, 
  useUpdateTemplate, 
  useDuplicateTemplate,
  ContractTemplate,
  ContractTemplateType 
} from '@/hooks/useContractTemplates';
import { CalendarClock } from 'lucide-react';
import { generateTemplatePreviewPDF, loadTemplateAssets } from '@/lib/templatePdf';
import { useToast } from '@/hooks/use-toast';
import { PageHeader } from '@/components/layout/PageHeader';
import { useStores } from '@/hooks/useStores';
import { Store, Globe, ImageIcon as ImageIconLucide } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PanelCard, FilterBar } from '@/components/ui/stat-card';

const TYPE_CONFIG: Record<ContractTemplateType, { 
  label: string; 
  icon: React.ElementType; 
  color: string;
  description: string;
}> = {
  venda_carro: { 
    label: 'Venda - Carro', 
    icon: Car, 
    color: 'bg-primary/10 text-primary border-primary/20',
    description: 'Venda direta de veículo ao consumidor final'
  },
  venda_moto: { 
    label: 'Venda - Moto', 
    icon: Bike, 
    color: 'bg-warning/10 text-warning border-warning/20',
    description: 'Venda de motocicleta com cláusula de emplacamento'
  },
  repasse: { 
    label: 'Repasse', 
    icon: ArrowRightLeft, 
    color: 'bg-primary/10 text-primary border-primary/20',
    description: 'Transferência entre lojas ou revendedores'
  },
  generico: { 
    label: 'Genérico', 
    icon: FileQuestion, 
    color: 'bg-muted text-muted-foreground border-muted-foreground/20',
    description: 'Modelo customizável para casos específicos'
  },
  reserva: {
    label: 'Reserva de Veículo',
    icon: CalendarClock,
    color: 'bg-warning/10 text-warning border-warning/20',
    description: 'Contrato gerado quando um cliente paga sinal para reservar um veículo',
  },
};

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('pt-BR');
}

export default function Contracts() {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ContractTemplate | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterStore, setFilterStore] = useState<string>('all');
  
  const { data: stores = [] } = useStores();
  const { data: templates, isLoading } = useContractTemplates();
  const updateTemplate = useUpdateTemplate();
  const duplicateTemplate = useDuplicateTemplate();

  const filteredTemplates = templates?.filter(template => {
    const matchesSearch = 
      template.name.toLowerCase().includes(search.toLowerCase());
    
    const matchesType = filterType === 'all' || template.template_type === filterType;
    const matchesStatus = filterStatus === 'all' || 
      (filterStatus === 'active' && template.is_active) ||
      (filterStatus === 'inactive' && !template.is_active);
    
    const matchesStore = filterStore === 'all' ||
      (filterStore === 'global' ? !template.store_id : template.store_id === filterStore);

    return matchesSearch && matchesType && matchesStatus && matchesStore;
  }) || [];

  const handleEdit = (template: ContractTemplate) => {
    setSelectedTemplate(template);
    setEditorOpen(true);
  };

  const handleNew = () => {
    setSelectedTemplate(null);
    setEditorOpen(true);
  };

  const handlePreview = async (template: ContractTemplate) => {
    try {
      const assets = await loadTemplateAssets(template as any);
      const url = generateTemplatePreviewPDF({
        header: template.header_content || '',
        body: template.body_content,
        clauses: template.clauses_content || '',
        signature: template.signature_content || '',
        fixedClauses: template.fixed_clauses || [],
        optionalClauses: ((template as any).optional_clauses || []) as any,
        ...assets,
      });
      setPreviewUrl(url);
      setPreviewOpen(true);
    } catch (e: any) {
      toast({ title: 'Não foi possível gerar o teste', description: e?.message, variant: 'destructive' });
    }
  };

  const handleToggleActive = async (template: ContractTemplate) => {
    try {
      await updateTemplate.mutateAsync({
        id: template.id,
        is_active: !template.is_active,
      });
    } catch (e: any) {
      toast({ title: 'Erro ao alterar o modelo', description: e?.message, variant: 'destructive' });
    }
  };

  const handleDuplicate = async (template: ContractTemplate) => {
    try {
      await duplicateTemplate.mutateAsync(template);
    } catch (e: any) {
      toast({ title: 'Erro ao duplicar o modelo', description: e?.message, variant: 'destructive' });
    }
  };


  const handleTestWithData = (template: ContractTemplate) => {
    void handlePreview(template);
  };

  const activeCount = templates?.filter(t => t.is_active).length || 0;
  const totalCount = templates?.length || 0;

  return (
    <div className="space-y-5 pb-8">
      {/* Header */}
      <PageHeader
        title="Contratos"
        description="Crie e gerencie modelos para usar na aba Vendas."
        actions={<Button onClick={handleNew}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Modelo
        </Button>}
      />

      {/* Type tiles (clickable filters) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {Object.entries(TYPE_CONFIG).map(([type, config]) => {
          const count = templates?.filter(t => t.template_type === type).length || 0;
          const activeInType = templates?.filter(t => t.template_type === type && t.is_active).length || 0;
          const Icon = config.icon;
          const selected = filterType === type;

          return (
            <button
              key={type}
              type="button"
              onClick={() => setFilterType(selected ? 'all' : type)}
              className={cn(
                'group flex items-center gap-3 rounded-2xl border bg-card p-4 text-left shadow-[0_1px_2px_hsl(var(--foreground)/0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-18px_hsl(var(--foreground)/0.22)]',
                selected ? 'border-primary/40 ring-2 ring-primary/20' : 'border-border/70',
              )}
            >
              <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-4 ring-border/10', config.color.split(' ')[0])}>
                <Icon className={cn('h-4.5 w-4.5', config.color.split(' ')[1])} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{config.label}</span>
                <span className="mt-0.5 flex items-baseline gap-2">
                  <span className="font-display text-lg font-bold tracking-tight text-foreground">{count}</span>
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {activeInType} ativo{activeInType !== 1 ? 's' : ''}
                  </span>
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Info Banner */}
      <Card className="bg-primary/5 border-primary/20 animate-slide-up" style={{ animationDelay: '50ms' }}>
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">
                Como usar os modelos
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Crie modelos aqui com variáveis dinâmicas (ex: {"{{CLIENTE_NOME}}"}). 
                Na aba <strong>Vendas</strong>, selecione o modelo e os dados serão preenchidos automaticamente.
                Apenas modelos <strong>ativos</strong> aparecem para seleção.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <FilterBar>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar modelo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={filterStore} onValueChange={setFilterStore}>
            <SelectTrigger className="w-[210px] h-10 text-xs font-medium">
              <Store className="w-3.5 h-3.5 mr-1.5 text-primary shrink-0" />
              <SelectValue placeholder="Concessionária" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Concessionárias</SelectItem>
              <SelectItem value="global">Modelos Gerais (Sem Loja Fixa)</SelectItem>
              {stores.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant={filterStatus === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setFilterStatus('all')} className="h-10">
            Todos ({totalCount})
          </Button>
          <Button variant={filterStatus === 'active' ? 'default' : 'outline'} size="sm" onClick={() => setFilterStatus('active')} className="h-10">
            Ativos ({activeCount})
          </Button>
          <Button variant={filterStatus === 'inactive' ? 'default' : 'outline'} size="sm" onClick={() => setFilterStatus('inactive')} className="h-10">
            Inativos ({totalCount - activeCount})
          </Button>
        </div>
      </FilterBar>

      {/* Templates Table */}
      {isLoading ? (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : filteredTemplates.length === 0 ? (
        <Card className="animate-fade-in">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <FileText className="w-7 h-7 text-primary" />
            </div>
            <h3 className="text-lg font-display font-semibold text-foreground mb-2">
              {search || filterType !== 'all' || filterStatus !== 'all' 
                ? 'Nenhum modelo encontrado' 
                : 'Nenhum modelo cadastrado'}
            </h3>
            <p className="text-muted-foreground text-sm text-center max-w-sm mb-4">
              {search || filterType !== 'all' || filterStatus !== 'all'
                ? 'Tente ajustar os filtros de busca.'
                : 'Crie seu primeiro modelo de contrato para usar na aba Vendas.'}
            </p>
            {!search && filterType === 'all' && filterStatus === 'all' && (
              <Button onClick={handleNew}>
                <Plus className="w-4 h-4 mr-2" />
                Criar Modelo
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <PanelCard
          title="Modelos de contrato"
          description="Somente modelos ativos aparecem na hora de registrar a venda"
          aside={<span className="text-xs font-medium text-muted-foreground">{filteredTemplates.length} {filteredTemplates.length === 1 ? 'modelo' : 'modelos'}</span>}
        >
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Modelo</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Concessionária</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Tipo</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground hidden lg:table-cell">Versão</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground hidden xl:table-cell whitespace-nowrap">Última edição</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Status</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTemplates.map((template) => {
                const typeConfig = TYPE_CONFIG[template.template_type];
                const Icon = typeConfig.icon;
                
                return (
                  <TableRow key={template.id} className="group">
                    <TableCell className="max-w-[260px]">
                      <div className="flex items-center gap-3">
                        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", typeConfig.color.split(' ')[0])}>
                          <Icon className={cn("w-4 h-4", typeConfig.color.split(' ')[1])} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">{template.name}</p>
                          {template.fixed_clauses && template.fixed_clauses.length > 0 && (
                            <p className="text-xs text-muted-foreground">
                              {template.fixed_clauses.length} cláusula{template.fixed_clauses.length > 1 ? 's' : ''} fixa{template.fixed_clauses.length > 1 ? 's' : ''}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("whitespace-nowrap text-xs", typeConfig.color)}>
                        {typeConfig.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <span className="font-mono text-sm text-muted-foreground">v{template.version}</span>
                    </TableCell>
                    <TableCell className="hidden xl:table-cell">
                      <div className="flex items-center gap-1.5 whitespace-nowrap text-sm text-muted-foreground">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDate(template.updated_at)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "text-xs",
                          template.is_active 
                            ? "bg-success/10 text-success border-success/20" 
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {template.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="w-12 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => void handlePreview(template)}>
                            <Eye className="w-4 h-4 mr-2" />
                            Visualizar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleTestWithData(template)}>
                            <TestTube2 className="w-4 h-4 mr-2" />
                            Testar com Dados
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleEdit(template)}>
                            <Edit className="w-4 h-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicate(template)}>
                            <Copy className="w-4 h-4 mr-2" />
                            Duplicar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleToggleActive(template)}>
                            {template.is_active ? (
                              <>
                                <ToggleLeft className="w-4 h-4 mr-2" />
                                Desativar
                              </>
                            ) : (
                              <>
                                <ToggleRight className="w-4 h-4 mr-2" />
                                Ativar
                              </>
                            )}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </div>
        </PanelCard>
      )}

      {/* Dialogs */}
      <TemplateEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        template={selectedTemplate}
      />
      
      {/* Simple Preview Dialog */}
      {previewOpen && previewUrl && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-4xl max-h-[90vh] flex flex-col">
            <CardHeader className="flex-shrink-0 flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Pré-visualização do Modelo
              </CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setPreviewOpen(false)}>
                ×
              </Button>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 p-0">
              <iframe
                src={previewUrl}
                className="w-full h-[60vh] border-t"
                title="Preview PDF"
              />
            </CardContent>
            <div className="p-4 border-t flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPreviewOpen(false)}>
                Fechar
              </Button>
              <Button onClick={() => {
                const link = document.createElement('a');
                link.href = previewUrl;
                link.download = 'modelo_teste.pdf';
                link.click();
              }}>
                <Download className="w-4 h-4 mr-2" />
                Baixar Teste
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
