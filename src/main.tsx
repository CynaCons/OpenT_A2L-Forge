import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Global error handler for "Blank Screen" debugging
window.addEventListener("error", (event) => {
  const root = document.getElementById("root");
  if (root && root.innerHTML === "") {
    root.innerHTML = `<div style="color: red; padding: 20px;">
      <h1>Application Error</h1>
      <pre>${event.message}</pre>
    </div>`;
  }
});

