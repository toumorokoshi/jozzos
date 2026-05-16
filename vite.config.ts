import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const jiraHostname = env.JIRA_HOSTNAME || "your-domain.atlassian.net";
  const targetUrl = `https://${jiraHostname}`;

  return {
    plugins: [react()],
    server: {
      proxy: {
        "/api/jira": {
          target: targetUrl,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/jira/, ""),
          // Need to ensure the Origin header matches the target for Jira
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq) => {
              proxyReq.setHeader("Origin", targetUrl);
            });
          },
        },
      },
    },
    test: {
      include: ["**/*_test.ts", "**/*_test.tsx"],
      environment: "jsdom",
    },
    envPrefix: ["VITE_"],
  };
});
