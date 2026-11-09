import jsPDF from 'jspdf';
import { generateContractFromTemplate, type ContractGenerationData } from './templatePdf';
import type { PickupPerson } from './pickupAuthorization';
import { DEFAULT_CONTRACT_WATERMARK } from '@/assets/contractWatermark';

export interface ContractVehicleLine {
  brand: string;
  model: string;
  year?: number | null;
  color?: string | null;
  chassis?: string | null;
  plate?: string | null;
  renavam?: string | null;
  price?: number | null;
}

export interface ContractData {
  /** Todos os veículos do contrato. Quando há mais de um, o PDF lista em tabela. */
  vehicles?: ContractVehicleLine[];
  contractNumber: string;
  contractType: 'venda' | 'repasse';
  createdAt: string;
  storeName: string;
  storeCnpj?: string;
  storeAddress?: string;
  storePhone?: string;
  storeEmail?: string;
  storeCity?: string;
  buyerName: string;
  buyerCpf: string;
  buyerPhone?: string;
  buyerEmail?: string;
  buyerAddress?: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleYear: number;
  vehicleColor?: string;
  vehicleChassis?: string;
  vehiclePlate?: string;
  vehicleRenavam?: string;
  salePrice: number;
  downPayment?: number;
  installments?: number;
  installmentValue?: number;
  paymentMethod?: string;
  resellerName?: string;
  operatorName?: string;
  notes?: string;
  signedAt?: string;
  status?: string;
  pickup?: PickupPerson | null;
}

export const CLASSIC_SALE_TEMPLATE = {
  header_content: '[center][b][size:12]CONTRATO DE COMPRA E VENDA DE VEÍCULO[/size][/b][/center]',
  body_content:
    'Pelo presente instrumento particular, de um lado [b]{{LOJA_RAZAO_SOCIAL}}[/b], com sede em {{LOJA_ENDERECO}} — {{LOJA_CIDADE}}, telefone {{LOJA_TELEFONE}}, doravante denominada [b]VENDEDORA[/b], e de outro lado [b]{{CLIENTE_NOME}}[/b], portador(a) do CPF/CNPJ nº {{CLIENTE_CPF}}, residente em {{CLIENTE_ENDERECO}}, telefone {{CLIENTE_TELEFONE}}, e-mail {{CLIENTE_EMAIL}}, doravante denominado(a) [b]COMPRADOR(A)[/b], têm entre si justo e contratado a compra e venda da motocicleta abaixo descrita:\n\n' +
    '[b]MOTOCICLETA:[/b] {{VEICULO_MARCA}} {{VEICULO_MODELO}} — [b]Ano:[/b] {{VEICULO_ANO}} — [b]Cor:[/b] {{VEICULO_COR}}\n' +
    '[b]Chassi:[/b] {{VEICULO_CHASSI}} — [b]Placa:[/b] {{VEICULO_PLACA}} — [b]Renavam:[/b] {{VEICULO_RENAVAM}}\n\n' +
    '[b]VALOR DA VENDA:[/b] {{VALOR_TOTAL}}, [b]Forma de Pagamento:[/b] {{FORMA_PAGAMENTO}}, [b]Entrada:[/b] {{VALOR_ENTRADA}}, [b]Parcelas:[/b] {{PARCELAS}} de {{VALOR_PARCELA}}',
  clauses_content:
    '[center][b]TERMO DE RESPONSABILIDADE E GARANTIA[/b][/center]\n' +
    'Declaro que estou vendendo o veículo acima descrito e que assumo total responsabilidade por quaisquer ocorrências relacionadas ao mesmo até a presente data de venda, incluindo multas, danos materiais e pessoais, respondendo civil e criminalmente, bem como por todo e qualquer tipo de débito, de qualquer espécie ou natureza. A partir desta venda, tais responsabilidades passam a ser integralmente do comprador acima identificado. Declaro ainda que, conforme a legislação vigente, o veículo será de responsabilidade exclusiva do comprador a partir desta data.\n\n' +
    '[b]CLÁUSULAS:[/b]\n' +
    '[b]1.[/b] A VENDEDORA transfere ao(à) COMPRADOR(A) a propriedade e posse do Veiculo acima descrita, livre de ônus, na presente data.\n' +
    '[b]2.[/b] O(A) COMPRADOR(A) declara ter vistoriado o Veiculo e a recebe no estado em que se encontra, sem direito a reclamações posteriores quanto a defeitos aparentes.\n' +
    '[b]3.[/b] A partir desta data, todas as responsabilidades civis, criminais e tributárias (multas, IPVA, licenciamento) passam a ser exclusivas do(a) COMPRADOR(A).\n' +
    '[b]4.[/b] Fica eleito o foro da comarca de {{LOJA_CIDADE}} para dirimir quaisquer questões oriundas deste contrato.',
  signature_content:
    '[center]{{LOJA_CIDADE}}, {{DATA_CONTRATO}}[/center]\n\n' +
    '[signatures]\nVENDEDORA | {{LOJA_RAZAO_SOCIAL}} || COMPRADOR(A) | {{CLIENTE_NOME}}\n[/signatures]',
  fixed_clauses: [] as string[],
  optional_clauses: [] as any[],
};

export const CLASSIC_REPASSE_TEMPLATE = {
  header_content: '[center][b][size:12]CONTRATO DE REPASSE DE VEÍCULO[/size][/b][/center]',
  body_content:
    'Pelo presente instrumento particular, de um lado [b]{{LOJA_RAZAO_SOCIAL}}[/b], com sede em {{LOJA_ENDERECO}} — {{LOJA_CIDADE}}, telefone {{LOJA_TELEFONE}}, doravante denominada [b]CEDENTE[/b], e de outro lado [b]{{CLIENTE_NOME}}[/b], portador(a) do CPF/CNPJ nº {{CLIENTE_CPF}}, residente em {{CLIENTE_ENDERECO}}, telefone {{CLIENTE_TELEFONE}}, e-mail {{CLIENTE_EMAIL}}, doravante denominado(a) [b]CESSIONÁRIO(A)[/b], têm entre si justo e contratado o repasse do veículo no estado em que se encontra:\n\n' +
    '[b]MOTOCICLETA:[/b] {{VEICULO_MARCA}} {{VEICULO_MODELO}} — [b]Ano:[/b] {{VEICULO_ANO}} — [b]Cor:[/b] {{VEICULO_COR}}\n' +
    '[b]Chassi:[/b] {{VEICULO_CHASSI}} — [b]Placa:[/b] {{VEICULO_PLACA}} — [b]Renavam:[/b] {{VEICULO_RENAVAM}}\n\n' +
    '[b]VALOR DO REPASSE:[/b] {{VALOR_TOTAL}}, [b]Forma de Pagamento:[/b] {{FORMA_PAGAMENTO}}, [b]Entrada:[/b] {{VALOR_ENTRADA}}, [b]Parcelas:[/b] {{PARCELAS}} de {{VALOR_PARCELA}}',
  clauses_content:
    '[center][b]TERMO DE RESPONSABILIDADE E CIÊNCIA DE REPASSE[/b][/center]\n' +
    'Declaro que estou adquirindo o veículo acima descrito em regime de REPASSE COMERCIAL, no estado e conservação mecânica e estética em que se encontra, assumindo total responsabilidade por quaisquer ocorrências relacionadas ao mesmo a partir desta data, incluindo multas, licenciamento, transferências e danos materiais ou pessoais. A CEDENTE fica isenta de garantia mecânica ou estrutural.\n\n' +
    '[b]CLÁUSULAS:[/b]\n' +
    '[b]1.[/b] A CEDENTE transfere ao(à) CESSIONÁRIO(A) a posse do veículo acima descrito, livre de ônus anteriores a esta data.\n' +
    '[b]2.[/b] O(A) CESSIONÁRIO(A) declara ter vistoriado o veículo e o recebe no estado em que se encontra, sem direito a reclamações posteriores.\n' +
    '[b]3.[/b] A partir desta data, todas as responsabilidades civis, criminais e tributárias passam a ser exclusivas do(a) CESSIONÁRIO(A).\n' +
    '[b]4.[/b] Fica eleito o foro da comarca de {{LOJA_CIDADE}} para dirimir quaisquer questões oriundas deste contrato.',
  signature_content:
    '[center]{{LOJA_CIDADE}}, {{DATA_CONTRATO}}[/center]\n\n' +
    '[signatures]\nCEDENTE | {{LOJA_RAZAO_SOCIAL}} || CESSIONÁRIO(A) | {{CLIENTE_NOME}}\n[/signatures]',
  fixed_clauses: [] as string[],
  optional_clauses: [] as any[],
};

function formatPaymentMethodLabel(method?: string): string {
  if (!method) return 'À Vista';
  const clean = method.toLowerCase().trim();
  if (clean.includes('vista') || clean === 'avista' || clean === 'dinheiro') return 'À Vista';
  if (clean.includes('financ')) return 'Financiamento';
  if (clean.includes('consorc')) return 'Consórcio';
  if (clean.includes('pix')) return 'PIX';
  if (clean.includes('cart') || clean.includes('credito')) return 'Cartão de Crédito';
  if (clean.includes('boleto')) return 'Boleto Bancário';
  if (clean.includes('parcel')) return 'Parcelado';
  return method;
}

/**
 * Converte os dados do contrato em ContractGenerationData e renderiza usando o
 * motor oficial elegante de 1 página (templatePdf), devolvendo o visual idêntico ao modelo original.
 */
export function generateContractPDF(data: ContractData): jsPDF {
  const isRepasse = data.contractType === 'repasse';
  const baseTemplate = isRepasse ? CLASSIC_REPASSE_TEMPLATE : CLASSIC_SALE_TEMPLATE;

  // Resolve cidade da loja com fallback inteligente
  const rawCity =
    data.storeCity ||
    (data.storeAddress?.match(/([A-Za-zÀ-ÖØ-öø-ÿ\s]+)\/([A-Z]{2})/)?.[0]) ||
    (data.storeAddress?.toLowerCase().includes('montes') ? 'MONTES CLAROS/MG' : '') ||
    (data.storeAddress?.toLowerCase().includes('divin') ? 'DIVINÓPOLIS/MG' : '') ||
    'MONTES CLAROS/MG';

  const storeCity = rawCity.toUpperCase();

  // Limpa o endereço para evitar duplicação com a cidade ao lado
  let cleanStoreAddress = (data.storeAddress || '').trim();
  if (cleanStoreAddress) {
    cleanStoreAddress = cleanStoreAddress
      .replace(new RegExp(`\\s*[—\\-]\\s*${storeCity}$`, 'i'), '')
      .replace(new RegExp(`\\s*,\\s*${storeCity}$`, 'i'), '')
      .replace(new RegExp(`\\s*-\\s*Centro,\\s*${storeCity}$`, 'i'), '')
      .trim();
  }

  // Monta notas / observações se houver
  let extraClauses = baseTemplate.clauses_content;
  if (data.notes && data.notes.trim()) {
    extraClauses += `\n\n[b]OBSERVAÇÕES ADICIONAIS:[/b]\n${data.notes.trim()}`;
  }

  const payload: ContractGenerationData = {
    template: {
      ...baseTemplate,
      clauses_content: extraClauses,
      watermark_data_url: DEFAULT_CONTRACT_WATERMARK,
      watermark_opacity: 0.10,
    },
    client: {
      name: data.buyerName ? data.buyerName.toUpperCase() : 'COMPRADOR',
      cpf: data.buyerCpf || '',
      address: data.buyerAddress || 'Não informado',
      phone: data.buyerPhone || '',
      email: data.buyerEmail || '',
    },
    vehicle: {
      brand: data.vehicleBrand ? data.vehicleBrand.toUpperCase() : 'SHINERAY',
      model: data.vehicleModel ? data.vehicleModel.toUpperCase() : 'MOTO',
      year: data.vehicleYear || 2026,
      color: data.vehicleColor || 'Padrão',
      chassis: data.vehicleChassis || '',
      plate: data.vehiclePlate || 'Sem placa',
      renavam: data.vehicleRenavam || '',
    },
    vehicles: data.vehicles,
    store: {
      name: data.storeName ? data.storeName.toUpperCase() : 'CONCESSIONÁRIA',
      cnpj: data.storeCnpj || '',
      address: cleanStoreAddress || 'AV. JOAO XXIII, Nº 990',
      city: storeCity,
      phone: data.storePhone || '',
      email: data.storeEmail || '',
    },
    reseller: data.resellerName ? { name: data.resellerName } : undefined,
    payment: {
      total: Number(data.salePrice) || 0,
      downPayment: data.downPayment ? Number(data.downPayment) : undefined,
      method: formatPaymentMethodLabel(data.paymentMethod),
      installments: data.installments || 1,
      installmentValue: data.installmentValue ? Number(data.installmentValue) : undefined,
    },
    contractNumber: data.contractNumber || 'CTR-000000',
    contractDate: data.createdAt
      ? new Date(data.createdAt).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        })
      : new Date().toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        }),
    pickup: data.pickup,
  };

  return generateContractFromTemplate(payload);
}

export function downloadContractPDF(data: ContractData): void {
  const doc = generateContractPDF(data);
  doc.save(`contrato_${data.contractNumber}.pdf`);
}

export function previewContractPDF(data: ContractData): string {
  const doc = generateContractPDF(data);
  return doc.output('dataurlstring');
}
