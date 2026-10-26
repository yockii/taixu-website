# 太虚计划官网

太虚编程语言官方网站 `taixu.icu` 的源码：纯静态站点，`dist/` 由 GitHub Pages 部署（工作流
`.github/workflows/pages.yml`，推送 `main` 即发布；自定义域见 `dist/CNAME`）。

文案与数据对应对外产品版本 **0.3.0-beta.1**（首次公测）。官网只出现产品版本号，不出现内部开发用的
关口编号与内部仓库名；页面面向语言使用者与 AI Agent，不涉及编译器实现细节。

语言本身的公开仓是 <https://github.com/yockii/taixu-lang>（Issues、Releases 都在那里）。教程正文、
速查、语言规范、AI 指南、标准库说明等深层内容不复制到站内，一律链接到公开仓里的对应文件；站点页面只给
概览与目录。

## 本地预览

在仓库根目录运行任意静态文件服务器，将站点根目录指向 `dist/`，例如：

```bash
cd dist && python -m http.server 8907
# → http://127.0.0.1:8907/
```

## 页面

| 路径 | 内容 |
|---|---|
| `dist/index.html` | 首页：WebGL2 程序化门体首屏（滚动穿越）＋语言示例、特性、性能摘要、标准库、文档入口、平台 |
| `dist/learn/` | 学习：快速开始、十二章教程目录（链接到公开仓）、从其他语言迁移 |
| `dist/docs/` | 手册：语言指南、标准库、工具链、GUI 现状与参考的目录和概览 |
| `dist/docs/failure-channels/` | 站内手册页：失败通道 |
| `dist/download/` | 下载：按访问者系统推荐、四平台安装包与 SHA-256、首次运行、VS Code 扩展、已知限制 |
| `dist/performance/` | 性能：与 C、Go、Rust 的对比（醒目标注“性能尚未优化”）、测量方法与复现 |
| `dist/ai/` | AI 协作：CLI、MCP、LSP、DAP 四个入口，Taixu Skill，验证闭环 |

## 目录结构

```
dist/
  index.html              首页
  favicon.svg             深色底方形图标
  CNAME                   Pages 自定义域
  assets/
    site.css              全站样式（深色单主题，系统字体栈，无外部依赖）
    site.js               全站脚本：语法着色、动效、站内搜索索引、下载页按系统推荐
    void.js               首页 WebGL2 场景（零依赖、无模型下载；不支持 WebGL2 时退回静态标志）
    taixu-mark.svg        主标志（CSS color 控色）
  learn/ docs/ download/ performance/ ai/    子页面（各自 index.html）
assets-src/
  taixu-portal.blend      旧版 Three.js 首页的门户模型源文件。现首页的门体由 void.js 程序化生成，
                          不再使用它；保留作设计资产，不参与部署
```

页面之间一律用相对路径互链（`./`、`../`），站点可以部署在任意路径下。

## 更新约定

1. **换版本**：全站搜索 `0.3.0-beta.1` 逐处替换（下载地址里的 tag `v0.3.0-beta.1` 一并替换）。
2. **安装包数据**：只在 `dist/download/index.html` 的“全部平台”表格里维护——每个平台一行，含文件名、
   大小（MB 与精确字节数）、SHA-256 与下载地址；上方“推荐下载”卡片由 `site.js` 从这张表取数，不另存数据。
   大小按 1 MB = 1,048,576 字节、保留一位小数。校验命令一节里的文件名随版本一并改。
3. **发布日期**：只出现在 `dist/download/index.html` 的标题区一处（`发布日期 2026-10-26`）。
4. **Hello 体积**：首页“Hello 原生可执行文件”按 Windows 上 `examples/hello.tx` 的产物（168,448 字节）
   写作 165 KB；换版本时重测，`data-count` 属性与文字两处一起改。
5. **待填数字**：尚未实测的数字用 `{{…}}` 占位，上线前 `grep -rn "{{" dist` 应当为空：
   - `{{R_<负载>_<c|go|rust>}}`：性能页九项负载的比值（负载名如 `fib-rec`、`string-build-find`）；
   - `{{GEO_c}}`、`{{GEO_go}}`、`{{GEO_rust}}`：几何平均（性能页与首页性能板块）；
   - `{{RUNS}}`：每项样本数；`{{GCC_VER}}`、`{{GO_VER}}`、`{{RUST_VER}}`：对照编译器版本。
6. **示例代码**：页面里的 `.tx` 示例与输出必须能在当前版本实跑复现；改示例后用 `taixu run` 核对，
   并以 `taixu fmt --check` 的格式书写（行尾注释前只留一个空格）。代码一律写纯文本，着色由 `site.js` 完成。
7. **新增页面或小节**：在 `site.js` 的 `SEARCH_INDEX` 补一行索引（分区、标题、关键词、地址）。
8. **语言现状**：当前版本不提供 GUI（外部库正在补齐）；涉及 GUI 的文案保持这一口径，直到 GUI 重新随包提供。

## 首页场景速查

- `void.js` 用光线步进（SDF）直接从标志几何生成门体：圆环、三道横向留白与 S 形门缝；四个渲染通道
  （降采样门体与星海、上采样与 GPU 粒子、屏幕后处理）。
- 镜头由首屏滚动驱动：门前 → 推进 → 穿过门心 → 门后星海；HUD 读数与状态文字由同一循环更新。
- 浏览器不支持 WebGL2 时给 `<html>` 加 `no-webgl`，显示静态标志；`prefers-reduced-motion` 时取消滚动穿越与入场动画，场景放慢。

## 品牌资产

- `dist/assets/taixu-mark.svg`：主标志，适用于浅色背景（CSS `color` 控色）；页面内联同一几何的 `#tx-mark` 符号。
- `dist/favicon.svg`：深色底方形图标，适用于浏览器与小尺寸入口。
- 色彩：界面强调色青 `#20e6d2`；门体发光沿用标志的双色——青 `#28f1dd` / 紫 `#9277ff`，深空底色 `#04060a`。
