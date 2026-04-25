const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

function verifySignature(req, secret) {
  const signature = req.headers['svix-signature'] || '';
  const msgId = req.headers['svix-id'] || '';
  const timestamp = req.headers['svix-timestamp'] || '';
  if (!signature || !msgId || !timestamp) return false;

  const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  const toSign = `${msgId}.${timestamp}.${body}`;
  const expected = crypto.createHmac('sha256', secret.replace(/^whsec_/, ''))
    .update(toSign).digest('base64');

  return signature.split(' ').some(s => s.split(',')[1] === expected);
}

const EVENT_MAP = {
  'email.delivered':  'delivered',
  'email.opened':     'opened',
  'email.clicked':    'clicked',
  'email.bounced':    'bounced',
  'email.complained': 'complained',
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const secret = (process.env.RESEND_WEBHOOK_SECRET || '').trim();
  if (secret && !verifySignature(req, secret)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const { type, data } = req.body || {};

  const eventType = EVENT_MAP[type];
  if (!eventType) return res.status(200).json({ ignored: true, type });

  const messageId = data?.email_id;
  if (!messageId) return res.status(400).json({ error: 'Missing email_id' });

  const supabase = createClient(
    (process.env.SUPABASE_URL || '').trim(),
    (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  );

  // Look up note_id and recipient from the original sent event
  const { data: sent, error } = await supabase
    .from('email_events')
    .select('note_id, recipient')
    .eq('message_id', messageId)
    .eq('event_type', 'sent')
    .maybeSingle();

  if (error || !sent) {
    return res.status(200).json({ warning: 'Sent event not found', messageId });
  }

  await supabase.from('email_events').insert({
    message_id: messageId,
    note_id:    sent.note_id,
    recipient:  sent.recipient,
    event_type: eventType,
  });

  res.status(200).json({ ok: true, event: eventType });
};
