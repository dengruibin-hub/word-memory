(() => {
  const KEY='word-memory-v2';
  const $=id=>document.getElementById(id);
  const load=()=>{try{return JSON.parse(localStorage.getItem(KEY))||[]}catch{return[]}};
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const shuffle=a=>a.slice().sort(()=>Math.random()-.5);
  const rand=a=>a[Math.floor(Math.random()*a.length)];
  let game=null,timer=null,timeLeft=60,score=0,combo=0,bestCombo=0,answered=0,correct=0;
  let matchCards=[],matchFirst=null,matchBusy=false,matchMoves=0,matchMatched=0;

  const style=document.createElement('style');
  style.textContent=`
  .challenge-menu{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-top:18px}
  .challenge-card{border:1px solid rgba(148,163,184,.25);border-radius:18px;padding:22px;background:linear-gradient(145deg,rgba(255,255,255,.04),rgba(148,163,184,.04));cursor:pointer;transition:.18s;min-height:170px;text-align:left}
  .challenge-card:hover{transform:translateY(-3px);border-color:rgba(99,102,241,.45);box-shadow:0 10px 30px rgba(15,23,42,.12)}
  .challenge-icon{font-size:34px}.challenge-card h3{margin:10px 0 6px}.challenge-card p{margin:0;opacity:.72;line-height:1.6}.challenge-best{margin-top:12px;font-size:13px;opacity:.65}
  .challenge-settings{display:flex;flex-wrap:wrap;gap:10px;margin:18px 0}.challenge-settings label{display:flex;align-items:center;gap:8px}.challenge-settings select{padding:9px 12px;border-radius:10px;border:1px solid rgba(148,163,184,.35);background:inherit;color:inherit}
  .game-top{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}.game-score{display:flex;gap:14px;font-weight:700}.game-stat{padding:8px 12px;border-radius:10px;background:rgba(148,163,184,.1)}
  .game-question{text-align:center;font-size:32px;font-weight:800;margin:28px 0}.game-question small{display:block;font-size:13px;font-weight:500;opacity:.55;margin-bottom:8px}
  .game-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.game-option{padding:16px;border:1px solid rgba(148,163,184,.3);border-radius:14px;background:transparent;color:inherit;font-size:16px;cursor:pointer}.game-option:hover{background:rgba(99,102,241,.08)}.game-option.correct{border-color:#22c55e;background:rgba(34,197,94,.12)}.game-option.wrong{border-color:#ef4444;background:rgba(239,68,68,.12)}
  .game-result{text-align:center;padding:26px}.game-result .big{font-size:42px;font-weight:900}.combo-pop{text-align:center;min-height:28px;font-weight:800}
  .memory-board{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:22px}.memory-card{aspect-ratio:1.25;perspective:700px;cursor:pointer}.memory-inner{position:relative;width:100%;height:100%;transition:transform .35s;transform-style:preserve-3d}.memory-card.flipped .memory-inner,.memory-card.matched .memory-inner{transform:rotateY(180deg)}.memory-face{position:absolute;inset:0;backface-visibility:hidden;border-radius:14px;display:flex;align-items:center;justify-content:center;padding:10px;text-align:center;border:1px solid rgba(148,163,184,.3);font-weight:700}.memory-front{font-size:28px}.memory-back{transform:rotateY(180deg);background:rgba(99,102,241,.08);font-size:15px}.memory-card.matched{opacity:.55}
  @media(max-width:760px){.challenge-menu{grid-template-columns:1fr}.game-options{grid-template-columns:1fr}.memory-board{grid-template-columns:repeat(3,1fr)}}
  `;
  document.head.appendChild(style);

  const tabs=document.querySelector('.tabs');
  if(!tabs||tabs.querySelector('[data-tab="challenge"]'))return;
  const quizTab=tabs.querySelector('[data-tab="quiz"]');
  if(quizTab)quizTab.insertAdjacentHTML('afterend','<button class="tab" data-tab="challenge">🎮 挑战</button>');
  const footer=document.querySelector('footer');
  if(!footer)return;
  footer.insertAdjacentHTML('beforebegin',`<section id="challenge" class="panel"><div class="quiz-card" id="challengeRoot"><div class="section-head"><div><span class="card-label">GAME ZONE</span><h2>🎮 挑战</h2><p>选择一种方式，看看你能拿多少分。</p></div></div><div id="challengeBody"></div></div></section>`);

  function pool(){return load().filter(w=>w.word&&w.meaning)}
  function options(){return ['全部','读写','听说',...[...new Set(pool().map(w=>w.unit).filter(Boolean))].sort((a,b)=>(parseInt(a.replace(/\D/g,''))||99)-(parseInt(b.replace(/\D/g,''))||99))]}
  function filtered(v){let p=pool();if(v==='读写'||v==='听说')p=p.filter(w=>w.source===v);else if(v.startsWith('Unit '))p=p.filter(w=>w.unit===v);return p}
  function best(key){return Number(localStorage.getItem('word-memory-challenge-best-'+key)||0)}
  function setBest(key,v){if(v>best(key))localStorage.setItem('word-memory-challenge-best-'+key,String(v))}

  function menu(){
    stopTimer();
    const b=(k)=>best(k); 
    $('challengeBody').innerHTML=`<div class="challenge-menu">
      <article class="challenge-card" data-game="speed"><div class="challenge-icon">🏎️</div><h3>60 秒极速挑战</h3><p>一分钟内尽可能答对更多题，挑战你的反应速度。</p><div class="challenge-best">最高分：${b('speed')}</div></article>
      <article class="challenge-card" data-game="spy"><div class="challenge-icon">🕵️</div><h3>找卧底</h3><p>四个中文选项中，找出真正对应英文单词的答案。</p><div class="challenge-best">最高连击：${b('spy')}</div></article>
      <article class="challenge-card" data-game="memory"><div class="challenge-icon">🧠</div><h3>记忆翻牌</h3><p>翻开卡片，找到英文和中文的正确配对，看看你的记忆力。</p><div class="challenge-best">最快用时：${b('memory')?b('memory')+' 秒':'暂无纪录'}</div></article>
    </div>`;
    document.querySelectorAll('.challenge-card').forEach(c=>c.onclick=()=>settings(c.dataset.game));
  }

  function settings(type){
    game=type;
    const opts=options().map(x=>`<option>${esc(x)}</option>`).join('');
    const title=type==='speed'?'🏎️ 60 秒极速挑战':type==='spy'?'🕵️ 找卧底':'🧠 记忆翻牌';
    const desc=type==='speed'?'答得越多，分数越高！':type==='spy'?'找出正确释义，连续答对获得更高连击！':'12 张牌，找到 6 对英文与中文。';
    $('challengeBody').innerHTML=`<div class="quiz-card"><div class="quiz-head"><div><span class="card-label">${type==='memory'?'MEMORY MATCH':'CHALLENGE'}</span><h2>${title}</h2><p>${desc}</p></div><button id="backChallenge" class="secondary" type="button">← 返回</button></div><div class="challenge-settings"><label>📚 词库 <select id="challengePool">${opts}</select></label>${type!=='memory'?'<label>🔢 题量 <select id="challengeCount"><option>10</option><option>20</option><option>30</option></select></label>':''}</div><button id="startChallenge" class="primary" type="button">开始挑战</button></div>`;
    $('backChallenge').onclick=menu;$('startChallenge').onclick=()=>start(type);
  }

  function start(type){
    const p=filtered($('challengePool').value);if(p.length<4){$('challengeBody').insertAdjacentHTML('beforeend','<div class="empty"><p>当前范围至少需要 4 个单词才能开始挑战。</p></div>');return}
    if(type==='speed')startSpeed(p);else if(type==='spy')startSpy(p);else startMemory(p);
  }

  function stopTimer(){if(timer){clearInterval(timer);timer=null}}
  function startSpeed(p){
    timeLeft=60;score=0;combo=0;bestCombo=0;answered=0;correct=0;game='speed';
    $('challengeBody').innerHTML=`<div class="game-top"><div class="game-score"><span class="game-stat">⏱️ <b id="gameTimer">60</b>s</span><span class="game-stat">🏆 <b id="gameScore">0</b></span><span class="game-stat">🔥 <b id="gameCombo">0</b></span></div><button id="quitGame" class="secondary">结束</button></div><div class="game-question" id="gameQuestion"></div><div class="combo-pop" id="comboPop"></div><div class="game-options" id="gameOptions"></div>`;
    $('quitGame').onclick=endSpeed;nextSpeed(p);
    timer=setInterval(()=>{timeLeft--;if($('gameTimer'))$('gameTimer').textContent=timeLeft;if(timeLeft<=0)endSpeed()},1000);
  }
  function nextSpeed(p){const w=rand(p);$('gameQuestion').innerHTML=`<small>选择正确的中文释义</small>${esc(w.word)}`;const opts=shuffle([w,...shuffle(p.filter(x=>x.id!==w.id)).slice(0,3)]);$('gameOptions').innerHTML=opts.map(x=>`<button class="game-option" data-id="${esc(x.id)}">${esc(x.meaning)}</button>`).join('');document.querySelectorAll('#gameOptions .game-option').forEach(b=>b.onclick=()=>answerSpeed(p,w,b))}
  function answerSpeed(p,w,b){document.querySelectorAll('#gameOptions .game-option').forEach(x=>x.disabled=true);answered++;if(String(b.dataset.id)===String(w.id)){correct++;combo++;bestCombo=Math.max(bestCombo,combo);score+=10+Math.max(0,combo-1)*2;b.classList.add('correct');$('comboPop').textContent=combo>=3?`🔥 COMBO ×${combo}`:'✓ 答对了！'}else{combo=0;b.classList.add('wrong');document.querySelectorAll('#gameOptions .game-option').forEach(x=>{if(String(x.dataset.id)===String(w.id))x.classList.add('correct')});$('comboPop').textContent='再接再厉！'}$('gameScore').textContent=score;$('gameCombo').textContent=combo;setTimeout(()=>timeLeft>0&&nextSpeed(p),220)}
  function endSpeed(){stopTimer();setBest('speed',score);$('challengeBody').innerHTML=`<div class="game-result"><div class="big">🏆 ${score}</div><h2>挑战结束！</h2><p>答对 <b>${correct}</b> / ${answered}　·　正确率 ${answered?Math.round(correct/answered*100):0}%　·　最长连击 ${bestCombo}</p><button id="againGame" class="primary">再来一次</button> <button id="backGame" class="secondary">返回挑战</button></div>`;$('againGame').onclick=()=>settings('speed');$('backGame').onclick=menu}

  function startSpy(p){score=0;combo=0;bestCombo=0;answered=0;correct=0;game='spy';const count=Number($('challengeCount').value||10);let left=count;$('challengeBody').innerHTML=`<div class="game-top"><div class="game-score"><span class="game-stat">题目 <b id="spyLeft">${left}</b></span><span class="game-stat">🏆 <b id="spyScore">0</b></span><span class="game-stat">🔥 <b id="spyCombo">0</b></span></div><button id="quitGame" class="secondary">结束</button></div><div class="game-question" id="gameQuestion"></div><div class="combo-pop" id="comboPop"></div><div class="game-options" id="gameOptions"></div>`;$('quitGame').onclick=()=>endSpy();const next=()=>{if(left<=0)return endSpy();const w=rand(p);$('gameQuestion').innerHTML=`<small>找出正确的中文释义</small>${esc(w.word)}`;const opts=shuffle([w,...shuffle(p.filter(x=>x.id!==w.id)).slice(0,3)]);$('gameOptions').innerHTML=opts.map(x=>`<button class="game-option" data-id="${esc(x.id)}">${esc(x.meaning)}</button>`).join('');document.querySelectorAll('#gameOptions .game-option').forEach(b=>b.onclick=()=>{document.querySelectorAll('#gameOptions .game-option').forEach(x=>x.disabled=true);answered++;left--;if(String(b.dataset.id)===String(w.id)){correct++;combo++;bestCombo=Math.max(bestCombo,combo);score+=10+Math.max(0,combo-1)*2;b.classList.add('correct');$('comboPop').textContent=combo>=3?`🔥 COMBO ×${combo}`:'✓ 答对了！'}else{combo=0;b.classList.add('wrong');document.querySelectorAll('#gameOptions .game-option').forEach(x=>{if(String(x.dataset.id)===String(w.id))x.classList.add('correct')});$('comboPop').textContent='✕ 正确答案已标出'}$('spyLeft').textContent=left;$('spyScore').textContent=score;$('spyCombo').textContent=combo;setTimeout(next,350)});};next()}
  function endSpy(){setBest('spy',bestCombo);$('challengeBody').innerHTML=`<div class="game-result"><div class="big">🕵️ ${score}</div><h2>卧底挑战完成！</h2><p>答对 <b>${correct}</b> / ${answered}　·　正确率 ${answered?Math.round(correct/answered*100):0}%　·　最长连击 ${bestCombo}</p><button id="againGame" class="primary">再来一次</button> <button id="backGame" class="secondary">返回挑战</button></div>`;$('againGame').onclick=()=>settings('spy');$('backGame').onclick=menu}

  function startMemory(p){game='memory';const chosen=shuffle(p).slice(0,6);matchCards=shuffle(chosen.flatMap(w=>[{id:w.id,type:'en',text:w.word,pair:w.id},{id:w.id,type:'cn',text:w.meaning,pair:w.id}]));matchFirst=null;matchBusy=false;matchMoves=0;matchMatched=0;$('challengeBody').innerHTML=`<div class="game-top"><div class="game-score"><span class="game-stat">⏱️ <b id="memoryTime">0</b>s</span><span class="game-stat">🎯 <b id="memoryPairs">0</b> / 6</span><span class="game-stat">↪️ <b id="memoryMoves">0</b> 次</span></div><button id="quitGame" class="secondary">结束</button></div><div class="memory-board" id="memoryBoard">${matchCards.map((c,i)=>`<div class="memory-card" data-index="${i}"><div class="memory-inner"><div class="memory-face memory-front">?</div><div class="memory-face memory-back">${esc(c.text)}</div></div></div>`).join('')}</div>`;$('quitGame').onclick=menu;timer=setInterval(()=>{const n=Number($('memoryTime').textContent)+1;if($('memoryTime'))$('memoryTime').textContent=n},1000);document.querySelectorAll('.memory-card').forEach(c=>c.onclick=()=>flipMemory(c));}
  function flipMemory(card){if(matchBusy||card.classList.contains('flipped')||card.classList.contains('matched'))return;const idx=Number(card.dataset.index),data=matchCards[idx];card.classList.add('flipped');if(!matchFirst){matchFirst={card,data};return}matchMoves++;$('memoryMoves').textContent=matchMoves;if(matchFirst.data.pair===data.pair&&matchFirst.data.type!==data.type){card.classList.add('matched');matchFirst.card.classList.add('matched');matchMatched++;$('memoryPairs').textContent=matchMatched;matchFirst=null;if(matchMatched===6)setTimeout(endMemory,400)}else{matchBusy=true;const first=matchFirst.card;matchFirst=null;setTimeout(()=>{card.classList.remove('flipped');first.classList.remove('flipped');matchBusy=false},650)}}
  function endMemory(){stopTimer();const seconds=Number($('memoryTime').textContent||0);setBest('memory',best('memory')?Math.min(best('memory'),seconds):seconds);$('challengeBody').innerHTML=`<div class="game-result"><div class="big">🎉 ${seconds}s</div><h2>全部配对成功！</h2><p>完成 6 / 6 对　·　翻牌 ${matchMoves} 次</p><button id="againGame" class="primary">再玩一次</button> <button id="backGame" class="secondary">返回挑战</button></div>`;$('againGame').onclick=()=>settings('memory');$('backGame').onclick=menu}

  function show(name){if(name==='challenge')menu()}
  tabs.querySelector('[data-tab="challenge"]').addEventListener('click',()=>show('challenge'));
})();
