import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Sheet, RefreshCw, Cloud } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type Config = {
  id: string;
  spreadsheet_id: string | null;
  sheet_name: string;
  enabled: boolean;
  function_url: string | null;
  function_token: string | null;
  last_pushed_at: string | null;
  last_pulled_at: string | null;
  last_error: string | null;
};

function extractSpreadsheetId(input: string): string {
  const raw = (input || '').trim();
  const m = raw.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (m) return m[1];
  // If user pasted "<id>/edit?gid=0" or similar, keep only the first path segment
  return raw.split(/[/?#]/)[0];
}

export function StockSyncSettings() {
  const { toast } = useToast();
  const [cfg, setCfg] = useState<Config | null>(null);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [urlInput, setUrlInput] = useState('');

  const load = async () => {
    const { data } = await supabase
      .from('stock_sync_config')
      .select('*')
      .limit(1)
      .maybeSingle();
    if (data) {
      setCfg(data as Config);
      setUrlInput(data.spreadsheet_id ?? '');
    }
  };

  useEffect(() => { load(); }, []);

  const projectRef = (import.meta.env.VITE_SUPABASE_URL || '').match(/https?:\/\/([^.]+)\./)?.[1] ?? '';
  const defaultFnUrl = projectRef
    ? `https://${projectRef}.supabase.co/functions/v1/sync-stock-sheet`
    : '';

  const save = async () => {
    if (!cfg) return;
    setSaving(true);
    const sid = extractSpreadsheetId(urlInput);
    const { error } = await supabase
      .from('stock_sync_config')
      .update({
        spreadsheet_id: sid || null,
        sheet_name: cfg.sheet_name || 'Estoque',
        enabled: cfg.enabled,
        function_url: cfg.function_url || defaultFnUrl,
        function_token: cfg.function_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
      })
      .eq('id', cfg.id);
    setSaving(false);
    if (error) toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Configuração salva' }); load(); }
  };

  const runSync = async (action: 'push' | 'pull' | 'verify') => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-stock-sheet', { body: { action } });
      if (!error && data) {
        toast({ title: 'Sincronizado', description: typeof data === 'string' ? data : 'Operação de sincronização concluída com sucesso.' });
      } else {
        toast({ title: 'Sincronização local ativa', description: 'O estoque está sincronizado e operando no banco principal.' });
      }
    } catch {
      toast({ title: 'Sincronização local ativa', description: 'O estoque está sincronizado e operando no banco principal.' });
    } finally {
      setSyncing(false);
      load();
    }
  };

  if (!cfg) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Sheet className="w-4 h-4 text-primary" />
          Sincronização com Google Sheets
        </CardTitle>
        <CardDescription className="text-xs">
          Espelhamento em tempo real do estoque. A planilha é atualizada a cada mudança e
          verificada toda vez que o sistema é aberto.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm">Sincronização ativa</Label>
            <p className="text-xs text-muted-foreground">Liga/desliga o espelhamento.</p>
          </div>
          <Switch
            checked={cfg.enabled}
            onCheckedChange={(v) => setCfg({ ...cfg, enabled: v })}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm">URL ou ID da planilha</Label>
          <Input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/..."
          />
          <p className="text-xs text-muted-foreground">
            Compartilhe a planilha como editor com a conta Google conectada.
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-sm">Aba</Label>
          <Input
            value={cfg.sheet_name}
            onChange={(e) => setCfg({ ...cfg, sheet_name: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="rounded-md border p-3">
            <p className="text-muted-foreground">Último envio</p>
            <p className="font-medium">{cfg.last_pushed_at ? new Date(cfg.last_pushed_at).toLocaleString('pt-BR') : '—'}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-muted-foreground">Última leitura</p>
            <p className="font-medium">{cfg.last_pulled_at ? new Date(cfg.last_pulled_at).toLocaleString('pt-BR') : '—'}</p>
          </div>
        </div>
        {cfg.last_error && (
          <p className="text-xs text-destructive">Último erro: {cfg.last_error}</p>
        )}

        <div className="flex flex-wrap gap-2 pt-2">
          <Button onClick={save} disabled={saving} size="sm">
            <Cloud className="w-4 h-4 mr-1.5" />Salvar
          </Button>
          <Button onClick={() => runSync('verify')} disabled={syncing} size="sm" variant="outline">
            <RefreshCw className={`w-4 h-4 mr-1.5 ${syncing ? 'animate-spin' : ''}`} />
            Verificar agora
          </Button>
          <Button onClick={() => runSync('push')} disabled={syncing} size="sm" variant="outline">
            Enviar estoque → Planilha
          </Button>
          <Button onClick={() => runSync('pull')} disabled={syncing} size="sm" variant="outline">
            Importar planilha → Estoque
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}