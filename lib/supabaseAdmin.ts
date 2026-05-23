/**
 * lib/supabaseAdmin.ts — Server-only Supabase admin client
 *
 * ⚠️  NEVER import this file in any component or page.
 *     It uses the service_role key which bypasses Row Level Security.
 *     Only import this in files inside pages/api/
 */
import { createClient } from '@supabase/supabase-js';

// TODO: Set SUPABASE_SERVICE_ROLE_KEY in .env.local (see .env.local.example)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
