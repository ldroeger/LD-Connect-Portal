import React, { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useBranding } from '../contexts/BrandingContext.jsx'
import { useTheme } from '../contexts/ThemeContext.jsx'
import LanguageSwitcher from './LanguageSwitcher.jsx'
import { useLang } from '../contexts/LanguageContext.jsx'

const navLink = (active) => ({
  display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:8,
  textDecoration:'none', color: active ? 'var(--primary)' : 'var(--text-2)',
  fontSize:'0.88rem', fontWeight: active ? 600 : 500,
  background: active ? 'var(--primary-light)' : 'transparent',
})

export default function Layout() {
  const { user, logout, isAdmin } = useAuth()
  const { branding } = useBranding()
  const navigate = useNavigate()
  const { dark, toggle } = useTheme()
  const { lang, tr } = useLang()
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const initials = user?.name?.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase() || '?'

  const canApprove = user?.role === 'admin' || user?.role === 'vacation_approver'
  const features = { calendar: true, vacation: true, hours: true, ...(user?.features || {}) }

  const NavItems = ({ onNavigate }) => (
    <>
      <div style={{ fontSize:'0.68rem', fontWeight:600, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em', padding:'12px 12px 4px' }}>
          {tr('nav_overview')}
        </div>
      <NavLink to="/" end style={({isActive})=>navLink(isActive)} onClick={onNavigate}><span>🏠</span><span>{tr('nav_dashboard')}</span></NavLink>
      {!!features.calendar && <NavLink to="/calendar" style={({isActive})=>navLink(isActive)} onClick={onNavigate}><span>📅</span><span>{tr('nav_calendar')}</span></NavLink>}
      {!!features.vacation && <NavLink to="/vacation" style={({isActive})=>navLink(isActive)} onClick={onNavigate}><span>🌴</span><span>{tr('nav_vacation')}</span></NavLink>}
      {features.hours    && <NavLink to="/hours" style={({isActive})=>navLink(isActive)} onClick={onNavigate}><span>⏱</span><span>{tr('nav_hours')}</span></NavLink>}
      {(user?.features?.news_read !== false) && <NavLink to="/news" style={({isActive})=>navLink(isActive)} onClick={onNavigate}><span>📰</span><span>{tr('nav_news')}</span></NavLink>}
      {(user?.features?.todos_read !== false) && <NavLink to="/todos" style={({isActive})=>navLink(isActive)} onClick={onNavigate}><span>✅</span><span>{tr('nav_todos')}</span></NavLink>}
      {(user?.features?.tools !== false) && <NavLink to="/tools" style={({isActive})=>navLink(isActive)} onClick={onNavigate}><span>🔧</span><span>{tr('nav_tools')}</span></NavLink>}
      {(user?.features?.tools_search !== false) && <NavLink to="/tools-search" style={({isActive})=>navLink(isActive)} onClick={onNavigate}><span>🔍</span><span>{tr('nav_tools_search')}</span></NavLink>}

      {canApprove && <>
        <div style={{ fontSize:'0.68rem', fontWeight:600, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em', padding:'12px 12px 4px' }}>
          {tr('nav_approval')}
        </div>
        <NavLink to="/vacation-approve" style={({isActive})=>navLink(isActive)} onClick={onNavigate}><span>✅</span><span>{tr('nav_vacation_approve')}</span></NavLink>
      </>}

      {isAdmin && <>
        <div style={{ fontSize:'0.68rem', fontWeight:600, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em', padding:'12px 12px 4px' }}>
          {tr('nav_admin')}
        </div>
        <NavLink to="/admin" style={({isActive})=>navLink(isActive)} onClick={onNavigate}><span>⚙️</span><span>{tr('nav_settings')}</span></NavLink>
        <NavLink to="/display-manage" style={({isActive})=>navLink(isActive)} onClick={onNavigate}><span>🖥</span><span>{tr('nav_display')}</span></NavLink>
      </>}

      <div style={{ borderTop:'1px solid var(--border)', marginTop:8, paddingTop:8 }}>
        <div style={{ ...navLink(false), cursor:'pointer' }} onClick={() => { logout(); navigate('/login') }}>
          <span>🚪</span><span>{tr('nav_logout')}</span>
        </div>
      </div>
    </>
  )

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden' }}>
      {/* Desktop Sidebar */}
      <aside className="sidebar-desktop" style={{ width:240, background:'var(--surface)', borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', flexShrink:0 }}>
        <div style={{ padding:'16px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent: branding.logo_mode==='banner' ? 'center' : 'flex-start', gap:10 }}>
          {branding.logo_url && branding.logo_mode === 'banner' ? (
            <img src={branding.logo_url} alt="Logo" style={{ height:`${branding.banner_height||48}px`, maxWidth:200, objectFit:'contain', display:'block', margin:'0 auto' }} />
          ) : (
            <>
              {branding.logo_url
                ? <img src={branding.logo_url} alt="Logo" style={{ width:32, height:32, objectFit:'contain', borderRadius:6, flexShrink:0 }} />
                : <div style={{ width:32, height:32, background:'var(--primary)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:700, fontSize:'0.85rem', flexShrink:0 }}>PB</div>}
              <div>
                <div style={{ fontWeight:700, fontSize:'1rem', color:'var(--text)', lineHeight:1.2 }}>{branding.company_name}</div>
                <div style={{ fontSize:'0.72rem', color:'var(--text-3)' }}>LD Connect Mitarbeiterportal</div>
              </div>
            </>
          )}
        </div>
        <nav style={{ flex:1, padding:'8px', display:'flex', flexDirection:'column', gap:1, overflowY:'auto' }}>
          <NavItems onNavigate={undefined} />
        </nav>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div style={{ position:'fixed', inset:0, zIndex:200, display:'flex' }}>
          <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.4)' }} onClick={() => setMobileOpen(false)} />
          <div style={{ position:'relative', width:260, background:'var(--surface)', display:'flex', flexDirection:'column', boxShadow:'4px 0 20px rgba(0,0,0,0.15)' }}>
            <div style={{ padding:'16px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                {branding.logo_url && branding.logo_mode === 'banner' ? (
                  <img src={branding.logo_url} alt="Logo" style={{ height:`${Math.min(branding.banner_height||48, 36)}px`, maxWidth:160, objectFit:'contain' }} />
                ) : branding.logo_url ? (
                  <img src={branding.logo_url} alt="Logo" style={{ width:28, height:28, objectFit:'contain', borderRadius:5 }} />
                ) : (
                  <div style={{ width:28, height:28, background:'var(--primary)', borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:700, fontSize:'0.8rem' }}>PB</div>
                )}
                {!(branding.logo_url && branding.logo_mode === 'banner') && <div style={{ fontWeight:700, fontSize:'0.95rem', color:'var(--text)' }}>{branding.company_name}</div>}
              </div>
              <button onClick={() => setMobileOpen(false)} style={{ border:'none', background:'none', fontSize:'1.2rem', cursor:'pointer', color:'var(--text-2)', padding:4 }}>✕</button>
            </div>
            <nav style={{ flex:1, padding:'8px', display:'flex', flexDirection:'column', gap:1, overflowY:'auto' }}>
              <NavItems onNavigate={() => setMobileOpen(false)} />
            </nav>
          </div>
        </div>
      )}

      <main style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0 }}>
        <header style={{ background:'var(--surface)', borderBottom:'1px solid var(--border)', padding:'0 16px 0 20px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0, gap:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <button className="mobile-menu-btn" onClick={() => setMobileOpen(true)}
              style={{ border:'1px solid var(--border)', background:'var(--surface-2)', borderRadius:8, padding:'6px 10px', cursor:'pointer', fontSize:'1rem', lineHeight:1 }}>
              ☰
            </button>
            <div style={{ fontSize:'0.88rem', color:'var(--text-2)' }}>
              Willkommen, <strong style={{ color:'var(--text)' }}>{user?.name}</strong>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <LanguageSwitcher />
            <button onClick={toggle} title={dark ? 'Hell' : 'Dunkel'}
              style={{ width:34, height:34, borderRadius:8, border:'1px solid var(--border)', background:'var(--surface-2)', cursor:'pointer', fontSize:'1rem', display:'flex', alignItems:'center', justifyContent:'center' }}>
              {dark ? '☀️' : '🌙'}
            </button>
          <div style={{ position:'relative' }}>
            <div style={{ width:32, height:32, borderRadius:'50%', background:'var(--primary)', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:600, fontSize:'0.8rem', cursor:'pointer', flexShrink:0 }}
              onClick={() => setMenuOpen(m=>!m)}>
              {initials}
            </div>
            {menuOpen && (
              <div style={{ position:'absolute', right:0, top:40, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, boxShadow:'var(--shadow-lg)', padding:6, minWidth:180, zIndex:100 }}
                onClick={() => setMenuOpen(false)}>
                <div style={{ padding:'8px 14px 6px', borderBottom:'1px solid var(--border)', marginBottom:4 }}>
                  <div style={{ fontWeight:600, fontSize:'0.88rem' }}>{user?.name}</div>
                  <div style={{ fontSize:'0.78rem', color:'var(--text-3)' }}>{user?.email}</div>
                </div>
                <div style={{ padding:'8px 14px', borderRadius:6, cursor:'pointer', fontSize:'0.88rem', color:'var(--error)' }}
                  onClick={() => { logout(); navigate('/login') }}>
                  🚪 Abmelden
                </div>
              </div>
            )}
          </div>
          </div>
        </header>
        <div style={{ flex:1, overflow:'auto', padding:20 }}>
          <Outlet />
        </div>
      </main>

      <style>{`
        @media (min-width: 769px) { .mobile-menu-btn { display: none !important; } }
        @media (max-width: 768px) { .sidebar-desktop { display: none !important; } }
      `}</style>
    </div>
  )
}
