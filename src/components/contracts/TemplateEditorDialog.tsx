import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FileText, Save, Eye, Info, X, Plus, Trash2, Upload, Image as ImageIcon } from 'lucide-react';
import { Download } from 'lucide-react';
import { ImportLegacyClausesDialog } from './ImportLegacyClausesDialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCreateTemplate, useUpdateTemplate, ContractTemplate, ContractTemplateType, OptionalClause } from '@/hooks/useContractTemplates';
import { generateTemplatePreviewPDF, fetchImageAsDataUrl } from '@/lib/templatePdf';
import { RichTextToolbar } from './RichTextToolbar';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

const templateSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  template_type: z.enum(['venda_carro', 'venda_moto', 'repasse', 'generico', 'reserva']),
  is_active: z.boolean(),
  header_content: z.string().optional(),
  body_content: z.string().min(1, 'Corpo do contrato é obrigatório'),
  clauses_content: z.string().optional(),
  signature_content: z.string().optional(),
});

type TemplateFormData = z.infer<typeof templateSchema>;

interface TemplateEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: ContractTemplate | null;
}

const TEMPLATE_VARIABLES = [
  { category: 'Cliente', variables: ['{{CLIENTE_NOME}}', '{{CLIENTE_CPF}}', '{{CLIENTE_ENDERECO}}', '{{CLIENTE_TELEFONE}}', '{{CLIENTE_EMAIL}}'] },
  { category: 'Veículo', variables: ['{{VEICULO_MARCA}}', '{{VEICULO_MODELO}}', '{{VEICULO_ANO}}', '{{VEICULO_COR}}', '{{VEICULO_CHASSI}}', '{{VEICULO_PLACA}}', '{{VEICULO_RENAVAM}}', '{{GARANTIA_MESES}}', '{{REVISAO_MESES}}', '{{REVISAO_KM}}'] },
  { category: 'Revendedor', variables: ['{{REVENDEDOR_NOME}}', '{{REVENDEDOR_CPF}}', '{{REVENDEDOR_EMAIL}}', '{{REVENDEDOR_TELEFONE}}', '{{REVENDEDOR_COMISSAO}}'] },
  { category: 'Loja', variables: ['{{LOJA_RAZAO_SOCIAL}}', '{{LOJA_CNPJ}}', '{{LOJA_ENDERECO}}', '{{LOJA_CIDADE}}', '{{LOJA_TELEFONE}}', '{{LOJA_EMAIL}}'] },
  { category: 'Financeiro', variables: ['{{VALOR_TOTAL}}', '{{VALOR_ENTRADA}}', '{{FORMA_PAGAMENTO}}', '{{PARCELAS}}', '{{VALOR_PARCELA}}'] },
  { category: 'Contrato', variables: ['{{NUMERO_CONTRATO}}', '{{DATA_CONTRATO}}'] },
];

const TYPE_LABELS: Record<ContractTemplateType, string> = {
  venda_carro: 'Venda - Carro',
  venda_moto: 'Venda - Moto',
  repasse: 'Repasse',
  generico: 'Genérico',
  reserva: 'Reserva de Veículo',
};

// Rich editor field component
function RichEditorField({
  label,
  value,
  onChange,
  placeholder,
  minHeight = '200px',
  description,
  activeTab,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  minHeight?: string;
  description?: string;
  activeTab: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <RichTextToolbar
        textareaRef={textareaRef}
        value={value}
        onChange={onChange}
      />
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="font-mono text-sm"
        style={{ minHeight }}
      />
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  );
}

export function TemplateEditorDialog({ open, onOpenChange, template }: TemplateEditorDialogProps) {
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [fixedClauses, setFixedClauses] = useState<string[]>([]);
  const [newClause, setNewClause] = useState('');
  const [optionalClauses, setOptionalClauses] = useState<OptionalClause[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<Array<'carro' | 'moto'>>(['carro', 'moto']);
  const [activeTab, setActiveTab] = useState('metadata');
  const [branding, setBranding] = useState<{
    logo_url: string | null;
    watermark_url: string | null;
    signature_url: string | null;
    watermark_opacity: number;
  }>({ logo_url: null, watermark_url: null, signature_url: null, watermark_opacity: 0.1 });
  const [uploading, setUploading] = useState<string | null>(null);
  const [importLegacyOpen, setImportLegacyOpen] = useState(false);
  const { toast } = useToast();
  
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();
  const isEditing = !!template;

  const form = useForm<TemplateFormData>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      name: '',
      template_type: 'venda_carro',
      is_active: false,
      header_content: '',
      body_content: '',
      clauses_content: '',
      signature_content: '',
    },
  });

  useEffect(() => {
    if (template) {
      form.reset({
        name: template.name,
        template_type: template.template_type,
        is_active: template.is_active,
        header_content: template.header_content || '',
        body_content: template.body_content,
        clauses_content: template.clauses_content || '',
        signature_content: template.signature_content || '',
      });
      setFixedClauses(template.fixed_clauses || []);
      setOptionalClauses(template.optional_clauses || []);
      setVehicleTypes((template.vehicle_types && template.vehicle_types.length > 0)
        ? template.vehicle_types
        : ['carro', 'moto']);
      setBranding({
        logo_url: template.logo_url || null,
        watermark_url: template.watermark_url || null,
        signature_url: template.signature_url || null,
        watermark_opacity: Number(template.watermark_opacity ?? 0.1),
      });
    } else {
      form.reset({
        name: '',
        template_type: 'generico',
        is_active: false,
        header_content: '[center][b][size:18]CONTRATO DE COMPRA E VENDA DE VEÍCULO[/size][/b][/center]',
        body_content: '',
        clauses_content: '',
        signature_content: '[center]________________________________________          ________________________________________\n[b]VENDEDOR[/b]                                                          [b]COMPRADOR[/b]\n{{LOJA_RAZAO_SOCIAL}}                                        {{CLIENTE_NOME}}[/center]',
      });
      setFixedClauses([]);
      setOptionalClauses([]);
      setVehicleTypes(['carro', 'moto']);
      setBranding({ logo_url: null, watermark_url: null, signature_url: null, watermark_opacity: 0.1 });
    }
  }, [template, form]);

  const handlePreview = async () => {
    const values = form.getValues();
    const [logo, watermark, signature] = await Promise.all([
      fetchImageAsDataUrl(branding.logo_url),
      fetchImageAsDataUrl(branding.watermark_url),
      fetchImageAsDataUrl(branding.signature_url),
    ]);
    const pdfUrl = generateTemplatePreviewPDF({
      logo_data_url: logo,
      watermark_data_url: watermark,
      signature_data_url: signature,
      watermark_opacity: branding.watermark_opacity,
      header: values.header_content || '',
      body: values.body_content,
      clauses: values.clauses_content || '',
      signature: values.signature_content || '',
      fixedClauses,
      optionalClauses,
      activeClauseIds: optionalClauses.filter((c) => c.enabled_by_default).map((c) => c.id),
    });
    setPreviewUrl(pdfUrl);
  };

  const handleAddFixedClause = () => {
    if (newClause.trim()) {
      setFixedClauses([...fixedClauses, newClause.trim()]);
      setNewClause('');
    }
  };

  const handleRemoveFixedClause = (index: number) => {
    setFixedClauses(fixedClauses.filter((_, i) => i !== index));
  };

  const onSubmit = async (data: TemplateFormData) => {
    try {
      if (isEditing && template) {
        await updateTemplate.mutateAsync({
          id: template.id,
          ...data,
          fixed_clauses: fixedClauses,
          optional_clauses: optionalClauses,
          vehicle_types: vehicleTypes,
          version: template.version,
          ...branding,
        });
      } else {
        await createTemplate.mutateAsync({
          name: data.name,
          template_type: data.template_type,
          is_active: data.is_active,
          header_content: data.header_content,
          body_content: data.body_content,
          clauses_content: data.clauses_content,
          signature_content: data.signature_content,
          fixed_clauses: fixedClauses,
          optional_clauses: optionalClauses,
          vehicle_types: vehicleTypes,
          ...branding,
        });
      }
      onOpenChange(false);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const addOptionalClause = () => {
    setOptionalClauses((prev) => [
      ...prev,
      {
        id: `clause_${Date.now().toString(36)}`,
        label: 'Nova cláusula',
        body_bbcode: '',
        enabled_by_default: false,
        vehicle_types: ['carro', 'moto'],
      },
    ]);
  };

  const updateOptionalClause = (id: string, patch: Partial<OptionalClause>) => {
    setOptionalClauses((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  const removeOptionalClause = (id: string) => {
    setOptionalClauses((prev) => prev.filter((c) => c.id !== id));
  };

  const toggleClauseVehicleType = (id: string, type: 'carro' | 'moto') => {
    setOptionalClauses((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const has = c.vehicle_types.includes(type);
        const next = has ? c.vehicle_types.filter((t) => t !== type) : [...c.vehicle_types, type];
        return { ...c, vehicle_types: next.length ? next : [type] };
      }),
    );
  };

  const handleAssetUpload = async (kind: 'logo' | 'watermark' | 'signature', file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({ variant: 'destructive', title: 'Selecione um arquivo de imagem.' });
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'Imagem muito grande', description: 'Máximo 4 MB.' });
      return;
    }
    setUploading(kind);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const path = `${kind}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('contract-assets').upload(path, file, { upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from('contract-assets').getPublicUrl(path);
      setBranding((b) => ({ ...b, [`${kind}_url`]: data.publicUrl } as any));
      toast({ title: 'Imagem enviada' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao enviar', description: e?.message });
    } finally {
      setUploading(null);
    }
  };

  const insertVariable = (variable: string, fieldName: 'body_content' | 'header_content' | 'clauses_content' | 'signature_content') => {
    const currentValue = form.getValues(fieldName) || '';
    form.setValue(fieldName, currentValue + variable);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2 text-lg font-display">
            <FileText className="w-5 h-5 text-primary" />
            {isEditing ? 'Editar Modelo de Contrato' : 'Novo Modelo de Contrato'}
            {template && (
              <Badge variant="outline" className="ml-2">v{template.version}</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 flex min-h-0">
              {/* Left Panel - Editor */}
              <div className="flex-1 flex flex-col min-h-0 border-r">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
                  <TabsList className="mx-6 mt-4 justify-start">
                    <TabsTrigger value="metadata">Metadados</TabsTrigger>
                    <TabsTrigger value="content">Conteúdo</TabsTrigger>
                    <TabsTrigger value="clauses">Cláusulas</TabsTrigger>
                    <TabsTrigger value="optional">Opcionais</TabsTrigger>
                    <TabsTrigger value="signature">Assinatura</TabsTrigger>
                    <TabsTrigger value="branding">Personalização</TabsTrigger>
                  </TabsList>

                  <ScrollArea className="flex-1 px-6 py-4">
                    <TabsContent value="metadata" className="mt-0 space-y-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nome do Modelo</FormLabel>
                            <FormControl>
                              <Input placeholder="Ex: Contrato de Venda - Carro Padrão" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="template_type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tipo de Contrato</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione o tipo" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="venda_carro">Venda - Carro</SelectItem>
                                <SelectItem value="venda_moto">Venda - Moto</SelectItem>
                                <SelectItem value="repasse">Repasse</SelectItem>
                                <SelectItem value="generico">Genérico</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="is_active"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Ativo</FormLabel>
                              <FormDescription>
                                Modelos ativos ficam disponíveis para uso na aba Vendas
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <div className="space-y-2 rounded-lg border p-4">
                        <Label className="text-base">Aplica-se a</Label>
                        <p className="text-xs text-muted-foreground">
                          Selecione para quais tipos de veículo este modelo pode ser usado no fechamento da venda.
                        </p>
                        <div className="flex items-center gap-4 pt-1">
                          {(['carro', 'moto'] as const).map((t) => (
                            <label key={t} className="flex items-center gap-2 cursor-pointer text-sm">
                              <Checkbox
                                checked={vehicleTypes.includes(t)}
                                onCheckedChange={(v) => {
                                  setVehicleTypes((prev) => {
                                    const has = prev.includes(t);
                                    const next = v ? (has ? prev : [...prev, t]) : prev.filter((x) => x !== t);
                                    return next.length ? next : [t];
                                  });
                                }}
                              />
                              <span className="capitalize">{t}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <Label>Cláusulas Fixas (Não editáveis na venda)</Label>
                        <div className="flex gap-2">
                          <Input
                            value={newClause}
                            onChange={(e) => setNewClause(e.target.value)}
                            placeholder="Ex: O emplacamento é de responsabilidade do cliente"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddFixedClause();
                              }
                            }}
                          />
                          <Button type="button" variant="outline" onClick={handleAddFixedClause}>
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                        {fixedClauses.length > 0 && (
                          <div className="space-y-2">
                            {fixedClauses.map((clause, index) => (
                              <div key={index} className="flex items-start gap-2 p-2 bg-muted rounded-lg">
                                <span className="flex-1 text-sm">{clause}</span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 shrink-0"
                                  onClick={() => handleRemoveFixedClause(index)}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Formatting Guide */}
                      <Card className="bg-primary/5 border-primary/20">
                        <CardHeader className="py-3 px-4">
                          <CardTitle className="text-xs font-medium flex items-center gap-1.5">
                            <Info className="w-3.5 h-3.5" />
                            Guia de Formatação
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-3 pt-0">
                          <div className="space-y-1 text-xs text-muted-foreground font-mono">
                            <p><span className="text-foreground">[b]texto[/b]</span> → <strong>negrito</strong></p>
                            <p><span className="text-foreground">[i]texto[/i]</span> → <em>itálico</em></p>
                            <p><span className="text-foreground">[u]texto[/u]</span> → <u>sublinhado</u></p>
                            <p><span className="text-foreground">[size:14]texto[/size]</span> → tamanho 14pt</p>
                            <p><span className="text-foreground">[color:#FF0000]texto[/color]</span> → <span style={{color:'#FF0000'}}>cor</span></p>
                            <p><span className="text-foreground">[center]texto[/center]</span> → centralizado</p>
                            <p><span className="text-foreground">[right]texto[/right]</span> → à direita</p>
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="content" className="mt-0 space-y-4">
                      <FormField
                        control={form.control}
                        name="header_content"
                        render={({ field }) => (
                          <RichEditorField
                            label="Cabeçalho"
                            value={field.value || ''}
                            onChange={field.onChange}
                            placeholder="[center][b][size:18]CONTRATO DE COMPRA E VENDA[/size][/b][/center]"
                            minHeight="100px"
                            activeTab={activeTab}
                          />
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="body_content"
                        render={({ field }) => (
                          <RichEditorField
                            label="Corpo do Contrato"
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Texto principal do contrato com variáveis e formatação..."
                            minHeight="350px"
                            description="Use as variáveis do painel à direita e a barra de ferramentas para formatar."
                            activeTab={activeTab}
                          />
                        )}
                      />
                    </TabsContent>

                    <TabsContent value="clauses" className="mt-0 space-y-4">
                      <FormField
                        control={form.control}
                        name="clauses_content"
                        render={({ field }) => (
                          <RichEditorField
                            label="Cláusulas e Condições"
                            value={field.value || ''}
                            onChange={field.onChange}
                            placeholder="[b]CLÁUSULA PRIMEIRA[/b] - Da transferência..."
                            minHeight="400px"
                            activeTab={activeTab}
                          />
                        )}
                      />
                    </TabsContent>

                    <TabsContent value="optional" className="mt-0 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-sm font-medium">Cláusulas Opcionais</Label>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Cláusulas que o vendedor liga/desliga no fechamento da venda (ex.: emplacamento, garantia, revisões).
                            Suportam BBCode e variáveis como <span className="font-mono">{'{{GARANTIA_MESES}}'}</span>.
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button type="button" variant="outline" size="sm" onClick={() => setImportLegacyOpen(true)}>
                            <Download className="w-4 h-4 mr-1" /> Importar antigas
                          </Button>
                          <Button type="button" variant="outline" size="sm" onClick={addOptionalClause}>
                            <Plus className="w-4 h-4 mr-1" /> Nova
                          </Button>
                        </div>
                      </div>

                      {optionalClauses.length === 0 && (
                        <div className="border border-dashed rounded-lg p-6 text-center text-sm text-muted-foreground">
                          Nenhuma cláusula opcional. Clique em "Nova" para adicionar.
                        </div>
                      )}

                      <div className="space-y-3">
                        {optionalClauses.map((clause, idx) => (
                          <div key={clause.id} className="border rounded-lg p-3 space-y-2 bg-muted/20">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono text-muted-foreground w-6">#{idx + 1}</span>
                              <Input
                                value={clause.label}
                                onChange={(e) => updateOptionalClause(clause.id, { label: e.target.value })}
                                placeholder="Título da cláusula"
                                className="h-9 flex-1"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={() => removeOptionalClause(clause.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                            <Textarea
                              value={clause.body_bbcode}
                              onChange={(e) => updateOptionalClause(clause.id, { body_bbcode: e.target.value })}
                              placeholder="Texto da cláusula. Aceita BBCode ([b], [i], [u]) e variáveis {{...}}."
                              className="font-mono text-xs min-h-[80px]"
                            />
                            <div className="flex flex-wrap items-center gap-4 pt-1">
                              <label className="flex items-center gap-2 text-xs cursor-pointer">
                                <Switch
                                  checked={clause.enabled_by_default}
                                  onCheckedChange={(v) => updateOptionalClause(clause.id, { enabled_by_default: !!v })}
                                />
                                Marcada por padrão
                              </label>
                              <div className="flex items-center gap-2 text-xs">
                                <span className="text-muted-foreground">Categoria:</span>
                                <Input
                                  value={clause.category || ''}
                                  onChange={(e) => updateOptionalClause(clause.id, { category: e.target.value })}
                                  placeholder="Ex.: Garantia"
                                  className="h-7 text-xs w-32"
                                />
                              </div>
                              <div className="flex items-center gap-2 text-xs">
                                <span className="text-muted-foreground">Aplica a:</span>
                                {(['carro', 'moto'] as const).map((t) => (
                                  <button
                                    key={t}
                                    type="button"
                                    onClick={() => toggleClauseVehicleType(clause.id, t)}
                                    className={cn(
                                      'px-2 py-0.5 rounded border text-xs capitalize transition-colors',
                                      clause.vehicle_types.includes(t)
                                        ? 'bg-primary/10 border-primary/30 text-primary'
                                        : 'bg-muted border-border text-muted-foreground',
                                    )}
                                  >
                                    {t}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </TabsContent>

                    <TabsContent value="signature" className="mt-0 space-y-4">
                      <FormField
                        control={form.control}
                        name="signature_content"
                        render={({ field }) => (
                          <RichEditorField
                            label="Área de Assinaturas"
                            value={field.value || ''}
                            onChange={field.onChange}
                            placeholder="[center]_______________________________\nVENDEDOR\n{{LOJA_RAZAO_SOCIAL}}[/center]"
                            minHeight="200px"
                            activeTab={activeTab}
                          />
                        )}
                      />
                    </TabsContent>

                    <TabsContent value="branding" className="mt-0 space-y-5">
                      {(['logo', 'watermark', 'signature'] as const).map((kind) => {
                        const url = branding[`${kind}_url` as 'logo_url' | 'watermark_url' | 'signature_url'];
                        const labels = {
                          logo: { title: 'Logo do Contrato', desc: 'Aparece no topo de cada PDF gerado.' },
                          watermark: { title: 'Marca d\'Água', desc: 'Imagem semi-transparente no centro de cada página.' },
                          signature: { title: 'Assinatura Digitalizada', desc: 'Imagem da assinatura do responsável (rodapé da última página).' },
                        };
                        return (
                          <div key={kind} className="space-y-2 border rounded-lg p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <Label className="text-sm font-medium">{labels[kind].title}</Label>
                                <p className="text-xs text-muted-foreground mt-0.5">{labels[kind].desc}</p>
                              </div>
                              {url && (
                                <Button
                                  type="button" variant="ghost" size="sm"
                                  onClick={() => setBranding((b) => ({ ...b, [`${kind}_url`]: null } as any))}
                                >
                                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Remover
                                </Button>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              {url ? (
                                <img src={url} alt={kind} className="h-16 w-24 object-contain border rounded bg-white" />
                              ) : (
                                <div className="h-16 w-24 border rounded flex items-center justify-center bg-muted/40">
                                  <ImageIcon className="w-5 h-5 text-muted-foreground" />
                                </div>
                              )}
                              <label className="cursor-pointer">
                                <input
                                  type="file" accept="image/png,image/jpeg,image/webp"
                                  className="hidden"
                                  disabled={uploading === kind}
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) handleAssetUpload(kind, f);
                                    e.target.value = '';
                                  }}
                                />
                                <span className="inline-flex items-center gap-2 text-sm border rounded-md px-3 py-1.5 hover:bg-accent">
                                  <Upload className="w-3.5 h-3.5" />
                                  {uploading === kind ? 'Enviando...' : (url ? 'Substituir' : 'Enviar imagem')}
                                </span>
                              </label>
                            </div>
                            {kind === 'watermark' && url && (
                              <div className="space-y-1.5 pt-2">
                                <div className="flex justify-between">
                                  <Label className="text-xs">Opacidade</Label>
                                  <span className="text-xs text-muted-foreground">{Math.round(branding.watermark_opacity * 100)}%</span>
                                </div>
                                <Slider
                                  min={5} max={50} step={1}
                                  value={[Math.round(branding.watermark_opacity * 100)]}
                                  onValueChange={(v) => setBranding((b) => ({ ...b, watermark_opacity: v[0] / 100 }))}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                      <p className="text-xs text-muted-foreground">
                        Recomendado: PNG com fundo transparente. Máx. 4 MB.
                      </p>
                    </TabsContent>
                  </ScrollArea>
                </Tabs>
              </div>

              {/* Right Panel - Variables & Preview */}
              <div className="w-80 flex flex-col min-h-0 bg-muted/30">
                <div className="p-4 border-b">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <Info className="w-4 h-4" />
                    Variáveis Disponíveis
                  </h3>
                </div>
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4">
                    {TEMPLATE_VARIABLES.map((group) => (
                      <Card key={group.category} className="bg-background">
                        <CardHeader className="py-2 px-3">
                          <CardTitle className="text-xs font-medium text-muted-foreground">
                            {group.category}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="px-3 pb-3 pt-0">
                          <div className="flex flex-wrap gap-1">
                            {group.variables.map((variable) => (
                              <TooltipProvider key={variable}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge
                                      variant="secondary"
                                      className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors text-xs font-mono"
                                      onClick={() => insertVariable(variable, 'body_content')}
                                    >
                                      {variable.replace(/{{|}}/g, '')}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Clique para inserir no corpo</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>

                {/* Preview Section */}
                {previewUrl && (
                  <div className="border-t p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-sm">Pré-visualização</h3>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setPreviewUrl('')}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    <iframe
                      src={previewUrl}
                      className="w-full h-48 rounded border bg-white"
                      title="Preview"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-2 px-6 py-4 border-t bg-muted/30">
              <Button type="button" variant="outline" onClick={handlePreview}>
                <Eye className="w-4 h-4 mr-2" />
                Pré-visualizar
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={createTemplate.isPending || updateTemplate.isPending}
                >
                  <Save className="w-4 h-4 mr-2" />
                  {isEditing ? 'Salvar Alterações' : 'Criar Modelo'}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
      <ImportLegacyClausesDialog
        open={importLegacyOpen}
        onOpenChange={setImportLegacyOpen}
        onImport={(imported) => setOptionalClauses((prev) => [...prev, ...imported])}
      />
    </Dialog>
  );
}
