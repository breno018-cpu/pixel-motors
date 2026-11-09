import mgCentroidsJson from '@/lib/geo/mgCentroids.json';

// Coordenadas Geográficas Oficiais de Municípios, Polos Comerciais e Corredores Rodoviários de Entrega
export interface CityGeoMetadata {
  lat: number;
  lng: number;
  uf: string;
  name?: string;
  microrregiao?: string;
  rodovia?: string;
  poloAtendimento?: 'MONTES CLAROS' | 'DIVINOPOLIS';
}

const mgCentroids = mgCentroidsJson as Record<string, { name: string; lat: number; lng: number }>;

// Dicionário de Coordenadas de Referência e Polos Estratégicos
export const CITY_COORDINATES: Record<string, CityGeoMetadata> = {
  // ============================================================================
  // POLO 1: DIVINÓPOLIS E REGIÃO CENTRO-OESTE / OESTE / METROPOLITANA / SUL DE MG
  // ============================================================================
  'DIVINOPOLIS': { lat: -20.1444, lng: -44.8872, uf: 'MG', name: 'Divinópolis', microrregiao: 'Oeste de Minas', rodovia: 'MG-050 / BR-494', poloAtendimento: 'DIVINOPOLIS' },
  'DIVINÓPOLIS': { lat: -20.1444, lng: -44.8872, uf: 'MG', name: 'Divinópolis', microrregiao: 'Oeste de Minas', rodovia: 'MG-050 / BR-494', poloAtendimento: 'DIVINOPOLIS' },
  'NOVA SERRANA': { lat: -19.8761, lng: -44.9839, uf: 'MG', name: 'Nova Serrana', microrregiao: 'Oeste de Minas', rodovia: 'BR-262 / BR-494', poloAtendimento: 'DIVINOPOLIS' },
  'CLAUDIO': { lat: -20.4439, lng: -44.7672, uf: 'MG', name: 'Cláudio', microrregiao: 'Oeste de Minas', rodovia: 'MG-260 / BR-494', poloAtendimento: 'DIVINOPOLIS' },
  'CLÁUDIO': { lat: -20.4439, lng: -44.7672, uf: 'MG', name: 'Cláudio', microrregiao: 'Oeste de Minas', rodovia: 'MG-260 / BR-494', poloAtendimento: 'DIVINOPOLIS' },
  'FORMIGA': { lat: -20.4639, lng: -45.4264, uf: 'MG', name: 'Formiga', microrregiao: 'Oeste de Minas', rodovia: 'MG-050', poloAtendimento: 'DIVINOPOLIS' },
  'BOM DESPACHO': { lat: -19.7358, lng: -45.2536, uf: 'MG', name: 'Bom Despacho', microrregiao: 'Oeste de Minas', rodovia: 'BR-262 / MG-164', poloAtendimento: 'DIVINOPOLIS' },
  'CARMO DO CAJURU': { lat: -20.1856, lng: -44.7711, uf: 'MG', name: 'Carmo do Cajuru', microrregiao: 'Oeste de Minas', rodovia: 'MG-050', poloAtendimento: 'DIVINOPOLIS' },
  'ITAÚNA': { lat: -20.0756, lng: -44.5761, uf: 'MG', name: 'Itaúna', microrregiao: 'Oeste de Minas', rodovia: 'MG-050', poloAtendimento: 'DIVINOPOLIS' },
  'ITAUNA': { lat: -20.0756, lng: -44.5761, uf: 'MG', name: 'Itaúna', microrregiao: 'Oeste de Minas', rodovia: 'MG-050', poloAtendimento: 'DIVINOPOLIS' },
  'PARÁ DE MINAS': { lat: -19.8597, lng: -44.6081, uf: 'MG', name: 'Pará de Minas', microrregiao: 'Oeste de Minas', rodovia: 'BR-262 / MG-431', poloAtendimento: 'DIVINOPOLIS' },
  'PARA DE MINAS': { lat: -19.8597, lng: -44.6081, uf: 'MG', name: 'Pará de Minas', microrregiao: 'Oeste de Minas', rodovia: 'BR-262 / MG-431', poloAtendimento: 'DIVINOPOLIS' },
  'ARCOS': { lat: -20.2817, lng: -45.5403, uf: 'MG', name: 'Arcos', microrregiao: 'Oeste de Minas', rodovia: 'BR-354 / MG-050', poloAtendimento: 'DIVINOPOLIS' },
  'LAGOA DA PRATA': { lat: -20.0225, lng: -45.5436, uf: 'MG', name: 'Lagoa da Prata', microrregiao: 'Oeste de Minas', rodovia: 'MG-164 / MG-429', poloAtendimento: 'DIVINOPOLIS' },
  'OLIVEIRA': { lat: -20.6975, lng: -44.8267, uf: 'MG', name: 'Oliveira', microrregiao: 'Oeste de Minas', rodovia: 'BR-494 / BR-381', poloAtendimento: 'DIVINOPOLIS' },
  'SANTO ANTÔNIO DO MONTE': { lat: -20.0872, lng: -45.2914, uf: 'MG', name: 'Santo Antônio do Monte', microrregiao: 'Oeste de Minas', rodovia: 'MG-164', poloAtendimento: 'DIVINOPOLIS' },
  'SANTO ANTONIO DO MONTE': { lat: -20.0872, lng: -45.2914, uf: 'MG', name: 'Santo Antônio do Monte', microrregiao: 'Oeste de Minas', rodovia: 'MG-164', poloAtendimento: 'DIVINOPOLIS' },
  'ITAPECERICA': { lat: -20.4725, lng: -45.1258, uf: 'MG', name: 'Itapecerica', microrregiao: 'Oeste de Minas', rodovia: 'MG-164 / MG-260', poloAtendimento: 'DIVINOPOLIS' },
  'PERDIGÃO': { lat: -19.9539, lng: -45.0861, uf: 'MG', name: 'Perdigão', microrregiao: 'Oeste de Minas', rodovia: 'MG-252 / BR-494', poloAtendimento: 'DIVINOPOLIS' },
  'PERDIGAO': { lat: -19.9539, lng: -45.0861, uf: 'MG', name: 'Perdigão', microrregiao: 'Oeste de Minas', rodovia: 'MG-252 / BR-494', poloAtendimento: 'DIVINOPOLIS' },
  'PITANGUI': { lat: -19.6833, lng: -44.8903, uf: 'MG', name: 'Pitangui', microrregiao: 'Oeste de Minas', rodovia: 'BR-262 / MG-423', poloAtendimento: 'DIVINOPOLIS' },
  'BAMBUÍ': { lat: -20.0064, lng: -45.9769, uf: 'MG', name: 'Bambuí', microrregiao: 'Oeste de Minas', rodovia: 'BR-354', poloAtendimento: 'DIVINOPOLIS' },
  'BAMBUI': { lat: -20.0064, lng: -45.9769, uf: 'MG', name: 'Bambuí', microrregiao: 'Oeste de Minas', rodovia: 'BR-354', poloAtendimento: 'DIVINOPOLIS' },
  'PIUMHI': { lat: -20.4653, lng: -45.9581, uf: 'MG', name: 'Piumhi', microrregiao: 'Piumhi', rodovia: 'MG-050', poloAtendimento: 'DIVINOPOLIS' },
  'PASSOS': { lat: -20.7189, lng: -46.6097, uf: 'MG', name: 'Passos', microrregiao: 'Passos', rodovia: 'MG-050', poloAtendimento: 'DIVINOPOLIS' },
  'SÃO SEBASTIÃO DO PARAÍSO': { lat: -20.9167, lng: -46.9833, uf: 'MG', name: 'São Sebastião do Paraíso', microrregiao: 'Sudoeste de Minas', rodovia: 'MG-050 / BR-491', poloAtendimento: 'DIVINOPOLIS' },
  'SAO SEBASTIAO DO PARAISO': { lat: -20.9167, lng: -46.9833, uf: 'MG', name: 'São Sebastião do Paraíso', microrregiao: 'Sudoeste de Minas', rodovia: 'MG-050 / BR-491', poloAtendimento: 'DIVINOPOLIS' },

  // Região Metropolitana BH e Central
  'BELO HORIZONTE': { lat: -19.9167, lng: -43.9345, uf: 'MG', name: 'Belo Horizonte', microrregiao: 'Metropolitana BH', rodovia: 'MG-050 / BR-381', poloAtendimento: 'DIVINOPOLIS' },
  'BETIM': { lat: -19.9678, lng: -44.1983, uf: 'MG', name: 'Betim', microrregiao: 'Metropolitana BH', rodovia: 'MG-050 / BR-381', poloAtendimento: 'DIVINOPOLIS' },
  'CONTAGEM': { lat: -19.9317, lng: -44.0536, uf: 'MG', name: 'Contagem', microrregiao: 'Metropolitana BH', rodovia: 'BR-381 / BR-040', poloAtendimento: 'DIVINOPOLIS' },
  'SETE LAGOAS': { lat: -19.4608, lng: -44.2467, uf: 'MG', name: 'Sete Lagoas', microrregiao: 'Sete Lagoas', rodovia: 'BR-040', poloAtendimento: 'DIVINOPOLIS' },
  'IGARAPÉ': { lat: -20.0703, lng: -44.3017, uf: 'MG', name: 'Igarapé', microrregiao: 'Metropolitana BH', rodovia: 'BR-381', poloAtendimento: 'DIVINOPOLIS' },
  'IGARAPE': { lat: -20.0703, lng: -44.3017, uf: 'MG', name: 'Igarapé', microrregiao: 'Metropolitana BH', rodovia: 'BR-381', poloAtendimento: 'DIVINOPOLIS' },
  'MATEUS LEME': { lat: -19.9858, lng: -44.4278, uf: 'MG', name: 'Mateus Leme', microrregiao: 'Metropolitana BH', rodovia: 'MG-050', poloAtendimento: 'DIVINOPOLIS' },

  // ============================================================================
  // POLO 2: MONTES CLAROS E REGIÃO NORTE DE MINAS / SERRA GERAL / SÃO FRANCISCO
  // ============================================================================
  'MONTES CLAROS': { lat: -16.7282, lng: -43.8644, uf: 'MG', name: 'Montes Claros', microrregiao: 'Norte de Minas', rodovia: 'BR-135 / BR-251 / BR-365', poloAtendimento: 'MONTES CLAROS' },
  'MOC': { lat: -16.7282, lng: -43.8644, uf: 'MG', name: 'Montes Claros', microrregiao: 'Norte de Minas', rodovia: 'BR-135 / BR-251', poloAtendimento: 'MONTES CLAROS' },
  'JANAÚBA': { lat: -15.8028, lng: -43.3089, uf: 'MG', name: 'Janaúba', microrregiao: 'Serra Geral de Minas', rodovia: 'MG-401 / BR-122', poloAtendimento: 'MONTES CLAROS' },
  'JANAUBA': { lat: -15.8028, lng: -43.3089, uf: 'MG', name: 'Janaúba', microrregiao: 'Serra Geral de Minas', rodovia: 'MG-401 / BR-122', poloAtendimento: 'MONTES CLAROS' },
  'BOCAIÚVA': { lat: -17.1078, lng: -43.815, uf: 'MG', name: 'Bocaiúva', microrregiao: 'Bocaiúva / Norte', rodovia: 'BR-135', poloAtendimento: 'MONTES CLAROS' },
  'BOCAIUVA': { lat: -17.1078, lng: -43.815, uf: 'MG', name: 'Bocaiúva', microrregiao: 'Bocaiúva / Norte', rodovia: 'BR-135', poloAtendimento: 'MONTES CLAROS' },
  'SALINAS': { lat: -16.1708, lng: -42.29, uf: 'MG', name: 'Salinas', microrregiao: 'Alto Rio Pardo', rodovia: 'BR-251', poloAtendimento: 'MONTES CLAROS' },
  'PIRAPORA': { lat: -17.3556, lng: -44.9419, uf: 'MG', name: 'Pirapora', microrregiao: 'Pirapora / São Francisco', rodovia: 'BR-365', poloAtendimento: 'MONTES CLAROS' },
  'JANUÁRIA': { lat: -15.4833, lng: -44.3667, uf: 'MG', name: 'Januária', microrregiao: 'Médio São Francisco', rodovia: 'BR-135 / MG-479', poloAtendimento: 'MONTES CLAROS' },
  'JANUARIA': { lat: -15.4833, lng: -44.3667, uf: 'MG', name: 'Januária', microrregiao: 'Médio São Francisco', rodovia: 'BR-135 / MG-479', poloAtendimento: 'MONTES CLAROS' },
  'SÃO FRANCISCO': { lat: -15.9486, lng: -44.8644, uf: 'MG', name: 'São Francisco', microrregiao: 'Médio São Francisco', rodovia: 'MG-202 / MG-402', poloAtendimento: 'MONTES CLAROS' },
  'SAO FRANCISCO': { lat: -15.9486, lng: -44.8644, uf: 'MG', name: 'São Francisco', microrregiao: 'Médio São Francisco', rodovia: 'MG-202 / MG-402', poloAtendimento: 'MONTES CLAROS' },
  'CORAÇÃO DE JESUS': { lat: -16.6853, lng: -44.3653, uf: 'MG', name: 'Coração de Jesus', microrregiao: 'Norte de Minas', rodovia: 'BR-365 / LMG-654', poloAtendimento: 'MONTES CLAROS' },
  'CORACAO DE JESUS': { lat: -16.6853, lng: -44.3653, uf: 'MG', name: 'Coração de Jesus', microrregiao: 'Norte de Minas', rodovia: 'BR-365 / LMG-654', poloAtendimento: 'MONTES CLAROS' },
  'BRASÍLIA DE MINAS': { lat: -16.2064, lng: -44.4317, uf: 'MG', name: 'Brasília de Minas', microrregiao: 'Brasília de Minas', rodovia: 'MG-202 / MG-308', poloAtendimento: 'MONTES CLAROS' },
  'BRASILIA DE MINAS': { lat: -16.2064, lng: -44.4317, uf: 'MG', name: 'Brasília de Minas', microrregiao: 'Brasília de Minas', rodovia: 'MG-202 / MG-308', poloAtendimento: 'MONTES CLAROS' },
  'PORTEIRINHA': { lat: -15.7439, lng: -43.0289, uf: 'MG', name: 'Porteirinha', microrregiao: 'Serra Geral de Minas', rodovia: 'BR-122 / MGC-122', poloAtendimento: 'MONTES CLAROS' },
  'TAIOBEIRAS': { lat: -15.8067, lng: -42.2333, uf: 'MG', name: 'Taiobeiras', microrregiao: 'Alto Rio Pardo', rodovia: 'BR-251 / MG-404', poloAtendimento: 'MONTES CLAROS' },
  'FRANCISCO SÁ': { lat: -16.4758, lng: -43.4883, uf: 'MG', name: 'Francisco Sá', microrregiao: 'Norte de Minas', rodovia: 'BR-251', poloAtendimento: 'MONTES CLAROS' },
  'FRANCISCO SA': { lat: -16.4758, lng: -43.4883, uf: 'MG', name: 'Francisco Sá', microrregiao: 'Norte de Minas', rodovia: 'BR-251', poloAtendimento: 'MONTES CLAROS' },
  'JAÍBA': { lat: -15.3417, lng: -43.6764, uf: 'MG', name: 'Jaíba', microrregiao: 'Projeto Jaíba / Norte', rodovia: 'MG-401', poloAtendimento: 'MONTES CLAROS' },
  'JAIBA': { lat: -15.3417, lng: -43.6764, uf: 'MG', name: 'Jaíba', microrregiao: 'Projeto Jaíba / Norte', rodovia: 'MG-401', poloAtendimento: 'MONTES CLAROS' },
  'CAPITÃO ENÉAS': { lat: -16.3239, lng: -43.7097, uf: 'MG', name: 'Capitão Enéas', microrregiao: 'Norte de Minas', rodovia: 'BR-122', poloAtendimento: 'MONTES CLAROS' },
  'CAPITAO ENEAS': { lat: -16.3239, lng: -43.7097, uf: 'MG', name: 'Capitão Enéas', microrregiao: 'Norte de Minas', rodovia: 'BR-122', poloAtendimento: 'MONTES CLAROS' },
  'ESPINOSA': { lat: -14.9261, lng: -42.8192, uf: 'MG', name: 'Espinosa', microrregiao: 'Serra Geral de Minas', rodovia: 'BR-122', poloAtendimento: 'MONTES CLAROS' },
  'MONTE AZUL': { lat: -15.155, lng: -42.8747, uf: 'MG', name: 'Monte Azul', microrregiao: 'Serra Geral de Minas', rodovia: 'BR-122', poloAtendimento: 'MONTES CLAROS' },
  'MANGA': { lat: -14.7558, lng: -43.9322, uf: 'MG', name: 'Manga', microrregiao: 'Januária / São Francisco', rodovia: 'BR-135 / MG-401', poloAtendimento: 'MONTES CLAROS' },
  'VÁRZEA DA PALMA': { lat: -17.5981, lng: -44.7308, uf: 'MG', name: 'Várzea da Palma', microrregiao: 'Pirapora', rodovia: 'BR-365 / MG-208', poloAtendimento: 'MONTES CLAROS' },
  'VARZEA DA PALMA': { lat: -17.5981, lng: -44.7308, uf: 'MG', name: 'Várzea da Palma', microrregiao: 'Pirapora', rodovia: 'BR-365 / MG-208', poloAtendimento: 'MONTES CLAROS' },
  'BURITIZEIRO': { lat: -17.3511, lng: -44.9622, uf: 'MG', name: 'Buritizeiro', microrregiao: 'Pirapora', rodovia: 'BR-365', poloAtendimento: 'MONTES CLAROS' },
  'CURVELO': { lat: -18.7564, lng: -44.4308, uf: 'MG', name: 'Curvelo', microrregiao: 'Curvelo / Central', rodovia: 'BR-135', poloAtendimento: 'MONTES CLAROS' },
  'DIAMANTINA': { lat: -18.2494, lng: -43.6003, uf: 'MG', name: 'Diamantina', microrregiao: 'Alto Jequitinhonha', rodovia: 'BR-367 / BR-135', poloAtendimento: 'MONTES CLAROS' },
  'GRÃO MOGOL': { lat: -16.5622, lng: -42.89, uf: 'MG', name: 'Grão Mogol', microrregiao: 'Grão Mogol', rodovia: 'BR-251 / MG-307', poloAtendimento: 'MONTES CLAROS' },
  'GRAO MOGOL': { lat: -16.5622, lng: -42.89, uf: 'MG', name: 'Grão Mogol', microrregiao: 'Grão Mogol', rodovia: 'BR-251 / MG-307', poloAtendimento: 'MONTES CLAROS' },
  'MIRABELA': { lat: -16.2625, lng: -44.1644, uf: 'MG', name: 'Mirabela', microrregiao: 'Montes Claros', rodovia: 'BR-135', poloAtendimento: 'MONTES CLAROS' },

  // Outros Polos Nacionais & Vizinhança
  'UBERLÂNDIA': { lat: -18.9186, lng: -48.2772, uf: 'MG', name: 'Uberlândia', microrregiao: 'Triângulo Mineiro', rodovia: 'BR-365 / BR-452', poloAtendimento: 'DIVINOPOLIS' },
  'UBERLANDIA': { lat: -18.9186, lng: -48.2772, uf: 'MG', name: 'Uberlândia', microrregiao: 'Triângulo Mineiro', rodovia: 'BR-365 / BR-452', poloAtendimento: 'DIVINOPOLIS' },
  'ITABUNA': { lat: -14.7892, lng: -39.2789, uf: 'BA', name: 'Itabuna', microrregiao: 'Sul Baiano', rodovia: 'BR-251 / BR-116 / BR-415', poloAtendimento: 'MONTES CLAROS' },
  'JEQUIÉ': { lat: -13.8578, lng: -40.0839, uf: 'BA', name: 'Jequié', microrregiao: 'Centro-Sul Baiano', rodovia: 'BR-251 / BR-116', poloAtendimento: 'MONTES CLAROS' },
  'JEQUIE': { lat: -13.8578, lng: -40.0839, uf: 'BA', name: 'Jequié', microrregiao: 'Centro-Sul Baiano', rodovia: 'BR-251 / BR-116', poloAtendimento: 'MONTES CLAROS' },
  'SALVADOR': { lat: -12.9777, lng: -38.5016, uf: 'BA', name: 'Salvador', microrregiao: 'Metropolitana Salvador', rodovia: 'BR-116 / BR-324', poloAtendimento: 'MONTES CLAROS' },
  'VITÓRIA DA CONQUISTA': { lat: -14.8661, lng: -40.8394, uf: 'BA', name: 'Vitória da Conquista', microrregiao: 'Sudoeste Baiano', rodovia: 'BR-251 / BR-116', poloAtendimento: 'MONTES CLAROS' },
  'VITORIA DA CONQUISTA': { lat: -14.8661, lng: -40.8394, uf: 'BA', name: 'Vitória da Conquista', microrregiao: 'Sudoeste Baiano', rodovia: 'BR-251 / BR-116', poloAtendimento: 'MONTES CLAROS' },
  'GUANAMBI': { lat: -14.2233, lng: -42.7814, uf: 'BA', name: 'Guanambi', microrregiao: 'Guanambi', rodovia: 'BR-122 / BR-030', poloAtendimento: 'MONTES CLAROS' },
  'SÃO PAULO': { lat: -23.5505, lng: -46.6333, uf: 'SP', name: 'São Paulo', microrregiao: 'Grande SP', rodovia: 'BR-381 (Fernão Dias)', poloAtendimento: 'DIVINOPOLIS' },
  'SAO PAULO': { lat: -23.5505, lng: -46.6333, uf: 'SP', name: 'São Paulo', microrregiao: 'Grande SP', rodovia: 'BR-381 (Fernão Dias)', poloAtendimento: 'DIVINOPOLIS' },
  'RIO DE JANEIRO': { lat: -22.9068, lng: -43.1729, uf: 'RJ', name: 'Rio de Janeiro', microrregiao: 'Grande Rio', rodovia: 'BR-040', poloAtendimento: 'DIVINOPOLIS' },
  'BRASÍLIA': { lat: -15.7975, lng: -47.8919, uf: 'DF', name: 'Brasília', microrregiao: 'Distrito Federal', rodovia: 'BR-040 / BR-251', poloAtendimento: 'MONTES CLAROS' },
  'BRASILIA': { lat: -15.7975, lng: -47.8919, uf: 'DF', name: 'Brasília', microrregiao: 'Distrito Federal', rodovia: 'BR-040 / BR-251', poloAtendimento: 'MONTES CLAROS' },
};

// Polos Regionais de Referência para exibição permanente no mapa
export const MG_REFERENCE_CITIES = [
  { name: 'Montes Claros', lat: -16.7282, lng: -43.8644, hub: 'MONTES CLAROS' as const },
  { name: 'Divinópolis', lat: -20.1444, lng: -44.8872, hub: 'DIVINOPOLIS' as const },
  { name: 'Belo Horizonte', lat: -19.9167, lng: -43.9345, hub: 'DIVINOPOLIS' as const },
  { name: 'Janaúba', lat: -15.8028, lng: -43.3089, hub: 'MONTES CLAROS' as const },
  { name: 'Bocaiúva', lat: -17.1078, lng: -43.815, hub: 'MONTES CLAROS' as const },
  { name: 'Pirapora', lat: -17.3556, lng: -44.9419, hub: 'MONTES CLAROS' as const },
  { name: 'Salinas', lat: -16.1708, lng: -42.29, hub: 'MONTES CLAROS' as const },
  { name: 'Nova Serrana', lat: -19.8761, lng: -44.9839, hub: 'DIVINOPOLIS' as const },
  { name: 'Itaúna', lat: -20.0756, lng: -44.5761, hub: 'DIVINOPOLIS' as const },
  { name: 'Formiga', lat: -20.4639, lng: -45.4264, hub: 'DIVINOPOLIS' as const },
  { name: 'Bom Despacho', lat: -19.7358, lng: -45.2536, hub: 'DIVINOPOLIS' as const },
  { name: 'Pará de Minas', lat: -19.8597, lng: -44.6081, hub: 'DIVINOPOLIS' as const },
  { name: 'Oliveira', lat: -20.6975, lng: -44.8267, hub: 'DIVINOPOLIS' as const },
  { name: 'Passos', lat: -20.7189, lng: -46.6097, hub: 'DIVINOPOLIS' as const },
];

/**
 * Normaliza qualquer texto de cidade retirando acentos, pontuação, sufixos de UF e ruídos
 */
export function normalizeCityKey(raw?: string): string {
  if (!raw) return 'DIVINOPOLIS';

  // Remove CEP, números, complementos e pontuações
  let clean = raw
    .replace(/\b\d{5}-?\d{3}\b/g, '')
    .replace(/\b(RUA|AV|AVENIDA|BAIRRO|CENTRO|RODOVIA|PRAÇA|PRACA|LOT|QUADRA)\b.*/gi, '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // Trata formatos "Cidade - MG" ou "Cidade/MG"
  if (clean.includes('-')) {
    const parts = clean.split('-');
    if (parts.length >= 2) {
      const candidate = parts[parts.length - 2].trim();
      if (candidate.length >= 3) clean = candidate;
    }
  } else if (clean.includes('/')) {
    const parts = clean.split('/');
    if (parts.length >= 2) {
      const candidate = parts[0].trim();
      if (candidate.length >= 3) clean = candidate;
    }
  }

  // Atalhos frequentes
  if (clean.includes('MONTES CLAROS') || clean === 'MOC') return 'MONTES CLAROS';
  if (clean.includes('DIVINOPOLIS')) return 'DIVINOPOLIS';
  if (clean.includes('BELO HORIZONTE') || clean === 'BH') return 'BELO HORIZONTE';
  if (clean.includes('NOVA SERRANA')) return 'NOVA SERRANA';
  if (clean.includes('SAO SEBASTIAO DO PARAISO') || clean.includes('PARAIS')) return 'SAO SEBASTIAO DO PARAISO';

  // Verifica se o texto limpo bate com algum município de MG
  if (mgCentroids[clean]) return clean;

  // Busca por ocorrência contida na base de 853 cidades de MG
  for (const k in mgCentroids) {
    if (k.length >= 4 && (clean === k || clean.includes(k) || k.includes(clean))) {
      return k;
    }
  }

  // Verifica na tabela manual de CITY_COORDINATES
  for (const k in CITY_COORDINATES) {
    if (clean.includes(k)) return k;
  }

  return clean;
}

/**
 * RESOLVEDOR GEOGRÁFICO DE ALTA PRECISÃO
 * Busca nas coordenadas dos 853 municípios de Minas Gerais (IBGE)
 * e garante que NENHUMA cidade fique perdida ou empilhada em um ponto genérico!
 */
export function resolveCityCoordinates(
  rawText?: string,
  preferredHubLat = -20.1444,
  preferredHubLng = -44.8872,
): CityGeoMetadata {
  const normKey = normalizeCityKey(rawText);

  // 1. Prioridade: Tabela com metadados de rodovias e polos
  if (CITY_COORDINATES[normKey]) {
    return { ...CITY_COORDINATES[normKey] };
  }

  // 2. Base Oficial de 853 Municípios de Minas Gerais (mgCentroids)
  if (mgCentroids[normKey]) {
    const c = mgCentroids[normKey];
    const isNorth = isMontesClarosRegion(normKey) || c.lat > -18.2;
    return {
      lat: c.lat,
      lng: c.lng,
      uf: 'MG',
      name: c.name,
      microrregiao: isNorth ? 'Norte de Minas' : 'Centro-Oeste de Minas',
      rodovia: isNorth ? 'BR-135 / BR-251' : 'MG-050 / BR-262',
      poloAtendimento: isNorth ? 'MONTES CLAROS' : 'DIVINOPOLIS',
    };
  }

  // 3. Fallback inteligente com dispersão determinística natural baseada no nome
  // (evita que pontos desconhecidos fiquem 100% encavalados no mesmo pixel)
  let hash = 0;
  for (let i = 0; i < normKey.length; i++) {
    hash = (hash << 5) - hash + normKey.charCodeAt(i);
    hash |= 0;
  }
  const offsetLat = ((Math.abs(hash) % 100) / 100 - 0.5) * 0.45;
  const offsetLng = (((Math.abs(hash) >> 4) % 100) / 100 - 0.5) * 0.45;

  return {
    lat: preferredHubLat + offsetLat,
    lng: preferredHubLng + offsetLng,
    uf: 'MG',
    name: rawText || 'Regional MG',
    microrregiao: 'Regional Minas Gerais',
    rodovia: 'Rodovia Estadual / BR',
    poloAtendimento: preferredHubLat > -18 ? 'MONTES CLAROS' : 'DIVINOPOLIS',
  };
}

export function isMontesClarosRegion(rawCity?: string): boolean {
  const key = normalizeCityKey(rawCity);
  const meta = CITY_COORDINATES[key];
  if (meta?.poloAtendimento) {
    return meta.poloAtendimento === 'MONTES CLAROS';
  }
  const c = mgCentroids[key];
  if (c && c.lat > -18.3) {
    return true;
  }
  return (
    key.includes('MONTES CLAROS') ||
    key === 'MOC' ||
    key.includes('JANAUBA') ||
    key.includes('BOCAIUVA') ||
    key.includes('SALINAS') ||
    key.includes('PIRAPORA') ||
    key.includes('JANUARIA') ||
    key.includes('SAO FRANCISCO') ||
    key.includes('CORACAO') ||
    key.includes('BRASILIA DE MINAS') ||
    key.includes('PORTEIRINHA') ||
    key.includes('TAIOBEIRAS') ||
    key.includes('FRANCISCO SA') ||
    key.includes('JAIBA') ||
    key.includes('MIRABELA') ||
    key.includes('CAPITAO ENEAS')
  );
}

export function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export interface DeliveryRouteEstimate {
  haversineKm: number;
  roadKm: number;
  estimatedMinutes: number;
  formattedDuration: string;
  highway: string;
  estimatedFreightCost: number;
  waypoints: [number, number][];
}

/**
 * Calcula a rota rodoviária com curvatura natural e waypoints para Leaflet
 */
export function calculateDeliveryRoute(
  hubLat: number,
  hubLng: number,
  destLat: number,
  destLng: number,
  destCityKey: string,
  freightPerKm = 2.4,
): DeliveryRouteEstimate {
  const haversineKm = haversineDistanceKm(hubLat, hubLng, destLat, destLng);
  const meta = resolveCityCoordinates(destCityKey, hubLat, hubLng);
  const highway =
    meta.rodovia ||
    (isMontesClarosRegion(destCityKey) ? 'BR-135 / BR-251' : 'MG-050 / BR-494');

  if (haversineKm === 0) {
    return {
      haversineKm: 0,
      roadKm: 8,
      estimatedMinutes: 20,
      formattedDuration: '20 min (Urbano)',
      highway: 'Perímetro Urbano Local',
      estimatedFreightCost: 40,
      waypoints: [[hubLat, hubLng]],
    };
  }

  // Fator de sinuosidade médio em MG (~1.22x a distância em linha reta)
  const roadKm = Math.max(10, Math.round(haversineKm * 1.22));
  const travelMinutes = Math.round((roadKm / 68) * 60 + 15);
  const hours = Math.floor(travelMinutes / 60);
  const mins = travelMinutes % 60;
  const formattedDuration =
    hours > 0 ? `${hours}h ${String(mins).padStart(2, '0')}m` : `${mins} min`;

  const estimatedFreightCost = Math.round(50 + roadKm * freightPerKm);

  // Curva de Bézier suave para rota rodoviária no Leaflet
  const waypoints: [number, number][] = [];
  const dLat = destLat - hubLat;
  const dLng = destLng - hubLng;
  const perpLat = -dLng * 0.12;
  const perpLng = dLat * 0.12;
  const ctrlLat = (hubLat + destLat) / 2 + perpLat;
  const ctrlLng = (hubLng + destLng) / 2 + perpLng;

  const steps = 18;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const oneMinusT = 1 - t;
    const lat =
      oneMinusT * oneMinusT * hubLat +
      2 * oneMinusT * t * ctrlLat +
      t * t * destLat;
    const lng =
      oneMinusT * oneMinusT * hubLng +
      2 * oneMinusT * t * ctrlLng +
      t * t * destLng;
    waypoints.push([lat, lng]);
  }

  return {
    haversineKm,
    roadKm,
    estimatedMinutes: travelMinutes,
    formattedDuration,
    highway,
    estimatedFreightCost,
    waypoints,
  };
}

// ============================================================================
// CONFIGURAÇÃO DE TILES DE ALTA CONFIABILIDADE (SEM DEPENDÊNCIA DE API KEY)
// ============================================================================
export const MAP_API_KEY = 'dealflow_carto_v1';

export function getMapTileUrl(style: 'streets' | 'dark' | 'voyager' = 'voyager'): string {
  if (style === 'dark') {
    return 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
  }
  if (style === 'streets') {
    return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  }
  // CartoDB Voyager: limpo, moderno e com nomes de rodovias em alta legibilidade
  return 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
}

// ============================================================================
// MARCADORES PROFISSIONAIS COM CALIBRAÇÃO EXATA DE ÂNCORA (SEM DESLOCAMENTO)
// ============================================================================

/**
 * Marcador de Concessionária / Hub com radar pulsante concêntrico e emblema
 */
export function buildLowPolyHubMarkerHtml(params: {
  cityLabel: string;
  localCount: number;
  color: string;
  accentLight?: string;
  accentDark?: string;
  isSelected?: boolean;
}): string {
  const { cityLabel, localCount, color, isSelected } = params;
  const borderColor = isSelected ? '#f59e0b' : '#ffffff';

  return `
    <div style="
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      cursor: pointer;
      pointer-events: auto;
    ">
      <!-- Pulso de radar concêntrico animado -->
      <div style="
        position: absolute;
        top: 14px;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: ${color};
        opacity: 0.28;
        animation: radarPulse 2.4s ease-out infinite;
        pointer-events: none;
      "></div>

      <!-- Emblema Principal Hexagonal -->
      <div style="
        position: relative;
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        filter: drop-shadow(0 4px 8px rgba(0,0,0,0.45));
        background: ${color};
        border-radius: 12px;
        border: 2.5px solid ${borderColor};
        box-shadow: 0 0 12px ${color}88;
        transition: transform 0.2s ease;
      ">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 21h18"/>
          <path d="M5 21V7l8-4v18"/>
          <path d="M19 21V11l-6-4"/>
          <path d="M9 9v.01"/>
          <path d="M9 13v.01"/>
          <path d="M9 17v.01"/>
        </svg>

        <!-- Contador de Vendas da Sede -->
        <div style="
          position: absolute;
          top: -6px;
          right: -8px;
          background: #0f172a;
          color: #ffffff;
          font-size: 10px;
          font-weight: 900;
          font-family: ui-monospace, monospace;
          padding: 1px 5px;
          border-radius: 9999px;
          border: 1.5px solid ${color};
          box-shadow: 0 2px 4px rgba(0,0,0,0.5);
        ">
          ${localCount}
        </div>
      </div>

      <!-- Rótulo Elegante com Nome da Loja -->
      <div style="
        margin-top: 3px;
        background: ${isSelected ? '#f59e0b' : 'rgba(15, 23, 42, 0.94)'};
        color: ${isSelected ? '#0f172a' : '#ffffff'};
        font-size: 9.5px;
        font-weight: 800;
        padding: 2px 7px;
        border-radius: 6px;
        border: 1px solid ${isSelected ? '#0f172a' : color};
        white-space: nowrap;
        box-shadow: 0 2px 5px rgba(0,0,0,0.4);
        letter-spacing: 0.2px;
      ">
        ★ ${cityLabel}
      </div>
    </div>

    <style>
      @keyframes radarPulse {
        0% { transform: translate(-50%, -50%) scale(0.8); opacity: 0.55; }
        100% { transform: translate(-50%, -50%) scale(2.2); opacity: 0; }
      }
    </style>
  `;
}

/**
 * Marcador de Cidade com Formato Pin Gota de Alta Precisão (Bico aponta na coordenada exata)
 */
export function buildLowPolyCityMarkerHtml(params: {
  cityName: string;
  count: number;
  bgColor?: string;
  isSelected?: boolean;
}): string {
  const { cityName, count, bgColor = '#2563eb', isSelected = false } = params;
  const pinColor = isSelected ? '#f59e0b' : bgColor;

  return `
    <div style="
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      cursor: pointer;
      pointer-events: auto;
    ">
      <!-- Pin Gota com Sombra e Contorno -->
      <div style="
        position: relative;
        width: 30px;
        height: 38px;
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding-top: 4px;
        filter: drop-shadow(0 3px 6px rgba(0,0,0,0.45));
        transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
      ">
        <!-- SVG Pin Gota de Alta Precisão -->
        <svg viewBox="0 0 32 40" width="30" height="38" style="position: absolute; inset: 0;">
          <defs>
            <linearGradient id="grad-${cityName.replace(/\s+/g, '')}" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="${pinColor}" />
              <stop offset="100%" stop-color="${pinColor}dd" />
            </linearGradient>
          </defs>
          <path
            d="M16 0C7.16 0 0 7.16 0 16c0 10.5 13.6 22.8 14.8 23.9a1.7 1.7 0 0 0 2.4 0C18.4 38.8 32 26.5 32 16 32 7.16 24.84 0 16 0z"
            fill="url(#grad-${cityName.replace(/\s+/g, '')})"
            stroke="#ffffff"
            stroke-width="1.8"
          />
        </svg>

        <!-- Número de Vendas no Centro do Pin -->
        <span style="
          position: relative;
          color: #ffffff;
          font-size: 11px;
          font-weight: 900;
          font-family: ui-monospace, monospace;
          text-shadow: 0 1px 2px rgba(0,0,0,0.6);
        ">${count}</span>
      </div>

      <!-- Rótulo com Nome da Cidade -->
      <div style="
        margin-top: -3px;
        background: ${isSelected ? '#f59e0b' : 'rgba(15, 23, 42, 0.90)'};
        color: ${isSelected ? '#0f172a' : '#f8fafc'};
        font-size: 8.5px;
        font-weight: 800;
        padding: 1px 5px;
        border-radius: 4px;
        border: 1px solid ${isSelected ? '#0f172a' : 'rgba(255,255,255,0.2)'};
        white-space: nowrap;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      ">
        ${cityName}
      </div>
    </div>
  `;
}
