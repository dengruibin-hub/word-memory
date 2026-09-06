(() => {
  const KEY='word-memory-v2';
  const $=id=>document.getElementById(id);
  const load=()=>{try{return JSON.parse(localStorage.getItem(KEY))||[]}catch{return[]}};
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const shuffle=a=>a.sort(()=>Math.random()-.5);
  let word=null, token=0, audio=null;
  const cache=new Map();

  function stop(){token++;if(audio){try{audio.pause();audio.currentTime=0}catch{}audio=null}if('speechSynthesis'in window)speechSynthesis.cancel()}
  function immediateUsTts(text){
    if(!('speechSynthesis'in window))return;
    const u=new SpeechSynthesisUtterance(text);u.lang='en-US';u.rate=.76;u.volume=1;
    const vs=speechSynthesis.getVoices();
    const v=vs.find(x=>/en-US/i.test(x.lang)&&/Google US English|Microsoft.*(Jenny|Aria|Guy|Andrew|Christopher)|Samantha|Alex/i.test(x.name))||vs.find(x=>/en-US/i.test(x.lang));
    if(v)u.voice=v;speechSynthesis.cancel();speechSynthesis.speak(u);
  }
  function getUsAudio(text){
    const key=text.trim().toLowerCase();
    if(cache.has(key))return cache.get(key);
    const p=fetch('https://api.dictionaryapi.dev/api/v2/entries/en/'+encodeURIComponent(key)).then(r=>r.ok?r.json():null).then(entries=>{
      if(!Array.isArray(entries))return null;
      const urls=[];entries.forEach(e=>(e.phonetics||[]).forEach(p=>{if(p.audio)urls.push(p.audio)}));
      return urls.find(u=>/-us(?:[.-]|$)/i.test(u)||/-en-us(?:[.-]|$)/i.test(u))||null;
    }).catch(()=>null);
    cache.set(key,p);return p;
  }
  async function play(text){
    if(!text)return;
    stop();
    const myToken=token;
    const cached=cache.get(text.trim().toLowerCase());
    if(cached && typeof cached.then==='function'){
      const url=await cached;if(myToken!==token)return;
      if(url){playUrl(url,myToken,text);return;}
      immediateUsTts(text);return;
    }
    immediateUsTts(text);
    getUsAudio(text).catch(()=>{});
  }
  function playUrl(url,myToken,text){
    if(myToken!==token)return;
    if('speechSynthesis'in window)speechSynthesis.cancel();
    const a=new Audio(url);a.preload='auto';audio=a;
    a.onended=()=>{if(audio===a)audio=null};
    a.play().catch(()=>{if(myToken===token)immediateUsTts(text)});
  }

  function newQuestion(){
    stop();
    const pool=load().filter(w=>w.word&&w.meaning);
    if(pool.length<2){if($('listeningPrompt'))$('listeningPrompt').textContent='词库至少需要 2 个单词';return}
    word=pool[Math.floor(Math.random()*pool.length)];
    const id=String(word.id);
    const options=shuffle([word,...shuffle(pool.filter(w=>String(w.id)!==id&&w.word.toLowerCase()!==word.word.toLowerCase())).slice(0,3)]);
    if($('listeningPrompt'))$('listeningPrompt').textContent='请点击「听发音」按钮后作答';
    $('listeningResult')?.classList.add('hidden');
    $('listeningOptions').innerHTML=options.map(w=>`<button class="quiz-option" data-listen-id="${esc(w.id)}" type="button">${esc(w.word)}</button>`).join('');
    document.querySelectorAll('#listeningOptions [data-listen-id]').forEach(b=>b.onclick=()=>answer(b.dataset.listenId,id));
  }
  function answer(id,correctId){
    if(!word||String(word.id)!==String(correctId))return;
    const ok=String(id)===String(correctId);
    document.querySelectorAll('#listeningOptions [data-listen-id]').forEach(b=>{b.disabled=true;if(String(b.dataset.listenId)===String(correctId))b.classList.add('correct');else if(String(b.dataset.listenId)===String(id))b.classList.add('wrong')});
    const r=$('listeningResult');if(r){r.classList.remove('hidden');r.textContent=ok?'✓ 听对了！':'✕ 正确答案：'+word.word}
    if(ok){const idAtAnswer=String(correctId);setTimeout(()=>{if(word&&String(word.id)===idAtAnswer)newQuestion()},2000)}
  }

  function activateListening(){
    document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab==='listening'));
    document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('active',p.id==='listening'));
    newQuestion();
  }
  function bind(){
    const tab=document.querySelector('.tab[data-tab="listening"]');
    if(tab)tab.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();activateListening()},{capture:true});
    $('newListeningBtn')?.addEventListener('click',e=>{e.stopImmediatePropagation();newQuestion()},{capture:true});
    $('replayListeningBtn')?.addEventListener('click',e=>{e.stopImmediatePropagation();if(word)play(word.word)},{capture:true});
    if($('replayListeningBtn'))$('replayListeningBtn').textContent='🔊 听发音';
  }
  bind();
})();