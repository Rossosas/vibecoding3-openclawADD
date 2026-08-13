/**
 * Live OpenAI-compatible endpoint probe for Control UI model setup.
 * Runs server-side so browser CORS cannot block DashScope and similar hosts.
 */
import type { ModelsProbeEndpointResult } from "../../../packages/gateway-protocol/src/index.js";
import { buildOpenAiVerificationProbeRequest } from "../../commands/onboard-custom-config.js";
import type { OpenClawConfig } from "../../config/types.openclaw.js";
import { fetchWithTimeout } from "../../utils/fetch-timeout.js";
import { resolveConfiguredSecretInputString } from "../resolve-configured-secret-input-string.js";

const PROBE_TIMEOUT_MS = 30_000;

function isJsonVerificationResponse(res: Response): boolean {
  const contentType =
    typeof res.headers?.get === "function" ? (res.headers.get("content-type") ?? "") : "";
  if (!contentType.trim()) {
    return true;
  }
  const mediaType = contentType.split(";", 1)[0]?.trim().toLowerCase();
  return (
    mediaType === "application/json" || (mediaType !== undefined && mediaType.endsWith("+json"))
  );
}

export async function resolveProbeApiKey(params: {
  apiKey?: string;
  providerId?: string;
  config: OpenClawConfig;
}): Promise<{ apiKey?: string; error?: string }> {
  const pasted = params.apiKey?.trim() ?? "";
  if (pasted) {
    return { apiKey: pasted };
  }
  const providerId = params.providerId?.trim() ?? "";
  if (!providerId) {
    return {
      error: "API key is required to test the connection (or edit a saved provider that already has one).",
    };
  }
  const provider = params.config.models?.providers?.[providerId];
  if (!provider) {
    return {
      error: `Provider "${providerId}" was not found in gateway config. Paste an API key or save the provider first.`,
    };
  }
  const resolved = await resolveConfiguredSecretInputString({
    config: params.config,
    env: process.env,
    value: provider.apiKey,
    path: `models.providers.${providerId}.apiKey`,
  });
  if (resolved.value) {
    return { apiKey: resolved.value };
  }
  if (resolved.unresolvedRefReason) {
    return {
      error: `${resolved.unresolvedRefReason} Paste an API key to test without resolving the SecretRef.`,
    };
  }
  return {
    error: `Provider "${providerId}" has no API key configured. Paste one to test the connection.`,
  };
}

/** Posts a minimal chat/completions (or Azure responses) probe and returns latency. */
export async function probeOpenAiCompatibleEndpoint(params: {
  baseUrl: string;
  modelId: string;
  apiKey: string;
}): Promise<ModelsProbeEndpointResult> {
  const started = Date.now();
  const request = buildOpenAiVerificationProbeRequest({
    baseUrl: params.baseUrl.trim(),
    apiKey: params.apiKey,
    modelId: params.modelId.trim(),
  });
  let res: Response | undefined;
  try {
    res = await fetchWithTimeout(
      request.endpoint,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...request.headers,
        },
        body: JSON.stringify(request.body),
      },
      PROBE_TIMEOUT_MS,
    );
    const latencyMs = Math.max(0, Date.now() - started);
    if (res.ok && !isJsonVerificationResponse(res)) {
      const contentType = res.headers.get("content-type") || "missing content-type";
      return {
        ok: false,
        latencyMs,
        status: res.status,
        error: `Verification returned ${contentType} instead of JSON. Check the provider base URL; OpenAI-compatible endpoints usually need a /v1 path prefix.`,
      };
    }
    if (res.ok) {
      return { ok: true, latencyMs, status: res.status };
    }
    return {
      ok: false,
      latencyMs,
      status: res.status,
      error: `HTTP ${res.status}`,
    };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Math.max(0, Date.now() - started),
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await res?.body?.cancel().catch(() => undefined);
  }
}
