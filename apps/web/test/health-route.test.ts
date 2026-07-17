import { beforeEach, describe, expect, it, vi } from "vitest";

const { loadAppConfig, readDatabaseStatus } = vi.hoisted(() => ({
  loadAppConfig: vi.fn(),
  readDatabaseStatus: vi.fn(),
}));

vi.mock("@xuanshu/agent", () => ({ loadAppConfig }));
vi.mock("@/server/db", () => ({ readDatabaseStatus }));

import { GET } from "../src/app/api/health/route";

const modelConfig = {
  source: "defaults" as const,
  config: {
    provider: {
      api_key_env: "XUANSHU_AI_API_KEY",
    },
  },
};

describe("health route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.XUANSHU_AI_API_KEY;
    loadAppConfig.mockResolvedValue(modelConfig);
  });

  it("reports an initialized local service as ready", async () => {
    process.env.XUANSHU_AI_API_KEY = "test-key";
    readDatabaseStatus.mockResolvedValue({ initialized: true });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toMatchObject({
      service: "xuanshu-ai",
      status: "ok",
      database: { initialized: true },
      model: { configSource: "defaults", configured: true },
    });
  });

  it("keeps model configuration optional for local deterministic features", async () => {
    readDatabaseStatus.mockResolvedValue({ initialized: true });

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "ok",
      model: { configured: false },
    });
  });

  it("reports a missing database as degraded", async () => {
    readDatabaseStatus.mockResolvedValue({ initialized: false });

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "degraded",
      database: { initialized: false },
    });
  });

  it("returns 503 without leaking internal errors", async () => {
    readDatabaseStatus.mockRejectedValue(new Error("private database path"));

    const response = await GET();

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      service: "xuanshu-ai",
      status: "error",
      version: "0.1.0",
    });
  });
});
