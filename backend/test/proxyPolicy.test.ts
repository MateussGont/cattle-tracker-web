import { describe, expect, it, vi } from "vitest";

const config = vi.hoisted(() => ({
  NODE_ENV: "production", TRUST_PROXY_HOPS: 0, CORS_ORIGIN: "https://cattletracker.tech",
  JWT_SECRET: "test-only-secret-which-is-at-least-32-characters", JWT_EXPIRES_IN: "8h",
}));
vi.mock("../src/config/env.js", () => ({ env: config }));
vi.mock("../src/db/client.js", () => ({ db: {} }));
import { buildApp } from "../src/app.js";

describe("trusted reverse proxy", () => {
  for (const hops of [0, 1]) {
    it(`trusts exactly ${hops} proxy hops`, async () => {
      config.TRUST_PROXY_HOPS = hops;
      const app = await buildApp();
      app.get("/proxy-test", request => ({ ip: request.ip }));
      try {
        const response = await app.inject({
          method: "GET", url: "/proxy-test", remoteAddress: "10.0.0.2",
          headers: { "x-forwarded-for": "198.51.100.1, 203.0.113.9" },
        });
        expect(response.json().ip).toBe(hops === 0 ? "10.0.0.2" : "203.0.113.9");
      } finally { await app.close(); }
    });
  }
});
