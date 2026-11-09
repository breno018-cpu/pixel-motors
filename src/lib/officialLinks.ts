export interface OfficialPortalLink {
  id: string;
  name: string;
  description: string;
  url: string;
  badge: string;
}

export const OFFICIAL_FREE_PORTALS: OfficialPortalLink[] = [
  {
    id: 'prf',
    name: 'PRF — Nada Consta (Federal)',
    description: 'Multas em rodovias federais que ainda não caíram no Detran estadual.',
    url: 'https://nada-consta.prf.gov.br/nada_consta/index.jsf',
    badge: '100% Gratuito',
  },
  {
    id: 'dnit',
    name: 'DNIT — Infrações em Rodovias',
    description: 'Consulta pública de radares e autuações em BRs.',
    url: 'https://servicos.dnit.gov.br/multas/',
    badge: '100% Gratuito',
  },
  {
    id: 'senatran',
    name: 'Portal de Serviços SENATRAN',
    description: 'Validação oficial de autenticidade do CRLV-e e restrições federais.',
    url: 'https://portalservicos.senatran.serpro.gov.br/',
    badge: 'Gov.br Oficial',
  },
];

export const STATE_DETRANS: Record<string, { name: string; url: string }> = {
  SP: { name: 'DETRAN-SP (São Paulo)', url: 'https://www.detran.sp.gov.br' },
  MG: { name: 'DETRAN-MG (Minas Gerais)', url: 'https://www.detran.mg.gov.br' },
  RJ: { name: 'DETRAN-RJ (Rio de Janeiro)', url: 'https://www.detran.rj.gov.br' },
  BA: { name: 'DETRAN-BA (Bahia)', url: 'https://www.detran.ba.gov.br' },
  PE: { name: 'DETRAN-PE (Pernambuco)', url: 'https://www.detran.pe.gov.br' },
  CE: { name: 'DETRAN-CE (Ceará)', url: 'https://www.detran.ce.gov.br' },
  PR: { name: 'DETRAN-PR (Paraná)', url: 'https://www.detran.pr.gov.br' },
  RS: { name: 'DETRAN-RS (Rio Grande do Sul)', url: 'https://www.detran.rs.gov.br' },
  SC: { name: 'DETRAN-SC (Santa Catarina)', url: 'https://www.detran.sc.gov.br' },
  GO: { name: 'DETRAN-GO (Goiás)', url: 'https://www.detran.go.gov.br' },
  DF: { name: 'DETRAN-DF (Distrito Federal)', url: 'https://www.detran.df.gov.br' },
  ES: { name: 'DETRAN-ES (Espírito Santo)', url: 'https://www.detran.es.gov.br' },
  MA: { name: 'DETRAN-MA (Maranhão)', url: 'https://www.detran.ma.gov.br' },
  PB: { name: 'DETRAN-PB (Paraíba)', url: 'https://www.detran.pb.gov.br' },
  RN: { name: 'DETRAN-RN (Rio Grande do Norte)', url: 'https://www.detran.rn.gov.br' },
  AL: { name: 'DETRAN-AL (Alagoas)', url: 'https://www.detran.al.gov.br' },
  SE: { name: 'DETRAN-SE (Sergipe)', url: 'https://www.detran.se.gov.br' },
  PI: { name: 'DETRAN-PI (Piauí)', url: 'https://www.detran.pi.gov.br' },
  PA: { name: 'DETRAN-PA (Pará)', url: 'https://www.detran.pa.gov.br' },
  AM: { name: 'DETRAN-AM (Amazonas)', url: 'https://www.detran.am.gov.br' },
  MT: { name: 'DETRAN-MT (Mato Grosso)', url: 'https://www.detran.mt.gov.br' },
  MS: { name: 'DETRAN-MS (Mato Grosso do Sul)', url: 'https://www.detran.ms.gov.br' },
};
