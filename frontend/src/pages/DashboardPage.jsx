import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import api from '../utils/api.js'

const StatCard = ({ value, label, color, sub, onClick }) => (
  <div onClick={onClick}
    style={{ background:'var(--surface)', borderRadius:14, border:'1px solid var(--border)',
      padding:'20px 24px', boxShadow:'var(--shadow)', flex:1, minWidth:140,
      cursor: onClick ? 'pointer' : 'default' }}>
    <div style={{ fontSize:'2rem', fontWeight:800, color: color||'var(--text)' }}>{value}</div>
    <div style={{ color:'var(--text-3)', fontSize:'0.82rem', marginTop:4 }}>{label}</div>
    {sub && <div style={{ color:'var(--text-3)', fontSize:'0.75rem', marginTop:2 }}>{sub}</div>}
  </div>
)

const QuickCard = ({ icon, label, sub, to, color, active }) => {
  const nav = useNavigate()
  return (
    <div onClick={() => nav(to)}
      style={{ background:'var(--surface)', borderRadius:14, border: active ? '2px solid '+color : '1px solid var(--border)',
        padding:'18px 20px', boxShadow:'var(--shadow)', cursor:'pointer', display:'flex', flexDirection:'column',
        alignItems:'flex-start', gap:8, minWidth:120, flex:1, transition:'all 0.15s' }}
      onMouseEnter={e => e.currentTarget.style.transform='translateY(-2px)'}
      onMouseLeave={e => e.currentTarget.style.transform='none'}>
      <div style={{ fontSize:'1.6rem' }}>{icon}</div>
      <div style={{ fontWeight:700, fontSize:'0.88rem' }}>{label}</div>
      {sub && <div style={{ fontSize:'0.75rem', color:'var(--text-3)' }}>{sub}</div>}
    </div>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [stats, setStats]   = useState(null)
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const nav = useNavigate()

  useEffect(() => {
    Promise.all([
      api.get('/dashboard/stats').catch(() => ({ data: {} })),
      api.get('/calendar/today').catch(() => ({ data: { appointments: [] } })),
    ]).then(([s, a]) => {
      setStats(s.data)
      setAppointments(a.data.appointments || [])
      setLoading(false)
    })
  }, [])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? '🌅 Guten Morgen' : hour < 18 ? '🌤 Guten Tag' : '🌙 Guten Abend'
  const firstName = user?.name?.split(' ')[0] || ''
  const features = user?.features || {}
  const isAdmin  = user?.role === 'admin'
  const canApprove = user?.role === 'admin' || user?.role === 'vacation_approver'

  const saldo = stats?.stundensaldo || 0
  const hasUeberstunden = saldo > 0

  return (
    <div style={{ width:'100%' }}>
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:'1.4rem', fontWeight:800 }}>{greeting}, {firstName}!</h1>
        <div style={{ color:'var(--text-3)', fontSize:'0.85rem', marginTop:2 }}>
          {new Date().toLocaleDateString('de-DE',{weekday:'long',day:'2-digit',month:'long',year:'numeric'})}
        </div>
      </div>

      {/* Stat-Kacheln */}
      {!loading && (
        <div style={{ display:'flex', gap:14, marginBottom:24, flexWrap:'wrap' }}>
          <StatCard value={appointments.length} label="Termine heute" color="var(--primary)" onClick={() => nav('/calendar')} />
          {hasUeberstunden && (
            <StatCard
              value={(saldo > 0 ? '+' : '') + saldo.toFixed(1) + 'h'}
              label="Überstunden"
              color={saldo >= 0 ? '#10B981' : '#EF4444'}
              onClick={() => nav('/hours')}
            />
          )}
          {stats?.urlaubOffen !== undefined && (
            <StatCard value={stats.urlaubOffen >= 0 ? stats.urlaubOffen : stats.urlaubOffen}
              label={'Urlaub offen'} sub={'von 30 Tagen'}
              color={stats.urlaubOffen < 0 ? '#EF4444' : 'var(--text)'}
              onClick={() => nav('/vacation')} />
          )}
        </div>
      )}

      {/* Quick-Links */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(130px,1fr))', gap:12, marginBottom:28 }}>
        {features.calendar !== false && <QuickCard icon="📅" label="Kalender" sub="Alle Termine" to="/calendar" />}
        {features.vacation !== false && <QuickCard icon="🌴" label="Urlaub" sub="Beantragen & verwalten" to="/vacation" />}
        {features.hours    !== false && <QuickCard icon="⏱" label="Stunden" sub="Zeiterfassung" to="/hours" />}
        {features.news_read !== false && <QuickCard icon="📰" label="News" sub="Neuigkeiten" to="/news" />}
        {features.todos_read !== false && <QuickCard icon="✅" label="Aufgaben" sub="Zu erledigen" to="/todos" />}
        {canApprove && <QuickCard icon="✅" label="Urlaubsanträge" sub="Genehmigen" to="/vacation-approve" />}
        {isAdmin && <QuickCard icon="⚙️" label="Einstellungen" sub="Administration" to="/admin" />}
      </div>

      {/* Termine heute */}
      <div style={{ background:'var(--surface)', borderRadius:14, border:'1px solid var(--border)', overflow:'hidden', boxShadow:'var(--shadow)' }}>
        <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontWeight:700, fontSize:'0.95rem' }}>📅 Termine heute</div>
          <span onClick={() => nav('/calendar')} style={{ fontSize:'0.82rem', color:'var(--primary)', cursor:'pointer', fontWeight:600 }}>Alle →</span>
        </div>
        {loading ? (
          <div style={{ padding:24, color:'var(--text-3)', textAlign:'center' }}>Lädt...</div>
        ) : appointments.length === 0 ? (
          <div style={{ padding:24, color:'var(--text-3)', textAlign:'center', fontSize:'0.9rem' }}>Keine Termine heute</div>
        ) : (
          appointments.map((a, i) => (
            <div key={i} style={{ display:'flex', gap:12, padding:'12px 20px', borderTop: i > 0 ? '1px solid var(--border)' : 'none', alignItems:'center' }}>
              <div style={{ width:4, borderRadius:2, alignSelf:'stretch', background: a.termColor || 'var(--primary)', flexShrink:0 }} />
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:600, fontSize:'0.9rem' }}>{a.label || a.titel || a.subject}</div>
                <div style={{ fontSize:'0.78rem', color:'var(--text-3)', marginTop:2 }}>
                  {a.von || a.start} – {a.bis || a.end}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
