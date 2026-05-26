// 大转盘逻辑：从 foods.json 读取配置，绘制并支持旋转抽奖
(function () {
  const canvas = document.getElementById('wheel');
  const ctx = canvas.getContext('2d');
  const spinBtn = document.getElementById('spin');
  const resultEl = document.getElementById('result');
  const titleEl = document.getElementById('title');

  // 默认兜底数据（当 fetch 配置文件失败时使用，例如直接 file:// 双击打开）
  const FALLBACK = {
    title: '今天吃什么？',
    items: [
      { name: '麻辣烫', address: 'A座三层 301' },
      { name: '黄焖鸡', address: 'B座一层 美食广场' },
      { name: '兰州拉面', address: 'A座二层 西侧' },
      { name: '沙县小吃', address: '园区南门外 50m' },
      { name: '米线', address: 'C座一层 大堂西' },
      { name: '盖浇饭', address: '员工食堂 二楼' },
      { name: '饺子', address: 'B座三层 305' },
      { name: '汉堡', address: '购物中心 L1' },
      { name: '寿司', address: '购物中心 L2' },
      { name: '火锅', address: '园区东门外 100m' },
      { name: '烧烤', address: '夜市街 12号' },
      { name: '炒面', address: 'A座一层 东侧' }
    ]
  };

  // 调色板（自动循环使用）
  const PALETTE = [
    '#FF6B6B', '#FFD166', '#06D6A0', '#118AB2', '#EF476F',
    '#F78C6B', '#83D483', '#7B8BFF', '#FFB4A2', '#A06CD5',
    '#4ECDC4', '#FFA600'
  ];

  let items = [];
  let currentRotation = 0; // 累计旋转角度（deg）
  let spinning = false;

  async function loadConfig() {
    const url = (typeof window !== 'undefined' && window.FOODS_URL) ? window.FOODS_URL : 'foods.json';
    try {
      const res = await fetch(url, { cache: 'no-cache' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      return normalize(data);
    } catch (err) {
      console.warn('读取 ' + url + ' 失败，使用默认配置：', err);
      // 如果是 file:// 协议，提示用户用本地服务器打开
      if (location.protocol === 'file:') {
        showTip('提示：直接双击打开时浏览器会拦截 JSON 读取，已使用默认菜单。建议用本地服务器（如 VSCode Live Server）打开。');
      }
      return normalize(FALLBACK);
    }
  }

  function normalize(data) {
    const title = (data && data.title) ? String(data.title) : '今天吃什么？';
    const raw = (data && Array.isArray(data.items)) ? data.items : [];
    let list = raw.map(v => {
      if (v == null) return null;
      if (typeof v === 'string') {
        const name = v.trim();
        return name ? { name, address: '' } : null;
      }
      if (typeof v === 'object') {
        const name = String(v.name || '').trim();
        const address = String(v.address || '').trim();
        return name ? { name, address } : null;
      }
      return null;
    }).filter(Boolean);
    if (list.length < 2) list = FALLBACK.items.slice();
    return { title, items: list };
  }

  function showTip(msg) {
    const div = document.createElement('div');
    div.className = 'error';
    div.textContent = msg;
    document.body.appendChild(div);
  }

  function drawWheel() {
    const size = canvas.width;
    const cx = size / 2;
    const cy = size / 2;
    const radius = size / 2 - 10;
    const n = items.length;
    const anglePer = (Math.PI * 2) / n;

    ctx.clearRect(0, 0, size, size);

    for (let i = 0; i < n; i++) {
      const start = -Math.PI / 2 + i * anglePer; // 从顶部开始
      const end = start + anglePer;

      // 扇形
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, start, end);
      ctx.closePath();
      ctx.fillStyle = PALETTE[i % PALETTE.length];
      ctx.fill();

      // 分割线
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // 文字
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(start + anglePer / 2);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 22px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.shadowColor = 'rgba(0,0,0,0.25)';
      ctx.shadowBlur = 4;
      const text = truncate(items[i].name, 8);
      ctx.fillText(text, radius - 18, 0);
      ctx.restore();
    }

    // 中心圆
    ctx.beginPath();
    ctx.arc(cx, cy, 56, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
  }

  function truncate(s, max) {
    return s.length > max ? s.slice(0, max - 1) + '…' : s;
  }

  function spin() {
    if (spinning || items.length === 0) return;
    spinning = true;
    spinBtn.disabled = true;
    resultEl.innerHTML = '转动中…';

    const n = items.length;
    const anglePer = 360 / n;
    const winner = Math.floor(Math.random() * n);

    // 指针固定在正上方。绘制时第 i 项中心角度（相对于 12 点方向，顺时针）= i * anglePer + anglePer/2
    // 我们希望旋转后该中心对准顶部，因此需要转盘整体逆时针转 (i * anglePer + anglePer/2)
    // 在 CSS rotate 中，正值 = 顺时针。所以使用：360*圈数 - (中心角度) 让目标项停在指针下方
    const turns = 6; // 至少转 6 圈
    const targetAngle = winner * anglePer + anglePer / 2;
    // 当前已有 currentRotation（顺时针累计），新位置需要确保大于当前
    const base = Math.ceil(currentRotation / 360) * 360;
    const next = base + turns * 360 + (360 - targetAngle);

    canvas.style.transform = `rotate(${next}deg)`;
    currentRotation = next;

    const onEnd = () => {
      canvas.removeEventListener('transitionend', onEnd);
      spinning = false;
      spinBtn.disabled = false;
      const picked = items[winner];
      const addrHtml = picked.address
        ? `<div class="addr">📍 ${escapeHtml(picked.address)}</div>`
        : '';
      resultEl.innerHTML =
        `就吃 <span class="name">${escapeHtml(picked.name)}</span> 吧！` + addrHtml;
    };
    canvas.addEventListener('transitionend', onEnd);
  }

  function escapeHtml(s) {
    const map = { '&': '&#38;', '<': '&#60;', '>': '&#62;', '"': '&#34;', "'": '&#39;' };
    return String(s).replace(/[&<>"']/g, m => map[m]);
  }

  // ---- 菜单编辑功能 ----
  const LS_KEY = 'eat-what-items-' + (window.FOODS_URL || 'foods.json');

  function saveToStorage() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(items));
    } catch (e) { /* ignore */ }
  }

  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.length >= 2) return arr;
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  function clearStorage() {
    try { localStorage.removeItem(LS_KEY); } catch (e) { /* ignore */ }
  }

  function openEditor() {
    if (spinning) return;
    const overlay = document.createElement('div');
    overlay.id = 'editor-overlay';
    overlay.innerHTML = buildEditorHTML();
    document.body.appendChild(overlay);
    bindEditorEvents(overlay);
  }

  function buildEditorHTML() {
    let rows = items.map((item, i) =>
      `<div class="ed-row" data-idx="${i}">
        <input class="ed-name" type="text" value="${escapeAttr(item.name)}" placeholder="名称" />
        <input class="ed-addr" type="text" value="${escapeAttr(item.address)}" placeholder="地址（选填）" />
        <button class="ed-del" title="删除">✕</button>
      </div>`
    ).join('');
    return `
      <div class="ed-backdrop"></div>
      <div class="ed-panel">
        <div class="ed-header">
          <span>编辑菜单</span>
          <button class="ed-close">✕</button>
        </div>
        <div class="ed-body" id="ed-body">${rows}</div>
        <div class="ed-footer">
          <button class="ed-add">+ 添加</button>
          <button class="ed-reset">恢复默认</button>
          <button class="ed-save">保存</button>
        </div>
      </div>`;
  }

  function escapeAttr(s) {
    return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function bindEditorEvents(overlay) {
    overlay.querySelector('.ed-close').onclick = () => overlay.remove();
    overlay.querySelector('.ed-backdrop').onclick = () => overlay.remove();
    overlay.querySelector('.ed-add').onclick = () => {
      const body = overlay.querySelector('#ed-body');
      const div = document.createElement('div');
      div.className = 'ed-row';
      div.dataset.idx = body.children.length;
      div.innerHTML = `
        <input class="ed-name" type="text" value="" placeholder="名称" />
        <input class="ed-addr" type="text" value="" placeholder="地址（选填）" />
        <button class="ed-del" title="删除">✕</button>`;
      body.appendChild(div);
    };
    overlay.querySelector('.ed-del,.ed-row .ed-del').onclick; // delegate below
    overlay.querySelector('#ed-body').addEventListener('click', e => {
      if (e.target.classList.contains('ed-del')) {
        const body = overlay.querySelector('#ed-body');
        if (body.children.length <= 2) { alert('至少保留 2 个选项'); return; }
        e.target.closest('.ed-row').remove();
      }
    });
    overlay.querySelector('.ed-reset').onclick = async () => {
      if (!confirm('确定恢复为 JSON 文件中的默认菜单？本地修改将丢失。')) return;
      clearStorage();
      const cfg = await loadConfig();
      items = cfg.items;
      titleEl.textContent = cfg.title;
      currentRotation = 0;
      canvas.style.transform = 'rotate(0deg)';
      drawWheel();
      resultEl.innerHTML = '点击中间按钮开始转动～';
      overlay.remove();
    };
    overlay.querySelector('.ed-save').onclick = () => {
      const rows = overlay.querySelectorAll('.ed-row');
      const newItems = [];
      rows.forEach(row => {
        const name = row.querySelector('.ed-name').value.trim();
        const address = row.querySelector('.ed-addr').value.trim();
        if (name) newItems.push({ name, address });
      });
      if (newItems.length < 2) { alert('至少需要 2 个有效选项'); return; }
      items = newItems;
      saveToStorage();
      currentRotation = 0;
      canvas.style.transform = 'rotate(0deg)';
      drawWheel();
      resultEl.innerHTML = '点击中间按钮开始转动～';
      overlay.remove();
    };
  }

  async function init() {
    const cfg = await loadConfig();
    // 优先读取 localStorage 中的自定义数据
    const stored = loadFromStorage();
    items = stored || cfg.items;
    titleEl.textContent = cfg.title;
    document.title = cfg.title + ' - 大转盘';
    drawWheel();
    spinBtn.addEventListener('click', spin);

    // 绑定编辑按钮
    const editBtn = document.getElementById('edit-btn');
    if (editBtn) editBtn.addEventListener('click', openEditor);
  }

  init();
})();