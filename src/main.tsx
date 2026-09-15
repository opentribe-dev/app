import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AuthGate } from "./features/auth/AuthGate";
import "@fontsource-variable/inter/wght.css";
import "@fontsource-variable/manrope/wght.css";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><AuthGate><App /></AuthGate></React.StrictMode>);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js"));
}
