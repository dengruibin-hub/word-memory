const KEY = 'word-memory-v1';
const THEME_KEY = 'word-memory-theme';

let words = loadWords();
let current = null;

const $ = (id) => document.getElementById(id);
const today = () => new Date().toISOString().slice(0, 10);

function loadWords() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
}
function save() { localStorage.setItem(KEY, JSON.stringify(words)); updateStats(); renderList(); chooseCard(); }
function due(w) { return !w.nextReview || w.nextReview <= today(); }
function updateStats() {
  $('totalCount').textContent = words.length;
  $('reviewCount').textContent = words.filter(due).length;
  $('knownCount').textContent = words.filter(w => w.mastery >= 4).length;
}
function switchTab(name) {
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === name));
  if (name === 'study') chooseCard();
  if (name === 'words') renderList();
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
  $('studyExample').textContent = current.example ? `例句：${current.example}` : '';
  $('answer').classList.add('hidden');
  $('rating').classList.add('hidden');
  $('revealBtn').classList.remove('hidden');
}

$('revealBtn').addEventListener('click', () => {
  $('answer').classList.remove('hidden');
  $('rating').classList.remove('hidden');
  $('revealBtn').classList.add('hidden');
});
$('speakBtn').addEventListener('click', () => {
  if (!current || !('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(current.word);
  utterance.lang = 'en-US';
  utterance.rate = .85;
  speechSynthesis.speak(utterance);
});

function review(known) {
  if (!current) return;
  const levels = [1, 3, 7, 14, 30];
  current.mastery = known ? Math.min(4, (current.mastery || 0) + 1) : Math.max(0, (current.mastery || 0) - 1);
  const days = known ? levels[current.mastery] || 30 : 1;
  const next = new Date();
  next.setDate(next.getDate() + days);
  current.nextReview = next.toISOString().slice(0, 10);
  save();
}
$('againBtn').addEventListener('click', () => review(false));
$('knownBtn').addEventListener('click', () => review(true));

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
    words.push({ id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), word, meaning, example, mastery: 0, nextReview: today(), createdAt: Date.now() });
  }
  save();
  e.target.reset();
  switchTab('study');
});

function renderList() {
  const q = ($('searchInput').value || '').trim().toLowerCase();
  const list = words.filter(w => `${w.word} ${w.meaning}`.toLowerCase().includes(q));
  $('wordList').innerHTML = list.length ? list.map(w => `
    <article class="word-item">
      <div class="word-main"><strong>${escapeHtml(w.word)}</strong><span>${escapeHtml(w.meaning)} · ${w.mastery >= 4 ? '已掌握' : due(w) ? '待复习' : `下次：${w.nextReview}`}</span></div>
      <div class="word-actions"><button class="small-btn speak-word" data-word="${escapeAttr(w.word)}">🔊</button><button class="small-btn delete-word" data-id="${escapeAttr(w.id)}">删除</button></div>
    </article>`).join('') : '<div class="empty"><div class="empty-icon">🔎</div><p>没有找到相关单词。</p></div>';
  document.querySelectorAll('.delete-word').forEach(b => b.addEventListener('click', () => { words = words.filter(w => w.id !== b.dataset.id); save(); }));
  document.querySelectorAll('.speak-word').forEach(b => b.addEventListener('click', () => speak(b.dataset.word)));
}
function speak(word) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(word); u.lang = 'en-US'; u.rate = .85; speechSynthesis.speak(u);
}
function escapeHtml(s) { return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function escapeAttr(s) { return escapeHtml(String(s)); }
$('searchInput').addEventListener('input', renderList);

$('exportBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(words, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `word-memory-${today()}.json`; a.click(); URL.revokeObjectURL(a.href);
});
$('importInput').addEventListener('change', async (e) => {
  const file = e.target.files[0]; if (!file) return;
  try {
    const imported = JSON.parse(await file.text());
    if (!Array.isArray(imported)) throw new Error('格式错误');
    words = imported.filter(w => w && w.word && w.meaning).map(w => ({ id: w.id || String(Date.now() + Math.random()), word: String(w.word), meaning: String(w.meaning), example: String(w.example || ''), mastery: Number(w.mastery || 0), nextReview: w.nextReview || today(), createdAt: w.createdAt || Date.now() }));
    save(); alert(`已导入 ${words.length} 个单词`);
  } catch { alert('导入失败：请选择本软件导出的 JSON 词库文件。'); }
  e.target.value = '';
});

$('themeBtn').addEventListener('click', () => {
  document.body.classList.toggle('dark');
  localStorage.setItem(THEME_KEY, document.body.classList.contains('dark') ? 'dark' : 'light');
});
if (localStorage.getItem(THEME_KEY) === 'dark') document.body.classList.add('dark');
updateStats(); renderList(); chooseCard();
