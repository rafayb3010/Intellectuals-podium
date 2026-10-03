// Scores a spoken explanation. The API key stays here on the server.
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  let d;
  try { d = JSON.parse(event.body || '{}'); } catch (e) { return { statusCode: 400, body: 'Bad request' }; }
  const topic = String(d.topic || '').slice(0, 120), blurb = String(d.blurb || '').slice(0, 200);
  const text = String(d.text || '').slice(0, 3000), secs = Math.min(60, Math.max(0, +d.secs || 60));
  if (!topic || text.length < 5) return { statusCode: 400, body: 'Missing topic or text' };

  const prompt = 'You assess a one-minute spoken explanation. Topic: "' + topic + '" (' + blurb + '). The speaker had 10 minutes to research. Raw speech-to-text transcript (about ' + secs + ' seconds; it contains recognition errors, wrong words, missing punctuation and filler): """' + text + '""" Step 1: reconstruct what the speaker most likely meant, fixing mis-heard words, grammar and punctuation, removing fillers. Never add ideas the speaker did not say. Step 2: judge ONLY the reconstructed ideas. Do not penalise transcription errors, accent, fillers, grammar, or the short one-minute length. Calibration for a ONE-MINUTE talk: 4 = vague or partly wrong; 6 = correct core idea; 7-8 = correct core idea with a clear example or key distinction; 9-10 = exceptional insight and precision. Be honest and do not inflate or flatter; name real errors and gaps. Return ONLY JSON: {"clean":"reconstructed text","covered":["key points the speaker made, short"],"missed":["2-4 important points about this topic not mentioned, short"],"score":number with one decimal,"accuracy":0-10,"depth":0-10,"clarity":0-10,"examples":0-10,"feedback":"2-3 sentences","tip":"one concrete improvement"}';

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-5-5', max_tokens: 900, messages: [{ role: 'user', content: prompt }] })
    });
    if (!r.ok) return { statusCode: 502, body: 'Upstream error ' + r.status };
    const j = await r.json();
    const t = (j.content || []).map(c => c.text || '').join('').replace(/```json|```/g, '').trim();
    JSON.parse(t); // make sure it is valid JSON before returning
    return { statusCode: 200, headers: { 'content-type': 'application/json' }, body: t };
  } catch (e) {
    return { statusCode: 500, body: 'Scoring failed' };
  }
};
