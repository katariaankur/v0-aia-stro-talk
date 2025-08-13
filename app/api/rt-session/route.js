export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const voice = searchParams.get('voice') || 'verse';
  const lang  = searchParams.get('lang')  || 'en';

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'Missing OPENAI_API_KEY' }, { status: 500 });
  }

  const body = {
    model: 'gpt-4o-realtime-preview-2024-12-17',
    voice,
    // Only audio + text are valid here
    modalities: ['audio', 'text'],
    instructions:
      lang === 'hi'
        ? 'Aap AI jyotishi hain. Chhote, dayalu, 3 bullets + 1 guidance me jawab dijiye. Face/palm readings sirf manoranjan ke liye hain.'
        : 'You are a kind, concise AI astrologer. Reply in 3 bullets + 1 guidance. Face/palm readings are for entertainment only.',
    input_audio_transcription: { model: 'whisper-1' },
    turn_detection: { type: 'server_vad', create_response: true },
  };

  const r = await fetch('https://api.openai.com/v1/realtime/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'OpenAI-Beta': 'realtime=v1',
    },
    body: JSON.stringify(body),
  });

  let data;
  try { data = await r.json(); } catch { data = {}; }

  if (!r.ok) {
    console.error('rt-session error:', r.status, data);
    return Response.json({ error: data }, { status: r.status });
  }

  // data.client_secret.value will start with ek_ and expires in ~1 min
  return Response.json(data, { headers: { 'Cache-Control': 'no-store' } });
}
