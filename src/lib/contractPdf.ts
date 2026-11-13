import jsPDF from 'jspdf';
import { generateContractFromTemplate, type ContractGenerationData } from './templatePdf';
import type { PickupPerson } from './pickupAuthorization';
import { DEFAULT_CONTRACT_WATERMARK } from '@/assets/contractWatermark';
import { SEMINOVOS_CONTRACT_WATERMARK } from '@/assets/seminovosWatermark';

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
  contractType: 'venda' | 'repasse' | 'seminovo';
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
    'Pelo presente instrumento particular, de um lado [b]{{LOJA_RAZAO_SOCIAL}}[/b], estabelecida em {{LOJA_ENDERECO}} — {{LOJA_CIDADE}}, telefone {{LOJA_TELEFONE}}, doravante denominada [b]VENDEDORA[/b], e de outro lado [b]{{CLIENTE_NOME}}[/b], portador(a) do CPF/CNPJ nº {{CLIENTE_CPF}}, residente em {{CLIENTE_ENDERECO}}, telefone {{CLIENTE_TELEFONE}}, e-mail {{CLIENTE_EMAIL}}, doravante denominado(a) [b]COMPRADOR(A)[/b], têm entre si justo e contratado a compra e venda da motocicleta abaixo descrita:\n\n' +
    '[b]MOTOCICLETA:[/b] {{VEICULO_MARCA}} {{VEICULO_MODELO}} — [b]Ano:[/b] {{VEICULO_ANO}} — [b]Cor:[/b] {{VEICULO_COR}}\n' +
    '[b]Chassi:[/b] {{VEICULO_CHASSI}} — [b]Placa:[/b] {{VEICULO_PLACA}} — [b]Renavam:[/b] {{VEICULO_RENAVAM}}\n\n' +
    '[b]VALOR DA VENDA:[/b] {{VALOR_TOTAL}}, [b]Forma de Pagamento:[/b] {{FORMA_PAGAMENTO}}, [b]Entrada:[/b] {{VALOR_ENTRADA}}, [b]Parcelas:[/b] {{PARCELAS}} de {{VALOR_PARCELA}}',
  clauses_content:
    '[center][b]TERMO DE RESPONSABILIDADE E GARANTIA[/b][/center]\n' +
    'Declaro que estou vendendo o veículo acima descrito e que assumo total responsabilidade por quaisquer ocorrências relacionadas ao mesmo até a presente data de venda, incluindo multas, danos materiais e pessoais, respondendo civil e criminalmente, bem como por todo e qualquer tipo de débito, de qualquer espécie ou natureza. A partir desta venda, tais responsabilidades passam a ser integralmente do comprador acima identificado. Declaro ainda que, conforme a legislação vigente, o veículo será de responsabilidade exclusiva do comprador a partir desta data.\n\n' +
    '[b]CLÁUSULAS:[/b]\n' +
    '[b]1.[/b] A VENDEDORA transfere ao(à) COMPRADOR(A) a propriedade e posse da motocicleta acima descrita, livre de ônus, na presente data.\n' +
    '[b]2.[/b] O(A) COMPRADOR(A) declara ter vistoriado a motocicleta e a recebe no estado em que se encontra, sem direito a reclamações posteriores quanto a defeitos aparentes.\n' +
    '[b]3.[/b] A partir desta data, todas as responsabilidades civis, criminais e tributárias (multas, IPVA, licenciamento) passam a ser exclusivas do(a) COMPRADOR(A).\n' +
    '[b]4.[/b] Fica eleito o foro da comarca de {{LOJA_CIDADE}} para dirimir quaisquer questões oriundas deste contrato.',
  signature_content:
    '[center]{{LOJA_CIDADE}}, {{DATA_CONTRATO}}[/center]\n\n' +
    '[signatures]\nVENDEDORA | {{LOJA_RAZAO_SOCIAL}} || COMPRADOR(A) | {{CLIENTE_NOME}}\n[/signatures]',
  fixed_clauses: [] as string[],
  optional_clauses: [] as any[],
};




export const CLASSIC_SEMINOVOS_TEMPLATE = {
  header_content: '[center][b][size:12]CONTRATO DE COMPRA E VENDA DE VEÍCULO SEMINOVO & MULTIMARCAS[/size][/b][/center]',
  body_content:
    'Pelo presente instrumento particular de compra e venda, de um lado [b]{{LOJA_RAZAO_SOCIAL}}[/b], inscrita no CNPJ sob o nº [b]{{LOJA_CNPJ}}[/b], estabelecida em {{LOJA_ENDERECO}} — {{LOJA_CIDADE}}, doravante denominada simplesmente [b]VENDEDORA[/b], e de outro lado [b]{{CLIENTE_NOME}}[/b], portador(a) do CPF/CNPJ nº {{CLIENTE_CPF}}, residente e domiciliado(a) em {{CLIENTE_ENDERECO}}, telefone {{CLIENTE_TELEFONE}}, e-mail {{CLIENTE_EMAIL}}, doravante denominado(a) [b]COMPRADOR(A)[/b], têm entre si justo e convencionado a compra e venda do veículo seminovo/usado abaixo caracterizado:\n\n' +
    '[b]VEÍCULO SEMINOVO:[/b] {{VEICULO_MARCA}} {{VEICULO_MODELO}} — [b]Ano Fabricação/Modelo:[/b] {{VEICULO_ANO}} — [b]Cor:[/b] {{VEICULO_COR}}\n' +
    '[b]Chassi:[/b] {{VEICULO_CHASSI}} — [b]Placa:[/b] {{VEICULO_PLACA}} — [b]Renavam:[/b] {{VEICULO_RENAVAM}}\n\n' +
    '[b]VALOR DA TRANSAÇÃO:[/b] {{VALOR_TOTAL}}, [b]Forma de Pagamento:[/b] {{FORMA_PAGAMENTO}}, [b]Entrada:[/b] {{VALOR_ENTRADA}}, [b]Saldo Parcelado:[/b] {{PARCELAS}} de {{VALOR_PARCELA}}',
  clauses_content:
    '[center][b]TERMO DE VISTORIA CAUTELAR, PROCEDÊNCIA E GARANTIA LEGAL DE MOTOR E CÂMBIO[/b][/center]\n' +
    'O(A) COMPRADOR(A) declara para todos os fins de direito que realizou prévia e minuciosa vistoria física e mecânica no veículo seminovo acima descrito, conferindo o estado da funilaria, pintura, mecânica, tapeçaria, conjunto elétrico, numeração de agregados e quilometragem do hodômetro, recebendo-o no exato estado em que se encontra.\n\n' +
    '[b]CLÁUSULAS CONTRATUAIS ESPECÍFICAS:[/b]\n' +
    '[b]1. PROCEDÊNCIA E POSSE:[/b] A VENDEDORA transmite ao(à) COMPRADOR(A) a posse e propriedade do veículo, livre e desembaraçado de gravames financeiros, multas, débitos fiscais ou quaisquer ônus pretéritos à data da entrega.\n' +
    '[b]2. GARANTIA LEGAL DE 90 DIAS (CDC ART. 26, II):[/b] A VENDEDORA concede garantia legal estrita de 90 (noventa) dias, a contar da entrega do veículo, limitada EXCLUSIVAMENTE aos componentes internos lubrificados de MOTOR e CAIXA DE CÂMBIO. Ficam expressamente EXCLUÍDOS da garantia componentes de desgaste natural pelo uso (pneus, pastilhas/lonas de freio, discos, lâmpadas, bateria, palhetas, suspensão, amortecedores, embreagem e fluidos), bem como defeitos decorrentes de má condução, sobrecarga, adulteração de combustível ou revisões fora dos padrões técnicos.\n' +
    '[b]3. RESPONSABILIDADE CIVIL E DE TRÂNSITO:[/b] A partir do ato de entrega e saída do veículo do pátio da concessionária, todas as responsabilidades cíveis, criminais, administrativas e pontuações por infrações de trânsito (multas) passam a ser de integral responsabilidade do(a) COMPRADOR(A).\n' +
    '[b]4. TRANSFERÊNCIA NO DETRAN:[/b] O(A) COMPRADOR(A) assume a obrigação formal de transferir o registro de propriedade do veículo junto ao DETRAN no prazo legal improrrogável de 30 (trinta) dias.\n' +
    '[b]5. FORO:[/b] As partes elegem o foro da comarca de {{LOJA_CIDADE}} para dirimir qualquer dúvida fundada neste instrumento.',
  signature_content:
    '[center]{{LOJA_CIDADE}}, {{DATA_CONTRATO}}[/center]\n\n' +
    '[signatures]\nVENDEDORA | {{LOJA_RAZAO_SOCIAL}} || COMPRADOR(A) | {{CLIENTE_NOME}}\n[/signatures]',
  fixed_clauses: [] as string[],
  optional_clauses: [] as any[],
};

export const CLASSIC_REPASSE_TEMPLATE = {
  header_content: '[center][b][size:12]CONTRATO DE REPASSE DE VEÍCULO[/size][/b][/center]',
  body_content:
    'Pelo presente instrumento particular, de um lado [b]{{LOJA_RAZAO_SOCIAL}}[/b], estabelecida em {{LOJA_ENDERECO}} — {{LOJA_CIDADE}}, telefone {{LOJA_TELEFONE}}, doravante denominada [b]CEDENTE[/b], e de outro lado [b]{{CLIENTE_NOME}}[/b], portador(a) do CPF/CNPJ nº {{CLIENTE_CPF}}, residente em {{CLIENTE_ENDERECO}}, telefone {{CLIENTE_TELEFONE}}, e-mail {{CLIENTE_EMAIL}}, doravante denominado(a) [b]CESSIONÁRIO(A)[/b], têm entre si justo e contratado o repasse do veículo no estado em que se encontra:\n\n' +
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
  const brand = (data.vehicleBrand || '').toUpperCase().trim();
  const model = (data.vehicleModel || '').toUpperCase().trim();
  const isShineray = brand.includes('SHINERAY') || model.includes('SHINERAY') || !brand;

  let baseTemplate = CLASSIC_SALE_TEMPLATE;
  let accentColor: [number, number, number] = [237, 28, 36]; // Vermelho Oficial Shineray
  let watermarkDataUrl: string | null = DEFAULT_CONTRACT_WATERMARK;

  if (isRepasse) {
    baseTemplate = CLASSIC_REPASSE_TEMPLATE;
    accentColor = [51, 65, 85]; // Grafite Slate Industrial (#334155)
    watermarkDataUrl = null; // Sem logotipo para repasse no estado
  } else if (!isShineray && data.contractType === 'seminovo') {
    // Apenas seminovos de OUTRA marca (multimarcas) utilizam template de seminovos
    baseTemplate = CLASSIC_SEMINOVOS_TEMPLATE;
    accentColor = [15, 44, 89]; // Azul Marinho Executivo / Navy Blue (#0F2C59)
    watermarkDataUrl = SEMINOVOS_CONTRACT_WATERMARK; // Selo exclusivo "SEMINOVOS & MULTIMARCAS GRUPO L1MA"
  }

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

  // Nome da loja limpo (sem Matriz, sem Sede, sem Polo Norte)
  let cleanStoreName = (data.storeName || 'CONCESSIONÁRIA').trim();
  cleanStoreName = cleanStoreName
    .replace(/\s*\(Matriz\s*Oeste\)/gi, '')
    .replace(/\s*\(Polo\s*Norte\)/gi, '')
    .replace(/\s*\(Matriz\)/gi, '')
    .trim();

  // Para motos Shineray, padroniza a razão social oficial exatamente como no contrato original
  if (isShineray) {
    if (storeCity.includes('MONTES') || cleanStoreName.toUpperCase().includes('MONTES')) {
      cleanStoreName = 'SHINERAY GRUPO L1MA MOTORS MONTES CLAROS';
    } else if (storeCity.includes('DIVIN') || cleanStoreName.toUpperCase().includes('DIVIN')) {
      cleanStoreName = 'SHINERAY GRUPO L1MA MOTORS DIVINOPOLIS';
    }
  }

  // Cláusulas: para Shineray, utiliza estritamente o texto clássico original sem poluí-lo com notas de sistema
  let extraClauses = baseTemplate.clauses_content;
  if (
    data.notes &&
    data.notes.trim() &&
    !data.notes.includes('Modelo: Contrato') &&
    !data.notes.includes('Financiamento bancário')
  ) {
    extraClauses += `\n\n[b]OBSERVAÇÕES ADICIONAIS:[/b]\n${data.notes.trim()}`;
  }

  const payload: ContractGenerationData = {
    template: {
      ...baseTemplate,
      clauses_content: extraClauses,
      accent_color: (data as any).accentColor || accentColor,
      watermark_data_url: (data as any).watermarkUrl !== undefined
        ? (data as any).watermarkUrl
        : watermarkDataUrl,
      watermark_opacity: (data as any).watermarkOpacity ?? (!isShineray && data.contractType === 'seminovo' ? 0.14 : 0.10),
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
      name: cleanStoreName.toUpperCase(),
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
  const safeNumber = String(data.contractNumber || 'CTR-000000').replace(/[\/\\:*?"<>|]/g, '-');
  doc.save(`contrato_${safeNumber}.pdf`);
}

export function previewContractPDF(data: ContractData): string {
  const doc = generateContractPDF(data);
  return doc.output('dataurlstring');
}
