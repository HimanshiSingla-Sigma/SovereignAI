import { Suspense, lazy, useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useAudioUnlock } from '@/hooks/useSound'
import AppShell from '@/components/layout/AppShell'
import RequirePermission from '@/components/RequirePermission'
import { Loading } from '@/components/ui'
import LoginPage from '@/features/auth/LoginPage'

// Heavy screens (Three.js, force graph, charts) load on demand.
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'))
const GodViewPage = lazy(() => import('@/features/god-view/GodViewPage'))
const DigitalTwinPage = lazy(() => import('@/features/digital-twin/DigitalTwinPage'))
const TelemetryPage = lazy(() => import('@/features/telemetry/TelemetryPage'))
const AnalyticsPage = lazy(() => import('@/features/analytics/AnalyticsPage'))
const SimulationPage = lazy(() => import('@/features/simulation/SimulationPage'))
const AIAssistantPage = lazy(() => import('@/features/ai-assistant/AIAssistantPage'))
const RagPage = lazy(() => import('@/features/rag/RagPage'))
const GraphRagPage = lazy(() => import('@/features/graphrag/GraphRagPage'))
const DocumentsPage = lazy(() => import('@/features/documents/DocumentsPage'))
const SafetyPage = lazy(() => import('@/features/safety/SafetyPage'))
const ApprovalsPage = lazy(() => import('@/features/approvals/ApprovalsPage'))
const NetworkPage = lazy(() => import('@/features/network/NetworkPage'))
const AdminPage = lazy(() => import('@/features/admin/AdminPage'))

export default function App() {
  const { token, stage, hydrating, hydrate } = useAuthStore()

  useAudioUnlock()

  // Re-establish the session from the stored token on a hard refresh.
  useEffect(() => {
    if (token && stage === 'authenticated') void hydrate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!token || stage !== 'authenticated') return <LoginPage />

  if (hydrating) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loading label="Restoring sovereign session…" />
      </div>
    )
  }

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loading />
        </div>
      }
    >
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route
            path="/dashboard"
            element={
              <RequirePermission permission="safety:read">
                <DashboardPage />
              </RequirePermission>
            }
          />
          <Route
            path="/god-view"
            element={
              <RequirePermission permission="machines:read">
                <GodViewPage />
              </RequirePermission>
            }
          />
          <Route
            path="/digital-twin"
            element={
              <RequirePermission permission="machines:read">
                <DigitalTwinPage />
              </RequirePermission>
            }
          />
          <Route
            path="/telemetry"
            element={
              <RequirePermission permission="telemetry:read">
                <TelemetryPage />
              </RequirePermission>
            }
          />
          <Route
            path="/analytics"
            element={
              <RequirePermission permission="telemetry:read">
                <AnalyticsPage />
              </RequirePermission>
            }
          />
          <Route
            path="/simulation"
            element={
              <RequirePermission permission="simulation:run">
                <SimulationPage />
              </RequirePermission>
            }
          />
          <Route
            path="/ai-assistant"
            element={
              <RequirePermission permission="ai:chat">
                <AIAssistantPage />
              </RequirePermission>
            }
          />
          <Route
            path="/rag"
            element={
              <RequirePermission permission="rag:query">
                <RagPage />
              </RequirePermission>
            }
          />
          <Route
            path="/graphrag"
            element={
              <RequirePermission permission="graphrag:query">
                <GraphRagPage />
              </RequirePermission>
            }
          />
          <Route
            path="/documents"
            element={
              <RequirePermission permission="documents:read">
                <DocumentsPage />
              </RequirePermission>
            }
          />
          <Route
            path="/safety"
            element={
              <RequirePermission permission="safety:read">
                <SafetyPage />
              </RequirePermission>
            }
          />
          <Route
            path="/approvals"
            element={
              <RequirePermission permission="safety:read">
                <ApprovalsPage />
              </RequirePermission>
            }
          />
          <Route
            path="/network"
            element={
              <RequirePermission permission="safety:read">
                <NetworkPage />
              </RequirePermission>
            }
          />
          <Route
            path="/admin"
            element={
              <RequirePermission permission="users:read">
                <AdminPage />
              </RequirePermission>
            }
          />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
