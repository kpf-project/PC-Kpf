#!/usr/bin/env node

/**
 * Check if database schema (tables) still exist
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

async function checkSchema() {
  console.log('🔍 Checking database schema...\n');

  // Check tables manually
  let data = null;
  let error = 'Using manual check';

  if (error) {
    console.log('⚠️  Cannot use RPC, checking tables manually...\n');

    const tables = [
      'employees',
      'stores',
      'products',
      'product_units',
      'categories',
      'sales_records',
      'attendance_records',
      'user_pins',
      'stock_batches',
      'stock_inventory',
      'stock_transactions',
      'companies'
    ];

    for (const table of tables) {
      const { error: tableError } = await supabase
        .from(table)
        .select('id', { count: 'exact', head: true })
        .limit(0);

      if (tableError) {
        console.log(`   ❌ ${table}: Table not found or error`);
      } else {
        console.log(`   ✅ ${table}: Table exists (but empty)`);
      }
    }
  } else {
    console.log('✅ Tables found:', data);
  }

  console.log('\n💡 สรุป:');
  console.log('   - ถ้าตารางยังมีอยู่ → แค่ลบข้อมูลเท่านั้น → restore จาก backup');
  console.log('   - ถ้าตารางหายไป → ต้อง run migrations ก่อน\n');
}

checkSchema().catch(console.error);
