// Fix textbook Unit/source classification and preserve repeated words by Unit.
(() => {
  const KEY = 'word-memory-v2';
  const META_KEY = 'word-memory-category-meta-v2';
  const input0 = document.getElementById('importInput');
  if (!input0) return;

  const readRaw = () => {
    try { const x = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(x) ? x : []; } catch { return []; }
  };
  const saveMeta = (data) => {
    const meta = {};
    data.forEach(w => {
      if (!w?.id) return;
      if (w.unit || w.source) meta[w.id] = { unit: w.unit || '', source: w.source || '' };
    });
    try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch {}
  };

  // app.js normalizes words and previously discarded unit/source on reload.
  // Rehydrate those fields from the raw localStorage copy before the UI uses them.
  try {
    const raw = readRaw();
    saveMeta(raw);
    if (typeof words !== 'undefined' && Array.isArray(words)) {
      const byId = new Map(raw.map(w => [String(w.id), w]));
      words.forEach(w => {
        const r = byId.get(String(w.id));
        if (r) {
          if (r.unit) w.unit = r.unit;
          if (r.source) w.source = r.source;
          if (r.wrongCount != null) w.wrongCount = r.wrongCount;
        }
      });
    }
  } catch (e) { console.warn('category rehydrate failed', e); }

  // Replace every previous import handler with one authoritative importer.
  const input = input0.cloneNode(true);
  input0.replaceWith(input);

  const waitForMammoth = async () => {
    for (let i = 0; i < 50; i++) {
      if (window.mammoth) return window.mammoth;
      await new Promise(r => setTimeout(r, 100));
    }
    throw new Error('Word 解析组件还没有加载完成，请稍等 1-2 秒再导入。');
  };

  const clean = s => String(s || '').replace(/[\u00a0\u200b]/g, ' ').replace(/\s+/g, ' ').trim();
  const isUnit = s => /^Unit\s+(\d+)\b/i.test(s);
  const unitNumber = s => (s.match(/^Unit\s+(\d+)\b/i) || [,''])[1];
  const isEnglish = s => /^[A-Za-z][A-Za-z0-9' ._\-]{0,79}$/.test(s) && s.split(/\s+/).length <= 8;
  const parseHead = s => {
    const t = clean(s).replace(/^\s*\d+[.)、]\s*/, '');
    if (!t || isUnit(t)) return '';
    const m = t.match(/^(.+?)\s*\/[^/]{1,120}\/\s*$/);
    if (m && isEnglish(m[1].trim())) return m[1].trim();
    return isEnglish(t) ? t : '';
  };
  const parseMeaning = s => {
    const t = clean(s);
    if (!/^释义\s*/.test(t)) return null;
    let body = t.replace(/^释义\s*/, '').trim();
    const m = body.match(/例\s*句\s*/);
    let example = '';
    if (m && m.index != null) {
      example = body.slice(m.index + m[0].length).trim();
      body = body.slice(0, m.index).trim();
    }
    return { meaning: body, example };
  };

  async function parseDocx(file, source) {
    const mammoth = await waitForMammoth();
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    const lines = (result.value || '').split(/\r?\n/).map(clean).filter(Boolean);
    const out = [];
    let unit = '';

    for (let i = 0; i < lines.length - 1; i++) {
      if (isUnit(lines[i])) { unit = `Unit ${unitNumber(lines[i])}`; continue; }
      if (!unit) continue;
      const word = parseHead(lines[i]);
      if (!word) continue;
      const info = parseMeaning(lines[i + 1]);
      if (!info?.meaning) continue;
      let example = info.example;
      if (!example) {
        for (let j = i + 2; j < Math.min(i + 8, lines.length); j++) {
          const t = clean(lines[j]);
          const em = t.match(/^例\s*句\s*(.*)$/);
          if (em) { example = em[1].trim(); break; }
          if (/^译文\s*/.test(t)) break;
          if (isUnit(t)) break;
        }
      }
      out.push({ word, meaning: info.meaning, example, unit, source });
    }

    // Keep repeated words when they occur in different Units, but remove exact duplicates
    // of the same word inside the same Unit/source.
    const seen = new Set();
    return out.filter(x => {
      const k = `${x.source}|${x.unit}|${x.word.toLowerCase()}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  function merge(imported) {
    const data = readRaw();
    let added = 0, updated = 0;
    imported.forEach(item => {
      const key = `${item.source}|${item.unit}|${item.word.toLowerCase()}`;
      // Only match an existing entry when source + Unit + word all match.
      // Do not merge old untagged words into an arbitrary Unit.
      const existing = data.find(w => `${w.source || ''}|${w.unit || ''}|${String(w.word || '').toLowerCase()}` === key);
      if (existing) {
        existing.meaning = item.meaning;
        if (item.example) existing.example = item.example;
        existing.unit = item.unit;
        existing.source = item.source;
        if (!existing.nextReview) existing.nextReview = new Date().toISOString().slice(0,10);
        updated++;
      } else {
        data.push({
          id: (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`),
          word: item.word,
          meaning: item.meaning,
          example: item.example || '',
          mastery: 0,
          nextReview: new Date().toISOString().slice(0,10),
          createdAt: Date.now(),
          reviewHistory: [],
          unit: item.unit,
          source: item.source,
          wrongCount: 0
        });
        added++;
      }
    });
    localStorage.setItem(KEY, JSON.stringify(data));
    saveMeta(data);
    if (typeof words !== 'undefined' && Array.isArray(words)) {
      words.length = 0;
      data.forEach(w => words.push(w));
    }
    if (typeof updateStats === 'function') updateStats();
    if (typeof renderList === 'function') renderList();
    return { added, updated, total: imported.length };
  }

  input.addEventListener('change', async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      if (file.name.toLowerCase().endsWith('.docx')) {
        const source = /听说|听力|listening/i.test(file.name) ? '听说' : '读写';
        const imported = await parseDocx(file, source);
        if (!imported.length) throw new Error('没有识别到教材词条，请确认文件是原始教材 Word。');
        const r = merge(imported);
        alert(`${source}词库导入成功！\n按 Unit 保留 ${r.total} 个词条。\n新增 ${r.added} 个，更新 ${r.updated} 个。`);
      } else {
        const imported = JSON.parse(await file.text());
        if (!Array.isArray(imported)) throw new Error('JSON 格式错误');
        const data = imported.filter(w => w?.word && w?.meaning);
        localStorage.setItem(KEY, JSON.stringify(data));
        saveMeta(data);
        if (typeof words !== 'undefined' && Array.isArray(words)) { words.length = 0; data.forEach(w => words.push(w)); }
        if (typeof updateStats === 'function') updateStats();
        if (typeof renderList === 'function') renderList();
        alert(`已导入 ${data.length} 个单词`);
      }
    } catch (err) {
      console.error(err);
      alert(`导入失败：${err.message || '请检查文件格式。'}`);
    }
    e.target.value = '';
  });

  function startUnitStudy(unit) {
    const data = readRaw();
    const target = data.filter(w => w?.unit === unit && w?.word);
    if (!target.length) {
      alert(`没有找到 ${unit} 的词条，请先重新导入教材词库。`);
      return;
    }
    // Save the current review dates for every word, then push all other Units out of the queue.
    const backup = data.map(w => ({ id: w.id, nextReview: w.nextReview }));
    localStorage.setItem('word-memory-study-backup', JSON.stringify(backup));
    data.forEach(w => {
      if (w.unit !== unit) w.nextReview = '2999-12-31T00:00:00.000Z';
    });
    localStorage.setItem(KEY, JSON.stringify(data));
    localStorage.setItem('word-memory-study-unit', unit);
    if (typeof words !== 'undefined' && Array.isArray(words)) {
      words.length = 0;
      data.forEach(w => words.push(w));
    }
    location.reload();
  }

  function exitUnitStudy() {
    let backup = [];
    try { backup = JSON.parse(localStorage.getItem('word-memory-study-backup') || '[]'); } catch {}
    if (!backup.length) {
      localStorage.removeItem('word-memory-study-unit');
      return;
    }
    const data = readRaw();
    backup.forEach(b => {
      const w = data.find(x => String(x.id) === String(b.id));
      if (w) w.nextReview = b.nextReview;
    });
    localStorage.setItem(KEY, JSON.stringify(data));
    localStorage.removeItem('word-memory-study-backup');
    localStorage.removeItem('word-memory-study-unit');
    location.reload();
  }

  const bindUnitButtons = () => {
    document.querySelectorAll('.unit-study').forEach(b => {
      if (b.dataset.unitBound) return;
      b.dataset.unitBound = '1';
      b.addEventListener('click', () => startUnitStudy(b.dataset.unit));
    });
  };

  // Re-render progress with source breakdown, after the existing enhancement tab renders.
  const renderProgressFixed = () => {
    const box = document.getElementById('unitProgress');
    if (!box) return;
    const data = readRaw().filter(w => w?.unit && w?.word);
    const units = [...new Set(data.map(w => w.unit))].sort((a,b) => (parseInt(a.replace(/\D/g,''))||99) - (parseInt(b.replace(/\D/g,''))||99));
    if (!units.length) return;
    box.innerHTML = units.map(u => {
      const all = data.filter(w => w.unit === u);
      const rw = all.filter(w => w.source === '读写');
      const ls = all.filter(w => w.source === '听说');
      const mastered = all.filter(w => Number(w.mastery || 0) >= 5).length;
      const rate = all.length ? Math.round(mastered / all.length * 100) : 0;
      return `<div class="unit-card"><div class="unit-title"><strong>${u}</strong><span>${rate}%</span></div><div class="progress-bar"><i style="width:${rate}%"></i></div><small>共 ${all.length}：读写 ${rw.length} · 听说 ${ls.length} · 已掌握 ${mastered}</small><button class="secondary unit-study" data-unit="${u}" type="button">只背 ${u}</button></div>`;
    }).join('');
    bindUnitButtons();
  };

  document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.tab === 'progress') setTimeout(renderProgressFixed, 50);
  }));

  // If the progress panel is already visible, bind its buttons immediately.
  bindUnitButtons();
})();
