# 太虚计划官网

太虚编程语言官方网站，面向 `taixu.icu` 与 GitHub Pages 的纯静态站点。

文案与数据当前对应对外产品版本 **0.2.14**。注意：核心仓内部使用两套编号——
对外产品版本（三段纪元制 `0.2.x`，见核心仓 `AGENTS.md` §版本号语义）与内部
里程碑关口号（`V0.NN`）；**官网一律只出现产品版本号**，不出现 `V0.NN`。
页面面向语言使用者与 AI Agent，不涉及编译器实现细节。

## 本地预览

在仓库根目录运行任意静态文件服务器，将站点根目录指向 `dist/`，例如：

```bash
cd dist && python -m http.server 8907
# → http://127.0.0.1:8907/
```

## 页面

| 路径 | 内容 |
|---|---|
| `dist/index.html` | 首页：3D 星际之门交互场景（拖动视角 / 点击展品 / WASD 移动 / 穿越跳转） |
| `dist/learn/` | 学习：快速开始、十二章教程、标准库与生态 |
| `dist/performance/` | 性能：公开实测数据（对齐 `taixu-project/docs/build/beta-readiness-metrics-*.md`） |
| `dist/ai/` | AI 开发方式：mcp / lsp 双通道、Taixu Skill |

首页四个板块的文案在 `dist/assets/content.js`——改文字只需要动这一个文件。

## 目录结构

```
dist/
  index.html            首页（含 importmap 与资源版本号）
  assets/
    three-scene.js      首页场景主逻辑：渲染器、模型装载、交互、穿越动画、主循环
    content.js          首页四个板块的文案数据
    environment.js      场景视觉陈设：星野、远景网格、门心水纹着色器、浮尘
    taixu-portal.glb    3D 星际之门模型（Draco 压缩，约 208 KB）
    taixu-mark.svg      主标志（CSS color 控色）
    game.css / site.css 站点样式（压缩单行，建站遗留约定）
  learn/ performance/ ai/   子页面（单行 HTML，直接编辑对应文案）
assets-src/
  taixu-portal.blend    3D 门户 Blender 源文件
```

## 更新约定

1. **改首页文案** → 编辑 `dist/assets/content.js`，并把 `dist/index.html` 里
   脚本地址的 `?v=` 版本号 +1。
2. **改 3D 模型** → 编辑 `assets-src/taixu-portal.blend` 后重新导出：
   `glTF 2.0` 格式、勾选 **Draco 压缩**、**应用修改器**、Y-up；覆盖
   `dist/assets/taixu-portal.glb`，并把 `three-scene.js` 里 GLB 路径的
   `?v=` 同步 +1。版本号不升级，老访客会命中旧缓存。
3. **改性能数据** → 以核心仓最新 `beta-readiness-metrics` 指标表为准（其中的
   `V0.NN` 关口号换算成对应的产品版本号再上站），同步
   `dist/performance/index.html` 与首页 performance 板块。

## 首页 3D 场景速查

- 门体由四个可独立运动的节点组成：`TX_Portal_Gate`（核心，静止＋呼吸）、
  `TX_Portal_RingMid`（内圈，逆时针）、`TX_Portal_RingOuter`（中圈，顺时针）、
  `TX_Portal_RimRing`（外圈，逆时针）。转速在 `three-scene.js` 的主循环里
  搜 `rotateOnAxis` 可调。
- 门心「空间扰动水纹」是运行时着色器（`environment.js`），不在模型内。
- 运行时探测环面法线轴（`faceAxis`）后再旋转——不要改回 `rotation.z` 直接
  叠加，环体节点自带基准旋转会导致翻转出平面。
- 调试钩子：控制台 `window.__txRings` 暴露四个节点与旋转轴。
- GLB 加载失败或超时（8s）会自动降级为程序生成的后备门体，页面不会空白。

## 品牌资产

- `dist/assets/taixu-mark.svg`：主标志，适用于浅色背景。
- `dist/favicon.svg`：深色底方形图标，适用于浏览器与小尺寸入口。
- 3D 门户沿用标志的几何语言：青 `#28f1dd` / 紫 `#9277ff` 双色发光，
  深空枪灰金属。
