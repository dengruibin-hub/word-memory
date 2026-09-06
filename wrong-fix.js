(() => {
  const KEY = 'word-memory-v2';
  const BACKUP_KEY = 'word-memory-wrong-study-backup';
  const MODE_KEY = 'word-memory-wrong-study-selected';
  const $ = id => document.getElementById(id);
  const load = () => { try { const x = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(x) ? x : []; } catch { return []; } };
  const save = data => localStorage.setItem(KEY, JSON.stringify(data));
  const esc = v => String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

  function wrongWords() {
    return load().filter(w => w.word && w.meaning && (Number(w.mastery || 0) <= 2 || Number(w.wrongCount || 0) > 0))
      .sort((a,b) => (a.mastery || 0) - (b.mastery || 0) || String(a.word).localeCompare(String(b.word)));
  }

  let selecting = false;
  let selected = new Set();

  function renderWrongChooser() {
    const box = $('wrongList');
    if (!box) return;
    const data = wrongWords();
    if (!data.length) {
      box.innerHTML = '<div class="empty"><p>太棒了！目前没有明显薄弱词。</p></div>';
      return;
    }
    box.innerHTML = `
      ${selecting ? `<div class="wrong-toolbar"><label><input id="wrongSelectAll" type="checkbox"> 全选</label><span>已选 ${selected.size} 个</span><button id="wrongCancelSelect" class="secondary" type="button">取消选择</button></div>` : ''}
      ${data.map(w => `
        <article class="word-item wrong-item">
          ${selecting ? `<label class="wrong-check"><input class="wrong-select" type="checkbox" data-id="${esc(w.id)}" ${selected.has(String(w.id)) ? 'checked' : ''}></label>` : ''}
          <div class="word-main"><strong>${esc(w.word)}</strong><span>${esc(w.meaning)}${w.unit ? ' · ' + esc(w.unit) : ''} · 掌握度 ${Number(w.mastery || 0)}/6</span></div>
          <div class="word-actions"><button class="secondary wrong-delete" data-id="${esc(w.id)}" type="button">删除</button></div>
        </article>`).join('')}`;

    box.querySelectorAll('.wrong-select').forEach(cb => cb.addEventListener('change', () => {
      const id = String(cb.dataset.id);
      if (cb.checked) selected.add(id); else selected.delete(id);
      renderWrongChooser();
    }));
    $('wrongSelectAll')?.addEventListener('change', e => {
      if (e.target.checked) data.forEach(w => selected.add(String(w.id))); else selected.clear();
      renderWrongChooser();
    });
    $('wrongCancelSelect')?.addEventListener('click', () => { selecting = false; selected.clear(); renderWrongChooser(); updateButton(); });
    box.querySelectorAll('.wrong-delete').forEach(btn => btn.addEventListener('click', () => {
      const id = String(btn.dataset.id);
      const dataNow = load();
      const w = dataNow.find(x => String(x.id) === id);
      if (!w) return;
      if (!confirm(`确定删除单词 “${w.word}” 吗？删除后将从词库和错词本中移除。`)) return;
      save(dataNow.filter(x => String(x.id) !== id));
      selected.delete(id);
      renderWrongChooser();
      if (typeof window.updateStats === 'function') window.updateStats();
    }));
  }

  function updateButton() {
    const btn = $('wrongStudyBtn');
    if (!btn) return;
    btn.textContent = selecting ? `开始复习已选（${selected.size}）` : '选择单词开始复习';
  }

  function beginSelection() {
    selecting = true;
    selected.clear();
    renderWrongChooser();
    updateButton();
  }

  function startSelectedStudy() {
    const ids = [...selected];
    if (!ids.length) { alert('请先勾选至少 1 个单词。'); return; }
    const data = load();
    const selectedSet = new Set(ids);
    const target = data.filter(w => selectedSet.has(String(w.id)) && w.word);
    if (!target.length) return;

    // Back up the complete schedule. Only selected words remain in the review queue.
    const backup = data.map(w => ({ id: w.id, nextReview: w.nextReview }));
    localStorage.setItem(BACKUP_KEY, JSON.stringify(backup));
    localStorage.setItem(MODE_KEY + '-ids', JSON.stringify(ids));
    data.forEach(w => { w.nextReview = selectedSet.has(String(w.id)) ? new Date().toISOString().slice(0,10) : '2999-12-31'; });
    save(data);
    localStorage.setItem(MODE_KEY, '1');
    location.reload();
  }

  function finishWrongStudy() {
    let backup = [];
    let selectedIds = [];
    try { backup = JSON.parse(localStorage.getItem(BACKUP_KEY) || '[]'); } catch {}
    try { selectedIds = JSON.parse(localStorage.getItem(MODE_KEY + '-ids') || '[]').map(String); } catch {}
    if (!backup.length) {
      localStorage.removeItem(MODE_KEY);
      localStorage.removeItem(MODE_KEY + '-ids');
      return;
    }
    const selectedSet = new Set(selectedIds);
    const data = load();
    // Restore non-selected words only. Selected words keep their new mastery/review dates.
    backup.forEach(b => {
      if (selectedSet.has(String(b.id))) return;
      const w = data.find(x => String(x.id) === String(b.id));
      if (w) w.nextReview = b.nextReview;
    });
    save(data);
    localStorage.removeItem(BACKUP_KEY);
    localStorage.removeItem(MODE_KEY);
    localStorage.removeItem(MODE_KEY + '-ids');
    location.reload();
  }

  function bind() {
    const btn = $('wrongStudyBtn');
    if (!btn || btn.dataset.wrongFixBound) return;
    btn.dataset.wrongFixBound = '1';
    btn.addEventListener('click', () => { if (!selecting) beginSelection(); else startSelectedStudy(); });

    const wrongTab = document.querySelector('.tab[data-tab="wrong"]');
    wrongTab?.addEventListener('click', () => setTimeout(() => {
      selecting = false;
      selected.clear();
      renderWrongChooser();
      updateButton();
    }, 80));
  }

  function installSessionButton() {
    if (localStorage.getItem(MODE_KEY) !== '1') return;
    const panel = $('study');
    const top = panel?.querySelector('.card-top');
    if (!top || $('wrongStudyExitBtn')) return;
    const btn = document.createElement('button');
    btn.id = 'wrongStudyExitBtn';
    btn.className = 'secondary';
    btn.type = 'button';
    btn.textContent = '结束错词复习';
    btn.onclick = finishWrongStudy;
    top.appendChild(btn);
  }

  bind();
  installSessionButton();
  if ($('wrong')?.classList.contains('active')) renderWrongChooser();
})();
