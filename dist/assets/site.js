/* 太虚官网 · 站点脚本（非模块，所有页面共用）
   语法着色 · 代码逐字打出 · 解码式文字 · 计数 · 终端回放 · 光晕卡片 · 星座背景 · 滚动出场
   · 站内搜索 · 下载页按系统推荐
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
    if (!isFinite(to)) return;   // 非数值（如待填占位符）保持原文
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

  /* ── 站内搜索 ─────────────────────────────── */
  /* 静态索引：[分区, 标题, 说明与关键词, 地址]。地址不带协议时相对站点根目录；
     带 ↗ 的条目指向公开仓里随版本维护的文档。新增页面或小节时在这里补一行。 */

  const REPO = 'https://github.com/yockii/taixu-lang/blob/main/';
  const TUT = REPO + 'docs/tutorial/';
  const QREF = REPO + 'docs/quickref.md';
  const SEARCH_INDEX = [
    ['页面', '首页', '太虚编程语言 概览 0.3.0-beta.1 首次公测', ''],
    ['学习', '快速开始', '下载 解压 自检 taixu --version taixu init taixu run 第一个程序 hello', 'learn/#quickstart'],
    ['学习', '入门教程', '十二章 教程目录 样例 samples', 'learn/#tutorial'],
    ['学习', '从其他语言迁移', '有意没有的写法 复合赋值 += 三目 truthiness class this throw try 字符串下标', 'learn/#migrate'],
    ['教程 ↗', '01 安装与 Hello', 'install init run test main 签名', TUT + '01-install-hello.md'],
    ['教程 ↗', '02 值与类型', 'int float bool string 定宽数值 struct enum 值语义 const as', TUT + '02-values-types.md'],
    ['教程 ↗', '03 控制流', 'if while for for-in switch 表达式 break continue', TUT + '03-control-flow.md'],
    ['教程 ↗', '04 失败通道', 'Error T? ? catch ?? None err errWrap 桥接', TUT + '04-failure-channels.md'],
    ['教程 ↗', '05 堆与引用', 'new Ref Weak List 引用计数 成环 leak-check', TUT + '05-heap-references.md'],
    ['教程 ↗', '06 模块与标准库', 'import export 模块寻径 Map Set std', TUT + '06-modules-stdlib.md'],
    ['教程 ↗', '07 闭包与事件', '箭头函数 函数类型 捕获 闭包 事件订阅 events', TUT + '07-closures-events.md'],
    ['教程 ↗', '08 异步与任务', 'async await Future 调度 TaskGroup 定时器 sleepMs 超时 取消', TUT + '08-async-tasks.md'],
    ['教程 ↗', '09 工具链', 'fmt test doc lsp dap build 发布 调试 VS Code', TUT + '09-toolchain.md'],
    ['教程 ↗', '10 GUI 现状', 'GUI 外部库 正在补齐 暂未随包提供 界面', TUT + '10-gui.md'],
    ['教程 ↗', '11 AI 原生工作流', 'CLI LSP MCP 诊断码 explain capabilities Agent', TUT + '11-ai-workflow.md'],
    ['教程 ↗', '12 关键字与语法总览', '关键字 字面量 转义 插值 语法糖 泛型 接口 interface 错误 enum 生成器 yield defer', TUT + '12-syntax-tour.md'],
    ['手册', '手册首页', '语言指南 标准库 工具链 参考 目录', 'docs/'],
    ['手册', '失败通道', 'T | Error T? ? 传播 catch 默认值 绑定 降级 None err ?? 3005 3006 跨通道', 'docs/failure-channels/'],
    ['手册', '标准库总览', '30 个模块 std/ import 模块表', 'docs/#stdlib'],
    ['手册', '工具链命令', 'init run build test fmt doc explain bench disasm profile capabilities changes lsp dap mcp 子命令', 'docs/#toolchain'],
    ['手册', '常用选项', '--target 交叉编译 --out --leak-check --heap-check --debug --strip --format=json', 'docs/#toolchain'],
    ['手册', 'GUI 现状', 'GUI 外部库 正在补齐 暂未随包提供', 'docs/#gui'],
    ['手册', '参考总览', '速查 关键字 诊断码 规范', 'docs/#reference'],
    ['参考 ↗', '速查手册', '类型 内建函数 诊断码 CLI 子命令 标准库 quickref', QREF],
    ['参考 ↗', '诊断码', '70 个 1xxx 词法 2xxx 语法 30xx 检查 31xx 代码生成 4xxx 运行期 taixu explain', QREF],
    ['参考 ↗', '内建函数', 'print readFile listNew mapNew bytes toStr len assert panic', QREF],
    ['参考 ↗', '语言规范', '权威定义 FFI 外部函数 declare', REPO + 'docs/design/D3-s1-language-spec-v0.42.md'],
    ['参考 ↗', 'AI 生成指南', '大模型 LLM 生成 铁律 自检', REPO + 'docs/ai/llm-guide-s1.md'],
    ['参考 ↗', '工具链兼容变更', 'taixu changes 迁移', REPO + 'docs/ai/toolchain-changes.md'],
    ['标准库', 'std/collect', '泛型 map filter fold take drop reverse sortBy binarySearch heapPush heapPop', 'docs/#stdlib'],
    ['标准库', 'std/collections', 'range reverseInt mapInt filterInt foldInt sumInt maxInt', 'docs/#stdlib'],
    ['标准库', 'std/map_set', '非泛型 Map Set objToMap mapToObj', 'docs/#stdlib'],
    ['标准库', 'std/string', 'contains indexOf split join replace trim toLower toUpper 字符串', 'docs/#stdlib'],
    ['标准库', 'std/utf8', 'count decode encode codepoints 码点 Unicode', 'docs/#stdlib'],
    ['标准库', 'std/text', 'repeat startsWith endsWith padStart padEnd truncate indent', 'docs/#stdlib'],
    ['标准库', 'std/strconv', 'parseInt parseFloat formatInt formatFloat 数值转换', 'docs/#stdlib'],
    ['标准库', 'std/fmt', 'format {} 占位 对齐 宽度 精度 进制 格式化', 'docs/#stdlib'],
    ['标准库', 'std/bytes', 'newBuilder writeString build hexEncode hexDecode 字节缓冲', 'docs/#stdlib'],
    ['标准库', 'std/base64', 'b64Encode b64Decode url 编码', 'docs/#stdlib'],
    ['标准库', 'std/hash', 'sha256Hex sha256Bytes SHA-256 哈希', 'docs/#stdlib'],
    ['标准库', 'std/json', 'Json jsonParse jsonStringify JSON 解析 序列化', 'docs/#stdlib'],
    ['标准库', 'std/csv', 'parseRows serializeRows CSV', 'docs/#stdlib'],
    ['标准库', 'std/regexp', 'matches findGroups 正则 捕获', 'docs/#stdlib'],
    ['标准库', 'std/compress', 'inflate zlib gzip DEFLATE crc32 adler32 解压', 'docs/#stdlib'],
    ['标准库', 'std/image', 'decodePng PNG 解码 RGBA8 图像', 'docs/#stdlib'],
    ['标准库', 'std/math', 'sin cos sqrt pow exp log floor ceil round abs PI 数学', 'docs/#stdlib'],
    ['标准库', 'std/random', 'randomNew randomSeed randomNext randomRange 随机 种子', 'docs/#stdlib'],
    ['标准库', 'std/sort', 'sortInt sortFloat sortString 稳定排序', 'docs/#stdlib'],
    ['标准库', 'std/time', 'timeNowMs formatMs 时间', 'docs/#stdlib'],
    ['标准库', 'std/datetime', 'formatEpochMs dateOf timeOf isLeap daysInMonth 日期', 'docs/#stdlib'],
    ['标准库', 'std/os', 'getenv setenv args argAt 环境变量 命令行参数', 'docs/#stdlib'],
    ['标准库', 'std/path', 'pathJoin pathBase pathDir pathExt pathNormalize 路径', 'docs/#stdlib'],
    ['标准库', 'std/fs', 'fsReadAll fsWriteAll fsReadLines fsExists fsMkdir fsRemove readDir 文件系统', 'docs/#stdlib'],
    ['标准库', 'std/dir', 'makeDirAll 递归建目录', 'docs/#stdlib'],
    ['标准库', 'std/file', 'fileOpen fileRead fileWrite fileSeek fileClose 流式读写', 'docs/#stdlib'],
    ['标准库', 'std/net', 'tcpConnect tcpListen httpGet httpPost TCP HTTP 网络', 'docs/#stdlib'],
    ['标准库', 'std/task', 'taskGroupNew taskGroupAdd taskGroupDrain timeout 并发上限 TaskGroup', 'docs/#stdlib'],
    ['标准库', 'std/pool', 'poolNew poolSubmit poolDrain 分道执行池', 'docs/#stdlib'],
    ['标准库', 'std/events', 'listenersNew on off dispatch EventRecord 事件订阅', 'docs/#stdlib'],
    ['下载', '下载太虚', 'Windows Linux macOS Apple 芯片 安装包 zip tar.gz 推荐下载', 'download/'],
    ['下载', '全部平台', 'x86_64 arm64 aarch64 静态链接 交叉编译', 'download/#all'],
    ['下载', '校验 SHA-256', 'SHA256SUMS Get-FileHash sha256sum shasum 校验和 完整性', 'download/#verify'],
    ['下载', '首次运行被拦', 'macOS xattr quarantine 公证 Windows SmartScreen 未知发布者 仍要运行', 'download/#first-run'],
    ['下载', 'VS Code 扩展', 'taixu-vscode 编辑器 插件 LSP DAP 调试', 'download/#editor'],
    ['下载', '已知限制', 'beta GUI C 库 --lib PDB disasm arm64 性能尚未优化', 'download/#limits'],
    ['性能', '性能实测', 'C Go Rust 对比 九项负载 几何平均 性能尚未优化', 'performance/'],
    ['性能', '测量方法', 'CPU 周期 墙钟 中位数 预热 gcc -O2 go build rustc -O 校验和', 'performance/#method'],
    ['性能', '复现测量', 'perf-baseline.py --suite runtime bench/algo', 'performance/#reproduce'],
    ['AI', 'AI 协作', 'Agent MCP LSP DAP CLI 四入口 同一引擎', 'ai/'],
    ['AI', 'MCP 接入', 'taixu mcp --trust-workspace --workspace 配置 stdio Agent', 'ai/#channels'],
    ['AI', 'Taixu Skill', 'skill 包 SKILL.md capabilities doc --format=json 规范', 'ai/#skill'],
    ['AI', '验证闭环', 'explain 诊断码 test 退出码 leak-check 泄漏 fmt --check 确定性', 'ai/#verify']
  ];

  const siteScript = document.querySelector('script[src*="assets/site.js"]');
  const SITE_ROOT = new URL('../', siteScript ? siteScript.src : location.href);

  function searchHits(q) {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    const hits = [];
    SEARCH_INDEX.forEach((row, i) => {
      const title = row[1].toLowerCase();
      const hay = (row[0] + ' ' + row[1] + ' ' + row[2]).toLowerCase();
      if (!terms.every((t) => hay.includes(t))) return;
      let score = 0;
      terms.forEach((t) => { if (title.includes(t)) score += title.startsWith(t) ? 3 : 2; });
      hits.push({ row, score, i });
    });
    hits.sort((a, b) => b.score - a.score || a.i - b.i);
    return hits.slice(0, 8).map((h) => h.row);
  }

  const input = document.getElementById('site-search');
  if (input) {
    const box = input.closest('.search');
    const results = document.createElement('div');
    results.className = 'search-results';
    results.id = 'search-results';
    results.setAttribute('role', 'listbox');
    results.setAttribute('aria-label', '搜索结果');
    results.hidden = true;
    box.appendChild(results);
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-controls', results.id);
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', 'false');
    let active = -1;

    const options = () => Array.from(results.querySelectorAll('a'));
    function close() {
      results.hidden = true;
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
      active = -1;
    }
    function mark(i) {
      const opts = options();
      opts.forEach((a, j) => a.setAttribute('aria-selected', String(j === i)));
      active = i;
      if (opts[i]) {
        input.setAttribute('aria-activedescendant', opts[i].id);
        opts[i].scrollIntoView({ block: 'nearest' });
      }
    }
    function render() {
      const q = input.value.trim();
      if (!q) { close(); return; }
      const hits = searchHits(q);
      results.textContent = '';
      if (!hits.length) {
        const empty = document.createElement('div');
        empty.className = 'sr-empty';
        empty.textContent = '没有找到“' + q + '”。试试 json、catch、交叉编译、MCP。';
        results.appendChild(empty);
      }
      hits.forEach((row, i) => {
        const a = document.createElement('a');
        a.id = 'sr-' + i;
        a.setAttribute('role', 'option');
        a.setAttribute('aria-selected', 'false');
        a.href = /^https?:/.test(row[3]) ? row[3] : new URL(row[3], SITE_ROOT).href;
        [['sr-sec', row[0]], ['sr-title', row[1]], ['sr-text', row[2]]].forEach(([cls, text]) => {
          const s = document.createElement('span');
          s.className = cls;
          s.textContent = text;
          a.appendChild(s);
        });
        a.addEventListener('click', close);
        results.appendChild(a);
      });
      results.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      active = -1;
      input.removeAttribute('aria-activedescendant');
    }

    input.addEventListener('input', render);
    input.addEventListener('focus', () => { if (input.value.trim()) render(); });
    input.addEventListener('keydown', (e) => {
      const opts = options();
      if (e.key === 'ArrowDown' && opts.length) { e.preventDefault(); mark((active + 1) % opts.length); }
      else if (e.key === 'ArrowUp' && opts.length) { e.preventDefault(); mark((active - 1 + opts.length) % opts.length); }
      else if (e.key === 'Enter') {
        const target = opts[active] || opts[0];
        if (target) { e.preventDefault(); close(); location.href = target.href; }
      } else if (e.key === 'Escape') { close(); input.blur(); }
    });
    document.addEventListener('pointerdown', (e) => { if (!box.contains(e.target)) close(); });

    /* 快捷键：Ctrl/⌘ K 或 / 聚焦搜索框 */
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

  /* ── 下载页：按访问者系统推荐安装包 ─────────
     安装包数据只在“全部平台”表格里维护（.p-name / .p-arch / .p-file / .p-mb / .p-sha 单元格与下载链接），
     这里按行取数填进推荐卡片；识别不出系统时推荐 Windows。 */

  const rec = document.getElementById('rec');
  if (rec) {
    const rows = {};
    document.querySelectorAll('tr[data-platform]').forEach((tr) => { rows[tr.dataset.platform] = tr; });
    const setText = (id, text) => { const el = document.getElementById(id); if (el && text != null) el.textContent = text; };
    function show(key, why) {
      const tr = rows[key];
      if (!tr) return;
      const cell = (sel) => { const el = tr.querySelector(sel); return el ? el.textContent.trim() : ''; };
      setText('rec-name', cell('.p-name'));
      setText('rec-arch', cell('.p-arch'));
      setText('rec-btn', '下载 ' + cell('.p-file'));
      setText('rec-size', cell('.p-mb'));
      setText('rec-sha', cell('.p-sha'));
      setText('rec-exe', tr.dataset.exe);
      setText('rec-why', why);
      const link = tr.querySelector('a[href]');
      const btn = document.getElementById('rec-link');
      if (link && btn) btn.href = link.href;
    }
    const ua = navigator.userAgent || '';
    const uad = navigator.userAgentData;
    const plat = ((uad && uad.platform) || navigator.platform || '').toLowerCase();
    const mobile = /android|iphone|ipad|ipod/i.test(ua) || !!(uad && uad.mobile) ||
      (/mac/.test(plat) && navigator.maxTouchPoints > 1);
    let os = null;
    if (!mobile) {
      if (/win/.test(plat) || (!uad && /windows nt/i.test(ua))) os = 'windows';
      else if (/mac/.test(plat) || (!uad && /macintosh|mac os x/i.test(ua))) os = 'macos';
      else if (/linux/.test(plat) || (!uad && /linux/i.test(ua) && !/cros/i.test(ua))) os = 'linux';
    }
    if (os === 'windows') show('windows', '已按你的系统（Windows）推荐。');
    else if (os === 'linux') {
      show('linux', /aarch64|arm/i.test(ua + plat) ? '目前只提供 x86_64 版的 Linux 包。' : '已按你的系统（Linux）推荐。');
    } else if (os === 'macos') {
      show('macos-arm64', '已按你的系统（macOS）推荐 Apple 芯片版；Intel 芯片的 Mac 请选 x86_64 版。');
      if (uad && uad.getHighEntropyValues) {
        uad.getHighEntropyValues(['architecture']).then((v) => {
          if (v && v.architecture === 'x86') show('macos-x64', '已按你的系统（macOS，Intel 芯片）推荐。');
        }).catch(() => {});
      }
    } else show('windows', '未能识别你的系统，默认推荐 Windows 版。');
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
