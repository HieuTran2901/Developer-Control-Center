import React from "react";

import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/globals.css";

// Force dark mode for now as requested
document.documentElement.classList.add("dark");

createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

