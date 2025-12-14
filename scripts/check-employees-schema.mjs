#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Load environment variables
const envFile = readFileSync('.env.local', 'utf-8');
const env = Object.fromEntries(
  envFile
    .split('\n')
    .filter(line => line.trim() && !line.startsWith('#'))
    .map(line => {
      const [key, ...values] = line.split('=');
      return [key.trim(), values.join('=').trim()];
    })
);

const SUPABASE_URL = env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkSchema() {
  console.log('🔍 Checking employees table schema...\n');
  
  // Try to insert a minimal record to see what's required
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .limit(1);
    
  console.log('Sample query result:', { data, error });
  
  // Check table info
  const { data: columns, error: colError } = await supabase
    .rpc('get_table_info', { table_name: 'employees' })
    .catch(() => ({ data: null, error: 'RPC not available' }));
    
  if (columns) {
    console.log('\nColumn info:', columns);
  }
}

checkSchema().catch(console.error);
