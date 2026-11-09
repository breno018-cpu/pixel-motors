import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import { resolveModelYearFromVin } from '@/lib/chassisRecognition';

interface YearForm {
  year_code: string;
  model_year: string;
  manufacture_year: string;
  brand: string;
  notes: string;
}

const emptyForm: YearForm = { year_code: '', model_year: '', manufacture_year: '', brand: '', notes: '' };
const clean = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, '');

/** Catálogo de códigos do chassi (posições 10 e 11) que definem o ano/modelo. */
export function ChassisYearCodeManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<YearForm>(emptyForm);
  const [search, setSearch] = useState('');
  const [testVin, setTestVin] = useState('');
  const [testResult, setTestResult] = useState<{
    year: number | null;
    manufactureYear?: number | null;
    code?: string;
    brand?: string | null;
  } | null>(null);

  const runTest = async () => {
    const res = await resolveModelYearFromVin(testVin);
    setTestResult({
      year: res.year,
      manufactureYear: res.manufactureYear,
      code: res.matchedCode,
      brand: res.matchedBrand,
    });
  };

  const { data: codes = [], isLoading } = useQuery({
    queryKey: ['chassis-year-codes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chassis_year_codes')
        .select('*')
        .order('model_year', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: YearForm) => {
      const payload = {
        year_code: clean(values.year_code),
        model_year: parseInt(values.model_year, 10),
        manufacture_year: values.manufacture_year ? parseInt(values.manufacture_year, 10) : null,
        brand: values.brand ? values.brand.toUpperCase().trim() : null,
        notes: values.notes || null,
      };
      if (editId) {
        const { error } = await supabase.from('chassis_year_codes').update(payload).eq('id', editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('chassis_year_codes').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chassis-year-codes'] });
      toast({ title: editId ? 'Código atualizado' : 'Código cadastrado' });
      closeDialog();
    },
    onError: (e: Error) => toast({ variant: 'destructive', title: 'Erro', description: e.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('chassis_year_codes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chassis-year-codes'] });
      toast({ title: 'Código excluído' });
    },
    onError: (e: Error) => toast({ variant: 'destructive', title: 'Erro', description: e.message }),
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditId(null);
    setForm(emptyForm);
  };

  const openEdit = (c: typeof codes[number]) => {
    setEditId(c.id);
    setForm({
      year_code: c.year_code,
      model_year: String(c.model_year),
      manufacture_year: c.manufacture_year ? String(c.manufacture_year) : '',
      brand: c.brand || '',
      notes: c.notes || '',
    });
    setDialogOpen(true);
  };

  const filtered = codes.filter((c) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      c.year_code?.toLowerCase().includes(s) ||
      c.brand?.toLowerCase().includes(s) ||
      String(c.model_year).includes(s)
    );
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" className="gap-1.5" onClick={() => { setForm(emptyForm); setEditId(null); setDialogOpen(true); }}>
          <Plus className="w-3.5 h-3.5" />
          Novo
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por código, marca ou ano..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      <div className="rounded-md border max-h-[350px] overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Código (10ª/11ª)</TableHead>
              <TableHead className="text-xs">Fabricação/Modelo</TableHead>
              <TableHead className="text-xs">Marca</TableHead>
              <TableHead className="text-xs">Observação</TableHead>
              <TableHead className="text-xs w-[80px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground">Nenhum código cadastrado</TableCell></TableRow>
            ) : filtered.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="text-xs font-mono">{c.year_code}</TableCell>
                <TableCell className="text-xs font-medium">
                  {c.manufacture_year ? `${c.manufacture_year}/${c.model_year}` : c.model_year}
                </TableCell>
                <TableCell className="text-xs">{c.brand || 'TODAS'}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{c.notes || '—'}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}>
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(c.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="rounded-xl border border-border bg-muted/25 p-3 space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Testar um chassi
        </Label>
        <div className="flex gap-2">
          <Input
            value={testVin}
            onChange={(e) => setTestVin(clean(e.target.value).slice(0, 17))}
            placeholder="Cole o chassi completo"
            className="h-9 font-mono uppercase"
            maxLength={17}
          />
          <Button variant="outline" size="sm" className="h-9 shrink-0" onClick={runTest} disabled={testVin.length < 11}>
            Testar
          </Button>
        </div>
        {testResult && (
          <p className={`text-xs ${testResult.year ? 'text-success' : 'text-warning'}`}>
            {testResult.year
              ? `Código ${testResult.code} → ${testResult.manufactureYear ? `fabricação ${testResult.manufactureYear} / ` : ''}ano modelo ${testResult.year}${testResult.brand ? ` (regra da marca ${testResult.brand})` : ' (regra geral)'}`
              : `Nenhuma regra cadastrada para "${testVin.slice(9, 11)}" — cadastre o código acima para o ano preencher certo.`}
          </p>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        As posições <strong>10ª e 11ª</strong> do chassi definem o ano/modelo. Informe as duas letras/dígitos
        (ex.: <span className="font-mono">SJ</span>) ou apenas o 10º caractere para uma regra genérica.
        Códigos com marca têm prioridade sobre os genéricos. Sem regra cadastrada o sistema deixa o ano em branco
        em vez de chutar um valor.
      </p>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? 'Editar Código de Ano' : 'Novo Código de Ano/Modelo'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Código do chassi (10ª/11ª) *</Label>
                <Input
                  value={form.year_code}
                  onChange={(e) => setForm({ ...form, year_code: clean(e.target.value).slice(0, 2) })}
                  maxLength={2}
                  placeholder="Ex: SJ"
                  className="h-9 font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Ano modelo *</Label>
                <Input
                  type="number"
                  value={form.model_year}
                  onChange={(e) => setForm({ ...form, model_year: e.target.value })}
                  placeholder="Ex: 2026"
                  className="h-9"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Ano de fabricação (opcional)</Label>
              <Input
                type="number"
                value={form.manufacture_year}
                onChange={(e) => setForm({ ...form, manufacture_year: e.target.value })}
                placeholder="Ex: 2025"
                className="h-9"
              />
              <p className="text-[11px] text-muted-foreground">
                Preencha os dois para o cadastro sair como 2025/2026 automaticamente.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Marca (opcional)</Label>
              <Input
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value.toUpperCase() })}
                placeholder="EX: HONDA (vazio = todas)"
                className="h-9 uppercase"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Observação</Label>
              <Input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value.toUpperCase() })}
                placeholder="EX: LINHA 2025 A PARTIR DE 07/2024"
                className="h-9 uppercase"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button
              onClick={() => {
                const year = parseInt(form.model_year, 10);
                if (!clean(form.year_code) || !year || year < 1980 || year > 2100) {
                  toast({ variant: 'destructive', title: 'Preencha o código e um ano válido' });
                  return;
                }
                saveMutation.mutate(form);
              }}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
