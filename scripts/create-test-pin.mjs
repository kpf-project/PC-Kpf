#!/usr/bin/env node

/**
 * Create a test PIN for debugging
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import bcrypt from 'bcryptjs';

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

async function createTestPin() {
  console.log('🔐 Creating test PIN...\n');

  const testPin = '999999';
  const pinHash = await bcrypt.hash(testPin, 10);

  // Check if test user already exists
  const { data: existing } = await supabase
    .from('user_pins')
    .select('id')
    .eq('employee_id', 'test_user')
    .single();

  if (existing) {
    // Update existing
    const { error } = await supabase
      .from('user_pins')
      .update({
        pin_hash: pinHash,
        is_active: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id);

    if (error) {
      console.error('❌ Error updating:', error.message);
      return;
    }

    console.log('✅ Updated existing test user');
  } else {
    // Create new
    const { error } = await supabase
      .from('user_pins')
      .insert({
        employee_id: 'test_user',
        employee_name: 'Test User',
        pin_hash: pinHash,
        role: 'super_admin',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error('❌ Error creating:', error.message);
      return;
    }

    console.log('✅ Created new test user');
  }

  console.log('\n📝 Test Credentials:');
  console.log('   PIN: 999999');
  console.log('   Role: super_admin');
  console.log('   Employee ID: test_user\n');
  console.log('🔗 Try logging in at: http://localhost:3001/login\n');
}

createTestPin().catch(console.error);
