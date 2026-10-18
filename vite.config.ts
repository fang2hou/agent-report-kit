import tailwindcss from "@tailwindcss/vite";
import adapter from "@sveltejs/adapter-static";
import nodeAdapter from "@sveltejs/adapter-node";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
  plugins: [
    tailwindcss(),
    sveltekit({
      adapter:
        mode === "export"
          ? adapter({ fallback: "index.html" })
          : nodeAdapter({ out: "dist/server" }),
      files: {
        routes: mode === "export" ? "src/routes" : "src/session",
        hooks: { server: mode === "export" ? undefined : "src/session/hooks.server" },
      },
      output: { bundleStrategy: "inline" },
      router: { type: mode === "export" ? "hash" : "pathname" },
      version: { pollInterval: 0 },
    }),
  ],
}));
