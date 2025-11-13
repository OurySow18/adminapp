/**
 * Abgabe Bachelorarbeit
 * Author: Amadou Oury Sow
 * Date: 15.09.2022
 * 
 * Startseite, WrÃ¤ppt die App.js in DarkModeContextProvider und der Provider
 */
import React from 'react';
import { createRoot } from 'react-dom/client'; 
import App from './App'; 
import {DarkModeContextProvider} from "./context/darkModeContext";
import {AuthContextProvider} from "./context/AuthContext";

if (typeof window !== "undefined") {
  const resizeObserverErr = "ResizeObserver loop completed with undelivered notifications.";
  const resizeObserverLimitErr = "ResizeObserver loop limit exceeded";

  const ignoreResizeObserverError = (message = "") =>
    typeof message === "string" &&
    (message.includes(resizeObserverErr) ||
      message.includes(resizeObserverLimitErr));

  const handleWindowError = (message, source, lineno, colno, error) => {
    if (ignoreResizeObserverError(message || error?.message)) {
      return true;
    }
    return undefined;
  };

  window.onerror = handleWindowError;

  window.onunhandledrejection = (event) => {
    if (ignoreResizeObserverError(event?.reason?.message)) {
      event.preventDefault?.();
      return true;
    }
    return undefined;
  };
}

const rootElement = document.getElementById('root');

if (rootElement) {
  const root = createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <DarkModeContextProvider>
        <AuthContextProvider>
          <App />
        </AuthContextProvider>
      </DarkModeContextProvider>
    </React.StrictMode>
  );
}

