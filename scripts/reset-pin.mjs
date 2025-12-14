#!/usr/bin/env node

/**
 * Reset PIN for a user
 * Usage: node scripts/reset-pin.mjs <employee_id> <new_pin>
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import bcrypt from 'bcryptjs';

const [, , employeeId, newPin] = process.argv;

if (!employeeId || !newPin) {
  console.log('Usage: node scripts/reset-pin.mjs <employee_id> <new_pin>');
  console.log('Example: node scripts/reset-pin.mjs admin_default 111111\n');
  process.exit(1);
}

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

async function resetPin() {
  console.log(`🔐 Resetting PIN for: ${employeeId}\n`);

  // Hash new PIN
  const pinHash = await bcrypt.hash(newPin, 10);

  // Update PIN
  const { data, error } = await supabase
    .from('user_pins')
    .update({
      pin_hash: pinHash,
      updated_at: new Date().toISOString()
    })
    .eq('employee_id', employeeId)
    .select()
    .single();

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  if (!data) {
    console.error('❌ User not found with employee_id:', employeeId);
    return;
  }

  console.log('✅ PIN updated successfully!\n');
  console.log('📝 User Details:');
  console.log(`   Employee ID: ${data.employee_id}`);
  console.log(`   Name: ${data.employee_name}`);
  console.log(`   Role: ${data.role}`);
  console.log(`   New PIN: ${newPin}\n`);
}

resetPin().catch(console.error);
