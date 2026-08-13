// Models gateway methods expose model catalog browse results without triggering
// auth probes or fresh provider discovery on each request.
import {
  ErrorCodes,
  errorShape,
  formatValidationErrors,
  validateModelsListParams,
  validateModelsProbeEndpointParams,
} from "../../../packages/gateway-protocol/src/index.js";
import { buildModelsListResult } from "./models-list-result.js";
import {
  probeOpenAiCompatibleEndpoint,
  resolveProbeApiKey,
} from "./models-probe-endpoint.js";
import type { GatewayRequestHandlers } from "./types.js";

export { buildModelsListResult };

// The gateway model list is a browse API, not an auth probe. It reuses the
// current runtime catalog snapshot and applies visibility rules without doing
// extra runtime discovery on each request.
export const modelsHandlers: GatewayRequestHandlers = {
  "models.list": async ({ params, respond, context }) => {
    if (!validateModelsListParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid models.list params: ${formatValidationErrors(validateModelsListParams.errors)}`,
        ),
      );
      return;
    }
    try {
      respond(true, await buildModelsListResult({ context, params }), undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },
  "models.probeEndpoint": async ({ params, respond, context }) => {
    if (!validateModelsProbeEndpointParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid models.probeEndpoint params: ${formatValidationErrors(validateModelsProbeEndpointParams.errors)}`,
        ),
      );
      return;
    }
    try {
      const resolved = await resolveProbeApiKey({
        apiKey: params.apiKey,
        providerId: params.providerId,
        config: context.getRuntimeConfig(),
      });
      if (!resolved.apiKey) {
        respond(true, {
          ok: false,
          latencyMs: 0,
          error: resolved.error ?? "API key is required.",
        });
        return;
      }
      respond(
        true,
        await probeOpenAiCompatibleEndpoint({
          baseUrl: params.baseUrl,
          modelId: params.modelId,
          apiKey: resolved.apiKey,
        }),
        undefined,
      );
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },
};
