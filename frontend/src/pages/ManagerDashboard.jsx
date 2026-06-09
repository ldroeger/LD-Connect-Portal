import React, { useState, useEffect, useCallback } from 'react'
import { Routes, Route, NavLink, Navigate } from 'react-router-dom'
import api from '../utils/api.js'

// ── Sub-Navigation ────────────────────────────────────────────────────────
const tabStyle = (active) => ({
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '8px 16px', borderRadius: 8, textDecoration: 'none',
  fontSize: '0.88rem', fontWeight: active ? 700 : 500,
  background: active ? 'var(--primary)' : 'var(--surface-2)',
  color: active ? 'white' : 'var(--text-2)',
  border: '1px solid ' + (active ? 'var(--primary)' : 'var(--border)'),
  transition: 'all 0.15s',
})

function SubNav() {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
      <NavLink to="/manager/mitarbeiter" style={({ isActive }) => tabStyle(isActive)}>👥 Mitarbeiter</NavLink>
      <NavLink to="/manager/rechnungen"  style={({ isActive }) => tabStyle(isActive)}>🧾 Rechnungen</NavLink>
      <NavLink to="/manager/offene-posten" style={({ isActive }) => tabStyle(isActive)}>📋 Offene Posten</NavLink>
    </div>
  )
}

// ── Platzhalter-Seite ─────────────────────────────────────────────────────
function ComingSoon({ title, icon }) {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)',
      padding: 48, textAlign: 'center', boxShadow: 'var(--shadow)' }}>
      <div style={{ fontSize: '3rem', marginBottom: 16 }}>{icon}</div>
      <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: 8 }}>{title}</div>
      <div style={{ color: 'var(--text-3)', fontSize: '0.88rem' }}>Wird noch bearbeitet</div>
    </div>
  )
}

// ── Mitarbeiter-Auswertung (bisheriges Dashboard) ─────────────────────────
const fmtH    = h => h == null ? '—' : (h >= 0 ? '+' : '') + Math.round(h * 10) / 10 + 'h'
const fmtDays = d => d == null ? '—' : d + ' Tag' + (d !== 1 ? 'e' : '')

function StatBadge({ label, value, color }) {
  return (
    <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '10px 14px', flex: 1, minWidth: 90 }}>
      <div style={{ fontSize: '1.3rem', fontWeight: 800, color: color || 'var(--primary)' }}>{value}</div>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginTop: 2 }}>{label}</div>
    </div>
  )
}

function MitarbeiterTab() {
  const [data, setData]     = useState([])
  const [users, setUsers]   = useState([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('month')
  const [date, setDate]     = useState(() => new Date().toISOString().split('T')[0])
  const [userId, setUserId] = useState('all')

  const load = useCallback(() => {
    setLoading(true)
    api.get(`/manager/overview?period=${period}&date=${date}&user_id=${userId}`)
      .then(r => { setData(r.data.rows || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [period, date, userId])

  useEffect(() => { api.get('/manager/users').then(r => setUsers(r.data.users || [])).catch(() => {}) }, [])
  useEffect(() => { load() }, [load])

  const periodLabel = { day: 'Tag', week: 'Woche', month: 'Monat', year: 'Jahr' }

  const dateLabel = () => {
    const d = new Date(date)
    if (period === 'year')  return d.getFullYear()
    if (period === 'month') return d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
    if (period === 'week') {
      const mon = new Date(d); mon.setDate(d.getDate() - ((d.getDay() || 7) - 1))
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
      return `${mon.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} – ${sun.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}`
    }
    return d.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const shift = dir => {
    const d = new Date(date)
    if (period === 'day')   d.setDate(d.getDate() + dir)
    if (period === 'week')  d.setDate(d.getDate() + dir * 7)
    if (period === 'month') d.setMonth(d.getMonth() + dir)
    if (period === 'year')  d.setFullYear(d.getFullYear() + dir)
    setDate(d.toISOString().split('T')[0])
  }

  return (
    <>
      {/* Filter */}
      <div style={{ background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)',
        padding: '16px 20px', boxShadow: 'var(--shadow)', marginBottom: 20,
        display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
          {['day', 'week', 'month', 'year'].map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              style={{ padding: '6px 14px', border: 'none', cursor: 'pointer', fontFamily: 'var(--font)',
                fontSize: '0.82rem', fontWeight: period === p ? 700 : 400,
                background: period === p ? 'var(--primary)' : 'var(--surface-2)',
                color: period === p ? 'white' : 'var(--text)' }}>
              {periodLabel[p]}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={() => shift(-1)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface-2)', cursor: 'pointer' }}>‹</button>
          <span style={{ minWidth: 180, textAlign: 'center', fontSize: '0.88rem', fontWeight: 600 }}>{dateLabel()}</span>
          <button onClick={() => shift(1)}  style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface-2)', cursor: 'pointer' }}>›</button>
          <button onClick={() => setDate(new Date().toISOString().split('T')[0])}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface-2)', cursor: 'pointer', fontSize: '0.8rem' }}>
            Heute
          </button>
        </div>
        <select value={userId} onChange={e => setUserId(e.target.value)}
          style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)',
            background: 'var(--surface-2)', color: 'var(--text)', fontFamily: 'var(--font)', fontSize: '0.88rem' }}>
          <option value="all">Alle Mitarbeiter</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.powerbird_id})</option>)}
        </select>
        <button onClick={load} style={{ padding: '7px 14px', borderRadius: 8, border: 'none',
          background: 'var(--primary)', color: 'white', cursor: 'pointer', fontFamily: 'var(--font)', fontWeight: 600, fontSize: '0.85rem' }}>
          🔄
        </button>
      </div>

      {/* Summen */}
      {data.length > 0 && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
          <StatBadge label="Urlaub gesamt" value={fmtDays(data.reduce((s,r) => s+(r.vacation_days||0),0))} color="var(--success)" />
          <StatBadge label="Krank gesamt"  value={fmtDays(data.reduce((s,r) => s+(r.sick_days||0),0))}  color="#EF4444" />
          <StatBadge label="Stunden"       value={fmtH(data.reduce((s,r) => s+(r.hours_worked||0),0))}  color="var(--primary)" />
          <StatBadge label="Mitarbeiter"   value={data.length} color="var(--warning)" />
        </div>
      )}

      {/* Tabelle */}
      <div style={{ background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>Lädt...</div>
        ) : data.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>Keine Daten für diesen Zeitraum</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)', fontSize: '0.78rem', color: 'var(--text-3)', textAlign: 'left' }}>
                <th style={{ padding: '10px 16px', fontWeight: 600 }}>Mitarbeiter</th>
                <th style={{ padding: '10px 12px', fontWeight: 600 }}>🌴 Urlaub</th>
                <th style={{ padding: '10px 12px', fontWeight: 600 }}>⏳ Beantragt</th>
                <th style={{ padding: '10px 12px', fontWeight: 600 }}>🤒 Krank</th>
                <th style={{ padding: '10px 12px', fontWeight: 600 }}>⏱ Stunden</th>
                <th style={{ padding: '10px 12px', fontWeight: 600 }}>📅 Termine</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r, i) => (
                <tr key={r.user_id} style={{ borderTop: '1px solid var(--border)', background: i%2===0 ? 'transparent' : 'var(--surface-2)' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{r.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{r.powerbird_id}</div>
                  </td>
                  <td style={{ padding: '12px', color: 'var(--success)', fontWeight: 600 }}>{fmtDays(r.vacation_days)}</td>
                  <td style={{ padding: '12px', color: '#6366F1' }}>{fmtDays(r.vacation_pending)}</td>
                  <td style={{ padding: '12px', color: r.sick_days > 3 ? '#EF4444' : 'var(--text)' }}>{fmtDays(r.sick_days)}</td>
                  <td style={{ padding: '12px' }}>{fmtH(r.hours_worked)}</td>
                  <td style={{ padding: '12px' }}>{r.appointments ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}

// ── Haupt-Komponente ──────────────────────────────────────────────────────
export default function ManagerDashboard() {
  return (
    <div style={{ maxWidth: 1800 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: '1.3rem', fontWeight: 800 }}>📊 Geschäftsführer-Dashboard</h1>
      </div>
      <SubNav />
      <Routes>
        <Route index element={<Navigate to="mitarbeiter" replace />} />
        <Route path="mitarbeiter"   element={<MitarbeiterTab />} />
        <Route path="rechnungen"    element={<ComingSoon title="Rechnungen" icon="🧾" />} />
        <Route path="offene-posten" element={<ComingSoon title="Offene Posten" icon="📋" />} />
      </Routes>
    </div>
  )
}
