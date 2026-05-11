// ============================================================
// 成語小偵探 — 遊戲邏輯 (v5 — 每階段各自三次機會)
// ============================================================
(function() {
'use strict';

function $id(id) { return document.getElementById(id); }
function shuffle(a) {
  var b = a.slice();
  for (var i = b.length-1; i>0; i--) {
    var j = Math.floor(Math.random()*(i+1));
    var t = b[i]; b[i] = b[j]; b[j] = t;
  }
  return b;
}

// ── State ──
var PER_ROUND = 10;
var MAX_ATTEMPTS = 3;
var pool = [];
var idx = 0;
var score = 0;
var correctCount = 0, wrongCount = 0, helpedCount = 0;
var streak = 0;
var helpClicks = 0;     // 0=step1, 1=step2, 2=step3
var answered = false;
var attemptsLeft = MAX_ATTEMPTS;

// ============================================================
// Build inputs
// ============================================================
function buildFreeInputs(len) {
  var h = '';
  for (var i = 0; i < len; i++)
    h += '<input type="text" class="char-input" maxlength="1" data-idx="' + i + '" ' +
         'inputmode="text" autocomplete="off" autocorrect="off" autocapitalize="off">';
  $id('inputRow').innerHTML = h;
  bindInputs('.char-input', 'inputRow');
}

function buildHintInputs(c2) {
  var chars = c2.split('');
  var h = '', bi = 0;
  chars.forEach(function(ch) {
    if (ch === '＿') { h += '<input type="text" class="hint-input" maxlength="1" data-blk="' + bi++ + '" ' +
      'inputmode="text" autocomplete="off" autocorrect="off" autocapitalize="off" placeholder="?">'; }
    else { h += '<div class="hint-ch-fixed">' + ch + '</div>'; }
  });
  $id('hintBlank').innerHTML = h;
  bindInputs('.hint-input', 'hintBlank');
}

function bindInputs(sel, containerId) {
  var ct = $id(containerId);
  var inputs = ct.querySelectorAll(sel);
  inputs.forEach(function(inp, i) {
    inp.addEventListener('input', function() {
      var v = inp.value.replace(/[^\u4e00-\u9fff]/g, '');
      if (v !== inp.value) inp.value = v;
      if (v.length > 0) { inp.classList.add('filled'); var all = ct.querySelectorAll(sel); if (i+1 < all.length) all[i+1].focus(); }
      else { inp.classList.remove('filled'); }
    });
    inp.addEventListener('keydown', function(e) {
      if (e.key === 'Backspace' && inp.value === '') { var all = ct.querySelectorAll(sel); if (i>0) { all[i-1].focus(); all[i-1].value=''; all[i-1].classList.remove('filled'); } }
      if (e.key === 'Enter') { e.preventDefault(); submitGuess(); }
    });
    inp.addEventListener('focus', function() { inp.select(); });
  });
}

// ── Read guess ──
function getCurrentGuess(q) {
  var s1 = $id('step1'), s2 = $id('step2');
  if (s1 && s1.classList.contains('active')) {
    var g = ''; $id('inputRow').querySelectorAll('.char-input').forEach(function(x){g+=x.value}); return g;
  }
  if (s2 && s2.classList.contains('active')) {
    var blks = $id('hintBlank').querySelectorAll('.hint-input');
    var parts = q.c2.split(''), g = '', bp = 0;
    parts.forEach(function(ch) { if (ch==='＿') { g += blks[bp] ? blks[bp].value : ''; bp++; } else g += ch; });
    return g;
  }
  return '';
}

function disableCurrentInputs() {
  if ($id('step1') && $id('step1').classList.contains('active'))
    $id('inputRow').querySelectorAll('.char-input').forEach(function(x){x.disabled=true});
  if ($id('step2') && $id('step2').classList.contains('active'))
    $id('hintBlank').querySelectorAll('.hint-input').forEach(function(x){x.disabled=true});
  if ($id('step3') && $id('step3').classList.contains('active'))
    $id('options').querySelectorAll('.opt-btn').forEach(function(x){x.disabled=true});
}

function markCorrect(q, guess) {
  if ($id('step1') && $id('step1').classList.contains('active'))
    $id('inputRow').querySelectorAll('.char-input').forEach(function(x,i){ x.classList.add(guess[i]===q.w[i]?'correct-input':'wrong-input'); });
  if ($id('step2') && $id('step2').classList.contains('active')) {
    var blks = $id('hintBlank').querySelectorAll('.hint-input');
    var parts = q.c2.split(''), bp = 0;
    parts.forEach(function(ch,i) { if (ch==='＿') { if(blks[bp]) blks[bp].classList.add(blks[bp].value===q.w[i]?'correct-input':'wrong-input'); bp++; } });
  }
}

function clearWrongMarks() {
  if ($id('step1') && $id('step1').classList.contains('active'))
    $id('inputRow').querySelectorAll('.char-input').forEach(function(x){ x.classList.remove('wrong-input'); if(!x.classList.contains('correct-input')){x.value='';x.classList.remove('filled')} });
  if ($id('step2') && $id('step2').classList.contains('active'))
    $id('hintBlank').querySelectorAll('.hint-input').forEach(function(x){ x.classList.remove('wrong-input'); if(!x.classList.contains('correct-input')){x.value='';x.classList.remove('filled')} });
  // Focus first
  setTimeout(function() {
    var f = document.querySelector('.char-input:not([disabled]), .hint-input:not([disabled])');
    if (f) f.focus();
  }, 50);
}

// ============================================================
// Submit guess (steps 1 & 2)
// ============================================================
function submitGuess() {
  if (answered) return;
  var q = pool[idx];
  var guess = getCurrentGuess(q);
  if (guess.length < q.w.length) { shakeEmpty(); return; }
  var isCorrect = guess === q.w;

  if (isCorrect) {
    answered = true; disableCurrentInputs();
    markCorrect(q, guess);
    var pts = 10; if (helpClicks===0) pts+=5; if (attemptsLeft===MAX_ATTEMPTS) pts+=3;
    score+=pts; correctCount++; streak++;
    $id('bigEmoji').classList.add('bounce'); spawnConfetti();
    updateStats(); showResult(true, q);
  } else {
    attemptsLeft--;
    markCorrect(q, guess);
    if (attemptsLeft > 0) {
      showAttemptToast(attemptsLeft, q);
      setTimeout(function() { clearWrongMarks(); }, 900);
    } else {
      // 三次用完 → 如果還沒求助過，給提示後進入下一階段；如果已求助過，直接揭曉
      if (helpClicks === 0) { goStep2(); }
      else if (helpClicks === 1) { goStep3(); }
      else {
        answered = true; disableCurrentInputs(); wrongCount++; streak=0;
        updateStats(); showResult(false, q);
      }
    }
  }
}

function shakeEmpty() {
  var ct = $id('step1') && $id('step1').classList.contains('active') ? $id('inputRow') : $id('hintBlank');
  var sel = '.char-input, .hint-input';
  ct.querySelectorAll(sel).forEach(function(x){ if(!x.value){ x.classList.add('wrong-input'); setTimeout(function(){x.classList.remove('wrong-input')},400); } });
}

// ============================================================
// Step 3: Option click (3 attempts)
// ============================================================
function handleOptionClick(e) {
  if (answered) return;
  var btn = e.target.closest('.opt-btn');
  if (!btn) return;
  var q = pool[idx];
  var chosen = btn.dataset.answer;
  var isCorrect = chosen === q.w;

  if (isCorrect) {
    answered = true; btn.classList.add('correct');
    $id('options').querySelectorAll('.opt-btn').forEach(function(b){b.disabled=true});
    var pts = 8; if (attemptsLeft===MAX_ATTEMPTS) pts+=3;
    score+=pts; correctCount++; streak++;
    $id('bigEmoji').classList.add('bounce'); spawnConfetti();
    updateStats(); showResult(true, q);
  } else {
    attemptsLeft--;
    btn.classList.add('wrong');
    // Highlight correct but don't lock yet (keep disabled so they can't re-click it)
    btn.disabled = true;
    if (attemptsLeft > 0) {
      showAttemptToast(attemptsLeft, q);
      // Re-enable other buttons
      $id('options').querySelectorAll('.opt-btn').forEach(function(b){ if(!b.classList.contains('wrong')) b.disabled=false; });
    } else {
      // No more attempts — reveal answer
      answered = true;
      $id('options').querySelectorAll('.opt-btn').forEach(function(b){
        if(b.dataset.answer===q.w) b.classList.add('correct');
        b.disabled = true;
      });
      wrongCount++; streak = 0;
      updateStats(); showResult(false, q);
    }
  }
}

// ============================================================
// Attempt Toast
// ============================================================
function showAttemptToast(left, q) {
  var old = $id('attemptToast'); if (old) old.remove();
  var data = {
    2: { e:'🤔', m:'不對喔～還有 <strong>2 次</strong>機會！再想想！' },
    1: { e:'😰', m:'最後一次機會！💦 提示：關鍵字「<strong>'+(q.kw||q.w[0])+'</strong>」' }
  };
  var d = data[left] || {e:'🤔',m:'再試試看！'};
  var t = document.createElement('div');
  t.id = 'attemptToast'; t.className = 'attempt-toast';
  t.innerHTML = '<span class="toast-emoji">'+d.e+'</span> '+d.m;
  document.body.appendChild(t);
  setTimeout(function(){ if(t.parentNode) t.remove(); }, 3500);
}

// ============================================================
// Result
// ============================================================
function showResult(isCorrect, q) {
  var icon = isCorrect ? '✅' : '😅';
  var msg = isCorrect ? '答對了！🎉' : '沒關係，答案是：';
  var extra = !isCorrect ? '<div class="r-hint">💪 記住「<strong>'+q.w+'</strong>」的意思喔！</div>' : '';
  var h =
    '<div class="result-box">' +
      '<div class="r-emoji">'+icon+'</div>' +
      '<div class="r-word">'+msg+' '+q.w+'</div>' +
      '<div style="margin:6px 0">📖 <strong>解釋：</strong>'+q.m+'</div>' +
      '<div>📝 <strong>例句：</strong>'+q.ex+'</div>'+extra+
    '</div>'+
    '<button class="btn-next" id="nextBtn">下一題 ➡️</button>';
  $id('resultContent').innerHTML = h;
  showStep(4);
  $id('nextBtn').addEventListener('click', function(){ idx++; renderQuestion(); });
  scrollSteps();
}

// ============================================================
// Step transitions
// ============================================================
function goStep2() {
  // Reset attempts for the new step
  if (answered) return;
  helpClicks = 1; helpedCount++; attemptsLeft = MAX_ATTEMPTS;
  // Remove old wrong marks on step1
  clearAllMarks();
  updateStats();
  var q = pool[idx];
  $id('qBubble').innerHTML = '<span class="emoji-q">💡</span> '+q.c1;
  buildHintInputs(q.c2);
  $id('helperBtn2').disabled = false;
  showStep(2); scrollSteps();
  setTimeout(function(){ var f=$id('hintBlank').querySelector('.hint-input'); if(f)f.focus(); },150);
  if(!$id('submitHint')){
    var b=document.createElement('button'); b.id='submitHint'; b.className='btn-submit';
    b.textContent='✅ 確定'; b.style.marginTop='10px'; $id('step2').appendChild(b);
  }
}

function goStep3() {
  if (answered) return;
  helpClicks = 2; attemptsLeft = 1; // 三選一只給一次機會
  clearAllMarks();
  var q = pool[idx];
  $id('qBubble').innerHTML = '<span class="emoji-q">🤔</span> 哪一個才是正確成語？';
  var choices = shuffle([q.w].concat(q.opts));
  var h = '';
  choices.forEach(function(w,i){ h+='<button class="opt-btn" data-answer="'+w+'">'+String.fromCharCode(65+i)+') '+w+'</button>'; });
  $id('options').innerHTML = h;
  showStep(3); scrollSteps();
}

function clearAllMarks() {
  document.querySelectorAll('.char-input, .hint-input').forEach(function(x){
    x.classList.remove('correct-input','wrong-input','filled');
    x.value = ''; x.disabled = false;
  });
}

// ── Navigation ──
function showStep(n) {
  ['step1','step2','step3','step4'].forEach(function(id,i){ var el=$id(id); if(el) el.classList.toggle('active',i+1===n); });
}
function scrollSteps() { var s=document.querySelector('.steps'); if(s) s.scrollIntoView({behavior:'smooth',block:'nearest'}); }

// ── Render ──
function renderQuestion() {
  if (idx >= PER_ROUND) { showDoneScreen(); return; }
  var q = pool[idx];
  helpClicks = 0; answered = false; attemptsLeft = MAX_ATTEMPTS;
  $id('bigEmoji').textContent = q.e; $id('bigEmoji').classList.remove('bounce');
  $id('qBubble').innerHTML = '<span class="emoji-q">🤔</span> 你覺得這張圖在說什麼成語呢？';
  buildFreeInputs(q.w.length);
  $id('hintBlank').innerHTML = ''; $id('options').innerHTML = ''; $id('resultContent').innerHTML = '';
  showStep(1);
  $id('helperBtn').disabled = false; $id('helperBtn2').disabled = true;
  var old = $id('attemptToast'); if(old) old.remove();
  updateStats(); updateDots();
  setTimeout(function(){ var f=$id('inputRow').querySelector('.char-input'); if(f)f.focus(); },150);
  $id('gameCard').scrollIntoView({behavior:'smooth',block:'start'});
}

// ── Done ──
function showDoneScreen() {
  $id('qBubble').style.display='none';
  var pct = Math.round(correctCount/PER_ROUND*100);
  var m='',e='';
  if(pct>=90){m='太厲害了！你是成語小天才！';e='🏆'}
  else if(pct>=70){m='表現很棒，繼續加油喔！';e='🌟'}
  else if(pct>=50){m='還不錯，多練習會更好！';e='👍'}
  else{m='沒關係，多玩幾次就記住了！';e='🌱'}
  $id('gameCard').innerHTML =
    '<div class="done-screen"><div class="big">'+e+'</div><h2>'+m+'</h2>'+
    '<div class="final">'+score+' 分</div><p>答對 '+correctCount+' 題 ｜ 答錯 '+wrongCount+' 題 ｜ 求助 '+helpedCount+' 次</p>'+
    '<button class="btn-next" onclick="location.reload()">🔄 再玩一次</button></div>';
  updateDots(); if(pct>=70) spawnConfetti();
}

// ── Stats ──
function updateStats() {
  $id('scoreEl').textContent=score; $id('progEl').textContent=(idx+1)+'/'+PER_ROUND;
  $id('streakEl').textContent=streak; $id('okC').textContent=correctCount;
  $id('ngC').textContent=wrongCount; $id('skC').textContent=helpedCount;
}
function updateDots() {
  var h='';
  for(var i=0;i<PER_ROUND;i++){var c='dot';if(i<idx)c+=' done';if(i===idx&&idx<PER_ROUND)c+=' current';h+='<div class="'+c+'"></div>'}
  $id('dots').innerHTML=h;
}
function spawnConfetti() {
  var colors=['#FF6B6B','#4ECDC4','#FFE66D','#A8E6CF','#FF8B94','#B8A9C9','#FFD3B6','#74B9FF'];
  $id('confetti').innerHTML='';
  for(var i=0;i<50;i++){var p=document.createElement('div');p.className='p';p.style.left=Math.random()*100+'%';p.style.background=colors[Math.floor(Math.random()*colors.length)];p.style.animationDelay=Math.random()*0.8+'s';p.style.animationDuration=(1.5+Math.random()*1.5)+'s';$id('confetti').appendChild(p)}
  setTimeout(function(){$id('confetti').innerHTML=''},2500);
}

// ── Events ──
document.body.addEventListener('click', function(e) {
  var t = e.target;
  if (t.id==='submitGuess'||t.id==='submitHint') { submitGuess(); return; }
  if (t.id==='helperBtn') { goStep2(); return; }
  if (t.id==='helperBtn2') { goStep3(); return; }
  if (t.classList.contains('opt-btn')) { handleOptionClick(e); return; }
});

// ── Boot ──
pool = shuffle(idiomBank).slice(0, PER_ROUND);
idx = 0; score = 0; correctCount = 0; wrongCount = 0; helpedCount = 0; streak = 0;
renderQuestion();

})();
