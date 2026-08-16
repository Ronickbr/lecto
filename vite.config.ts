import { loadEnv, defineConfig, type UserConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const NITRO_DEFAULT_PRESET_MIN = [3, 0, 260603];

// Preset de produção configurável por ambiente (ex.: NITRO_PRESET=node-server
// no Dokploy/Vercel ou NITRO_PRESET=cloudflare-module para Cloudflare Workers).
const NITRO_PRESET = process.env.NITRO_PRESET ?? "node-server";

async function nitroSupportsDefaultPreset() {
  try {
    const { createRequire } = await import("node:module");
    const { version } = createRequire(`${process.cwd()}/package.json`)("nitro/package.json");
    const match = typeof version === "string" ? /^(\d+)\.(\d+)\.(\d+)/.exec(version) : null;
    if (!match) return true;
    const parts = [Number(match[1]), Number(match[2]), Number(match[3])];
    for (let i = 0; i < 3; i++) {
      if (parts[i] !== NITRO_DEFAULT_PRESET_MIN[i]) return parts[i] > NITRO_DEFAULT_PRESET_MIN[i];
    }
    return true;
  } catch {
    return true;
  }
}

export default defineConfig(async ({ mode, command }) => {
  const plugins: UserConfig["plugins"] = [];

  if (mode === "development") {
    const { devtools } = await import("@tanstack/devtools-vite");
    plugins.push(
      devtools({
        logging: false,
        eventBusConfig: { enabled: false },
        enhancedLogs: { enabled: false },
        consolePiping: { enabled: false },
        removeDevtoolsOnBuild: false,
        injectSource: { enabled: true },
      }),
    );
  }

  plugins.push(tailwindcss());

  plugins.push(
    tanstackStart({
      server: { entry: "server" },
      importProtection: {
        behavior: "error",
        client: {
          files: ["**/server/**"],
          specifiers: ["server-only"],
        },
      },
    }),
  );

  if (command === "build") {
    const { nitro } = await import("nitro/vite");
    const nitroOpts: Record<string, unknown> = { defaultPreset: NITRO_PRESET };
    if (!nitroOpts.preset && !(await nitroSupportsDefaultPreset())) {
      nitroOpts.preset = NITRO_PRESET;
    }
    plugins.push(nitro(nitroOpts as never));
  }

  plugins.push(viteReact());

  const loadedEnv = loadEnv(mode, process.cwd(), "VITE_");
  const envDefine: Record<string, string> = {};
  for (const [key, value] of Object.entries(loadedEnv)) {
    envDefine[`import.meta.env.${key}`] = JSON.stringify(value);
  }

  const config: UserConfig = {
    define: envDefine,
    css: { transformer: "lightningcss" },
    resolve: {
      alias: { "@": `${process.cwd()}/src` },
      tsconfigPaths: true,
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
      ],
      ignoreOutdatedRequests: true,
    },
    plugins,
    server: {
      host: "::",
      port: 8080,
      allowedHosts: [".monkeycode-ai.live"],
    },
  };

  return config;
});
