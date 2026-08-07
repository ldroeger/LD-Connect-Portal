import React, { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx'
import { BrandingProvider } from './contexts/BrandingContext.jsx'
import { ThemeProvider } from './contexts/ThemeContext.jsx'
import api from './utils/api.js'
import FeatureGate from './components/FeatureGate.jsx'

import SetupWizard from './pages/SetupWizard.jsx'
import LoginPage from './pages/LoginPage.jsx'
import { SetPasswordPage, ForgotPasswordPage } from './pages/AuthPages.jsx'
import CalendarPage from './pages/CalendarPage.jsx'
import SickPage from './pages/SickPage.jsx'
import DocumentsPage from './pages/DocumentsPage.jsx'
import CertPage from './pages/CertPage.jsx'
import DocumentsManagePage from './pages/DocumentsManagePage.jsx'
import VacationPage from './pages/VacationPage.jsx'
import VacationApprovePage from './pages/VacationApprovePage.jsx'
import HoursPage from './pages/HoursPage.jsx'
import AdminPage from './pages/AdminPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import DisplayScreen from './pages/DisplayScreen.jsx'
import DisplayManagePage from './pages/DisplayManagePage.jsx'
import NewsPage from './pages/NewsPage.jsx'
import TodosPage from './pages/TodosPage.jsx'
import ToolsPage from './pages/ToolsPage.jsx'
import ToolsSearchPage from './pages/ToolsSearchPage.jsx'
import Layout from './components/Layout.jsx'
import ManagerDashboard from './pages/ManagerDashboard.jsx'

function AppRoutes() {
  const { user, loading } = useAuth()
  const [setupComplete, setSetupComplete] = useState(null)

  useEffect(() => {
    api.get('/setup/status')
      .then(res => setSetupComplete(res.data.complete))
      .catch(() => setSetupComplete(true))
  }, [])

  if (loading || setupComplete === null) return <LoadingScreen />
  if (!setupComplete) return <SetupWizard onComplete={() => setSetupComplete(true)} />

  const canApprove = user?.role === 'admin' || user?.role === 'vacation_approver'
  const features = { calendar: true, vacation: true, hours: true, ...(user?.features || {}) }

  return (
    <Routes>
      <Route path="/display/:token" element={<DisplayScreen />} />
      <Route path="/login" element={user ? <Navigate to="/" /> : <LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/set-password" element={<SetPasswordPage />} />
      <Route path="/reset-password" element={<SetPasswordPage />} />
      {user ? (
        <Route element={<Layout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/calendar" element={<FeatureGate feature="calendar"><CalendarPage /></FeatureGate>} />
          <Route path="/documents" element={<FeatureGate feature="documents"><DocumentsPage /></FeatureGate>} />
          <Route path="/documents-manage" element={<DocumentsManagePage />} />
          <Route path="/admin/ssl" element={<CertPage />} />
          <Route path="/sick" element={<FeatureGate feature="sick"><SickPage /></FeatureGate>} />
          {features.vacation && <Route path="/vacation" element={<FeatureGate feature="vacation"><VacationPage /></FeatureGate>} />}
          {features.hours    && <Route path="/hours" element={<FeatureGate feature="hours"><HoursPage /></FeatureGate>} />}
          {canApprove && <Route path="/vacation-approve" element={<VacationApprovePage />} />}
          {user.role === 'admin' && <Route path="/admin/*" element={<AdminPage />} />}
          {(user.role === 'admin' || user.role === 'vacation_approver' || user.role === 'manager') && <Route path="/manager/*" element={<ManagerDashboard />} />}
          {user.role === 'admin' && <Route path="/display-manage" element={<DisplayManagePage />} />}
          <Route path="/news" element={<FeatureGate feature="news_read"><NewsPage /></FeatureGate>} />
          <Route path="/tools" element={<FeatureGate feature="tools"><ToolsPage /></FeatureGate>} />
              <Route path="/tools-search" element={<FeatureGate feature="tools_search"><ToolsSearchPage /></FeatureGate>} />
              <Route path="/todos" element={<FeatureGate feature="todos_read"><TodosPage /></FeatureGate>} />
          <Route path="*" element={<Navigate to="/" />} />
        </Route>
      ) : (
        <Route path="*" element={<Navigate to="/login" />} />
      )}
    </Routes>
  )
}

function LoadingScreen() {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', flexDirection:'column', gap:16 }}>
      <div style={{ width:40, height:40, borderRadius:'50%', border:'3px solid var(--border)', borderTopColor:'var(--primary)', animation:'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }
      .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; z-index:1000; padding:16px; }
      .modal-card { width:min(720px,94vw); max-height:92vh; overflow-y:auto; background:var(--surface); border-radius:16px; box-shadow:0 24px 64px rgba(0,0,0,0.4); }
      @media(max-width:600px) { .modal-card { width:100%; border-radius:12px; } }
`}</style>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <BrandingProvider>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrandingProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
