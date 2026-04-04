import React, { createContext, useContext, useState, useEffect } from 'react'
import { detectLang, setLang } from '../i18n/translations.js'

const LanguageContext = createContext()

export function LanguageProvider({ children }) {
  const [lang, setLanguage] = useState(detectLang)

  const changeLang = (code) => {
    setLang(code)
    setLanguage(code)
  }

  return (
    <LanguageContext.Provider value={{ lang, changeLang }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLang() {
  return useContext(LanguageContext)
}
