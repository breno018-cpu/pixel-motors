/**
 * Centralizador de Resolução e Normalização de Dados Financeiros e Contratuais
 * Garante que NENHUM contrato apresente dados distorcidos (parcelas erradas, "1x de R$ 0,00",
 * "R$ R$", ausência de banco de financiamento ou endereços incompletos).
 */

import { maskCPF, maskCNPJ } from '@/lib/masks';

export function formatPlate(plate: string): string {
  const clean = plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (clean.length === 7) {
    if (/^[A-Z]{3}[0-9][A-Z][0-9]{2}$/.test(clean)) {
      return clean;
    }
    return `${clean.slice(0, 3)}-${clean.slice(3)}`;
  }
  return plate.toUpperCase().trim();
}

export interface ResolvedContractFinancials {
  salePrice: number;
  downPayment: number;
  paymentMethod: string;
  installments: number;
  installmentValue: number;
  isFinanced: boolean;
  isCardInstallments: boolean;
  isCash: boolean;
  bankName: string | null;
  paymentConditionText: string;
  cleanNotes: string;
  fullBuyerAddress: string;
  vehiclePlateText: string;
  vehicleChassisText: string;
  vehicleYearText: string;
}

export function formatCurrencyBRL(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

export function parseNumberBRL(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const s = String(val).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

/**
 * Extrai valores numéricos de parcelas embutidos em textos/observações
 * Ex: "Financiamento: 48x de R$ R$ 753,27 (PAN)" -> { installments: 48, value: 753.27, bank: 'PAN' }
 */
export function extractInstallmentInfoFromNotes(notes?: string | null): {
  installments?: number;
  installmentValue?: number;
  bank?: string;
} {
  if (!notes) return {};
  const res: { installments?: number; installmentValue?: number; bank?: string } = {};

  // 1. Número de parcelas: (\d+)x
  const matchQty = notes.match(/(\d{1,2})\s*x/i);
  if (matchQty && parseInt(matchQty[1], 10) > 1) {
    res.installments = parseInt(matchQty[1], 10);
  }

  // 2. Valor da parcela: \d+x\s*de\s*(?:R\$\s*)*([\d.,]+)
  const matchVal = notes.match(/\d+x\s*de\s*(?:R\$\s*)*([\d.]+(?:,\d{2})?)/i);
  if (matchVal && matchVal[1]) {
    const parsed = parseNumberBRL(matchVal[1]);
    if (parsed > 0) {
      res.installmentValue = parsed;
    }
  }

  // 3. Banco entre parênteses: (PAN), (ALTIS), (SANTANDER), (BRADESCO), (MOTRIX)
  const matchBank = notes.match(/\((PAN|ALTIS|MOTRIX|SANTANDER|BRADESCO|ITAU|BV|OMNI|SAFRA)[^)]*\)/i);
  if (matchBank && matchBank[1]) {
    res.bank = matchBank[1].toUpperCase();
  }

  return res;
}

/**
 * Resolve todos os dados contratuais com tolerância a dados legados e semântica impecável
 */
export function resolveContractFinancialData(sale: any): ResolvedContractFinancials {
  const ext = (sale?.external_data || {}) as any;
  const rawNotes = String(sale?.notes || ext?.observacoes || '').trim();

  // Limpa o bug de duplo "R$ R$" em qualquer texto de observação
  const cleanNotes = rawNotes
    .replace(/R\$\s*R\$/gi, 'R$')
    .replace(/\s+/g, ' ')
    .trim();

  const notesInfo = extractInstallmentInfoFromNotes(cleanNotes);

  const salePrice = Number(sale?.sale_price || sale?.salePrice || ext?.valor || (sale as any)?.valor || 0);

  // Discriminativos de entrada
  const pixVal = Number(sale?.down_payment_pix ?? sale?.downPaymentPix ?? ext?.pix ?? 0);
  const cashVal = Number(sale?.down_payment_cash ?? sale?.downPaymentCash ?? ext?.dinheiro ?? 0);
  const cardVal = Number(sale?.down_payment_card ?? sale?.downPaymentCard ?? ext?.cartao ?? 0);
  const tradeInVal = Number(ext?.trade_in_value ?? ext?.troca ?? 0);
  const explicitDownPay = Number(sale?.down_payment ?? sale?.downPayment ?? 0);

  // Financiamento
  const explicitFinVal = Number(
    sale?.financed_amount ??
    sale?.financedAmount ??
    ext?.financiamento ??
    (sale as any)?.financiamento ??
    0
  );

  const bankCandidate = (
    sale?.financing_bank ||
    sale?.financingBank ||
    ext?.banco ||
    ext?.financing_bank ||
    notesInfo.bank ||
    ''
  ).toUpperCase().trim();

  const bankName = bankCandidate && bankCandidate !== 'NULL' && bankCandidate !== 'UNDEFINED' ? bankCandidate : null;

  const rawPaymentMethod = String(
    sale?.payment_method ||
    sale?.paymentMethod ||
    ext?.payment_method ||
    ext?.payment_method_category ||
    ''
  ).toLowerCase().trim();

  const isFinanced =
    rawPaymentMethod.includes('financ') ||
    explicitFinVal > 0 ||
    Boolean(bankName) ||
    Number(sale?.financing_installments || sale?.financingInstallments || 0) > 1 ||
    Boolean(notesInfo.bank);

  const cardInstallmentsCandidate =
    Number(sale?.down_payment_card_installments || sale?.downPaymentCardInstallments) ||
    Number(ext?.card_installments) ||
    (cleanNotes.toLowerCase().includes('cartão') ? notesInfo.installments : 0) ||
    1;

  const isCardInstallments =
    !isFinanced &&
    cardInstallmentsCandidate > 1 &&
    (cardVal > 0 || rawPaymentMethod.includes('cart'));

  const isBoleto =
    rawPaymentMethod.includes('boleto') ||
    Number(ext?.boleto || 0) > 0 ||
    cleanNotes.toLowerCase().includes('boleto');

  const isCash = !isFinanced && !isCardInstallments && !isBoleto;

  // Resolução de Parcelas e Valor da Parcela
  let installments = 1;
  let installmentValue = 0;
  let downPayment = 0;
  let paymentMethod = 'À Vista';

  if (isFinanced) {
    // 1. Quantidade de parcelas do financiamento
    installments =
      Number(sale?.financing_installments) ||
      Number(sale?.financingInstallments) ||
      Number(sale?.installments) ||
      Number(ext?.financing_installments) ||
      notesInfo.installments ||
      48;

    // 2. Valor da parcela do financiamento (prioriza o valor real com juros registrado)
    const dbInstVal = Number(sale?.financing_installment_value) || Number(sale?.financingInstallmentValue) || Number(sale?.installment_value) || Number(sale?.installmentValue) || Number(ext?.financing_installment_value) || 0;
    if (dbInstVal > 0 && Math.abs(dbInstVal - (salePrice / installments)) > 1) {
      installmentValue = dbInstVal;
    } else if (notesInfo.installmentValue && notesInfo.installmentValue > 0) {
      installmentValue = notesInfo.installmentValue;
    } else if (dbInstVal > 0) {
      installmentValue = dbInstVal;
    } else {
      const financedNet = explicitFinVal > 0 ? explicitFinVal : Math.max(0, salePrice - explicitDownPay);
      installmentValue = installments > 0 ? financedNet / installments : 0;
    }

    // 3. Entrada
    const calcDownPay = pixVal + cashVal + tradeInVal + (cardInstallmentsCandidate <= 1 ? cardVal : 0);
    downPayment = explicitDownPay > 0 ? explicitDownPay : calcDownPay;
    if (downPayment >= salePrice) {
      // Se a entrada computada estava como o total da venda, ajusta para o valor não financiado
      downPayment = Math.max(0, salePrice - (explicitFinVal > 0 ? explicitFinVal : (installmentValue * installments)));
    }

    paymentMethod = bankName ? `Financiamento Bancário (${bankName})` : 'Financiamento Bancário';

  } else if (isCardInstallments) {
    installments = cardInstallmentsCandidate;
    const cardInstValCandidate = Number(ext?.card_installment_value) || 0;
    installmentValue = cardInstValCandidate > 0
      ? cardInstValCandidate
      : (cardVal > 0 ? cardVal / installments : salePrice / installments);
    downPayment = pixVal + cashVal + tradeInVal;
    paymentMethod = `Cartão de Crédito (${installments}x)`;

  } else if (isBoleto) {
    installments = Number(ext?.boleto_parcelas) || notesInfo.installments || 12;
    const boletoVal = Number(ext?.boleto) || (salePrice - explicitDownPay);
    installmentValue = installments > 0 ? boletoVal / installments : 0;
    downPayment = explicitDownPay > 0 ? explicitDownPay : (pixVal + cashVal);
    paymentMethod = `Boleto Bancário (${installments}x)`;

  } else {
    // Venda À Vista
    installments = 1;
    installmentValue = 0;
    downPayment = salePrice;

    if (pixVal > 0 && cashVal > 0) {
      paymentMethod = 'À Vista (PIX / Dinheiro em Espécie)';
    } else if (pixVal > 0) {
      paymentMethod = 'À Vista (PIX)';
    } else if (cashVal > 0) {
      paymentMethod = 'À Vista (Dinheiro em Espécie)';
    } else if (cardVal > 0) {
      paymentMethod = 'À Vista (Cartão de Débito / Crédito 1x)';
    } else if (rawPaymentMethod.includes('pix')) {
      paymentMethod = 'À Vista (PIX)';
    } else {
      paymentMethod = 'À Vista';
    }
  }

  // Texto legível da condição de pagamento
  let paymentConditionText = '';
  if (isFinanced) {
    paymentConditionText = `[b]VALOR DA VENDA:[/b] ${formatCurrencyBRL(salePrice)}, [b]Forma de Pagamento:[/b] ${paymentMethod}${downPayment > 0 ? `, [b]Entrada:[/b] ${formatCurrencyBRL(downPayment)}` : ''}, [b]Financiamento:[/b] ${installments}x de ${formatCurrencyBRL(installmentValue)}`;
  } else if (isCardInstallments) {
    paymentConditionText = `[b]VALOR DA VENDA:[/b] ${formatCurrencyBRL(salePrice)}, [b]Forma de Pagamento:[/b] ${paymentMethod}${downPayment > 0 ? `, [b]Entrada:[/b] ${formatCurrencyBRL(downPayment)}` : ''}, [b]Parcelas:[/b] ${installments}x de ${formatCurrencyBRL(installmentValue)}`;
  } else if (isBoleto) {
    paymentConditionText = `[b]VALOR DA VENDA:[/b] ${formatCurrencyBRL(salePrice)}, [b]Forma de Pagamento:[/b] ${paymentMethod}${downPayment > 0 ? `, [b]Entrada:[/b] ${formatCurrencyBRL(downPayment)}` : ''}, [b]Parcelas:[/b] ${installments}x de ${formatCurrencyBRL(installmentValue)}`;
  } else {
    paymentConditionText = `[b]VALOR DA VENDA:[/b] ${formatCurrencyBRL(salePrice)}, [b]Forma de Pagamento:[/b] ${paymentMethod}, [b]Condição:[/b] Pagamento Integral à Vista (${formatCurrencyBRL(salePrice)})`;
  }

  // Endereço completo do comprador
  let fullBuyerAddress = '';
  if (ext?.buyer_street) {
    const parts = [
      `${ext.buyer_street}${ext.buyer_number ? ', nº ' + ext.buyer_number : ', S/N'}`,
      ext.buyer_complement ? ext.buyer_complement : '',
      ext.buyer_neighborhood ? `Bairro ${ext.buyer_neighborhood}` : '',
      ext.buyer_city ? ext.buyer_city : '',
      ext.buyer_state ? ext.buyer_state : 'MG',
    ].filter(Boolean);
    fullBuyerAddress = parts.join(' - ');
    if (ext.buyer_cep) {
      fullBuyerAddress += ` (CEP ${ext.buyer_cep})`;
    }
  } else {
    fullBuyerAddress = sale?.buyer_address || sale?.buyerAddress || ext?.buyer_address || 'Endereço não informado';
  }

  // Placa e chassi do veículo
  const veh = sale?.vehicle || {};
  const rawPlate = (veh.plate || sale?.vehiclePlate || ext?.placa || (sale as any)?.placa || '').trim();
  const rawChassis = (veh.chassis || sale?.vehicleChassis || ext?.chassis || ext?.chassi || (sale as any)?.chassi || '').trim();

  let vehiclePlateText = '0 km (A emplacar)';
  if (rawPlate && !rawPlate.toLowerCase().includes('sem placa') && !rawPlate.toLowerCase().includes('0km') && rawPlate !== '—') {
    vehiclePlateText = formatPlate(rawPlate);
  }

  let vehicleChassisText = 'A definir no faturamento';
  if (rawChassis) {
    const uc = rawChassis.toUpperCase();
    if (uc.includes('DISPENSADO')) {
      vehicleChassisText = 'DISPENSADO (RES. CONTRAN 996/23)';
    } else if (uc.includes('DEFINIR') || uc.includes('PENDENTE')) {
      vehicleChassisText = 'A definir no faturamento';
    } else {
      vehicleChassisText = uc;
    }
  }

  const vehYear = Number(veh.year || ext?.ano || 2026);
  const vehMfgYear = Number(veh.manufacture_year || ext?.ano_fabricacao || vehYear);
  const vehicleYearText = vehMfgYear !== vehYear ? `${vehMfgYear}/${vehYear}` : String(vehYear);

  return {
    salePrice,
    downPayment,
    paymentMethod,
    installments,
    installmentValue,
    isFinanced,
    isCardInstallments,
    isCash,
    bankName,
    paymentConditionText,
    cleanNotes,
    fullBuyerAddress,
    vehiclePlateText,
    vehicleChassisText,
    vehicleYearText,
  };
}
