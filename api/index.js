const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

// Admin configuration
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = '123jesus';
const AUTH_TOKEN = 'admin-session-token-jesus-2026';

// History stored in /tmp on Vercel (ephemeral but works per instance)
const dbPath = '/tmp/history.json';

function loadHistory() {
  try {
    if (!fs.existsSync(dbPath)) {
      fs.writeFileSync(dbPath, '[]');
    }
    return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  } catch {
    return [];
  }
}

function saveHistory(history) {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(history, null, 2));
  } catch (err) {
    console.error('Save history error:', err);
  }
}

function sendError(res, status, message) {
  res.status(status).json({ error: message });
}

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Gemini-API-Key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const url = req.url || '';
  const method = req.method;

  // ── POST /api/login ──────────────────────────────────────────────────────────
  if (url === '/api/login' && method === 'POST') {
    const { username, password } = req.body || {};
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      return res.json({ success: true, token: AUTH_TOKEN, message: 'Login successful' });
    }
    return sendError(res, 401, '아이디 또는 비밀번호가 올바르지 않습니다.');
  }

  // ── Auth check for protected routes ─────────────────────────────────────────
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.split(' ')[1];
  if (!token || token !== AUTH_TOKEN) {
    // Only protect non-login routes
    if (url !== '/api/login') {
      return sendError(res, 401, '인증이 필요합니다.');
    }
  }

  // ── GET /api/history ─────────────────────────────────────────────────────────
  if (url === '/api/history' && method === 'GET') {
    return res.json(loadHistory());
  }

  // ── DELETE /api/history/:id ──────────────────────────────────────────────────
  if (url.startsWith('/api/history/') && method === 'DELETE') {
    const id = url.replace('/api/history/', '');
    let history = loadHistory();
    const idx = history.findIndex(i => i.id === id);
    if (idx === -1) return sendError(res, 404, '기록을 찾을 수 없습니다.');
    history.splice(idx, 1);
    saveHistory(history);
    return res.json({ success: true });
  }

  // ── POST /api/analyze ────────────────────────────────────────────────────────
  if (url === '/api/analyze' && method === 'POST') {
    const { language, book, chapter, verse } = req.body || {};

    if (!language || !book || !chapter || !verse) {
      return sendError(res, 400, '언어, 책, 장, 절을 모두 입력해주세요.');
    }

    const apiKey = req.headers['x-gemini-api-key'] || process.env.GEMINI_API_KEY || '';
    if (!apiKey.trim()) {
      return sendError(res, 400, 'Gemini API Key가 필요합니다. 로그인 화면에서 입력해주세요.');
    }

    // Check cache
    const history = loadHistory();
    const cached = history.find(i =>
      i.language === language &&
      i.book === book &&
      Number(i.chapter) === Number(chapter) &&
      Number(i.verse) === Number(verse)
    );
    if (cached) return res.json({ ...cached.result, cached: true });

    // Build prompt
    const isJapanese = language === 'japanese';
    const prompt = isJapanese
      ? `Please analyze ${book} ${chapter}장 ${verse}절 in Japanese.
Generate the analysis as a JSON object matching this schema exactly:
{
  "book": "${book}",
  "chapter": ${Number(chapter)},
  "verse": ${Number(verse)},
  "korean_text": "Standard Korean Bible verse (개역개정)",
  "foreign_text": "Japanese translation (口語訳 or similar)",
  "translation_or_meaning": "직역: [Literal Korean translation]",
  "pronunciation_or_pinyin": "한글 발음: [Korean pronunciation of the whole sentence]",
  "key_words": [
    { "word": "Japanese word", "reading": "Hiragana furigana", "pronunciation": "Korean pronunciation", "meaning": "Korean meaning" }
  ],
  "grammar_analysis": [
    { "expression": "Japanese phrase", "structure": "구조: [breakdown]", "explanation": "Korean grammar explanation" }
  ]
}
Output only valid JSON. No markdown fences.`
      : `Please analyze ${book} ${chapter}장 ${verse}절 in Chinese.
Generate the analysis as a JSON object matching this schema exactly:
{
  "book": "${book}",
  "chapter": ${Number(chapter)},
  "verse": ${Number(verse)},
  "korean_text": "Standard Korean Bible verse (개역개정)",
  "foreign_text": "Chinese translation (和合本 simplified)",
  "translation_or_meaning": "의미: [Korean translation of the Chinese verse]",
  "pronunciation_or_pinyin": "한어병음: [Full Hanyu Pinyin with tones]",
  "key_words": [
    { "word": "Chinese word", "reading": "Pinyin with tones", "pronunciation": "Korean pronunciation", "meaning": "Korean meaning" }
  ],
  "grammar_analysis": [
    { "expression": "Chinese phrase", "structure": "역할: [grammatical role]", "explanation": "Korean grammar explanation" }
  ]
}
Output only valid JSON. No markdown fences.`;

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' }
      });

      const parsed = JSON.parse(result.response.text());

      const newItem = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        language,
        book,
        chapter: Number(chapter),
        verse: Number(verse),
        timestamp: new Date().toISOString(),
        result: parsed
      };

      history.unshift(newItem);
      saveHistory(history);

      return res.json({ ...parsed, cached: false });
    } catch (err) {
      console.error('Gemini error:', err);
      return sendError(res, 500, `Gemini API 오류: ${err.message}`);
    }
  }

  return sendError(res, 404, '요청한 경로를 찾을 수 없습니다.');
};
