// List of all 66 Bible books in Korean
const BIBLE_BOOKS = [
  // 구약성경 (Old Testament)
  "창세기", "출애굽기", "레위기", "민수기", "신명기", "여호수아", "사사기", "룻기",
  "사무엘상", "사무엘하", "열왕기상", "열왕기하", "역대상", "역대하", "에스라", "느헤미야",
  "에스더", "욥기", "시편", "잠언", "전도서", "아가", "이사야", "예레미야", "예레미야 애가",
  "에스겔", "다니엘", "호세아", "요엘", "아모스", "오바디야", "요나", "미가", "나훔",
  "하박국", "스바냐", "학개", "스가랴", "말라기",
  // 신약성경 (New Testament)
  "마태복음", "마가복음", "누가복음", "요한복음", "사도행전", "로마서", "고린도전서", "고린도후서",
  "갈라디아서", "에베소서", "빌립보서", "골로새서", "데살로니가전서", "데살로니가후서", "디모데전서",
  "디모데후서", "디도서", "빌레몬서", "히브리서", "야고보서", "베드로전서", "베드로후서",
  "요한일서", "요한이서", "요한삼서", "유다서", "요한계시록"
];

// App State
let token = localStorage.getItem('bible_study_token') || '';
let savedApiKey = localStorage.getItem('bible_study_api_key') || '';
let selectedLanguage = 'japanese';
let activeAnalysisData = null; // Holds the currently displayed analysis result

// DOM Elements
const loginContainer = document.getElementById('login-container');
const dashboardContainer = document.getElementById('dashboard-container');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const apiKeyInput = document.getElementById('api-key');
const toggleApiKeyBtn = document.getElementById('toggle-api-key-visibility');

// Sidebar Tabs
const navItems = document.querySelectorAll('.nav-item');
const tabPanels = document.querySelectorAll('.tab-panel');
const logoutBtn = document.getElementById('logout-btn');

// Study Panel Elements
const langBtns = document.querySelectorAll('.lang-btn');
const bibleBookInput = document.getElementById('bible-book');
const autocompleteList = document.getElementById('autocomplete-list');
const bibleChapterInput = document.getElementById('bible-chapter');
const bibleVerseInput = document.getElementById('bible-verse');
const analyzeBtn = document.getElementById('analyze-btn');

const analysisLoading = document.getElementById('analysis-loading');
const analysisResultView = document.getElementById('analysis-result-view');

// Result View Elements
const resultReference = document.getElementById('result-reference');
const cachedBadge = document.getElementById('cached-badge');
const resultKoreanText = document.getElementById('result-korean-text');
const resultForeignText = document.getElementById('result-foreign-text');
const resultForeignLabel = document.getElementById('result-foreign-label');
const meaningTitleLabel = document.getElementById('meaning-title-label');
const resultMeaning = document.getElementById('result-meaning');
const pronunciationTitleLabel = document.getElementById('pronunciation-title-label');
const resultPronunciation = document.getElementById('result-pronunciation');
const wordsContainer = document.getElementById('words-container');
const grammarContainer = document.getElementById('grammar-container');
const ttsPlayVerseBtn = document.getElementById('tts-play-verse');
const exportTxtBtn = document.getElementById('export-txt-btn');

// History Panel Elements
const historyListBody = document.getElementById('history-list-body');
const historyEmptyMsg = document.getElementById('history-empty-msg');

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  // Restore saved API key if present
  if (savedApiKey) {
    apiKeyInput.value = savedApiKey;
  }

  // Setup API Key Visibility Toggle
  toggleApiKeyBtn.addEventListener('click', () => {
    const type = apiKeyInput.getAttribute('type') === 'password' ? 'text' : 'password';
    apiKeyInput.setAttribute('type', type);
    toggleApiKeyBtn.innerHTML = type === 'password' ? '<i class="fa-solid fa-eye"></i>' : '<i class="fa-solid fa-eye-slash"></i>';
  });

  // Check login state
  if (token) {
    showDashboard();
  } else {
    showLogin();
  }

  // Set up Auto-complete for Bible Book Input
  setupAutocomplete();
});

// Autocomplete logic
function setupAutocomplete() {
  bibleBookInput.addEventListener('input', function() {
    const val = this.value;
    closeAllLists();
    if (!val) return false;

    let itemsCount = 0;
    const listWrapper = document.getElementById('autocomplete-list');
    listWrapper.innerHTML = '';
    listWrapper.classList.remove('hide');

    for (let i = 0; i < BIBLE_BOOKS.length; i++) {
      // Find matches containing input string
      if (BIBLE_BOOKS[i].includes(val)) {
        itemsCount++;
        const item = document.createElement('div');
        // Highlight the matching letters
        const matchIndex = BIBLE_BOOKS[i].indexOf(val);
        const highlightedText = 
          BIBLE_BOOKS[i].substr(0, matchIndex) + 
          "<strong>" + BIBLE_BOOKS[i].substr(matchIndex, val.length) + "</strong>" + 
          BIBLE_BOOKS[i].substr(matchIndex + val.length);
        
        item.innerHTML = highlightedText;
        item.addEventListener('click', function() {
          bibleBookInput.value = BIBLE_BOOKS[i];
          closeAllLists();
        });
        listWrapper.appendChild(item);
      }
    }

    if (itemsCount === 0) {
      listWrapper.classList.add('hide');
    }
  });

  // Close list on clicking outside
  document.addEventListener('click', (e) => {
    if (e.target !== bibleBookInput) {
      closeAllLists();
    }
  });
}

function closeAllLists() {
  const listWrapper = document.getElementById('autocomplete-list');
  listWrapper.innerHTML = '';
  listWrapper.classList.add('hide');
}

// Routing Screens
function showLogin() {
  loginContainer.classList.add('active');
  dashboardContainer.classList.remove('active');
}

function showDashboard() {
  loginContainer.classList.remove('active');
  dashboardContainer.classList.add('active');
  loadTab('study-tab');
}

// Authentication Logic
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.classList.add('hide');

  const username = usernameInput.value;
  const password = passwordInput.value;
  const apiKey = apiKeyInput.value.trim();

  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (response.ok && data.success) {
      token = data.token;
      localStorage.setItem('bible_study_token', token);
      
      // Store API Key client-side
      if (apiKey) {
        savedApiKey = apiKey;
        localStorage.setItem('bible_study_api_key', apiKey);
      } else {
        savedApiKey = '';
        localStorage.removeItem('bible_study_api_key');
      }

      showDashboard();
    } else {
      loginError.textContent = data.error || '로그인 실패. 다시 확인해주세요.';
      loginError.classList.remove('hide');
    }
  } catch (error) {
    console.error('Login error:', error);
    loginError.textContent = '서버 연결에 실패했습니다.';
    loginError.classList.remove('hide');
  }
});

// Logout
logoutBtn.addEventListener('click', () => {
  token = '';
  localStorage.removeItem('bible_study_token');
  showLogin();
});

// Sidebar Navigation Tabs switcher
navItems.forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    const tabId = item.getAttribute('data-tab');
    loadTab(tabId);
  });
});

function loadTab(tabId) {
  // Update sidebar activation
  navItems.forEach(i => i.classList.remove('active'));
  const activeNav = document.querySelector(`.nav-item[data-tab="${tabId}"]`);
  if (activeNav) activeNav.classList.add('active');

  // Update panel views
  tabPanels.forEach(panel => {
    panel.classList.remove('active');
  });
  document.getElementById(tabId).classList.add('active');

  // Load resources if history tab
  if (tabId === 'history-tab') {
    loadHistoryList();
  }
}

// Select Study Language
langBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    langBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedLanguage = btn.getAttribute('data-lang');
  });
});

// Analyze Bible Verse Logic
analyzeBtn.addEventListener('click', async () => {
  const book = bibleBookInput.value.trim();
  const chapter = bibleChapterInput.value.trim();
  const verse = bibleVerseInput.value.trim();

  if (!book) {
    alert('Bible 책 이름을 입력 또는 선택해주세요.');
    bibleBookInput.focus();
    return;
  }
  if (!chapter || chapter < 1) {
    alert('장을 입력해주세요.');
    bibleChapterInput.focus();
    return;
  }
  if (!verse || verse < 1) {
    alert('절을 입력해주세요.');
    bibleVerseInput.focus();
    return;
  }

  // UI loading state
  analysisLoading.classList.remove('hide');
  analysisResultView.classList.add('hide');
  analyzeBtn.disabled = true;
  analyzeBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> 분석 중...';

  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Gemini-API-Key': savedApiKey
      },
      body: JSON.stringify({
        language: selectedLanguage,
        book,
        chapter: Number(chapter),
        verse: Number(verse)
      })
    });

    const data = await response.json();

    if (response.ok) {
      renderAnalysisResult(data);
    } else {
      alert(data.error || '구절 분석 중 오류가 발생했습니다.');
    }
  } catch (error) {
    console.error('Analysis error:', error);
    alert('서버 또는 API 호출에 실패했습니다.');
  } finally {
    analysisLoading.classList.add('hide');
    analyzeBtn.disabled = false;
    analyzeBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> 구절 분석 시작';
  }
});

// Render results
function renderAnalysisResult(data) {
  activeAnalysisData = data;

  // Header / Badge Setup
  resultReference.textContent = `${data.book} ${data.chapter}장 ${data.verse}절`;
  if (data.cached) {
    cachedBadge.classList.remove('hide');
  } else {
    cachedBadge.classList.add('hide');
  }

  // Setup core text
  resultKoreanText.textContent = data.korean_text;
  resultForeignText.textContent = data.foreign_text;

  // Language customization
  const verseCard = document.querySelector('.verse-card');
  const detailsGrid = document.querySelector('.details-grid');
  
  if (selectedLanguage === 'japanese') {
    verseCard.className = 'verse-card glass japanese';
    detailsGrid.className = 'details-grid japanese';
    
    resultForeignLabel.textContent = '일본어 번역 (口語訳)';
    meaningTitleLabel.textContent = '직역 (Literal Translation)';
    pronunciationTitleLabel.textContent = '한글 발음';
  } else {
    verseCard.className = 'verse-card glass chinese';
    detailsGrid.className = 'details-grid chinese';
    
    resultForeignLabel.textContent = '중국어 번역 (和合本)';
    meaningTitleLabel.textContent = '의미 (Meaning)';
    pronunciationTitleLabel.textContent = '한어병음 (Pinyin)';
  }

  resultMeaning.textContent = data.translation_or_meaning;
  resultPronunciation.textContent = data.pronunciation_or_pinyin;

  // Render Key Words
  wordsContainer.innerHTML = '';
  data.key_words.forEach(wordObj => {
    const wordCard = document.createElement('div');
    wordCard.className = 'word-item';
    
    wordCard.innerHTML = `
      <div class="word-details">
        <div class="word-kanji">${wordObj.word}</div>
        <div class="word-reading-block">
          <span class="word-reading">${wordObj.reading}</span>
          <span class="word-pronunciation">(${wordObj.pronunciation})</span>
        </div>
        <div class="word-meaning">${wordObj.meaning}</div>
      </div>
      <button class="btn-tts-word" title="발음 듣기">
        <i class="fa-solid fa-volume-high"></i>
      </button>
    `;

    // TTS for individual word
    const ttsBtn = wordCard.querySelector('.btn-tts-word');
    ttsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      speakText(wordObj.word, selectedLanguage);
    });

    wordsContainer.appendChild(wordCard);
  });

  // Render Grammar Analysis
  grammarContainer.innerHTML = '';
  data.grammar_analysis.forEach(gramObj => {
    const gramItem = document.createElement('div');
    gramItem.className = 'grammar-item';
    
    gramItem.innerHTML = `
      <div class="grammar-item-header">${gramObj.expression}</div>
      <div class="grammar-structure-code">${gramObj.structure}</div>
      <div class="grammar-explanation">${gramObj.explanation}</div>
    `;

    grammarContainer.appendChild(gramItem);
  });

  // Show Result Panel
  analysisResultView.classList.remove('hide');

  // Scroll to results smoothly
  analysisResultView.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// TXT Export Logic
exportTxtBtn.addEventListener('click', () => {
  if (!activeAnalysisData) return;
  exportToTxt(activeAnalysisData);
});

function exportToTxt(data) {
  const lang = selectedLanguage === 'japanese' ? '일본어' : '중국어';
  const lines = [];

  lines.push('═══════════════════════════════════════════════════');
  lines.push(`  Bible 구절 분석 결과 [${lang}]`);
  lines.push('═══════════════════════════════════════════════════');
  lines.push(`  구절: ${data.book} ${data.chapter}장 ${data.verse}절`);
  lines.push('───────────────────────────────────────────────────');
  lines.push('');
  lines.push('【 한글 성경 】');
  lines.push(data.korean_text || '');
  lines.push('');
  lines.push(`【 ${lang} 번역 】`);
  lines.push(data.foreign_text || '');
  lines.push('');
  lines.push('【 직역 / 의미 】');
  lines.push(data.translation_or_meaning || '');
  lines.push('');
  lines.push('【 한글 발음 】');
  lines.push(data.pronunciation_or_pinyin || '');
  lines.push('');
  lines.push('───────────────────────────────────────────────────');
  lines.push('【 주요 단어 분석 】');
  lines.push('───────────────────────────────────────────────────');
  if (data.key_words && data.key_words.length > 0) {
    data.key_words.forEach((w, i) => {
      lines.push(`${i + 1}. ${w.word}`);
      lines.push(`   읽기(후리가나/병음): ${w.reading}`);
      lines.push(`   한글 발음: ${w.pronunciation}`);
      lines.push(`   의미: ${w.meaning}`);
      lines.push('');
    });
  }
  lines.push('───────────────────────────────────────────────────');
  lines.push('【 문법 및 문장 구조 분석 】');
  lines.push('───────────────────────────────────────────────────');
  if (data.grammar_analysis && data.grammar_analysis.length > 0) {
    data.grammar_analysis.forEach((g, i) => {
      lines.push(`${i + 1}. ${g.expression}`);
      lines.push(`   ${g.structure}`);
      lines.push(`   ${g.explanation}`);
      lines.push('');
    });
  }
  lines.push('═══════════════════════════════════════════════════');
  lines.push(`  생성일시: ${new Date().toLocaleString('ko-KR')}`);
  lines.push('═══════════════════════════════════════════════════');

  const content = lines.join('\n');
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Bible_${data.book}_${data.chapter}장${data.verse}절_${lang}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Text to Speech logic
ttsPlayVerseBtn.addEventListener('click', () => {
  if (activeAnalysisData && activeAnalysisData.foreign_text) {
    speakText(activeAnalysisData.foreign_text, selectedLanguage);
  }
});

function speakText(text, lang) {
  if ('speechSynthesis' in window) {
    // Cancel currently speaking voices
    window.speechSynthesis.cancel();

    // Remove punctuation or bracket notes that might affect TTS
    const cleanText = text.replace(/[\[\]\(\)\{\}]/g, '');

    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    if (lang === 'japanese') {
      utterance.lang = 'ja-JP';
    } else if (lang === 'chinese') {
      utterance.lang = 'zh-CN';
    }
    
    // Attempt to locate a high-quality native voice matching the language code
    const voices = window.speechSynthesis.getVoices();
    const matchingVoice = voices.find(v => v.lang.startsWith(utterance.lang));
    
    if (matchingVoice) {
      utterance.voice = matchingVoice;
    }
    
    utterance.rate = 0.85; // Slightly slower for language learners
    window.speechSynthesis.speak(utterance);
  } else {
    alert('이 브라우저는 음성 합성(TTS) 기능을 지원하지 않습니다.');
  }
}

// Make sure voices are loaded in browser
if ('speechSynthesis' in window) {
  window.speechSynthesis.getVoices();
}

// History Handling
async function loadHistoryList() {
  historyListBody.innerHTML = '<tr><td colspan="5" style="text-align: center;"><i class="fa-solid fa-circle-notch fa-spin"></i> 기록 로딩 중...</td></tr>';
  historyEmptyMsg.classList.add('hide');

  try {
    const response = await fetch('/api/history', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (response.ok) {
      renderHistoryTable(data);
    } else {
      historyListBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #f87171;">기록을 가져오는 데 실패했습니다: ${data.error || '인증 오류'}</td></tr>`;
    }
  } catch (error) {
    console.error('History load error:', error);
    historyListBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #f87171;">서버와의 연결이 원활하지 않습니다.</td></tr>';
  }
}

function renderHistoryTable(items) {
  historyListBody.innerHTML = '';
  
  if (items.length === 0) {
    historyEmptyMsg.classList.remove('hide');
    return;
  }

  items.forEach(item => {
    const tr = document.createElement('tr');
    
    // Format timestamp
    const date = new Date(item.timestamp);
    const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    
    // Badge Class
    const langBadgeClass = item.language === 'japanese' ? 'badge-jp' : 'badge-zh';
    const langLabel = item.language === 'japanese' ? '일본어' : '중국어';
    
    tr.innerHTML = `
      <td>${dateString}</td>
      <td><span class="history-lang-badge ${langBadgeClass}">${langLabel}</span></td>
      <td class="history-ref">${item.book} ${item.chapter}:${item.verse}</td>
      <td class="history-summary">${item.result.foreign_text}</td>
      <td>
        <div class="history-actions">
          <button class="btn btn-table btn-table-view" data-id="${item.id}"><i class="fa-solid fa-folder-open"></i> 보기</button>
          <button class="btn btn-table btn-table-delete" data-id="${item.id}"><i class="fa-solid fa-trash-can"></i> 삭제</button>
        </div>
      </td>
    `;

    // View Details handler
    tr.querySelector('.btn-table-view').addEventListener('click', () => {
      selectedLanguage = item.language;
      
      // Update form selections
      langBtns.forEach(b => {
        b.classList.remove('active');
        if (b.getAttribute('data-lang') === selectedLanguage) {
          b.classList.add('active');
        }
      });
      bibleBookInput.value = item.book;
      bibleChapterInput.value = item.chapter;
      bibleVerseInput.value = item.verse;

      // Load Cached Details
      renderAnalysisResult(item.result);
      
      // Navigate to Study panel
      loadTab('study-tab');
    });

    // Delete item handler
    tr.querySelector('.btn-table-delete').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('이 기록을 정말로 삭제하시겠습니까?')) return;
      
      try {
        const response = await fetch(`/api/history/${item.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        const resData = await response.json();
        if (response.ok && resData.success) {
          loadHistoryList();
        } else {
          alert('삭제 실패: ' + (resData.error || '권한 부족'));
        }
      } catch (err) {
        console.error('Delete error:', err);
        alert('삭제 요청에 실패했습니다.');
      }
    });

    historyListBody.appendChild(tr);
  });
}
