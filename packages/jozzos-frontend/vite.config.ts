import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import type { IncomingMessage } from "http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function sanitizeHeaders(
  headers: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!headers) return {};
  const sanitized = { ...headers };
  const sensitiveKeys = [
    "authorization",
    "x-jira-authorization",
    "cookie",
    "set-cookie",
  ];
  Object.keys(sanitized).forEach((key) => {
    if (sensitiveKeys.includes(key.toLowerCase())) {
      sanitized[key] = "[REDACTED]";
    }
  });
  return sanitized;
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, "../../"), "");
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
          // Allow dynamic target based on header
          router: (req: IncomingMessage) => {
            const domain = req.headers["x-jira-domain"];
            if (domain) {
              return `https://${domain}`;
            }
            return targetUrl;
          },
          // Need to ensure the Origin header matches the target for Jira
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq, req) => {
              const domain =
                (req.headers["x-jira-domain"] as string) || jiraHostname;
              const currentTarget = `https://${domain}`;
              console.log(`[Proxy] Incoming request: ${req.method} ${req.url}`);
              console.log(
                "[Proxy] Incoming headers:",
                sanitizeHeaders(req.headers),
              );
              console.log(
                `[Proxy] Forwarding to: ${proxyReq.method} ${currentTarget}${proxyReq.path}`,
              );

              // Update headers for Jira Cloud compatibility
              proxyReq.setHeader("Host", domain);
              proxyReq.setHeader("Origin", currentTarget);
              proxyReq.removeHeader("referer");

              const jiraAuth = req.headers["x-jira-authorization"];
              if (jiraAuth) {
                proxyReq.removeHeader("authorization");
                proxyReq.removeHeader("Authorization");
                const authVal = Array.isArray(jiraAuth)
                  ? jiraAuth[0]
                  : jiraAuth;
                proxyReq.setHeader("Authorization", authVal);
                proxyReq.removeHeader("x-jira-authorization");
              } else {
                const auth =
                  req.headers["authorization"] || req.headers["Authorization"];
                if (auth) {
                  proxyReq.removeHeader("authorization");
                  proxyReq.removeHeader("Authorization");
                  const authVal = Array.isArray(auth) ? auth[0] : auth;
                  proxyReq.setHeader("Authorization", authVal);
                }
              }

              console.log(
                "[Proxy] Forwarded headers:",
                sanitizeHeaders(proxyReq.getHeaders()),
              );
            });
            proxy.on("proxyRes", (proxyRes, req) => {
              console.log(
                `[Proxy] Response from Jira: ${proxyRes.statusCode} for ${req.url}`,
              );
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
