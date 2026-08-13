import { consume } from "@lit/context";
import { html, LitElement } from "lit";
import { state } from "lit/decorators.js";
import { subtitleForRoute, titleForRoute } from "../../app-navigation.ts";
import { applicationContext, type ApplicationContext } from "../../app/context.ts";
import { t } from "../../i18n/index.ts";
import {
  buildModelProviderPatch,
  listSavedModelProviders,
  type SavedModelProvider,
} from "./model-config.ts";
import { renderModelsPage } from "./view.ts";

const QWEN_STANDARD_CN_EXAMPLE = "https://dashscope.aliyuncs.com/compatible-mode/v1";

class ModelsPage extends LitElement {
  override createRenderRoot() {
    return this;
  }

  @consume({ context: applicationContext, subscribe: false })
  private context!: ApplicationContext;

  @state() private loading = false;
  @state() private saving = false;
  @state() private testing = false;
  @state() private error: string | null = null;
  @state() private status: string | null = null;
  @state() private modelName = "qwen3.5-plus";
  @state() private baseUrl = QWEN_STANDARD_CN_EXAMPLE;
  @state() private apiKey = "";
  @state() private setAsDefault = true;
  @state() private editingProviderId: string | null = null;
  @state() private saved: SavedModelProvider[] = [];

  private unsubscribeRuntimeConfig: (() => void) | null = null;
  private unsubscribeGateway: (() => void) | null = null;
  private loadGeneration = 0;

  override connectedCallback() {
    super.connectedCallback();
    this.unsubscribeRuntimeConfig = this.context.runtimeConfig.subscribe(() => {
      this.syncFromConfig();
    });
    this.unsubscribeGateway = this.context.gateway.subscribe((snapshot) => {
      if (snapshot.connected && snapshot.client) {
        void this.refresh();
      }
    });
    const gateway = this.context.gateway.snapshot;
    if (gateway.connected && gateway.client) {
      void this.refresh();
    } else {
      this.syncFromConfig();
    }
  }

  override disconnectedCallback() {
    this.unsubscribeRuntimeConfig?.();
    this.unsubscribeGateway?.();
    this.unsubscribeRuntimeConfig = null;
    this.unsubscribeGateway = null;
    this.loadGeneration += 1;
    super.disconnectedCallback();
  }

  private syncFromConfig() {
    const config = this.context.runtimeConfig.state.configForm as Record<string, unknown> | null;
    const snapshotConfig = this.context.runtimeConfig.state.configSnapshot?.config as
      | Record<string, unknown>
      | undefined;
    this.saved = listSavedModelProviders(config ?? snapshotConfig ?? null);
  }

  private async refresh() {
    const generation = ++this.loadGeneration;
    this.loading = true;
    this.error = null;
    try {
      await this.context.runtimeConfig.ensureLoaded();
      await this.context.runtimeConfig.refresh();
      if (generation !== this.loadGeneration) {
        return;
      }
      this.syncFromConfig();
    } catch (error) {
      if (generation !== this.loadGeneration) {
        return;
      }
      this.error = String(error);
    } finally {
      if (generation === this.loadGeneration) {
        this.loading = false;
      }
    }
  }

  private resetForm() {
    this.modelName = "qwen3.5-plus";
    this.baseUrl = QWEN_STANDARD_CN_EXAMPLE;
    this.apiKey = "";
    this.setAsDefault = true;
    this.editingProviderId = null;
    this.status = null;
    this.error = null;
  }

  private editRow(row: SavedModelProvider) {
    this.modelName = row.modelId;
    this.baseUrl = row.baseUrl;
    this.apiKey = "";
    this.setAsDefault = true;
    this.editingProviderId = row.providerId;
    this.status = t("modelsPage.editHint");
    this.error = null;
  }

  private async save() {
    const built = buildModelProviderPatch({
      modelName: this.modelName,
      baseUrl: this.baseUrl,
      apiKey: this.apiKey,
      setAsDefault: this.setAsDefault,
      providerId: this.editingProviderId ?? undefined,
    });
    if (!built.ok) {
      this.error = built.error;
      this.status = null;
      return;
    }

    this.saving = true;
    this.error = null;
    this.status = null;
    try {
      await this.context.runtimeConfig.ensureLoaded();
      const ok = await this.context.runtimeConfig.patch({
        raw: built.patch,
        note: "Control UI models page: save provider",
      });
      if (!ok) {
        this.error =
          this.context.runtimeConfig.state.lastError ?? t("modelsPage.saveFailed");
        return;
      }
      await this.context.runtimeConfig.refresh();
      this.syncFromConfig();
      this.apiKey = "";
      this.editingProviderId = built.providerId;
      this.status = t("modelsPage.saveSuccess", { modelRef: built.modelRef });
    } catch (error) {
      this.error = String(error);
    } finally {
      this.saving = false;
    }
  }

  private async testConnection() {
    const modelId = this.modelName.trim();
    const baseUrl = this.baseUrl.trim();
    if (!modelId || !baseUrl) {
      this.error = t("modelsPage.testNeedFields");
      this.status = null;
      return;
    }

    const client = this.context.gateway.snapshot.client;
    if (!client || !this.context.gateway.snapshot.connected) {
      this.error = t("modelsPage.testDisconnected");
      this.status = null;
      return;
    }

    this.testing = true;
    this.error = null;
    this.status = null;
    try {
      const result = await client.request<{
        ok: boolean;
        latencyMs: number;
        status?: number;
        error?: string;
      }>("models.probeEndpoint", {
        baseUrl,
        modelId,
        ...(this.apiKey.trim() ? { apiKey: this.apiKey.trim() } : {}),
        ...(this.editingProviderId ? { providerId: this.editingProviderId } : {}),
      });
      if (!result) {
        this.error = t("modelsPage.testFailed", {
          latencyMs: 0,
          error: "empty response",
        });
        return;
      }
      if (result.ok) {
        this.status = t("modelsPage.testSuccess", {
          latencyMs: result.latencyMs,
          status: result.status ?? 200,
        });
        return;
      }
      this.error = t("modelsPage.testFailed", {
        latencyMs: result.latencyMs,
        error: result.error ?? `HTTP ${result.status ?? "?"}`.trim(),
      });
    } catch (error) {
      this.error = String(error);
    } finally {
      this.testing = false;
    }
  }

  override render() {
    return html`
      <section class="page-header">
        <div>
          <h1>${titleForRoute("models")}</h1>
          <p class="muted">${subtitleForRoute("models")}</p>
        </div>
      </section>
      ${renderModelsPage({
        loading: this.loading,
        saving: this.saving,
        testing: this.testing,
        error: this.error,
        status: this.status,
        modelName: this.modelName,
        baseUrl: this.baseUrl,
        apiKey: this.apiKey,
        setAsDefault: this.setAsDefault,
        editingProviderId: this.editingProviderId,
        saved: this.saved,
        onModelNameChange: (value) => {
          this.modelName = value;
        },
        onBaseUrlChange: (value) => {
          this.baseUrl = value;
        },
        onApiKeyChange: (value) => {
          this.apiKey = value;
        },
        onSetAsDefaultChange: (value) => {
          this.setAsDefault = value;
        },
        onSave: () => void this.save(),
        onTest: () => void this.testConnection(),
        onReset: () => this.resetForm(),
        onEdit: (row) => this.editRow(row),
        onRefresh: () => void this.refresh(),
      })}
    `;
  }
}

void customElements.define("openclaw-models-page", ModelsPage);

declare global {
  interface HTMLElementTagNameMap {
    "openclaw-models-page": ModelsPage;
  }
}
