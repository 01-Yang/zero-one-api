# 零一 API 技术方案

## Baseline And Change Boundary

项目的稳定技术基线为
[`Wei-Shaw/sub2api v0.1.173@29009f0b2ea14edf3b11ae2564fb617ff91a03b4`](https://github.com/Wei-Shaw/sub2api/tree/29009f0b2ea14edf3b11ae2564fb617ff91a03b4)。
公开 fork [`01-Yang/zero-one-api`](https://github.com/01-Yang/zero-one-api)
配置为 `origin`，官方仓库 `Wei-Shaw/sub2api` 配置为只读
`upstream`。`zero-one/brand` 是零一 API 产品分支；`origin/main`
仅保留上游开发主线镜像，不作为产品发布基线。

禁止修改 Go 业务逻辑、数据库结构、计费、鉴权、账号池、路由守卫和兑换码规则。允许的改动只有：独立 Public Site、Vue 全局主题与共享壳层、边缘代理和项目文档。

## Runtime Architecture

```text
Internet
  -> Caddy :80/:443
       -> React static files for exact api.01yapi.com/
       -> Sub2API :8080 for every other API-host request
       -> Public Site redirect for exact GET/HEAD app.01yapi.com/
       -> Sub2API :8080 for every other app.01yapi.com request
       -> Sub2API :8080 for backup API requests
  -> Sub2API
       -> PostgreSQL
       -> Redis
```

Sub2API remains one Go process with the Vue SPA embedded by the official root `Dockerfile`. Because the Vue theme is customized, production must build a project-owned image from this repository rather than use the stock `weishaw/sub2api` image.

The React app lives in `landing/`, uses Vite with base `/_landing/`, and is built into the edge image. It is not embedded in Vue and does not add a second frontend runtime to the Console.

## Public Interfaces

| Host and request | Result |
| --- | --- |
| `api.01yapi.com`, exact `GET/HEAD /` | React Public Site |
| `api.01yapi.com/_landing/assets/*` | Immutable hashed React static assets |
| `api.01yapi.com/_landing/THIRD_PARTY_NOTICES.txt` | No-cache third-party notice |
| Every other `api.01yapi.com` request | Transparent Sub2API proxy |
| `app.01yapi.com`, exact `GET/HEAD /` | Non-cacheable 307 redirect to `https://api.01yapi.com/` with URI retained |
| Every other `app.01yapi.com` request | Sub2API and embedded Vue Console |
| Exact `GET/HEAD api.01yapi.cc/` | No-store backup metadata JSON |
| Every other `api.01yapi.cc` request | Transparent Sub2API proxy |
| `01yapi.com` and `www.01yapi.com` | 308 redirect to the primary host with URI retained |

There are no new backend APIs or schemas. The Public Site reads the existing `GET /api/v1/settings/public` endpoint and falls back to compiled brand defaults when it is unavailable.

The Console keeps the server-provided site settings authoritative, but its compiled display fallback is also `零一 API` with the approved tagline. This prevents a settings timeout or first-paint race from exposing the upstream product name; it does not change the settings API or persistence behavior.

Two presentation-only differences are intentional and reviewed. An unset local
theme preference starts in dark mode, while an explicit `light` or `dark` choice
is preserved. CC Switch imports use the configured site name (or the `零一 API`
display fallback) only for the provider's human-readable `name`; the app,
endpoint, API key, config format and usage script fields remain unchanged. Text
that enters a protocol test request, including the English Grok TTS probe, keeps
the upstream technical default even when its surrounding placeholder is branded.

The proxy deliberately uses a catch-all rule. Sub2API exposes `/v1`, `/v1beta`, `/responses`, `/backend-api/codex`, `/antigravity`, root-level media endpoints and WebSockets; a hand-maintained allowlist would silently break current or future clients.

## Build And Release

1. Install and test the Vue frontend using the existing pnpm lockfile.
2. Install and test `landing/` using its own lockfile.
3. Build the root Dockerfile to compile Vue, embed it in Go and produce the custom Sub2API image.
4. Build `deploy/zero-one/Dockerfile.edge` to compile React and package Caddy with static assets.
5. Tag images with source revision and deploy by immutable digest. Do not deploy `latest`.
6. Validate Compose and Caddy configuration before replacing running containers.

上游同步只跟随 `Wei-Shaw/sub2api` 的正式稳定 tag，不直接合并
`upstream/main` 或单独抽取未发布提交。更新时获取 `upstream` tags，从
`zero-one/brand` 创建 `codex/sync-sub2api-vX.Y.Z` 短期集成分支，
合并新的稳定 tag，运行全部测试、构建和视觉验收后，再通过 PR
合回 `zero-one/brand`。每次同步同时更新本节的 tag 与完整提交 SHA。
主题改动保持集中，使新增上游页面继承设计系统，避免逐页分叉。

The repository's dedicated Zero One CI job validates React, Vue, Go, Compose,
the root Sub2API Docker build and the Caddy edge Docker build independently.
It uses source-revision image tags as build artifacts only. The manual
`Zero One Publish` workflow is the sole registry publisher: it accepts a full
commit SHA from `zero-one/brand` plus the exact confirmation word `PUBLISH`,
requires a successful Zero One CI run and publishes immutable multi-architecture
GHCR images with SBOM and provenance attestations. It never publishes `latest`.
Production deployment records the resulting digests and uses them with
`--no-build`.

## Network Requirements

Caddy is the only public process. PostgreSQL, Redis and Sub2API have no host port mapping. Caddy removes common client-supplied CDN IP headers and rebuilds `X-Real-IP` and `X-Forwarded-For` from the direct socket peer; Sub2API trusts only this internal proxy boundary. Keep `forwarded_client_ip_headers` empty while the origin is DNS-only and directly reachable.

Caddy leaves streaming flush behavior at its automatic default, applies no proxy response compression, and does not cache API responses. Static React assets may use immutable caching. WebSocket upgrades and client cancellation pass through the normal Caddy reverse proxy transport.

v1 uses DNS-only records to avoid adding a CDN buffering layer. All listed domains point at the same edge host. The `.cc` domain is a hostname fallback only and cannot survive a server or database outage.

The edge image carries the Public Site and its third-party notice. The notice
lives in `landing/public/` and therefore enters Vite's `dist/` output before
the edge image copies that output into Caddy. This preserves the upstream root
`.dockerignore` boundary while meeting the React Bits attribution requirement.

## Application Settings

After first login, configure the existing administrator settings:

- `site_name`: `零一 API`
- `site_subtitle`: `从零到一，连接每一次模型调用。`
- `api_base_url`: `https://api.01yapi.com`
- `frontend_url`: `https://app.01yapi.com`
- `registration_enabled`: `true`
- `payment_enabled`: `false`
- `promo_code_enabled`: `false`
- `invitation_code_enabled`: `false`

Deployment must use `RUN_MODE=standard`; simple mode hides the user and administrator Redeem Code routes.

These values intentionally remain in the existing administrator settings rather
than changing Sub2API's database defaults. A new database therefore must not be
announced or exposed as production until an administrator saves every value
above and the public-settings release gate passes:

```bash
node deploy/zero-one/verify-public-settings.mjs https://api.01yapi.com/api/v1/settings/public
```

The public endpoint verifies every listed value except `frontend_url`, which is
administrator-only and must be checked on `/admin/settings` during release. The
gate requires Node.js 20 or newer on the release workstation; Node is not a
runtime dependency of the production containers.
