import { describe, expect, it } from "vitest";
import {
  buildModelProviderPatch,
  buildProviderIdFromBaseUrl,
  listSavedModelProviders,
} from "./model-config.ts";

describe("buildProviderIdFromBaseUrl", () => {
  it("derives a stable id from the host", () => {
    expect(buildProviderIdFromBaseUrl("https://dashscope.aliyuncs.com/compatible-mode/v1")).toBe(
      "custom-dashscope-aliyuncs-com",
    );
  });

  it("falls back for invalid urls", () => {
    expect(buildProviderIdFromBaseUrl("not-a-url")).toBe("custom");
  });
});

describe("listSavedModelProviders", () => {
  it("reads providers with baseUrl and models, marking the primary", () => {
    const rows = listSavedModelProviders({
      models: {
        providers: {
          qwen: {
            baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
            apiKey: "***",
            models: [{ id: "qwen3.5-plus", name: "Qwen 3.5 Plus" }],
          },
          empty: { baseUrl: "https://example.com" },
        },
      },
      agents: {
        defaults: {
          model: { primary: "qwen/qwen3.5-plus" },
        },
      },
    });
    expect(rows).toEqual([
      {
        providerId: "qwen",
        baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
        modelId: "qwen3.5-plus",
        modelName: "Qwen 3.5 Plus",
        hasApiKey: true,
        isPrimary: true,
      },
    ]);
  });
});

describe("buildModelProviderPatch", () => {
  it("requires model name and valid base url", () => {
    expect(buildModelProviderPatch({ modelName: "", baseUrl: "https://x", apiKey: "", setAsDefault: true }).ok).toBe(
      false,
    );
    expect(
      buildModelProviderPatch({
        modelName: "qwen3.5-plus",
        baseUrl: "bad",
        apiKey: "",
        setAsDefault: true,
      }).ok,
    ).toBe(false);
  });

  it("builds an openai-compatible provider patch and optional default model", () => {
    const result = buildModelProviderPatch({
      modelName: "qwen3.5-plus",
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      apiKey: "sk-test",
      setAsDefault: true,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.providerId).toBe("custom-dashscope-aliyuncs-com");
    expect(result.modelRef).toBe("custom-dashscope-aliyuncs-com/qwen3.5-plus");
    expect(result.patch).toMatchObject({
      models: {
        mode: "merge",
        providers: {
          "custom-dashscope-aliyuncs-com": {
            baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
            api: "openai-completions",
            apiKey: "sk-test",
            models: [{ id: "qwen3.5-plus", name: "qwen3.5-plus" }],
          },
        },
      },
      agents: {
        defaults: {
          model: { primary: "custom-dashscope-aliyuncs-com/qwen3.5-plus" },
        },
      },
    });
  });

  it("omits apiKey when blank so merge-patch keeps existing secrets", () => {
    const result = buildModelProviderPatch({
      modelName: "qwen3.5-plus",
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      apiKey: "  ",
      setAsDefault: false,
      providerId: "qwen",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const provider = (
      result.patch.models as { providers: Record<string, Record<string, unknown>> }
    ).providers.qwen;
    expect(provider.apiKey).toBeUndefined();
    expect(result.patch.agents).toBeUndefined();
  });
});
