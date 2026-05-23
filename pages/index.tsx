import { useState, useEffect, useCallback } from 'react';
import type { Contact } from '@/lib/supabase';

type SendMode = 'text' | 'template';

type LogEntry = {
  id: number;
  phone: string;
  direction: 'inbound' | 'outbound';
  message_body: string | null;
  status: string;
  sent_at: string;
  contacts?: { name: string | null; phone: string } | null;
};

export default function Home() {
  const [contacts, setContacts]               = useState<Contact[]>([]);
  const [selected, setSelected]               = useState<Set<number>>(new Set());
  const [sendToAll, setSendToAll]             = useState(false);
  const [mode, setMode]                       = useState<SendMode>('text');
  const [message, setMessage]                 = useState('');
  const [templateName, setTemplateName]       = useState('');
  const [sending, setSending]                 = useState(false);
  const [result, setResult]                   = useState<string | null>(null);
  const [resultOk, setResultOk]               = useState(true);
  const [logs, setLogs]                       = useState<LogEntry[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [loadingLogs, setLoadingLogs]         = useState(true);

  const fetchContacts = useCallback(async () => {
    setLoadingContacts(true);
    try {
      const res = await fetch('/api/contacts?opted_in=true');
      const json = await res.json();
      setContacts(json.contacts ?? []);
    } finally {
      setLoadingContacts(false);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const res = await fetch('/api/logs?limit=30');
      const json = await res.json();
      setLogs(json.logs ?? []);
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  useEffect(() => {
    fetchContacts();
    fetchLogs();
  }, [fetchContacts, fetchLogs]);

  const toggleContact = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === contacts.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(contacts.map((c) => c.id)));
    }
  };

  const handleSend = async () => {
    setResult(null);
    if (!sendToAll && selected.size === 0) {
      setResult('Select at least one contact, or enable "Send to all opted-in".');
      setResultOk(false);
      return;
    }
    if (mode === 'text' && !message.trim()) {
      setResult('Please enter a message.');
      setResultOk(false);
      return;
    }
    if (mode === 'template' && !templateName.trim()) {
      setResult('Please enter a template name.');
      setResultOk(false);
      return;
    }

    setSending(true);
    try {
      const body: Record<string, unknown> = { useTemplate: mode === 'template' };
      if (sendToAll) {
        body.sendToAll = true;
      } else {
        body.contactIds = Array.from(selected);
      }
      if (mode === 'text') body.message = message;
      else body.templateName = templateName;

      const res = await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();

      if (!res.ok) {
        setResult(`Error: ${json.error}`);
        setResultOk(false);
      } else {
        setResult(`✓ Sent: ${json.sent}   ✗ Failed: ${json.failed}`);
        setResultOk(json.failed === 0);
        await fetchContacts();
        await fetchLogs();
      }
    } catch (e) {
      setResult(`Network error: ${e instanceof Error ? e.message : String(e)}`);
      setResultOk(false);
    } finally {
      setSending(false);
    }
  };

  const statusColor = (s: string) => {
    if (s === 'read')      return '#16a34a';
    if (s === 'delivered') return '#2563eb';
    if (s === 'sent')      return '#6b7280';
    if (s === 'failed')    return '#dc2626';
    return '#6b7280';
  };

  const allSelected = contacts.length > 0 && selected.size === contacts.length;

  return (
    <div style={{
      fontFamily: "'Inter', system-ui, sans-serif",
      maxWidth: 1080,
      margin: '0 auto',
      padding: '2rem 1.25rem',
      color: '#111827',
    }}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '2rem', paddingBottom: '1.25rem',
        borderBottom: '1px solid #e5e7eb',
      }}>
        <div>
          <h1 style={{ fontSize: '1.375rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
            📨 WhatsApp Business Sender
          </h1>
          <p style={{ color: '#6b7280', marginTop: '0.2rem', fontSize: '0.85rem' }}>
            Send messages to opted-in contacts from your Supabase database.
          </p>
        </div>
        <button
          onClick={() => { fetchContacts(); fetchLogs(); }}
          style={{
            fontSize: '0.8rem', padding: '0.4rem 0.9rem', borderRadius: 6,
            border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', color: '#374151',
          }}
        >
          ↻ Refresh
        </button>
      </header>

      {/* ── Main two-column layout ───────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>

        {/* ── Left: Contacts ────────────────────────────────────────────── */}
        <section>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: '0.75rem',
          }}>
            <h2 style={{ fontSize: '0.95rem', fontWeight: 600 }}>
              Contacts{' '}
              {!loadingContacts && (
                <span style={{ color: '#9ca3af', fontWeight: 400 }}>({contacts.length})</span>
              )}
            </h2>
            <label style={{
              fontSize: '0.82rem', display: 'flex', alignItems: 'center',
              gap: '0.35rem', cursor: 'pointer', color: '#374151',
            }}>
              <input
                type="checkbox"
                checked={sendToAll}
                onChange={(e) => { setSendToAll(e.target.checked); setSelected(new Set()); }}
              />
              Send to all opted-in
            </label>
          </div>

          {loadingContacts ? (
            <div style={{ color: '#9ca3af', fontSize: '0.85rem', padding: '1rem 0' }}>Loading contacts…</div>
          ) : contacts.length === 0 ? (
            <div style={{
              padding: '2rem 1rem', textAlign: 'center', border: '1px dashed #d1d5db',
              borderRadius: 8, color: '#9ca3af', fontSize: '0.85rem',
            }}>
              <p>No opted-in contacts found.</p>
              <p style={{ marginTop: '0.4rem' }}>
                Add rows to your Supabase <code style={{ background: '#f3f4f6', padding: '1px 4px', borderRadius: 3 }}>contacts</code> table with <code style={{ background: '#f3f4f6', padding: '1px 4px', borderRadius: 3 }}>opted_in = true</code>.
              </p>
            </div>
          ) : (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
              {/* Select-all row */}
              {!sendToAll && (
                <label style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.55rem 0.75rem', cursor: 'pointer',
                  background: '#f9fafb', borderBottom: '1px solid #e5e7eb',
                }}>
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                  <span style={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: 500 }}>
                    {allSelected ? 'Deselect all' : 'Select all'}
                  </span>
                </label>
              )}

              {contacts.map((c, i) => (
                <label
                  key={c.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.6rem 0.75rem',
                    cursor: sendToAll ? 'default' : 'pointer',
                    background: selected.has(c.id) ? '#f0fdf4' : i % 2 === 0 ? '#fff' : '#fafafa',
                    borderBottom: i < contacts.length - 1 ? '1px solid #f3f4f6' : 'none',
                    opacity: sendToAll ? 0.55 : 1,
                    transition: 'background 0.1s',
                  }}
                >
                  <input
                    type="checkbox"
                    disabled={sendToAll}
                    checked={selected.has(c.id)}
                    onChange={() => toggleContact(c.id)}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.name ?? <span style={{ color: '#9ca3af' }}>No name</span>}
                    </div>
                    <div style={{ color: '#6b7280', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                      {c.phone}
                    </div>
                  </div>
                  {c.last_status && (
                    <span style={{
                      fontSize: '0.68rem', padding: '2px 7px', borderRadius: 999,
                      background: '#f3f4f6', color: statusColor(c.last_status),
                      fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em',
                    }}>
                      {c.last_status}
                    </span>
                  )}
                </label>
              ))}
            </div>
          )}

          <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.5rem' }}>
            {sendToAll
              ? `Will send to all ${contacts.length} opted-in contact${contacts.length !== 1 ? 's' : ''}.`
              : `${selected.size} of ${contacts.length} selected`}
          </p>
        </section>

        {/* ── Right: Compose ────────────────────────────────────────────── */}
        <section>
          <h2 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.75rem' }}>
            Compose
          </h2>

          {/* Mode toggle */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
            {(['text', 'template'] as SendMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                style={{
                  flex: 1, padding: '0.45rem 0', borderRadius: 7,
                  border: `1.5px solid ${mode === m ? '#16a34a' : '#d1d5db'}`,
                  background: mode === m ? '#16a34a' : '#fff',
                  color: mode === m ? '#fff' : '#374151',
                  fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {m === 'text' ? '💬 Free text' : '📋 Template'}
              </button>
            ))}
          </div>

          {mode === 'text' ? (
            <>
              <label style={{ fontSize: '0.85rem', fontWeight: 500, display: 'block', marginBottom: '0.4rem' }}>
                Message
              </label>
              <textarea
                rows={7}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your message here…"
                style={{
                  width: '100%', padding: '0.65rem 0.75rem', borderRadius: 7,
                  border: '1.5px solid #d1d5db', fontSize: '0.875rem',
                  resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.6,
                  outline: 'none', fontFamily: 'inherit',
                }}
                onFocus={(e) => { e.target.style.borderColor = '#16a34a'; }}
                onBlur={(e) => { e.target.style.borderColor = '#d1d5db'; }}
              />
              <p style={{
                fontSize: '0.75rem', color: '#d97706', marginTop: '0.4rem',
                background: '#fffbeb', padding: '0.4rem 0.6rem', borderRadius: 5,
                border: '1px solid #fde68a',
              }}>
                ⚠️ Free text only works within a 24-hour customer-service window (recipient must have messaged you first). For proactive outreach, use a template.
              </p>
            </>
          ) : (
            <>
              <label style={{ fontSize: '0.85rem', fontWeight: 500, display: 'block', marginBottom: '0.4rem' }}>
                Template name
              </label>
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g. hello_world"
                style={{
                  width: '100%', padding: '0.65rem 0.75rem', borderRadius: 7,
                  border: '1.5px solid #d1d5db', fontSize: '0.875rem',
                  boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit',
                }}
                onFocus={(e) => { e.target.style.borderColor = '#16a34a'; }}
                onBlur={(e) => { e.target.style.borderColor = '#d1d5db'; }}
              />
              {/* TODO: Add language code selector if needed */}
              {/* TODO: Add component variable inputs if your template has placeholders */}
              <p style={{
                fontSize: '0.75rem', color: '#6b7280', marginTop: '0.5rem',
                background: '#f9fafb', padding: '0.4rem 0.6rem', borderRadius: 5,
                border: '1px solid #e5e7eb',
              }}>
                Templates must be pre-approved in Meta Business Manager and can be sent at any time (no 24h window restriction). Default language: <code>en_US</code> — edit <code>lib/whatsapp.ts</code> to change.
              </p>
            </>
          )}

          <button
            onClick={handleSend}
            disabled={sending}
            style={{
              marginTop: '1.25rem', width: '100%', padding: '0.7rem',
              background: sending ? '#86efac' : '#16a34a',
              color: '#fff', border: 'none', borderRadius: 8,
              fontWeight: 700, fontSize: '0.95rem',
              cursor: sending ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
              letterSpacing: '-0.01em',
            }}
          >
            {sending ? 'Sending…' : `Send message${sendToAll || selected.size > 1 ? 's' : ''}`}
          </button>

          {result && (
            <div style={{
              marginTop: '0.75rem', padding: '0.65rem 0.8rem', borderRadius: 7,
              background: resultOk ? '#f0fdf4' : '#fef2f2',
              border: `1px solid ${resultOk ? '#bbf7d0' : '#fecaca'}`,
              color: resultOk ? '#15803d' : '#dc2626',
              fontSize: '0.875rem', fontWeight: 500,
            }}>
              {result}
            </div>
          )}
        </section>
      </div>

      {/* ── Message Log ─────────────────────────────────────────────────── */}
      <section style={{ marginTop: '3rem' }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: '0.75rem',
        }}>
          <h2 style={{ fontSize: '0.95rem', fontWeight: 600 }}>
            Message log
            <span style={{ color: '#9ca3af', fontWeight: 400 }}> (last 30)</span>
          </h2>
          <button
            onClick={fetchLogs}
            style={{
              fontSize: '0.8rem', color: '#2563eb', background: 'none',
              border: 'none', cursor: 'pointer',
            }}
          >
            ↻ Refresh
          </button>
        </div>

        {loadingLogs ? (
          <p style={{ color: '#9ca3af', fontSize: '0.85rem' }}>Loading…</p>
        ) : logs.length === 0 ? (
          <p style={{ color: '#9ca3af', fontSize: '0.85rem' }}>No messages sent yet.</p>
        ) : (
          <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid #e5e7eb' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  {['Time', 'Contact', 'Phone', 'Dir', 'Message', 'Status'].map((h) => (
                    <th key={h} style={{
                      padding: '0.55rem 0.8rem', textAlign: 'left',
                      color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log, i) => (
                  <tr
                    key={log.id}
                    style={{
                      borderBottom: i < logs.length - 1 ? '1px solid #f3f4f6' : 'none',
                      background: i % 2 === 0 ? '#fff' : '#fafafa',
                    }}
                  >
                    <td style={{ padding: '0.55rem 0.8rem', color: '#6b7280', whiteSpace: 'nowrap' }}>
                      {new Date(log.sent_at).toLocaleString()}
                    </td>
                    <td style={{ padding: '0.55rem 0.8rem', fontWeight: 500 }}>
                      {log.contacts?.name ?? <span style={{ color: '#9ca3af' }}>—</span>}
                    </td>
                    <td style={{ padding: '0.55rem 0.8rem', fontFamily: 'monospace', color: '#374151' }}>
                      {log.phone}
                    </td>
                    <td style={{ padding: '0.55rem 0.8rem' }}>
                      <span style={{
                        fontSize: '0.7rem', padding: '2px 7px', borderRadius: 999,
                        background: log.direction === 'inbound' ? '#eff6ff' : '#f0fdf4',
                        color: log.direction === 'inbound' ? '#2563eb' : '#16a34a',
                        fontWeight: 700,
                      }}>
                        {log.direction === 'inbound' ? '← in' : '→ out'}
                      </span>
                    </td>
                    <td style={{
                      padding: '0.55rem 0.8rem', maxWidth: 260,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      color: '#374151',
                    }}>
                      {log.message_body ?? <span style={{ color: '#9ca3af' }}>—</span>}
                    </td>
                    <td style={{ padding: '0.55rem 0.8rem' }}>
                      <span style={{
                        color: statusColor(log.status), fontWeight: 700,
                        textTransform: 'uppercase', fontSize: '0.72rem', letterSpacing: '0.03em',
                      }}>
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer style={{
        marginTop: '3rem', paddingTop: '1.25rem',
        borderTop: '1px solid #e5e7eb',
        fontSize: '0.75rem', color: '#9ca3af',
        display: 'flex', gap: '1.5rem', flexWrap: 'wrap',
      }}>
        <span>WhatsApp Business Sender</span>
        <a
          href="https://developers.facebook.com/docs/whatsapp/cloud-api"
          target="_blank" rel="noopener noreferrer"
          style={{ color: '#6b7280' }}
        >
          WA Cloud API docs ↗
        </a>
        <a
          href="https://supabase.com/docs"
          target="_blank" rel="noopener noreferrer"
          style={{ color: '#6b7280' }}
        >
          Supabase docs ↗
        </a>
      </footer>
    </div>
  );
}
