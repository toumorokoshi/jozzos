import React, { useState } from "react";
import {
  Outlet,
  NavLink,
  useNavigate,
  useLocation,
  useSearchParams,
} from "react-router-dom";
import { Menu, X, Settings, ListTodo, LayoutGrid } from "lucide-react";
import { AboutJozzosContent } from "./AboutJozzosContent";
import { useConfig } from "../context/ConfigContext";

export const Layout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const { searchQuery, setSearchQuery, searchLoading, jiraDomain } =
    useConfig();
  const [prevSearchQuery, setPrevSearchQuery] = useState(searchQuery);
  const [filterId, setFilterId] = useState(searchQuery);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  if (searchQuery !== prevSearchQuery) {
    setPrevSearchQuery(searchQuery);
    setFilterId(searchQuery);
  }

  const getJiraSearchUrl = (query: string) => {
    if (!jiraDomain || !query) return undefined;
    const trimmed = query.trim();
    if (!trimmed) return undefined;
    const jql = /^\d+$/.test(trimmed) ? `filter=${trimmed}` : trimmed;
    return `https://${jiraDomain}/issues/?jql=${encodeURIComponent(jql)}`;
  };
  const jiraUrl = getJiraSearchUrl(searchQuery);

  const performSearch = () => {
    const trimmed = filterId.trim();
    setSearchQuery(trimmed);
    const targetPath =
      location.pathname === "/" || location.pathname === "/matrix"
        ? location.pathname
        : "/";

    const nextParams = new URLSearchParams(searchParams);
    if (trimmed) {
      nextParams.set("q", trimmed);
    } else {
      nextParams.delete("q");
    }

    if (location.pathname !== targetPath) {
      navigate(`${targetPath}?${nextParams.toString()}`);
    } else {
      setSearchParams(nextParams);
    }
  };

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
            to={location.search ? `/${location.search}` : "/"}
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
            to={location.search ? `/matrix${location.search}` : "/matrix"}
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
            <LayoutGrid size={20} />
            Matrix View
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
            background: "#000000",
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
                background: "var(--btn-secondary-bg)",
                border: "1px solid var(--btn-secondary-border)",
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
                e.currentTarget.style.background =
                  "var(--btn-secondary-hover-bg)";
                e.currentTarget.style.borderColor = "var(--accent-secondary)";
                e.currentTarget.style.boxShadow =
                  "0 0 8px var(--btn-secondary-hover-shadow)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "var(--btn-secondary-bg)";
                e.currentTarget.style.borderColor =
                  "var(--btn-secondary-border)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              ?
            </button>
          </div>

          {/* Issue query input and Jira link in the header next to logo */}
          <div
            style={{
              display: "flex",
              gap: "0.75rem",
              alignItems: "center",
              flex: 1,
              marginLeft: "1.5rem",
            }}
          >
            <input
              type="text"
              className="input-field"
              style={{
                padding: "0.5rem 1rem",
                flex: 1,
                margin: 0,
                height: "38px",
                boxSizing: "border-box",
              }}
              placeholder="Enter Jira Filter ID or JQL (e.g. project = PROJ)"
              value={filterId}
              onChange={(e) => setFilterId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && performSearch()}
            />
            <button
              className="btn-primary"
              style={{
                padding: "0.5rem 1.5rem",
                height: "38px",
                boxSizing: "border-box",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              onClick={performSearch}
              disabled={searchLoading}
            >
              {searchLoading ? "Searching..." : "Search"}
            </button>
            <a
              href={jiraUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="card-panel"
              style={{
                padding: "0 1.25rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
                cursor: jiraUrl ? "pointer" : "not-allowed",
                background: jiraUrl
                  ? "var(--btn-secondary-bg)"
                  : "var(--blocker-row-bg)",
                border: "1px solid var(--btn-secondary-border)",
                borderRadius: "6px",
                color: jiraUrl ? "var(--text-primary)" : "#4a4f58",
                transition: "all var(--transition-fast)",
                height: "38px",
                boxSizing: "border-box",
                margin: 0,
                textDecoration: "none",
                fontSize: "0.85rem",
                pointerEvents: jiraUrl ? "auto" : "none",
              }}
              onMouseEnter={(e) => {
                if (jiraUrl) {
                  e.currentTarget.style.background =
                    "var(--btn-secondary-hover-bg)";
                  e.currentTarget.style.borderColor = "var(--accent-secondary)";
                }
              }}
              onMouseLeave={(e) => {
                if (jiraUrl) {
                  e.currentTarget.style.background = "var(--btn-secondary-bg)";
                  e.currentTarget.style.borderColor =
                    "var(--btn-secondary-border)";
                }
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                <polyline points="15 3 21 3 21 9"></polyline>
                <line x1="10" y1="14" x2="21" y2="3"></line>
              </svg>
              Jira
            </a>
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
            backgroundColor: "var(--modal-backdrop)",
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
              background: "var(--modal-bg)",
              border: "1px solid var(--modal-border)",
              borderRadius: "16px",
              boxShadow: "var(--modal-shadow)",
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
              <AboutJozzosContent />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
