import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { EditorProvider } from "./context/EditorProvider.tsx";
import App from "./App.jsx";

import { BrowserRouter, Routes, Route } from "react-router-dom";
import AuthCallback from "./routes/AuthCallback.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <EditorProvider>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
        </Routes>
      </EditorProvider>
    </BrowserRouter>
  </StrictMode>
);
