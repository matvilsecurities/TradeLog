import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import "./styles/scroll-effects.css";
import ScrollEffects from "./components/ScrollEffects";
import ErrorBoundary from "./components/shared/ErrorBoundary";
import { reportClientError } from "./services/telemetry.js";

window.addEventListener("error", (event) => reportClientError(event.error || new Error(event.message || "Unhandled browser error"), { operation: "window-error" }));
window.addEventListener("unhandledrejection", (event) => reportClientError(event.reason || new Error("Unhandled promise rejection"), { operation: "unhandled-promise-rejection" }));

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
      <ScrollEffects />
    </ErrorBoundary>
  </React.StrictMode>
);