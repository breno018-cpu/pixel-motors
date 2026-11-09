import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Plus, Copy, Trash2, Power } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';

const SCOPES = [
  { id: 'read', label: 'Leitura (estoque, vendas, lojas, equipe)' },
  { id: 'read:payroll', label: 'Leitura da folha de pagamento' },
  { id: 'read:all', label: 'Leitura total (todos os recursos)' },
];

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
}

async function sha256(value: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function generateKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return `plk_${Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}

export function ApiKeysManager() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<string[]>(['read']);
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/hub-api`;

  const { data: keys } = useQuery({
    queryKey: ['api-keys'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('api_keys')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as ApiKey[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const raw = generateKey();
      const { data: u } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from('api_keys').insert({
        name: name.trim(),
        key_prefix: raw.slice(0, 12),
        key_hash: await sha256(raw),
        scopes,
        created_by: u.user?.id,
      });
      if (error) throw error;
      return raw;
    },
    onSuccess: (raw) => {
      setCreatedKey(raw);
      setName('');
      qc.invalidateQueries({ queryKey: ['api-keys'] });
    },
    onError: (e: any) =>
      toast({ variant: 'destructive', title: 'Erro ao criar chave', description: e?.message }),
  });

  const toggle = useMutation({
    mutationFn: async (k: ApiKey) => {
      const { error } = await (supabase as any)
        .from('api_keys').update({ is_active: !k.is_active }).eq('id', k.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-keys'] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('api_keys').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-keys'] }),
  });

  const copy = (value: string) => {
    navigator.clipboard.writeText(value);
    toast({ title: 'Copiado' });
  };

  return (
    <Card className="card-interactive">
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-primary" />
          Hub de Integrações — Chaves de API
        </CardTitle>
        <CardDescription className="text-sm">
          Permita que outros aplicativos leiam os dados deste sistema por API REST.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg bg-muted/50 p-3 space-y-1">
          <p className="text-xs font-medium text-foreground">Endpoint base</p>
          <div className="flex items-center gap-2">
            <code className="text-[11px] text-muted-foreground break-all flex-1">{baseUrl}/&#123;recurso&#125;</code>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copy(baseUrl)}>
              <Copy className="w-3 h-3" />
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Recursos: stores, vehicles, sales, employees, resellers, payslips · Cabeçalho: <code>x-api-key</code>
          </p>
        </div>

        <div className="space-y-2">
          {(keys || []).length === 0 && (
            <p className="text-xs text-muted-foreground">Nenhuma chave criada ainda.</p>
          )}
          {(keys || []).map((k) => (
            <div key={k.id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/40">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{k.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {k.key_prefix}••••  ·  {k.scopes.join(', ')}
                  {k.last_used_at
                    ? ` · usada em ${new Date(k.last_used_at).toLocaleDateString('pt-BR')}`
                    : ' · nunca usada'}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Badge variant={k.is_active ? 'default' : 'secondary'} className="text-[10px]">
                  {k.is_active ? 'Ativa' : 'Inativa'}
                </Badge>
                <Button variant="ghost" size="icon" className="h-7 w-7" title="Ativar/desativar"
                  onClick={() => toggle.mutate(k)}>
                  <Power className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Excluir"
                  onClick={() => remove.mutate(k.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <Button variant="outline" className="gap-2 h-9" onClick={() => { setCreatedKey(null); setOpen(true); }}>
          <Plus className="w-4 h-4" /> Nova chave
        </Button>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{createdKey ? 'Chave criada' : 'Nova chave de API'}</DialogTitle>
            <DialogDescription>
              {createdKey
                ? 'Copie agora — ela não será exibida novamente.'
                : 'Escolha um nome e os escopos de leitura permitidos.'}
            </DialogDescription>
          </DialogHeader>

          {createdKey ? (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
              <code className="text-xs break-all flex-1">{createdKey}</code>
              <Button variant="ghost" size="icon" onClick={() => copy(createdKey)}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="key-name">Nome</Label>
                <Input id="key-name" value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="Ex.: App de Vitrine" />
              </div>
              <div className="space-y-2">
                <Label>Escopos</Label>
                {SCOPES.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={scopes.includes(s.id)}
                      onCheckedChange={(c) =>
                        setScopes((prev) => (c ? [...prev, s.id] : prev.filter((x) => x !== s.id)))
                      }
                    />
                    {s.label}
                  </label>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            {createdKey ? (
              <Button onClick={() => setOpen(false)}>Concluir</Button>
            ) : (
              <Button disabled={!name.trim() || scopes.length === 0 || create.isPending}
                onClick={() => create.mutate()}>
                {create.isPending ? 'Criando...' : 'Criar chave'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
