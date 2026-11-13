import { useState, useMemo } from 'react';
import {
  Radar,
  Target,
  Megaphone,
  Instagram,
  Facebook,
  Search,
  Users,
  Store,
  Compass,
  Building2,
  Globe2,
  KeyRound,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrencyBRL } from '@/lib/dealershipSheetParser';
import {
  CITY_COORDINATES,
  normalizeCityKey,
  resolveCityCoordinates,
  haversineDistanceKm,
  isMontesClarosRegion,
  MAP_API_KEY,
} from '@/lib/geoCoordinates';

export interface MarketingLeadRadiusMapProps {
  sales?: Array<{
    id: string;
    cliente?: string;
    regiao?: string;
    valor?: number;
    modelo?: string;
    vendedor?: string;
    dateStr?: string;
    lead_mapping?: string;
    source?: string;
    store_id?: string;
    store_name?: string;
  }>;
  contracts?: Array<any>;
  baseCity?: string;
}

interface RadiusBand {
  minKm: number;
  maxKm: number;
  label: string;
  color: string;
  tag: string;
}

const RADIUS_BANDS: RadiusBand[] = [
  { minKm: 0, maxKm: 50, label: 'Raio Local (0 - 50 km • Ø 100 km)', color: '#2563eb', tag: 'Metropolitano / Local' },
  { minKm: 51, maxKm: 150, label: 'Raio Regional (51 - 150 km • Ø 300 km)', color: '#10b981', tag: 'Microrregional' },
  { minKm: 151, maxKm: 300, label: 'Raio Expandido (151 - 300 km • Ø 600 km)', color: '#f59e0b', tag: 'Polo Secundário' },
  { minKm: 301, maxKm: 9999, label: 'Raio Remoto (> 300 km • Ø > 600 km)', color: '#8b5cf6', tag: 'Longa Distância' },
];

const LEAD_CHANNELS = [
  { key: 'all', label: 'Todos os Canais de Marketing' },
  { key: 'Instagram', label: 'Instagram Ads / Direct', icon: Instagram, color: '#e1306c' },
  { key: 'Facebook', label: 'Facebook / Marketplace', icon: Facebook, color: '#1877f2' },
  { key: 'Google / Tráfego Pago', label: 'Google Search / Pago', icon: Search, color: '#4285f4' },
  { key: 'Indicação / Parceiros', label: 'Indicação / Despachantes', icon: Users, color: '#10b981' },
  { key: 'Loja / Balcão', label: 'Visita Espontânea / Balcão', icon: Store, color: '#6366f1' },
];

function normalizeLeadChannel(raw?: string): string {
  if (!raw) return 'Loja / Balcão';
  const clean = raw.toLowerCase();
  if (clean.includes('insta') || clean.includes('ig')) return 'Instagram';
  if (clean.includes('face') || clean.includes('fb') || clean.includes('market')) return 'Facebook';
  if (
    clean.includes('google') ||
    clean.includes('site') ||
    clean.includes('ads') ||
    clean.includes('ferramenta') ||
    clean.includes('trafego')
  )
    return 'Google / Tráfego Pago';
  if (clean.includes('indic') || clean.includes('amigo') || clean.includes('parceir'))
    return 'Indicação / Parceiros';
  return 'Loja / Balcão';
}

export function MarketingLeadRadiusMap({
  sales = [],
  baseCity = 'Montes Claros',
}: MarketingLeadRadiusMapProps) {
  const [selectedChannel, setSelectedChannel] = useState<string>('all');
  const [selectedBand, setSelectedBand] = useState<string>('all');
  const [poloFilter, setPoloFilter] = useState<'all' | 'montesclaros' | 'divinopolis'>('all');
  const [activeItemDetail, setActiveItemDetail] = useState<any | null>(null);

  const mocCoords = CITY_COORDINATES['MONTES CLAROS'];
  const divCoords = CITY_COORDINATES['DIVINOPOLIS'];

  const allCombinedLeads = useMemo(() => {
    const safeSales = sales || [];
    return safeSales.map((s, idx) => {
      let isMoc = false;
      if (s.store_id === 'store-montesclaros') {
        isMoc = true;
      } else if (s.store_id === 'store-divinopolis') {
        isMoc = false;
      } else if ((s.store_name || '').toLowerCase().includes('montes')) {
        isMoc = true;
      } else if ((s.store_name || '').toLowerCase().includes('divin')) {
        isMoc = false;
      } else {
        isMoc = isMontesClarosRegion(s.regiao || baseCity);
      }

      const hubRef = isMoc
        ? { key: 'montesclaros' as const, name: 'Polo Montes Claros', lat: mocCoords.lat, lng: mocCoords.lng }
        : { key: 'divinopolis' as const, name: 'Polo Divinópolis', lat: divCoords.lat, lng: divCoords.lng };

      const cityKey = normalizeCityKey(s.regiao || baseCity);
      const coords = resolveCityCoordinates(s.regiao || baseCity, hubRef.lat, hubRef.lng);

      const distance = haversineDistanceKm(hubRef.lat, hubRef.lng, coords.lat, coords.lng);
      const channel = normalizeLeadChannel(s.lead_mapping);

      return {
        id: s.id || `lead-sale-${idx}`,
        clientName: s.cliente || 'Cliente Comercial',
        city: cityKey,
        uf: coords.uf || 'MG',
        rodovia: coords.rodovia || 'Rodovia Estadual',
        lat: coords.lat,
        lng: coords.lng,
        hubKey: hubRef.key,
        hubName: hubRef.name,
        distanceKm: distance,
        channel,
        rawMapping: s.lead_mapping || 'Balcão',
        valor: s.valor || 0,
        model: s.modelo || 'Veículo',
        dateStr: s.dateStr || 'Out/2026',
        isConverted: true,
      };
    });
  }, [sales, baseCity, mocCoords, divCoords]);

  const combinedLeads = useMemo(() => {
    if (poloFilter === 'all') return allCombinedLeads;
    return allCombinedLeads.filter((l) => l.hubKey === poloFilter);
  }, [allCombinedLeads, poloFilter]);

  const filteredLeads = useMemo(() => {
    return combinedLeads.filter((item) => {
      if (selectedChannel !== 'all' && item.channel !== selectedChannel) return false;
      if (selectedBand !== 'all') {
        const band = RADIUS_BANDS.find((b) => b.label === selectedBand);
        if (band && (item.distanceKm < band.minKm || item.distanceKm > band.maxKm)) return false;
      }
      return true;
    });
  }, [combinedLeads, selectedChannel, selectedBand]);

  const bandStats = useMemo(() => {
    return RADIUS_BANDS.map((band) => {
      const inBand = combinedLeads.filter(
        (l) => l.distanceKm >= band.minKm && l.distanceKm <= band.maxKm
      );
      const count = inBand.length;
      const faturamento = inBand.reduce((acc, l) => acc + l.valor, 0);

      const channelCounts: Record<string, number> = {};
      inBand.forEach((l) => {
        channelCounts[l.channel] = (channelCounts[l.channel] || 0) + 1;
      });
      const topChannelEntry = Object.entries(channelCounts).sort((a, b) => b[1] - a[1])[0];
      const topChannel = topChannelEntry ? `${topChannelEntry[0]} (${topChannelEntry[1]})` : '—';

      return {
        ...band,
        count,
        faturamento,
        pct: combinedLeads.length > 0 ? (count / combinedLeads.length) * 100 : 0,
        topChannel,
      };
    });
  }, [combinedLeads]);

  const channelStats = useMemo(() => {
    const map: Record<string, { count: number; faturamento: number; avgDist: number; totalDist: number }> = {};

    combinedLeads.forEach((l) => {
      if (!map[l.channel]) {
        map[l.channel] = { count: 0, faturamento: 0, avgDist: 0, totalDist: 0 };
      }
      map[l.channel].count += 1;
      map[l.channel].faturamento += l.valor;
      map[l.channel].totalDist += l.distanceKm;
    });

    return Object.entries(map)
      .map(([channelName, data]) => ({
        channelName,
        count: data.count,
        faturamento: data.faturamento,
        avgDist: data.count > 0 ? Math.round(data.totalDist / data.count) : 0,
        pct: combinedLeads.length > 0 ? (data.count / combinedLeads.length) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [combinedLeads]);

  const mocCount = allCombinedLeads.filter((l) => l.hubKey === 'montesclaros').length;
  const divCount = allCombinedLeads.filter((l) => l.hubKey === 'divinopolis').length;

  return (
    <div className="space-y-4">
      {/* HEADER EXECUTIVO COMPACTO COM EXPO GLASS */}
      <Card className="rounded-2xl border shadow-xs expo-glass-card">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base md:text-lg font-bold text-foreground flex items-center gap-2">
                  <Radar className="w-4 h-4 text-pink-600" />
                  Origem dos Leads & Alcance por Raio
                </h2>
                <Badge variant="outline" className="text-[10px] font-mono px-2 py-0 border-white/20 dark:border-white/10">
                  ▲ MOC: {mocCount}
                </Badge>
                <Badge variant="outline" className="text-[10px] font-mono px-2 py-0 border-white/20 dark:border-white/10">
                  ▲ DIV: {divCount}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Mapeamento por anéis concêntricos com geometria limpa e low-poly.
              </p>
            </div>

            {/* Filtros de Polo, Canal e Raio */}
            <div className="flex flex-wrap items-center gap-1.5">
              <div className="flex items-center expo-glass-bar p-0.5 rounded-lg border border-white/20 dark:border-white/10 gap-0.5">
                <Button
                  size="sm"
                  variant={poloFilter === 'all' ? 'default' : 'ghost'}
                  onClick={() => setPoloFilter('all')}
                  className="h-6 text-[11px] font-semibold rounded-md px-2"
                >
                  2 Polos ({allCombinedLeads.length})
                </Button>
                <Button
                  size="sm"
                  variant={poloFilter === 'montesclaros' ? 'default' : 'ghost'}
                  onClick={() => setPoloFilter('montesclaros')}
                  className="h-6 text-[11px] font-semibold rounded-md px-2"
                >
                  ▲ MOC ({mocCount})
                </Button>
                <Button
                  size="sm"
                  variant={poloFilter === 'divinopolis' ? 'default' : 'ghost'}
                  onClick={() => setPoloFilter('divinopolis')}
                  className="h-6 text-[11px] font-semibold rounded-md px-2"
                >
                  ▲ DIV ({divCount})
                </Button>
              </div>

              <Select value={selectedChannel} onValueChange={setSelectedChannel}>
                <SelectTrigger className="w-[160px] h-7 text-xs btn-glass font-semibold rounded-lg">
                  <Megaphone className="w-3 h-3 mr-1 text-pink-600" />
                  <SelectValue placeholder="Canal" />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_CHANNELS.map((ch) => (
                    <SelectItem key={ch.key} value={ch.key} className="text-xs">
                      {ch.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedBand} onValueChange={setSelectedBand}>
                <SelectTrigger className="w-[150px] h-7 text-xs btn-glass font-semibold rounded-lg">
                  <Target className="w-3 h-3 mr-1 text-primary" />
                  <SelectValue placeholder="Raio" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">Todos os Raios</SelectItem>
                  {RADIUS_BANDS.map((b) => (
                    <SelectItem key={b.label} value={b.label} className="text-xs">
                      {b.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CORPO: RADAR POLAR LOW-POLY + DETALHES DO LEAD */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Radar Polar Visual */}
        <Card className="lg:col-span-2 rounded-2xl border shadow-xs overflow-hidden flex flex-col">
          <CardContent className="p-3 flex-1 flex flex-col justify-center items-center bg-slate-950 relative min-h-[460px]">
            <svg
              viewBox="0 0 540 540"
              className="w-full h-auto max-h-[440px] select-none"
            >
              {/* Círculo do Radar com Polígonos de Fundo Facetados */}
              <circle cx="270" cy="270" r="240" fill="#0b1120" stroke="#1e293b" strokeWidth="1.2" />

              {/* Anéis de Raio com estilo técnico e diâmetros padronizados */}
              <circle cx="270" cy="270" r="60" fill="none" stroke="#3b82f6" strokeWidth="1" strokeDasharray="3 4" opacity="0.6" />
              <text x="270" y="204" textAnchor="middle" fill="#60a5fa" fontSize="8.5" fontFamily="monospace">50 km (Ø 100 km)</text>

              <circle cx="270" cy="270" r="130" fill="none" stroke="#10b981" strokeWidth="1" strokeDasharray="4 4" opacity="0.6" />
              <text x="270" y="134" textAnchor="middle" fill="#34d399" fontSize="8.5" fontFamily="monospace">150 km (Ø 300 km)</text>

              <circle cx="270" cy="270" r="195" fill="none" stroke="#f59e0b" strokeWidth="1" strokeDasharray="5 5" opacity="0.6" />
              <text x="270" y="69" textAnchor="middle" fill="#fbbf24" fontSize="8.5" fontFamily="monospace">300 km (Ø 600 km)</text>

              <circle cx="270" cy="270" r="238" fill="none" stroke="#8b5cf6" strokeWidth="1" opacity="0.4" />
              <text x="270" y="26" textAnchor="middle" fill="#c084fc" fontSize="8.5" fontFamily="monospace">&gt; 300 km (Ø &gt; 600 km)</text>

              {/* Eixos Cardeais */}
              <line x1="270" y1="28" x2="270" y2="512" stroke="#1e293b" strokeWidth="1" strokeDasharray="2 4" />
              <line x1="28" y1="270" x2="512" y2="270" stroke="#1e293b" strokeWidth="1" strokeDasharray="2 4" />

              {/* Polo Central Hexagonal Low-Poly */}
              <polygon points="270,256 282,263 282,277 270,284 258,277 258,263" fill="#ef4444" stroke="#ffffff" strokeWidth="1.5" />
              <polygon points="270,256 282,263 270,270 258,263" fill="#ffffff" opacity="0.3" />
              <text x="270" y="296" textAnchor="middle" fill="#94a3b8" fontSize="8" fontWeight="bold">
                {poloFilter === 'montesclaros' ? 'POLO MOC' : poloFilter === 'divinopolis' ? 'POLO DIV' : 'POLOS'}
              </text>

              {/* Marcadores Losangos Low-Poly dos Leads */}
              {filteredLeads.map((item, idx) => {
                let visualR = 36;
                if (item.distanceKm === 0) visualR = 26 + (idx % 3) * 8;
                else if (item.distanceKm <= 50) visualR = 30 + (item.distanceKm / 50) * 30;
                else if (item.distanceKm <= 150) visualR = 60 + ((item.distanceKm - 50) / 100) * 70;
                else if (item.distanceKm <= 300) visualR = 130 + ((item.distanceKm - 150) / 150) * 65;
                else visualR = 195 + Math.min(43, ((item.distanceKm - 300) / 200) * 43);

                const angle = ((idx * 47 + item.city.length * 29) % 360) * (Math.PI / 180);
                const cx = 270 + visualR * Math.cos(angle);
                const cy = 270 + visualR * Math.sin(angle);

                const isSelected = activeItemDetail?.id === item.id;
                const dotColor =
                  item.channel === 'Instagram'
                    ? '#e1306c'
                    : item.channel === 'Facebook'
                    ? '#1877f2'
                    : item.channel === 'Google / Tráfego Pago'
                    ? '#4285f4'
                    : item.channel === 'Indicação / Parceiros'
                    ? '#10b981'
                    : '#6366f1';

                return (
                  <g
                    key={item.id}
                    transform={`translate(${cx}, ${cy})`}
                    className="cursor-pointer"
                    onClick={() => setActiveItemDetail(item)}
                  >
                    {/* Losango Low-Poly */}
                    <polygon
                      points="0,-6 6,0 0,6 -6,0"
                      fill={dotColor}
                      stroke={isSelected ? '#f59e0b' : '#ffffff'}
                      strokeWidth={isSelected ? '2' : '1'}
                    />
                    <polygon points="0,-6 6,0 0,0 -6,0" fill="#ffffff" opacity="0.25" />
                    <text
                      x="0"
                      y={-9}
                      textAnchor="middle"
                      fill="#cbd5e1"
                      fontSize="7"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      {item.city}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Legenda dos Canais Minimalista */}
            <div className="absolute bottom-3 left-4 max-w-[calc(100%-2rem)] overflow-hidden bg-slate-900/90 text-white border border-slate-800 rounded-md px-2.5 py-1 flex flex-wrap items-center gap-2.5 text-[10px]">
              <span className="flex items-center gap-1"><span className="text-[#e1306c]">◆</span> Insta</span>
              <span className="flex items-center gap-1"><span className="text-[#1877f2]">◆</span> Face</span>
              <span className="flex items-center gap-1"><span className="text-[#4285f4]">◆</span> Google</span>
              <span className="flex items-center gap-1"><span className="text-[#10b981]">◆</span> Indicação</span>
              <span className="flex items-center gap-1"><span className="text-[#6366f1]">◆</span> Balcão</span>
            </div>
          </CardContent>
        </Card>

        {/* Detalhes do Lead */}
        <div className="space-y-3 flex flex-col">
          {activeItemDetail ? (
            <Card className="rounded-2xl border shadow-xs bg-card p-4 space-y-3">
              <div className="flex items-start justify-between pb-2 border-b">
                <div>
                  <Badge variant="outline" className="text-[10px] font-bold mb-1">
                    ◆ {activeItemDetail.channel}
                  </Badge>
                  <h3 className="text-base font-bold text-foreground">
                    {activeItemDetail.clientName}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {activeItemDetail.city} ({activeItemDetail.uf}) • {activeItemDetail.distanceKm === 0 ? 'Local' : `${activeItemDetail.distanceKm} km`}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold font-mono text-emerald-600 block">
                    {formatCurrencyBRL(activeItemDetail.valor)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">▲ Faturado</span>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-muted/30 border text-xs space-y-1">
                <div>Modelo: <strong className="text-foreground">{activeItemDetail.model}</strong></div>
                <div>Polo: <strong className="text-foreground">{activeItemDetail.hubName}</strong></div>
                <div>Origem: <strong className="text-foreground">{activeItemDetail.rawMapping}</strong></div>
                <div>Data: <strong className="text-foreground">{activeItemDetail.dateStr}</strong></div>
              </div>
            </Card>
          ) : (
            <Card className="rounded-2xl border shadow-xs p-5 text-center text-muted-foreground text-xs">
              Clique em um ponto no radar para inspecionar os detalhes do comprador.
            </Card>
          )}

          {/* Placar Compacto */}
          <Card className="rounded-2xl border shadow-xs p-3.5 space-y-2 flex-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Conversões por Canal
            </h4>
            <div className="space-y-2">
              {channelStats.map((c) => (
                <div key={c.channelName} className="space-y-0.5 text-xs">
                  <div className="flex justify-between font-semibold">
                    <span className="text-foreground">◆ {c.channelName}</span>
                    <span className="font-mono text-muted-foreground">{c.count} ({c.pct.toFixed(0)}%)</span>
                  </div>
                  <Progress value={c.pct} className="h-1 bg-muted" />
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default MarketingLeadRadiusMap;
