import { Routes, Route, Navigate, Link } from 'react-router-dom';
import Layout from './components/Layout';
import CREWorkflow from './pages/CREWorkflow';
import Docs from './pages/Docs';

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<CREWorkflow />} />
        <Route path="cre" element={<Navigate to="/" replace />} />
        <Route path="docs" element={<Docs />} />
        <Route path="docs/:section" element={<Docs />} />
        <Route
          path="*"
          element={
            <section className="panel p-8 text-center">
              <p className="eyebrow">404 / Page not found</p>
              <h1 className="page-title mt-3">This page isn’t here.</h1>
              <p className="mt-3 text-slate-400">
                Use the navigation or return to the workflow.
              </p>
              <Link to="/" className="btn-primary mt-6">
                Open CRE workflow
              </Link>
            </section>
          }
        />
      </Route>
    </Routes>
  );
}
