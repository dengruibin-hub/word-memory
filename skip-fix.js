(() => {
  const KEY = 'word-memory-v2';
  const wordStage = document.querySelector('.word-stage');
  if (!wordStage || document.getElementById('skipBtn')) return;

  const btn = document.createElement('button');
  btn.id = 'skipBtn';
  btn.className = 'secondary';
  btn.type = 'button';
  btn.textContent = '跳过';
  btn.title = '今天先跳过这个单词，不计入复习记录';
  wordStage.appendChild(btn);

  btn.addEventListener('click', () => {
    const wordEl = document.getElementById('studyWord');
    const word = wordEl?.textContent?.trim();
    if (!word || word === '—') return;

    try {
      const data = JSON.parse(localStorage.getItem(KEY) || '[]');
      const item = data.find(w => String(w.word || '').trim().toLowerCase() === word.toLowerCase());
      if (!item) return;

      const next = new Date();
      next.setDate(next.getDate() + 1);
      item.nextReview = next.toISOString().slice(0, 10);
      localStorage.setItem(KEY, JSON.stringify(data));
      location.reload();
    } catch (e) {
      console.warn('Skip failed', e);
    }
  });
})();
