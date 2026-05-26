const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Serve static files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Admin configuration
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = '123jesus';
const AUTH_TOKEN = 'admin-session-token-jesus-2026';

// Database setup (handles Vercel read-only filesystem)
const dbPath = process.env.VERCEL ? '/tmp/history.json' : path.join(__dirname, 'history.json');

function loadHistory() {
  try {
    if (!fs.existsSync(dbPath)) {
      const defaultPath = path.join(__dirname, 'history.json');
      if (fs.existsSync(defaultPath)) {
        fs.copyFileSync(defaultPath, dbPath);
      } else {
        fs.writeFileSync(dbPath, '[]');
      }
    }
    const data = fs.readFileSync(dbPath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error loading history:', err);
    return [];
  }
}

function saveHistory(history) {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(history, null, 2));
    return true;
  } catch (err) {
    console.error('Error saving history:', err);
    return false;
  }
}

// Authentication Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied. Token missing.' });
  }

  if (token !== AUTH_TOKEN) {
    return res.status(403).json({ error: 'Invalid or expired token.' });
  }

  next();
}

// Routes

// 1. Admin Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    return res.json({
      success: true,
      token: AUTH_TOKEN,
      message: 'Login successful'
    });
  } else {
    return res.status(401).json({
      success: false,
      error: '이름 또는 비밀번호가 올바르지 않습니다.'
    });
  }
});

// 2. Fetch History
app.get('/api/history', authenticateToken, (req, res) => {
  const history = loadHistory();
  res.json(history);
});

// 3. Delete History Item
app.delete('/api/history/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  let history = loadHistory();
  const index = history.findIndex(item => item.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'History item not found' });
  }

  history.splice(index, 1);
  saveHistory(history);
  res.json({ success: true, message: 'History item deleted' });
});

// 4. Analyze Bible Verse
app.post('/api/analyze', authenticateToken, async (req, res) => {
  const { language, book, chapter, verse } = req.body;
  
  if (!language || !book || !chapter || !verse) {
    return res.status(400).json({ error: 'Language, Book, Chapter, and Verse are required.' });
  }

  // Get API key: Header takes precedence, then environment variable
  const apiKey = req.headers['x-gemini-api-key'] || process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey.trim() === '') {
    return res.status(400).json({ 
      error: 'Gemini API Key가 필요합니다. 로그인 화면 또는 서버 환경 변수에 API Key를 등록해주세요.' 
    });
  }

  // Check cache (history) to avoid redundant API charges
  const history = loadHistory();
  const cachedItem = history.find(item => 
    item.language.toLowerCase() === language.toLowerCase() &&
    item.book === book &&
    Number(item.chapter) === Number(chapter) &&
    Number(item.verse) === Number(verse)
  );

  if (cachedItem) {
    return res.json({ ...cachedItem.result, cached: true });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    // Use gemini-2.5-flash as default, fallback to gemini-1.5-flash if needed
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    let systemInstruction = '';
    let userPrompt = '';

    if (language.toLowerCase() === 'japanese') {
      systemInstruction = `You are a Bible and linguistics expert. Analyze the given Bible verse in Japanese from the perspective of a Korean speaker learning Japanese.
You must return your output strictly in JSON format. Do not include markdown formatting like \`\`\`json or \`\`\` in the final text itself, or if you do, ensure it is a valid JSON structure.`;

      userPrompt = `Please analyze ${book} ${chapter}장 ${verse}절 in Japanese.
Generate the analysis as a JSON object matching this schema:
{
  "book": "${book}",
  "chapter": ${Number(chapter)},
  "verse": ${Number(verse)},
  "korean_text": "Standard Korean Bible verse translation (개역한글 or 개역개정)",
  "foreign_text": "Japanese translation of the verse (standard Kougo-yaku or similar version)",
  "translation_or_meaning": "직역: [Literal translation in Korean]",
  "pronunciation_or_pinyin": "한글 발음: [Write how the Japanese verse SOUNDS in Korean phonetic characters (한글). This is a phonetic transcription of the Japanese pronunciation, NOT a Korean translation. e.g. 神は世を愛された → 카미와 요오 아이사레타]",
  "key_words": [
    {
      "word": "Japanese word (e.g. 初めに)",
      "reading": "Furigana in Hiragana (e.g. はじめに)",
      "pronunciation": "Korean phonetic transcription of Japanese sound (e.g. 하지메니 — NOT a Korean translation)",
      "meaning": "Meaning in Korean (e.g. 태초에, 처음에)"
    }
  ],
  "grammar_analysis": [
    {
      "expression": "Japanese phrase (e.g. 初めに (はじめに))",
      "structure": "구조: [Breakdown, e.g. 初め(명사) + に(조사)]",
      "explanation": "Korean explanation of the grammatical point"
    }
  ]
}

Provide accurate Bible verse contents. Ensure all Furigana readings, pronunciations, and grammatical analyses are linguistically accurate for Korean learners.
Output only the JSON.`;
    } else if (language.toLowerCase() === 'chinese') {
      systemInstruction = `You are a Bible and linguistics expert. Analyze the given Bible verse in Chinese from the perspective of a Korean speaker learning Chinese.
You must return your output strictly in JSON format. Do not include markdown formatting in the final text.`;

      userPrompt = `Please analyze ${book} ${chapter}장 ${verse}절 in Chinese.
Generate the analysis as a JSON object matching this schema:
{
  "book": "${book}",
  "chapter": ${Number(chapter)},
  "verse": ${Number(verse)},
  "korean_text": "Standard Korean Bible verse translation (개역한글 or 개역개정)",
  "foreign_text": "Chinese translation of the verse (standard Chinese Union Version CUV simplified)",
  "translation_or_meaning": "의미: [Korean translation of the Chinese verse]",
  "pronunciation_or_pinyin": "한어병음: [Hanyu Pinyin with tones of the whole Chinese verse]",
  "key_words": [
    {
      "word": "Chinese word (e.g. 起初)",
      "reading": "Hanyu Pinyin with tones (e.g. qǐchū)",
      "pronunciation": "Korean pronunciation of the pinyin (e.g. 치추)",
      "meaning": "Meaning in Korean (e.g. 태초에, 처음에)"
    }
  ],
  "grammar_analysis": [
    {
      "expression": "Chinese phrase (e.g. 起初 (qǐchū))",
      "structure": "역할: [Grammatical role, e.g. 시간사 (시간을 나타내는 말)]",
      "explanation": "Korean explanation of the grammatical role and usage"
    }
  ]
}

Provide accurate Bible verse contents. Ensure all Pinyin, pronunciations, and grammatical analyses are linguistically accurate for Korean learners.
Output only the JSON.`;
    } else {
      return res.status(400).json({ error: 'Unsupported language. Select "japanese" or "chinese".' });
    }

    const result = await model.generateContent({
      contents: [
        { role: 'user', parts: [{ text: userPrompt }] }
      ],
      generationConfig: {
        responseMimeType: 'application/json',
      }
    });

    const responseText = result.response.text();
    const parsedData = JSON.parse(responseText);

    // Save to history
    const newHistoryItem = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      language,
      book,
      chapter: Number(chapter),
      verse: Number(verse),
      timestamp: new Date().toISOString(),
      result: parsedData
    };

    history.unshift(newHistoryItem);
    saveHistory(history);

    res.json({ ...parsedData, cached: false });
  } catch (error) {
    console.error('Gemini API Error:', error);
    res.status(500).json({ 
      error: 'Gemini API 호출 중 오류가 발생했습니다.', 
      details: error.message 
    });
  }
});

// For local testing
if (process.env.NODE_ENV !== 'production' && require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server is running locally at http://localhost:${PORT}`);
  });
}

// Export the app for Vercel Serverless Function
module.exports = app;
