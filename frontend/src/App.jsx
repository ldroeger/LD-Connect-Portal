import React, { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx'
import { BrandingProvider } from './contexts/BrandingContext.jsx'
import { ThemeProvider } from './contexts/ThemeContext.jsx'
import api from './utils/api.js'

import SetupWizard from './pages/SetupWizard.jsx'
import LoginPage from './pages/LoginPage.jsx'
import { SetPasswordPage, ForgotPasswordPage } from './pages/AuthPages.jsx'
import CalendarPage from './pages/CalendarPage.jsx'
import VacationPage from './pages/VacationPage.jsx'
import VacationApprovePage from './pages/VacationApprovePage.jsx'
import HoursPage from './pages/HoursPage.jsx'
import AdminPage from './pages/AdminPage.jsx'
import Layout from './components/Layout.jsx'

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
      <Route path="/login" element={user ? <Navigate to="/" /> : <LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/set-password" element={<SetPasswordPage />} />
      <Route path="/reset-password" element={<SetPasswordPage />} />
      {user ? (
        <Route element={<Layout />}>
          <Route path="/" element={
            features.calendar ? <CalendarPage /> :
            features.vacation ? <Navigate to="/vacation" /> :
            features.hours    ? <Navigate to="/hours" /> :
            <div style={{ padding:40, textAlign:'center', color:'var(--text-3)' }}>Keine Funktionen aktiviert.</div>
          } />
          {features.calendar && <Route path="/calendar" element={<CalendarPage />} />}
          {features.vacation && <Route path="/vacation" element={<VacationPage />} />}
          {features.hours    && <Route path="/hours" element={<HoursPage />} />}
          {canApprove && <Route path="/vacation-approve" element={<VacationApprovePage />} />}
          {user.role === 'admin' && <Route path="/admin/*" element={<AdminPage />} />}
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
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
