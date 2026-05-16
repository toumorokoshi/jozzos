import { useState } from "react";

function App() {
  const [apiKey, setApiKey] = useState("");
  const [filterId, setFilterId] = useState("");

  return (
    <div className="animate-fade-in">
      <header style={{ marginBottom: "3rem", textAlign: "center" }}>
        <h1 style={{ fontSize: "3rem", color: "var(--accent-secondary)" }}>
          Jozzos
        </h1>
        <p style={{ fontSize: "1.2rem", color: "var(--text-secondary)" }}>
          Premium Issue Tracker Client
        </p>
      </header>

      <main
        style={{ display: "grid", gap: "2rem", gridTemplateColumns: "1fr" }}
      >
        <section className="glass-panel">
          <h2>Configuration</h2>
          <p style={{ marginBottom: "1rem", color: "var(--text-secondary)" }}>
            Enter your API credentials to connect to your issue tracker.
          </p>
          <div
            style={{ display: "flex", gap: "1rem", flexDirection: "column" }}
          >
            <input
              type="password"
              className="input-field"
              placeholder="API Key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
        </section>

        <section className="glass-panel">
          <h2>Filter Issues</h2>
          <p style={{ marginBottom: "1rem", color: "var(--text-secondary)" }}>
            Enter a Jira Filter ID or JQL to list issues.
          </p>
          <div style={{ display: "flex", gap: "1rem" }}>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. 10001 or project = PROJ"
              value={filterId}
              onChange={(e) => setFilterId(e.target.value)}
            />
            <button className="btn-primary">Search</button>
          </div>
        </section>

        <section className="glass-panel" style={{ minHeight: "300px" }}>
          <h2>Results</h2>
          <p style={{ color: "var(--text-secondary)" }}>
            No issues loaded yet.
          </p>
        </section>
      </main>
    </div>
  );
}

export default App;
