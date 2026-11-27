const KEY = {
  imgs:'home_imgs', name:'home_name', bio:'home_bio',
  cards:'home_cards2', groups:'home_groups2',
  replyGroup:'home_replyGroup',
  peerName:'home_peerName', msgs:'home_msgs',
};
const EMOJI_KEY = 'home_emojis';
const BG_KEY = 'home_chatBg';

const $ = id => document.getElementById(id);
const ls = { get: k => localStorage.getItem(k), set: (k,v) => localStorage.setItem(k,v) };

function showToast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 1800);
}

function nowHM() {
  const d = new Date();
  return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
}

const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const pad = n => String(n).padStart(2,'0');
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v,a,b) => Math.min(b, Math.max(a,v));
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

function tick() {
  const d = new Date(), h = d.getHours();
  const h12 = h % 12 || 12;
  $('time').textContent = `${pad(h12)}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  $('ampm').textContent = h >= 12 ? 'PM' : 'AM';
  $('weekday').textContent = days[d.getDay()];
  [...$('week').children].forEach((s,i) => {
    const dayNum = new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay() + i).getDate();
    s.children[1].textContent = dayNum;
    s.classList.toggle('on', i === d.getDay());
  });
}
tick(); setInterval(tick, 1000);

// ── 图片 ──────────────────────────────────────────────────
let currentImgTarget = null;
const imgMap = JSON.parse(ls.get(KEY.imgs) || '{}');

function applyImgs() {
  const r = document.documentElement.style;
  if (imgMap.banner)   r.setProperty('--banner',   `url("${imgMap.banner}")`);
  if (imgMap.avatar)   r.setProperty('--avatar',   `url("${imgMap.avatar}")`);
  if (imgMap.polaroid) r.setProperty('--polaroid', `url("${imgMap.polaroid}")`);
  if (imgMap.cover)    r.setProperty('--cover',    `url("${imgMap.cover}")`);
  if (imgMap.peer) {
    r.setProperty('--peer', `url("${imgMap.peer}")`);
    if ($('peerAva')) $('peerAva').style.backgroundImage = `url("${imgMap.peer}")`;
  }
}
applyImgs();

function compressImage(file, maxSide, cb) {
  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, maxSide/Math.max(img.width,img.height));
      const c = document.createElement('canvas');
      c.width=Math.round(img.width*s); c.height=Math.round(img.height*s);
      c.getContext('2d').drawImage(img,0,0,c.width,c.height);
      cb(c.toDataURL('image/jpeg',0.8));
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

document.querySelectorAll('.pickable').forEach(el => {
  el.addEventListener('click', () => { currentImgTarget = el.dataset.img; $('filePicker').click(); });
});

$('filePicker').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file || !currentImgTarget) return;
  compressImage(file, 1280, data => {
    imgMap[currentImgTarget] = data;
    ls.set(KEY.imgs, JSON.stringify(imgMap));
    applyImgs();
  });
  e.target.value = '';
});

// ── 昵称 / 签名 ───────────────────────────────────────────
const nameEl = $('nameEl'), bioEl = $('bioEl');
if (ls.get(KEY.name)) nameEl.textContent = ls.get(KEY.name);
if (ls.get(KEY.bio))  bioEl.textContent  = ls.get(KEY.bio);
nameEl.addEventListener('blur', () => ls.set(KEY.name, nameEl.textContent));
bioEl .addEventListener('blur', () => ls.set(KEY.bio,  bioEl.textContent));

// ── 播放器 ────────────────────────────────────────────────
let playing = false;
$('playBtn').onclick = () => {
  playing = !playing;
  $('cover').classList.toggle('spin', playing);
  $('playIcon').innerHTML = playing ? '<path d="M6 4h4v16H6zM14 4h4v16h-4z"/>' : '<path d="M7 4l13 8-13 8z"/>';
};
$('heartBtn').onclick = () => $('heartBtn').classList.toggle('liked');

// ── 页面切换 ──────────────────────────────────────────────
function openPage(id)  { $(id).classList.add('open'); }
function closePage(id) { $(id).classList.remove('open'); }

document.querySelectorAll('[data-close]').forEach(btn => {
  btn.addEventListener('click', () => {
    closePage(btn.dataset.close);
    $('phone').classList.remove('chat-open');
    setNav(0);
  });
});

$('openChat') .addEventListener('click', () => { renderMsgs(); openPage('chatPage'); $('phone').classList.add('chat-open'); });
$('openCards').addEventListener('click', () => { renderCardsPage(); openPage('cardsPage'); });
$('openSet')  .addEventListener('click', () => openPage('setPage'));

// ── 底部导航 ──────────────────────────────────────────────
const dockItems = [...document.querySelectorAll('.dock .dicon')];
function setNav(i) { dockItems.forEach((d,k) => d.classList.toggle('active', k === i)); }
dockItems[0].addEventListener('click', () => { closePage('cardsPage'); closePage('setPage'); setNav(0); });
dockItems[1].addEventListener('click', () => { closePage('setPage'); setNav(1); });
dockItems[2].addEventListener('click', () => { closePage('cardsPage'); setNav(2); });
setNav(0);

// ── 字卡库数据 ────────────────────────────────────────────
let cardData  = JSON.parse(ls.get(KEY.cards)  || '{"未分组":[]}');
let groupList = JSON.parse(ls.get(KEY.groups) || '["未分组"]');
let replyGroup = ls.get(KEY.replyGroup) || '全部';

if (cardData['未分组'] && typeof cardData['未分组'][0] === 'string') {
  cardData['未分组'] = cardData['未分组'].map(t => ({text: t, enabled: true}));
}

function saveCardData() {
  ls.set(KEY.cards,  JSON.stringify(cardData));
  ls.set(KEY.groups, JSON.stringify(groupList));
}

function getAllItems() { return Object.values(cardData).flat(); }
function getGroupItems(g) {
  if (g === '全部') return getAllItems();
  return cardData[g] || [];
}
function allTexts() { return getAllItems().map(c => c.text); }

let filterGroup = '全部', searchQuery = '', editIndex = null, modalGroup = '未分组';

function renderCardsPage() {
  renderFilterChips(); renderCards(); renderStat();
  $('searchInput').value = searchQuery;
}

function renderFilterChips() {
  const all = ['全部', ...groupList];
  $('filterChips').innerHTML = all.map(g => {
    const on = g === filterGroup ? 'on' : '';
    const canDel = g !== '全部' && g !== '未分组';
    const x = canDel ? `<span class="g-x" onclick="event.stopPropagation();delGroup('${g}')">×</span>` : '';
    return `<button class="cl-ftag ${on}" onclick="setFilter('${g}')">${g}${x}</button>`;
  }).join('') + `<button class="cl-ftag" onclick="addGroup()">＋ 新建分组</button>`;
}

window.setFilter = g => { filterGroup = g; renderFilterChips(); renderCards(); renderStat(); };

window.addGroup = () => {
  const name = prompt('输入分组名');
  if (!name || !name.trim()) return;
  const n = name.trim();
  if (groupList.includes(n)) return showToast('分组已存在');
  groupList.push(n); cardData[n] = [];
  saveCardData(); renderCardsPage();
};

window.delGroup = g => {
  if (!confirm(`删除分组「${g}」？字卡移到未分组`)) return;
  cardData['未分组'].push(...(cardData[g] || []));
  delete cardData[g];
  groupList = groupList.filter(x => x !== g);
  if (filterGroup === g) filterGroup = '全部';
  saveCardData(); renderCardsPage();
  showToast(`「${g}」已删除`);
};

function renderCards() {
  const list = $('cardList');
  let items = filterGroup === '全部'
    ? groupList.flatMap(g => (cardData[g]||[]).map((c,i) => ({...c, group:g, idx:i})))
    : (cardData[filterGroup]||[]).map((c,i) => ({...c, group:filterGroup, idx:i}));
  if (searchQuery) items = items.filter(c => c.text.includes(searchQuery));
  if (!items.length) { list.innerHTML = '<div class="empty" style="margin-top:30px">没有字卡</div>'; return; }
  list.innerHTML = items.map(c => `
    <div class="wcard2">
      <div class="wcard2-text">${c.text}</div>
      <div class="wcard2-foot">
        <span class="wtag2">${c.group}</span>
        <div class="wcard2-acts">
          <button class="w-toggle ${c.enabled?'on':'off'}" onclick="toggleCard('${c.group}',${c.idx})"></button>
          <button class="w-act" onclick="editCard('${c.group}',${c.idx})">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#555" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4z"/></svg>
          </button>
          <button class="w-act" onclick="deleteCard('${c.group}',${c.idx})">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#e55" stroke-width="2"><path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2"/></svg>
          </button>
        </div>
      </div>
    </div>`).join('');
}

function renderStat() {
  const all = getAllItems();
  $('cardStat').textContent = `共 ${all.length} 张 · 启用 ${all.filter(c=>c.enabled).length} 张 · 完全随机`;
}

window.toggleCard = (g,i) => { cardData[g][i].enabled = !cardData[g][i].enabled; saveCardData(); renderCards(); renderStat(); };
window.deleteCard = (g,i) => { cardData[g].splice(i,1); saveCardData(); renderCards(); renderStat(); };
window.editCard = (g,i) => {
  editIndex = {group:g, idx:i};
  $('modalTitle').textContent = '编辑字卡';
  $('modalInput').value = cardData[g][i].text;
  modalGroup = g; renderModalGroups();
  $('modalBg').classList.add('show');
};

$('newCardBtn').addEventListener('click', () => {
  editIndex = null;
  $('modalTitle').textContent = '新增字卡';
  $('modalInput').value = '';
  modalGroup = filterGroup === '全部' ? '未分组' : filterGroup;
  renderModalGroups();
  $('modalBg').classList.add('show');
});

function renderModalGroups() {
  $('modalGroups').innerHTML = groupList.map(g =>
    `<button class="mg-chip ${g===modalGroup?'on':''}" onclick="setModalGroup('${g}')">${g}</button>`
  ).join('');
}
window.setModalGroup = g => { modalGroup = g; renderModalGroups(); };

$('modalCancel').addEventListener('click', () => $('modalBg').classList.remove('show'));
$('modalOk').addEventListener('click', () => {
  const text = $('modalInput').value.trim();
  if (!text) return showToast('请输入内容');
  if (editIndex) {
    cardData[editIndex.group][editIndex.idx].text = text;
    saveCardData(); showToast('已更新');
  } else {
    const lines = text.split('\n').map(l=>l.trim()).filter(l=>l);
    const existing = allTexts(); let added=0, skip=0;
    lines.forEach(line => {
      if (existing.includes(line)) skip++;
      else { cardData[modalGroup].push({text:line, enabled:true}); existing.push(line); added++; }
    });
    saveCardData();
    showToast(`新增 ${added} 条${skip?'，重复跳过 '+skip+' 条':''}`);
  }
  $('modalBg').classList.remove('show');
  renderCards(); renderStat();
});

$('modalBg').addEventListener('click', e => { if (e.target===$('modalBg')) $('modalBg').classList.remove('show'); });
$('searchInput').addEventListener('input', e => { searchQuery = e.target.value.trim(); renderCards(); });

new MutationObserver(() => {
  $('phone').classList.toggle('modal-open', $('modalBg').classList.contains('show'));
}).observe($('modalBg'), {attributes:true, attributeFilter:['class']});

// ── 导入导出 ─────────────────────────────────────────────
$('exportBtn').addEventListener('click', () => {
  const json = JSON.stringify({groups:groupList, cards:cardData}, null, 2);
  const a = Object.assign(document.createElement('a'), {href: URL.createObjectURL(new Blob([json],{type:'application/json'})), download:'字卡库.json'});
  a.click(); showToast('已导出');
});

$('importBtn').addEventListener('click', () => $('importPicker').click());
$('importPicker').addEventListener('change', e => {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const text = ev.target.result; let added = 0;
      if (file.name.endsWith('.json')) {
        const obj = JSON.parse(text);
        const data = obj.cards || obj;
        const grps = obj.groups || Object.keys(data);
        const existing = allTexts();
        for (const g of grps) {
          if (!groupList.includes(g)) { groupList.push(g); cardData[g]=[]; }
          (data[g]||[]).forEach(c => {
            const t = typeof c==='string'?c:c.text;
            if (!existing.includes(t)) { cardData[g].push({text:t, enabled:typeof c==='object'?c.enabled:true}); existing.push(t); added++; }
          });
        }
      } else {
        const existing = allTexts();
        text.split('\n').map(l=>l.trim()).filter(l=>l).forEach(t => {
          if (!existing.includes(t)) { cardData['未分组'].push({text:t, enabled:true}); existing.push(t); added++; }
        });
      }
      saveCardData(); renderCardsPage();
      showToast(`导入成功，新增 ${added} 条`);
    } catch { showToast('导入失败'); }
  };
  reader.readAsText(file); e.target.value='';
});

$('delAllBtn').addEventListener('click', () => {
  if (!confirm('确定删除所有字卡？')) return;
  for (const g in cardData) cardData[g]=[];
  saveCardData(); renderCards(); renderStat();
  showToast('已全部删除');
});

// ── 设置 ─────────────────────────────────────────────────
const cfg = Object.assign({cMin:1,cMax:3,wMin:4,wMax:20,prob:50,quoteProb:30,peerTfProb:20,peerTfAmts:'5.20,13.14,52'}, JSON.parse(ls.get('home_chatCfg')||'{}'));
function saveCfg() { ls.set('home_chatCfg', JSON.stringify(cfg)); }

function syncCfgUI() {
  $('cntMin').value = cfg.cMin; $('cntMax').value = cfg.cMax;
  $('waitMin').value = cfg.wMin; $('waitMax').value = cfg.wMax;
  $('waitMinVal').textContent = cfg.wMin+'s'; $('waitMaxVal').textContent = cfg.wMax+'s';
  $('emojiProb').value = cfg.prob; $('emojiProbVal').textContent = cfg.prob+'%';
  $('quoteProb').value = cfg.quoteProb; $('quoteProbVal').textContent = cfg.quoteProb+'%';
  $('peerTfProb').value = cfg.peerTfProb; $('peerTfProbVal').textContent = cfg.peerTfProb+'%';
  $('peerTfAmts').value = cfg.peerTfAmts || '';
}
syncCfgUI();

function onCount() {
  let a = clamp(parseInt($('cntMin').value)||1,1,10);
  let b = clamp(parseInt($('cntMax').value)||1,1,10);
  if (a>b) b=a; cfg.cMin=a; cfg.cMax=b; saveCfg(); syncCfgUI();
}
$('cntMin').addEventListener('change', onCount);
$('cntMax').addEventListener('change', onCount);
$('waitMin').addEventListener('input', () => { cfg.wMin=parseInt($('waitMin').value); if(cfg.wMax<cfg.wMin) cfg.wMax=cfg.wMin; saveCfg(); syncCfgUI(); });
$('waitMax').addEventListener('input', () => { cfg.wMax=parseInt($('waitMax').value); if(cfg.wMin>cfg.wMax) cfg.wMin=cfg.wMax; saveCfg(); syncCfgUI(); });
$('emojiProb').addEventListener('input', () => { cfg.prob=parseInt($('emojiProb').value); saveCfg(); syncCfgUI(); });
$('quoteProb').addEventListener('input', () => { cfg.quoteProb=parseInt($('quoteProb').value); saveCfg(); syncCfgUI(); });
$('peerTfProb').addEventListener('input', () => { cfg.peerTfProb=parseInt($('peerTfProb').value); saveCfg(); syncCfgUI(); });
$('peerTfAmts').addEventListener('input', () => { cfg.peerTfAmts=$('peerTfAmts').value; saveCfg(); });

// ── 全量备份 ──────────────────────────────────────────────
$('backupBtn').addEventListener('click', () => {
  const data = {};
  for (let i=0; i<localStorage.length; i++) {
    const k = localStorage.key(i);
    data[k] = localStorage.getItem(k);
  }
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),
    download: `备份_${new Date().toLocaleDateString('zh')}.json`
  });
  a.click(); showToast('备份已下载');
});

// ── 恢复出厂 ──────────────────────────────────────────────
$('resetBtn').addEventListener('click', () => {
  if (!confirm('确定恢复出厂设置？所有数据都会清除')) return;
  if (!confirm('真的确定吗？不可撤销')) return;
  localStorage.clear();
  showToast('已重置，即将刷新');
  setTimeout(() => location.reload(), 1200);
});

// ── 聊天 ─────────────────────────────────────────────────
let msgList = JSON.parse(ls.get(KEY.msgs) || '[]');
let isTyping = false;
let quoteMsg = null;

function saveMsgs() { ls.set(KEY.msgs, JSON.stringify(msgList)); }

function renderMsgs() {
  const box = $('msgs');
  box.innerHTML = msgList.map((m,idx) => {
    const qBlock = m.quote
      ? `<div class="quote-block">${m.quote.emoji ? '📷 图片' : (m.quote.text || '消息')}</div>`
      : '';
    let content;
    if (m.type === 'transfer') {
      const refunded = m.status === 'refunded';
      const received = m.status === 'received';
      const label = refunded ? '已退还' : (received ? '已收款' : '转账给朋友');
      const icon = refunded ? '×' : '⇄';
      const click = (refunded || received) ? '' : `onclick="openTransfer(${idx})"`;
      content = `<div class="transfer${refunded?' refunded':''}" ${click}>
        <div class="tf-icon">${icon}</div>
        <div class="tf-mid">
          <div class="tf-amt">¥${Number(m.amount).toFixed(2)}</div>
          <div class="tf-label">${label}</div>
        </div>
        <em class="tf-tag">转账</em>
      </div>`;
    } else if (m.type === 'choice') {
      const mine = m.from === 'me';
      const opts = (m.options||[]).map((o,i) => {
        const picked = m.picked === i;
        const dim = m.picked !== null && !picked;
        const locked = mine || m.picked !== null;
        const dis = locked ? 'disabled' : '';
        const click = locked ? '' : `onclick="pickChoice(${idx},${i})"`;
        return `<button class="cc-opt${picked?' picked':''}${dim?' dim':''}" ${dis} ${click}>${esc(o)}</button>`;
      }).join('');
      content = `<div class="choice-card">
        <div class="cc-title">抉择</div>
        ${m.question ? `<div class="cc-q">${esc(m.question)}</div>` : ''}
        <div class="cc-opts">${opts}</div>
        <div class="cc-foot">${m.picked !== null ? '抉择已完成' : '等待对方选择'}</div>
      </div>`;
    } else if (m.emoji) {
      content = `<img src="${m.emoji}" style="max-width:160px;border-radius:16px;display:block">`;
    } else {
      content = `<div class="bubble">${m.text||''}</div>`;
    }
    return `
      <div class="row ${m.from}" data-idx="${idx}" ontouchstart="startMsgHold(${idx},event)" ontouchend="clearMsgHold()" ontouchmove="clearMsgHold()" oncontextmenu="showMsgMenu(${idx},event);return false;">
        <div class="ava"></div>
        <div class="bwrap">
          ${qBlock}
          ${content}
          <div class="stamp">${m.time}</div>
        </div>
      </div>`;
  }).join('');
  box.scrollTop = box.scrollHeight;
}

function addMsg(from, text, emoji, quote) {
  msgList.push({from, text:text||'', emoji:emoji||null, quote:quote||null, time:nowHM()});
  saveMsgs(); renderMsgs();
}

// ── 引用 ─────────────────────────────────────────────────
let msgHoldTimer = null;
let selectedMsgIdx = null;

window.startMsgHold = (idx, e) => {
  msgHoldTimer = setTimeout(() => showMsgMenu(idx, e), 500);
};
window.clearMsgHold = () => { if (msgHoldTimer) { clearTimeout(msgHoldTimer); msgHoldTimer = null; } };

window.showMsgMenu = (idx, e) => {
  selectedMsgIdx = idx;
  const menu = $('msgMenu');
  menu.classList.add('show');
  const x = Math.min(e.touches ? e.touches[0].clientX : e.clientX, window.innerWidth - 130);
  const y = Math.min(e.touches ? e.touches[0].clientY : e.clientY, window.innerHeight - 100);
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
};

document.addEventListener('click', e => {
  if (!$('msgMenu').contains(e.target)) $('msgMenu').classList.remove('show');
});

$('msgMenuQuote').addEventListener('click', () => {
  if (selectedMsgIdx === null) return;
  quoteMsg = msgList[selectedMsgIdx];
  const bar = $('quoteBar');
  bar.style.display = 'flex';
  $('quotePreview').textContent = quoteMsg.emoji ? '📷 图片' : (quoteMsg.text || '转账');
  $('msgMenu').classList.remove('show');
  $('msgInput').focus();
});

$('msgMenuDel').addEventListener('click', () => {
  if (selectedMsgIdx === null) return;
  if (!confirm('删除这条消息？')) return;
  msgList.splice(selectedMsgIdx, 1);
  saveMsgs(); renderMsgs();
  $('msgMenu').classList.remove('show');
});

$('quoteCancelBtn').addEventListener('click', () => {
  quoteMsg = null;
  $('quoteBar').style.display = 'none';
});

// ── 发送 ─────────────────────────────────────────────────
$('sendBtn').addEventListener('click', sendMsg);
$('msgInput').addEventListener('keydown', e => { if (e.key==='Enter') sendMsg(); });

function sendMsg() {
  const v = $('msgInput').value.trim();
  if (!v) return;
  $('msgInput').value = '';
  addMsg('me', v, null, quoteMsg);
  quoteMsg = null;
  $('quoteBar').style.display = 'none';
  peerReply();
}

// ── 聊天菜单 ─────────────────────────────────────────────
$('moreBtn').addEventListener('click', e => { e.stopPropagation(); $('chatMenu').classList.toggle('show'); });
document.addEventListener('click', () => $('chatMenu').classList.remove('show'));

$('changePeerAva').addEventListener('click', () => { currentImgTarget='peer'; $('filePicker').click(); $('chatMenu').classList.remove('show'); });
$('changePeerName').addEventListener('click', () => {
  const n = prompt('输入对方名称', $('peerName').textContent);
  if (n&&n.trim()) { $('peerName').textContent=n.trim(); ls.set(KEY.peerName,n.trim()); }
  $('chatMenu').classList.remove('show');
});
$('clearChat').addEventListener('click', () => {
  $('chatMenu').classList.remove('show');
  if (!confirm('确定清空聊天记录？')) return;
  msgList=[]; saveMsgs(); renderMsgs(); showToast('已清空');
});

if (ls.get(KEY.peerName)) $('peerName').textContent = ls.get(KEY.peerName);

// ── 对方回复 ─────────────────────────────────────────────
function setTyping(on) {
  const s = $('peerState');
  s.textContent = on ? '对方正在输入中...' : 'ONLINE';
  s.classList.toggle('typing', on);
}

function pickOne() {
  if (Math.random()*100 < cfg.peerTfProb) {
    const amts = String(cfg.peerTfAmts||'').split(/[,，\s]+/).map(Number).filter(n => n > 0);
    return { transfer: amts.length ? amts[Math.floor(Math.random()*amts.length)] : 10 };
  }
  const texts = getGroupItems(replyGroup).filter(c=>c.enabled).map(c=>c.text);
  const hasT = texts.length>0, hasE = emojis.length>0;
  if (!hasT && !hasE) return null;
  if (!hasT) return {emoji: emojis[Math.floor(Math.random()*emojis.length)]};
  if (!hasE) return {text: texts[Math.floor(Math.random()*texts.length)]};
  return Math.random()*100 < cfg.prob
    ? {emoji: emojis[Math.floor(Math.random()*emojis.length)]}
    : {text: texts[Math.floor(Math.random()*texts.length)]};
}

function peerReply() {
  if (isTyping) return;
  const hasT = getGroupItems(replyGroup).filter(c=>c.enabled).length > 0;
  const hasE = emojis.length > 0;
  if (!hasT && !hasE && cfg.peerTfProb <= 0) return;
  isTyping = true;
  const count = Math.floor(rand(cfg.cMin, cfg.cMax+1));
  const myLastMsg = [...msgList].reverse().find(m => m.from==='me');
  let i = 0;
  function next() {
    if (i>=count) { isTyping=false; setTyping(false); return; }
    const wait = i===0 ? rand(cfg.wMin,cfg.wMax)*1000 : 400;
    setTimeout(() => {
      setTyping(true);
      setTimeout(() => {
        const p = pickOne();
        if (!p) { isTyping=false; setTyping(false); return; }
        if (p.transfer) {
          addTransfer('peer', p.transfer, 'pending');
        } else {
          const useQuote = i===0 && myLastMsg && Math.random()*100 < cfg.quoteProb;
          addMsg('peer', p.text||'', p.emoji||null, useQuote ? myLastMsg : null);
        }
        i++; setTyping(false); next();
      }, rand(800,1800));
    }, wait);
  }
  next();
}

// ── 转账 ─────────────────────────────────────────────────
let tfOpenIdx = null;

function addTransfer(from, amount, status) {
  const m = { from, type:'transfer', amount, status: status||'pending', time: nowHM(), uid: Date.now()+'-'+Math.random() };
  msgList.push(m);
  saveMsgs(); renderMsgs();
  return m.uid;
}

function setTransferStatus(uid, status) {
  const m = msgList.find(x => x.uid === uid);
  if (m) { m.status = status; saveMsgs(); renderMsgs(); }
}

window.openTransfer = idx => {
  const m = msgList[idx];
  if (!m || m.type !== 'transfer' || m.status !== 'pending') return;
  if (m.from === 'me') return;
  tfOpenIdx = idx;
  $('tfPopAmt').textContent = '¥' + Number(m.amount).toFixed(2);
  $('tfPop').classList.add('show');
};

$('tfAccept').addEventListener('click', () => {
  if (tfOpenIdx === null) return;
  const m = msgList[tfOpenIdx];
  m.status = 'received';
  msgList.push({ from:'me', type:'transfer', amount:m.amount, status:'received', time:nowHM(), uid:'echo-'+Date.now() });
  saveMsgs(); renderMsgs();
  $('tfPop').classList.remove('show');
  tfOpenIdx = null;
  showToast('已收款');
});

$('tfRefund').addEventListener('click', () => {
  if (tfOpenIdx === null) return;
  const m = msgList[tfOpenIdx];
  m.status = 'refunded';
  msgList.push({ from:'me', type:'transfer', amount:m.amount, status:'refunded', time:nowHM(), uid:'echo-'+Date.now() });
  saveMsgs(); renderMsgs();
  $('tfPop').classList.remove('show');
  tfOpenIdx = null;
  showToast('已退还');
});

$('tfPop').addEventListener('click', e => { if (e.target === $('tfPop')) $('tfPop').classList.remove('show'); });

$('tfCancel').addEventListener('click', () => $('tfSheet').classList.remove('show'));
$('tfSheet').addEventListener('click', e => { if (e.target === $('tfSheet')) $('tfSheet').classList.remove('show'); });

$('tfConfirm').addEventListener('click', () => {
  const v = parseFloat($('tfAmount').value);
  if (!v || v <= 0) return showToast('请输入正确金额');
  $('tfSheet').classList.remove('show');
  const uid = addTransfer('me', v, 'pending');
  setTimeout(() => {
    const ok = Math.random() < 0.5;
    setTransferStatus(uid, ok ? 'received' : 'refunded');
    msgList.push({ from:'peer', type:'transfer', amount:v, status: ok?'received':'refunded', time:nowHM(), uid:'echo-'+Date.now() });
    saveMsgs(); renderMsgs();
  }, rand(cfg.wMin, cfg.wMax) * 1000);
});

// ── 抉择 ─────────────────────────────────────────────────
$('chCancel').addEventListener('click', () => $('chSheet').classList.remove('show'));
$('chSheet').addEventListener('click', e => { if (e.target === $('chSheet')) $('chSheet').classList.remove('show'); });

$('chConfirm').addEventListener('click', () => {
  const q = $('chTitle').value.trim();
  const opts = $('chOpts').value.split('\n').map(s => s.trim()).filter(s => s);
  if (!q) return showToast('请输入标题');
  if (opts.length < 2) return showToast('至少要两个选项');
  $('chSheet').classList.remove('show');
  msgList.push({
    from:'me', type:'choice', question:q,
    options: opts.slice(0,6), picked:null,
    time: nowHM(), uid:'ch-'+Date.now()
  });
  saveMsgs(); renderMsgs();

  const idx = msgList.length - 1;
  isTyping = true;
  setTimeout(() => {
    setTyping(true);
    setTimeout(() => {
      const m = msgList[idx];
      if (m && m.type === 'choice' && m.picked === null) {
        m.picked = Math.floor(Math.random() * m.options.length);
        saveMsgs(); renderMsgs();
      }
      isTyping = false;
      setTyping(false);
    }, rand(800, 1800));
  }, rand(cfg.wMin, cfg.wMax) * 1000);
});

window.pickChoice = (idx, i) => {
  const m = msgList[idx];
  if (!m || m.type !== 'choice' || m.picked !== null) return;
  if (m.from === 'me') return;
  m.picked = i;
  saveMsgs(); renderMsgs();
};

// ── 他说：等设定时间后发一条 ──────────────────────────────
function peerSay() {
  if (isTyping) return;
  const texts = getGroupItems(replyGroup).filter(c => c.enabled).map(c => c.text);
  const pool = [...texts.map(t => ({text:t})), ...emojis.map(e => ({emoji:e}))];
  if (!pool.length) return showToast('字卡库和表情包都是空的');
  isTyping = true;
  setTimeout(() => {
    setTyping(true);
    setTimeout(() => {
      const p = pool[Math.floor(Math.random() * pool.length)];
      if (p.emoji) addMsg('peer', '', p.emoji, null);
      else addMsg('peer', p.text, null, null);
      isTyping = false;
      setTyping(false);
    }, rand(800, 1800));
  }, rand(cfg.wMin, cfg.wMax) * 1000);
}

// ── 表情库 ───────────────────────────────────────────────
let emojis = JSON.parse(ls.get(EMOJI_KEY) || '[]');
function saveEmojis() { ls.set(EMOJI_KEY, JSON.stringify(emojis)); }

function renderEmojiList() {
  const list = $('emojiList');
  if (!emojis.length) {
    list.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:#bbb;padding:30px 0;font-size:14px">还没有表情包</div>';
    return;
  }
  list.innerHTML = emojis.map((e,i) =>
    `<div class="emoji-item"><img src="${e}" onclick="sendEmoji(${i})"><button onclick="event.stopPropagation();delEmoji(${i})">×</button></div>`
  ).join('');
}

$('openEmojiBtn').addEventListener('click', () => {
  $('plusPanel').classList.toggle('show');
});

document.querySelectorAll('.pp-item').forEach(el => {
  el.addEventListener('click', () => {
    const act = el.dataset.act;
    $('plusPanel').classList.remove('show');
    if (act === 'emoji') {
      renderEmojiList();
      $('emojiBg').classList.add('show');
    } else if (act === 'transfer') {
      $('tfAmount').value = '';
      $('tfSheet').classList.add('show');
      setTimeout(() => $('tfAmount').focus(), 200);
    } else if (act === 'choice') {
      $('chTitle').value = '';
      $('chOpts').value = '';
      $('chSheet').classList.add('show');
    } else if (act === 'talk') {
      peerSay();
    } else {
      showToast('这个功能还没做');
    }
  });
});

$('emojiClose').addEventListener('click', () => $('emojiBg').classList.remove('show'));
$('emojiBg').addEventListener('click', e => { if (e.target===$('emojiBg')) $('emojiBg').classList.remove('show'); });

$('addEmojiBtn').addEventListener('click', () => {
  const inp = document.createElement('input');
  inp.type='file'; inp.accept='image/*';
  inp.onchange = e => {
    const file = e.target.files[0]; if (!file) return;
    compressImage(file, 400, data => {
      emojis.push(data); saveEmojis(); renderEmojiList(); showToast('已添加');
    });
  };
  inp.click();
});

window.delEmoji = i => { emojis.splice(i,1); saveEmojis(); renderEmojiList(); };
window.sendEmoji = i => {
  addMsg('me', '', emojis[i], quoteMsg);
  quoteMsg=null; $('quoteBar').style.display='none';
  $('emojiBg').classList.remove('show');
  peerReply();
};

// ── 聊天背景 ──────────────────────────────────────────────
function applyChatBg() {
  const bg = ls.get(BG_KEY);
  $('msgs').style.backgroundImage = bg ? `url("${bg}")` : '';
}
applyChatBg();

$('changeChatBg').addEventListener('click', () => { $('chatMenu').classList.remove('show'); $('bgPicker').click(); });
$('bgPicker').addEventListener('change', e => {
  const file = e.target.files[0]; if (!file) return;
  compressImage(file, 1280, data => {
    try { ls.set(BG_KEY,data); applyChatBg(); showToast('背景已更换'); }
    catch { showToast('图片太大，保存失败'); }
  });
  e.target.value='';
});

// ── 后台保活 ──────────────────────────────────────────────
let inactiveTime = 0;
setInterval(() => {
  inactiveTime++;
  if (inactiveTime > 1800) {
    document.title = document.title;
    inactiveTime = 0;
  }
}, 1000);

['click', 'scroll', 'keydown', 'touchstart'].forEach(ev => {
  document.addEventListener(ev, () => { inactiveTime = 0; }, true);
});
