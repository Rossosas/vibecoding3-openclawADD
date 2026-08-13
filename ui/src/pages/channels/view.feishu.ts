// Feishu/Lark channel card: connection + common policy fields bound to channels.feishu.*.
import { html, nothing } from "lit";
import { REDACTED_PLACEHOLDER } from "../../components/config-form.shared.ts";
import { t } from "../../i18n/index.ts";
import { resolveChannelConfigValue } from "../../lib/channels/index.ts";
import { formatRelativeTimestamp } from "../../lib/format.ts";
import {
  formatNullableBoolean,
  renderSingleAccountChannelCard,
  resolveChannelConfigured,
} from "./view.shared.ts";
import type { ChannelsProps } from "./view.types.ts";

const FEISHU_PATH = ["channels", "feishu"] as const;

type FeishuStatus = {
  configured?: boolean;
  running?: boolean;
  connected?: boolean;
  lastError?: string;
  lastStartAt?: number | null;
  lastProbeAt?: number | null;
  probe?: { ok?: boolean; status?: string | number; error?: string };
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function isRedactedSecret(value: unknown): boolean {
  return (
    typeof value === "string" &&
    (value === REDACTED_PLACEHOLDER || value.toLowerCase().includes("[redacted"))
  );
}

function displaySecret(value: unknown): string {
  if (isRedactedSecret(value) || value == null) {
    return "";
  }
  return typeof value === "string" ? value : "";
}

function formatAllowFrom(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map(String).filter((entry) => entry.trim().length > 0).join(", ");
  }
  return asString(value);
}

function parseAllowFrom(raw: string): string[] {
  return raw
    .split(/[,;\n]+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function patchFeishu(
  props: ChannelsProps,
  field: string,
  value: unknown,
) {
  props.onConfigPatch([...FEISHU_PATH, field], value);
}

function patchSecret(props: ChannelsProps, field: string, raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) {
    return;
  }
  patchFeishu(props, field, trimmed);
}

function renderFeishuConfigForm(props: ChannelsProps) {
  const feishu = resolveChannelConfigValue(props.configForm, "feishu") ?? {};
  const disabled = props.configSaving || props.configSchemaLoading;
  const connectionMode = asString(feishu.connectionMode, "websocket") || "websocket";
  const isWebhook = connectionMode === "webhook";
  const domain = asString(feishu.domain, "feishu") || "feishu";
  const dmPolicy = asString(feishu.dmPolicy, "pairing") || "pairing";
  const groupPolicy = asString(feishu.groupPolicy, "allowlist") || "allowlist";
  const enabled = feishu.enabled !== false;
  const secretHint = "Leave blank to keep the current secret";

  return html`
    <div class="form-grid" style="margin-top: 16px;">
      <label class="field checkbox">
        <input
          type="checkbox"
          .checked=${enabled}
          ?disabled=${disabled}
          @change=${(event: Event) =>
            patchFeishu(props, "enabled", (event.target as HTMLInputElement).checked)}
        />
        <span>Enabled</span>
      </label>

      <label class="field">
        <span>App ID</span>
        <input
          type="text"
          autocomplete="off"
          .value=${asString(feishu.appId)}
          placeholder="cli_xxx"
          ?disabled=${disabled}
          @input=${(event: Event) =>
            patchFeishu(props, "appId", (event.target as HTMLInputElement).value.trim())}
        />
      </label>

      <label class="field">
        <span>App Secret</span>
        <input
          type="password"
          autocomplete="off"
          .value=${displaySecret(feishu.appSecret)}
          placeholder=${isRedactedSecret(feishu.appSecret) ? secretHint : "App Secret"}
          ?disabled=${disabled}
          @input=${(event: Event) =>
            patchSecret(props, "appSecret", (event.target as HTMLInputElement).value)}
        />
      </label>

      <label class="field">
        <span>Domain</span>
        <select
          .value=${domain}
          ?disabled=${disabled}
          @change=${(event: Event) =>
            patchFeishu(props, "domain", (event.target as HTMLSelectElement).value)}
        >
          <option value="feishu">feishu (open.feishu.cn)</option>
          <option value="lark">lark (open.larksuite.com)</option>
        </select>
      </label>

      <label class="field">
        <span>Connection mode</span>
        <select
          .value=${connectionMode}
          ?disabled=${disabled}
          @change=${(event: Event) =>
            patchFeishu(props, "connectionMode", (event.target as HTMLSelectElement).value)}
        >
          <option value="websocket">websocket (default)</option>
          <option value="webhook">webhook</option>
        </select>
      </label>

      ${isWebhook
        ? html`
            <label class="field">
              <span>Verification Token</span>
              <input
                type="password"
                autocomplete="off"
                .value=${displaySecret(feishu.verificationToken)}
                placeholder=${isRedactedSecret(feishu.verificationToken)
                  ? secretHint
                  : "Required for webhook"}
                ?disabled=${disabled}
                @input=${(event: Event) =>
                  patchSecret(props, "verificationToken", (event.target as HTMLInputElement).value)}
              />
            </label>
            <label class="field">
              <span>Encrypt Key</span>
              <input
                type="password"
                autocomplete="off"
                .value=${displaySecret(feishu.encryptKey)}
                placeholder=${isRedactedSecret(feishu.encryptKey)
                  ? secretHint
                  : "Required for webhook"}
                ?disabled=${disabled}
                @input=${(event: Event) =>
                  patchSecret(props, "encryptKey", (event.target as HTMLInputElement).value)}
              />
            </label>
          `
        : nothing}

      <label class="field">
        <span>DM policy</span>
        <select
          .value=${dmPolicy}
          ?disabled=${disabled}
          @change=${(event: Event) =>
            patchFeishu(props, "dmPolicy", (event.target as HTMLSelectElement).value)}
        >
          <option value="pairing">pairing</option>
          <option value="allowlist">allowlist</option>
          <option value="open">open</option>
        </select>
      </label>

      <label class="field">
        <span>Group policy</span>
        <select
          .value=${groupPolicy}
          ?disabled=${disabled}
          @change=${(event: Event) =>
            patchFeishu(props, "groupPolicy", (event.target as HTMLSelectElement).value)}
        >
          <option value="allowlist">allowlist</option>
          <option value="open">open</option>
          <option value="disabled">disabled</option>
        </select>
      </label>

      <label class="field">
        <span>DM allowFrom</span>
        <input
          type="text"
          autocomplete="off"
          .value=${formatAllowFrom(feishu.allowFrom)}
          placeholder="ou_xxx, ou_yyy (comma-separated)"
          ?disabled=${disabled}
          @input=${(event: Event) =>
            patchFeishu(props, "allowFrom", parseAllowFrom((event.target as HTMLInputElement).value))}
        />
      </label>
    </div>

    <div class="row" style="margin-top: 12px;">
      <button
        class="btn primary"
        ?disabled=${disabled || !props.configFormDirty}
        @click=${() => props.onConfigSave()}
      >
        ${props.configSaving ? "Saving…" : "Save"}
      </button>
      <button class="btn" ?disabled=${disabled} @click=${() => props.onConfigReload()}>
        ${t("common.reload")}
      </button>
      <button class="btn" @click=${() => props.onRefresh(true)}>${t("common.probe")}</button>
    </div>
  `;
}

/** Prefer channels.status; if missing, infer from saved App ID + Secret in config form. */
function resolveFeishuConfigured(props: ChannelsProps): boolean | null {
  const fromStatus = resolveChannelConfigured("feishu", props);
  if (fromStatus != null) {
    return fromStatus;
  }
  const feishu = resolveChannelConfigValue(props.configForm, "feishu");
  if (!feishu) {
    return false;
  }
  const appId = asString(feishu.appId).trim();
  const appSecret = feishu.appSecret;
  const hasSecret =
    (typeof appSecret === "string" && appSecret.trim().length > 0) ||
    (appSecret != null && typeof appSecret === "object");
  if (!appId) {
    return false;
  }
  // Redacted placeholder still means a secret is configured in the stored config.
  return hasSecret;
}

export function renderFeishuCard(params: {
  props: ChannelsProps;
  feishu?: FeishuStatus | null;
  accountCountLabel: unknown;
}) {
  const { props, feishu, accountCountLabel } = params;
  const configured = resolveFeishuConfigured(props);
  const status = asRecord(feishu);
  const lastError =
    typeof status.lastError === "string"
      ? status.lastError
      : typeof feishu?.lastError === "string"
        ? feishu.lastError
        : undefined;
  const probe = feishu?.probe;

  return renderSingleAccountChannelCard({
    title: "Feishu / Lark",
    subtitle: "App credentials and channel policy for Feishu/Lark bots.",
    accountCountLabel,
    statusRows: [
      { label: t("common.configured"), value: formatNullableBoolean(configured) },
      {
        label: t("common.running"),
        value: feishu?.running ? t("common.yes") : t("common.no"),
      },
      {
        label: t("common.connected"),
        value: formatNullableBoolean(
          typeof feishu?.connected === "boolean" ? feishu.connected : null,
        ),
      },
      {
        label: t("common.lastStart"),
        value: feishu?.lastStartAt
          ? formatRelativeTimestamp(feishu.lastStartAt)
          : t("common.na"),
      },
      {
        label: t("common.lastProbe"),
        value: feishu?.lastProbeAt
          ? formatRelativeTimestamp(feishu.lastProbeAt)
          : t("common.na"),
      },
    ],
    lastError,
    secondaryCallout: probe
      ? html`<div class="callout" style="margin-top: 12px;">
          ${probe.ok ? t("common.probeOk") : t("common.probeFailed")} · ${probe.status ?? ""}
          ${probe.error ?? ""}
        </div>`
      : nothing,
    configSection: props.configSchemaLoading
      ? html`<div class="muted" style="margin-top: 16px;">Loading config…</div>`
      : renderFeishuConfigForm(props),
  });
}
