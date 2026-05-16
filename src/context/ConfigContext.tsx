/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, ReactNode } from "react";

interface ConfigContextType {
  apiKey: string;
  setApiKey: (key: string) => void;
  userEmail: string;
  setUserEmail: (email: string) => void;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export const ConfigProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [apiKey, setApiKeyState] = useState(
    localStorage.getItem("jira_api_key") || "",
  );
  const [userEmail, setUserEmailState] = useState(
    localStorage.getItem("jira_email") || "",
  );

  const setApiKey = (key: string) => {
    setApiKeyState(key);
    localStorage.setItem("jira_api_key", key);
  };

  const setUserEmail = (email: string) => {
    setUserEmailState(email);
    localStorage.setItem("jira_email", email);
  };

  return (
    <ConfigContext.Provider
      value={{ apiKey, setApiKey, userEmail, setUserEmail }}
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
