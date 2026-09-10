// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest, ApiError, AUTH_EXPIRED_EVENT, setAuthToken } from "./client";

function mockFetchOnce(response: { ok: boolean; status: number; json?: unknown; contentType?: string }) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status,
    statusText: "error",
    headers: { get: () => response.contentType ?? "application/json" },
    json: async () => response.json,
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("apiRequest", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    setAuthToken(null);
  });

  it("attaches the bearer token when one is set", async () => {
    setAuthToken("token-123");
    const fetchMock = mockFetchOnce({ ok: true, status: 200, json: { ok: true } });

    await apiRequest("/api/animals");

    const [, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer token-123");
  });

  it("serializes defined query params and skips undefined ones", async () => {
    const fetchMock = mockFetchOnce({ ok: true, status: 200, json: [] });

    await apiRequest("/api/animals", { query: { status: "active", search: undefined, limit: 10 } });

    const [url] = fetchMock.mock.calls[0] as [URL];
    expect(url.searchParams.get("status")).toBe("active");
    expect(url.searchParams.has("search")).toBe(false);
    expect(url.searchParams.get("limit")).toBe("10");
  });

  it("throws ApiError with the server message on a non-ok response", async () => {
    mockFetchOnce({ ok: false, status: 401, json: { error: "unauthorized", message: "Token inválido." } });

    await expect(apiRequest("/api/animals")).rejects.toMatchObject(
      new ApiError(401, "Token inválido."),
    );
  });

  it("returns undefined for a 204 No Content response", async () => {
    mockFetchOnce({ ok: true, status: 204 });

    await expect(apiRequest("/api/alerts/1")).resolves.toBeUndefined();
  });

  it("clears the token and dispatches AUTH_EXPIRED_EVENT on a 401 while authenticated", async () => {
    setAuthToken("token-123");
    mockFetchOnce({ ok: false, status: 401, json: { error: "unauthorized", message: "Token expirado." } });

    const listener = vi.fn();
    window.addEventListener(AUTH_EXPIRED_EVENT, listener);

    await expect(apiRequest("/api/animals")).rejects.toThrow();

    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(AUTH_EXPIRED_EVENT, listener);
  });

  it("does not dispatch AUTH_EXPIRED_EVENT on a 401 when no token was set (e.g. failed login)", async () => {
    mockFetchOnce({ ok: false, status: 401, json: { error: "unauthorized", message: "Credenciais inválidas." } });

    const listener = vi.fn();
    window.addEventListener(AUTH_EXPIRED_EVENT, listener);

    await expect(apiRequest("/api/auth/login")).rejects.toThrow();

    expect(listener).not.toHaveBeenCalled();
    window.removeEventListener(AUTH_EXPIRED_EVENT, listener);
  });
});
