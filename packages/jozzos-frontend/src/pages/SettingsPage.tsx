import React from "react";
import { useConfig } from "../context/ConfigContext";

export const SettingsPage: React.FC = () => {
  const {
    apiKey,
    setApiKey,
    userEmail,
    setUserEmail,
    jiraDomain,
    setJiraDomain,
  } = useConfig();

  return (
    <div
      className="animate-fade-in"
      style={{ maxWidth: "600px", margin: "0 auto" }}
    >
      <section className="glass-panel">
        <h2>Configuration</h2>
        <p style={{ marginBottom: "1.5rem", color: "var(--text-secondary)" }}>
          Enter your API credentials to connect to your issue tracker. These
          credentials are saved locally in your browser.
        </p>
        <div style={{ display: "flex", gap: "1rem", flexDirection: "column" }}>
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "0.5rem",
                fontSize: "0.9rem",
                color: "var(--text-secondary)",
              }}
            >
              Jira Domain
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. your-domain.atlassian.net"
              value={jiraDomain}
              onChange={(e) => setJiraDomain(e.target.value)}
            />
          </div>
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "0.5rem",
                fontSize: "0.9rem",
                color: "var(--text-secondary)",
              }}
            >
              Jira Email (for Basic Auth)
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. you@domain.com"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
            />
          </div>
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "0.5rem",
                fontSize: "0.9rem",
                color: "var(--text-secondary)",
              }}
            >
              API Key / Token
            </label>
            <input
              type="password"
              className="input-field"
              placeholder="Your Atlassian API Token"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
        </div>
      </section>
    </div>
  );
};
