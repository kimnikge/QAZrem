import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import { env } from '../config/env.js';

export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL
});

export async function closePool() {
  await pool.end();
}

let supabaseClient: ReturnType<typeof createClient> | null = null;

export function getSupabaseClient() {
  if (!supabaseClient) {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
      throw new Error(
        'Supabase client not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env'
      );
    }
    supabaseClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  }
  return supabaseClient;
}

export function getSupabaseAnonClient() {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    throw new Error(
      'Supabase anon client not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY in .env'
    );
  }
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
}
