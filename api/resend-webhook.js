const { createClient } = require('@supabase/supabase-js');

const EVENT_MAP = {
  'email.delivered':  'delivered',
  'email.opened':     'opened',
  'email.clicked':    'clicked',
  'email.bounced':    'bounced',
  'email.complained': 'complained',
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

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
