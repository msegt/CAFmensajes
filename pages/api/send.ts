/**
 * POST /api/send
 * Body: { contactIds?: number[], sendToAll?: boolean, message?: string, useTemplate?: boolean, templateName?: string }
 *
 * Fetches selected contacts from Supabase, sends a WhatsApp message to each,
 * and writes the result back to message_log.
 */
export const runtime = 'edge';
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendTextMessage, sendTemplate } from '@/lib/whatsapp';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { contactIds, sendToAll, message, useTemplate, templateName } = req.body as {
    contactIds?: number[];
    sendToAll?: boolean;
    message?: string;
    useTemplate?: boolean;
    templateName?: string;
  };

  if (!sendToAll && (!contactIds || contactIds.length === 0)) {
    return res.status(400).json({ error: 'Provide contactIds or set sendToAll: true' });
  }
  if (!useTemplate && !message?.trim()) {
    return res.status(400).json({ error: 'message is required for text sends' });
  }
  if (useTemplate && !templateName?.trim()) {
    return res.status(400).json({ error: 'templateName is required for template sends' });
  }

  // ── Fetch contacts from Supabase ──────────────────────────────────────────
  let query = supabaseAdmin
    .from('contacts')
    .select('id, name, phone')
    .eq('opted_in', true);

  if (!sendToAll && contactIds) {
    query = query.in('id', contactIds);
  }

  const { data: contacts, error: fetchError } = await query;
  if (fetchError) return res.status(500).json({ error: fetchError.message });
  if (!contacts || contacts.length === 0) {
    return res.status(200).json({ results: [], message: 'No opted-in contacts found.' });
  }

  // ── Send to each contact ──────────────────────────────────────────────────
  const results = [];

  for (const contact of contacts) {
    let result: { ok: boolean; messageId?: string; error?: string };

    if (useTemplate) {
      result = await sendTemplate({ to: contact.phone, templateName: templateName! });
    } else {
      result = await sendTextMessage({ to: contact.phone, body: message! });
    }

    // Write to message_log
    await supabaseAdmin.from('message_log').insert({
      contact_id: contact.id,
      phone: contact.phone,
      direction: 'outbound',
      message_body: useTemplate ? `[template: ${templateName}]` : message,
      wa_message_id: result.messageId ?? null,
      status: result.ok ? 'sent' : 'failed',
      error_message: result.error ?? null,
    });

    // Update contacts.last_status
    await supabaseAdmin
      .from('contacts')
      .update({
        last_sent_at: new Date().toISOString(),
        last_status: result.ok ? 'sent' : 'failed',
        error_detail: result.error ?? null,
      })
      .eq('id', contact.id);

    results.push({ id: contact.id, phone: contact.phone, ...result });
  }

  const failed = results.filter((r) => !r.ok);
  return res.status(200).json({
    sent: results.filter((r) => r.ok).length,
    failed: failed.length,
    results,
  });
}
