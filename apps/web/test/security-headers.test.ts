import { describe, expect, it } from "vitest";
import nextConfig from "../next.config";

describe("security headers", () => {
  it("defines same-origin browser safety headers for every route", async () => {
    const headers = await nextConfig.headers?.();
    expect(headers).toEqual([
      expect.objectContaining({
        source: "/(.*)",
        headers: expect.arrayContaining([
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
        ]),
      }),
    ]);
  });
});
