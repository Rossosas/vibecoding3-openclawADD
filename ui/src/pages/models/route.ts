import { definePage } from "@openclaw/uirouter";
import { html } from "lit";

export const page = definePage({
  id: "models",
  path: "/models",
  component: () =>
    import("./models-page.ts").then(() => ({
      header: true,
      render: () => html`<openclaw-models-page></openclaw-models-page>`,
    })),
});
