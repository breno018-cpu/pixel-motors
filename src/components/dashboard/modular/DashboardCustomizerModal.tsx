import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  WIDGET_DEFINITIONS,
  DASHBOARD_PRESETS,
} from './widgetRegistry';
import {
  DashboardBlockConfig,
  WidgetColSpan,
} from './types';
import {
  SlidersHorizontal,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Sparkles,
  Check,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  LayoutGrid,
} from 'lucide-react';

interface DashboardCustomizerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blocks: DashboardBlockConfig[];
  onSaveBlocks: (newBlocks: DashboardBlockConfig[]) => void;
  onResetToDefault: () => void;
}

export function DashboardCustomizerModal({
  open,
  onOpenChange,
  blocks,
  onSaveBlocks,
  onResetToDefault,
}: DashboardCustomizerModalProps) {
  const [draftBlocks, setDraftBlocks] = useState<DashboardBlockConfig[]>(blocks);
  const [selectedPreset, setSelectedPreset] = useState<string>('custom');

  // Sincroniza sempre que abrir
  React.useEffect(() => {
    if (open) {
      setDraftBlocks(blocks);
    }
  }, [open, blocks]);

  const handleApplyPreset = (presetId: string) => {
    const preset = DASHBOARD_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      setDraftBlocks(JSON.parse(JSON.stringify(preset.blocks)));
      setSelectedPreset(presetId);
    }
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= draftBlocks.length) return;

    const updated = [...draftBlocks];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    // Atualiza campo order
    updated.forEach((b, idx) => {
      b.order = idx + 1;
    });

    setDraftBlocks(updated);
    setSelectedPreset('custom');
  };

  const handleChangeWidget = (index: number, newWidgetId: string) => {
    const widgetDef = WIDGET_DEFINITIONS.find((w) => w.id === newWidgetId);
    const updated = [...draftBlocks];
    updated[index] = {
      ...updated[index],
      widgetId: newWidgetId,
      colSpan: widgetDef?.defaultColSpan || 'half',
    };
    setDraftBlocks(updated);
    setSelectedPreset('custom');
  };

  const handleChangeColSpan = (index: number, newColSpan: WidgetColSpan) => {
    const updated = [...draftBlocks];
    updated[index] = {
      ...updated[index],
      colSpan: newColSpan,
    };
    setDraftBlocks(updated);
    setSelectedPreset('custom');
  };

  const handleToggleVisible = (index: number) => {
    const updated = [...draftBlocks];
    updated[index] = {
      ...updated[index],
      visible: !updated[index].visible,
    };
    setDraftBlocks(updated);
    setSelectedPreset('custom');
  };

  const handleRemoveBlock = (index: number) => {
    const updated = draftBlocks.filter((_, idx) => idx !== index);
    updated.forEach((b, idx) => {
      b.order = idx + 1;
    });
    setDraftBlocks(updated);
    setSelectedPreset('custom');
  };

  const handleAddBlock = () => {
    const newId = `block-${Date.now()}`;
    const newBlock: DashboardBlockConfig = {
      id: newId,
      widgetId: 'logistics_deliveries',
      colSpan: 'half',
      visible: true,
      order: draftBlocks.length + 1,
    };
    setDraftBlocks([...draftBlocks, newBlock]);
    setSelectedPreset('custom');
  };

  const handleSave = () => {
    onSaveBlocks(draftBlocks);
    onOpenChange(false);
  };

  const handleReset = () => {
    onResetToDefault();
    setSelectedPreset('executivo_padrao');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-3xl">
        <DialogHeader className="p-6 pb-4 border-b bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                Personalizar Dashboard Modular
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Escolha o que exibir em cada área específica, ajuste a largura e ordene os módulos como preferir.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Seletor de Presets Prontos */}
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              Presets Pré-configurados
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {DASHBOARD_PRESETS.map((p) => (
                <div
                  key={p.id}
                  onClick={() => handleApplyPreset(p.id)}
                  className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                    selectedPreset === p.id
                      ? 'border-primary bg-primary/5 shadow-xs'
                      : 'border-border/60 hover:border-primary/40 bg-card'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">{p.name}</span>
                    {selectedPreset === p.id && (
                      <Check className="w-4 h-4 text-primary" />
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                    {p.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Lista de Blocos / Áreas do Dashboard */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <LayoutGrid className="w-3.5 h-3.5 text-primary" />
                Áreas e Módulos do seu Dashboard ({draftBlocks.length})
              </Label>
              <Button
                size="sm"
                variant="outline"
                onClick={handleAddBlock}
                className="h-8 text-xs font-bold gap-1 border-primary/30 text-primary hover:bg-primary/10 rounded-xl"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar Área
              </Button>
            </div>

            <div className="space-y-2.5">
              {draftBlocks.map((block, idx) => {
                const widgetDef = WIDGET_DEFINITIONS.find((w) => w.id === block.widgetId);

                return (
                  <div
                    key={block.id || idx}
                    className={`p-3.5 rounded-2xl border transition-all ${
                      block.visible
                        ? 'bg-card border-border/80 shadow-2xs'
                        : 'bg-muted/30 border-dashed border-border/60 opacity-60'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      {/* Posição e Seletor do Widget */}
                      <div className="flex items-center gap-2.5 flex-1 min-w-[240px]">
                        <span className="w-6 h-6 rounded-lg bg-muted text-muted-foreground font-mono text-[11px] font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>

                        <div className="flex-1">
                          <Select
                            value={block.widgetId}
                            onValueChange={(val) => handleChangeWidget(idx, val)}
                          >
                            <SelectTrigger className="h-9 text-xs font-semibold rounded-xl">
                              <SelectValue placeholder="Selecione o módulo" />
                            </SelectTrigger>
                            <SelectContent>
                              {WIDGET_DEFINITIONS.map((w) => (
                                <SelectItem key={w.id} value={w.id}>
                                  <div className="flex items-center gap-2">
                                    <span>{w.title}</span>
                                    {w.badge && (
                                      <Badge variant="secondary" className="text-[9px] py-0 px-1.5 h-4">
                                        {w.badge}
                                      </Badge>
                                    )}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Seletor de Largura da Área */}
                      <div className="flex items-center gap-2 shrink-0">
                        <Select
                          value={block.colSpan}
                          onValueChange={(val: WidgetColSpan) => handleChangeColSpan(idx, val)}
                        >
                          <SelectTrigger className="w-[125px] h-9 text-xs rounded-xl font-semibold">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="full">Largura Total (100%)</SelectItem>
                            <SelectItem value="two-thirds">2/3 (66%)</SelectItem>
                            <SelectItem value="half">Metade (50%)</SelectItem>
                            <SelectItem value="third">1/3 (33%)</SelectItem>
                          </SelectContent>
                        </Select>

                        {/* Visibilidade */}
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleToggleVisible(idx)}
                          className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground"
                          title={block.visible ? 'Ocultar módulo' : 'Exibir módulo'}
                        >
                          {block.visible ? (
                            <Eye className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <EyeOff className="w-4 h-4 text-muted-foreground" />
                          )}
                        </Button>

                        {/* Mover para Cima */}
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={idx === 0}
                          onClick={() => handleMove(idx, 'up')}
                          className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground"
                          title="Mover para cima"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </Button>

                        {/* Mover para Baixo */}
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={idx === draftBlocks.length - 1}
                          onClick={() => handleMove(idx, 'down')}
                          className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground"
                          title="Mover para baixo"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </Button>

                        {/* Excluir Área */}
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={draftBlocks.length <= 1}
                          onClick={() => handleRemoveBlock(idx)}
                          className="h-9 w-9 rounded-xl text-destructive hover:bg-destructive/10"
                          title="Remover área"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {widgetDef && (
                      <p className="text-[11px] text-muted-foreground mt-2 pl-9 leading-snug">
                        {widgetDef.description}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter className="p-4 px-6 border-t bg-muted/20 flex flex-wrap items-center justify-between gap-3 sm:justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="text-xs font-bold gap-1 text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restaurar Layout Padrão
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs font-semibold rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              className="text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm rounded-xl px-4"
            >
              Salvar Layout do Dashboard
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
