import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { History, RefreshCw, Search, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AUDIT_ACTION_LABEL, AUDIT_ENTITY_LABEL } from '@/lib/audit';

interface LogRow {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: unknown;
  created_at: string;
}

function useActivityLogs() {
  return useQuery({
    queryKey: ['activity-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(300);
      if (error) throw error;

      const rows = (data || []) as LogRow[];
      const ids = [...new Set(rows.map(r => r.user_id).filter(Boolean))] as string[];
      let names: Record<string, string> = {};
      if (ids.length) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', ids);
        names = Object.fromEntries((profiles || []).map(p => [p.id, p.full_name]));
      }
      return rows.map(r => ({ ...r, userName: (r.user_id && names[r.user_id]) || 'Sistema' }));
    },
    staleTime: 30_000,
  });
}

function formatDetails(details: unknown) {
  if (!details || typeof details !== 'object') return '';
  const entries = Object.entries(details as Record<string, unknown>).slice(0, 3);
  return entries.map(([k, v]) => `${k}: ${String(v)}`).join(' · ');
}

export function ActivityLogPanel() {
  const { data, isLoading, refetch, isFetching } = useActivityLogs();
  const [search, setSearch] = useState('');
  const [entity, setEntity] = useState('all');

  const rows = useMemo(() => {
    const term = search.toLowerCase();
    return (data || []).filter(r => {
      const matchesEntity = entity === 'all' || r.entity_type === entity;
      const haystack = `${r.userName} ${r.action} ${r.entity_type} ${formatDetails(r.details)}`.toLowerCase();
      return matchesEntity && (!term || haystack.includes(term));
    });
  }, [data, search, entity]);

  const exportCsv = () => {
    const header = 'Data;Usuario;Acao;Item;Detalhes\n';
    const body = rows
      .map(r =>
        [
          new Date(r.created_at).toLocaleString('pt-BR'),
          r.userName,
          AUDIT_ACTION_LABEL[r.action] || r.action,
          AUDIT_ENTITY_LABEL[r.entity_type || ''] || r.entity_type || '-',
          formatDetails(r.details).replace(/;/g, ','),
        ].join(';'),
      )
      .join('\n');
    const url = URL.createObjectURL(new Blob([header + body], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `auditoria-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="card-interactive">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <History className="w-4 h-4 text-primary" />
              Histórico de Ações
            </CardTitle>
            <CardDescription className="text-sm">
              Registro permanente de cadastros, edições, exclusões e transferências
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!rows.length}>
              <Download className="w-3.5 h-3.5 mr-1.5" />
              CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar por usuário, ação ou detalhe..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Select value={entity} onValueChange={setEntity}>
            <SelectTrigger className="w-full sm:w-[180px] h-9">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os itens</SelectItem>
              {Object.entries(AUDIT_ENTITY_LABEL).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum registro encontrado.
          </p>
        ) : (
          <div className="max-h-[420px] overflow-y-auto divide-y divide-border rounded-lg border border-border">
            {rows.map(r => (
              <div key={r.id} className="flex items-start justify-between gap-3 p-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                      {AUDIT_ACTION_LABEL[r.action] || r.action}
                    </Badge>
                    <span className="text-sm font-medium truncate">
                      {AUDIT_ENTITY_LABEL[r.entity_type || ''] || r.entity_type || '-'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    {r.userName}
                    {formatDetails(r.details) && ` — ${formatDetails(r.details)}`}
                  </p>
                </div>
                <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                  {new Date(r.created_at).toLocaleString('pt-BR')}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
