import React, { createContext, useContext, useState, useEffect } from "react";

interface ConfigContextType {
  apiKey: string;
  setApiKey: (key: string) => void;
  userEmail: string;
  setUserEmail: (email: string) => void;
  jiraDomain: string;
  setJiraDomain: (domain: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchLoading: boolean;
  setSearchLoading: (loading: boolean) => void;
  theme: "dark" | "light" | "system";
  setTheme: (theme: "dark" | "light" | "system") => void;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export const ConfigProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [apiKey, setApiKeyState] = useState(
    localStorage.getItem("jira_api_key") || "",
  );
  const [userEmail, setUserEmailState] = useState(
    localStorage.getItem("jira_email") || "",
  );
  const [jiraDomain, setJiraDomainState] = useState(
    localStorage.getItem("jira_domain") || "",
  );
  const [searchQuery, setSearchQueryState] = useState(
    localStorage.getItem("jozzos_search_query") || "",
  );
  const [searchLoading, setSearchLoading] = useState(false);
  const [theme, setThemeState] = useState<"dark" | "light" | "system">(
    (localStorage.getItem("jozzos_theme") as "dark" | "light" | "system") ||
      "system",
  );

  const setTheme = (nextTheme: "dark" | "light" | "system") => {
    setThemeState(nextTheme);
    localStorage.setItem("jozzos_theme", nextTheme);
  };

  useEffect(() => {
    const applyTheme = () => {
      const root = document.documentElement;
      const resolvedTheme: "dark" | "light" =
        theme === "system"
          ? window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light"
          : theme;
      root.setAttribute("data-theme", resolvedTheme);
    };

    applyTheme();

    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => applyTheme();
      mediaQuery.addEventListener("change", handler);
      return () => mediaQuery.removeEventListener("change", handler);
    }
  }, [theme]);

  const setApiKey = (key: string) => {
    setApiKeyState(key);
    localStorage.setItem("jira_api_key", key);
  };

  const setUserEmail = (email: string) => {
    setUserEmailState(email);
    localStorage.setItem("jira_email", email);
  };

  const setJiraDomain = (domain: string) => {
    setJiraDomainState(domain);
    localStorage.setItem("jira_domain", domain);
  };

  const setSearchQuery = (query: string) => {
    setSearchQueryState(query);
    localStorage.setItem("jozzos_search_query", query);
  };

  return (
    <ConfigContext.Provider
      value={{
        apiKey,
        setApiKey,
        userEmail,
        setUserEmail,
        jiraDomain,
        setJiraDomain,
        searchQuery,
        setSearchQuery,
        searchLoading,
        setSearchLoading,
        theme,
        setTheme,
      }}
    >
      {children}
    </ConfigContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useConfig = () => {
  const context = useContext(ConfigContext);
  if (context === undefined) {
    throw new Error("useConfig must be used within a ConfigProvider");
  }
  return context;
};
