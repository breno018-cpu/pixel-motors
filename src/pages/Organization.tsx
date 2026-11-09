import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Store as StoreIcon, Users, Handshake, Info } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import Stores from './Stores';
import Sellers from './Sellers';
import Resellers from './Resellers';
import { PageHeader } from '@/components/layout/PageHeader';

const TABS = [
  {
    value: 'lojas',
    label: 'Lojas & Filiais',
    icon: StoreIcon,
    subtitle: 'Matriz e filiais oficiais da rede com dados cadastrais e operacionais sincronizados.',
    adminOnly: true,
  },
  {
    value: 'vendedores',
    label: 'Vendedores',
    icon: Users,
    subtitle:
      'Equipe interna com vínculo à loja. Vendem o estoque da empresa e recebem comissão em folha de pagamento.',
    adminOnly: false,
  },
  {
    value: 'revendedores',
    label: 'Revendedores',
    icon: Handshake,
    subtitle:
      'Parceiros externos. Possuem estoque próprio/consignado, não entram na folha e são remunerados por acordo comercial.',
    adminOnly: false,
  },
] as const;

export default function Organization() {
  const [params, setParams] = useSearchParams();
  const { isAdmin } = useAuth();

  const available = useMemo(() => TABS.filter((t) => !t.adminOnly || isAdmin), [isAdmin]);
  const requested = params.get('tab') ?? '';
  const tab = available.some((t) => t.value === requested) ? requested : available[0].value;
  const current = available.find((t) => t.value === tab)!;

  const setTab = (value: string) => {
    const next = new URLSearchParams(params);
    next.set('tab', value);
    setParams(next, { replace: true });
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Organização" description="Lojas, equipe interna e parceiros externos em um só lugar." />

      <Tabs value={tab} onValueChange={setTab} className="space-y-5">
        <TabsList>
          {available.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="gap-2">
              <t.icon className="w-4 h-4" /> {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <Card className="border-dashed">
          <CardContent className="flex items-start gap-2.5 py-3">
            <Info className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{current.subtitle}</p>
          </CardContent>
        </Card>

        {isAdmin && (
          <TabsContent value="lojas" className="mt-0">
            <Stores embedded />
          </TabsContent>
        )}
        <TabsContent value="vendedores" className="mt-0">
          <Sellers embedded />
        </TabsContent>
        <TabsContent value="revendedores" className="mt-0">
          <Resellers embedded />
        </TabsContent>
      </Tabs>
    </div>
  );
}
