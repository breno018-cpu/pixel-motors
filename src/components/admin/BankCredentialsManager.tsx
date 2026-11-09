import { useState } from 'react';
import { Plus, Trash2, KeyRound, AlertCircle, Landmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useStores } from '@/hooks/useStores';
import {
  useBankCredentials, useUpsertBankCredential, useDeleteBankCredential,
  SUPPORTED_BANKS, BankCredential,
} from '@/hooks/useBankCredentials';

const BANK_LABEL: Record<string, string> = Object.fromEntries(
  SUPPORTED_BANKS.map((b) => [b.code, b.name]),
);

export function BankCredentialsManager() {
  const { data: stores = [] } = useStores();
  const { data: creds = [] } = useBankCredentials();
  const upsert = useUpsertBankCredential();
  const del = useDeleteBankCredential();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<BankCredential>>({
    api_environment: 'sandbox', is_active: true, extra_config: {},
  });

  const openNew = () => {
    setForm({ api_environment: 'sandbox', is_active: true, extra_config: {} });
    setOpen(true);
  };
  const edit = (c: BankCredential) => { setForm({ ...c }); setOpen(true); };
  const save = async () => {
    if (!form.store_id || !form.bank_code) return;
    const bank = SUPPORTED_BANKS.find((b) => b.code === form.bank_code);
    await upsert.mutateAsync({ ...form, bank_name: bank?.name || form.bank_code });
    setOpen(false);
  };

  return (
    <Card className="card-interactive">
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Landmark className="w-4 h-4 text-primary" />
          Credenciais Bancárias (Financiamentos)
        </CardTitle>
        <CardDescription className="text-sm">
          Configure por loja as credenciais que cada banco fornece ao formalizar o convênio.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Alert>
          <AlertCircle className="w-4 h-4" />
          <AlertDescription className="text-xs">
            Sem credenciais homologadas o sistema usa cálculo Price com taxa de fallback. Após
            firmar convênio, preencha Client ID, Client Secret e ambiente (sandbox/produção).
          </AlertDescription>
        </Alert>
        <div className="flex justify-end">
          <Button onClick={openNew} size="sm" className="gap-2">
            <Plus className="w-4 h-4" /> Nova Credencial
          </Button>
        </div>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Loja</TableHead>
                <TableHead>Banco</TableHead>
                <TableHead>Ambiente</TableHead>
                <TableHead>Ativa</TableHead>
                <TableHead className="w-32"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {creds.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-sm">Nenhuma credencial cadastrada</TableCell></TableRow>
              ) : creds.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.store?.name || '—'}</TableCell>
                  <TableCell>{BANK_LABEL[c.bank_code] || c.bank_name}</TableCell>
                  <TableCell><Badge variant="outline">{c.api_environment}</Badge></TableCell>
                  <TableCell>{c.is_active ? <Badge className="bg-success/20 text-success">Sim</Badge> : <Badge variant="secondary">Não</Badge>}</TableCell>
                  <TableCell className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => edit(c)}><KeyRound className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => del.mutate(c.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Editar' : 'Nova'} Credencial Bancária</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Loja</Label>
              <Select value={form.store_id} onValueChange={(v) => setForm({ ...form, store_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {stores.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Banco</Label>
              <Select value={form.bank_code} onValueChange={(v) => setForm({ ...form, bank_code: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {SUPPORTED_BANKS.map((b) => <SelectItem key={b.code} value={b.code}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ambiente</Label>
              <Select value={form.api_environment} onValueChange={(v: any) => setForm({ ...form, api_environment: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sandbox">Sandbox (homologação)</SelectItem>
                  <SelectItem value="producao">Produção</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Código do correspondente</Label>
              <Input value={form.partner_code || ''} onChange={(e) => setForm({ ...form, partner_code: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Client ID</Label>
              <Input value={form.client_id || ''} onChange={(e) => setForm({ ...form, client_id: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Client Secret</Label>
              <Input type="password" value={form.client_secret || ''} onChange={(e) => setForm({ ...form, client_secret: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Taxa fallback (a.m. decimal — ex.: 0.0189 = 1,89%)</Label>
              <Input
                type="number"
                step="0.0001"
                value={form.extra_config?.monthly_rate ?? ''}
                onChange={(e) => setForm({
                  ...form,
                  extra_config: { ...(form.extra_config || {}), monthly_rate: e.target.value ? Number(e.target.value) : undefined },
                })}
              />
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <Switch checked={!!form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label>Credencial ativa</Label>
            </div>
            <div className="col-span-2">
              <Label>Observações</Label>
              <Textarea value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={upsert.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}