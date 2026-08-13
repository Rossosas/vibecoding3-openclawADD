// Helpers for Control UI custom OpenAI-compatible provider save/load.
// Mirrors applyCustomApiConfig shape so Gateway config.patch persists into openclaw.json.

export type SavedModelProvider = {
  providerId: string;
  baseUrl: string;
  modelId: string;
  modelName: string;
  hasApiKey: boolean;
  isPrimary: boolean;
};

export type ModelProviderDraft = {
  modelName: string;
  baseUrl: string;
  apiKey: string;
  setAsDefault: boolean;
  /** When editing an existing entry, keep that provider id. */
  providerId?: string;
};

const DEFAULT_CONTEXT_WINDOW = 128_000;
const DEFAULT_MAX_TOKENS = 8_192;

/** Builds a stable custom provider id from an endpoint URL host and port. */
export function buildProviderIdFromBaseUrl(baseUrl: string): string {
  try {
    const url = new URL(baseUrl.trim());
    const host = url.hostname.toLowerCase().replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
    const port = url.port ? `-${url.port}` : "";
    const candidate = `custom-${host}${port}`.replace(/-+/g, "-").replace(/^-+|-+$/g, "");
    return candidate || "custom";
  } catch {
    return "custom";
  }
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readProviders(config: Record<string, unknown> | null | undefined) {
  const models = config?.models;
  if (!models || typeof models !== "object" || Array.isArray(models)) {
    return {};
  }
  const providers = (models as { providers?: unknown }).providers;
  if (!providers || typeof providers !== "object" || Array.isArray(providers)) {
    return {};
  }
  return providers as Record<string, unknown>;
}

function readPrimaryModelRef(config: Record<string, unknown> | null | undefined): string {
  const agents = config?.agents;
  if (!agents || typeof agents !== "object" || Array.isArray(agents)) {
    return "";
  }
  const defaults = (agents as { defaults?: unknown }).defaults;
  if (!defaults || typeof defaults !== "object" || Array.isArray(defaults)) {
    return "";
  }
  const model = (defaults as { model?: unknown }).model;
  if (typeof model === "string") {
    return model.trim();
  }
  if (model && typeof model === "object" && !Array.isArray(model)) {
    return readString((model as { primary?: unknown }).primary);
  }
  return "";
}

function providerHasApiKey(provider: Record<string, unknown>): boolean {
  const apiKey = provider.apiKey;
  if (typeof apiKey === "string") {
    return apiKey.trim().length > 0;
  }
  return apiKey != null && typeof apiKey === "object";
}

/** Lists custom (and any) providers that declare baseUrl + at least one model. */
export function listSavedModelProviders(
  config: Record<string, unknown> | null | undefined,
): SavedModelProvider[] {
  const providers = readProviders(config);
  const primary = readPrimaryModelRef(config);
  const rows: SavedModelProvider[] = [];

  for (const [providerId, rawProvider] of Object.entries(providers)) {
    if (!rawProvider || typeof rawProvider !== "object" || Array.isArray(rawProvider)) {
      continue;
    }
    const provider = rawProvider as Record<string, unknown>;
    const baseUrl = readString(provider.baseUrl);
    const models = Array.isArray(provider.models) ? provider.models : [];
    if (!baseUrl || models.length === 0) {
      continue;
    }
    for (const rawModel of models) {
      if (!rawModel || typeof rawModel !== "object" || Array.isArray(rawModel)) {
        continue;
      }
      const model = rawModel as Record<string, unknown>;
      const modelId = readString(model.id);
      if (!modelId) {
        continue;
      }
      const modelRef = `${providerId}/${modelId}`;
      rows.push({
        providerId,
        baseUrl,
        modelId,
        modelName: readString(model.name) || modelId,
        hasApiKey: providerHasApiKey(provider),
        isPrimary: primary === modelRef,
      });
    }
  }

  rows.sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) {
      return a.isPrimary ? -1 : 1;
    }
    return `${a.providerId}/${a.modelId}`.localeCompare(`${b.providerId}/${b.modelId}`);
  });
  return rows;
}

export type ModelProviderPatchBuildResult =
  | { ok: true; providerId: string; modelRef: string; patch: Record<string, unknown> }
  | { ok: false; error: string };

/** Builds a config.patch payload for model_name + baseUrl (+ optional apiKey). */
export function buildModelProviderPatch(
  draft: ModelProviderDraft,
): ModelProviderPatchBuildResult {
  const modelName = draft.modelName.trim();
  const baseUrl = draft.baseUrl.trim();
  const apiKey = draft.apiKey.trim();

  if (!modelName) {
    return { ok: false, error: "Model name is required." };
  }
  if (!baseUrl) {
    return { ok: false, error: "Base URL is required." };
  }
  if (!URL.canParse(baseUrl)) {
    return { ok: false, error: "Base URL must be a valid URL." };
  }

  const providerId = (draft.providerId?.trim() || buildProviderIdFromBaseUrl(baseUrl)).replace(
    /[^a-zA-Z0-9._-]+/g,
    "-",
  );
  if (!providerId) {
    return { ok: false, error: "Could not derive a provider id from the base URL." };
  }

  const modelRef = `${providerId}/${modelName}`;
  const providerConfig: Record<string, unknown> = {
    baseUrl,
    api: "openai-completions",
    models: [
      {
        id: modelName,
        name: modelName,
        reasoning: false,
        input: ["text"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: DEFAULT_CONTEXT_WINDOW,
        maxTokens: DEFAULT_MAX_TOKENS,
      },
    ],
  };
  // Omit empty apiKey so merge-patch keeps an existing secret on edit.
  if (apiKey) {
    providerConfig.apiKey = apiKey;
  }

  const patch: Record<string, unknown> = {
    models: {
      mode: "merge",
      providers: {
        [providerId]: providerConfig,
      },
    },
  };

  if (draft.setAsDefault) {
    patch.agents = {
      defaults: {
        model: { primary: modelRef },
        models: { [modelRef]: {} },
      },
    };
  }

  return { ok: true, providerId, modelRef, patch };
}
