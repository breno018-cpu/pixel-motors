import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Truck, MapPin, Navigation, Clock, CheckCircle2, ShieldCheck, ArrowRight, UserCheck } from 'lucide-react';
import { formatCurrencyBRL } from '@/lib/dealershipSheetParser';
import { useNavigate } from 'react-router-dom';

interface LogisticsDeliveriesWidgetProps {
  sales: any[];
  baseCity?: string;
}

export function LogisticsDeliveriesWidget({ sales, baseCity = 'Divinópolis' }: LogisticsDeliveriesWidgetProps) {
  const navigate = useNavigate();

  // Consolidação das saídas logísticas e cidades de destino
  const stats = useMemo(() => {
    let entregues = 0;
    let aDespachar = 0;
    const cityMap: Record<string, { count: number; total: number }> = {};

    sales.forEach((s) => {
      const city = s.regiao || baseCity;
      if (!cityMap[city]) cityMap[city] = { count: 0, total: 0 };
      cityMap[city].count += 1;
      cityMap[city].total += Number(s.valor || 0);

      if (s.is_permitted) {
        entregues++;
      } else {
        aDespachar++;
      }
    });

    const topDestinations = Object.entries(cityMap)
      .map(([cidade, data]) => ({ cidade, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      total: sales.length,
      entregues,
      aDespachar,
      topDestinations,
    };
  }, [sales, baseCity]);

  return (
    <Card className="rounded-3xl border shadow-sm overflow-hidden flex flex-col justify-between h-full">
      <CardHeader className="pb-3 border-b bg-muted/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold text-foreground">
                Logística, Motoristas & Entregas
              </CardTitle>
              <CardDescription className="text-xs">
                Hub de despacho rodoviário e rotas ativas ({baseCity})
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="text-xs font-bold border-sky-500/30 text-sky-600 bg-sky-500/5">
            {stats.total} Rotas Mapeadas
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-4 flex-1">
        {/* Contadores Principais */}
        <div className="grid grid-cols-2 gap-2">
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              Entregas Liberadas
            </div>
            <div className="text-xl font-black font-display text-emerald-900 dark:text-emerald-200 mt-1">
              {stats.entregues}
            </div>
            <p className="text-[10px] text-emerald-600/80">Veículos entregues aos clientes</p>
          </div>

          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400">
              <Clock className="w-4 h-4" />
              Aguardando Despacho
            </div>
            <div className="text-xl font-black font-display text-amber-900 dark:text-amber-200 mt-1">
              {stats.aDespachar}
            </div>
            <p className="text-[10px] text-amber-600/80">Pré-vendas ou expedição pendente</p>
          </div>
        </div>

        {/* Principais Cidades de Entrega */}
        <div className="space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-primary" />
            Principais Destinos Rodoviários (MG)
          </span>

          <div className="space-y-1.5">
            {stats.topDestinations.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">Nenhuma rota calculada no período.</p>
            ) : (
              stats.topDestinations.map((dest, idx) => (
                <div
                  key={dest.cidade}
                  className="flex items-center justify-between p-2 rounded-xl border bg-muted/10 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-bold text-[10px] flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-foreground truncate max-w-[150px]">
                      {dest.cidade}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="font-mono text-[10px]">
                      {dest.count} {dest.count === 1 ? 'moto' : 'motos'}
                    </Badge>
                    <span className="text-[11px] font-bold text-muted-foreground hidden sm:inline">
                      {formatCurrencyBRL(dest.total)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Informações da Equipe de Motoristas */}
        <div className="p-2.5 rounded-xl border bg-card/60 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <UserCheck className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="font-bold text-foreground">Frota & Motoristas Habilitados</p>
              <p className="text-[10px] text-muted-foreground">Prancha, Reboque e Caminhão HR</p>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigate('/sales')}
            className="h-7 text-[11px] font-bold gap-1 text-primary hover:bg-primary/10"
          >
            Ver Vendas & Fretes
            <ArrowRight className="w-3 h-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
