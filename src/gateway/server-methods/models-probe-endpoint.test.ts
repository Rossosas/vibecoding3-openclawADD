import { describe, expect, it, vi } from "vitest";
import {
  probeOpenAiCompatibleEndpoint,
  resolveProbeApiKey,
} from "./models-probe-endpoint.js";

describe("resolveProbeApiKey", () => {
  it("prefers a pasted API key", async () => {
    const resolved = await resolveProbeApiKey({
      apiKey: " pasted-key ",
      providerId: "custom",
      config: {
        models: {
          providers: {
            custom: { apiKey: "stored-key", baseUrl: "https://example.com/v1", models: [] },
          },
        },
      } as never,
    });
    expect(resolved).toEqual({ apiKey: "pasted-key" });
  });

  it("requires a key when no provider id is given", async () => {
    const resolved = await resolveProbeApiKey({
      apiKey: "  ",
      config: {} as never,
    });
    expect(resolved.apiKey).toBeUndefined();
    expect(resolved.error).toMatch(/API key is required/i);
  });

  it("reads a plaintext key from the named provider", async () => {
    const resolved = await resolveProbeApiKey({
      providerId: "custom-dashscope",
      config: {
        models: {
          providers: {
            "custom-dashscope": {
              apiKey: "stored-key",
              baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
              models: [],
            },
          },
        },
      } as never,
    });
    expect(resolved).toEqual({ apiKey: "stored-key" });
  });
});

describe("probeOpenAiCompatibleEndpoint", () => {
  it("returns ok for a JSON success response", async () => {
    const fetchFn = vi.fn(async () => {
      return new Response(JSON.stringify({ id: "chatcmpl-test" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchFn);
    try {
      const result = await probeOpenAiCompatibleEndpoint({
        baseUrl: "https://example.com/v1",
        modelId: "qwen3.5-plus",
        apiKey: "test-key",
      });
      expect(result.ok).toBe(true);
      expect(result.status).toBe(200);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(fetchFn).toHaveBeenCalledOnce();
      const [url, init] = fetchFn.mock.calls[0]!;
      expect(String(url)).toContain("/chat/completions");
      expect(init).toMatchObject({ method: "POST" });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("fails closed on non-JSON success bodies", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response("<html>dashboard</html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        });
      }),
    );
    try {
      const result = await probeOpenAiCompatibleEndpoint({
        baseUrl: "https://example.com",
        modelId: "qwen3.5-plus",
        apiKey: "test-key",
      });
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/instead of JSON/i);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
