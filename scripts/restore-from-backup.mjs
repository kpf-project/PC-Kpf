#!/usr/bin/env node

/**
 * Restore Supabase Data from Backup
 *
 * Usage:
 *   node scripts/restore-from-backup.mjs --backup backup.sql
 *   node scripts/restore-from-backup.mjs --check-backups
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// Load environment variables from .env.local manually
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

const SUPABASE_URL = env.SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing environment variables!');
  console.error('   Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const args = process.argv.slice(2);
const backupFlag = args.indexOf('--backup');
const checkFlag = args.indexOf('--check-backups');

/**
 * Check available backups
 */
async function checkBackups() {
  console.log('🔍 Checking Supabase backups...\n');

  console.log('📋 ตรวจสอบ Backup ได้ที่:');
  console.log('   1. Supabase Dashboard → Settings → Database → Backups');
  console.log('   2. Free Plan: เก็บ backup 7 วันล่าสุด (daily)');
  console.log('   3. Pro Plan: Point-in-Time Recovery (PITR) ย้อนหลังได้ถึง 7 วัน');
  console.log('   4. Team/Enterprise: ย้อนหลังได้มากขึ้น\n');

  // Check if tables exist and count rows
  const tables = [
    'employees',
    'stores',
    'products',
    'sales_records',
    'attendance_records',
    'user_pins',
    'stock_batches'
  ];

  console.log('📊 Current Database Status:\n');

  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.log(`   ❌ ${table}: Error - ${error.message}`);
    } else {
      console.log(`   ${count === 0 ? '⚠️' : '✅'} ${table}: ${count} rows`);
    }
  }

  console.log('\n💡 วิธีกู้คืน:');
  console.log('   1. Download backup จาก Supabase Dashboard');
  console.log('   2. Run: node scripts/restore-from-backup.mjs --backup path/to/backup.sql');
  console.log('   3. หรือ Restore ผ่าน SQL Editor ใน Supabase Dashboard\n');
}

/**
 * Restore from backup file
 */
async function restoreFromFile(filePath) {
  console.log('🔄 Restoring from backup...\n');

  const fullPath = resolve(filePath);

  if (!existsSync(fullPath)) {
    console.error(`❌ File not found: ${fullPath}`);
    process.exit(1);
  }

  console.log(`📁 Reading backup: ${fullPath}`);
  const sql = readFileSync(fullPath, 'utf-8');

  console.log('⚠️  NOTE: This script cannot directly execute SQL.');
  console.log('📝 Please follow these steps:\n');
  console.log('1. Go to Supabase Dashboard → SQL Editor');
  console.log('2. Create a new query');
  console.log('3. Paste the SQL from your backup file');
  console.log('4. Review the SQL carefully');
  console.log('5. Click "Run" to execute\n');
  console.log('💾 Backup file is ready for manual restore.');

  // Show SQL preview
  const lines = sql.split('\n');
  console.log('\n📄 SQL Preview (first 10 lines):');
  console.log('━'.repeat(60));
  console.log(lines.slice(0, 10).join('\n'));
  console.log('━'.repeat(60));
  console.log(`... (${lines.length} total lines)\n`);
}

/**
 * Main
 */
async function main() {
  console.log('🚀 Supabase Restore Tool\n');

  if (checkFlag !== -1) {
    await checkBackups();
  } else if (backupFlag !== -1 && args[backupFlag + 1]) {
    await restoreFromFile(args[backupFlag + 1]);
  } else {
    console.log('Usage:');
    console.log('  node scripts/restore-from-backup.mjs --check-backups');
    console.log('  node scripts/restore-from-backup.mjs --backup path/to/backup.sql\n');

    // Show current status by default
    await checkBackups();
  }
}

main().catch(console.error);
