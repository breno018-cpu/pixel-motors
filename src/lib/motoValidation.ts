/**
 * Módulo Oficial de Validação Completa e Real de Cadastro de Motocicletas
 * Normas: ISO 3779 (VIN/Chassi), Resoluções CONTRAN 282, 996/2023, Padrão Mercosul de Placas
 */

export interface MotoValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  warnings: Record<string, string>;
  metrics: {
    profit: number;
    marginPct: number | null;
    isDuplicateChassis: boolean;
    duplicateVehicleInfo?: string;
    decodedBrand?: string;
    decodedModel?: string;
    decodedYear?: number;
  };
  checklist: Array<{
    id: string;
    label: string;
    passed: boolean;
    message: string;
    required: boolean;
  }>;
}

export interface MotoFormValidationData {
  storeId: string;
  vehicleType: 'moto' | 'carro';
  brand: string;
  model: string;
  year: string | number;
  manufactureYear?: string | number;
  color: string;
  chassis: string;
  isElectric?: boolean;
  plate?: string;
  renavam?: string;
  purchasePrice?: number | string;
  salePrice: number | string;
  mileage?: number | string;
  engineCc?: number | string;
  fuelType?: string;
  transmission?: string;
}

/**
 * Validação rigorosa de Chassi / VIN padrão automotivo (ISO 3779 / CONTRAN).
 * - Exatamente 17 caracteres alfanuméricos para veículos a combustão;
 * - Letras I, O e Q são PROIBIDAS no mundo inteiro para evitar confusão com 1 e 0;
 * - Verificação de duplicidade contra o estoque existente.
 */
export function validateChassisVin(
  rawChassis: string,
  isElectric: boolean = false,
  existingVehicles: any[] = []
): {
  isValid: boolean;
  error?: string;
  warning?: string;
  cleanChassis: string;
  isDuplicate: boolean;
  duplicateVehicle?: any;
} {
  const clean = (rawChassis || '').toUpperCase().trim();
  const alnum = clean.replace(/[^A-Z0-9]/g, '');

  // 1. Caso de Moto Elétrica / Cicloelétrico
  if (isElectric) {
    if (!clean || clean === 'A DEFINIR NA VENDA' || clean === 'DISPENSADO' || clean === 'SEM CHASSI') {
      return {
        isValid: true,
        cleanChassis: clean || 'A DEFINIR NA VENDA',
        isDuplicate: false,
      };
    }

    // Se informou um número de quadro/motor para elétrica
    if (alnum.length < 5) {
      return {
        isValid: false,
        error: 'O número de série/quadro da moto elétrica deve conter no mínimo 5 caracteres.',
        cleanChassis: clean,
        isDuplicate: false,
      };
    }

    // Checa duplicidade em elétricas
    const dup = existingVehicles.find((v) => {
      const vCh = (v.chassis || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      return vCh && vCh !== 'ADEFINIRNAVENDA' && vCh !== 'DISPENSADO' && vCh === alnum;
    });

    if (dup) {
      return {
        isValid: false,
        error: `Número de quadro/série já cadastrado para a moto ${dup.brand} ${dup.model} (${dup.color}) no estoque da loja ${dup.store?.name || dup.store_id}.`,
        cleanChassis: clean,
        isDuplicate: true,
        duplicateVehicle: dup,
      };
    }

    return {
      isValid: true,
      cleanChassis: clean,
      isDuplicate: false,
    };
  }

  // 2. Moto a Combustão: Chassi Oficial Obrigatório
  if (!clean) {
    return {
      isValid: false,
      error: 'O chassi do veículo é obrigatório para motos a combustão.',
      cleanChassis: '',
      isDuplicate: false,
    };
  }

  // Caracteres Proibidos pela Norma Internacional ISO 3779 (I, O, Q)
  const forbiddenChars: string[] = [];
  if (clean.includes('I')) forbiddenChars.push('I (confunde com 1)');
  if (clean.includes('O')) forbiddenChars.push('O (confunde com 0)');
  if (clean.includes('Q')) forbiddenChars.push('Q (confunde com 0 e 9)');

  if (forbiddenChars.length > 0) {
    return {
      isValid: false,
      error: `Chassi inválido: as letras ${forbiddenChars.join(', ')} são estritamente proibidas em chassis oficiais pelo padrão internacional ISO 3779 / CONTRAN.`,
      cleanChassis: clean,
      isDuplicate: false,
    };
  }

  // Tamanho do Chassi Oficial (17 caracteres)
  if (alnum.length !== 17) {
    if (alnum.length < 17) {
      return {
        isValid: false,
        error: `Chassi incompleto: possui ${alnum.length} caracteres, mas o padrão oficial do CONTRAN / ISO 3779 exige exatamente 17 caracteres (faltam ${17 - alnum.length}).`,
        cleanChassis: clean,
        isDuplicate: false,
      };
    } else {
      return {
        isValid: false,
        error: `Chassi com excesso de caracteres: possui ${alnum.length} caracteres (o padrão oficial do CONTRAN possui exatamente 17 caracteres).`,
        cleanChassis: clean,
        isDuplicate: false,
      };
    }
  }

  // 3. Verificação Real de Duplicidade no Estoque
  const duplicate = existingVehicles.find((v) => {
    const vCh = (v.chassis || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    return vCh && vCh === alnum;
  });

  if (duplicate) {
    const storeLabel = duplicate.store?.name || duplicate.store_id || 'Concessionária';
    const statusLabel = duplicate.status === 'vendido' ? 'Vendido' : duplicate.status === 'reservado' ? 'Reservado' : 'Disponível no Estoque';
    return {
      isValid: false,
      error: `CHASSI DUPLICADO: Este chassi (${clean}) já pertence à moto ${duplicate.brand || ''} ${duplicate.model || ''} (${duplicate.color || 'Cor padrão'}) cadastrada na ${storeLabel} com status [${statusLabel}].`,
      cleanChassis: clean,
      isDuplicate: true,
      duplicateVehicle: duplicate,
    };
  }

  return {
    isValid: true,
    cleanChassis: alnum,
    isDuplicate: false,
  };
}

/**
 * Validação de Placa Automotiva (Padrão Mercosul: AAA0A00 | Antigo: AAA-0000)
 */
export function validateLicensePlate(rawPlate?: string): {
  isValid: boolean;
  formatted?: string;
  error?: string;
  type?: 'mercosul' | 'antigo';
} {
  if (!rawPlate || !rawPlate.trim()) {
    return { isValid: true };
  }

  const clean = rawPlate.toUpperCase().trim().replace(/[^A-Z0-9]/g, '');

  if (clean.length !== 7) {
    return {
      isValid: false,
      error: `Placa inválida: deve conter exatamente 7 caracteres (atualmente com ${clean.length}).`,
    };
  }

  // Padrão Mercosul: 3 Letras, 1 Número, 1 Letra, 2 Números (ex: ABC1D23)
  const isMercosul = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/.test(clean);
  if (isMercosul) {
    return {
      isValid: true,
      formatted: clean,
      type: 'mercosul',
    };
  }

  // Padrão Antigo: 3 Letras, 4 Números (ex: ABC1234)
  const isAntigo = /^[A-Z]{3}[0-9]{4}$/.test(clean);
  if (isAntigo) {
    return {
      isValid: true,
      formatted: `${clean.slice(0, 3)}-${clean.slice(3)}`,
      type: 'antigo',
    };
  }

  return {
    isValid: false,
    error: 'Formato de placa inválido. Formatos aceitos: Mercosul (ex: BRA2E19) ou Tradicional (ex: ABC-1234).',
  };
}

/**
 * Validação de Renavam (9 a 11 dígitos numéricos)
 */
export function validateRenavamNumber(rawRenavam?: string): {
  isValid: boolean;
  clean?: string;
  error?: string;
} {
  if (!rawRenavam || !rawRenavam.trim()) {
    return { isValid: true };
  }

  const digits = rawRenavam.replace(/\D/g, '');
  if (digits.length < 9 || digits.length > 11) {
    return {
      isValid: false,
      error: `Renavam inválido: deve conter 9 ou 11 dígitos numéricos (informado: ${digits.length}).`,
    };
  }

  return {
    isValid: true,
    clean: digits,
  };
}

/**
 * Validação de Anos de Fabricação e Modelo.
 * - Ano de fabricação deve estar em faixa plausível (1990 a Ano Atual + 1);
 * - Ano do Modelo deve ser igual ao de Fabricação ou até 1 ano à frente (ex: 2025/2026);
 * - Ano de Fabricação NUNCA pode ser superior ao Ano do Modelo.
 */
export function validateVehicleYears(
  manufactureYear: number,
  modelYear: number
): {
  isValid: boolean;
  error?: string;
} {
  const currentYear = new Date().getFullYear();
  const maxYear = currentYear + 2;

  if (manufactureYear < 1990 || manufactureYear > maxYear) {
    return {
      isValid: false,
      error: `Ano de Fabricação inválido (${manufactureYear}). Deve estar entre 1990 e ${maxYear}.`,
    };
  }

  if (modelYear < manufactureYear) {
    return {
      isValid: false,
      error: `Incoerência de anos: o Ano do Modelo (${modelYear}) não pode ser inferior ao Ano de Fabricação (${manufactureYear}).`,
    };
  }

  if (modelYear > manufactureYear + 1) {
    return {
      isValid: false,
      error: `Incoerência de anos: o Ano do Modelo (${modelYear}) não pode ser mais que 1 ano à frente da fabricação (${manufactureYear}).`,
    };
  }

  return { isValid: true };
}

/**
 * Validação Completa e Real de Cadastro de Motos.
 * Executa todas as checagens normativas, integridade referencial, detecção de duplicidades
 * e cálculo de viabilidade comercial.
 */
export function validateMotoRegistration(
  data: MotoFormValidationData,
  existingVehicles: any[] = []
): MotoValidationResult {
  const errors: Record<string, string> = {};
  const warnings: Record<string, string> = {};
  const checklist: MotoValidationResult['checklist'] = [];

  const isElectric = Boolean(data.isElectric);

  // 1. Checagem de Concessionária / Loja
  if (!data.storeId || !data.storeId.trim()) {
    errors.storeId = 'Selecione a concessionária onde a moto estará localizada fisicamente.';
    checklist.push({
      id: 'store',
      label: 'Concessionária / Loja',
      passed: false,
      message: 'Loja não selecionada',
      required: true,
    });
  } else {
    checklist.push({
      id: 'store',
      label: 'Concessionária / Loja',
      passed: true,
      message: 'Loja selecionada com sucesso',
      required: true,
    });
  }

  // 2. Checagem de Chassi / VIN
  const chassisResult = validateChassisVin(data.chassis, isElectric, existingVehicles);
  if (!chassisResult.isValid && chassisResult.error) {
    errors.chassis = chassisResult.error;
    checklist.push({
      id: 'chassis',
      label: isElectric ? 'Chassi / Nº de Quadro' : 'Chassi Oficial (17 dígitos)',
      passed: false,
      message: chassisResult.error,
      required: !isElectric,
    });
  } else {
    checklist.push({
      id: 'chassis',
      label: isElectric ? 'Chassi / Nº de Quadro' : 'Chassi Oficial (17 dígitos)',
      passed: true,
      message: isElectric
        ? (chassisResult.cleanChassis === 'A DEFINIR NA VENDA' ? 'Elétrica sem chassi (permitido pelo CONTRAN)' : 'Nº de quadro validado')
        : 'Chassi oficial de 17 caracteres validado pelo padrão ISO 3779 / CONTRAN',
      required: !isElectric,
    });
  }

  // 3. Checagem de Marca e Modelo
  const cleanBrand = (data.brand || '').trim().toUpperCase();
  const cleanModel = (data.model || '').trim().toUpperCase();

  if (!cleanBrand || cleanBrand.length < 2) {
    errors.brand = 'Informe a marca da motocicleta (ex: SHINERAY).';
    checklist.push({
      id: 'brand',
      label: 'Marca da Motocicleta',
      passed: false,
      message: 'Marca não informada',
      required: true,
    });
  } else {
    checklist.push({
      id: 'brand',
      label: 'Marca da Motocicleta',
      passed: true,
      message: `Marca: ${cleanBrand}`,
      required: true,
    });
  }

  if (!cleanModel || cleanModel.length < 2) {
    errors.model = 'Informe o modelo oficial da motocicleta (ex: SHI 175 EFI, JET 125, RIO 125).';
    checklist.push({
      id: 'model',
      label: 'Modelo da Motocicleta',
      passed: false,
      message: 'Modelo não informado',
      required: true,
    });
  } else {
    checklist.push({
      id: 'model',
      label: 'Modelo da Motocicleta',
      passed: true,
      message: `Modelo: ${cleanModel}`,
      required: true,
    });
  }

  // 4. Checagem de Cor
  const cleanColor = (data.color || '').trim();
  if (!cleanColor || cleanColor.length < 2) {
    errors.color = 'Selecione ou informe a cor oficial da motocicleta.';
    checklist.push({
      id: 'color',
      label: 'Cor do Veículo',
      passed: false,
      message: 'Cor não selecionada',
      required: true,
    });
  } else {
    checklist.push({
      id: 'color',
      label: 'Cor do Veículo',
      passed: true,
      message: `Cor: ${cleanColor}`,
      required: true,
    });
  }

  // 5. Checagem de Anos (Fabricação e Modelo)
  const numYear = parseInt(String(data.year || ''), 10) || new Date().getFullYear();
  const numManufYear = parseInt(String(data.manufactureYear || ''), 10) || numYear;

  const yearResult = validateVehicleYears(numManufYear, numYear);
  if (!yearResult.isValid && yearResult.error) {
    errors.year = yearResult.error;
    checklist.push({
      id: 'years',
      label: 'Ano Fabricação / Modelo',
      passed: false,
      message: yearResult.error,
      required: true,
    });
  } else {
    checklist.push({
      id: 'years',
      label: 'Ano Fabricação / Modelo',
      passed: true,
      message: `${numManufYear} / ${numYear}`,
      required: true,
    });
  }

  // 6. Checagem de Placa (se preenchida)
  if (data.plate && data.plate.trim()) {
    const plateResult = validateLicensePlate(data.plate);
    if (!plateResult.isValid && plateResult.error) {
      errors.plate = plateResult.error;
      checklist.push({
        id: 'plate',
        label: 'Placa do Veículo',
        passed: false,
        message: plateResult.error,
        required: false,
      });
    } else {
      checklist.push({
        id: 'plate',
        label: 'Placa do Veículo',
        passed: true,
        message: `Placa ${plateResult.formatted} (${plateResult.type === 'mercosul' ? 'Padrão Mercosul' : 'Padrão Tradicional'})`,
        required: false,
      });
    }
  }

  // 7. Checagem de Renavam (se preenchido)
  if (data.renavam && data.renavam.trim()) {
    const renavamResult = validateRenavamNumber(data.renavam);
    if (!renavamResult.isValid && renavamResult.error) {
      errors.renavam = renavamResult.error;
      checklist.push({
        id: 'renavam',
        label: 'Número do Renavam',
        passed: false,
        message: renavamResult.error,
        required: false,
      });
    } else {
      checklist.push({
        id: 'renavam',
        label: 'Número do Renavam',
        passed: true,
        message: `Renavam: ${renavamResult.clean}`,
        required: false,
      });
    }
  }

  // 8. Checagem Financeira (Preço de Venda e Preço de Custo)
  const parseNum = (v: any): number => {
    if (typeof v === 'number') return v;
    if (!v) return 0;
    const cleanStr = String(v).replace(/\./g, '').replace(',', '.').replace(/[^0-9.]/g, '');
    return parseFloat(cleanStr) || 0;
  };

  const saleVal = parseNum(data.salePrice);
  const costVal = parseNum(data.purchasePrice);

  if (saleVal <= 0) {
    errors.salePrice = 'O valor de venda deve ser maior que R$ 0,00.';
    checklist.push({
      id: 'pricing',
      label: 'Preço de Venda',
      passed: false,
      message: 'Valor de venda zerado ou inválido',
      required: true,
    });
  } else {
    checklist.push({
      id: 'pricing',
      label: 'Preço de Venda',
      passed: true,
      message: `R$ ${saleVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      required: true,
    });
  }

  let profit = 0;
  let marginPct: number | null = null;

  if (saleVal > 0 && costVal > 0) {
    profit = saleVal - costVal;
    marginPct = parseFloat(((profit / saleVal) * 100).toFixed(1));

    if (profit < 0) {
      warnings.pricing = `Atenção: Margem negativa de ${marginPct}%. O valor de venda (R$ ${saleVal.toLocaleString('pt-BR')}) é inferior ao custo de aquisição (R$ ${costVal.toLocaleString('pt-BR')}).`;
    }
  }

  const isValid = Object.keys(errors).length === 0;

  return {
    isValid,
    errors,
    warnings,
    metrics: {
      profit,
      marginPct,
      isDuplicateChassis: chassisResult.isDuplicate,
      duplicateVehicleInfo: chassisResult.isDuplicate
        ? `${chassisResult.duplicateVehicle?.brand} ${chassisResult.duplicateVehicle?.model} (${chassisResult.duplicateVehicle?.chassis})`
        : undefined,
    },
    checklist,
  };
}
