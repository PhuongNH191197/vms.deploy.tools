import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Setup from "./pages/Setup";
import Update from "./pages/Update";
import Monitor from "./pages/Monitor";
import Audit from "./pages/Audit";
import Templates from "./pages/Templates";
import Projects from "./pages/Projects";
import BulkDeploy from "./pages/BulkDeploy";
import Layout from "./components/Layout";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/setup" element={<Setup />} />
          <Route path="/update" element={<Update />} />
          <Route path="/monitor" element={<Monitor />} />
          <Route path="/audit" element={<Audit />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/bulk-deploy" element={<BulkDeploy />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  </React.StrictMode>,
);
