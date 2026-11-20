const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL\s*=\s*["']?([^"'\r\n]+)/);
const keyMatch = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY\s*=\s*["']?([^"'\r\n]+)/);

const url = urlMatch[1].trim();
const key = keyMatch[1].trim();
const sb = createClient(url, key);

async function reconcileDuplicates() {
  console.log('=== RECONCILIAÇÃO DE CHASSIS DUPLICADOS NO BANCO ===');

  const orphans = [
    {
      id: '8cc29de9-110a-4d22-b012-99b29b4eecde',
      chassis: '99HSB3250VS000323',
      legitimateId: '97aa9ae0-2212-4e31-8e30-c31034d6184f',
      reason: 'Duplicata orfã em Divinópolis sem contrato; moto legítima vendida em Montes Claros (CTR-MVTHMB5Z / Ademir José da Silva)'
    },
    {
      id: 'e921abb8-c3d6-44b6-b098-bbb2a08c0ad1',
      chassis: '99HSHF250TS001098',
      legitimateId: '8d599bd9-ab84-4ba7-9e53-cbc4b6494b11',
      reason: 'Duplicata orfã criada em 29/12/2025; moto legítima vendida em Montes Claros (CTR-MJSS51QT / Igor Braga de Sousa)'
    },
    {
      id: 'ac10ae03-3d51-4dac-b4ab-78144ab51197',
      chassis: '99HKCS200TS000054',
      legitimateId: 'a82e11c2-f586-4493-ae1e-dd84e3b92b54',
      reason: 'Duplicata orfã de Kart Cross; moto legítima vendida (CTR-MM4T8W5E / Jhonatan Rodrigues Silva)'
    },
    {
      id: '82073910-afad-4c67-8dc5-57dbc307716b',
      chassis: '99HKCS200TS000054',
      legitimateId: 'a82e11c2-f586-4493-ae1e-dd84e3b92b54',
      reason: 'Duplicata orfã criada em 19/03/2026; moto legítima vendida (CTR-MM4T8W5E / Jhonatan Rodrigues Silva)'
    },
    {
      id: '228487a6-7744-48d0-9958-88af2ef14621',
      chassis: '99HJTS125VS001005',
      legitimateId: '706ddb73-c7e1-4ec8-b6d5-4ffb2655bce6',
      reason: 'Duplicata orfã em Divinópolis; moto legítima vendida em Montes Claros (CTR-MVPAI9NK / Breno Richard Pereira de Sa)'
    },
    {
      id: '0a284879-97a1-46af-b33f-0f2f0548898d',
      chassis: '99HST1250TS000494',
      legitimateId: 'fa61dd2a-406e-4390-ba25-8c4298c2cf6c',
      reason: 'Duplicata orfã em Divinópolis de 23/09/2026; moto legítima faturada em Montes Claros (CTR-MW9TENJ8 / Walmor Martins dos Santos)'
    }
  ];

  for (const o of orphans) {
    const { data: v } = await sb.from('vehicles').select('*').eq('id', o.id).single();
    if (v) {
      const reconciledNotes = `[DUPLICATA_RECONCILIADA_FORENSE] Veículo legítimo vinculado: ${o.legitimateId}. Motivo: ${o.reason}. Notas originais: ${v.notes || ''}`;
      const { error: upErr } = await sb
        .from('vehicles')
        .update({
          chassis: `${v.chassis}-DUP-${o.id.slice(0, 4).toUpperCase()}`,
          status: 'vendido',
          notes: reconciledNotes,
          updated_at: new Date().toISOString()
        })
        .eq('id', o.id);

      if (upErr) {
        console.error(`Erro ao reconciliar órfão ${o.id}:`, upErr.message);
      } else {
        console.log(`Órfão ${o.id} (${o.chassis}) reconciliado com sucesso!`);
      }
    }
  }

  console.log('Reconciliação de chassis concluída!');
}

reconcileDuplicates();
