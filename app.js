const KEY = 'word-memory-v2';
const OLD_KEY = 'word-memory-v1';
const THEME_KEY = 'word-memory-theme';
const GOAL = 10;
const INTERVALS = [1, 2, 4, 7, 14, 30, 60];

let words = loadWords();
let current = null;
let quizCurrent = null;

const $ = (id) => document.getElementById(id);
const today = () => new Date().toISOString().slice(0, 10);

function loadWords() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (Array.isArray(saved)) return saved.map(normalizeWord);
    const old = JSON.parse(localStorage.getItem(OLD_KEY));
    if (Array.isArray(old)) {
      const migrated = old.map(normalizeWord);
      localStorage.setItem(KEY, JSON.stringify(migrated));
      return migrated;
    }
  } catch {}
  return [];
}

function normalizeWord(w) {
  return {
    id: w.id || String(Date.now() + Math.random()),
    word: String(w.word || '').trim(),
    meaning: String(w.meaning || '').trim(),
    example: String(w.example || '').trim(),
    mastery: Math.max(0, Math.min(6, Number(w.mastery || 0))),
    nextReview: w.nextReview || today(),
    createdAt: Number(w.createdAt || Date.now()),
    reviewHistory: Array.isArray(w.reviewHistory) ? w.reviewHistory : []
  };
}

function save() {
  localStorage.setItem(KEY, JSON.stringify(words));
  updateStats();
  renderList();
  chooseCard();
}

function due(w) { return !w.nextReview || w.nextReview <= today(); }
function reviewsToday() { return words.reduce((sum, w) => sum + w.reviewHistory.filter(d => d === today()).length, 0); }
function streak() {
  const dates = new Set(words.flatMap(w => w.reviewHistory));
  let cursor = new Date();
  if (!dates.has(today())) cursor.setDate(cursor.getDate() - 1);
  let count = 0;
  while (dates.has(cursor.toISOString().slice(0, 10))) {
    count++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}

function updateStats() {
  const done = reviewsToday();
  const percent = Math.min(100, Math.round(done / GOAL * 100));
  $('totalCount').textContent = words.length;
  $('reviewCount').textContent = words.filter(due).length;
  $('knownCount').textContent = words.filter(w => w.mastery >= 5).length;
  $('streakCount').textContent = streak();
  $('goalText').textContent = `${Math.min(done, GOAL)} / ${GOAL}`;
  $('goalPercent').textContent = `${percent}%`;
  document.querySelector('.goal-ring')?.style.setProperty('--goal', `${percent * 3.6}deg`);
}

function switchTab(name) {
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === name));
  if (name === 'study') chooseCard();
  if (name === 'words') renderList();
  if (name === 'quiz') newQuiz();
}

document.querySelectorAll('.tab').forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
document.querySelectorAll('[data-go]').forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.go)));

function chooseCard() {
  const dueWords = words.filter(due).sort((a, b) => (a.mastery || 0) - (b.mastery || 0) || a.createdAt - b.createdAt);
  current = dueWords[0] || null;
  $('emptyStudy').classList.toggle('hidden', !!current);
  $('studyCard').classList.toggle('hidden', !current);
  if (!current) return;
  $('studyWord').textContent = current.word;
  $('studyMeaning').textContent = current.meaning;
  $('studyExample').textContent = current.example ? `例句：${current.example}` : '暂无例句，可以在词库中补充。';
  $('answer').classList.add('hidden');
  $('rating').classList.add('hidden');
  $('revealBtn').classList.remove('hidden');
  const dueTotal = words.filter(due).length;
  $('cardProgress').textContent = `待复习 ${dueTotal} 词 · 难度 ${Math.min(6, current.mastery + 1)}/7`;
}

$('revealBtn').addEventListener('click', () => {
  $('answer').classList.remove('hidden');
  $('rating').classList.remove('hidden');
  $('revealBtn').classList.add('hidden');
});
$('speakBtn').addEventListener('click', () => speak(current?.word));

function speak(word) {
  if (!word || !('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = 'en-US';
  utterance.rate = .82;
  speechSynthesis.speak(utterance);
}

function review(kind) {
  if (!current) return;
  const oldMastery = current.mastery || 0;
  const changes = {
    again: { mastery: Math.max(0, oldMastery - 1), days: 0 },
    hard: { mastery: Math.max(1, oldMastery), days: 2 },
    known: { mastery: Math.min(6, oldMastery + 1), days: INTERVALS[Math.min(6, oldMastery + 1)] },
    easy: { mastery: Math.min(6, oldMastery + 2), days: [2, 4, 7, 14, 30, 60, 90][Math.min(6, oldMastery + 2)] }
  };
  const change = changes[kind];
  current.mastery = change.mastery;
  current.reviewHistory.push(today());
  const next = new Date();
  next.setDate(next.getDate() + change.days);
  current.nextReview = next.toISOString().slice(0, 10);
  save();
}

$('againBtn').addEventListener('click', () => review('again'));
$('hardBtn').addEventListener('click', () => review('hard'));
$('knownBtn').addEventListener('click', () => review('known'));
$('easyBtn').addEventListener('click', () => review('easy'));

$('wordForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const word = $('wordInput').value.trim();
  const meaning = $('meaningInput').value.trim();
  const example = $('exampleInput').value.trim();
  if (!word || !meaning) return;
  const duplicate = words.find(w => w.word.toLowerCase() === word.toLowerCase());
  if (duplicate) {
    duplicate.meaning = meaning;
    duplicate.example = example;
    duplicate.nextReview = today();
  } else {
    words.push({ id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), word, meaning, example, mastery: 0, nextReview: today(), createdAt: Date.now(), reviewHistory: [] });
  }
  save();
  e.target.reset();
  switchTab('study');
});

function renderList() {
  const q = ($('searchInput').value || '').trim().toLowerCase();
  const filter = $('filterSelect').value;
  let list = words.filter(w => `${w.word} ${w.meaning}`.toLowerCase().includes(q));
  if (filter === 'due') list = list.filter(due);
  if (filter === 'mastered') list = list.filter(w => w.mastery >= 5);
  list.sort((a, b) => (a.mastery || 0) - (b.mastery || 0) || a.word.localeCompare(b.word));
  $('wordList').innerHTML = list.length ? list.map(w => `
    <article class="word-item">
      <div class="word-main"><strong>${escapeHtml(w.word)}</strong><span>${escapeHtml(w.meaning)} · ${w.mastery >= 5 ? '⭐ 已掌握' : due(w) ? '🔔 待复习' : `下次复习：${w.nextReview}`}</span></div>
      <div class="word-actions"><button class="small-btn speak-word" data-word="${escapeAttr(w.word)}" type="button">🔊</button><button class="small-btn delete-word" data-id="${escapeAttr(w.id)}" type="button">删除</button></div>
    </article>`).join('') : '<div class="empty"><div class="empty-icon">🔎</div><p>没有找到相关单词。</p></div>';
  document.querySelectorAll('.delete-word').forEach(b => b.addEventListener('click', () => { words = words.filter(w => w.id !== b.dataset.id); save(); }));
  document.querySelectorAll('.speak-word').forEach(b => b.addEventListener('click', () => speak(b.dataset.word)));
}

$('searchInput').addEventListener('input', renderList);
$('filterSelect').addEventListener('change', renderList);

function newQuiz() {
  const pool = words.filter(w => w.meaning);
  if (pool.length < 2) {
    $('quizWord').textContent = '先添加至少 2 个单词';
    $('quizOptions').innerHTML = '<button class="quiz-option" type="button" data-go="add">去添加单词 →</button>';
    $('quizResult').classList.add('hidden');
    return;
  }
  quizCurrent = pool[Math.floor(Math.random() * pool.length)];
  const others = pool.filter(w => w.id !== quizCurrent.id).sort(() => Math.random() - .5).slice(0, 3);
  const options = [quizCurrent, ...others].sort(() => Math.random() - .5);
  $('quizWord').textContent = quizCurrent.word;
  $('quizOptions').innerHTML = options.map(w => `<button class="quiz-option" type="button" data-id="${escapeAttr(w.id)}">${escapeHtml(w.meaning)}</button>`).join('');
  $('quizResult').classList.add('hidden');
  document.querySelectorAll('.quiz-option').forEach(btn => btn.addEventListener('click', () => answerQuiz(btn.dataset.id)));
}

function answerQuiz(id) {
  if (!quizCurrent) return;
  const correct = id === quizCurrent.id;
  document.querySelectorAll('.quiz-option').forEach(btn => {
    btn.disabled = true;
    if (btn.dataset.id === quizCurrent.id) btn.classList.add('correct');
    else if (btn.dataset.id === id) btn.classList.add('wrong');
  });
  $('quizResult').classList.remove('hidden');
  $('quizResult').textContent = correct ? '✓ 答对了！记忆很稳，继续下一题。' : `✕ 正确答案：${quizCurrent.meaning}`;
  if (correct) quizCurrent.quizCorrect = (quizCurrent.quizCorrect || 0) + 1;
  setTimeout(() => newQuiz(), 850);
}

$('newQuizBtn').addEventListener('click', newQuiz);

$('exportBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(words, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `wordflow-${today()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

async function importDocx(file) {
  if (!window.mammoth) throw new Error('DOCX 解析组件尚未加载，请稍后重试。');
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer });
  const doc = new DOMParser().parseFromString(result.value, 'text/html');
  const imported = [];

  doc.querySelectorAll('table tr').forEach(row => {
    const cells = [...row.querySelectorAll('th,td')].map(c => c.textContent.replace(/\s+/g, ' ').trim());
    if (cells.length >= 2 && cells[0] && cells[1] && !isHeaderRow(cells)) {
      imported.push({ word: cells[0], meaning: cells[1], example: cells[2] || '' });
    }
  });

  if (!imported.length) {
    const paragraphs = [...doc.querySelectorAll('p')]
      .map(p => p.textContent.replace(/\s+/g, ' ').trim())
      .filter(Boolean);

    for (let i = 0; i < paragraphs.length; i++) {
      const word = parseVocabularyHead(paragraphs[i]);
      if (!word || i + 1 >= paragraphs.length) continue;

      const meaningInfo = parseMeaningLine(paragraphs[i + 1]);
      if (!meaningInfo || !meaningInfo.meaning) continue;

      let example = meaningInfo.example || '';
      for (let j = i + 2; j < Math.min(i + 7, paragraphs.length); j++) {
        const exampleText = parseExampleLine(paragraphs[j]);
        if (exampleText !== null) {
          example = exampleText;
          break;
        }
        if (parseVocabularyHead(paragraphs[j]) && parseMeaningLine(paragraphs[j + 1])) break;
        if (/^译文\s*/.test(paragraphs[j])) break;
      }

      imported.push({ word, meaning: meaningInfo.meaning, example });
    }
  }

  return dedupeImported(imported);
}

function isHeaderRow(cells) {
  const text = cells.slice(0, 3).join(' ').toLowerCase();
  return /^(word|单词|英文|english)\b/.test(text) || /释义|中文|meaning/.test(text);
}

function parseVocabularyHead(line) {
  const cleaned = line
    .replace(/^\s*\d+[.)、]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned || /^(unit\s+\d+|video scripts?|reading\s*\d*|vocabulary preview|vocabulary development|academic words|glossary|discussion point|audio scripts?|speaking model|speaking skill|critical thinking)$/i.test(cleaned)) {
    return null;
  }

  const ipa = cleaned.match(/^(.+?)\s*\/[^/]{1,100}\/\s*$/);
  if (ipa && isLikelyWord(ipa[1])) return ipa[1].trim();

  if (isLikelyWord(cleaned) && cleaned.split(/\s+/).length <= 8) return cleaned;
  return null;
}

function parseMeaningLine(line) {
  const cleaned = line.replace(/\s+/g, ' ').trim();
  if (!/^释义\s*/.test(cleaned)) return null;

  let body = cleaned.replace(/^释义\s*/, '').trim();
  let example = '';
  const exampleIndex = body.search(/例\s*句\s*/);
  if (exampleIndex >= 0) {
    const marker = body.match(/例\s*句\s*/);
    example = body.slice(exampleIndex + marker[0].length).trim();
    body = body.slice(0, exampleIndex).trim();
  }
  return { meaning: body, example };
}

function parseExampleLine(line) {
  const cleaned = line.replace(/\s+/g, ' ').trim();
  const match = cleaned.match(/^例\s*句\s*(.*)$/);
  return match ? match[1].trim() : null;
}

function isLikelyWord(text) {
  return /^[A-Za-z][A-Za-z0-9' ._-]{0,79}$/.test(text.trim());
}

function dedupeImported(list) {
  const seen = new Set();
  return list.filter(item => {
    const key = item.word.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mergeImported(imported) {
  let added = 0;
  let updated = 0;
  imported.forEach(item => {
    const existing = words.find(w => w.word.toLowerCase() === item.word.toLowerCase());
    if (existing) {
      existing.meaning = item.meaning;
      if (item.example) existing.example = item.example;
      existing.nextReview = today();
      updated++;
    } else {
      words.push(normalizeWord({
        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
        word: item.word,
        meaning: item.meaning,
        example: item.example,
        mastery: 0,
        nextReview: today(),
        createdAt: Date.now(),
        reviewHistory: []
      }));
      added++;
    }
  });
  return { added, updated };
}

$('importInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const isDocx = file.name.toLowerCase().endsWith('.docx');
    if (isDocx) {
      const imported = await importDocx(file);
      if (!imported.length) throw new Error('没有识别到符合教材格式的词条');
      const result = mergeImported(imported);
      save();
      alert(`Word 导入成功！\n识别 ${imported.length} 个词条\n新增 ${result.added} 个，更新 ${result.updated} 个。`);
    } else {
      const imported = JSON.parse(await file.text());
      if (!Array.isArray(imported)) throw new Error('格式错误');
      words = imported.filter(w => w && w.word && w.meaning).map(normalizeWord);
      save();
      alert(`已导入 ${words.length} 个单词`);
    }
  } catch (error) {
    console.error(error);
    alert(`导入失败：${error.message || '请检查文件格式。'}\n\n现在支持直接识别教材原始格式：\n单词 /音标/ → 释义 → 例句 → 译文\n以及没有音标的固定短语格式。`);
  }
  e.target.value = '';
});

$('themeBtn').addEventListener('click', () => {
  document.body.classList.toggle('dark');
  localStorage.setItem(THEME_KEY, document.body.classList.contains('dark') ? 'dark' : 'light');
});

window.addEventListener('keydown', (e) => {
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
  if (document.getElementById('study')?.classList.contains('active')) {
    if (e.code === 'Space') { e.preventDefault(); if (!$('revealBtn').classList.contains('hidden')) $('revealBtn').click(); }
    if (e.key === '1' && !$('rating').classList.contains('hidden')) review('again');
    if (e.key === '2' && !$('rating').classList.contains('hidden')) review('hard');
    if (e.key === '3' && !$('rating').classList.contains('hidden')) review('known');
    if (e.key === '4' && !$('rating').classList.contains('hidden')) review('easy');
  }
});

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[c]);
}

function escapeAttr(value) {
  return escapeHtml(value);
}

if (localStorage.getItem(THEME_KEY) === 'dark') document.body.classList.add('dark');
updateStats();
renderList();
chooseCard();
