import { readStore, mutateStore, now } from '@/lib/server/store';

export async function GET() {
  try {
    const db = readStore();
    return Response.json({ logs: (Array.isArray(db.assistant_logs) ? db.assistant_logs : []).slice(-100).reverse() });
  } catch {
    return Response.json({ logs: [] });
  }
}


export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid JSON body.' }, { status: 400 }); }
  const messages = Array.isArray(body?.messages) ? body.messages.slice(-2) : [];
  const entries = messages.filter((item) => item && typeof item.text === 'string').map((item) => ({
    id: String(item.id || `${Date.now()}`), role: item.role === 'user' ? 'user' : 'assistant',
    text: String(item.text).slice(0, 2000), at: String(item.at || now()),
    action: item.action ? String(item.action).slice(0, 60) : null,
    href: item.href ? String(item.href).slice(0, 120) : null,
    source: item.source ? String(item.source).slice(0, 40) : null,
  }));
  try {
    mutateStore((db) => {
      if (!Array.isArray(db.assistant_logs)) db.assistant_logs = [];
      for (const entry of entries) {
        if (!db.assistant_logs.some((saved) => saved.id === entry.id)) db.assistant_logs.push({ ...entry, page: String(body?.page || '').slice(0, 120), saved_at: now() });
      }
      db.assistant_logs = db.assistant_logs.slice(-200);
    });
    return Response.json({ ok: true, saved: entries.length });
  } catch (error) {
    console.error('[assistant-activity] unable to save activity', error);
    return Response.json({ error: 'Could not persist assistant activity to data/crisis-twin.json.' }, { status: 500 });
  }
}

