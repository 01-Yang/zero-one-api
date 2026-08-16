# 零一 API 首页设计 QA

> 本文件与 `artifacts/design-qa/` 中的图片是历史设计核对源 artifact，归属
> `Visual Regression` Overlay，但不是仓库级像素测试的正式 snapshot
> baseline。正式 baseline 只由 `visual-regression/` 中固定 Linux/Chromium
> 环境生成并通过显式 snapshot 更新提交变更。
>
> 历史证据原件：`codex/ui-preview` checkpoint
> `c77c4a2b4e329524c8e795264d038e3bafab79e6`，冻结时间
> `2026-08-17 00:35:27 +08:00`（Asia/Shanghai）。下文中的“本轮”、
> “当前”和“passed”仅描述该 checkpoint 建立前的本地验收，不代表
> `codex/stabilize-sub2api-v0.1.176` 当前测试、CI 或发布结论。

## 比较输入

- 参考站首屏：`artifacts/design-qa/reference-1440-top.png`（1440 × 900）
- 本地实现首屏：`artifacts/design-qa/local-1440-top-final.png`（1440 × 900）
- 参考站价格区：`artifacts/design-qa/reference-1440-pricing.png`（1440 × 900）
- 本地实现价格区：`artifacts/design-qa/local-1440-pricing-final.png`（1440 × 900）
- 本地移动端：`artifacts/design-qa/local-390-top-final.png`、`local-390-pricing-final.png`、`local-390-menu-final.png`
- 本地低高度横屏：`artifacts/design-qa/local-900x520-final.png`
- 1440px 同输入并排比较：`artifacts/design-qa/comparison-1440-final.jpg`（2896 × 1816）
- 本轮桌面首屏 / 滚动态：`artifacts/design-qa/latest-desktop-top-1440x900.png`、`latest-desktop-scroll-1440x900.png`
- 本轮移动首屏 / 滚动态：`artifacts/design-qa/latest-mobile-top-390x844.png`、`latest-mobile-scroll-390x844.png`
- 接入卡同输入对比：`artifacts/design-qa/comparison-quick-start-scroll.jpg`
- Logo 裁切与 Header 同输入对比：`artifacts/design-qa/comparison-brand-mark-header.jpg`
- 交互比较页：`artifacts/design-qa/comparison.html`
- 本地预览：`http://localhost:3001/_landing/`

参考图和实现图已在同一次图像比较输入中并排检查。实现复刻信息层级、滚动导航、筛选搜索、七列价格框架、入场节奏、按钮反馈、移动菜单与 Tooltip 行为；保留零一 API 的 OLED 黑白风格，没有复制第三方品牌、Logo、宣传文案、价格数据或彩色素材。

## 本轮关键调整

1. Hero 改为两个明确的标题行：“零一 API”与“从零到一，连接每一次模型调用”；删除重复的小字副标题与旧标题。两行文字由一个 Particle Canvas 按真实 DOM 字体采样，提供聚拢、鼠标排斥和语义化文字回退。
2. 全页只保留一个动态 Threads 背景 Canvas，使用 `position: fixed` 覆盖视口。滚动到价格、状态或页脚时仍保持同一背景，页面内不再创建静态重复背景。Shader 恢复附件的 40 条线、振幅、时间、距离与完整鼠标增益，并用加法混合提高白线亮度。
3. Header 在滚动后收缩为 808px、48px 高的半透明浮动导航，使用 700ms `cubic-bezier(0.16, 1, 0.3, 1)`；移动菜单全屏展开并锁定 body 滚动。
4. 区块采用 24px → 0、600ms 的一次性入场并顺序错峰；CTA 箭头、共享 Specular WebGL 按钮、按钮按压、优势项、表格行、价格列与计费说明 Tooltip 均有对应反馈；reduced-motion 下取消位移和循环动画。
5. 价格区改为固定七列：模型、提供商、计费、官方输入、官方输出、零一输入、零一输出。桌面和移动端共用同一张最小宽度 1080px 的横向滚动表格；筛选、搜索、空结果、加载、认证、限流、超时与重试均可用。
6. 公告能力仍可由管理员配置，但默认改为关闭、空正文、空链接；缺字段只在显式 `true` 时开启，不再展示被删除的默认公告。
7. 本地预览启用独立 fixture 中间件，设置与 9 个模型完全从 localhost 返回。所有导航、文档、登录、模型广场与 CTA 都映射到当前页面锚点；远程 Logo 在本地模式被屏蔽。
8. 本轮把 QuickStart 从 Hero 的 `-235px` 重叠布局移到首屏下方。1440 × 900 首屏中其顶部为 972px，390 × 844 中为 900px；初始 opacity 为 0，鼠标滚动后才由既有 IntersectionObserver 一次性揭示，无条件挂载与布局跳变。
9. 标题粒子 Implementation 对齐附件节奏：scatter 180、gather 1600ms、stagger 420ms、repel 40 / 120、idle drift 0.7，并采用附件的散射偏移、颜色混合、透明度与 glow 公式；真实 DOM 两行仍作为语义与 Canvas 失败回退。
10. 用户提供的 4096 × 4096 Logo 居中裁为 333 × 333、17KB 的本地品牌资产，由 Vite 输出至 `/_landing/assets/`。后台配置 Logo 优先，非法、外部预览或加载失败时回退到内置 Logo，内置 Logo 也失败时才使用纯文字。
11. 共享 Specular Canvas 现在跟踪已注册按钮自身或祖先的几何 transition 与 entrance animation，每帧重采样 rect，结束后绘制最终帧并停止；已消除 Header 700ms 收缩和 Hero 入场时出现的空圆角残影。

## 同视口差异核对

| 项目 | 结果 | 说明 |
| --- | --- | --- |
| 首屏层级 | passed | 参考站的大标题、说明、CTA、兼容入口节奏被保留；内容换成零一 API，背景按用户要求改为 Threads。 |
| 固定背景 | passed | 1440 与 390 下仅 1 个 Threads 背景 Canvas；滚动后其 rect 仍为 `[0, 0, viewport width, viewport height]`。页面另有 1 个标题粒子 Canvas 与 1 个全局共享按钮 Canvas。 |
| 滚动导航 | passed | 顶部宽导航与滚动后紧凑浮层状态一致，移动端菜单具备展开、关闭、Escape 与滚动锁定。 |
| 价格框架 | passed | 七列顺序、控件位置、行密度、平台价强调列、倍率标签和空态框架与参考路径一致。 |
| 移动价格 | passed | 390px 下容器 362px、表格 1290px，只有表格容器横向滚动，根页面没有横向溢出。 |
| 黑白风格 | passed | 页面只使用黑、白与灰阶；第三方彩色强调、Logo、图标和资产均未复制。 |
| 首屏延迟出现 | passed | 1440、1024、390、320 与 900 × 520 的 QuickStart 初始 top 均在折叠线下；滚动后 opacity 从 0 变为 1，标签、复制与锚点继续可用。 |
| 零一品牌 Logo | passed | 使用用户提供的真实图像裁切，不使用 CSS / SVG 近似；桌面与移动端均在文字左侧以 30px 方形展示，并保持空 alt 与完整链接名称。 |
| 粒子交互 | passed | 应用内浏览器将鼠标移动到标题中心后出现局部排斥空隙，移出后回弹；移动端不拦截触摸滚动。 |
| 内容真实性 | passed | 官方价与平台实付价分列；缺失值为 `—`；本地 fixture 明示不代表真实结算；状态区不显示虚构 SLA。 |
| P0 / P1 / P2 | passed | 对比后未留下阻断、明显布局或交互差异；已修复移动筛选与滚动 Wordmark 的 44px 触控尺寸。 |

## 响应式与无障碍

- 已在应用内浏览器验证 320、360、390、768、1024、1440px，以及 900 × 520 低高度横屏；每个尺寸的 `documentElement.scrollWidth` 均等于 viewport 宽度。
- 价格容器在 320 / 360 / 390 / 768 / 1024 / 1440px 下分别约为 292 / 332 / 362 / 728 / 976 / 1280px；内部表格保持 1290px，并只在自身容器横向滚动。
- 320–390px 下所有可见按钮、链接与输入目标最小尺寸不低于 44px；键盘焦点保留清晰白色轮廓。
- 代码标签支持方向键、Home/End 与 roving tabindex；代码和本地 API 地址均可复制并显示反馈。
- 价格筛选可切换 Claude、OpenAI、Gemini；搜索无结果时保留七列表头，并可一键清除筛选。
- Threads、ParticleHeading 与共享 Specular 运行时均覆盖 WebGL/Canvas 初始化失败、上下文丢失、后台页签、Strict Mode 重挂载及清理；Threads 另覆盖移动 30fps / DPR 1、桌面 60fps / DPR 1.5 和附件同构的鼠标平滑参数。
- 移动菜单打开后，主内容与页脚进入 `inert` 状态；Tab / Shift+Tab 在关闭按钮和菜单链接之间循环，Escape 或选择链接后焦点归还菜单按钮。菜单使用不透明 OLED 黑遮罩，并暂停全局 Specular Canvas 的显示，避免底层按钮高光穿透。
- 在菜单打开时旋转设备或扩展到 768px 以上，会自动关闭菜单并恢复滚动、`inert`、Canvas 可见性和桌面导航，不会留下锁死状态。
- 粗指针设备上的 Specular 通常按交互、滚动或尺寸变化绘制单帧；仅在相关祖先 transition / animation 活跃时临时逐帧跟踪，结束后立即停止。ParticleHeading 在 767px 以下限制 30fps、按面积限制为 900–1800 粒子并关闭 glow。
- `prefers-reduced-motion` 下 Threads 只绘制静态帧，区块不使用位移动画。
- 应用内浏览器控制台仅有 Vite/React 开发信息，没有页面错误或警告。

## Checkpoint 当时的本地隔离与验证

- Checkpoint 验收时的监听进程环境只有 `VITE_LOCAL_PREVIEW=true` 与 `VITE_LANDING_PORT=3001`，不存在 `VITE_API_PROXY_TARGET`。
- `/api/v1/settings/public` 与 `/api/v1/model-plaza` 均返回 `X-Zero-One-Preview: local-fixture`，且 `Cache-Control: no-store`。
- 页面所有 `a[href]` 都是本地锚点或同源 `/_landing/` 资源；DOM 中没有生产控制台、文档或 API 跳转。
- Landing：typecheck 通过，10 个测试文件 / 79 项测试通过，生产构建通过；构建产物为 JS 313.07 kB（gzip 98.94 kB）、CSS 32.83 kB（gzip 7.57 kB）、裁切 Logo 17.00 kB。
- Frontend：typecheck、lint 通过，222 个测试文件 / 1550 项测试通过，生产构建通过。
- Backend：公告 service 5/5、admin handler 5/5、公共 settings handler、DTO 编译、11 项 API contract 与 `CGO_ENABLED=0` server 生产构建全部通过。
- `git diff --check` 通过；未部署、未推送生产。

checkpoint result: passed (historical evidence only)
