import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../utils/api.js'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useLang } from '../contexts/LanguageContext.jsx'
import { translate } from '../i18n/translations.js'

const fmtTime = d => { if (!d) return ''; const t = new Date(d); return `${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}` }
const fmtH = h => (h >= 0 ? '+' : '') + `${Math.round(h*100)/100}h`

function getTextColor(hex) {
  if (!hex) return '#ffffff'
  const num = parseInt(hex.replace('#',''), 16)
  const r=(num>>16)&255, g=(num>>8)&255, b=num&255
  return (r*299+g*587+b*114)/1000 > 128 ? '#000000' : '#ffffff'
}

function StatCard({ icon, label, value, color, onClick, sub }) {
  return (
    <div onClick={onClick} style={{ background:'var(--surface)', borderRadius:14, border:'1px solid var(--border)', padding:'18px 16px', boxShadow:'var(--shadow)', cursor:onClick?'pointer':'default', transition:'transform 0.15s, box-shadow 0.15s', flex:1, minWidth:130 }}
      onMouseEnter={e=>{ if(onClick){ e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 6px 16px rgba(0,0,0,0.12)' }}}
      onMouseLeave={e=>{ if(onClick){ e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='var(--shadow)' }}}>
      <div style={{ fontSize:'1.4rem', marginBottom:8 }}>{icon}</div>
      <div style={{ fontSize:'1.6rem', fontWeight:800, color:color||'var(--primary)', lineHeight:1 }}>{value}</div>
      <div style={{ fontSize:'0.75rem', color:'var(--text-3)', marginTop:4 }}>{label}</div>
      {sub && <div style={{ fontSize:'0.72rem', color:'var(--text-3)', marginTop:2 }}>{sub}</div>}
    </div>
  )
}

function NavCard({ icon, title, desc, onClick, color }) {
  return (
    <div onClick={onClick} style={{ background:'var(--surface)', borderRadius:14, border:'1px solid var(--border)', padding:'16px', cursor:'pointer', transition:'all 0.15s', boxShadow:'var(--shadow)' }}
      onMouseEnter={e=>{ e.currentTarget.style.borderColor=color; e.currentTarget.style.transform='translateY(-2px)' }}
      onMouseLeave={e=>{ e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.transform='none' }}>
      <div style={{ fontSize:'1.6rem', marginBottom:8 }}>{icon}</div>
      <div style={{ fontWeight:700, fontSize:'0.9rem' }}>{title}</div>
      <div style={{ fontSize:'0.75rem', color:'var(--text-3)', marginTop:3 }}>{desc}</div>
    </div>
  )
}

export default function DashboardPage() {
  const { user, isAdmin } = useAuth()
  const { lang } = useLang()
  const navigate = useNavigate()
  const [appointments, setAppointments] = useState([])
  const [labels, setLabels] = useState({})
  const [saldo, setSaldo] = useState(null)
  const [urlaubStats, setUrlaubStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [toolAlerts, setToolAlerts] = useState([])
  const features = { calendar: true, vacation: true, hours: true, ...(user?.features || {}) }

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    // Werkzeug-Alerts
    if (user?.features?.tools !== false) {
      api.get('/calendar/tools-alerts').then(r => setToolAlerts(r.data.alerts || [])).catch(() => {})
    }
    Promise.all([
      api.get(`/calendar/appointments?from=${today}&to=${today}`).catch(() => ({ data: { appointments: [] } })),
      api.get(`/calendar/hours?year=${new Date().getFullYear()}`).catch(() => null),
      api.get(`/vacation/stats?year=${new Date().getFullYear()}`).catch(() => null),
      api.get('/branding/labels').catch(() => ({ data: { labels: [] } })),
    ]).then(([apptRes, hoursRes, vacRes, labelsRes]) => {
      setAppointments(apptRes.data.appointments || [])
      if (hoursRes) setSaldo(hoursRes.data.total_saldo)
      if (vacRes) setUrlaubStats(vacRes.data)
      const map = {}
      labelsRes.data.labels?.forEach(l => map[l.name] = l.color)
      setLabels(map)
      setLoading(false)
    })
  }, [])

  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? translate(lang,'dash_morning') : hour < 18 ? translate(lang,'dash_day') : translate(lang,'dash_evening')

  return (
    <div style={{ maxWidth:1400 }}>
      {/* Greeting */}
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:'1.4rem', fontWeight:800 }}>
          {greeting}, {user?.name?.split(' ')[0]}!
        </h1>
        <p style={{ color:'var(--text-3)', fontSize:'0.88rem', marginTop:2 }}>
          {now.toLocaleDateString('de-DE', { weekday:'long', day:'2-digit', month:'long', year:'numeric' })}
        </p>
      </div>

      {/* Stats */}
      <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:24 }}>
        {features.calendar && (
          <StatCard icon="📅" label="Termine heute" value={loading ? '...' : appointments.length}
            color="var(--primary)" onClick={() => navigate('/calendar')} />
        )}
        {features.hours && saldo !== null && (
          <StatCard icon="⏱" label="Stundensaldo" value={loading ? '...' : fmtH(saldo)}
            color={saldo >= 0 ? 'var(--success)' : 'var(--error)'}
            onClick={() => navigate('/hours')} />
        )}
        {features.vacation && urlaubStats?.offen_tage != null && (
          <StatCard icon="🌴" label="Urlaub offen" value={loading ? '...' : urlaubStats.offen_tage}
            color="var(--warning)" onClick={() => navigate('/vacation')}
            sub={urlaubStats.anspruch ? `von ${urlaubStats.anspruch} Tagen` : null} />
        )}
        {features.vacation && urlaubStats?.beantragt_anz > 0 && (
          <StatCard icon="⏳" label="Urlaubsantrag" value={urlaubStats.beantragt_anz}
            color="#6366F1" onClick={() => navigate('/vacation')} sub="ausstehend" />
        )}
      </div>

      {/* Quick nav */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px,1fr))', gap:10, marginBottom:28 }}>
        {features.calendar && <NavCard icon="📅" title="Kalender" desc="Alle Termine" onClick={() => navigate('/calendar')} color="#3B82F6" />}
        {features.vacation && <NavCard icon="🌴" title="Urlaub" desc="Beantragen & verwalten" onClick={() => navigate('/vacation')} color="#10B981" />}
        {features.hours && <NavCard icon="⏱" title="Stunden" desc="Zeiterfassung" onClick={() => navigate('/hours')} color="#F59E0B" />}
        <NavCard icon="📰" title="News" desc="Neuigkeiten" onClick={() => navigate('/news')} color="#6366F1" />
        <NavCard icon="✅" title="Aufgaben" desc="Zu erledigen" onClick={() => navigate('/todos')} color="#EC4899" />
        {(user?.role === 'admin' || user?.role === 'vacation_approver') && (
          <NavCard icon="✅" title="Urlaubsanträge" desc="Genehmigen" onClick={() => navigate('/vacation-approve')} color="#8B5CF6" />
        )}
        {isAdmin && <NavCard icon="⚙️" title="Einstellungen" desc="Administration" onClick={() => navigate('/admin')} color="#64748B" />}
      </div>


      {/* Werkzeug zurückgeben */}
      {toolAlerts.length > 0 && (
        <div style={{ background:'var(--surface)', borderRadius:14, border:'1px solid #f59e0b', padding:20, boxShadow:'var(--shadow)', marginBottom:20 }}>
          <div style={{ fontWeight:700, fontSize:'1rem', marginBottom:12, display:'flex', alignItems:'center', gap:8 }}>
            🔧 {translate(lang,'dash_tools_return')}
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {toolAlerts.map((a, i) => {
              const start = new Date(a.start)
              const diffH = Math.round((start - new Date()) / 36e5)
              const diffText = diffH < 24 ? `in ${diffH} Stunden` : `in ${Math.round(diffH/24)} Tag${Math.round(diffH/24) !== 1 ? 'en' : ''}`
              return (
                <div key={i} style={{ display:'flex', gap:0, alignItems:'stretch', borderRadius:10, overflow:'hidden', border:'1px solid #fcd34d' }}>
                  <div style={{ width:4, background:'#f59e0b', flexShrink:0 }} />
                  <div style={{ flex:1, padding:'10px 14px', background:'#fffbeb' }}>
                    <div style={{ fontWeight:600, fontSize:'0.9rem', color:'#78350f' }}>🔧 {a.bezeichnung}</div>
                    <div style={{ fontSize:'0.78rem', color:'#92400e', marginTop:2 }}>
                      Wird {diffText} benötigt · {new Date(a.start).toLocaleDateString('de-DE', { weekday:'short', day:'2-digit', month:'2-digit' })} {new Date(a.start).toLocaleTimeString('de-DE', { hour:'2-digit', minute:'2-digit' })} Uhr
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Today's appointments */}
      {features.calendar && (
        <div style={{ background:'var(--surface)', borderRadius:14, border:'1px solid var(--border)', padding:20, boxShadow:'var(--shadow)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <div style={{ fontWeight:700, fontSize:'1rem' }}>📅 Termine heute</div>
            <button onClick={() => navigate('/calendar')} style={{ fontSize:'0.8rem', color:'var(--primary)', background:'none', border:'none', cursor:'pointer', fontFamily:'var(--font)', fontWeight:600 }}>
              Alle →
            </button>
          </div>
          {loading ? (
            <div style={{ color:'var(--text-3)', fontSize:'0.88rem' }}>Lädt...</div>
          ) : appointments.length === 0 ? (
            <div style={{ color:'var(--text-3)', fontSize:'0.88rem', textAlign:'center', padding:'20px 0' }}>
              🎉 Keine Termine heute
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {appointments.map((a, i) => {
                const bgColor = a.termColor || labels[a.label] || 'var(--primary)'
                const txtColor = (a.termColor || labels[a.label]) ? getTextColor(a.termColor || labels[a.label]) : 'white'
                return (
                  <div key={i} style={{ display:'flex', gap:0, alignItems:'stretch', borderRadius:10, overflow:'hidden', border:'1px solid var(--border)' }}>
                    <div style={{ width:4, background:a.termColor || labels[a.label] || 'var(--primary)', flexShrink:0 }} />
                    <div style={{ flex:1, padding:'10px 14px', background:'var(--surface-2)' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                        {a.label && (
                          <span style={{ fontSize:'0.72rem', fontWeight:600, padding:'2px 8px', borderRadius:10, background:a.termColor || labels[a.label] || 'var(--primary)', color:txtColor }}>
                            {a.label}
                          </span>
                        )}
                        <span style={{ fontWeight:600, fontSize:'0.9rem' }}>{a.title}</span>
                      </div>
                      <div style={{ fontSize:'0.78rem', color:'var(--text-3)', marginTop:3 }}>
                        {a.allDay ? 'Ganztag' : `${fmtTime(a.start)} – ${fmtTime(a.end)}`}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
