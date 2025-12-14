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

async function checkSchemas() {
  console.log('🔍 Checking table schemas...\n');
  
  // Check employees
  const { data: emp, error: empErr } = await supabase
    .from('employees')
    .select('*')
    .limit(1);
  console.log('📋 Employees columns:', emp ? Object.keys(emp[0]) : 'No data');
  console.log('   Count:', emp?.length || 0);
  
  // Check stores
  const { data: stores, error: storeErr } = await supabase
    .from('stores')
    .select('*')
    .limit(1);
  console.log('\n🏪 Stores columns:', stores && stores.length > 0 ? Object.keys(stores[0]) : 'No data');
  console.log('   Count:', stores?.length || 0);
  
  // Check products
  const { data: products, error: prodErr } = await supabase
    .from('products')
    .select('*')
    .limit(1);
  console.log('\n📦 Products columns:', products && products.length > 0 ? Object.keys(products[0]) : 'No data');
  console.log('   Count:', products?.length || 0);
  
  // Check categories
  const { data: categories, error: catErr } = await supabase
    .from('categories')
    .select('*')
    .limit(1);
  console.log('\n📁 Categories columns:', categories && categories.length > 0 ? Object.keys(categories[0]) : 'No data');
  console.log('   Count:', categories?.length || 0);
  
  // Check product_units
  const { data: units, error: unitsErr } = await supabase
    .from('product_units')
    .select('*')
    .limit(1);
  console.log('\n📏 Product Units columns:', units && units.length > 0 ? Object.keys(units[0]) : 'No data');
  console.log('   Count:', units?.length || 0);
}

checkSchemas().catch(console.error);
