/**
 * GET /api/contacts
 * Returns all contacts from Supabase.
 * Supports ?opted_in=true to filter to opted-in contacts only.
 */
export const runtime = 'edge';
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { Contact } from '@/lib/supabase';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let query = supabaseAdmin
    .from('contacts')
    .select('*')
    .order('created_at', { ascending: false });

  // Optional filter: /api/contacts?opted_in=true
  if (req.query.opted_in === 'true') {
    query = query.eq('opted_in', true);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[contacts] Supabase error:', error);
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ contacts: data as Contact[] });
}
