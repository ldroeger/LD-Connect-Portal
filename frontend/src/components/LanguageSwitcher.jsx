import React, { useState } from 'react'
import { LANGUAGES } from '../i18n/translations.js'
import { useLang } from '../contexts/LanguageContext.jsx'

export default function LanguageSwitcher({ compact = false }) {
  const { lang, changeLang } = useLang()
  const [open, setOpen] = useState(false)
  const current = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0]

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        title="Language / Sprache"
        style={{
          width: 34, height: 34, borderRadius: 8,
          border: '1px solid var(--border)',
          background: 'var(--surface-2)',
          cursor: 'pointer', fontSize: '1.1rem',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {current.flag}
      </button>

      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setOpen(false)} />
          <div style={{
            position: 'absolute', right: 0, top: 40, zIndex: 100,
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 10, boxShadow: 'var(--shadow-lg)',
            padding: 6, minWidth: 160,
          }}>
            {LANGUAGES.map(l => (
              <div
                key={l.code}
                onClick={() => { changeLang(l.code); setOpen(false) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', borderRadius: 6, cursor: 'pointer',
                  background: lang === l.code ? 'var(--primary-light)' : 'transparent',
                  color: lang === l.code ? 'var(--primary)' : 'var(--text)',
                  fontWeight: lang === l.code ? 600 : 400,
                  fontSize: '0.88rem',
                }}
              >
                <span style={{ fontSize: '1.1rem' }}>{l.flag}</span>
                <span>{l.label}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
