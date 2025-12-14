import fs from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

async function loadEnvFile(filePath) {
  const content = await fs.readFile(filePath, 'utf8');
  const env = {};
  for (const line of content.split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim().replace(/^"|"$/g, '');
    env[key] = value;
  }
  return env;
}

function normalizeTimestamp(value) {
  if (!value) return new Date().toISOString();
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return new Date().toISOString();
  }
  return date.toISOString();
}

async function main() {
  const root = process.cwd();
  const envPath = path.join(root, '.env.local');
  const env = await loadEnvFile(envPath);
  const supabaseUrl = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
  }

  const client = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const dataPath = path.join(root, 'data/app-data.json');
  const raw = await fs.readFile(dataPath, 'utf8');
  const json = JSON.parse(raw);
  const stores = Array.isArray(json.stores) ? json.stores : [];
  const employees = Array.isArray(json.employees) ? json.employees : [];

  console.log(`Syncing ${stores.length} stores and ${employees.length} employees...`);

  for (const store of stores) {
    const payload = {
      id: store.id,
      name: store.name,
      province: store.province ?? null,
      address: store.address ?? null,
      latitude: store.latitude ?? null,
      longitude: store.longitude ?? null,
      radius: store.radius ?? null,
      created_at: normalizeTimestamp(store.createdAt),
      updated_at: normalizeTimestamp(store.updatedAt),
    };
    const { error } = await client.from('stores').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.error('Failed to upsert store', store.id, error.message);
    }
  }

  for (const employee of employees) {
    const payload = {
      id: employee.id,
      name: employee.name,
      phone: employee.phone ?? null,
      regular_day_off: employee.regularDayOff ?? null,
      province: employee.province ?? null,
      region: employee.region ?? null,
      default_store_id: employee.defaultStoreId ?? null,
      created_at: normalizeTimestamp(employee.createdAt),
      updated_at: normalizeTimestamp(employee.updatedAt),
    };
    const { error } = await client.from('employees').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.error('Failed to upsert employee', employee.id, error.message);
    }
  }

  console.log('Sync completed.');
}

main().catch((error) => {
  console.error('Unexpected error during sync', error);
  process.exit(1);
});
