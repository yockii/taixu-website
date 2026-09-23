/* 首页四个板块的文案。改文字只动这个文件，不碰场景代码。 */

export const content = {
  language: {
    index: '01 / LANGUAGE',
    title: '一种语言，构建现代应用。',
    body: '<p>静态类型，显式的失败通道。0.2.14 起支持泛型（单态化实现，运行期零开销）。标准库 24 个模块：json、正则、SHA-256、csv、utf8、os/fs 一应俱全，桌面 GUI 框架随包。</p><code class="code"><i>function</i> id &lt; T &gt; (x: T): T {<br>&nbsp;&nbsp;<i>return</i> x<br>}<br><i>const</i> v = firstOf(xs) <i>catch</i> -1</code>',
    actions: '<a href="./learn/">开始学习</a><a href="https://github.com/yockii/taixu-project">查看源码 ↗</a>'
  },
  performance: {
    index: '02 / PERFORMANCE',
    title: '公开数字，也公开差距。',
    body: '<p>所有数字来自 0.2.14 的公开实测：同一台 Windows x64 机器，9 项负载 × 5 轮交错采样。</p><div class="stats"><span><b>74 KB</b>Hello 原生程序</span><span><b>0.69×</b>对 CPython 中位耗时</span><span><b>3.5×</b>对标量 C 中位耗时</span></div><p>此前版本对 C 为 11.4×，如今 3.5×。差距仍会如实公开，不用笼统的“高性能”代替测量。</p>',
    actions: '<a href="./performance/">完整实测</a>'
  },
  ai: {
    index: '03 / AGENT',
    title: '你描述目标，Agent 负责做完。',
    body: '<p>Agent 经 <b>taixu mcp</b> 调用编译、运行、测试与调试；编辑器走 <b>taixu lsp</b>，两处共用同一套引擎。界面有真实截图可查——改动是否生效，跑一遍就知道。</p><div class="stats"><span><b>mcp</b>AI 工具接入</span><span><b>lsp</b>编辑器共用</span><span><b>verify</b>先验证再交付</span></div>',
    actions: '<a href="./ai/">AI 开发方式</a>'
  },
  learn: {
    index: '04 / LEARN',
    title: '十二章教程，从零到完整应用。',
    body: '<p>绿色免安装，解压即用。十二章教程从第一行代码走到完整应用：类型、失败通道、闭包、异步、工具链，再加 <b>GUI 开发</b>与 <b>AI 工作流</b>。</p><p>人可以沿教程逐章学习，Agent 也可以通过 Taixu Skill 直接读取规范与示例。</p>',
    actions: '<a href="./learn/">进入教程</a><a href="https://github.com/yockii/taixu-project/tree/main/docs">语言手册 ↗</a>'
  }
};

/* 三维展品节点名 → 板块 key */
export const sceneKey = {
  TX_Lang: 'language',
  TX_Perf: 'performance',
  TX_AI: 'ai',
  TX_Learn: 'learn'
};
