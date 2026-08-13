import { html, nothing } from "lit";
import { t } from "../../i18n/index.ts";
import type { SavedModelProvider } from "./model-config.ts";

export type ModelsPageProps = {
  loading: boolean;
  saving: boolean;
  testing: boolean;
  error: string | null;
  status: string | null;
  modelName: string;
  baseUrl: string;
  apiKey: string;
  setAsDefault: boolean;
  editingProviderId: string | null;
  saved: SavedModelProvider[];
  onModelNameChange: (value: string) => void;
  onBaseUrlChange: (value: string) => void;
  onApiKeyChange: (value: string) => void;
  onSetAsDefaultChange: (value: boolean) => void;
  onSave: () => void;
  onTest: () => void;
  onReset: () => void;
  onEdit: (row: SavedModelProvider) => void;
  onRefresh: () => void;
};

export function renderModelsPage(props: ModelsPageProps) {
  return html`
    <section class="card">
      <div class="card-title">${t("modelsPage.formTitle")}</div>
      <div class="card-sub">${t("modelsPage.formSubtitle")}</div>

      <div class="form-grid" style="margin-top: 16px;">
        <label class="field">
          <span>${t("modelsPage.modelName")}</span>
          <input
            type="text"
            .value=${props.modelName}
            placeholder=${t("modelsPage.modelNamePlaceholder")}
            ?disabled=${props.saving || props.testing}
            @input=${(event: Event) =>
              props.onModelNameChange((event.target as HTMLInputElement).value)}
          />
        </label>

        <label class="field">
          <span>${t("modelsPage.baseUrl")}</span>
          <input
            type="url"
            .value=${props.baseUrl}
            placeholder=${t("modelsPage.baseUrlPlaceholder")}
            ?disabled=${props.saving || props.testing}
            @input=${(event: Event) =>
              props.onBaseUrlChange((event.target as HTMLInputElement).value)}
          />
        </label>

        <label class="field">
          <span>${t("modelsPage.apiKey")}</span>
          <input
            type="password"
            autocomplete="off"
            .value=${props.apiKey}
            placeholder=${t("modelsPage.apiKeyPlaceholder")}
            ?disabled=${props.saving || props.testing}
            @input=${(event: Event) =>
              props.onApiKeyChange((event.target as HTMLInputElement).value)}
          />
        </label>

        <label class="field checkbox">
          <input
            type="checkbox"
            .checked=${props.setAsDefault}
            ?disabled=${props.saving || props.testing}
            @change=${(event: Event) =>
              props.onSetAsDefaultChange((event.target as HTMLInputElement).checked)}
          />
          <span>${t("modelsPage.setAsDefault")}</span>
        </label>
      </div>

      <div class="row" style="gap: 8px; margin-top: 16px; flex-wrap: wrap;">
        <button
          class="btn primary"
          ?disabled=${props.saving || props.testing || props.loading}
          @click=${props.onSave}
        >
          ${props.saving ? t("modelsPage.saving") : t("modelsPage.save")}
        </button>
        <button
          class="btn"
          ?disabled=${props.saving || props.testing || props.loading}
          @click=${props.onTest}
        >
          ${props.testing ? t("modelsPage.testing") : t("modelsPage.test")}
        </button>
        <button class="btn" ?disabled=${props.saving || props.testing} @click=${props.onReset}>
          ${t("modelsPage.reset")}
        </button>
        <button
          class="btn"
          ?disabled=${props.loading || props.saving || props.testing}
          @click=${props.onRefresh}
        >
          ${t("modelsPage.refresh")}
        </button>
      </div>

      ${props.editingProviderId
        ? html`<p class="muted" style="margin-top: 12px;">
            ${t("modelsPage.editingProvider", { id: props.editingProviderId })}
          </p>`
        : nothing}
      ${props.error ? html`<p class="error" style="margin-top: 12px;">${props.error}</p>` : nothing}
      ${props.status ? html`<p class="muted" style="margin-top: 12px;">${props.status}</p>` : nothing}
    </section>

    <section class="card" style="margin-top: 16px;">
      <div class="card-title">${t("modelsPage.savedTitle")}</div>
      <div class="card-sub">${t("modelsPage.savedSubtitle")}</div>
      ${props.loading
        ? html`<p class="muted" style="margin-top: 12px;">${t("modelsPage.loading")}</p>`
        : props.saved.length === 0
          ? html`<p class="muted" style="margin-top: 12px;">${t("modelsPage.empty")}</p>`
          : html`
              <div class="list" style="margin-top: 12px;">
                ${props.saved.map(
                  (row) => html`
                    <div class="list-item" style="align-items: flex-start; gap: 12px;">
                      <div style="flex: 1; min-width: 0;">
                        <div class="list-title">
                          ${row.modelName}
                          ${row.isPrimary
                            ? html`<span class="pill" style="margin-left: 8px;"
                                >${t("modelsPage.primaryBadge")}</span
                              >`
                            : nothing}
                        </div>
                        <div class="muted" style="word-break: break-all;">
                          ${row.providerId}/${row.modelId}
                        </div>
                        <div class="muted" style="word-break: break-all;">${row.baseUrl}</div>
                        <div class="muted">
                          ${row.hasApiKey
                            ? t("modelsPage.apiKeyConfigured")
                            : t("modelsPage.apiKeyMissing")}
                        </div>
                      </div>
                      <button
                        class="btn"
                        ?disabled=${props.saving || props.testing}
                        @click=${() => props.onEdit(row)}
                      >
                        ${t("modelsPage.edit")}
                      </button>
                    </div>
                  `,
                )}
              </div>
            `}
    </section>
  `;
}
