import { useState } from 'react';
import { Landmark, Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  useFinancingBanks, useSaveFinancingBank, useDeleteFinancingBank,
} from '@/hooks/useFinancingBanks';

/** Lista de bancos disponíveis para escolha no financiamento da venda. */
export function FinancingBanksManager() {
  const { data: banks = [], isLoading } = useFinancingBanks();
  const save = useSaveFinancingBank();
  const del = useDeleteFinancingBank();
  const [newName, setNewName] = useState('');

  const add = async () => {
    const name = newName.trim().toUpperCase();
    if (name.length < 2) return;
    await save.mutateAsync({ name, is_active: true, sort_order: banks.length + 1 });
    setNewName('');
  };

  return (
    <Card className="card-interactive">
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Landmark className="w-4 h-4 text-primary" />
          BANCOS DE FINANCIAMENTO
        </CardTitle>
        <CardDescription className="text-sm">
          Estes bancos aparecem como opção obrigatória ao finalizar uma venda financiada.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value.toUpperCase())}
            placeholder="EX: BANCO ITAÚ"
            className="h-9 uppercase"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          />
          <Button className="h-9 gap-1" onClick={add} disabled={save.isPending || newName.trim().length < 2}>
            <Plus className="w-4 h-4" /> Adicionar
          </Button>
        </div>

        <div className="divide-y rounded-md border">
          {isLoading && <div className="p-3 text-xs text-muted-foreground">Carregando…</div>}
          {!isLoading && banks.length === 0 && (
            <div className="p-3 text-xs text-muted-foreground">Nenhum banco cadastrado.</div>
          )}
          {banks.map((b) => (
            <div key={b.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2.5">
              <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{b.name}</span>
                  {!b.is_active && <Badge variant="secondary" className="text-[10px]">Inativo</Badge>}
                </div>
                <Input
                  defaultValue={b.lien_holder || ''}
                  placeholder="Razão social da alienação (ex.: QI TECH SOCIEDADE DE CRÉDITO DIRETO S.A.)"
                  className="h-9 uppercase text-xs"
                  onBlur={(e) => {
                    const v = e.target.value.trim().toUpperCase();
                    if (v !== (b.lien_holder || '')) save.mutate({ id: b.id, lien_holder: v || null });
                  }}
                />
                <span className="text-[11px] text-muted-foreground">
                  Na NF: ALIENADO AO {(b.lien_holder || b.name).toUpperCase()}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Switch
                  checked={b.is_active}
                  onCheckedChange={(v) => save.mutate({ id: b.id, is_active: v })}
                />
                <Button size="icon" variant="ghost" onClick={() => del.mutate(b.id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
