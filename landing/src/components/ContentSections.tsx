import { Activity, ArrowRight, RefreshCw, ReceiptText } from "lucide-react";
import { useEffect, useState } from "react";
import {
  fetchChannelStatus,
  type ChannelStatusResult,
  type ChannelStatusSummary,
} from "../lib/channelStatus";
import { consoleUrl, documentUrl } from "../siteConfig";
import Action from "./Action";

interface ValuePricingSectionProps {
  modelPlazaEnabled: boolean;
}

export function ValuePricingSection({
  modelPlazaEnabled,
}: ValuePricingSectionProps) {
  const priceSummary = modelPlazaEnabled
    ? "以模型广场和调用记录为准。"
    : "实际结算请以登录后的调用记录为准。";

  return (
    <section
      id="billing"
      className="value-pricing-section"
      aria-labelledby="value-pricing-title"
    >
      <div className="value-pricing-main section-layer">
        <div className="value-pricing-copy" data-reveal>
          <p className="value-pricing-kicker">按量计费</p>
          <h2 id="value-pricing-title">
            <span>每一份 token</span>
            <span>按实际配置结算</span>
          </h2>
          <p>
            输入、输出、缓存、按次与图片项目，均以模型和分组的实际配置为准。
          </p>
        </div>

        <div className="value-pricing-card" data-reveal data-reveal-delay="100">
          <p className="value-pricing-badge">
            <ReceiptText aria-hidden="true" />
            价格说明 · 实际配置为准
          </p>
          <div className="value-pricing-summary">
            <div>
              <h3>价格清晰可查</h3>
              <p>{priceSummary}</p>
            </div>
            <button
              className="info-tip"
              type="button"
              aria-label="显示计费说明"
              aria-describedby="billing-pricing-tooltip"
            >
              ?
              <span id="billing-pricing-tooltip" role="tooltip">
                最终费用以实际模型、分组、倍率和调用记录为准。
              </span>
            </button>
          </div>
          <p className="value-pricing-detail">Token · 按次 · 图片等计费方式</p>
          <div className="value-pricing-action">
            <Action
              className="button-primary"
              href={consoleUrl("/redeem")}
              size="md"
              radius={16}
            >
              兑换额度
              <ArrowRight aria-hidden="true" />
            </Action>
          </div>
        </div>
      </div>
    </section>
  );
}

type ChannelStatusViewState = { status: "loading" } | ChannelStatusResult;

function statusLabel(summary: ChannelStatusSummary | null): string {
  if (!summary) return "—";
  if (summary.state === "operational") return "正常";
  if (summary.state === "degraded") return "降级";
  if (summary.reason === "no_monitors") return "暂无监控数据";
  if (summary.reason === "disabled") return "监控未开启";
  return "正在收集数据";
}

function statusNote(state: ChannelStatusViewState): string {
  if (state.status === "loading") return "正在读取当前真实渠道监控汇总。";
  if (state.status === "success") {
    if (state.data.mode === "traffic") {
      return "当前为被动流量监控：展示健康状态与 TTFT P50，不以流量数据替代主动探测可用性。";
    }
    if (state.data.reason === "no_monitors")
      return "管理员尚未配置可公开展示的监控渠道。";
    if (state.data.reason === "insufficient_data")
      return "监控已配置，正在等待足够的真实检测数据。";
    if (state.data.reason === "disabled") return "当前站点未开启渠道监控。";
    return "数据与控制台的渠道监控使用同一套后端来源。";
  }
  if (state.status === "rate-limited") {
    return state.retryAfter
      ? `读取过于频繁，请在约 ${state.retryAfter} 秒后重试。`
      : "读取过于频繁，请稍后重试。";
  }
  if (state.status === "not-enabled" || state.status === "disabled")
    return "当前站点未公开渠道状态汇总。";
  if (state.status === "error" && state.reason === "timeout")
    return "读取超时，页面没有显示缓存或示例状态。";
  return "暂时无法读取真实渠道状态，页面没有显示缓存或示例状态。";
}

function formatMetric(
  value: number | null,
  suffix: string,
  fractionDigits = 0,
): string {
  if (value === null) return "—";
  return `${new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value)}${suffix}`;
}

function formatAvailability(summary: ChannelStatusSummary | null): string {
  if (summary?.mode === "traffic") return "不适用";
  return formatMetric(summary?.availability7d ?? null, "%", 2);
}

function formatObservedAt(value: string | null): string {
  if (!value) return "";
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return "";
  return `监控数据截至 ${new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(time))}`;
}

export function StatusSection({ enabled = true }: { enabled?: boolean }) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<ChannelStatusViewState>(() =>
    enabled ? { status: "loading" } : { status: "disabled" },
  );

  useEffect(() => {
    if (!enabled) {
      setState({ status: "disabled" });
      return;
    }
    const controller = new AbortController();
    setState({ status: "loading" });
    void fetchChannelStatus({
      enabled: true,
      timeoutMs: 3_000,
      signal: controller.signal,
    }).then((result) => {
      if (!controller.signal.aborted) setState(result);
    });
    return () => controller.abort();
  }, [attempt, enabled]);

  const summary = state.status === "success" ? state.data : null;
  const shouldRetry =
    state.status === "error" || state.status === "rate-limited";
  const observedAt = summary ? formatObservedAt(summary.observedAt) : "";
  const trafficMode = summary?.mode === "traffic";

  return (
    <section
      id="status"
      className="section status-section"
      aria-labelledby="status-title"
    >
      <div className="status-heading section-layer" data-reveal>
        <div className="section-heading section-heading-wide">
          <p className="eyebrow">渠道状态</p>
          <h2 id="status-title">真实汇总，持续呈现渠道健康状态</h2>
          <p>
            首页直接读取与控制台同源的匿名汇总，只展示渠道健康状态与口径明确的指标。
          </p>
        </div>
      </div>
      <div
        className="status-content section-layer"
        data-reveal
        data-reveal-delay="100"
      >
        <div className="status-summary">
          <div
            className="status-meta"
            aria-label="渠道状态汇总"
            aria-busy={state.status === "loading"}
            aria-live="polite"
          >
            <span>
              <Activity aria-hidden="true" />{" "}
              {trafficMode ? "渠道健康状态" : "最近检测状态"}
            </span>
            <strong className={`status-value--${summary?.state ?? "unknown"}`}>
              {statusLabel(summary)}
            </strong>
            <span>{trafficMode ? "TTFT P50" : "平均延迟"}</span>
            <strong>{formatMetric(summary?.latencyMs ?? null, " ms")}</strong>
            <span>{trafficMode ? "主动探测可用性" : "近 7 天可用性"}</span>
            <strong>{formatAvailability(summary)}</strong>
          </div>
          <p className="status-note" role="status">
            {statusNote(state)}
            {observedAt ? ` ${observedAt}。` : ""}
          </p>
        </div>
        <div className="status-actions">
          {shouldRetry ? (
            <Action
              className="button-secondary"
              type="button"
              size="lg"
              radius={16}
              onClick={() => setAttempt((value) => value + 1)}
            >
              <RefreshCw aria-hidden="true" />
              重新读取
            </Action>
          ) : null}
          <Action
            className="button-secondary"
            href={consoleUrl("/monitor")}
            size="lg"
            radius={16}
          >
            查看全部渠道
            <ArrowRight aria-hidden="true" />
          </Action>
        </div>
      </div>
    </section>
  );
}

interface FooterProps {
  siteName: string;
  siteLogo: string;
  subtitle: string;
  docUrl: string;
  modelPlazaEnabled: boolean;
  channelMonitorEnabled: boolean;
}

export function SiteFooter({
  siteName,
  siteLogo,
  subtitle,
  docUrl,
  modelPlazaEnabled,
  channelMonitorEnabled,
}: FooterProps) {
  return (
    <footer className="site-footer">
      <div className="footer-brand">
        <div className="footer-brand-lockup">
          {siteLogo ? (
            <img
              className="footer-brand-logo"
              src={siteLogo}
              alt=""
              aria-hidden="true"
              decoding="async"
              loading="lazy"
            />
          ) : null}
          <strong>{siteName}</strong>
        </div>
        <p>{subtitle}</p>
        <span>
          © {new Date().getFullYear()} {siteName}
        </span>
      </div>
      <div className="footer-column">
        <strong>产品</strong>
        {modelPlazaEnabled ? (
          <a href={consoleUrl("/model-plaza")}>模型广场</a>
        ) : null}
        <a href={consoleUrl("/keys")}>API 密钥</a>
        <a href={consoleUrl("/usage")}>使用记录</a>
        <a href={consoleUrl("/redeem")}>兑换中心</a>
      </div>
      <div className="footer-column">
        <strong>资源</strong>
        {docUrl ? <a href={documentUrl(docUrl)}>文档</a> : null}
        {channelMonitorEnabled ? (
          <a href={consoleUrl("/monitor")}>渠道状态</a>
        ) : null}
        <a href="#api-endpoint">API 地址</a>
        <a
          href="/_landing/THIRD_PARTY_NOTICES.txt"
          target="_blank"
          rel="noreferrer"
        >
          第三方许可
        </a>
      </div>
      <div className="footer-column">
        <strong>账户</strong>
        <a href={consoleUrl("/login")}>登录</a>
        <a href={consoleUrl("/dashboard")}>控制台</a>
        <a href={consoleUrl("/keys")}>配置密钥</a>
      </div>
    </footer>
  );
}
