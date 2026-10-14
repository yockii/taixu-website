/* 太虚官网 · 设计原型脚本（非模块，所有页面共用）
   语法着色 · 代码逐字打出 · 解码式文字 · 计数 · 终端回放 · 光晕卡片 · 星座背景 · 滚动出场
   页面里的代码一律写纯文本；语法有变动时只改下面的关键字表。
   prefers-reduced-motion 时所有动效直接给出最终状态。 */

(function () {
  'use strict';

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(pointer: fine)').matches;

  /* ── 语法着色（分词 → 记号表） ──────────── */

  const TX_KEYWORDS = new Set([
    'function', 'let', 'const', 'if', 'else', 'while', 'for', 'break', 'continue', 'return',
    'switch', 'case', 'struct', 'enum', 'new', 'true', 'false', 'as', 'catch', 'import',
    'export', 'from', 'test', 'in', 'async', 'await', 'None', 'declare'
  ]);
  const TX_TYPES = new Set(['int', 'float', 'bool', 'string', 'void', 'dynamic', 'u8', 'i32', 'i64', 'f64']);

  function tokensTx(src) {
    const out = [];
    let i = 0;
    while (i < src.length) {
      const rest = src.slice(i);
      let m;
      let cls = null;
      if ((m = /^\/\/[^\n]*/.exec(rest)) || (m = /^\/\*[\s\S]*?(\*\/|$)/.exec(rest))) cls = 'c';
      else if ((m = /^"(?:\\.|[^"\\\n])*"?/.exec(rest)) || (m = /^`(?:\\.|[^`\\])*`?/.exec(rest))) cls = 's';
      else if ((m = /^(?:0x[0-9a-fA-F_]+|0o[0-7_]+|0b[01_]+|\d[\d_]*(?:\.\d+)?(?:e[+-]?\d+)?)\b/.exec(rest))) cls = 'n';
      else if ((m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(rest))) {
        const w = m[0];
        if (TX_KEYWORDS.has(w)) cls = 'k';
        else if (TX_TYPES.has(w) || /^[A-Z]/.test(w)) cls = 't';
        else if (/^\s*\(/.test(src.slice(i + w.length))) cls = 'f';
      } else m = [src[i]];
      out.push([cls, m[0]]);
      i += m[0].length;
    }
    return out;
  }

  function tokensShell(src) {
    const out = [];
    src.split('\n').forEach((line, li) => {
      if (li) out.push([null, '\n']);
      let rest = line;
      let m;
      if ((m = /^(\s*)(\$ )/.exec(rest))) {
        out.push([null, m[1]], ['p', m[2]]);
        rest = rest.slice(m[0].length);
      }
      let first = true;
      while (rest.length) {
        let cls = null;
        if ((m = /^\s+/.exec(rest))) cls = null;
        else if ((m = /^#.*/.exec(rest))) cls = 'c';
        else if ((m = /^"(?:\\.|[^"\\])*"?|^'[^']*'?/.exec(rest))) cls = 's';
        else if ((m = /^--?[A-Za-z][\w-]*(=[^\s#]*)?/.exec(rest))) cls = 't';
        else {
          m = /^[^\s#"']+/.exec(rest) || [rest[0]];
          cls = first ? 'f' : null;
          first = false;
        }
        out.push([cls, m[0]]);
        rest = rest.slice(m[0].length);
      }
    });
    return out;
  }

  const TOKENIZERS = { tx: tokensTx, bash: tokensShell, sh: tokensShell };
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  function renderTokens(tokens, limit) {
    let html = '';
    let left = limit == null ? Infinity : limit;
    for (const [cls, text] of tokens) {
      if (left <= 0) break;
      const part = text.length > left ? text.slice(0, left) : text;
      left -= part.length;
      html += cls ? '<span class="tok-' + cls + '">' + esc(part) + '</span>' : esc(part);
    }
    return html;
  }

  const codeState = new WeakMap();   // el → { tokens, total, raf }
  document.querySelectorAll('code[data-lang]').forEach((el) => {
    const fn = TOKENIZERS[el.dataset.lang];
    if (!fn) return;
    const src = el.textContent;
    const tokens = fn(src);
    codeState.set(el, { tokens, total: src.length });
    el.innerHTML = renderTokens(tokens);
  });

  /* 逐字打出：按字符推进，末尾带光标；完成后回调 */
  function typeCode(el, done) {
    const st = codeState.get(el);
    if (!st) { if (done) done(); return; }
    cancelAnimationFrame(st.raf);
    if (reduced) { el.innerHTML = renderTokens(st.tokens); if (done) done(); return; }
    const cps = Math.max(420, st.total / 1.1);   // 最长约 1.1 秒打完
    const t0 = performance.now();
    const step = (now) => {
      const n = Math.floor((now - t0) / 1000 * cps);
      if (n >= st.total) {
        el.innerHTML = renderTokens(st.tokens);
        if (done) done();
        return;
      }
      el.innerHTML = renderTokens(st.tokens, n) + '<span class="caret" aria-hidden="true"></span>';
      st.raf = requestAnimationFrame(step);
    };
    st.raf = requestAnimationFrame(step);
  }

  /* 运行输出：先显示“编译中”，再逐行给出结果 */
  function runOutput(win) {
    const out = win.querySelector('.out');
    if (!out) return;
    const lines = Array.from(out.querySelectorAll('.ol'));
    clearTimeout(out._t);
    if (reduced) { out.classList.remove('running'); lines.forEach((l) => l.classList.add('on')); return; }
    lines.forEach((l) => l.classList.remove('on'));
    out.classList.add('running');
    let i = 0;
    const next = () => {
      out.classList.remove('running');
      if (i < lines.length) { lines[i++].classList.add('on'); out._t = setTimeout(next, 140); }
    };
    out._t = setTimeout(next, 520);
  }

  function playWindow(win) {
    const code = win.querySelector('pre code[data-lang]');
    const out = win.querySelector('.out');
    if (out && !reduced) out.querySelectorAll('.ol').forEach((l) => l.classList.remove('on'));
    if (code) typeCode(code, () => runOutput(win)); else runOutput(win);
  }

  /* ── 页签 ─────────────────────────────────── */

  document.querySelectorAll('[role="tablist"]').forEach((list) => {
    const tabs = Array.from(list.querySelectorAll('[role="tab"]'));
    function select(tab, focus) {
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        const panel = document.getElementById(t.getAttribute('aria-controls'));
        if (panel) panel.hidden = !on;
      });
      const panel = document.getElementById(tab.getAttribute('aria-controls'));
      if (panel && panel.matches('[data-play]')) playWindow(panel);
      if (focus) tab.focus();
    }
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => select(t, false));
      t.addEventListener('keydown', (e) => {
        let j = null;
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') j = (i + 1) % tabs.length;
        else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') j = (i - 1 + tabs.length) % tabs.length;
        else if (e.key === 'Home') j = 0;
        else if (e.key === 'End') j = tabs.length - 1;
        if (j !== null) { e.preventDefault(); select(tabs[j], true); }
      });
    });
  });

  /* ── 解码式文字 ───────────────────────────── */

  const GLYPHS = '01<>{}[]/\\=+*#$%&?!太虚门道玄空元';
  function scramble(el) {
    if (el._scrambled) return;
    el._scrambled = true;
    el.classList.add('in');
    const final = el.dataset.text || el.textContent;
    el.dataset.text = final;
    if (reduced) { el.textContent = final; return; }
    const dur = Number(el.dataset.scramble) || 900;
    const t0 = performance.now();
    el.setAttribute('aria-label', final);
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur);
      let s = '';
      for (let i = 0; i < final.length; i++) {
        const ch = final[i];
        const settle = i / final.length * 0.7 + 0.3;
        if (ch === ' ' || ch === '\n' || k >= settle) s += ch;
        else s += GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }
      el.textContent = s;
      if (k < 1) requestAnimationFrame(step); else { el.textContent = final; el.removeAttribute('aria-label'); }
    };
    requestAnimationFrame(step);
  }

  /* ── 计数 ─────────────────────────────────── */

  function countUp(el) {
    if (el._counted) return;
    el._counted = true;
    const to = parseFloat(el.dataset.count);
    const dec = Number(el.dataset.decimals || 0);
    if (reduced) { el.textContent = to.toFixed(dec); return; }
    const dur = 1200;
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - k, 4);
      el.textContent = (to * e).toFixed(dec);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* ── 终端回放（Agent 工作流） ─────────────── */

  function replay(pre) {
    if (pre._playing) return;
    pre._playing = true;
    const lines = Array.from(pre.querySelectorAll('.rl'));
    if (reduced) { lines.forEach((l) => l.classList.add('on')); return; }
    let i = 0;
    const tick = () => {
      if (!pre._visible) { pre._playing = false; return; }
      if (i === 0) lines.forEach((l) => l.classList.remove('on'));
      if (i < lines.length) {
        const l = lines[i++];
        l.classList.add('on');
        pre._t = setTimeout(tick, Number(l.dataset.wait) || 420);
      } else {
        i = 0;
        pre._t = setTimeout(tick, 3600);
      }
    };
    tick();
  }

  /* ── 滚动出场 ─────────────────────────────── */

  document.querySelectorAll('[data-stagger]').forEach((box) => {
    Array.from(box.children).forEach((c, i) => c.style.setProperty('--i', i));
  });

  const revealIO = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      const el = en.target;
      if (el.matches('[data-replay]')) {
        el._visible = en.isIntersecting;
        if (en.isIntersecting) replay(el);
        return;
      }
      if (!en.isIntersecting) return;
      el.classList.add('in');
      if (el.matches('[data-scramble]')) scramble(el);
      if (el.matches('[data-count]')) countUp(el);
      el.querySelectorAll('[data-scramble]').forEach(scramble);
      el.querySelectorAll('[data-count]').forEach(countUp);
      if (el.matches('[data-play]') && !el.hidden) playWindow(el);
      revealIO.unobserve(el);
    });
  }, { threshold: 0.18, rootMargin: '0px 0px -6% 0px' }) : null;

  const revealables = document.querySelectorAll('[data-reveal], [data-scramble], [data-count], [data-play], [data-replay]');
  if (revealIO && !reduced) {
    revealables.forEach((el) => revealIO.observe(el));
  } else {
    revealables.forEach((el) => {
      el.classList.add('in');
      if (el.matches('[data-count]')) countUp(el);
      if (el.matches('[data-replay]')) el.querySelectorAll('.rl').forEach((l) => l.classList.add('on'));
      if (el.matches('[data-play]')) el.querySelectorAll('.ol').forEach((l) => l.classList.add('on'));
    });
  }

  /* ── 光晕卡片：跟随指针的边框与光斑 ──────── */

  if (finePointer && !reduced) {
    document.addEventListener('pointermove', (e) => {
      const card = e.target.closest('.spot');
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      card.style.setProperty('--my', (e.clientY - r.top) + 'px');
    }, { passive: true });
    document.querySelectorAll('.tilt').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = 'perspective(900px) rotateX(' + (-y * 5).toFixed(2) + 'deg) rotateY(' + (x * 6).toFixed(2) + 'deg)';
      });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
  }

  /* ── 跑马灯：复制一份内容以无缝循环 ──────── */

  document.querySelectorAll('.marquee-track').forEach((track) => {
    const clone = track.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    track.parentNode.appendChild(clone);
  });

  /* ── 星座背景（子页 hero 的 2D 画布） ────── */

  document.querySelectorAll('canvas.constellation').forEach((cv) => {
    const ctx = cv.getContext('2d');
    let w = 0;
    let h = 0;
    let pts = [];
    const mouse = { x: -9999, y: -9999 };
    const dpr = Math.min(devicePixelRatio || 1, 2);
    function size() {
      const r = cv.getBoundingClientRect();
      w = r.width; h = r.height;
      cv.width = w * dpr; cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(Math.min(140, w * h / 9000));
      pts = Array.from({ length: n }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.18, vy: (Math.random() - 0.5) * 0.18,
        r: Math.random() * 1.3 + 0.4, c: Math.random() > 0.8 ? '146,119,255' : '40,241,221'
      }));
    }
    size();
    addEventListener('resize', size);
    cv.parentElement.addEventListener('pointermove', (e) => {
      const r = cv.getBoundingClientRect();
      mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
    });
    cv.parentElement.addEventListener('pointerleave', () => { mouse.x = mouse.y = -9999; });
    let visible = true;
    if ('IntersectionObserver' in window) new IntersectionObserver((en) => { visible = en[0].isIntersecting; }).observe(cv);
    function frame() {
      if (visible) {
        ctx.clearRect(0, 0, w, h);
        for (const p of pts) {
          if (!reduced) { p.x += p.vx; p.y += p.vy; }
          if (p.x < 0) p.x += w; if (p.x > w) p.x -= w;
          if (p.y < 0) p.y += h; if (p.y > h) p.y -= h;
        }
        for (let i = 0; i < pts.length; i++) {
          const a = pts[i];
          const dm = Math.hypot(a.x - mouse.x, a.y - mouse.y);
          for (let j = i + 1; j < pts.length; j++) {
            const b = pts[j];
            const d = Math.hypot(a.x - b.x, a.y - b.y);
            if (d < 110) {
              const near = dm < 180 ? (1 - dm / 180) * 0.45 : 0;
              ctx.strokeStyle = 'rgba(40,241,221,' + ((1 - d / 110) * 0.12 + near * (1 - d / 110)).toFixed(3) + ')';
              ctx.lineWidth = 1;
              ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
            }
          }
          ctx.fillStyle = 'rgba(' + a.c + ',' + (dm < 160 ? 0.95 : 0.6) + ')';
          ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2); ctx.fill();
        }
      }
      if (!reduced) requestAnimationFrame(frame);
    }
    frame();
  });

  /* ── 复制 ─────────────────────────────────── */

  async function copyText(text, btn) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (err) { /* 忽略 */ }
      ta.remove();
    }
    if (!btn.dataset.label) btn.dataset.label = btn.textContent;
    btn.textContent = '已复制';
    btn.classList.add('done');
    clearTimeout(btn._t);
    btn._t = setTimeout(() => { btn.textContent = btn.dataset.label; btn.classList.remove('done'); }, 1600);
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.copy-btn');
    if (!btn) return;
    let text = btn.dataset.copy;
    if (text == null) {
      const host = btn.closest('.code, .window');
      const code = host && host.querySelector('pre code');
      const st = code && codeState.get(code);
      text = code ? (st ? st.tokens.map((t) => t[1]).join('') : code.textContent) : '';
      // 终端片段：去掉 "$ " 提示符和注释，只留可执行的命令
      if (code && /^(bash|sh)$/.test(code.dataset.lang || '')) {
        text = text.split('\n').filter((l) => !/^\s*#/.test(l))
          .map((l) => l.replace(/^\s*\$ /, '').replace(/\s+#.*$/, '')).join('\n');
      }
    }
    copyText(text.replace(/\n$/, ''), btn);
  });

  /* ── 顶栏 / 移动端菜单 / 文档侧栏 ─────────── */

  const header = document.querySelector('.site-header');
  if (header) {
    const onScroll = () => header.classList.toggle('scrolled', scrollY > 24);
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }
  const navToggle = document.querySelector('.nav-toggle');
  if (navToggle) {
    navToggle.addEventListener('click', () => {
      const open = navToggle.getAttribute('aria-expanded') !== 'true';
      navToggle.setAttribute('aria-expanded', String(open));
      document.querySelectorAll('.site-nav, .header-tools').forEach((el) => el.classList.toggle('open', open));
    });
  }
  const sideToggle = document.querySelector('.side-toggle');
  if (sideToggle) {
    sideToggle.addEventListener('click', () => {
      const open = sideToggle.getAttribute('aria-expanded') !== 'true';
      sideToggle.setAttribute('aria-expanded', String(open));
      document.getElementById(sideToggle.getAttribute('aria-controls')).classList.toggle('open', open);
    });
  }

  /* 搜索框快捷键（原型：只聚焦，不检索） */
  const input = document.getElementById('site-search');
  if (input) {
    document.addEventListener('keydown', (e) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement && document.activeElement.tagName);
      if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !typing)) {
        e.preventDefault();
        if (navToggle && getComputedStyle(navToggle).display !== 'none' && navToggle.getAttribute('aria-expanded') !== 'true') navToggle.click();
        input.focus();
        input.select();
      }
    });
  }

  /* ── 本页目录高亮 ─────────────────────────── */

  const tocLinks = Array.from(document.querySelectorAll('.docs-toc a[href^="#"]'));
  if (tocLinks.length && 'IntersectionObserver' in window) {
    const byId = new Map(tocLinks.map((a) => [decodeURIComponent(a.getAttribute('href').slice(1)), a]));
    const heads = Array.from(document.querySelectorAll('.prose h2[id], .prose h3[id]')).filter((h) => byId.has(h.id));
    const visible = new Set();
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => (en.isIntersecting ? visible.add(en.target) : visible.delete(en.target)));
      const first = heads.find((h) => visible.has(h));
      if (!first) return;
      tocLinks.forEach((a) => a.classList.remove('active'));
      byId.get(first.id).classList.add('active');
    }, { rootMargin: '-80px 0px -65% 0px' });
    heads.forEach((h) => io.observe(h));
  }
})();
