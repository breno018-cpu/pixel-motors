import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import type { OptionalClause } from '@/hooks/useContractTemplates';
import { Download, FileText, Loader2 } from 'lucide-react';

interface LegacyClauseCandidate {
  id: string;
  origin_template_id: string;
  origin_template_name: string;
  origin_template_type: string;
  label: string;
  body_bbcode: string;
  source: 'fixed' | 'clauses';
}

function extractLabelAndBody(block: string): { label: string; body: string } {
  const stripped = block.replace(/\[[^\]]+\]/g, '').trim();
  const firstLine = stripped.split('\n')[0].slice(0, 90).trim();
  return { label: firstLine || 'Cláusula sem título', body: block.trim() };
}

function vehicleTypesForTemplateType(t: string): Array<'carro' | 'moto'> {
  if (t === 'venda_carro') return ['carro'];
  if (t === 'venda_moto') return ['moto'];
  return ['carro', 'moto'];
}

export function ImportLegacyClausesDialog({
  open,
  onOpenChange,
  onImport,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onImport: (clauses: OptionalClause[]) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState<LegacyClauseCandidate[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('contract_templates')
          .select('id, name, template_type, clauses_content, fixed_clauses, is_active');
        if (error) throw error;
        const list: LegacyClauseCandidate[] = [];
        for (const t of (data || [])) {
          // Skip active master
          if (t.is_active && t.template_type === 'generico') continue;
          (t.fixed_clauses || []).forEach((fc: string, i: number) => {
            if (!fc?.trim()) return;
            const { label, body } = extractLabelAndBody(fc);
            list.push({
              id: `${t.id}:fixed:${i}`,
              origin_template_id: t.id,
              origin_template_name: t.name,
              origin_template_type: t.template_type,
              label,
              body_bbcode: body,
              source: 'fixed',
            });
          });
          const content = (t.clauses_content || '').trim();
          if (content) {
            const blocks = content.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
            blocks.forEach((b, i) => {
              const { label, body } = extractLabelAndBody(b);
              list.push({
                id: `${t.id}:clauses:${i}`,
                origin_template_id: t.id,
                origin_template_name: t.name,
                origin_template_type: t.template_type,
                label,
                body_bbcode: body,
                source: 'clauses',
              });
            });
          }
        }
        setCandidates(list);
        setSelected(new Set());
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  const grouped = useMemo(() => {
    const g: Record<string, LegacyClauseCandidate[]> = {};
    for (const c of candidates) {
      const key = `${c.origin_template_name} (${c.origin_template_type})`;
      (g[key] = g[key] || []).push(c);
    }
    return g;
  }, [candidates]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const doImport = () => {
    const chosen = candidates.filter((c) => selected.has(c.id));
    const now = Date.now().toString(36);
    const clauses: OptionalClause[] = chosen.map((c, i) => ({
      id: `clause_${now}_${i}`,
      label: c.label,
      body_bbcode: c.body_bbcode,
      enabled_by_default: false,
      vehicle_types: vehicleTypesForTemplateType(c.origin_template_type),
      category: 'Outros',
    }));
    onImport(clauses);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5 text-primary" />
            Importar cláusulas de modelos antigos
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 flex flex-col">
          <p className="text-xs text-muted-foreground mb-3">
            Selecione as cláusulas que devem ser adicionadas ao Contrato Mestre como cláusulas opcionais.
            O tipo de veículo é herdado do modelo de origem.
          </p>

          {loading ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Carregando…
            </div>
          ) : candidates.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Nenhuma cláusula encontrada nos modelos antigos.
            </div>
          ) : (
            <ScrollArea className="flex-1 pr-3">
              <div className="space-y-4">
                {Object.entries(grouped).map(([group, list]) => (
                  <div key={group}>
                    <div className="flex items-center gap-2 mb-2 sticky top-0 bg-background py-1">
                      <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        {group}
                      </p>
                    </div>
                    <div className="space-y-2">
                      {list.map((c) => {
                        const checked = selected.has(c.id);
                        return (
                          <label
                            key={c.id}
                            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${checked ? 'border-primary/40 bg-primary/5' : 'hover:bg-muted/40'}`}
                          >
                            <Checkbox checked={checked} onCheckedChange={() => toggle(c.id)} className="mt-1" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium truncate">{c.label}</p>
                                <Badge variant="outline" className="text-[10px] py-0 h-4">
                                  {c.source === 'fixed' ? 'Fixa' : 'Cláusula'}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-3 whitespace-pre-wrap">
                                {c.body_bbcode.replace(/\[[^\]]+\]/g, '').slice(0, 260)}
                                {c.body_bbcode.length > 260 ? '…' : ''}
                              </p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        <div className="flex items-center justify-between pt-3 border-t">
          <p className="text-xs text-muted-foreground">
            {selected.size} selecionada{selected.size === 1 ? '' : 's'}
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={doImport} disabled={selected.size === 0}>
              Importar {selected.size > 0 && `(${selected.size})`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}