/**
 * Serviço de Consulta de CEP e Formatação/Parsing de Endereço Brasileiro
 * Integração direta com ViaCEP e fallback para BrasilAPI
 */

export interface AddressData {
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
}

export const INITIAL_ADDRESS: AddressData = {
  cep: '',
  street: '',
  number: '',
  complement: '',
  neighborhood: '',
  city: '',
  state: 'MG',
};

/**
 * Consulta CEP no ViaCEP com fallback automático para BrasilAPI
 */
export async function fetchAddressByCep(
  rawCep: string
): Promise<{ street: string; neighborhood: string; city: string; state: string } | null> {
  const clean = (rawCep || '').replace(/\D/g, '');
  if (clean.length !== 8) return null;

  // 1. Tenta ViaCEP
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);
    const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (!data.erro) {
        return {
          street: (data.logradouro || '').trim(),
          neighborhood: (data.bairro || '').trim(),
          city: (data.localidade || '').trim(),
          state: (data.uf || '').trim().toUpperCase(),
        };
      }
    }
  } catch (e) {
    // ViaCEP falhou ou timeout, tenta fallback BrasilAPI
  }

  // 2. Fallback BrasilAPI
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);
    const res = await fetch(`https://brasilapi.com.br/api/cep/v1/${clean}`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (data && (data.city || data.street)) {
        return {
          street: (data.street || '').trim(),
          neighborhood: (data.neighborhood || '').trim(),
          city: (data.city || '').trim(),
          state: (data.state || '').trim().toUpperCase(),
        };
      }
    }
  } catch (e) {
    // BrasilAPI também falhou
  }

  return null;
}

/**
 * Formata os dados de endereço separados em uma única linha padronizada
 * para contratos, notas e registros no banco de dados.
 * Ex: "Rua Cinco, 105, Apto 2 - Cidade Cristo Rei, Montes Claros/MG - CEP: 39400-000"
 */
export function formatFullAddress(data: Partial<AddressData>): string {
  const street = (data.street || '').trim();
  const number = (data.number || '').trim();
  const complement = (data.complement || '').trim();
  const neighborhood = (data.neighborhood || '').trim();
  const city = (data.city || '').trim();
  const state = (data.state || '').trim().toUpperCase();
  const rawCep = (data.cep || '').replace(/\D/g, '');
  const cep = rawCep.length === 8 ? `${rawCep.slice(0, 5)}-${rawCep.slice(5)}` : (data.cep || '').trim();

  const parts: string[] = [];

  // Logradouro + Número + Complemento
  if (street) {
    let streetPart = street;
    if (number) streetPart += `, ${number}`;
    if (complement) streetPart += `, ${complement}`;
    parts.push(streetPart);
  } else if (number) {
    parts.push(`Nº ${number}`);
  }

  // Bairro
  if (neighborhood) {
    parts.push(neighborhood);
  }

  // Cidade / UF
  if (city) {
    parts.push(state ? `${city}/${state}` : city);
  } else if (state) {
    parts.push(state);
  }

  let formatted = parts.join(' - ');

  // CEP ao final
  if (cep) {
    formatted += formatted ? ` - CEP: ${cep}` : `CEP: ${cep}`;
  }

  return formatted.trim();
}

/**
 * Analisa uma string de endereço bruta existente e tenta separá-la
 * nos campos individuais (CEP, Rua, Número, Complemento, Bairro, Cidade, Estado).
 */
export function parseAddressString(raw?: string | null): AddressData {
  if (!raw || typeof raw !== 'string') {
    return { ...INITIAL_ADDRESS };
  }

  const result: AddressData = { ...INITIAL_ADDRESS };
  let text = raw.trim();

  // 1. Extrai CEP se houver (formato 00000-000 ou 8 dígitos)
  const cepMatch = text.match(/\b(\d{5})-?(\d{3})\b/);
  if (cepMatch) {
    result.cep = `${cepMatch[1]}-${cepMatch[2]}`;
    text = text.replace(new RegExp(`(?:CEP:?\\s*)?${cepMatch[0]}`, 'gi'), '').trim();
  }

  // 2. Extrai Estado / UF se houver no final (ex: /MG ou - MG)
  const ufMatch = text.match(/(?:\/|\s*-\s*)([A-Z]{2})\b/i);
  if (ufMatch) {
    result.state = ufMatch[1].toUpperCase();
    text = text.replace(ufMatch[0], '').trim();
  }

  // Limpa traços ou vírgulas sobrando no início ou fim
  text = text.replace(/^[,\s\-]+|[,\s\-]+$/g, '').trim();

  // Divide pelas quebras principais (' - ' ou ' — ')
  const segments = text.split(/\s*[-—]\s*/).map((s) => s.trim()).filter(Boolean);

  if (segments.length === 0) {
    return result;
  }

  if (segments.length === 1) {
    // Apenas uma parte (pode ser "Cidade" ou "Rua X, 100")
    const single = segments[0];
    if (single.toLowerCase().includes('rua') || single.toLowerCase().includes('av') || single.match(/\d+/)) {
      parseStreetAndNumber(single, result);
    } else {
      result.city = single;
    }
    return result;
  }

  if (segments.length === 2) {
    // Ex: "Rua X, 100 - Bairro" OU "Bairro - Cidade" OU "Rua X - Cidade"
    parseStreetAndNumber(segments[0], result);
    if (!result.street) {
      result.neighborhood = segments[0];
      result.city = segments[1];
    } else {
      result.city = segments[1];
    }
    return result;
  }

  if (segments.length >= 3) {
    // Ex: "Rua X, 100, Apto 2 - Bairro - Cidade"
    parseStreetAndNumber(segments[0], result);
    result.neighborhood = segments[1];
    result.city = segments[2];
    if (segments.length > 3 && !result.complement) {
      result.complement = segments.slice(3).join(' - ');
    }
  }

  return result;
}

function parseStreetAndNumber(str: string, target: AddressData): void {
  // Ex: "RUA CINCO, 105" ou "AV. JOAO XXIII, Nº 990" ou "Rua Flores, 12, Apto 4"
  const commaParts = str.split(',').map((p) => p.trim()).filter(Boolean);
  if (commaParts.length === 0) return;

  target.street = commaParts[0];

  if (commaParts.length >= 2) {
    const numCandidate = commaParts[1].replace(/^(?:n[º°.]?|número)\s*/i, '').trim();
    target.number = numCandidate;
  }

  if (commaParts.length >= 3) {
    target.complement = commaParts.slice(2).join(', ');
  }
}
