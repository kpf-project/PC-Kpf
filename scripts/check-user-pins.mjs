#!/usr/bin/env node

/**
 * Check user_pins table
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

async function checkUserPins() {
  console.log('🔐 Checking user_pins table...\n');

  const { data, error, count } = await supabase
    .from('user_pins')
    .select('*', { count: 'exact' })
    .eq('is_active', true);

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  console.log(`✅ Found ${count} active user PINs\n`);

  if (data && data.length > 0) {
    console.log('📋 Active User PINs:\n');
    data.forEach((user, index) => {
      console.log(`${index + 1}. ${user.employee_name || 'No name'}`);
      console.log(`   - ID: ${user.id}`);
      console.log(`   - Employee ID: ${user.employee_id || 'N/A'}`);
      console.log(`   - Role: ${user.role}`);
      console.log(`   - Has PIN hash: ${user.pin_hash ? 'Yes' : 'No'}`);
      console.log(`   - Active: ${user.is_active}`);
      console.log('');
    });
  } else {
    console.log('⚠️  No active user PINs found!');
    console.log('   You need to create user PINs first.');
    console.log('   Go to: /admin/user-pins\n');
  }
}

checkUserPins().catch(console.error);
