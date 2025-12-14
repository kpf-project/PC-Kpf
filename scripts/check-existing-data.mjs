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

async function checkData() {
  console.log('🔍 Checking existing data...\n');
  
  // Check employees
  const { data: emp } = await supabase
    .from('employees')
    .select('name, employee_code');
  console.log('📋 Employees:', emp?.length || 0);
  emp?.forEach(e => console.log(`   - ${e.name} (${e.employee_code})`));
  
  // Check stores
  const { data: stores } = await supabase
    .from('stores')
    .select('name, province');
  console.log('\n🏪 Stores:', stores?.length || 0);
  stores?.forEach(s => console.log(`   - ${s.name} (${s.province})`));
  
  // Check products
  const { data: products } = await supabase
    .from('products')
    .select('code, name');
  console.log('\n📦 Products:', products?.length || 0);
  products?.forEach(p => console.log(`   - ${p.code}: ${p.name}`));
  
  // Check product units
  const { data: units } = await supabase
    .from('product_units')
    .select('product_id, name, multiplier_to_base');
  console.log('\n📏 Product Units:', units?.length || 0);
  units?.forEach(u => console.log(`   - ${u.name} (×${u.multiplier_to_base})`));
}

checkData().catch(console.error);
