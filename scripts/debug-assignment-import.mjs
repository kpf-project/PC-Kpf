#!/usr/bin/env node

/**
 * Debug Assignment Import
 * Check what data is available for matching
 */

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

async function debugImport() {
  console.log('🔍 Debugging Product Assignment Import\n');

  // Check employees
  console.log('📋 Employees (for matching):');
  const { data: employees } = await supabase
    .from('employees')
    .select('id, name, employee_code')
    .order('name');

  if (employees && employees.length > 0) {
    console.log(`   Found ${employees.length} active employees\n`);
    employees.slice(0, 5).forEach(emp => {
      console.log(`   - ${emp.name} (Code: ${emp.employee_code || 'N/A'})`);
    });
    if (employees.length > 5) {
      console.log(`   ... and ${employees.length - 5} more\n`);
    }
  } else {
    console.log('   ⚠️  No employees found!\n');
  }

  // Check stores
  console.log('🏪 Stores (for matching):');
  const { data: stores } = await supabase
    .from('stores')
    .select('id, name, province')
    .order('name');

  if (stores && stores.length > 0) {
    console.log(`   Found ${stores.length} stores\n`);
    stores.slice(0, 5).forEach(store => {
      console.log(`   - ${store.name} (${store.province || 'N/A'})`);
    });
    if (stores.length > 5) {
      console.log(`   ... and ${stores.length - 5} more\n`);
    }
  } else {
    console.log('   ⚠️  No stores found!\n');
  }

  // Check products
  console.log('📦 Products (for matching):');
  const { data: products } = await supabase
    .from('products')
    .select('id, code, name, is_active')
    .eq('is_active', true)
    .order('code');

  if (products && products.length > 0) {
    console.log(`   Found ${products.length} active products\n`);
    products.slice(0, 5).forEach(prod => {
      console.log(`   - [${prod.code}] ${prod.name}`);
    });
    if (products.length > 5) {
      console.log(`   ... and ${products.length - 5} more\n`);
    }
  } else {
    console.log('   ⚠️  No products found!\n');
  }

  // Check product units
  if (products && products.length > 0) {
    console.log('📏 Product Units (sample):');
    const { data: units } = await supabase
      .from('product_units')
      .select('id, product_id, name, sku')
      .eq('product_id', products[0].id);

    if (units && units.length > 0) {
      console.log(`   Product: [${products[0].code}] ${products[0].name}`);
      units.forEach(unit => {
        console.log(`   - Unit: ${unit.name} (SKU: ${unit.sku || 'N/A'})`);
      });
      console.log('');
    } else {
      console.log(`   ⚠️  No units found for product: ${products[0].name}\n`);
    }
  }

  // Summary
  console.log('📊 Summary:');
  console.log(`   Employees: ${employees?.length || 0}`);
  console.log(`   Stores: ${stores?.length || 0}`);
  console.log(`   Products: ${products?.length || 0}`);
  console.log('');

  if (!employees || employees.length === 0) {
    console.log('⚠️  WARNING: No employees found!');
    console.log('   Import will fail because it cannot match employee names.\n');
  }

  if (!products || products.length === 0) {
    console.log('⚠️  WARNING: No products found!');
    console.log('   Import will fail because it cannot match product codes.\n');
  }

  console.log('💡 Tips for successful import:');
  console.log('   1. CSV/Excel must have columns: employeeName, storeName, productCode, productName, units');
  console.log('   2. Employee names must match EXACTLY (case-insensitive)');
  console.log('   3. Product codes must match EXACTLY (case-insensitive)');
  console.log('   4. Store names must match EXACTLY (case-insensitive, or leave blank for global)');
  console.log('   5. Units format: "unitName|pricePc|isActive;unitName2|pricePc2|isActive2"');
  console.log('');
}

debugImport().catch(console.error);
