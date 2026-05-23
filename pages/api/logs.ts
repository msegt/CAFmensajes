/**
 * GET /api/logs
 * Returns message_log rows, most recent first.
 * Optional query params: ?limit=50&contact_id=123
 */
export const runtime = 'edge';
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const limit = Number(req.query.limit ?? 100);

  let query = supabaseAdmin
    .from('message_log')
    .select('*, contacts(name, phone)')
    .order('sent_at', { ascending: false })
    .limit(limit);

  if (req.query.contact_id) {
    query = query.eq('contact_id', Number(req.query.contact_id));
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ logs: data });
}
