const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL\s*=\s*["']?([^"'\r\n]+)/);
const keyMatch = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY\s*=\s*["']?([^"'\r\n]+)/);

const url = urlMatch[1].trim();
const key = keyMatch[1].trim();
const sb = createClient(url, key);

async function checkPolicies() {
  const { data, error } = await sb.rpc('get_policies');
  if (error) {
    console.log('rpc get_policies not available:', error.message);
  } else {
    console.log('Policies:', data);
  }
}

checkPolicies();
