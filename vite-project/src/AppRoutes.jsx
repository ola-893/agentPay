import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import CREWorkflow from './pages/CREWorkflow'
import Streams from './pages/Streams'
import AgentConsolePage from './pages/AgentConsolePage'
import Docs from './pages/Docs'

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Layout><CREWorkflow /></Layout>} />
      <Route path="/cre" element={<Layout><CREWorkflow /></Layout>} />
      <Route path="/dashboard" element={<Layout><Dashboard /></Layout>} />
      <Route path="/streams" element={<Layout><Streams /></Layout>} />
      <Route path="/agent" element={<Layout><AgentConsolePage /></Layout>} />
      <Route path="/docs" element={<Docs />} />
      <Route path="/docs/:section" element={<Docs />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

