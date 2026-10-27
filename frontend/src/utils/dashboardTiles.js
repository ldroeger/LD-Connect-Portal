// Dashboard-Kacheln, die der Admin firmenweit ausblenden kann (Setting: dashboard_hidden_tiles)
export const DASHBOARD_TILES = [
  { key:'stat_appointments',   label:'Termine heute (Zähler)',        group:'Statistik' },
  { key:'stat_overtime',       label:'Überstunden',                   group:'Statistik' },
  { key:'stat_vacation',       label:'Urlaub offen',                  group:'Statistik' },
  { key:'stat_vacation_req',   label:'Urlaubsantrag ausstehend',      group:'Statistik' },
  { key:'nav_calendar',        label:'Kalender',                      group:'Navigation' },
  { key:'nav_vacation',        label:'Urlaub',                        group:'Navigation' },
  { key:'nav_hours',           label:'Stunden',                       group:'Navigation' },
  { key:'nav_news',            label:'News',                          group:'Navigation' },
  { key:'nav_todos',           label:'Aufgaben',                      group:'Navigation' },
  { key:'nav_vacation_approve',label:'Urlaubsanträge (Genehmiger)',   group:'Navigation' },
  { key:'tool_alerts',         label:'Werkzeug-Rückgabe Hinweis',     group:'Bereiche' },
  { key:'appointments_today',  label:'Termine heute (Liste)',         group:'Bereiche' },
]
