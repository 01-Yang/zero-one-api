import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ChannelStatusResult } from "../lib/channelStatus";
import { StatusSection } from "./ContentSections";

const mocks = vi.hoisted(() => ({
  fetchChannelStatus: vi.fn(),
}));

vi.mock("../lib/channelStatus", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../lib/channelStatus")>();
  return { ...original, fetchChannelStatus: mocks.fetchChannelStatus };
});

const success = (
  overrides: Partial<ChannelStatusResult & { data: object }> = {},
): ChannelStatusResult => ({
  status: "success",
  data: {
    mode: "active_probe",
    state: "operational",
    reason: null,
    latencyMs: 218,
    availability7d: 99.98,
    observedAt: "2026-08-16T08:25:00Z",
    ...(overrides.status === "success" ? overrides.data : {}),
  },
});

describe("StatusSection", () => {
  beforeEach(() => mocks.fetchChannelStatus.mockReset());
  afterEach(cleanup);

  it("shows loading until the real channel summary resolves", async () => {
    let resolveRequest: (value: ChannelStatusResult) => void = () => {};
    mocks.fetchChannelStatus.mockReturnValue(
      new Promise<ChannelStatusResult>((resolve) => {
        resolveRequest = resolve;
      }),
    );

    render(<StatusSection />);
    expect(screen.getByText("正在读取当前真实渠道监控汇总。")).toBeTruthy();
    expect(
      screen.getByLabelText("渠道状态汇总").getAttribute("aria-busy"),
    ).toBe("true");

    await act(async () => resolveRequest(success()));
    expect(await screen.findByText("正常")).toBeTruthy();
    expect(screen.getByText("218 ms")).toBeTruthy();
    expect(screen.getByText("99.98%")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "查看全部渠道" }).getAttribute("href"),
    ).toBe("http://127.0.0.1:8080/monitor");
    expect(mocks.fetchChannelStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
        timeoutMs: 3_000,
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("does not render an operational state when no monitoring data exists", async () => {
    mocks.fetchChannelStatus.mockResolvedValue(
      success({
        status: "success",
        data: {
          state: "unknown",
          mode: "active_probe",
          reason: "no_monitors",
          latencyMs: null,
          availability7d: null,
          observedAt: null,
        },
      }),
    );
    render(<StatusSection />);

    expect(await screen.findByText("暂无监控数据")).toBeTruthy();
    expect(screen.getAllByText("—")).toHaveLength(2);
    expect(
      screen.getByText("管理员尚未配置可公开展示的监控渠道。"),
    ).toBeTruthy();
    expect(screen.queryByText("正常")).toBeNull();
  });

  it("retries without retaining a failed or illustrative status", async () => {
    const user = userEvent.setup();
    mocks.fetchChannelStatus
      .mockResolvedValueOnce({ status: "error", reason: "timeout" })
      .mockResolvedValueOnce(
        success({
          status: "success",
          data: {
            state: "degraded",
            mode: "active_probe",
            reason: null,
            latencyMs: 650,
            availability7d: 97.2,
            observedAt: "2026-08-16T08:25:00Z",
          },
        }),
      );

    render(<StatusSection />);
    expect(
      await screen.findByText("读取超时，页面没有显示缓存或示例状态。"),
    ).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "重新读取" }));
    expect(await screen.findByText("降级")).toBeTruthy();
    expect(screen.getByText("650 ms")).toBeTruthy();
    expect(mocks.fetchChannelStatus).toHaveBeenCalledTimes(2);
    expect(mocks.fetchChannelStatus.mock.calls[0]?.[0]?.signal).not.toBe(
      mocks.fetchChannelStatus.mock.calls[1]?.[0]?.signal,
    );
  });

  it("does not request a summary when the channel-status capability is off", () => {
    render(<StatusSection enabled={false} />);
    expect(screen.getByText("当前站点未公开渠道状态汇总。")).toBeTruthy();
    expect(mocks.fetchChannelStatus).not.toHaveBeenCalled();
  });

  it("keeps passive traffic metrics distinct from active probe metrics", async () => {
    mocks.fetchChannelStatus.mockResolvedValue(
      success({
        status: "success",
        data: {
          mode: "traffic",
          state: "operational",
          reason: null,
          latencyMs: 240,
          availability7d: null,
          observedAt: "2026-08-16T08:25:00Z",
        },
      }),
    );
    render(<StatusSection />);

    expect(await screen.findByText("TTFT P50")).toBeTruthy();
    expect(screen.getByText("主动探测可用性")).toBeTruthy();
    expect(screen.getByText("不适用")).toBeTruthy();
    expect(screen.getByText(/不以流量数据替代主动探测可用性/)).toBeTruthy();
    expect(screen.queryByText("平均延迟")).toBeNull();
  });
});
