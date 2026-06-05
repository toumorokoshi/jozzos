import React, { useState } from "react";
import { Outlet, NavLink } from "react-router-dom";
import { Menu, X, Settings, ListTodo } from "lucide-react";

export const Layout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
          <h1
            style={{
              fontSize: "1.5rem",
              color: "var(--text-primary)",
              margin: 0,
            }}
          >
            Jozzos
          </h1>
        </header>

        <main style={{ padding: "2rem", flex: 1, overflow: "auto" }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};
