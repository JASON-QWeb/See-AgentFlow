import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";
import { Screensaver } from "./screensaver/Screensaver.jsx";
import "./styles.css";
import "./themes.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {location.pathname === '/screensaver' ? <Screensaver /> : <App desktop={new URLSearchParams(location.search).has('desktop')} />}
  </React.StrictMode>,
);
