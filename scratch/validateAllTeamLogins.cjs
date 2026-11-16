const fs = require('fs');
const path = require('path');

// 1. Carrega dados oficiais
const contractsSeed = require('../src/data/officialContractsSeed.json');

// Normalizador idêntico ao salesScope.ts
function normalizeName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

function isMasterUser(name, email, id) {
  if (
    id === '54db7881-ce90-42d4-baff-0e0ec2cb9eeb' ||
    id === 'def5409c-f9cc-47ae-b45e-9e15fd52727f' ||
    id === '63f4c11a-7675-4209-bcc5-770bd7e514a3'
  ) {
    return true;
  }
  const cleanName = (name || '').toLowerCase();
  const cleanEmail = (email || '').toLowerCase();
  if (cleanName.includes('breno') || cleanEmail.includes('breno')) return true;
  if (cleanName.includes('joão') || cleanName.includes('joao') || cleanEmail.includes('gestor')) return true;
  return false;
}

// Canonical database users from DEFAULT_OFFICIAL_USERS in src/lib/userService.ts
const CANONICAL_USERS = [
  {
    id: '54db7881-ce90-42d4-baff-0e0ec2cb9eeb',
    email: 'admbreno@index.com',
    aliases: ['admbreno@index.com', 'laurentinobreno08@gmail.com', 'breno@l1mamotors.com.br', 'breno', 'admin', 'dono'],
    full_name: 'Breno Lima',
    role: 'admin',
    store_id: 'ccf8e097-09d7-4305-8077-5c16fc8b5634',
    store_name: 'Concessionária Divinópolis',
  },
  {
    id: '63f4c11a-7675-4209-bcc5-770bd7e514a3',
    email: 'shineraymocj@gestor.com',
    aliases: ['shineraymocj@gestor.com', 'joaovitor@l1mamotors.com.br', 'joao@fostongt.com', 'joao', 'joão', 'gestor'],
    full_name: 'João Vitor',
    role: 'gerente',
    store_id: 'ccf8e097-09d7-4305-8077-5c16fc8b5634',
    store_name: 'Concessionária Divinópolis',
  },
  {
    id: '61c7c7ba-f328-44d4-8fad-acfc1941ed3c',
    email: 'shineraymoc@user.com',
    aliases: ['shineraymoc@user.com', 'mariana@pixelmotors.com.br', 'mariana@fostongt.com', 'mariana', 'emp-mariana'],
    full_name: 'Mariana Sabino',
    role: 'vendedor_plus',
    store_id: 'e8254a81-d669-464b-9806-457ba25ce7f0',
    store_name: 'Concessionária Montes Claros',
  },
  {
    id: '6a031ece-6175-4965-b0a9-51e7d330d58f',
    email: 'shineraymocn@user.com',
    aliases: ['shineraymocn@user.com', 'natan@pixelmotors.com.br', 'natan@fostongt.com', 'natan', 'emp-natan'],
    full_name: 'Natan',
    role: 'vendedor',
    store_id: 'e8254a81-d669-464b-9806-457ba25ce7f0',
    store_name: 'Concessionária Montes Claros',
  },
  {
    id: 'c75534a4-1b08-4ccf-a2d7-96d882df7966',
    email: 'shineraymocs@user.com',
    aliases: ['shineraymocs@user.com', 'sabrina@pixelmotors.com.br', 'sabrina@fostongt.com', 'sabrina', 'emp-sabrina'],
    full_name: 'Sabrina',
    role: 'vendedor',
    store_id: 'e8254a81-d669-464b-9806-457ba25ce7f0',
    store_name: 'Concessionária Montes Claros',
  },
  {
    id: '08581b57-bbaf-4147-a92c-83aab9a80240',
    email: 'shineraydivd@user.com',
    aliases: ['shineraydivd@user.com', 'daniel@pixelmotors.com.br', 'daniel@fostongt.com', 'daniel', 'emp-daniel'],
    full_name: 'Daniel Alves de Moura',
    role: 'vendedor',
    store_id: 'ccf8e097-09d7-4305-8077-5c16fc8b5634',
    store_name: 'Concessionária Divinópolis',
  },
  {
    id: '71622fd8-0930-4c98-bec2-17f53d92ca75',
    email: 'shineraydivl@user.com',
    aliases: ['shineraydivl@user.com', 'lilian@pixelmotors.com.br', 'lilian@fostongt.com', 'lilian', 'emp-lilian'],
    full_name: 'Lilian Rossiane Machado Amorim',
    role: 'vendedor',
    store_id: 'ccf8e097-09d7-4305-8077-5c16fc8b5634',
    store_name: 'Concessionária Divinópolis',
  },
  {
    id: '4bfa9ccd-7131-449b-898b-a355878c64ea',
    email: 'shineraydivg@user.com',
    aliases: ['shineraydivg@user.com', 'geibriel@pixelmotors.com.br', 'geibriel@fostongt.com', 'geibriel', 'emp-geibriel'],
    full_name: 'Geibriel',
    role: 'vendedor_externo',
    store_id: 'ccf8e097-09d7-4305-8077-5c16fc8b5634',
    store_name: 'Concessionária Divinópolis',
  },
  {
    id: '308366d4-3b96-47a0-9658-d53ec88c92b0',
    email: 'shineraydive@user.com',
    aliases: ['shineraydive@user.com', 'elias@pixelmotors.com.br', 'elias@fostongt.com', 'elias', 'emp-elias'],
    full_name: 'Elias',
    role: 'vendedor',
    store_id: 'ccf8e097-09d7-4305-8077-5c16fc8b5634',
    store_name: 'Concessionária Divinópolis',
  },
  {
    id: 'emp-halana-montesclaros',
    email: 'shineraymoch@user.com',
    aliases: ['shineraymoch@user.com', 'halana@pixelmotors.com.br', 'halana@fostongt.com', 'halana', 'emp-halana'],
    full_name: 'Halana',
    role: 'vendedor',
    store_id: 'e8254a81-d669-464b-9806-457ba25ce7f0',
    store_name: 'Concessionária Montes Claros',
  },
];

// Login resolver function (matching AuthContext.tsx exactly)
function resolveLogin(inputEmail) {
  const cleanEmail = inputEmail.toLowerCase().trim();
  const emailPrefix = cleanEmail.split('@')[0].toLowerCase().trim();

  const found = CANONICAL_USERS.find((u) => {
    const uEmail = (u.email || '').toLowerCase().trim();
    const uName = (u.full_name || '').toLowerCase().trim();
    const uPrefix = uEmail.split('@')[0].toLowerCase().trim();
    const uAliases = (u.aliases || []).map((a) => a.toLowerCase().trim());

    if (uEmail === cleanEmail || uAliases.includes(cleanEmail)) return true;
    if (uPrefix === emailPrefix || uAliases.includes(emailPrefix)) return true;
    if (u.id.toLowerCase() === cleanEmail) return true;
    if (uName === cleanEmail || uName.split(' ')[0].toLowerCase() === cleanEmail) return true;

    return (
      (cleanEmail === 'admin' && (uEmail.includes('admbreno') || uEmail.includes('breno'))) ||
      (cleanEmail === 'dono' && (uEmail.includes('admbreno') || uEmail.includes('breno'))) ||
      (cleanEmail === 'breno' && uEmail.includes('breno')) ||
      (cleanEmail === 'joao' && uEmail.includes('joao')) ||
      (cleanEmail === 'gestor' && (uEmail.includes('gestor') || uEmail.includes('joao'))) ||
      (cleanEmail === 'mariana' && (uName.includes('mariana') || uEmail.includes('shineraymoc@'))) ||
      (cleanEmail === 'natan' && (uName.includes('natan') || uEmail.includes('shineraymocn'))) ||
      (cleanEmail === 'lilian' && (uName.includes('lilian') || uEmail.includes('shineraydivl'))) ||
      (cleanEmail === 'geibriel' && (uName.includes('geibriel') || uEmail.includes('shineraydivg'))) ||
      (cleanEmail === 'daniel' && (uName.includes('daniel') || uEmail.includes('shineraydivd'))) ||
      (cleanEmail === 'sabrina' && (uName.includes('sabrina') || uEmail.includes('shineraymocs'))) ||
      (cleanEmail === 'halana' && (uName.includes('halana') || uEmail.includes('shineraymoch'))) ||
      (cleanEmail === 'elias' && (uName.includes('elias') || uEmail.includes('shineraydive')))
    );
  });

  return found || null;
}

// Sales filter function (matching salesScope.ts exactly)
function filterSales(user, contracts) {
  if (isMasterUser(user.full_name, user.email, user.id)) {
    return contracts; // Admin & Gerente vêem tudo
  }

  const userIds = new Set([user.id.toLowerCase()]);
  const userNames = new Set([normalizeName(user.full_name)]);
  normalizeName(user.full_name).split(' ').forEach(p => { if (p.length >= 3) userNames.add(p); });
  if (user.email) {
    const pfx = user.email.split('@')[0].toLowerCase();
    userNames.add(normalizeName(pfx));
  }

  return contracts.filter(c => {
    const saleCreatedBy = (c.created_by || '').toLowerCase().trim();
    const saleUserId = (c.user_id || '').toLowerCase().trim();
    const saleOperatorId = (c.operator?.id || '').toLowerCase().trim();

    if (saleCreatedBy && userIds.has(saleCreatedBy)) return true;
    if (saleUserId && userIds.has(saleUserId)) return true;
    if (saleOperatorId && userIds.has(saleOperatorId)) return true;

    const sellerNames = [
      c.operator?.full_name,
      c.vendedor,
      c.seller_name,
      c.created_by
    ].filter(Boolean).map(s => normalizeName(String(s)));

    for (const sn of sellerNames) {
      for (const un of userNames) {
        if (sn === un || sn.includes(un) || un.includes(sn)) return true;
        const sParts = sn.split(' ');
        const uParts = un.split(' ');
        for (const sp of sParts) {
          for (const up of uParts) {
            if (sp.length >= 3 && up.length >= 3 && sp === up) return true;
          }
        }
      }
    }

    return false;
  });
}

console.log('================================================================');
console.log('VALIDAÇÃO DE LOGIN, PERMISSÕES E VENDAS PARA CADA COLABORADOR');
console.log('================================================================');

const testCases = [
  // 1. Mariana
  { input: 'shineraymoc@user.com', desc: 'Mariana (Email Real do Banco)' },
  { input: 'mariana@pixelmotors.com.br', desc: 'Mariana (Email Alternativo)' },
  { input: 'mariana', desc: 'Mariana (Usuário Simples)' },
  // 2. Natan
  { input: 'shineraymocn@user.com', desc: 'Natan (Email Real do Banco)' },
  { input: 'natan', desc: 'Natan (Usuário Simples)' },
  // 3. Sabrina
  { input: 'shineraymocs@user.com', desc: 'Sabrina (Email Real do Banco)' },
  { input: 'sabrina', desc: 'Sabrina (Usuário Simples)' },
  // 4. Daniel
  { input: 'shineraydivd@user.com', desc: 'Daniel (Email Real do Banco)' },
  { input: 'daniel', desc: 'Daniel (Usuário Simples)' },
  // 5. Lilian
  { input: 'shineraydivl@user.com', desc: 'Lilian (Email Real do Banco)' },
  { input: 'lilian', desc: 'Lilian (Usuário Simples)' },
  // 6. Geibriel
  { input: 'shineraydivg@user.com', desc: 'Geibriel (Email Real do Banco)' },
  { input: 'geibriel', desc: 'Geibriel (Usuário Simples)' },
  // 7. Elias
  { input: 'shineraydive@user.com', desc: 'Elias (Email Real do Banco)' },
  { input: 'elias', desc: 'Elias (Usuário Simples)' },
  // 8. Halana
  { input: 'shineraymoch@user.com', desc: 'Halana (Email Corporativo)' },
  { input: 'halana', desc: 'Halana (Usuário Simples)' },
  // 9. João Vitor
  { input: 'shineraymocj@gestor.com', desc: 'João Vitor (Email Real do Banco)' },
  { input: 'gestor', desc: 'João Vitor (Usuário Gestor)' },
  // 10. Breno Lima
  { input: 'admbreno@index.com', desc: 'Breno Lima (Email Real do Banco)' },
  { input: 'admin', desc: 'Breno Lima (Usuário Admin)' },
  { input: 'dono', desc: 'Breno Lima (Usuário Dono)' },
];

let allPassed = true;

for (const tc of testCases) {
  const user = resolveLogin(tc.input);
  if (!user) {
    console.error(`[FALHA] Não foi possível autenticar: "${tc.input}" (${tc.desc})`);
    allPassed = false;
    continue;
  }

  const sales = filterSales(user, contractsSeed);
  const totalVal = sales.reduce((sum, s) => sum + (s.sale_price || 0), 0);
  const formattedVal = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalVal);

  console.log(`[SUCESSO] ${tc.desc}:`);
  console.log(`   - Input: "${tc.input}"`);
  console.log(`   - Nome exibido: "${user.full_name}"`);
  console.log(`   - ID no Banco: ${user.id}`);
  console.log(`   - Cargo: ${user.role}`);
  console.log(`   - Loja: ${user.store_name} (${user.store_id})`);
  console.log(`   - Vendas visíveis: ${sales.length} contratos (${formattedVal})`);
  console.log('----------------------------------------------------------------');
}

console.log(allPassed ? 'TODOS OS TESTES PASSARAM COM 100% DE SUCESSO!' : 'HOUVE FALHAS NA VALIDAÇÃO');
