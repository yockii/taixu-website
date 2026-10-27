"""由 dist/autoinstall.md 生成 dist/autoinstall/index.html（站点页头页脚取自 dist/ai/index.html）。
只认本页用到的 Markdown 子集：# 标题、段落、- 列表、1. 列表、表格、```代码块、> 引用、`行内代码`、**粗体**、<链接>、[文字](链接)。
用法（仓库根目录）：python tools/build_autoinstall.py dist"""
import html
import re
import sys

dist = sys.argv[1]
md = open(dist + '/autoinstall.md', encoding='utf-8').read()
ai = open(dist + '/ai/index.html', encoding='utf-8').read()

PROMPT = '请按 https://taixu.icu/autoinstall 为我安装太虚，并配置好 MCP 与 Taixu Skill。'


def inline(t):
    t = html.escape(t, quote=False)
    t = re.sub(r'`([^`]+)`', lambda m: '<code>' + m.group(1) + '</code>', t)
    t = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', t)
    t = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<a href="\2">\1</a>', t)
    t = re.sub(r'&lt;(https?://[^&\s]+)&gt;', r'<a href="\1">\1</a>', t)
    return t


def slug(title, n):
    return 's' + str(n)


lines = md.split('\n')
out = []
i = 0
h2n = 0
toc = []
title = ''
lead = []
while i < len(lines):
    ln = lines[i]
    if ln.startswith('# '):
        title = ln[2:].strip()
        i += 1
        continue
    if ln.startswith('## '):
        h2n += 1
        t = ln[3:].strip()
        sid = slug(t, h2n)
        toc.append((sid, t))
        out.append('<h2 id="%s">%s<a class="anchor" href="#%s" aria-label="本节链接">#</a></h2>' % (sid, inline(t), sid))
        i += 1
        continue
    if ln.startswith('```'):
        lang = ln[3:].strip() or 'text'
        body = []
        i += 1
        while not lines[i].startswith('```'):
            body.append(lines[i])
            i += 1
        i += 1
        out.append('<div class="code">\n  <div class="code-bar"><span>%s</span><button class="copy-btn" type="button">复制</button></div>\n<pre><code data-lang="%s">%s</code></pre>\n</div>'
                   % (lang, lang, html.escape('\n'.join(body), quote=False)))
        continue
    if ln.startswith('|'):
        rows = []
        while i < len(lines) and lines[i].startswith('|'):
            rows.append([c.strip() for c in lines[i].strip().strip('|').split('|')])
            i += 1
        head, body = rows[0], rows[2:]
        t = '<div class="table-wrap">\n<table>\n<thead><tr>' + ''.join('<th scope="col">%s</th>' % inline(c) for c in head) + '</tr></thead>\n<tbody>\n'
        for r in body:
            t += '<tr>' + ''.join('<td>%s</td>' % inline(c) for c in r) + '</tr>\n'
        out.append(t + '</tbody>\n</table>\n</div>')
        continue
    if ln.startswith('> '):
        q = []
        while i < len(lines) and lines[i].startswith('>'):
            q.append(lines[i][1:].strip())
            i += 1
        paras = [p for p in '\n'.join(q).split('\n\n')]
        out.append('<blockquote>' + ''.join('<p>%s</p>' % inline(' '.join(p.split('\n'))) for p in paras if p.strip()) + '</blockquote>')
        continue
    if re.match(r'^(- |\d+\. )', ln):
        ordered = not ln.startswith('- ')
        items = []
        while i < len(lines) and (re.match(r'^(- |\d+\. )', lines[i]) or lines[i].startswith('   ')):
            if lines[i].startswith('   '):
                items[-1] += ' ' + lines[i].strip()
            else:
                items.append(re.sub(r'^(- |\d+\. )', '', lines[i]))
            i += 1
        tag = 'ol' if ordered else 'ul'
        out.append('<%s>%s</%s>' % (tag, ''.join('<li>%s</li>' % inline(x) for x in items), tag))
        continue
    if ln.strip() == '':
        i += 1
        continue
    p = []
    while i < len(lines) and lines[i].strip() and not re.match(r'^(#|```|\||> |- |\d+\. )', lines[i]):
        p.append(lines[i].strip())
        i += 1
    out.append('<p>%s</p>' % inline(' '.join(p)))

# 首屏的 blockquote（说明与示例句）不进正文：正文从第一个 h2 前的段落开始
body = '\n'.join(out)

head_end = ai.index('<main id="main">')
foot_start = ai.index('</main>')
page_head = ai[:head_end]
page_foot = ai[foot_start:]
page_head = page_head.replace('<title>AI 协作 · 太虚</title>', '<title>AI 自动安装 · 太虚</title>')
page_head = re.sub(r'<meta name="description" content="[^"]*">',
                   '<meta name="description" content="给 AI 编程代理的太虚安装说明：判定平台、下载并校验 SHA-256、装到用户目录、加入 PATH、自检、登记 MCP 服务器、安装 Taixu Skill。">',
                   page_head)
page_head = page_head.replace('<link rel="stylesheet" href="../assets/site.css">',
                              '<link rel="stylesheet" href="../assets/site.css">\n<link rel="alternate" type="text/markdown" href="../autoinstall.md" title="Markdown 版">')
page_head = page_head.replace('<a href="../ai/" aria-current="page">AI 协作</a>', '<a href="../ai/">AI 协作</a>')

hero = '''<main id="main">

<section class="page-hero gridbg">
  <canvas class="constellation" aria-hidden="true"></canvas>
  <div class="wrap">
    <div class="head" style="max-width:860px;gap:20px">
      <p class="kicker">Auto Install · 0.3.0-beta.1</p>
      <h1>交给 AI <em>安装太虚</em></h1>
      <p class="lead">把下面这句话发给你的编程代理（Claude Code、Codex、Cursor、VS Code Copilot、Gemini CLI 等）。它会按本页说明下载、校验、安装、加入 PATH，再接好 MCP 与 Taixu Skill；动手前先向你说明计划。</p>
      <div class="cmdline prompt-line">
        <span class="prompt" aria-hidden="true">AI</span>
        <code>%s</code>
        <button class="copy-btn" type="button" data-copy="%s" aria-label="复制提示词">复制</button>
      </div>
      <p class="lead" style="font-size:15px">下面是代理读取的完整说明，人也可以照着做。Markdown 版：<a href="../autoinstall.md">autoinstall.md</a>；手动下载见<a href="../download/">下载页</a>。</p>
    </div>
  </div>
</section>

<section class="section first">
  <div class="wrap">
    <article class="prose" style="max-width:880px">
%s
    </article>
  </div>
</section>

''' % (html.escape(PROMPT, quote=False), html.escape(PROMPT, quote=True), body)

# 正文开头的标题与引用（“本页写给…”“用户可能只发给你…”）留在正文里，供代理读取
open(dist + '/autoinstall/index.html', 'w', encoding='utf-8', newline='\n').write(page_head + hero + page_foot)
print('ok', len(toc), 'sections')
