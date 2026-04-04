import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useLang } from '../contexts/LanguageContext.jsx'
import { tr } from '../i18n/translations.js'

export default function FeatureGate({ feature, children }) {
  const { user } = useAuth()
  const { lang } = useLang()
  const navigate = useNavigate()

  const allowed = user?.features?.[feature] !== false

  if (allowed) return children

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>🔒</div>
        <h2 style={{ marginBottom: 8, color: 'var(--text)' }}>{tr(lang,'no_access')}</h2>
        <p style={{ color: 'var(--text-3)', marginBottom: 24, fontSize: '0.9rem', lineHeight: 1.6 }}>
          {tr(lang,'no_access_text')}<br />
          {tr(lang,'no_access_contact')}
        </p>
        <button
          onClick={() => navigate('/')}
          style={{ padding: '10px 24px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>
          {tr(lang,'to_dashboard')}
        </button>
      </div>
    </div>
  )
}
