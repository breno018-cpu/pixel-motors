import {
  Instagram,
  Facebook,
  Search,
  MessageCircle,
  Store,
  Users,
  Megaphone,
  Repeat,
  Tag,
  HelpCircle,
  type LucideIcon,
} from 'lucide-react';

export interface LeadSourceOption {
  value: string;
  label: string;
  group: 'ANÚNCIO' | 'LOJA' | 'OUTROS';
  icon: LucideIcon;
  hint?: string;
  /** Pede um detalhe (campanha, anúncio, indicação...) */
  requiresDetail?: boolean;
  detailLabel?: string;
}

export const LEAD_SOURCES: LeadSourceOption[] = [
  {
    value: 'ANUNCIO_INSTAGRAM',
    label: 'Instagram',
    group: 'ANÚNCIO',
    icon: Instagram,
    hint: 'Post, story ou tráfego pago',
    requiresDetail: true,
    detailLabel: 'Campanha / anúncio',
  },
  {
    value: 'ANUNCIO_FACEBOOK',
    label: 'Facebook',
    group: 'ANÚNCIO',
    icon: Facebook,
    hint: 'Feed, grupos ou Meta Ads',
    requiresDetail: true,
    detailLabel: 'Campanha / anúncio',
  },
  {
    value: 'ANUNCIO_GOOGLE',
    label: 'Google',
    group: 'ANÚNCIO',
    icon: Search,
    hint: 'Busca ou Google Ads',
    requiresDetail: true,
    detailLabel: 'Campanha / palavra-chave',
  },
  {
    value: 'ANUNCIO_MARKETPLACE',
    label: 'Marketplace',
    group: 'ANÚNCIO',
    icon: Tag,
    hint: 'OLX, Mercado Livre, Webmotors...',
    requiresDetail: true,
    detailLabel: 'Qual plataforma',
  },
  {
    value: 'ANUNCIO_WHATSAPP',
    label: 'WhatsApp',
    group: 'ANÚNCIO',
    icon: MessageCircle,
    hint: 'Lista de transmissão / status',
  },
  {
    value: 'LOJA_PORTA',
    label: 'Porta de loja',
    group: 'LOJA',
    icon: Store,
    hint: 'Cliente entrou na loja',
  },
  {
    value: 'LOJA_PASSAGEM',
    label: 'Fachada / passagem',
    group: 'LOJA',
    icon: Megaphone,
    hint: 'Viu a vitrine ou faixa',
  },
  {
    value: 'INDICACAO',
    label: 'Indicação',
    group: 'OUTROS',
    icon: Users,
    hint: 'Amigo, cliente ou parceiro',
    requiresDetail: true,
    detailLabel: 'Quem indicou',
  },
  {
    value: 'CLIENTE_RECORRENTE',
    label: 'Cliente recorrente',
    group: 'OUTROS',
    icon: Repeat,
    hint: 'Já comprou antes',
  },
  {
    value: 'OUTRO',
    label: 'Outro',
    group: 'OUTROS',
    icon: HelpCircle,
    hint: 'Descreva a origem',
    requiresDetail: true,
    detailLabel: 'Descreva a origem',
  },
];

export const LEAD_SOURCE_GROUPS: LeadSourceOption['group'][] = ['ANÚNCIO', 'LOJA', 'OUTROS'];

export const LEAD_SOURCE_GROUP_LABELS: Record<LeadSourceOption['group'], string> = {
  'ANÚNCIO': 'Anúncios e mídia',
  LOJA: 'Loja física',
  OUTROS: 'Outras origens',
};

export function getLeadSource(value?: string | null) {
  if (!value) return undefined;
  return LEAD_SOURCES.find((s) => s.value === value);
}

export function leadSourceLabel(value?: string | null, detail?: string | null) {
  const source = getLeadSource(value);
  const base = source?.label || value || 'Não informado';
  return detail ? `${base} — ${detail}` : base;
}
