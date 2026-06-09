import React, { useState } from "react";
import { Outlet, NavLink } from "react-router-dom";
import { Menu, X, Settings, ListTodo } from "lucide-react";

export const Layout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  return (
    <div style={{ display: "flex", minHeight: "100vh", width: "100%" }}>
      {/* Sidebar */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          height: "100vh",
          width: "250px",
          background: "var(--bg-secondary)",
          borderRight: "1px solid var(--border-color)",
          transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform var(--transition-fast)",
          zIndex: 50,
          display: "flex",
          flexDirection: "column",
          padding: "2rem 1rem",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "2rem",
          }}
        >
          <h2 style={{ margin: 0, color: "var(--accent-secondary)" }}>
            Jozzos
          </h2>
          <button
            onClick={() => setSidebarOpen(false)}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-secondary)",
              cursor: "pointer",
            }}
          >
            <X size={24} />
          </button>
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <NavLink
            to="/"
            onClick={() => setSidebarOpen(false)}
            style={({ isActive }) => ({
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              padding: "0.75rem 1rem",
              borderRadius: "8px",
              textDecoration: "none",
              color: isActive ? "var(--bg-primary)" : "var(--text-primary)",
              background: isActive ? "var(--accent-primary)" : "transparent",
              fontWeight: isActive ? "600" : "400",
              transition: "all var(--transition-fast)",
            })}
          >
            <ListTodo size={20} />
            Issues
          </NavLink>

          <NavLink
            to="/settings"
            onClick={() => setSidebarOpen(false)}
            style={({ isActive }) => ({
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              padding: "0.75rem 1rem",
              borderRadius: "8px",
              textDecoration: "none",
              color: isActive ? "var(--bg-primary)" : "var(--text-primary)",
              background: isActive ? "var(--accent-primary)" : "transparent",
              fontWeight: isActive ? "600" : "400",
              transition: "all var(--transition-fast)",
            })}
          >
            <Settings size={20} />
            Settings
          </NavLink>
        </nav>
      </div>

      {/* Main Content Overlay for Mobile */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 40,
          }}
        />
      )}

      {/* Main Area */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          width: "100%",
          maxWidth: "100%",
        }}
      >
        <header
          style={{
            padding: "1rem 2rem",
            borderBottom: "1px solid var(--border-color)",
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            background: "var(--bg-secondary)",
          }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-primary)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0.5rem",
              borderRadius: "8px",
            }}
          >
            <Menu size={24} />
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <h1
              style={{
                fontSize: "1.5rem",
                color: "var(--text-primary)",
                margin: 0,
              }}
            >
              Jozzos
            </h1>
            <button
              type="button"
              onClick={() => setShowHelpModal(true)}
              style={{
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                borderRadius: "50%",
                width: "20px",
                height: "20px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--accent-secondary)",
                cursor: "pointer",
                fontSize: "0.75rem",
                fontWeight: "bold",
                transition: "all var(--transition-fast)",
                padding: 0,
                outline: "none",
                marginLeft: "0.25rem",
              }}
              title="what is Jozzos and how do I use it?"
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(102, 252, 241, 0.15)";
                e.currentTarget.style.borderColor = "var(--accent-secondary)";
                e.currentTarget.style.boxShadow =
                  "0 0 8px rgba(102, 252, 241, 0.4)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.15)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              ?
            </button>
          </div>
        </header>

        <main style={{ padding: "2rem", flex: 1, overflow: "auto" }}>
          <Outlet />
        </main>
      </div>

      {showHelpModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(11, 12, 16, 0.7)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
            boxSizing: "border-box",
          }}
          onClick={() => setShowHelpModal(false)}
        >
          <div
            style={{
              background: "rgba(31, 40, 51, 0.95)",
              border: "1px solid rgba(102, 252, 241, 0.15)",
              borderRadius: "16px",
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.6)",
              width: "90vw",
              maxWidth: "600px",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "1.25rem 1.5rem",
                borderBottom: "1px solid var(--border-color)",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  color: "var(--accent-secondary)",
                  fontSize: "1.2rem",
                }}
              >
                About Jozzos
              </h3>
              <button
                onClick={() => setShowHelpModal(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div
              style={{
                padding: "1.5rem",
                overflowY: "auto",
                maxHeight: "70vh",
                display: "flex",
                flexDirection: "column",
                gap: "1.25rem",
                color: "var(--text-secondary)",
                fontSize: "0.95rem",
                lineHeight: "1.5",
              }}
            >
              <div>
                <h4
                  style={{
                    margin: "0 0 0.5rem 0",
                    color: "var(--text-primary)",
                    fontSize: "1rem",
                  }}
                >
                  What is Jozzos?
                </h4>
                <p style={{ margin: 0 }}>
                  Jozzos is a high-productivity user interface for issue
                  trackers (like Jira) designed specifically for superusers and
                  program managers. It turns complex task lists into an
                  interactive, spreadsheet-like workspace, highlighting blockers
                  and dependencies in real-time.
                </p>
              </div>

              <div>
                <h4
                  style={{
                    margin: "0 0 0.5rem 0",
                    color: "var(--text-primary)",
                    fontSize: "1rem",
                  }}
                >
                  Why should I use it?
                </h4>
                <p style={{ margin: "0 0 0.5rem 0" }}>
                  Standard trackers often hide blocker hierarchies or make it
                  difficult to visualize deep dependency chains. Jozzos solves
                  this by providing:
                </p>
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: "1.2rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.25rem",
                  }}
                >
                  <li>
                    <strong>Infinite Blocker Recursion</strong>: Automatically
                    traverses and maps nested blockers to any depth.
                  </li>
                  <li>
                    <strong>Interactive Spreadsheets</strong>: Edit issue fields
                    (Summary, Status, Assignee, Reporter) inline by
                    double-clicking.
                  </li>
                  <li>
                    <strong>Visual Dependency Tree</strong>: Instantly see which
                    issues block which, nested with collapsible rows.
                  </li>
                </ul>
              </div>

              <div>
                <h4
                  style={{
                    margin: "0 0 0.5rem 0",
                    color: "var(--text-primary)",
                    fontSize: "1rem",
                  }}
                >
                  How do I use it?
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
                    <strong>Connect to Jira</strong>: Go to the{" "}
                    <strong>Settings</strong> page and add your Jira domain,
                    email, and API key.
                  </li>
                  <li>
                    <strong>Search Issues</strong>: On the{" "}
                    <strong>Issues</strong> page, enter a Jira Filter ID or raw
                    JQL string (e.g. <code>project = TEST</code>) in the query
                    input.
                  </li>
                  <li>
                    <strong>Inspect Blockers</strong>: Look for red lock icons
                    or expand collapsible blocker tree rows to explore recursive
                    blocker hierarchies.
                  </li>
                  <li>
                    <strong>Edit Inline</strong>: Double-click any editable cell
                    (Summary, Status, Assignee, Reporter) to make changes and
                    save them instantly to Jira.
                  </li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
