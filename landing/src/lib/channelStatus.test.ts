import { describe, expect, it, vi } from "vitest";
import {
  fetchChannelStatus,
  parseChannelStatusResponse,
} from "./channelStatus";

describe("channel status summary", () => {
  it("strictly accepts only the anonymous aggregate contract", () => {
    expect(
      parseChannelStatusResponse({
        code: 0,
        data: {
          mode: "active_probe",
          state: "operational",
          reason: null,
          latency_ms: 218,
          availability_7d: 99.98,
          observed_at: "2026-08-16T08:25:00Z",
        },
      }),
    ).toEqual({
      mode: "active_probe",
      state: "operational",
      reason: null,
      latencyMs: 218,
      availability7d: 99.98,
      observedAt: "2026-08-16T08:25:00Z",
      items: [],
    });

    expect(
      parseChannelStatusResponse({
        code: 0,
        data: {
          mode: "active_probe",
          state: "operational",
          latency_ms: 218,
          availability_7d: 101,
          observed_at: null,
        },
      }),
    ).toBeNull();
  });

  it("requests the same-origin public summary without credentials", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        code: 0,
        data: {
          mode: "active_probe",
          state: "unknown",
          reason: "no_monitors",
          latency_ms: null,
          availability_7d: null,
          observed_at: null,
        },
      }),
    );

    await expect(fetchChannelStatus({ request })).resolves.toMatchObject({
      status: "success",
    });
    expect(request).toHaveBeenCalledWith(
      "/api/v1/channel-status/summary",
      expect.objectContaining({
        cache: "no-store",
        credentials: "omit",
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("does not convert malformed or unavailable data into a healthy state", async () => {
    const badResponse = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("{}", { status: 200 }));
    await expect(fetchChannelStatus({ request: badResponse })).resolves.toEqual(
      {
        status: "error",
        reason: "invalid-response",
      },
    );

    const unavailable = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 503 }));
    await expect(fetchChannelStatus({ request: unavailable })).resolves.toEqual(
      {
        status: "error",
        reason: "server",
        httpStatus: 503,
      },
    );
  });
});
