const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL\s*=\s*["']?([^"'\r\n]+)/);
const keyMatch = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY\s*=\s*["']?([^"'\r\n]+)/);

const url = urlMatch[1].trim();
const key = keyMatch[1].trim();
const sb = createClient(url, key);

async function checkUsers() {
  const { data: profiles } = await sb.from('profiles').select('*');
  console.log('Profiles in DB:', profiles?.map(p => ({ id: p.id, email: p.email, name: p.full_name })));

  const { data: roles } = await sb.from('user_roles').select('*');
  console.log('User roles in DB:', roles);
}

checkUsers();
