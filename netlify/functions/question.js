const https = require('https');

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { subject, recentTopics } = JSON.parse(event.body || '{}');

  const systemPrompt = `You are a Year 6 SATs quiz generator for a Minecraft-obsessed child with ADHD.
Generate one multiple choice question based on real Year 6 SATs content (${subject}).
Frame it in a Minecraft scenario to make it engaging and fun.
Avoid recently used topics: ${recentTopics || 'none'}.

Return ONLY valid JSON in this exact format (no markdown, no extra text):
{
  "question": "The question text with Minecraft scenario",
  "options": ["A) option1", "B) option2", "C) option3", "D) option4"],
  "answer": "A",
  "explanation": "Brief fun Minecraft-flavoured explanation of why this is correct",
  "topic": "short topic name",
  "subject": "${subject}"
}

For MATHS topics use: fractions, decimals, percentages, ratio, algebra, area/perimeter, volume, angles, coordinates, long multiplication, long division, BODMAS, prime numbers, factors/multiples, statistics, mean/median/mode, negative numbers, Roman numerals.

For ENGLISH topics use: punctuation (commas, apostrophes, colons, semi-colons), grammar (verb tenses, subject-verb agreement, clauses), vocabulary (word meaning, synonyms, antonyms), spelling patterns, figurative language, text comprehension, sentence types, parts of speech.

Make the Minecraft context fun — use Creepers, Steve, building, mining, redstone, potions, Endermen, villages, the Nether, etc. Keep language age-appropriate for a 10-11 year old.`;

  const body = JSON.stringify({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    system: systemPrompt,
    messages: [{ role: 'user', content: 'Generate a question now.' }]
  });

  return new Promise((resolve) => {
    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const raw = parsed.content.map(c => c.text || '').join('');
          const clean = raw.replace(/```json|```/g, '').trim();
          const question = JSON.parse(clean);
          resolve({
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(question)
          });
        } catch(err) {
          resolve({
            statusCode: 500,
            body: JSON.stringify({ error: 'Parse error', detail: err.message, raw: data })
          });
        }
      });
    });

    req.on('error', (err) => {
      resolve({
        statusCode: 500,
        body: JSON.stringify({ error: 'Request error', detail: err.message })
      });
    });

    req.write(body);
    req.end();
  });
};
