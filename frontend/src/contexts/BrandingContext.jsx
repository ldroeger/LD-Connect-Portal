import React, { createContext, useContext, useState, useEffect } from 'react'
import api from '../utils/api.js'

const BrandingContext = createContext({
  company_name: 'LD Connect', primary_color: '#2563EB',
  logo_url: '', logo_mode: 'icon', favicon_url: '', banner_height: 48, calendar_range_days: 14, scroll_to_time: '08:00', cal_min_time: '06:00', cal_max_time: '22:00',
})

function darken(hex, amount) {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.max(0, (num >> 16) - amount)
  const g = Math.max(0, ((num >> 8) & 0xFF) - amount)
  const b = Math.max(0, (num & 0xFF) - amount)
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`
}
function lighten(hex, percent) {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.min(255, (num >> 16) + Math.round((255-(num>>16))*percent/100))
  const g = Math.min(255, ((num>>8)&0xFF) + Math.round((255-((num>>8)&0xFF))*percent/100))
  const b = Math.min(255, (num&0xFF) + Math.round((255-(num&0xFF))*percent/100))
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`
}

function applyBranding(data) {
  document.documentElement.style.setProperty('--primary', data.primary_color)
  document.documentElement.style.setProperty('--primary-dark', darken(data.primary_color, 15))
  document.documentElement.style.setProperty('--primary-light', lighten(data.primary_color, 92))
  document.title = `${data.company_name} – LD Connect Mitarbeiterportal`

  // Favicon
  if (data.favicon_url) {
    let link = document.querySelector("link[rel~='icon']")
    if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link) }
    link.href = data.favicon_url
  }
}

export function BrandingProvider({ children }) {
  const [branding, setBranding] = useState({
    company_name: 'LD Connect', primary_color: '#2563EB',
    logo_url: '', logo_mode: 'icon', favicon_url: '', banner_height: 48, calendar_range_days: 14, scroll_to_time: '08:00', cal_min_time: '06:00', cal_max_time: '22:00', cal_min_time: '06:00', cal_max_time: '22:00',
  })

  const refresh = () => {
    api.get('/branding').then(res => {
      setBranding(res.data)
      applyBranding(res.data)
    }).catch(() => {})
  }

  useEffect(() => { refresh() }, [])

  return (
    <BrandingContext.Provider value={{ branding, setBranding, refresh }}>
      {children}
    </BrandingContext.Provider>
  )
}

export const useBranding = () => useContext(BrandingContext)
