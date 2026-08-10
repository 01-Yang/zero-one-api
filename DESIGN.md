# 零一 API 设计系统

## Theme

官网采用近黑主场景与白色 Threads 线条；控制台默认深色并保留浅色模式。设计借鉴 Apple 产品页面的克制、留白与响应节奏，但不复制其品牌资产。

## Color Palette

### Dark

- Canvas: `#000000`
- Surface: `#141416`
- Surface Raised: `#1c1c1e`
- Text: `#f5f5f7`
- Text Muted: `#a1a1a6`
- Border: `#2c2c2e`
- Primary Action: `#f5f5f7` on `#1d1d1f`

### Light

- Canvas: `#ffffff`
- Surface: `#f5f5f7`
- Surface Raised: `#ffffff`
- Text: `#1d1d1f`
- Text Muted: `#6e6e73`
- Border: `#d2d2d7`
- Primary Action: `#ffffff` on `#1d1d1f`

### Semantic

- Success: `#22c55e`
- Warning: `#f59e0b`
- Danger: `#ef4444`
- Info: neutral gray; focus: `#1d1d1f` in light mode and `#f5f5f7` in dark mode

Semantic colors describe state only. They are not decorative brand colors.

## Typography

- Font stack: `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif`.
- Do not distribute Apple proprietary fonts or require a remote font service.
- All letter spacing is `0`.
- Marketing H1 uses 64px/1.06 on desktop, 44px on tablet, and 36px on phone; sizes change at breakpoints rather than scaling continuously with viewport width.
- Product UI uses a fixed 12/14/16/20/24/30px scale. Body copy line height is 1.5; dense table and control labels use 1.35-1.4.

## Shape And Depth

- Cards, panels, forms and dialogs use at most 8px radius.
- Pills are reserved for badges and compact binary status indicators.
- Full-width sections are never styled as floating cards.
- Surfaces use a hairline border or a subtle 0 1px 2px shadow, never both as decoration.
- No decorative gradients, glow, bokeh, nested cards or large soft shadows.

## Components

- Primary button: high-contrast black/white fill, 40px desktop height and at least 44px mobile hit target.
- Secondary button: neutral hairline border; ghost button: transparent with a clear hover surface.
- Icon-only actions use the existing icon set in Vue and Lucide in React, with accessible names and tooltips where meaning is not universal.
- Inputs and selects use stable 40px height, visible labels, 1px border and a two-stage focus indicator.
- Tables remain dense and scannable. Row height is stable, hover only changes surface color, and horizontal overflow remains available on narrow screens.
- Dialogs, sidebars and headers retain the existing information architecture. Visual styling must not alter permissions or navigation behavior.

## Layout

The Public Site is full-bleed. Its first scene is approximately 82svh so the following action band remains visible. Content is constrained to 1120px, centered, and uses unframed rows instead of repeated feature cards.

The Console retains the existing Sub2API sidebar, header and content regions. Authentication pages use a quiet centered form without animated wallpaper. Admin and user pages prioritize comparison, scanning and repeated action over marketing composition.

## Motion

- Public Site Threads may animate continuously while visible and the document is active.
- Threads pauses when offscreen or hidden, limits internal render resolution, and disables pointer interaction on coarse pointers.
- Reduced-motion mode renders a still frame. WebGL failure falls back to the same near-black canvas without blocking content.
- Console transitions last 150-250ms and communicate state only. No entrance choreography or layout-property animation.

## Accessibility

- Text contrast meets WCAG AA: 4.5:1 for normal text and 3:1 for large text.
- Focus is visible in both themes and never removed without replacement.
- Interactive targets are at least 44px on touch layouts.
- Dynamic status includes text or icons in addition to color.
- Content remains usable at 200% zoom and at 320px CSS viewport width.
