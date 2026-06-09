import React, { useState } from "react";
import { useConfig } from "../context/ConfigContext";

export const SettingsPage: React.FC = () => {
  const [showTutorial, setShowTutorial] = useState(false);
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
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                marginBottom: "0.5rem",
              }}
            >
              <label
                style={{
                  display: "block",
                  fontSize: "0.9rem",
                  color: "var(--text-secondary)",
                }}
              >
                API Key / Token
              </label>
              <button
                type="button"
                onClick={() => setShowTutorial(!showTutorial)}
                style={{
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  borderRadius: "50%",
                  width: "18px",
                  height: "18px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--accent-secondary)",
                  cursor: "pointer",
                  fontSize: "0.75rem",
                  fontWeight: "bold",
                  transition: "all var(--transition-fast)",
                  padding: 0,
                  outline: "none",
                }}
                title="How to generate a Jira API token"
                onMouseEnter={(e) => {
                  e.currentTarget.style.background =
                    "rgba(102, 252, 241, 0.15)";
                  e.currentTarget.style.borderColor = "var(--accent-secondary)";
                  e.currentTarget.style.boxShadow =
                    "0 0 8px rgba(102, 252, 241, 0.4)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background =
                    "rgba(255, 255, 255, 0.05)";
                  e.currentTarget.style.borderColor =
                    "rgba(255, 255, 255, 0.15)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                ?
              </button>
            </div>
            {showTutorial && (
              <div
                className="animate-fade-in"
                style={{
                  background: "rgba(102, 252, 241, 0.05)",
                  border: "1px solid rgba(102, 252, 241, 0.2)",
                  borderRadius: "6px",
                  padding: "0.8rem 1rem",
                  marginBottom: "0.75rem",
                  fontSize: "0.85rem",
                  color: "var(--text-secondary)",
                  lineHeight: "1.4",
                }}
              >
                <h4
                  style={{
                    margin: "0 0 0.5rem 0",
                    color: "var(--text-primary)",
                  }}
                >
                  How to generate a Jira API token
                </h4>
                <ol
                  style={{
                    margin: 0,
                    paddingLeft: "1.2rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.25rem",
                  }}
                >
                  <li>
                    Go to{" "}
                    <a
                      href="https://id.atlassian.com/manage-profile/security/api-tokens"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: "var(--accent-secondary)",
                        textDecoration: "underline",
                      }}
                    >
                      Atlassian API Tokens
                    </a>
                    .
                  </li>
                  <li>
                    Click <strong>Create API token</strong>.
                  </li>
                  <li>
                    Enter a label (e.g. <code>jozzos</code>).
                  </li>
                  <li>
                    Click <strong>Create</strong>, then copy the generated
                    token.
                  </li>
                  <li>Paste the token into the field below.</li>
                </ol>
              </div>
            )}
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
