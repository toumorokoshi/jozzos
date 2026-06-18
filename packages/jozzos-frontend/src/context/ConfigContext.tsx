/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState } from "react";

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
      }}
    >
      {children}
    </ConfigContext.Provider>
  );
};

export const useConfig = () => {
  const context = useContext(ConfigContext);
  if (context === undefined) {
    throw new Error("useConfig must be used within a ConfigProvider");
  }
  return context;
};
