const KEY = {
  imgs:'home_imgs', name:'home_name', bio:'home_bio',
  cards:'home_cards2', groups:'home_groups2',
  replyGroup:'home_replyGroup',
  delay:'home_delay', maxCount:'home_maxCount',
  peerName:'home_peerName', msgs:'home_msgs',
};

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

function tick() {
  const d = new Date(), h = d.getHours();
  const h12 = h % 12 || 12;
  $('time').textContent = `${pad(h12)}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  $('ampm').textContent = h >= 12 ? 'PM' : 'AM';
  $('date').textContent = `${d.getFullYear()}/${pad(d.getMonth()+1)}/${pad(d.getDate())}`;
  $('weekday').textContent = days[d.getDay()];
  [...$('week').children].forEach((s,i) => s.classList.toggle('on', i === d.getDay()));
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

document.querySelectorAll('.pickable').forEach(el => {
  el.addEventListener('click', () => { currentImgTarget = el.dataset.img; $('filePicker').click(); });
});

$('filePicker').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file || !currentImgTarget) return;
  const reader = new FileReader();
  reader.onload = ev => {
    imgMap[currentImgTarget] = ev.target.result;
    ls.set(KEY.imgs, JSON.stringify(imgMap));
    applyImgs();
  };
  reader.readAsDataURL(file);
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
  btn.addEventListener('click', () => closePage(btn.dataset.close));
});

$('openChat') .addEventListener('click', () => { renderMsgs(); openPage('chatPage'); });
$('openCards').addEventListener('click', () => { renderCardsPage(); openPage('cardsPage'); });
$('openSet')  .addEventListener('click', () => openPage('setPage'));

// ── 字卡库数据 ────────────────────────────────────────────
// 格式：cardData = { '未分组': [{text, enabled}, ...], '日常': [...] }
let cardData  = JSON.parse(ls.get(KEY.cards)  || '{"未分组":[]}');
let groupList = JSON.parse(ls.get(KEY.groups) || '["未分组"]');
let replyGroup = ls.get(KEY.replyGroup) || '全部';

// 迁移旧格式（字符串数组）
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

// ── 字卡库 UI ─────────────────────────────────────────────
let filterGroup  = '全部';
let searchQuery  = '';
let editIndex    = null; // {group, idx} 编辑时用
let modalGroup   = '未分组';

function renderCardsPage() {
  renderFilterChips();
  renderCards();
  renderStat();
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
  groupList.push(n);
  cardData[n] = [];
  saveCardData();
  renderCardsPage();
};

function renderCards() {
  const list = $('cardList');
  let items = [];

  if (filterGroup === '全部') {
    items = groupList.flatMap(g => (cardData[g] || []).map((c,i) => ({...c, group: g, idx: i})));
  } else {
    items = (cardData[filterGroup] || []).map((c,i) => ({...c, group: filterGroup, idx: i}));
  }

  if (searchQuery) {
    items = items.filter(c => c.text.includes(searchQuery));
  }

  if (!items.length) {
    list.innerHTML = '<div class="empty" style="margin-top:30px">没有字卡</div>';
    return;
  }

  list.innerHTML = items.map(c => `
    <div class="wcard2">
      <div class="wcard2-text">${c.text}</div>
      <div class="wcard2-foot">
        <span class="wtag2">${c.group}</span>
        <div class="wcard2-acts">
          <button class="w-toggle ${c.enabled ? 'on' : 'off'}" onclick="toggleCard('${c.group}',${c.idx})"></button>
          <button class="w-act" onclick="editCard('${c.group}',${c.idx})">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#555" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4z"/></svg>
          </button>
          <button class="w-act" onclick="deleteCard('${c.group}',${c.idx})">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#e55" stroke-width="2"><path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2"/></svg>
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

function renderStat() {
  const all = getAllItems();
  const enabled = all.filter(c => c.enabled).length;
  $('cardStat').textContent = `共 ${all.length} 张 · 启用 ${enabled} 张 · 完全随机`;
}

window.toggleCard = (g, i) => {
  cardData[g][i].enabled = !cardData[g][i].enabled;
  saveCardData();
  renderCards();
  renderStat();
};

window.deleteCard = (g, i) => {
  cardData[g].splice(i, 1);
  saveCardData();
  renderCards();
  renderStat();
};

window.editCard = (g, i) => {
  editIndex = {group: g, idx: i};
  $('modalTitle').textContent = '编辑字卡';
  $('modalInput').value = cardData[g][i].text;
  modalGroup = g;
  renderModalGroups();
  $('modalBg').classList.add('show');
};

// ── 新增弹层 ──────────────────────────────────────────────
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
    `<button class="mg-chip ${g === modalGroup ? 'on' : ''}" onclick="setModalGroup('${g}')">${g}</button>`
  ).join('');
}

window.setModalGroup = g => { modalGroup = g; renderModalGroups(); };

$('modalCancel').addEventListener('click', () => $('modalBg').classList.remove('show'));

$('modalOk').addEventListener('click', () => {
  const text = $('modalInput').value.trim();
  if (!text) return showToast('请输入内容');

  if (editIndex) {
    // 编辑单条
    const { group, idx } = editIndex;
    cardData[group][idx].text = text;
    saveCardData();
    showToast('已更新');
  } else {
    // 批量新增，每行一条，去重
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    const existing = allTexts();
    let added = 0, skip = 0;
    lines.forEach(line => {
      if (existing.includes(line)) { skip++; }
      else {
        cardData[modalGroup].push({text: line, enabled: true});
        existing.push(line);
        added++;
      }
    });
    saveCardData();
    showToast(`新增 ${added} 条${skip ? '，重复跳过 ' + skip + ' 条' : ''}`);
  }

  $('modalBg').classList.remove('show');
  renderCards();
  renderStat();
});

$('modalBg').addEventListener('click', e => {
  if (e.target === $('modalBg')) $('modalBg').classList.remove('show');
});

// ── 搜索 ─────────────────────────────────────────────────
$('searchInput').addEventListener('input', e => {
  searchQuery = e.target.value.trim();
  renderCards();
});

// ── 导入导出 ─────────────────────────────────────────────
$('exportBtn').addEventListener('click', () => {
  const json = JSON.stringify({groups: groupList, cards: cardData}, null, 2);
  const blob = new Blob([json], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = '字卡库.json'; a.click();
  URL.revokeObjectURL(url);
  showToast('已导出');
});

$('importBtn').addEventListener('click', () => $('importPicker').click());

$('importPicker').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const text = ev.target.result;
      let added = 0;
      if (file.name.endsWith('.json')) {
        const obj = JSON.parse(text);
        const data = obj.cards || obj;
        const grps = obj.groups || Object.keys(data);
        const existing = allTexts();
        for (const g of grps) {
          if (!groupList.includes(g)) { groupList.push(g); cardData[g] = []; }
          (data[g] || []).forEach(c => {
            const t = typeof c === 'string' ? c : c.text;
            if (!existing.includes(t)) {
              cardData[g].push({text: t, enabled: typeof c === 'object' ? c.enabled : true});
              existing.push(t); added++;
            }
          });
        }
      } else {
        const existing = allTexts();
        text.split('\n').map(l => l.trim()).filter(l => l).forEach(t => {
          if (!existing.includes(t)) {
            cardData['未分组'].push({text: t, enabled: true});
            existing.push(t); added++;
          }
        });
      }
      saveCardData();
      renderCardsPage();
      showToast(`导入成功，新增 ${added} 条`);
    } catch { showToast('导入失败，请检查格式'); }
  };
  reader.readAsText(file);
  e.target.value = '';
});
// ── 聊天 ─────────────────────────────────────────────────
let msgList  = JSON.parse(ls.get(KEY.msgs) || '[]');
let isTyping = false;

function saveMsgs() { ls.set(KEY.msgs, JSON.stringify(msgList)); }

function renderMsgs() {
  const box = $('msgs');
  box.innerHTML = msgList.map(m => `
    <div class="row ${m.from}">
      <div class="ava"></div>
      <div class="bwrap">
        <div class="bubble">${m.text}</div>
        <div class="stamp">${m.time}</div>
      </div>
    </div>
  `).join('');
  box.scrollTop = box.scrollHeight;
}

function addMsg(from, text) {
  msgList.push({from, text, time: nowHM()});
  saveMsgs(); renderMsgs();
}

function peerReply() {
  const pool = getGroupItems(replyGroup).filter(c => c.enabled).map(c => c.text);
  if (!pool.length || isTyping) return;
  isTyping = true;
  const delay = replyDelay * 1000;
  const count = Math.max(1, Math.floor(Math.random() * replyMaxCount) + 1);
  [...pool].sort(() => Math.random() - .5).slice(0, count).forEach((text, i) => {
    setTimeout(() => {
      addMsg('peer', text);
      if (i === count - 1) isTyping = false;
    }, delay + i * 800);
  });
}

$('sendBtn').addEventListener('click', sendMsg);
$('msgInput').addEventListener('keydown', e => { if (e.key === 'Enter') sendMsg(); });

function sendMsg() {
  const v = $('msgInput').value.trim();
  if (!v) return;
  $('msgInput').value = '';
  addMsg('me', v);
  peerReply();
}

$('moreBtn').addEventListener('click', e => {
  e.stopPropagation();
  $('chatMenu').classList.toggle('show');
});
document.addEventListener('click', () => $('chatMenu').classList.remove('show'));

$('changePeerAva').addEventListener('click', () => {
  currentImgTarget = 'peer';
  $('filePicker').click();
  $('chatMenu').classList.remove('show');
});

$('changePeerName').addEventListener('click', () => {
  const n = prompt('输入对方名称', $('peerName').textContent);
  if (n && n.trim()) {
    $('peerName').textContent = n.trim();
    ls.set(KEY.peerName, n.trim());
  }
  $('chatMenu').classList.remove('show');
});

if (ls.get(KEY.peerName)) $('peerName').textContent = ls.get(KEY.peerName);
// ── 底部导航常驻 ──────────────────────────────────────────
const dockItems = [...document.querySelectorAll('.dock .dicon')];
function setNav(i) { dockItems.forEach((d, k) => d.classList.toggle('active', k === i)); }

dockItems[0].addEventListener('click', () => { closePage('cardsPage'); closePage('setPage'); setNav(0); });
dockItems[1].addEventListener('click', () => { closePage('setPage'); setNav(1); });
dockItems[2].addEventListener('click', () => { closePage('cardsPage'); setNav(2); });

$('openChat').addEventListener('click', () => $('phone').classList.add('chat-open'));
document.querySelectorAll('[data-close]').forEach(btn => {
  btn.addEventListener('click', () => {
    $('phone').classList.remove('chat-open');
    setNav(0);
  });
});

setNav(0);
// ── 聊天设置（新） ────────────────────────────────────────
const cfg = JSON.parse(ls.get('home_chatCfg') || '{"cMin":1,"cMax":3,"wMin":4,"wMax":20,"prob":50}');
function saveCfg() { ls.set('home_chatCfg', JSON.stringify(cfg)); }
function syncCfgUI() {
  $('cntMin').value = cfg.cMin;
  $('cntMax').value = cfg.cMax;
  $('waitMin').value = cfg.wMin;
  $('waitMax').value = cfg.wMax;
  $('waitMinVal').textContent = cfg.wMin + 's';
  $('waitMaxVal').textContent = cfg.wMax + 's';
    $('emojiProb').value = cfg.prob;
  $('emojiProbVal').textContent = cfg.prob + '%';
}
syncCfgUI();

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function onCount() {
  let a = clamp(parseInt($('cntMin').value) || 1, 1, 10);
  let b = clamp(parseInt($('cntMax').value) || 1, 1, 10);
  if (a > b) b = a;
  cfg.cMin = a; cfg.cMax = b;
  saveCfg(); syncCfgUI();
}
$('cntMin').addEventListener('change', onCount);
$('cntMax').addEventListener('change', onCount);

$('waitMin').addEventListener('input', () => {
  cfg.wMin = parseInt($('waitMin').value);
  if (cfg.wMax < cfg.wMin) cfg.wMax = cfg.wMin;
  saveCfg(); syncCfgUI();
});
$('waitMax').addEventListener('input', () => {
  cfg.wMax = parseInt($('waitMax').value);
  if (cfg.wMin > cfg.wMax) cfg.wMin = cfg.wMax;
  saveCfg(); syncCfgUI();
});
$('emojiProb').addEventListener('input', () => {
  cfg.prob = parseInt($('emojiProb').value);
  saveCfg(); syncCfgUI();
});

// ── 对方回复（覆盖旧的 peerReply，含"正在输入"） ──────────
const rand = (a, b) => a + Math.random() * (b - a);

function setTyping(on) {
  const s = $('peerState');
  s.textContent = on ? '对方正在输入中...' : 'ONLINE';
  s.classList.toggle('typing', on);
}

function peerReply() {
  const pool = getGroupItems(replyGroup).filter(c => c.enabled).map(c => c.text);
  if (!pool.length || isTyping) return;
  isTyping = true;

  const count = Math.floor(rand(cfg.cMin, cfg.cMax + 1));
  const picks = [...pool].sort(() => Math.random() - .5).slice(0, count);

  let i = 0;
  function next() {
    if (i >= picks.length) { isTyping = false; setTyping(false); return; }
    const wait = (i === 0 ? rand(cfg.wMin, cfg.wMax) : rand(1, 2.5)) * 1000;
    setTimeout(() => {
      setTyping(true);
      setTimeout(() => {
        addMsg('peer', picks[i]);
        i++;
        setTyping(false);
        next();
      }, rand(1000, 2000));
    }, i === 0 ? wait : 400);
  }
  next();
}
// ── 字卡库全删 ────────────────────────────────────────────
$('delAllBtn').addEventListener('click', () => {
  if (!confirm('确定要删除所有字卡吗？（表情包和设置保留）')) return;
  for (const g in cardData) cardData[g] = [];
  saveCardData();
  renderCards();
  renderStat();
  showToast('所有字卡已删除');
});

// ── 恢复出厂设置 ────────────────────────────────────────────
$('resetBtn').addEventListener('click', () => {
  if (!confirm('确定要恢复出厂设置吗？\n所有数据（字卡、表情包、昵称、设置等）都会清除')) return;
  if (!confirm('真的要删除吗？这不能撤销')) return;
  
  // 清除所有存储
  [KEY.imgs, KEY.name, KEY.bio, KEY.cards, KEY.groups, KEY.replyGroup, 
   KEY.delay, KEY.maxCount, KEY.peerName, KEY.msgs, 'home_chatCfg', EMOJI_KEY].forEach(k => ls.set(k, ''));
  
  showToast('已恢复出厂设置，页面即将刷新');
  setTimeout(() => location.reload(), 1200);
});
// ── 清空聊天记录 ──────────────────────────────────────────
$('clearChat').addEventListener('click', () => {
  $('chatMenu').classList.remove('show');
  if (!confirm('确定清空所有聊天记录吗？')) return;
  msgList = [];
  saveMsgs();
  renderMsgs();
  showToast('聊天记录已清空');
});
// ── 分组长按删除 ──────────────────────────────────────────
let holdTimer = null;

window.startHold = g => {
  holdTimer = setTimeout(() => {
    delGroup(g);
  }, 600);
};

window.clearHold = () => {
  if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
};

window.delGroup = g => {
  if (!confirm(`删除分组「${g}」？里面的字卡会移到未分组`)) return;
  const moved = cardData[g] || [];
  cardData['未分组'].push(...moved);
  delete cardData[g];
  groupList = groupList.filter(x => x !== g);
  if (filterGroup === g) filterGroup = '全部';
  saveCardData();
  renderCardsPage();
  showToast(`「${g}」已删除，字卡移至未分组`);
};
// ── 聊天背景 ──────────────────────────────────────────────
const BG_KEY = 'home_chatBg';

function applyChatBg() {
  const bg = ls.get(BG_KEY);
  if (bg) $('msgs').style.backgroundImage = `url("${bg}")`;
  else $('msgs').style.backgroundImage = '';
}
applyChatBg();

$('changeChatBg').addEventListener('click', () => {
  $('chatMenu').classList.remove('show');
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*';
  inp.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      ls.set(BG_KEY, ev.target.result);
      applyChatBg();
      showToast('背景已更换');
    };
    reader.readAsDataURL(file);
  };
  inp.click();
});
