import { useState, useMemo, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import brazilStatesGeoJson from '@/lib/geo/brazil-states.json';
import mgCitiesGeoJson from '@/lib/geo/mg-cities.json';
import {
  CITY_COORDINATES,
  MG_REFERENCE_CITIES,
  normalizeCityKey,
  resolveCityCoordinates,
  isMontesClarosRegion,
  calculateDeliveryRoute,
  DeliveryRouteEstimate,
  MAP_API_KEY,
  getMapTileUrl,
  buildLowPolyHubMarkerHtml,
  buildLowPolyCityMarkerHtml,
} from '@/lib/geoCoordinates';
import {
  Globe2,
  Calendar,
  MapPin,
  Navigation,
  DollarSign,
  Bike,
  Maximize2,
  Minimize2,
  Building2,
  Truck,
  Route,
  Clock,
  ExternalLink,
  KeyRound,
  UserCheck,
  BadgeCheck,
  RotateCcw,
  SlidersHorizontal,
  CircleDot,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { formatCurrencyBRL } from '@/lib/dealershipSheetParser';
import {
  TRANSPORT_LOGISTICS_METHODS,
  calculateFreightCost,
  type TransportLogisticsMethod,
} from '@/lib/transportLogistics';

export interface MonthlyCitySalesMapProps {
  sales?: Array<{
    id: string;
    date?: Date;
    dateStr?: string;
    vendedor?: string;
    modelo?: string;
    cliente?: string;
    regiao?: string;
    valor?: number;
    financiamento?: number;
    banco?: string;
    lead_mapping?: string;
    is_permitted?: boolean;
    source?: string;
    store_id?: string;
    store_name?: string;
  }>;
  baseCity?: string;
  selectedStoreId?: string;
}

export function MonthlyCitySalesMap({
  sales = [],
  baseCity = 'Divinópolis',
  selectedStoreId = 'all',
}: MonthlyCitySalesMapProps) {
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedSeller, setSelectedSeller] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedModel, setSelectedModel] = useState<string>('all');
  const [selectedRadius, setSelectedRadius] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'all_mg' | 'moc_north' | 'div_west' | 'brazil'>('all_mg');
  const [mapOperationMode, setMapOperationMode] = useState<'sales_and_routes' | 'delivery_logistics'>('sales_and_routes');
  const [mapTileStyle, setMapTileStyle] = useState<'road_voyager' | 'dark_radar' | 'ibge_vector'>('road_voyager');
  const [isMapExpanded, setIsMapExpanded] = useState<boolean>(false);
  // Desativado por padrão para manter o mapa limpo (sem poluição visual)
  const [showAllCityLabels, setShowAllCityLabels] = useState<boolean>(false);
  const [showRadiusCircles, setShowRadiusCircles] = useState<boolean>(false);
  const [freightRatePerKm, setFreightRatePerKm] = useState<number>(1.95);
  const [selectedLogisticsMethod, setSelectedLogisticsMethod] = useState<string>('cegonha_coletiva');
  const [selectedCityDetail, setSelectedCityDetail] = useState<string | null>(null);
  const [activeStoreFilter, setActiveStoreFilter] = useState<string>('all');

  useEffect(() => {
    if (!selectedStoreId || selectedStoreId === 'all') {
      setActiveStoreFilter('all');
    } else if (
      selectedStoreId === 'store-montesclaros' ||
      selectedStoreId.toLowerCase().includes('montes') ||
      selectedStoreId.toLowerCase().includes('moc')
    ) {
      setActiveStoreFilter('store-montesclaros');
    } else if (
      selectedStoreId === 'store-divinopolis' ||
      selectedStoreId.toLowerCase().includes('divin')
    ) {
      setActiveStoreFilter('store-divinopolis');
    } else {
      const k = normalizeCityKey(baseCity);
      if (k === 'MONTES CLAROS') setActiveStoreFilter('store-montesclaros');
      else setActiveStoreFilter('all');
    }
  }, [selectedStoreId, baseCity]);

  const activeLogisticsMethod = useMemo(
    () =>
      TRANSPORT_LOGISTICS_METHODS.find((m) => m.id === selectedLogisticsMethod) ||
      TRANSPORT_LOGISTICS_METHODS[0],
    [selectedLogisticsMethod]
  );

  useEffect(() => {
    const m = TRANSPORT_LOGISTICS_METHODS.find((item) => item.id === selectedLogisticsMethod);
    if (m) {
      setFreightRatePerKm(m.tarifaBaseKm);
    }
  }, [selectedLogisticsMethod]);

  const DEALERSHIP_HUBS = useMemo(
    () => [
      {
        id: 'store-divinopolis',
        name: 'Concessionária Divinópolis (Matriz Oeste)',
        shortName: 'Polo Divinópolis',
        city: 'Divinópolis',
        cityKey: 'DIVINOPOLIS',
        uf: 'MG',
        lat: -20.1444,
        lng: -44.8872,
        color: '#2563eb',
        accentLight: '#60a5fa',
        accentDark: '#1e3a8a',
        badge: 'Matriz Oeste',
      },
      {
        id: 'store-montesclaros',
        name: 'Concessionária Montes Claros (Polo Norte)',
        shortName: 'Polo Montes Claros',
        city: 'Montes Claros',
        cityKey: 'MONTES CLAROS',
        uf: 'MG',
        lat: -16.7282,
        lng: -43.8644,
        color: '#dc2626',
        accentLight: '#f87171',
        accentDark: '#7f1d1d',
        badge: 'Polo Norte',
      },
    ],
    [],
  );

  const availableMonths = useMemo(() => {
    const monthsMap = new Map<string, { key: string; label: string; count: number }>();

    (sales || []).forEach((s) => {
      let key = '';
      if (s.date && s.date instanceof Date && !isNaN(s.date.getTime())) {
        const y = s.date.getFullYear();
        const m = String(s.date.getMonth() + 1).padStart(2, '0');
        key = `${y}-${m}`;
      } else if (s.dateStr && s.dateStr.includes('/')) {
        const parts = s.dateStr.split('/');
        if (parts.length === 3) key = `${parts[2]}-${parts[1].padStart(2, '0')}`;
      }

      if (key) {
        const parts = key.split('-');
        const year = parts[0];
        const monthNum = parseInt(parts[1], 10);
        const monthNames = [
          'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
          'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
        ];
        const label = `${monthNames[monthNum - 1] || 'Mês'} / ${year}`;

        const existing = monthsMap.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          monthsMap.set(key, { key, label, count: 1 });
        }
      }
    });

    return Array.from(monthsMap.values()).sort((a, b) => b.key.localeCompare(a.key));
  }, [sales]);

  // Lista dinâmica de vendedores das vendas carregadas
  const availableSellers = useMemo(() => {
    const map = new Map<string, number>();
    (sales || []).forEach((s) => {
      const v = (s.vendedor || '').trim();
      if (v) map.set(v, (map.get(v) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [sales]);

  // Lista dinâmica de modelos de veículos das vendas carregadas
  const availableModels = useMemo(() => {
    const map = new Map<string, number>();
    (sales || []).forEach((s) => {
      const m = (s.modelo || '').trim();
      if (m) map.set(m, (map.get(m) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [sales]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (activeStoreFilter !== 'all') count++;
    if (selectedMonth !== 'all') count++;
    if (selectedSeller !== 'all') count++;
    if (selectedStatus !== 'all') count++;
    if (selectedModel !== 'all') count++;
    if (selectedRadius !== 'all') count++;
    if (selectedLogisticsMethod !== 'cegonha_coletiva') count++;
    return count;
  }, [activeStoreFilter, selectedMonth, selectedSeller, selectedStatus, selectedModel, selectedRadius, selectedLogisticsMethod]);

  const resetAllFilters = () => {
    setActiveStoreFilter('all');
    setSelectedMonth('all');
    setSelectedSeller('all');
    setSelectedStatus('all');
    setSelectedModel('all');
    setSelectedRadius('all');
    setSelectedLogisticsMethod('cegonha_coletiva');
    setSelectedCityDetail(null);
  };

  const monthFilteredSales = useMemo(() => {
    let list = sales || [];

    // 1. Filtro rigoroso de Polo / Concessionária (sem reatribuição falsa)
    if (activeStoreFilter !== 'all') {
      list = list.filter((s) => {
        let isMoc = false;
        if (s.store_id === 'store-montesclaros') isMoc = true;
        else if (s.store_id === 'store-divinopolis') isMoc = false;
        else if ((s.store_name || '').toLowerCase().includes('montes')) isMoc = true;
        else if ((s.store_name || '').toLowerCase().includes('divin')) isMoc = false;
        else isMoc = isMontesClarosRegion(s.regiao);

        return activeStoreFilter === 'store-montesclaros' ? isMoc : !isMoc;
      });
    }

    // 2. Filtro de Mês / Competência
    if (selectedMonth !== 'all') {
      list = list.filter((s) => {
        let key = '';
        if (s.date && s.date instanceof Date && !isNaN(s.date.getTime())) {
          const y = s.date.getFullYear();
          const m = String(s.date.getMonth() + 1).padStart(2, '0');
          key = `${y}-${m}`;
        } else if (s.dateStr && s.dateStr.includes('/')) {
          const parts = s.dateStr.split('/');
          if (parts.length === 3) key = `${parts[2]}-${parts[1].padStart(2, '0')}`;
        }
        return key === selectedMonth;
      });
    }

    // 3. Filtro de Vendedor
    if (selectedSeller !== 'all') {
      const target = selectedSeller.toLowerCase().trim();
      list = list.filter((s) => {
        const v = (s.vendedor || '').toLowerCase().trim();
        return v === target || v.includes(target);
      });
    }

    // 4. Filtro de Status da Venda
    if (selectedStatus === 'entregue') {
      list = list.filter((s) => s.is_permitted !== false);
    } else if (selectedStatus === 'em_rota') {
      list = list.filter((s) => s.is_permitted === false);
    }

    // 5. Filtro de Modelo do Veículo
    if (selectedModel !== 'all') {
      const target = selectedModel.toLowerCase().trim();
      list = list.filter((s) => {
        const m = (s.modelo || '').toLowerCase().trim();
        return m === target || m.includes(target);
      });
    }

    return list;
  }, [sales, activeStoreFilter, selectedMonth, selectedSeller, selectedStatus, selectedModel]);

  const activeHub = useMemo(() => {
    if (activeStoreFilter === 'store-montesclaros' || viewMode === 'moc_north') {
      return DEALERSHIP_HUBS[1];
    }
    if (activeStoreFilter === 'store-divinopolis' || viewMode === 'div_west') {
      return DEALERSHIP_HUBS[0];
    }
    const k = normalizeCityKey(baseCity);
    if (k.includes('MONTES CLAROS') || k === 'MOC') return DEALERSHIP_HUBS[1];
    return DEALERSHIP_HUBS[0];
  }, [activeStoreFilter, viewMode, baseCity, DEALERSHIP_HUBS]);

  const cityStats = useMemo(() => {
    const groups: Record<
      string,
      {
        cityKey: string;
        cityName: string;
        uf: string;
        microrregiao: string;
        lat: number;
        lng: number;
        distanceKm: number;
        routeInfo: DeliveryRouteEstimate;
        hubOrigin: typeof DEALERSHIP_HUBS[0];
        count: number;
        entreguesCount: number;
        emRotaCount: number;
        faturamento: number;
        models: Record<string, number>;
        sellers: Record<string, number>;
        items: NonNullable<MonthlyCitySalesMapProps['sales']>;
      }
    > = {};

    monthFilteredSales.forEach((s) => {
      // Atribuição canônica de Polo faturador (respeita store_id rigorosamente)
      let assignedHub = DEALERSHIP_HUBS[0]; // default Divinópolis Matriz
      if (s.store_id === 'store-montesclaros') {
        assignedHub = DEALERSHIP_HUBS[1];
      } else if (s.store_id === 'store-divinopolis') {
        assignedHub = DEALERSHIP_HUBS[0];
      } else if ((s.store_name || '').toLowerCase().includes('montes')) {
        assignedHub = DEALERSHIP_HUBS[1];
      } else if ((s.store_name || '').toLowerCase().includes('divin')) {
        assignedHub = DEALERSHIP_HUBS[0];
      } else if (isMontesClarosRegion(s.regiao)) {
        assignedHub = DEALERSHIP_HUBS[1];
      }

      const cityKey = normalizeCityKey(s.regiao);
      const coords = resolveCityCoordinates(s.regiao, assignedHub.lat, assignedHub.lng);

      const routeInfo = calculateDeliveryRoute(
        assignedHub.lat,
        assignedHub.lng,
        coords.lat,
        coords.lng,
        cityKey,
        freightRatePerKm,
      );

      // 6. Filtro de Raio / Distância Rodoviária
      if (selectedRadius === '0-50' && routeInfo.roadKm > 50) return;
      if (selectedRadius === '50-150' && (routeInfo.roadKm <= 50 || routeInfo.roadKm > 150)) return;
      if (selectedRadius === '150-300' && (routeInfo.roadKm <= 150 || routeInfo.roadKm > 300)) return;
      if (selectedRadius === '300+' && routeInfo.roadKm <= 300) return;

      if (!groups[cityKey]) {
        const niceName =
          MG_REFERENCE_CITIES.find((rc) => normalizeCityKey(rc.name) === cityKey)?.name ||
          (s.regiao ? s.regiao.trim().toUpperCase() : cityKey);

        groups[cityKey] = {
          cityKey,
          cityName: niceName,
          uf: coords.uf || 'MG',
          microrregiao: coords.microrregiao || 'Região Comercial',
          lat: coords.lat,
          lng: coords.lng,
          distanceKm: routeInfo.haversineKm,
          routeInfo,
          hubOrigin: assignedHub,
          count: 0,
          entreguesCount: 0,
          emRotaCount: 0,
          faturamento: 0,
          models: {},
          sellers: {},
          items: [],
        };
      }

      groups[cityKey].count += 1;
      if (s.is_permitted !== false) {
        groups[cityKey].entreguesCount += 1;
      } else {
        groups[cityKey].emRotaCount += 1;
      }
      groups[cityKey].faturamento += s.valor || 0;
      groups[cityKey].items.push(s);

      const m = s.modelo || 'Veículo';
      groups[cityKey].models[m] = (groups[cityKey].models[m] || 0) + 1;

      const v = s.vendedor || 'Vendedor';
      groups[cityKey].sellers[v] = (groups[cityKey].sellers[v] || 0) + 1;
    });

    return Object.values(groups).sort((a, b) => b.count - a.count || b.faturamento - a.faturamento);
  }, [monthFilteredSales, activeHub, DEALERSHIP_HUBS, freightRatePerKm, selectedRadius]);

  const hubSummaries = useMemo(() => {
    const divCities = cityStats.filter((c) => c.hubOrigin.id === 'store-divinopolis');
    const mocCities = cityStats.filter((c) => c.hubOrigin.id === 'store-montesclaros');

    const divCount = divCities.reduce((acc, c) => acc + c.count, 0);
    const divValor = divCities.reduce((acc, c) => acc + c.faturamento, 0);
    const mocCount = mocCities.reduce((acc, c) => acc + c.count, 0);
    const mocValor = mocCities.reduce((acc, c) => acc + c.faturamento, 0);

    return {
      divinopolis: { count: divCount, valor: divValor, citiesCount: divCities.length },
      montesClaros: { count: mocCount, valor: mocValor, citiesCount: mocCities.length },
    };
  }, [cityStats]);

  const monthTotals = useMemo(() => {
    const totalCount = monthFilteredSales.length;
    const totalValor = monthFilteredSales.reduce((acc, s) => acc + (s.valor || 0), 0);
    const totalCidades = cityStats.length;
    const maxRoadDist = cityStats.reduce((max, c) => Math.max(max, c.routeInfo.roadKm), 0);
    const totalRoadKm = cityStats.reduce((acc, c) => acc + c.routeInfo.roadKm * c.count, 0);
    const totalFreightCost = cityStats.reduce(
      (acc, c) => acc + c.routeInfo.estimatedFreightCost * Math.ceil(c.count / 2),
      0,
    );

    return {
      totalCount,
      totalValor,
      totalCidades,
      maxRoadDist,
      totalRoadKm,
      totalFreightCost,
    };
  }, [monthFilteredSales, cityStats]);

  const activeCityDetail = useMemo(() => {
    if (!selectedCityDetail) return cityStats[0] || null;
    return cityStats.find((c) => c.cityKey === selectedCityDetail) || cityStats[0] || null;
  }, [cityStats, selectedCityDetail]);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!leafletMapRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [-18.45, -44.3],
        zoom: 6,
        zoomControl: true,
        attributionControl: false,
      });

      L.geoJSON(brazilStatesGeoJson as any, {
        style: (feature) => {
          const isMG =
            feature?.properties?.name === 'Minas Gerais' || feature?.properties?.sigla === 'MG';
          return {
            fillColor: isMG ? '#0284c7' : '#94a3b8',
            fillOpacity: isMG ? 0.05 : 0.01,
            color: isMG ? '#0284c7' : '#94a3b8',
            weight: isMG ? 1.6 : 0.6,
            dashArray: isMG ? undefined : '3, 4',
          };
        },
      }).addTo(map);

      L.geoJSON(mgCitiesGeoJson as any, {
        style: () => ({
          fillColor: '#38bdf8',
          fillOpacity: 0.01,
          color: '#64748b',
          weight: 0.35,
          opacity: 0.25,
        }),
        onEachFeature: (feature, layer) => {
          const muniName = feature?.properties?.name;
          if (muniName) {
            layer.bindTooltip(`&#9670; ${muniName} - MG`, {
              sticky: true,
              direction: 'top',
              className: 'leaflet-muni-tooltip',
            });
            layer.on({
              mouseover: (e) => {
                const target = e.target;
                target.setStyle({
                  weight: 1.5,
                  color: '#0284c7',
                  fillOpacity: 0.14,
                });
              },
              mouseout: (e) => {
                const target = e.target;
                target.setStyle({
                  weight: 0.35,
                  color: '#64748b',
                  fillOpacity: 0.01,
                });
              },
              click: () => {
                const key = normalizeCityKey(muniName);
                setSelectedCityDetail(key);
              },
            });
          }
        },
      }).addTo(map);

      const markersGroup = L.layerGroup().addTo(map);
      leafletMapRef.current = map;
      markersLayerRef.current = markersGroup;
    }

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
        markersLayerRef.current = null;
        tileLayerRef.current = null;
      }
    };
  }, []);

  // Camada de Tiles autenticada com MAP_API_KEY
  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
      tileLayerRef.current = null;
    }

    if (mapTileStyle === 'road_voyager') {
      const layer = L.tileLayer(getMapTileUrl('streets'), {
        maxZoom: 18,
        subdomains: 'abcd',
      });
      layer.addTo(map);
      layer.bringToBack();
      tileLayerRef.current = layer;
    } else if (mapTileStyle === 'dark_radar') {
      const layer = L.tileLayer(getMapTileUrl('dark'), {
        maxZoom: 18,
        subdomains: 'abcd',
      });
      layer.addTo(map);
      layer.bringToBack();
      tileLayerRef.current = layer;
    }
  }, [mapTileStyle]);

  useEffect(() => {
    const timer = setTimeout(() => {
      leafletMapRef.current?.invalidateSize();
    }, 180);
    return () => clearTimeout(timer);
  }, [isMapExpanded, viewMode, activeStoreFilter, mapOperationMode]);

  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map) return;

    if (viewMode === 'moc_north') {
      map.flyTo([-16.35, -43.65], 8, { duration: 0.8 });
    } else if (viewMode === 'div_west') {
      map.flyTo([-20.1444, -44.8872], 8, { duration: 0.8 });
    } else if (viewMode === 'brazil') {
      map.flyTo([-17.2, -43.5], 5, { duration: 0.8 });
    } else {
      map.flyTo([-18.2, -44.2], 6.5, { duration: 0.8 });
    }
  }, [viewMode]);

  // Renderiza Rotas e Marcadores Low-Poly Minimalistas
  useEffect(() => {
    const map = leafletMapRef.current;
    const layerGroup = markersLayerRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();

    const activeCityKeys = new Set(cityStats.map((c) => c.cityKey));

    if (showAllCityLabels) {
      MG_REFERENCE_CITIES.forEach((refCity) => {
        const key = normalizeCityKey(refCity.name);
        if (activeCityKeys.has(key)) return;
        if (key === 'MONTES CLAROS' || key === 'DIVINOPOLIS') return;
        if (activeStoreFilter === 'store-montesclaros' && refCity.hub !== 'MONTES CLAROS') return;
        if (activeStoreFilter === 'store-divinopolis' && refCity.hub !== 'DIVINOPOLIS') return;

        const refIcon = L.divIcon({
          html: `
            <div style="
              display: flex;
              align-items: center;
              gap: 3px;
              transform: translate(-50%, -50%);
            ">
              <span style="font-size: 8px; color: #64748b;">&#9670;</span>
              <span style="
                font-size: 8.5px;
                font-weight: 700;
                color: ${mapTileStyle === 'dark_radar' ? '#cbd5e1' : '#334155'};
                white-space: nowrap;
              ">${refCity.name}</span>
            </div>
          `,
          className: 'custom-ref-city-label',
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        });

        const refMarker = L.marker([refCity.lat, refCity.lng], { icon: refIcon });
        layerGroup.addLayer(refMarker);
      });
    }

    cityStats.forEach((city) => {
      const isHubCity = city.cityKey === 'MONTES CLAROS' || city.cityKey === 'DIVINOPOLIS';
      const isSelected = activeCityDetail?.cityKey === city.cityKey;
      const hub = city.hubOrigin || activeHub;

      if (!isHubCity && city.routeInfo.waypoints.length > 1) {
        const routeLine = L.polyline(city.routeInfo.waypoints, {
          color: isSelected
            ? '#f59e0b'
            : mapOperationMode === 'delivery_logistics'
              ? '#10b981'
              : hub.color,
          weight: isSelected ? 3.5 : 2,
          dashArray: isSelected ? undefined : '5, 6',
          opacity: isSelected ? 0.95 : 0.68,
        });
        routeLine.on('click', () => setSelectedCityDetail(city.cityKey));
        layerGroup.addLayer(routeLine);

        // Exibe badge da rota apenas para a cidade selecionada (evita poluição visual)
        if (isSelected) {
          const midIdx = Math.floor(city.routeInfo.waypoints.length / 2);
          const midPoint = city.routeInfo.waypoints[midIdx];
          const routeBadgeIcon = L.divIcon({
            html: `
              <div style="
                transform: translate(-50%, -50%);
                background: #0f172a;
                color: #f8fafc;
                font-size: 8.5px;
                font-weight: 800;
                padding: 1.5px 6px;
                border-radius: 4px;
                border: 1px solid #f59e0b;
                white-space: nowrap;
                box-shadow: 0 2px 6px rgba(0,0,0,0.4);
                pointer-events: none;
              ">
                &#9656; ${city.routeInfo.roadKm} km • ${city.routeInfo.formattedDuration}
              </div>
            `,
            className: 'custom-route-midpoint',
            iconSize: [0, 0],
            iconAnchor: [0, 0],
          });
          layerGroup.addLayer(L.marker(midPoint, { icon: routeBadgeIcon }));
        }
      }

      if (!isHubCity) {
        const bgColor =
          city.hubOrigin?.id === 'store-montesclaros' ? '#dc2626' : '#2563eb';

        const cityIcon = L.divIcon({
          html: buildLowPolyCityMarkerHtml({
            cityName: city.cityName,
            count: city.count,
            bgColor,
            isSelected,
          }),
          className: 'custom-city-marker',
          iconSize: [30, 48],
          iconAnchor: [15, 38],
          popupAnchor: [0, -38],
        });

        const marker = L.marker([city.lat, city.lng], {
          icon: cityIcon,
          zIndexOffset: isSelected ? 900 : 400,
        });
        marker.bindTooltip(
          `
          <div style="font-size: 11px; padding: 3px 5px; line-height: 1.4;">
            <strong>&#9670; ${city.cityName} (${city.uf})</strong><br/>
            <span><strong>${city.count} un.</strong> • ${formatCurrencyBRL(city.faturamento)}</span><br/>
            <span>Via ${city.routeInfo.highway} • ${city.routeInfo.roadKm} km (${city.routeInfo.formattedDuration})</span>
          </div>
        `,
          { direction: 'top', offset: [0, -14] },
        );

        marker.on('click', () => {
          setSelectedCityDetail(city.cityKey);
        });

        layerGroup.addLayer(marker);
      }
    });

    // Marcadores Low-Poly Hexagonais das 2 Concessionárias Centrais
    const visibleHubs =
      activeStoreFilter === 'all'
        ? DEALERSHIP_HUBS
        : DEALERSHIP_HUBS.filter((h) => h.id === activeStoreFilter);

    // Círculos de Raio Geográfico com Diâmetros Métricos Exatos (50 km, 150 km e 300 km) - apenas se ativado
    if (showRadiusCircles) {
      const metricRadiusCircles = [
        { radiusMeters: 50000, label: 'Raio 50 km • Diâmetro 100 km (Local)', color: '#10b981' },
        { radiusMeters: 150000, label: 'Raio 150 km • Diâmetro 300 km (Regional)', color: '#3b82f6' },
        { radiusMeters: 300000, label: 'Raio 300 km • Diâmetro 600 km (Expandido)', color: '#8b5cf6' },
      ];

      visibleHubs.forEach((hub) => {
        metricRadiusCircles.forEach((c) => {
          const circle = L.circle([hub.lat, hub.lng], {
            radius: c.radiusMeters,
            color: c.color,
            weight: 1,
            dashArray: '3, 6',
            fillOpacity: 0.015,
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

    visibleHubs.forEach((hub) => {
      const hubCityStat = cityStats.find((c) => c.cityKey === hub.cityKey);
      const localCount = hubCityStat?.count || 0;
      const localRevenue = hubCityStat?.faturamento || 0;
      const totalPoloCount =
        hub.id === 'store-montesclaros'
          ? hubSummaries.montesClaros.count
          : hubSummaries.divinopolis.count;
      const isSelected = activeCityDetail?.cityKey === hub.cityKey;

      const hubIcon = L.divIcon({
        html: buildLowPolyHubMarkerHtml({
          cityLabel: `${hub.city.toUpperCase()} (${localCount})`,
          localCount,
          color: hub.color,
          accentLight: hub.accentLight,
          accentDark: hub.accentDark,
          isSelected,
        }),
        className: 'custom-hub-marker',
        iconSize: [44, 44],
        iconAnchor: [22, 22],
        popupAnchor: [0, -22],
      });

      const hubMarker = L.marker([hub.lat, hub.lng], {
        icon: hubIcon,
        zIndexOffset: 1000,
      });

      hubMarker.bindTooltip(
        `
        <div style="font-size: 11px; padding: 4px 6px; line-height: 1.45;">
          <strong style="color: ${hub.color};">&#9672; ${hub.name}</strong><br/>
          <span>Vendas na sede (${hub.city}): <strong>${localCount} un.</strong> (${formatCurrencyBRL(localRevenue)})</span><br/>
          <span>Total expedido pelo polo: <strong>${totalPoloCount} un.</strong></span>
        </div>
      `,
        { direction: 'top', offset: [0, -18] },
      );

      hubMarker.on('click', () => {
        setSelectedCityDetail(hub.cityKey);
      });

      layerGroup.addLayer(hubMarker);
    });
  }, [
    cityStats,
    activeHub,
    activeCityDetail,
    activeStoreFilter,
    DEALERSHIP_HUBS,
    hubSummaries,
    showAllCityLabels,
    showRadiusCircles,
    mapTileStyle,
    mapOperationMode,
  ]);

  const buildGoogleMapsRouteUrl = (hubCity: string, destCity: string, uf = 'MG') => {
    const origin = encodeURIComponent(`${hubCity}, MG, Brasil`);
    const destination = encodeURIComponent(`${destCity}, ${uf}, Brasil`);
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
  };

  const buildMultiStopPoloRouteUrl = (hubId: string) => {
    const hub = DEALERSHIP_HUBS.find((h) => h.id === hubId) || DEALERSHIP_HUBS[0];
    const stops = cityStats
      .filter((c) => c.hubOrigin.id === hub.id && c.cityKey !== hub.cityKey)
      .sort((a, b) => a.routeInfo.roadKm - b.routeInfo.roadKm)
      .slice(0, 8);
    if (stops.length === 0) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${hub.city}, MG`)}`;
    }
    const origin = encodeURIComponent(`${hub.city}, MG`);
    const lastStop = stops[stops.length - 1];
    const destination = encodeURIComponent(`${lastStop.cityName}, ${lastStop.uf}`);
    const waypoints = stops
      .slice(0, -1)
      .map((s) => encodeURIComponent(`${s.cityName}, ${s.uf}`))
      .join('|');
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypoints ? `&waypoints=${waypoints}` : ''}&travelmode=driving`;
  };

  return (
    <div className="space-y-4">
      {/* BARRA SUPERIOR ENXUTA & PADRONIZADA COM EXPO GLASS */}
      <Card className="rounded-2xl border shadow-xs expo-glass-card">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base md:text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
                  <Globe2 className="w-4 h-4 text-primary" />
                  Mapa de Vendas & Rotas de Entrega
                </h2>
                <Badge variant="outline" className="text-[10px] font-mono px-2 py-0 border-white/20 dark:border-white/10">
                  ◆ MOC: {hubSummaries.montesClaros.count}
                </Badge>
                <Badge variant="outline" className="text-[10px] font-mono px-2 py-0 border-white/20 dark:border-white/10">
                  ◆ DIV: {hubSummaries.divinopolis.count}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Polos Montes Claros e Divinópolis • Rotas rodoviárias e cidades atendidas em visual limpo low-poly.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <div className="flex items-center expo-glass-bar p-0.5 rounded-xl border border-white/20 dark:border-white/10">
                <Button
                  size="sm"
                  variant={mapOperationMode === 'sales_and_routes' ? 'default' : 'ghost'}
                  onClick={() => setMapOperationMode('sales_and_routes')}
                  className="h-7 text-xs rounded-lg px-2.5 font-semibold gap-1"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  Vendas
                </Button>
                <Button
                  size="sm"
                  variant={mapOperationMode === 'delivery_logistics' ? 'default' : 'ghost'}
                  onClick={() => setMapOperationMode('delivery_logistics')}
                  className="h-7 text-xs rounded-lg px-2.5 font-semibold gap-1"
                >
                  <Truck className="w-3.5 h-3.5" />
                  Logística
                </Button>
              </div>

              <Button
                size="sm"
                variant="glass"
                onClick={() => setIsMapExpanded(!isMapExpanded)}
                className="h-7 text-xs rounded-lg font-semibold gap-1 px-2.5"
              >
                {isMapExpanded ? (
                  <>
                    <Minimize2 className="w-3.5 h-3.5" /> Reduzir
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-3.5 h-3.5" /> Expandir
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Controles Compactos com Expo Glass: Linha 1 */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-border/50">
            <div className="flex flex-wrap items-center gap-1.5">
              <Select value={activeStoreFilter} onValueChange={setActiveStoreFilter}>
                <SelectTrigger className="w-[170px] h-7 text-xs btn-glass font-semibold rounded-lg">
                  <Building2 className="w-3 h-3 mr-1 text-primary" />
                  <SelectValue placeholder="Polo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">◆ Ambos os Polos</SelectItem>
                  <SelectItem value="store-montesclaros" className="text-xs">▲ Montes Claros</SelectItem>
                  <SelectItem value="store-divinopolis" className="text-xs">▲ Divinópolis</SelectItem>
                </SelectContent>
              </Select>

              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[155px] h-7 text-xs btn-glass font-semibold rounded-lg">
                  <Calendar className="w-3 h-3 mr-1 text-primary" />
                  <SelectValue placeholder="Mês" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">Todos os Meses ({sales.length})</SelectItem>
                  {availableMonths.map((m) => (
                    <SelectItem key={m.key} value={m.key} className="text-xs">
                      {m.label} ({m.count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex items-center expo-glass-bar p-0.5 rounded-lg border border-white/20 dark:border-white/10 gap-0.5">
                <Button
                  size="sm"
                  variant={viewMode === 'all_mg' ? 'default' : 'ghost'}
                  onClick={() => setViewMode('all_mg')}
                  className="h-6 text-[11px] rounded-md px-2 font-semibold"
                >
                  MG Geral
                </Button>
                <Button
                  size="sm"
                  variant={viewMode === 'moc_north' ? 'default' : 'ghost'}
                  onClick={() => {
                    setViewMode('moc_north');
                    setSelectedCityDetail('MONTES CLAROS');
                  }}
                  className="h-6 text-[11px] rounded-md px-2 font-semibold"
                >
                  ▲ Montes Claros
                </Button>
                <Button
                  size="sm"
                  variant={viewMode === 'div_west' ? 'default' : 'ghost'}
                  onClick={() => {
                    setViewMode('div_west');
                    setSelectedCityDetail('DIVINOPOLIS');
                  }}
                  className="h-6 text-[11px] rounded-md px-2 font-semibold"
                >
                  ▲ Divinópolis
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    const map = leafletMapRef.current;
                    if (!map || cityStats.length === 0) return;
                    const pts = cityStats.map((c) => L.latLng(c.lat, c.lng));
                    visibleHubs.forEach((h) => pts.push(L.latLng(h.lat, h.lng)));
                    map.flyToBounds(L.latLngBounds(pts), { padding: [50, 50], maxZoom: 10, duration: 0.8 });
                  }}
                  className="h-6 text-[11px] rounded-md px-2 font-semibold text-primary hover:bg-primary/10 gap-1 border border-primary/20"
                  title="Enquadrar todos os pontos e rotas de entrega na tela"
                >
                  <Navigation className="w-3 h-3" />
                  Centralizar Pontos
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <div className="flex items-center expo-glass-bar p-0.5 rounded-lg border border-white/20 dark:border-white/10 gap-0.5">
                <Button
                  size="sm"
                  variant={mapTileStyle === 'road_voyager' ? 'default' : 'ghost'}
                  onClick={() => setMapTileStyle('road_voyager')}
                  className="h-6 text-[11px] rounded-md px-2 font-semibold"
                >
                  ◇ Rodoviário
                </Button>
                <Button
                  size="sm"
                  variant={mapTileStyle === 'dark_radar' ? 'default' : 'ghost'}
                  onClick={() => setMapTileStyle('dark_radar')}
                  className="h-6 text-[11px] rounded-md px-2 font-semibold"
                >
                  ◆ Escuro
                </Button>
                <Button
                  size="sm"
                  variant={mapTileStyle === 'ibge_vector' ? 'default' : 'ghost'}
                  onClick={() => setMapTileStyle('ibge_vector')}
                  className="h-6 text-[11px] rounded-md px-2 font-semibold"
                >
                  ◈ Vetorial
                </Button>
              </div>

              <Button
                type="button"
                size="sm"
                variant={showRadiusCircles ? 'default' : 'glass'}
                onClick={() => setShowRadiusCircles(!showRadiusCircles)}
                className={cn(
                  "h-6 text-[11px] px-2 rounded-lg font-semibold transition-all",
                  showRadiusCircles && "bg-primary text-white shadow-xs"
                )}
                title="Exibir círculos métricos de raio (50km, 150km, 300km)"
              >
                <CircleDot className={cn("w-3 h-3 mr-1", showRadiusCircles ? "text-white" : "text-primary")} />
                Raios
              </Button>
              <Button
                type="button"
                size="sm"
                variant={showAllCityLabels ? 'default' : 'glass'}
                onClick={() => setShowAllCityLabels(!showAllCityLabels)}
                className={cn(
                  "h-6 text-[11px] px-2 rounded-lg font-semibold transition-all",
                  showAllCityLabels && "bg-primary text-white shadow-xs"
                )}
              >
                {showAllCityLabels ? '− Rótulos Extras' : '+ Rótulos Extras'}
              </Button>
            </div>
          </div>

          {/* Linha 2 de Filtros Avançados: Vendedor, Status, Modelo, Raio */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/40 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              {/* Filtro de Vendedor */}
              <Select value={selectedSeller} onValueChange={setSelectedSeller}>
                <SelectTrigger className="w-[155px] h-7 text-xs btn-glass font-medium rounded-lg">
                  <UserCheck className="w-3 h-3 mr-1 text-primary" />
                  <SelectValue placeholder="Vendedor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">Todos os Vendedores</SelectItem>
                  {availableSellers.map((s) => (
                    <SelectItem key={s.name} value={s.name} className="text-xs">
                      {s.name} ({s.count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Filtro de Status da Venda */}
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-[145px] h-7 text-xs btn-glass font-medium rounded-lg">
                  <BadgeCheck className="w-3 h-3 mr-1 text-primary" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">Todos os Status</SelectItem>
                  <SelectItem value="entregue" className="text-xs">Faturadas / Entregues</SelectItem>
                  <SelectItem value="em_rota" className="text-xs">Pré-Venda / Em Análise</SelectItem>
                </SelectContent>
              </Select>

              {/* Filtro de Modelo do Veículo */}
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger className="w-[155px] h-7 text-xs btn-glass font-medium rounded-lg">
                  <Bike className="w-3 h-3 mr-1 text-primary" />
                  <SelectValue placeholder="Modelo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">Todos os Modelos</SelectItem>
                  {availableModels.map((m) => (
                    <SelectItem key={m.name} value={m.name} className="text-xs">
                      {m.name} ({m.count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Filtro de Raio / Distância */}
              <Select value={selectedRadius} onValueChange={setSelectedRadius}>
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

              {/* Seletor do Método de Logística & Transporte */}
              <Select value={selectedLogisticsMethod} onValueChange={setSelectedLogisticsMethod}>
                <SelectTrigger className="w-[185px] h-7 text-xs btn-glass font-medium rounded-lg truncate" title="Método de Frete Rodoviário">
                  <Truck className="w-3 h-3 mr-1 text-primary shrink-0" />
                  <SelectValue placeholder="Método de Frete" />
                </SelectTrigger>
                <SelectContent>
                  {TRANSPORT_LOGISTICS_METHODS.map((m) => (
                    <SelectItem key={m.id} value={m.id} className="text-xs">
                      {m.nome.split(' (')[0]} ({m.tipo === 'PRESENCIAL' ? 'Grátis' : `R$ ${m.tarifaBaseKm.toFixed(2)}/km`})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Botão Limpar Filtros quando algum estiver ativo */}
              {activeFilterCount > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={resetAllFilters}
                  className="h-7 text-[11px] px-2 text-muted-foreground hover:text-foreground font-semibold gap-1 rounded-lg"
                  title="Redefinir todos os filtros do mapa"
                >
                  <RotateCcw className="w-3 h-3 text-amber-500" />
                  Limpar ({activeFilterCount})
                </Button>
              )}
            </div>

            {/* Contador de Cidades & Unidades Filtradas */}
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium">
              <span className="font-bold text-foreground">{cityStats.length}</span> cidades
              <span>•</span>
              <span className="font-bold text-foreground">
                {cityStats.reduce((acc, c) => acc + c.count, 0)}
              </span> motos mapeadas
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CORPO PRINCIPAL: MAPA LIMPO + PAINEL DA CIDADE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <Card
          className={cn(
            'rounded-2xl border shadow-xs overflow-hidden flex flex-col',
            isMapExpanded ? 'lg:col-span-12' : 'lg:col-span-8',
          )}
        >
          <CardContent className="p-2.5 flex-1 flex flex-col relative">
            <div
              ref={mapContainerRef}
              className={cn(
                'w-full rounded-xl overflow-hidden border border-border/50 relative z-0 transition-all duration-300',
                isMapExpanded ? 'h-[700px]' : 'h-[560px]',
              )}
            />

            {/* Legenda Minimalista Low-Poly */}
            <div className="absolute bottom-5 left-5 z-10 max-w-[calc(100%-2.5rem)] overflow-hidden bg-card/90 backdrop-blur-md border border-border/70 rounded-lg px-3 py-1.5 shadow-sm flex flex-wrap items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1 font-semibold text-foreground">
                <span className="text-red-600">⬢</span> MOC ({hubSummaries.montesClaros.count})
              </span>
              <span className="flex items-center gap-1 font-semibold text-foreground">
                <span className="text-blue-600">⬢</span> DIV ({hubSummaries.divinopolis.count})
              </span>
              <span className="flex items-center gap-1 text-muted-foreground">
                <span className="text-primary">◆</span> Destino ({monthTotals.totalCidades} cidades)
              </span>
              <a
                href={buildMultiStopPoloRouteUrl('store-montesclaros')}
                target="_blank"
                rel="noopener noreferrer"
                className="text-red-600 hover:underline font-semibold inline-flex items-center gap-0.5"
              >
                ▸ Rota MOC <ExternalLink className="w-2.5 h-2.5" />
              </a>
              <a
                href={buildMultiStopPoloRouteUrl('store-divinopolis')}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline font-semibold inline-flex items-center gap-0.5"
              >
                ▸ Rota DIV <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Painel Lateral Enxuto da Cidade Selecionada */}
        <div className={cn('space-y-4 flex flex-col', isMapExpanded ? 'lg:col-span-12' : 'lg:col-span-4')}>
          {activeCityDetail ? (
            <Card className="rounded-2xl border shadow-xs bg-card p-4 space-y-3.5 flex-1">
              <div className="flex items-start justify-between gap-2 pb-2.5 border-b">
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Badge variant="outline" className="text-[10px] font-semibold">
                      {activeCityDetail.microrregiao} • {activeCityDetail.uf}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] font-semibold">
                      ◆ {activeCityDetail.hubOrigin.shortName}
                    </Badge>
                  </div>
                  <h3 className="text-lg font-bold text-foreground">
                    ◆ {activeCityDetail.cityName}
                  </h3>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-xl font-bold text-primary font-mono">
                    {activeCityDetail.count} un
                  </div>
                  <span className="text-[11px] font-mono text-emerald-600 font-semibold">
                    {formatCurrencyBRL(activeCityDetail.faturamento)}
                  </span>
                </div>
              </div>

              {/* Resumo de Rota & Logística de Transporte */}
              <div className="p-3 rounded-xl bg-muted/30 border space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground flex items-center gap-1">
                    <Route className="w-3.5 h-3.5 text-primary" />
                    Via {activeCityDetail.routeInfo.highway}
                  </span>
                  <span className="font-mono text-muted-foreground">
                    {activeCityDetail.routeInfo.roadKm} km • {activeCityDetail.routeInfo.formattedDuration}
                  </span>
                </div>

                {/* Modalidade de Transporte Ativa */}
                <div className="p-2 rounded-lg bg-card border flex items-center justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge className={activeLogisticsMethod.corBadge}>
                        {activeLogisticsMethod.destaqueBadge}
                      </Badge>
                      <span className="font-bold text-[11px] text-foreground truncate">
                        {activeLogisticsMethod.nome.split(' (')[0]}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground block mt-0.5">
                      Prazo: <strong className="text-foreground">{activeLogisticsMethod.prazoFormatado}</strong>
                    </span>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[9px] uppercase font-bold text-muted-foreground block">
                      Frete Calculado
                    </span>
                    <strong className="font-mono text-sm text-foreground font-black">
                      {calculateFreightCost(
                        selectedLogisticsMethod,
                        activeCityDetail.routeInfo.roadKm,
                        activeCityDetail.count
                      ).formattedTotal}
                    </strong>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-border/50">
                  <span className="text-[10px] text-muted-foreground">
                    Seguro: <strong className="text-foreground">{activeLogisticsMethod.seguroCarga.split(' ')[0]}</strong>
                  </span>
                  <a
                    href={buildGoogleMapsRouteUrl(
                      activeCityDetail.hubOrigin.city,
                      activeCityDetail.cityName,
                      activeCityDetail.uf,
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                  >
                    Abrir no Maps <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* Lista Compacta de Compradores */}
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-muted-foreground">
                  Entregas na Cidade ({activeCityDetail.items.length})
                </span>
                <div className="max-h-[340px] overflow-y-auto space-y-1.5 pr-1">
                  {activeCityDetail.items.map((saleItem) => (
                    <div
                      key={saleItem.id}
                      className="p-2 rounded-lg border bg-card text-[11px] flex items-center justify-between gap-2"
                    >
                      <div className="truncate">
                        <div className="font-semibold text-foreground truncate">
                          ◆ {saleItem.cliente || 'Cliente'}
                        </div>
                        <div className="text-muted-foreground text-[10px] truncate">
                          {saleItem.modelo} • {saleItem.vendedor}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-mono font-semibold text-foreground block">
                          {formatCurrencyBRL(saleItem.valor)}
                        </span>
                        <span className="text-[9px] text-muted-foreground">
                          {saleItem.is_permitted !== false ? '▲ Faturada' : '◇ Pendente'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          ) : (
            <Card className="rounded-2xl border shadow-xs p-6 text-center text-muted-foreground text-xs">
              Selecione uma cidade no mapa para ver detalhes.
            </Card>
          )}
        </div>
      </div>

      {/* TABELA COMPACTA DE ROTAS E MUNICÍPIOS */}
      <Card className="rounded-2xl border shadow-xs">
        <CardHeader className="py-3 px-4 border-b bg-muted/10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <Truck className="w-4 h-4 text-primary" />
              Romaneio de Rotas & Ranking por Cidade ({cityStats.length})
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">R$/km:</span>
              <Input
                type="number"
                step="0.2"
                min="0.5"
                value={freightRatePerKm}
                onChange={(e) => setFreightRatePerKm(Number(e.target.value) || 2.8)}
                className="h-7 w-16 text-xs font-mono bg-background"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto max-h-[360px]">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/20">
                <TableHead className="w-10 text-center text-xs">#</TableHead>
                <TableHead className="text-xs">Cidade</TableHead>
                <TableHead className="text-xs">Polo</TableHead>
                <TableHead className="text-xs">Rodovia</TableHead>
                <TableHead className="text-xs text-center">Distância</TableHead>
                <TableHead className="text-xs text-center">Unid.</TableHead>
                <TableHead className="text-xs text-right">Volume</TableHead>
                <TableHead className="text-xs text-right">Rota</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cityStats.map((c, index) => {
                const isSelected = activeCityDetail?.cityKey === c.cityKey;
                return (
                  <TableRow
                    key={c.cityKey}
                    onClick={() => setSelectedCityDetail(c.cityKey)}
                    className={cn(
                      'cursor-pointer transition-colors text-xs',
                      isSelected ? 'bg-primary/10 font-semibold' : 'hover:bg-muted/30',
                    )}
                  >
                    <TableCell className="text-center font-mono text-muted-foreground py-2">
                      {index + 1}
                    </TableCell>
                    <TableCell className="font-semibold text-foreground py-2">
                      ◆ {c.cityName} <span className="text-[10px] text-muted-foreground">({c.uf})</span>
                    </TableCell>
                    <TableCell className="py-2">
                      <span
                        className={cn(
                          'text-[10px] font-semibold',
                          c.hubOrigin.id === 'store-montesclaros' ? 'text-red-600' : 'text-blue-600',
                        )}
                      >
                        ▲ {c.hubOrigin.shortName}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-[11px] py-2">
                      {c.routeInfo.highway}
                    </TableCell>
                    <TableCell className="text-center font-mono py-2">
                      {c.distanceKm === 0 ? 'Sede' : `${c.routeInfo.roadKm} km`}
                    </TableCell>
                    <TableCell className="text-center font-mono font-bold py-2">
                      {c.count}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold text-emerald-600 py-2">
                      {formatCurrencyBRL(c.faturamento)}
                    </TableCell>
                    <TableCell className="text-right py-2">
                      <a
                        href={buildGoogleMapsRouteUrl(c.hubOrigin.city, c.cityName, c.uf)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                      >
                        Maps <ExternalLink className="w-3 h-3" />
                      </a>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export default MonthlyCitySalesMap;
