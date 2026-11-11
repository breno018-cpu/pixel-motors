import { useMemo, useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import brazilStatesGeoJson from '@/lib/geo/brazil-states.json';
import mgCitiesGeoJson from '@/lib/geo/mg-cities.json';
import {
  MapPin,
  Navigation,
  Building2,
  Maximize2,
  Minimize2,
  Globe2,
  Truck,
  Route,
  ExternalLink,
  Map as MapIcon,
  KeyRound,
  Bike,
  UserCheck,
  RotateCcw,
  BadgeCheck,
  CircleDot,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  CITY_COORDINATES,
  MG_REFERENCE_CITIES,
  normalizeCityKey as normalizeCityName,
  resolveCityCoordinates,
  isMontesClarosRegion,
  haversineDistanceKm,
  calculateDeliveryRoute,
  DeliveryRouteEstimate,
  MAP_API_KEY,
  getMapTileUrl,
  buildLowPolyHubMarkerHtml,
  buildLowPolyCityMarkerHtml,
} from '@/lib/geoCoordinates';

export interface GeographicSalesRadiusMapProps {
  sales: Array<{
    id: string;
    cliente?: string;
    regiao?: string;
    valor?: number;
    modelo?: string;
    vendedor?: string;
    dateStr?: string;
    store_id?: string;
    store_name?: string;
  }>;
  referenceStoreCity?: string;
  storeName?: string;
}

export function GeographicSalesRadiusMap({
  sales = [],
  referenceStoreCity = 'Divinópolis',
}: GeographicSalesRadiusMapProps) {
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [hubFilter, setHubFilter] = useState<'all' | 'montesclaros' | 'divinopolis'>('all');
  const [sellerFilter, setSellerFilter] = useState<string>('all');
  const [modelFilter, setModelFilter] = useState<string>('all');
  const [radiusFilter, setRadiusFilter] = useState<string>('all');
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [mapStyle, setMapStyle] = useState<'streets' | 'dark' | 'clean'>('streets');
  const [showRefLabels, setShowRefLabels] = useState<boolean>(false);
  const [showRoutes, setShowRoutes] = useState<boolean>(true);
  const [showRadiusCircles, setShowRadiusCircles] = useState<boolean>(false);

  // Sincroniza filtro inicial caso referenceStoreCity mude
  useEffect(() => {
    const norm = normalizeCityName(referenceStoreCity);
    if (norm.includes('MONTES CLAROS') || norm === 'MOC') {
      setHubFilter('montesclaros');
    }
  }, [referenceStoreCity]);

  // Lista dinâmica de vendedores
  const availableSellers = useMemo(() => {
    const set = new Set<string>();
    sales.forEach((s) => {
      if (s.vendedor && s.vendedor.trim()) set.add(s.vendedor.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [sales]);

  // Lista dinâmica de modelos de motos
  const availableModels = useMemo(() => {
    const set = new Set<string>();
    sales.forEach((s) => {
      if (s.modelo && s.modelo.trim()) set.add(s.modelo.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [sales]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (hubFilter !== 'all') count++;
    if (sellerFilter !== 'all') count++;
    if (modelFilter !== 'all') count++;
    if (radiusFilter !== 'all') count++;
    return count;
  }, [hubFilter, sellerFilter, modelFilter, radiusFilter]);

  const resetFilters = () => {
    setHubFilter('all');
    setSellerFilter('all');
    setModelFilter('all');
    setRadiusFilter('all');
    setSelectedCity(null);
  };

  // Definição das 2 Concessionárias Centrais
  const DEALERSHIP_HUBS = useMemo(
    () => [
      {
        id: 'store-divinopolis',
        key: 'divinopolis' as const,
        name: 'Concessionária Divinópolis (Matriz Oeste)',
        shortName: 'Polo Divinópolis',
        city: 'DIVINOPOLIS',
        displayCity: 'Divinópolis',
        uf: 'MG',
        lat: -20.1444,
        lng: -44.8872,
        color: '#2563eb',
        accentLight: '#60a5fa',
        accentDark: '#1e3a8a',
      },
      {
        id: 'store-montesclaros',
        key: 'montesclaros' as const,
        name: 'Concessionária Montes Claros (Polo Norte)',
        shortName: 'Polo Montes Claros',
        city: 'MONTES CLAROS',
        displayCity: 'Montes Claros',
        uf: 'MG',
        lat: -16.7282,
        lng: -43.8644,
        color: '#dc2626',
        accentLight: '#f87171',
        accentDark: '#7f1d1d',
      },
    ],
    []
  );

  // Agrupamento de Vendas Reais por Cidade com atribuição rigorosa ao Polo Concessionário
  const allCityAnalytics = useMemo(() => {
    const stats: Record<
      string,
      {
        cityName: string;
        uf: string;
        microrregiao: string;
        rodovia: string;
        coords: { lat: number; lng: number };
        hubOrigin: (typeof DEALERSHIP_HUBS)[0];
        totalVendas: number;
        volumeTotal: number;
        ticketMedio: number;
        distanceKm: number;
        routeInfo: DeliveryRouteEstimate;
        clientes: string[];
        modelos: string[];
      }
    > = {};

    const filtered = sales.filter((s) => {
      if (sellerFilter !== 'all') {
        const v = (s.vendedor || '').toLowerCase();
        if (v !== sellerFilter.toLowerCase() && !v.includes(sellerFilter.toLowerCase())) return false;
      }
      if (modelFilter !== 'all') {
        const m = (s.modelo || '').toLowerCase();
        if (m !== modelFilter.toLowerCase() && !m.includes(modelFilter.toLowerCase())) return false;
      }
      return true;
    });

    filtered.forEach((s) => {
      // Atribuição canônica de Hub (respeita store_id da venda)
      let isMocAssigned = false;
      if (s.store_id === 'store-montesclaros') {
        isMocAssigned = true;
      } else if (s.store_id === 'store-divinopolis') {
        isMocAssigned = false;
      } else if ((s.store_name || '').toLowerCase().includes('montes')) {
        isMocAssigned = true;
      } else if ((s.store_name || '').toLowerCase().includes('divin')) {
        isMocAssigned = false;
      } else if (isMontesClarosRegion(s.regiao)) {
        isMocAssigned = true;
      }

      const assignedHub = isMocAssigned ? DEALERSHIP_HUBS[1] : DEALERSHIP_HUBS[0];
      const cityNorm = normalizeCityName(s.regiao || referenceStoreCity);
      const coord = resolveCityCoordinates(s.regiao || referenceStoreCity, assignedHub.lat, assignedHub.lng);
      const dist = haversineDistanceKm(assignedHub.lat, assignedHub.lng, coord.lat, coord.lng);

      // Filtro de Raio / Distância
      if (radiusFilter === '0-50' && dist > 50) return;
      if (radiusFilter === '50-150' && (dist <= 50 || dist > 150)) return;
      if (radiusFilter === '150-300' && (dist <= 150 || dist > 300)) return;
      if (radiusFilter === '300+' && dist <= 300) return;

      if (!stats[cityNorm]) {
        const routeInfo = calculateDeliveryRoute(
          assignedHub.lat,
          assignedHub.lng,
          coord.lat,
          coord.lng,
          cityNorm,
          2.8
        );

        stats[cityNorm] = {
          cityName: cityNorm,
          uf: coord.uf,
          microrregiao: coord.microrregiao || 'Regional',
          rodovia: coord.rodovia || routeInfo.highway,
          coords: { lat: coord.lat, lng: coord.lng },
          hubOrigin: assignedHub,
          totalVendas: 0,
          volumeTotal: 0,
          ticketMedio: 0,
          distanceKm: dist,
          routeInfo,
          clientes: [],
          modelos: [],
        };
      }

      stats[cityNorm].totalVendas += 1;
      stats[cityNorm].volumeTotal += Number(s.valor) || 0;
      if (s.cliente) stats[cityNorm].clientes.push(s.cliente);
      if (s.modelo) stats[cityNorm].modelos.push(s.modelo);
    });

    const list = Object.values(stats).map((item) => ({
      ...item,
      ticketMedio: item.totalVendas > 0 ? item.volumeTotal / item.totalVendas : 0,
    }));

    list.sort((a, b) => b.totalVendas - a.totalVendas || b.volumeTotal - a.volumeTotal);
    return list;
  }, [sales, referenceStoreCity, DEALERSHIP_HUBS, sellerFilter, modelFilter, radiusFilter]);

  // Filtra pelo Polo Selecionado
  const cityAnalytics = useMemo(() => {
    if (hubFilter === 'all') return allCityAnalytics;
    return allCityAnalytics.filter((c) => c.hubOrigin.key === hubFilter);
  }, [allCityAnalytics, hubFilter]);

  // Totais por Polo para exibir nos botões
  const hubTotals = useMemo(() => {
    const moc = allCityAnalytics
      .filter((c) => c.hubOrigin.key === 'montesclaros')
      .reduce((acc, c) => acc + c.totalVendas, 0);
    const div = allCityAnalytics
      .filter((c) => c.hubOrigin.key === 'divinopolis')
      .reduce((acc, c) => acc + c.totalVendas, 0);
    return { moc, div, total: moc + div };
  }, [allCityAnalytics]);

  // Instância do Leaflet Map
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const refCitiesLayerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!leafletMapRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [-18.45, -44.35],
        zoom: 6,
        zoomControl: true,
        attributionControl: false,
      });

      const tileLayer = L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        {
          maxZoom: 19,
          subdomains: 'abcd',
        }
      ).addTo(map);
      tileLayerRef.current = tileLayer;

      // 1. Polígonos dos Estados Brasileiros
      L.geoJSON(brazilStatesGeoJson as any, {
        style: (feature) => {
          const isMG =
            feature?.properties?.name === 'Minas Gerais' ||
            feature?.properties?.sigla === 'MG';
          return {
            fillColor: isMG ? '#2563eb' : '#64748b',
            fillOpacity: isMG ? 0.04 : 0.01,
            color: isMG ? '#2563eb' : '#94a3b8',
            weight: isMG ? 1.8 : 0.6,
            dashArray: isMG ? undefined : '4, 4',
          };
        },
      }).addTo(map);

      // 2. Malha Municipal IBGE de Minas Gerais
      L.geoJSON(mgCitiesGeoJson as any, {
        style: () => ({
          fillColor: '#3b82f6',
          fillOpacity: 0.01,
          color: '#64748b',
          weight: 0.35,
          opacity: 0.25,
        }),
        onEachFeature: (feature, layer) => {
          const cityName =
            feature?.properties?.name ||
            feature?.properties?.NM_MUN ||
            feature?.properties?.nome;
          if (cityName) {
            layer.bindTooltip(`&#9670; ${cityName} - MG`, {
              sticky: true,
              direction: 'top',
              opacity: 0.9,
            });
            layer.on({
              mouseover: (e: any) => {
                const l = e.target;
                l.setStyle({
                  weight: 1.5,
                  color: '#2563eb',
                  fillOpacity: 0.12,
                });
              },
              mouseout: (e: any) => {
                const l = e.target;
                l.setStyle({
                  weight: 0.35,
                  color: '#64748b',
                  fillOpacity: 0.01,
                });
              },
            });
          }
        },
      }).addTo(map);

      const refLayer = L.layerGroup().addTo(map);
      const layerGroup = L.layerGroup().addTo(map);

      leafletMapRef.current = map;
      refCitiesLayerRef.current = refLayer;
      markersLayerRef.current = layerGroup;

      // Garantir renderização imediata e em múltiplos ciclos após layout
      setTimeout(() => map.invalidateSize(), 50);
      setTimeout(() => map.invalidateSize(), 200);
      setTimeout(() => map.invalidateSize(), 500);
    }

    // Observer para re-renderizar automaticamente quando a aba se tornar visível ou mudar de tamanho
    const resizeObserver = new ResizeObserver(() => {
      if (leafletMapRef.current && mapContainerRef.current) {
        if (mapContainerRef.current.clientHeight > 0) {
          leafletMapRef.current.invalidateSize();
        }
      }
    });

    resizeObserver.observe(mapContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
        markersLayerRef.current = null;
        refCitiesLayerRef.current = null;
        tileLayerRef.current = null;
      }
    };
  }, []);

  // Alternar estilo do mapa
  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
      tileLayerRef.current = null;
    }

    const tileUrl =
      mapStyle === 'dark'
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

    const layer = L.tileLayer(tileUrl, {
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map);
    layer.bringToBack();
    tileLayerRef.current = layer;
  }, [mapStyle]);

  // Recalcular dimensões ao expandir/contrair
  useEffect(() => {
    const timer = setTimeout(() => {
      leafletMapRef.current?.invalidateSize();
    }, 180);
    return () => clearTimeout(timer);
  }, [isExpanded]);

  // Renderizar Rótulos de Cidades de Referência (Discretos)
  useEffect(() => {
    const refLayer = refCitiesLayerRef.current;
    if (!refLayer) return;
    refLayer.clearLayers();

    if (!showRefLabels) return;

    const activeSalesCityKeys = new Set(cityAnalytics.map((c) => c.cityName));

    MG_REFERENCE_CITIES.forEach((refCity) => {
      const cityKey = normalizeCityName(refCity.name);
      if (activeSalesCityKeys.has(cityKey)) return;
      if (cityKey === 'DIVINOPOLIS' || cityKey === 'MONTES CLAROS') return;

      const labelHtml = `
        <div style="
          display: flex;
          align-items: center;
          gap: 3px;
          pointer-events: none;
          transform: translate(-50%, -50%);
        ">
          <span style="font-size: 8px; color: #64748b;">&#9670;</span>
          <span style="
            font-size: 8.5px;
            font-weight: 700;
            color: ${mapStyle === 'dark' ? '#cbd5e1' : '#334155'};
            white-space: nowrap;
          ">${refCity.name}</span>
        </div>
      `;

      const icon = L.divIcon({
        html: labelHtml,
        className: 'mg-ref-city-label',
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      L.marker([refCity.lat, refCity.lng], { icon, interactive: false }).addTo(refLayer);
    });
  }, [showRefLabels, cityAnalytics, mapStyle]);

  // Renderizar Raios, Polos, Rotas e Marcadores Low-Poly
  useEffect(() => {
    const map = leafletMapRef.current;
    const layerGroup = markersLayerRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();

    const hubsToRender =
      hubFilter === 'all'
        ? DEALERSHIP_HUBS
        : DEALERSHIP_HUBS.filter((h) => h.key === hubFilter);

    // Círculos de Raio Geográfico com Diâmetros Métricos Exatos (Exibidos apenas quando o usuário ativar)
    if (showRadiusCircles) {
      const circles = [
        { radiusMeters: 50000, label: 'Raio 50 km • Diâmetro 100 km (Local)', color: '#10b981' },
        { radiusMeters: 150000, label: 'Raio 150 km • Diâmetro 300 km (Regional)', color: '#3b82f6' },
        { radiusMeters: 300000, label: 'Raio 300 km • Diâmetro 600 km (Expandido)', color: '#8b5cf6' },
      ];

      hubsToRender.forEach((hub) => {
        circles.forEach((c) => {
          const circle = L.circle([hub.lat, hub.lng], {
            radius: c.radiusMeters,
            color: hub.key === 'montesclaros' && c.radiusMeters === 50000 ? '#ef4444' : c.color,
            weight: 1.2,
            dashArray: '4, 5',
            fillOpacity: 0.02,
          });
          circle.bindTooltip(`${hub.shortName}: ${c.label}`, {
            sticky: true,
            direction: 'top',
            className: 'leaflet-muni-tooltip',
          });
          layerGroup.addLayer(circle);
        });
      });
    }

    // Marcadores Low-Poly Hexagonais dos Polos
    DEALERSHIP_HUBS.forEach((hub) => {
      const hubCityStats = allCityAnalytics.find((c) => c.cityName === hub.city);
      const hubSalesCount = hubCityStats?.totalVendas || 0;
      const hubVolume = hubCityStats?.volumeTotal || 0;
      const isSelected = selectedCity === hub.city;

      const hubIcon = L.divIcon({
        html: buildLowPolyHubMarkerHtml({
          cityLabel: `${hub.city} (${hubSalesCount})`,
          localCount: hubSalesCount,
          color: hub.color,
          accentLight: hub.accentLight,
          accentDark: hub.accentDark,
          isSelected,
        }),
        className: 'custom-hub-pin',
        iconSize: [44, 44],
        iconAnchor: [22, 22],
        popupAnchor: [0, -22],
      });

      const hubMarker = L.marker([hub.lat, hub.lng], { icon: hubIcon, zIndexOffset: 1000 });
      hubMarker.bindTooltip(
        `<div style="font-size: 11px; padding: 2px 4px;">
          <strong>&#9672; ${hub.name}</strong><br/>
          <span>Vendas locais: <strong>${hubSalesCount} un.</strong></span><br/>
          <span>Volume: ${hubVolume.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
        </div>`,
        { direction: 'top', offset: [0, -18] }
      );
      hubMarker.on('click', () => {
        setSelectedCity(selectedCity === hub.city ? null : hub.city);
      });
      layerGroup.addLayer(hubMarker);
    });

    // Marcadores Low-Poly Losango para Cidades Satélites
    const bounds = L.latLngBounds(hubsToRender.map((h) => L.latLng(h.lat, h.lng)));

    cityAnalytics.forEach((city) => {
      bounds.extend([city.coords.lat, city.coords.lng]);

      if (city.cityName === 'DIVINOPOLIS' || city.cityName === 'MONTES CLAROS') {
        return;
      }

      const isSelected = selectedCity === city.cityName;
      const hub = city.hubOrigin;

      if (showRoutes) {
        const polyline = L.polyline(city.routeInfo.waypoints, {
          color: isSelected ? '#f59e0b' : hub.color,
          weight: isSelected ? 3 : 1.8,
          dashArray: isSelected ? undefined : '5, 5',
          opacity: isSelected ? 0.95 : 0.65,
        });
        layerGroup.addLayer(polyline);
      }

      const bgColor = city.hubOrigin.key === 'montesclaros' ? '#dc2626' : '#2563eb';

      const markerIcon = L.divIcon({
        html: buildLowPolyCityMarkerHtml({
          cityName: city.cityName,
          count: city.totalVendas,
          bgColor,
          isSelected,
        }),
        className: 'custom-city-pin',
        iconSize: [30, 48],
        iconAnchor: [15, 38],
        popupAnchor: [0, -38],
      });

      const marker = L.marker([city.coords.lat, city.coords.lng], {
        icon: markerIcon,
        zIndexOffset: isSelected ? 900 : 400,
      });

      marker.bindTooltip(
        `<div style="font-size: 11px; padding: 2px 4px;">
          <strong>&#9670; ${city.cityName} (${city.uf})</strong><br/>
          <span><strong>${city.totalVendas} un.</strong> • ${city.routeInfo.roadKm} km (${city.routeInfo.formattedDuration})</span>
        </div>`,
        { direction: 'top', offset: [0, -14] }
      );

      marker.on('click', () => {
        setSelectedCity(city.cityName === selectedCity ? null : city.cityName);
      });

      layerGroup.addLayer(marker);
    });

    if (cityAnalytics.length > 0) {
      try {
        if (bounds.isValid() && mapContainerRef.current && mapContainerRef.current.clientHeight > 0) {
          map.fitBounds(bounds, { padding: [40, 40], maxZoom: 9 });
        }
      } catch (e) {
        console.warn('fitBounds error:', e);
      }
    }
  }, [cityAnalytics, allCityAnalytics, hubFilter, selectedCity, showRoutes, showRadiusCircles, DEALERSHIP_HUBS]);

  const handleResetCenter = () => {
    const map = leafletMapRef.current;
    if (!map) return;
    map.invalidateSize();
    const hubsToRender =
      hubFilter === 'all' ? DEALERSHIP_HUBS : DEALERSHIP_HUBS.filter((h) => h.key === hubFilter);
    const bounds = L.latLngBounds(hubsToRender.map((h) => L.latLng(h.lat, h.lng)));
    cityAnalytics.forEach((city) => {
      bounds.extend([city.coords.lat, city.coords.lng]);
    });
    try {
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 9 });
      } else {
        map.setView([-18.45, -44.35], 6);
      }
    } catch {
      map.setView([-18.45, -44.35], 6);
    }
  };

  const handleQuickZoom = (target: 'all' | 'moc' | 'div') => {
    const map = leafletMapRef.current;
    if (!map) return;
    if (target === 'moc') {
      setHubFilter('montesclaros');
      map.setView([-16.7282, -43.8644], 8, { animate: true });
    } else if (target === 'div') {
      setHubFilter('divinopolis');
      map.setView([-20.1444, -44.8872], 8, { animate: true });
    } else {
      setHubFilter('all');
      map.setView([-18.45, -44.35], 6, { animate: true });
    }
  };

  const selectedCityObj = useMemo(
    () => allCityAnalytics.find((c) => c.cityName === selectedCity) || null,
    [allCityAnalytics, selectedCity]
  );

  return (
    <div className="space-y-4">
      {/* Header Compacto com Expo Glass */}
      <Card className="rounded-2xl border shadow-xs expo-glass-card">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base md:text-lg font-bold text-foreground flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-primary" />
                  Raios de Vendas & Rotas de Saída
                </h3>
                <Badge variant="outline" className="text-[10px] font-mono px-2 py-0 border-white/20 dark:border-white/10">
                  ◆ MOC: {hubTotals.moc}
                </Badge>
                <Badge variant="outline" className="text-[10px] font-mono px-2 py-0 border-white/20 dark:border-white/10">
                  ◆ DIV: {hubTotals.div}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Visualização limpa com marcadores geométricos de baixa densidade (30km, 80km, 150km).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                size="sm"
                variant={hubFilter === 'all' ? 'default' : 'glass'}
                onClick={() => handleQuickZoom('all')}
                className="h-7 text-xs font-semibold rounded-lg"
              >
                ◆ 2 Polos ({hubTotals.total})
              </Button>
              <Button
                size="sm"
                variant={hubFilter === 'montesclaros' ? 'default' : 'glass'}
                onClick={() => handleQuickZoom('moc')}
                className={cn(
                  'h-7 text-xs font-semibold rounded-lg',
                  hubFilter === 'montesclaros'
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'text-red-600 border-red-500/30'
                )}
              >
                ▲ MOC ({hubTotals.moc})
              </Button>
              <Button
                size="sm"
                variant={hubFilter === 'divinopolis' ? 'default' : 'glass'}
                onClick={() => handleQuickZoom('div')}
                className={cn(
                  'h-7 text-xs font-semibold rounded-lg',
                  hubFilter === 'divinopolis'
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'text-blue-600 border-blue-500/30'
                )}
              >
                ▲ DIV ({hubTotals.div})
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const map = leafletMapRef.current;
                  if (!map || cityAnalytics.length === 0) return;
                  const pts = cityAnalytics.map((c) => L.latLng(c.coords.lat, c.coords.lng));
                  DEALERSHIP_HUBS.forEach((h) => pts.push(L.latLng(h.lat, h.lng)));
                  map.flyToBounds(L.latLngBounds(pts), { padding: [50, 50], maxZoom: 10, duration: 0.8 });
                }}
                className="h-7 text-xs font-semibold rounded-lg border-primary/30 text-primary hover:bg-primary/10 gap-1"
                title="Enquadrar todos os pontos e rotas de entrega na tela"
              >
                <Navigation className="w-3 h-3" />
                Centralizar Pontos
              </Button>
            </div>
          </div>

          {/* Controles de Camadas com Expo Glass */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-border/50">
            <div className="flex items-center expo-glass-bar p-0.5 rounded-lg border border-white/20 dark:border-white/10 gap-0.5">
              <button
                type="button"
                onClick={() => setMapStyle('streets')}
                className={cn(
                  'px-2 py-0.5 rounded text-[11px] font-semibold transition-colors',
                  mapStyle === 'streets' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                )}
              >
                ◇ Rodoviário
              </button>
              <button
                type="button"
                onClick={() => setMapStyle('dark')}
                className={cn(
                  'px-2 py-0.5 rounded text-[11px] font-semibold transition-colors',
                  mapStyle === 'dark' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                )}
              >
                ◆ Escuro
              </button>
              <button
                type="button"
                onClick={() => setMapStyle('clean')}
                className={cn(
                  'px-2 py-0.5 rounded text-[11px] font-semibold transition-colors',
                  mapStyle === 'clean' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                )}
              >
                ◈ Vetorial
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                size="sm"
                variant={showRoutes ? 'default' : 'glass'}
                onClick={() => setShowRoutes((v) => !v)}
                className={cn(
                  "h-6 text-[11px] px-2 rounded-md font-semibold transition-all",
                  showRoutes && "bg-primary text-white shadow-xs"
                )}
              >
                <Route className={cn("w-3 h-3 mr-1", showRoutes ? "text-white" : "text-primary")} /> Rotas
              </Button>
              <Button
                type="button"
                size="sm"
                variant={showRadiusCircles ? 'default' : 'glass'}
                onClick={() => setShowRadiusCircles((v) => !v)}
                className={cn(
                  "h-6 text-[11px] px-2 rounded-md font-semibold transition-all",
                  showRadiusCircles && "bg-primary text-white shadow-xs"
                )}
                title="Exibir círculos de raio geográfico (50km, 150km, 300km)"
              >
                <CircleDot className={cn("w-3 h-3 mr-1", showRadiusCircles ? "text-white" : "text-primary")} /> Raios
              </Button>
              <Button
                type="button"
                size="sm"
                variant={showRefLabels ? 'default' : 'glass'}
                onClick={() => setShowRefLabels((v) => !v)}
                className={cn(
                  "h-6 text-[11px] px-2 rounded-md font-semibold transition-all",
                  showRefLabels && "bg-primary text-white shadow-xs"
                )}
              >
                <MapIcon className={cn("w-3 h-3 mr-1", showRefLabels ? "text-white" : "text-primary")} /> Nomes Extras
              </Button>
              <Button
                type="button"
                size="sm"
                variant="glass"
                onClick={handleResetCenter}
                className="h-6 text-[11px] px-2 rounded-md font-semibold text-primary"
                title="Recalcular e centralizar todos os pontos"
              >
                <RotateCcw className="w-3 h-3 mr-1 text-primary" /> Centralizar
              </Button>
              <Button
                type="button"
                size="sm"
                variant="glass"
                onClick={() => setIsExpanded((v) => !v)}
                className="h-6 text-[11px] px-2 rounded-md font-semibold"
              >
                {isExpanded ? <Minimize2 className="w-3 h-3 mr-1 text-primary" /> : <Maximize2 className="w-3 h-3 mr-1 text-primary" />}
                {isExpanded ? 'Reduzir' : 'Expandir'}
              </Button>
            </div>
          </div>

          {/* Linha 2 de Filtros Interativos do Mapa */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/40 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              {/* Filtro de Vendedor */}
              <Select value={sellerFilter} onValueChange={setSellerFilter}>
                <SelectTrigger className="w-[155px] h-7 text-xs btn-glass font-medium rounded-lg">
                  <UserCheck className="w-3 h-3 mr-1 text-primary" />
                  <SelectValue placeholder="Vendedor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">Todos os Vendedores</SelectItem>
                  {availableSellers.map((v) => (
                    <SelectItem key={v} value={v} className="text-xs">
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Filtro de Modelo */}
              <Select value={modelFilter} onValueChange={setModelFilter}>
                <SelectTrigger className="w-[155px] h-7 text-xs btn-glass font-medium rounded-lg">
                  <Bike className="w-3 h-3 mr-1 text-primary" />
                  <SelectValue placeholder="Modelo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">Todos os Modelos</SelectItem>
                  {availableModels.map((m) => (
                    <SelectItem key={m} value={m} className="text-xs">
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Filtro de Raio */}
              <Select value={radiusFilter} onValueChange={setRadiusFilter}>
                <SelectTrigger className="w-[140px] h-7 text-xs btn-glass font-medium rounded-lg">
                  <Navigation className="w-3 h-3 mr-1 text-primary" />
                  <SelectValue placeholder="Raio" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">Todas as Distâncias</SelectItem>
                  <SelectItem value="0-50" className="text-xs">Até 50 km (Local)</SelectItem>
                  <SelectItem value="50-150" className="text-xs">50 a 150 km</SelectItem>
                  <SelectItem value="150-300" className="text-xs">150 a 300 km</SelectItem>
                  <SelectItem value="300+" className="text-xs">Mais de 300 km</SelectItem>
                </SelectContent>
              </Select>

              {activeFiltersCount > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={resetFilters}
                  className="h-7 text-[11px] px-2 text-muted-foreground hover:text-foreground font-semibold gap-1 rounded-lg"
                  title="Redefinir filtros do mapa"
                >
                  <RotateCcw className="w-3 h-3 text-amber-500" />
                  Limpar ({activeFiltersCount})
                </Button>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium">
              <span className="font-bold text-foreground">{cityAnalytics.length}</span> cidades filtradas
              <span>•</span>
              <span className="font-bold text-foreground">
                {cityAnalytics.reduce((acc, c) => acc + c.totalVendas, 0)}
              </span> unidades
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grid Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className={cn(isExpanded ? 'lg:col-span-12' : 'lg:col-span-8')}>
          <Card className="rounded-2xl border shadow-xs overflow-hidden flex flex-col">
            <CardContent className="p-2.5 flex-1 flex flex-col">
              <div
                className={cn(
                  'relative w-full rounded-xl overflow-hidden border border-border/50 transition-all duration-300',
                  isExpanded ? 'h-[680px]' : 'h-[520px]'
                )}
              >
                <div
                  ref={mapContainerRef}
                  className="w-full h-full relative z-0"
                  style={{ minHeight: isExpanded ? '680px' : '520px', width: '100%' }}
                />

                {/* Legenda Discreta */}
                <div className="absolute bottom-4 right-4 z-[400] max-w-[calc(100%-2rem)] overflow-hidden bg-card/90 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-border/70 text-[10px] space-y-1 shadow-xs">
                  <div className="flex items-center gap-1.5 font-semibold text-foreground">
                    <span className="text-red-600">⬢</span> Polo Montes Claros
                  </div>
                  <div className="flex items-center gap-1.5 font-semibold text-foreground">
                    <span className="text-blue-600">⬢</span> Polo Divinópolis
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="text-primary">◆</span> Cidades Atendidas
                  </div>
                </div>
              </div>

              {selectedCityObj && (
                <div className="mt-2.5 p-3 rounded-xl bg-muted/40 border flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div>
                    <span className="font-bold text-foreground">
                      ◆ {selectedCityObj.cityName} ({selectedCityObj.uf})
                    </span>{' '}
                    • <span className="text-muted-foreground">{selectedCityObj.totalVendas} un. faturadas</span> •{' '}
                    <span className="text-muted-foreground">
                      {selectedCityObj.routeInfo.roadKm} km via {selectedCityObj.rodovia}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
                        selectedCityObj.hubOrigin.displayCity + ', MG'
                      )}&destination=${encodeURIComponent(
                        selectedCityObj.cityName + ', ' + selectedCityObj.uf
                      )}&travelmode=driving`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                    >
                      Rota no Maps <ExternalLink className="w-3 h-3" />
                    </a>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs px-1.5"
                      onClick={() => setSelectedCity(null)}
                    >
                      Fechar
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Tabela Lateral Limpa */}
        <div className={cn(isExpanded ? 'lg:col-span-12' : 'lg:col-span-4')}>
          <Card className="rounded-2xl border shadow-xs">
            <CardHeader className="py-3 px-4 border-b bg-muted/10">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Ranking de Vendas por Município
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 max-h-[480px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/20">
                    <TableHead className="text-xs">Cidade</TableHead>
                    <TableHead className="text-xs text-center">Dist.</TableHead>
                    <TableHead className="text-xs text-center">Un.</TableHead>
                    <TableHead className="text-xs text-right">Volume</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cityAnalytics.map((city, idx) => (
                    <TableRow
                      key={city.cityName}
                      className={cn(
                        'cursor-pointer transition-colors text-xs',
                        selectedCity === city.cityName && 'bg-primary/10 font-semibold'
                      )}
                      onClick={() => {
                        setSelectedCity(selectedCity === city.cityName ? null : city.cityName);
                        leafletMapRef.current?.setView([city.coords.lat, city.coords.lng], 9, {
                          animate: true,
                        });
                      }}
                    >
                      <TableCell className="py-2">
                        <span className="font-semibold text-foreground">
                          ◆ {city.cityName}
                        </span>
                        <span className="block text-[10px] text-muted-foreground">
                          {city.hubOrigin.shortName}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-center font-mono py-2">
                        {city.distanceKm === 0 ? 'Sede' : `${city.routeInfo.roadKm} km`}
                      </TableCell>
                      <TableCell className="text-xs text-center font-bold font-mono py-2">
                        {city.totalVendas}
                      </TableCell>
                      <TableCell className="text-xs text-right font-mono text-foreground py-2">
                        {city.volumeTotal.toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                          maximumFractionDigits: 0,
                        })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default GeographicSalesRadiusMap;
