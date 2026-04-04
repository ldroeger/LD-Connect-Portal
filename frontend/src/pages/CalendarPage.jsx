import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Calendar, momentLocalizer, Views } from 'react-big-calendar'
import moment from 'moment'
import 'moment/dist/locale/de'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import api from '../utils/api.js'
import ApptDetailPopup from '../components/ApptDetailPopup.jsx'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useBranding } from '../contexts/BrandingContext.jsx'

moment.locale('de')
const localizer = momentLocalizer(moment)

function labelColor(label, labelColors) {
  if (!label) return '#64748B'
  const found = labelColors.find(l => l.name === label)
  return found ? found.color : '#64748B'
}

function getTextColor(hex) {
  const num = parseInt((hex || '#64748B').replace('#', ''), 16)
  const r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255
  return (r * 299 + g * 587 + b * 114) / 1000 > 128 ? '#000000' : '#ffffff'
}

const fmtDt = d => new Date(d).toLocaleString('de-DE', {
  day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit'
})

export default function CalendarPage() {
  const { user } = useAuth()
  const { branding } = useBranding()
  const isMobile = window.innerWidth < 768
  const rangeDays = branding.calendar_range_days || 14
  const maxDate = new Date(Date.now() + rangeDays * 86400000)
  const scrollTime = branding.scroll_to_time || '08:00'

  const [events, setEvents] = useState([])
  const [labels, setLabels] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)
  const [view, setView] = useState(isMobile ? Views.AGENDA : Views.MONTH)
  const [currentDate, setCurrentDate] = useState(new Date())
  const calendarContainerRef = useRef(null)


  const loadLabels = useCallback(() => {
    Promise.all([
      api.get('/calendar/labels').catch(() => ({ data: { labels: [] } })),
      api.get('/branding/labels').catch(() => ({ data: { labels: [] } })),
    ]).then(([pbRes, savedRes]) => {
      const saved = {}
      savedRes.data.labels.forEach(l => saved[l.name] = l.color)
      setLabels(pbRes.data.labels.map(l => ({
        name: l.name,
        color: saved[l.name] || l.color
      })))
    })
  }, [])

  useEffect(() => { loadLabels() }, [loadLabels])

  const fetchEvents = useCallback(async (from, to) => {
    const clampedTo = to > maxDate ? maxDate : to
    setLoading(true); setError('')
    try {
      const f = from.toISOString().split('T')[0]
      const t = clampedTo.toISOString().split('T')[0]
      const r = await api.get(`/calendar/appointments?from=${f}&to=${t}`)
      setEvents(r.data.appointments.map(a => ({
        ...a,
        title: a.title || '(kein Betreff)',
        start: new Date(a.start),
        end: new Date(a.end || a.start),
        allDay: a.allDay,
      })))
    } catch(e) {
      setError(e.response?.data?.error || 'Fehler beim Laden')
    }
    setLoading(false)
  }, [rangeDays])

  useEffect(() => {
    const from = new Date(); from.setDate(1)
    const to = new Date(from.getFullYear(), from.getMonth() + 1, 0)
    fetchEvents(from, to)
  }, [fetchEvents])

  const handleNavigate = useCallback((date, v) => {
    setCurrentDate(date)
    const viewToUse = v || view
    let from, to

    if (viewToUse === Views.MONTH) {
      from = new Date(date.getFullYear(), date.getMonth(), 1)
      to   = new Date(date.getFullYear(), date.getMonth() + 1, 0)
    } else if (viewToUse === Views.WEEK) {
      from = moment(date).startOf('isoWeek').toDate()
      to   = moment(date).endOf('isoWeek').toDate()
    } else if (viewToUse === Views.DAY) {
      from = new Date(date); from.setHours(0, 0, 0, 0)
      to   = new Date(date); to.setHours(23, 59, 59, 999)
    } else {
      from = new Date(date)
      to   = new Date(Date.now() + rangeDays * 86400000)
    }

    if (from > maxDate) {
      setError(`Kalender nur bis ${maxDate.toLocaleDateString('de-DE')} verfügbar`)
      return
    }
    setError('')
    fetchEvents(from, to)
  }, [view, fetchEvents, rangeDays])

  const handleView = useCallback((newView) => {
    setView(newView)
    handleNavigate(currentDate, newView)
  }, [currentDate, handleNavigate])

  const eventStyleGetter = (event) => {
    const color = event.termColor || labelColor(event.label, labels) || 'var(--primary)'
    return {
      style: {
        backgroundColor: color,
        border: 'none',
        borderRadius: 5,
        color: getTextColor(color),
        fontWeight: 500,
        fontSize: '0.78rem',
        padding: '2px 6px',
      }
    }
  }


  // Calendar height - leave room for header
  const calHeight = Math.max(400, window.innerHeight - (isMobile ? 200 : 240))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h1 style={{ fontSize: '1.2rem', fontWeight: 700 }}>📅 Mein Kalender</h1>
          <p style={{ color: 'var(--text-3)', fontSize: '0.82rem', marginTop: 2 }}>
            {user?.name} · sichtbar bis {maxDate.toLocaleDateString('de-DE')}
          </p>
        </div>
        {loading && <span style={{ fontSize: '0.82rem', color: 'var(--text-3)' }}>Lädt...</span>}
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--error)', padding: '10px 14px', borderRadius: 8, fontSize: '0.85rem' }}>
          {error}
        </div>
      )}



      {/* Calendar wrapper with ref for scroll */}
      <div
        ref={calendarContainerRef}
        style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', padding: 16, boxShadow: 'var(--shadow)', flex: 1 }}>
        <style>{`
          .rbc-time-content {
            overflow-y: auto !important;
            -webkit-overflow-scrolling: touch !important;
          }
          .rbc-time-view .rbc-allday-cell { max-height: 60px; overflow-y: auto; }
          .rbc-header { background: var(--surface-2) !important; border-color: var(--border) !important; color: var(--text-2) !important; padding: 8px !important; font-size: 0.78rem !important; font-weight: 600 !important; text-transform: uppercase; letter-spacing: 0.05em; }
          .rbc-today { background: var(--primary-light) !important; }
          .rbc-off-range-bg { background: var(--surface-2) !important; }
          .rbc-event { border-radius: 5px !important; border: none !important; }
          .rbc-toolbar button { background: var(--surface) !important; color: var(--text) !important; border: 1px solid var(--border) !important; border-radius: 8px !important; padding: 6px 12px !important; font-size: 0.82rem !important; cursor: pointer !important; }
          .rbc-toolbar button.rbc-active { background: var(--primary) !important; color: white !important; border-color: var(--primary) !important; }
          .rbc-toolbar button:hover { background: var(--primary-light) !important; color: var(--primary) !important; }
          .rbc-toolbar-label { font-weight: 700 !important; color: var(--text) !important; }
          .rbc-toolbar { flex-wrap: wrap !important; gap: 8px !important; margin-bottom: 12px !important; }
          .rbc-label { color: var(--text-2) !important; font-size: 0.78rem !important; }
          .rbc-current-time-indicator { background: var(--primary) !important; height: 2px !important; }
          .rbc-show-more { color: var(--primary) !important; font-weight: 600 !important; }
          .rbc-month-row, .rbc-day-slot .rbc-time-slot, .rbc-timeslot-group, .rbc-time-content, .rbc-allday-cell { border-color: var(--border) !important; }
          .rbc-agenda-view table { background: var(--surface) !important; }
          .rbc-agenda-date-cell, .rbc-agenda-time-cell, .rbc-agenda-event-cell { color: var(--text) !important; background: var(--surface) !important; border-color: var(--border) !important; }
        `}</style>
        <Calendar
          localizer={localizer}
          events={events}
          style={{ height: calHeight }}
          view={view}
          date={currentDate}
          onView={handleView}
          onNavigate={handleNavigate}
          onSelectEvent={e => { console.log('EVENT:', e.id, e.label, e.termColor); setSelected(e) }}
          eventPropGetter={eventStyleGetter}
          views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
          step={60}
          timeslots={1}
          min={(() => { const [h,m] = (branding.cal_min_time||'06:00').split(':').map(Number); return new Date(1970,1,1,h,m,0) })()}
          max={(() => { const [h,m] = (branding.cal_max_time||'22:00').split(':').map(Number); return new Date(1970,1,1,h,m,0) })()}
          popup
          messages={{
            today: 'Heute', previous: '‹', next: '›',
            month: 'Monat', week: 'Woche', day: 'Tag', agenda: 'Liste',
            allDay: 'Ganztag', noEventsInRange: 'Keine Termine',
            showMore: n => `+${n}`,
            date: 'Datum', time: 'Uhrzeit', event: 'Termin',
          }}
        />
      </div>

      {selected && (
        <ApptDetailPopup
          recno={selected.id}
          label={selected.label}
          termColor={selected.termColor}
          labelColors={(() => { const m={}; labels.forEach(l=>{ m[l.name]=l.color }); return m })()}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
