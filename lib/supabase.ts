/**
 * lib/supabase.ts — Browser-safe Supabase client
 * Uses the public anon key — safe to expose in the browser.
 * For server-side queries (API routes), use lib/supabaseAdmin.ts instead.
 */
import { createClient } from '@supabase/supabase-js';

// TODO: These come from your .env.local file — see .env.local.example
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ─── TypeScript types for your tables ────────────────────────────────────────

export interface Contact {
  id: number;
  name: string | null;
  phone: string;
  opted_in: boolean;
  last_sent_at: string | null;
  last_status: string | null;
  error_detail: string | null;
  created_at: string;
}

export interface MessageLog {
  id: number;
  contact_id: number | null;
  phone: string;
  direction: 'outbound' | 'inbound';
  message_body: string | null;
  wa_message_id: string | null;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  error_code: string | null;
  error_message: string | null;
  sent_at: string;
  updated_at: string;
}
