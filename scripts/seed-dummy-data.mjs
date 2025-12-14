#!/usr/bin/env node

/**
 * Seed dummy data for testing product assignment import
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

async function seedData() {
  console.log('🌱 Seeding dummy data...\n');

  // 1. Create dummy employees
  console.log('👥 Creating employees...');
  const { data: employees, error: empError } = await supabase
    .from('employees')
    .upsert([
      {
        id: '11111111-1111-1111-1111-111111111111',
        name: 'พนักงาน A',
        employee_code: 'EMP-A',
        phone: '0812345678',
        province: 'กรุงเทพฯ',
        region: 'กรุงเทพและปริมณฑล',
        active_status: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: '22222222-2222-2222-2222-222222222222',
        name: 'พนักงาน B',
        employee_code: 'EMP-B',
        phone: '0887654321',
        province: 'เชียงใหม่',
        region: 'เหนือ',
        active_status: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ], { onConflict: 'id' })
    .select();

  if (empError) {
    console.error('❌ Error creating employees:', empError.message);
    return;
  }
  console.log(`✅ Created ${employees?.length || 0} employees\n`);

  // 2. Create dummy stores
  console.log('🏪 Creating stores...');
  const { data: stores, error: storeError } = await supabase
    .from('stores')
    .upsert([
      {
        id: '33333333-3333-3333-3333-333333333333',
        name: 'ร้าน Test A',
        code: 'STORE-A',
        province: 'กรุงเทพฯ',
        latitude: 13.7563,
        longitude: 100.5018,
        radius: 100,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: '44444444-4444-4444-4444-444444444444',
        name: 'ร้าน Test B',
        code: 'STORE-B',
        province: 'เชียงใหม่',
        latitude: 18.7883,
        longitude: 98.9853,
        radius: 100,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ], { onConflict: 'id' })
    .select();

  if (storeError) {
    console.error('❌ Error creating stores:', storeError.message);
    return;
  }
  console.log(`✅ Created ${stores?.length || 0} stores\n`);

  // 3. Create dummy category
  console.log('📁 Creating category...');
  const { data: category, error: catError } = await supabase
    .from('categories')
    .upsert([
      {
        id: '55555555-5555-5555-5555-555555555555',
        name: 'หมวดทดสอบ',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ], { onConflict: 'id' })
    .select()
    .single();

  if (catError) {
    console.error('❌ Error creating category:', catError.message);
    return;
  }
  console.log(`✅ Created category: ${category?.name}\n`);

  // 4. Create dummy products
  console.log('📦 Creating products...');
  const { data: products, error: prodError } = await supabase
    .from('products')
    .upsert([
      {
        id: '66666666-6666-6666-6666-666666666666',
        code: 'PROD-001',
        name: 'สินค้า Test 1',
        category_id: category.id,
        active_status: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: '77777777-7777-7777-7777-777777777777',
        code: 'PROD-002',
        name: 'สินค้า Test 2',
        category_id: category.id,
        active_status: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ], { onConflict: 'id' })
    .select();

  if (prodError) {
    console.error('❌ Error creating products:', prodError.message);
    return;
  }
  console.log(`✅ Created ${products?.length || 0} products\n`);

  // 5. Create product units
  console.log('📏 Creating product units...');
  const { data: units, error: unitsError } = await supabase
    .from('product_units')
    .upsert([
      // Product 1 units
      {
        id: '88888888-8888-8888-8888-888888888888',
        product_id: products[0].id,
        name: 'กล่อง',
        sku: 'BOX',
        is_base_unit: true,
        base_unit_multiplier: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: '99999999-9999-9999-9999-999999999999',
        product_id: products[0].id,
        name: 'ชิ้น',
        sku: 'PC',
        is_base_unit: false,
        base_unit_multiplier: 12,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      // Product 2 units
      {
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        product_id: products[1].id,
        name: 'กล่อง',
        sku: 'BOX',
        is_base_unit: true,
        base_unit_multiplier: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        product_id: products[1].id,
        name: 'แพ็ค',
        sku: 'PACK',
        is_base_unit: false,
        base_unit_multiplier: 6,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ], { onConflict: 'id' })
    .select();

  if (unitsError) {
    console.error('❌ Error creating units:', unitsError.message);
    return;
  }
  console.log(`✅ Created ${units?.length || 0} product units\n`);

  // Summary
  console.log('✅ Dummy data seeded successfully!\n');
  console.log('📊 Summary:');
  console.log(`   Employees: ${employees?.length || 0}`);
  console.log(`   Stores: ${stores?.length || 0}`);
  console.log(`   Products: ${products?.length || 0}`);
  console.log(`   Product Units: ${units?.length || 0}\n`);

  console.log('💡 Now you can test product assignment import with:');
  console.log('   Employee names: "พนักงาน A", "พนักงาน B"');
  console.log('   Store names: "ร้าน Test A", "ร้าน Test B"');
  console.log('   Product codes: "PROD-001", "PROD-002"');
  console.log('   Unit names: "กล่อง", "ชิ้น", "แพ็ค"\n');
}

seedData().catch(console.error);
