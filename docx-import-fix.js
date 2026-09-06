// More reliable DOCX importer for the original textbook layout.
// This script replaces the first import input handler from app.js.
(function () {
  const oldInput = document.getElementById('importInput');
  if (!oldInput) return;

  const input = oldInput.cloneNode(true);
  oldInput.replaceWith(input);

  input.addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    try {
      if (file.name.toLowerCase().endsWith('.docx')) {
        if (!window.mammoth) throw new Error('DOCX 解析组件尚未加载，请刷新页面后再试。');
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        const imported = parseTextbookText(result.value || '');

        if (!imported.length) {
          throw new Error('没有识别到教材词条。这个版本会按“单词/音标 → 释义 → 例句 → 译文”自动识别，请确认上传的是原始教材 Word 文件。');
        }

        const resultInfo = mergeImported(imported);
        save();
        alert(`Word 导入成功！\n识别 ${imported.length} 个词条\n新增 ${resultInfo.added} 个，更新 ${resultInfo.updated} 个。`);
      } else {
        const imported = JSON.parse(await file.text());
        if (!Array.isArray(imported)) throw new Error('格式错误');
        words = imported.filter(w => w && w.word && w.meaning).map(normalizeWord);
        save();
        alert(`已导入 ${words.length} 个单词`);
      }
    } catch (error) {
      console.error(error);
      alert(`导入失败：${error.message || '请检查文件格式。'}`);
    }

    e.target.value = '';
  });

  function parseTextbookText(text) {
    const lines = text
      .split(/\r?\n/)
      .map(cleanLine)
      .filter(Boolean);
    const imported = [];

    for (let i = 0; i < lines.length - 1; i++) {
      const word = parseHead(lines[i]);
      if (!word) continue;

      const meaningInfo = parseMeaning(lines[i + 1]);
      if (!meaningInfo || !meaningInfo.meaning) continue;

      let example = meaningInfo.example || '';
      if (!example) {
        for (let j = i + 2; j < Math.min(i + 8, lines.length); j++) {
          const exampleText = parseExample(lines[j]);
          if (exampleText !== null) {
            example = exampleText;
            break;
          }
          if (/^译文\s*/.test(lines[j])) break;
          if (parseHead(lines[j]) && j + 1 < lines.length && parseMeaning(lines[j + 1])) break;
        }
      }

      imported.push({ word, meaning: meaningInfo.meaning, example });
    }

    const seen = new Set();
    return imported.filter(item => {
      const key = item.word.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function cleanLine(line) {
    return String(line || '')
      .replace(/[\u00a0\u200b]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function parseHead(line) {
    const cleaned = cleanLine(line).replace(/^\s*\d+[.)、]\s*/, '').trim();
    if (!cleaned || isSectionHeading(cleaned)) return null;

    const ipa = cleaned.match(/^(.+?)\s*\/[^/]{1,120}\/\s*$/);
    if (ipa && isEnglishText(ipa[1])) return ipa[1].trim();

    // Fixed phrases in the listening textbook often have no IPA.
    if (isEnglishText(cleaned) && cleaned.split(/\s+/).length <= 8) return cleaned;
    return null;
  }

  function parseMeaning(line) {
    const cleaned = cleanLine(line);
    if (!/^释义\s*/.test(cleaned)) return null;

    let body = cleaned.replace(/^释义\s*/, '').trim();
    const marker = body.match(/例\s*句\s*/);
    if (marker) {
      const index = marker.index;
      return {
        meaning: body.slice(0, index).trim(),
        example: body.slice(index + marker[0].length).trim()
      };
    }
    return { meaning: body, example: '' };
  }

  function parseExample(line) {
    const cleaned = cleanLine(line);
    const match = cleaned.match(/^例\s*句\s*(.*)$/);
    return match ? match[1].trim() : null;
  }

  function isEnglishText(text) {
    return /^[A-Za-z][A-Za-z0-9' ._\-]{0,79}$/.test(String(text).trim());
  }

  function isSectionHeading(text) {
    return /^(unit\s+\d+.*|video scripts?|reading\s*\d*|vocabulary preview|vocabulary development|academic words|glossary|discussion point|audio scripts?|speaking model|speaking skill|critical thinking|writing\s*\d*)$/i.test(text);
  }
})();
