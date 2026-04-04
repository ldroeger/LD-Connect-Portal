import React, { useState, useEffect, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform,
  StatusBar, Animated, Alert, Image
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { WebView } from 'react-native-webview'

const STORAGE_KEY = 'powerbird_server_url'
const BRANDING_KEY = 'powerbird_branding'

export default function App() {
  const [serverUrl, setServerUrl] = useState('')
  const [inputUrl, setInputUrl] = useState('')
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const [branding, setBranding] = useState({ company_name: 'Powerbird Portal', primary_color: '#2563EB', favicon_url: '' })
  const fadeAnim = useRef(new Animated.Value(0)).current
  const webviewRef = useRef(null)

  useEffect(() => {
    loadSaved()
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start()
  }, [])

  const loadSaved = async () => {
    try {
      const url = await AsyncStorage.getItem(STORAGE_KEY)
      const b = await AsyncStorage.getItem(BRANDING_KEY)
      if (b) setBranding(JSON.parse(b))
      if (url) { setServerUrl(url); setReady(true) }
    } catch(e) {}
  }

  const normalize = (url) => {
    let u = url.trim()
    if (!u.startsWith('http://') && !u.startsWith('https://')) u = 'http://' + u
    return u.replace(/\/$/, '')
  }

  const fetchBranding = async (url) => {
    try {
      const r = await fetch(`${url}/api/branding`, { signal: AbortSignal.timeout(4000) })
      if (r.ok) {
        const data = await r.json()
        const b = {
          company_name: data.company_name || 'Powerbird',
          primary_color: data.primary_color || '#2563EB',
          favicon_url: data.favicon_url ? `${url}${data.favicon_url}` : '',
        }
        setBranding(b)
        await AsyncStorage.setItem(BRANDING_KEY, JSON.stringify(b))
      }
    } catch(e) {}
  }

  const connect = async () => {
    if (!inputUrl.trim()) return setError('Bitte Server-Adresse eingeben')
    setChecking(true); setError('')
    const url = normalize(inputUrl)
    try {
      const r = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(5000) })
      if (!r.ok) throw new Error()
      await AsyncStorage.setItem(STORAGE_KEY, url)
      await fetchBranding(url)
      setServerUrl(url)
      setReady(true)
    } catch(e) {
      setError('Server nicht erreichbar.\nBitte Adresse prüfen und sicherstellen\ndass Sie im gleichen Netzwerk sind.')
    }
    setChecking(false)
  }

  const resetServer = () => {
    Alert.alert('Server ändern', 'Möchten Sie die Server-Adresse zurücksetzen?', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Zurücksetzen', style: 'destructive', onPress: async () => {
        await AsyncStorage.multiRemove([STORAGE_KEY, BRANDING_KEY])
        setServerUrl(''); setReady(false); setInputUrl('')
        setBranding({ company_name: 'Powerbird', primary_color: '#2563EB', favicon_url: '' })
      }}
    ])
  }

  const primaryColor = branding.primary_color || '#2563EB'

  // WebView mode
  if (ready && serverUrl) {
    return (
      <View style={{ flex: 1, backgroundColor: '#131720' }}>
        <StatusBar barStyle="light-content" backgroundColor="#131720" />
        {/* Thin header with branding */}
        <View style={[styles.appBar, { backgroundColor: '#131720', borderBottomColor: '#2a3350' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {branding.favicon_url ? (
              <Image source={{ uri: branding.favicon_url }} style={styles.appBarIcon} resizeMode="contain" />
            ) : (
              <View style={[styles.appBarIconFallback, { backgroundColor: primaryColor }]}>
                <Image source={require('../assets/icon.png')} style={{ width: 22, height: 22, borderRadius: 5 }} resizeMode='contain' />
              </View>
            )}
            <Text style={styles.appBarTitle}>{branding.company_name}</Text>
          </View>
          <TouchableOpacity onLongPress={resetServer} delayLongPress={1500} style={styles.appBarBtn}>
            <Text style={{ color: '#4a5878', fontSize: 18 }}>⋯</Text>
          </TouchableOpacity>
        </View>

        <WebView
          ref={webviewRef}
          source={{ uri: serverUrl }}
          style={{ flex: 1 }}
          pullToRefreshEnabled={true}
          sharedCookiesEnabled={true}
          thirdPartyCookiesEnabled={true}
          allowsLinkPreview={false}
          applicationNameForUserAgent="PowerbirdApp/1.0"
          onError={() => Alert.alert(
            'Verbindungsfehler', 'Server nicht erreichbar.',
            [{ text: 'Neu laden', onPress: () => webviewRef.current?.reload() },
             { text: 'Server ändern', onPress: resetServer }]
          )}
          renderLoading={() => (
            <View style={styles.loadingScreen}>
              <ActivityIndicator size="large" color={primaryColor} />
              <Text style={{ color: '#8899bb', marginTop: 12, fontSize: 13 }}>Verbinde mit {branding.company_name}…</Text>
            </View>
          )}
          startInLoadingState={true}
        />
      </View>
    )
  }

  // Setup screen
  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: '#131720' }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar barStyle="light-content" backgroundColor="#131720" />
      <Animated.View style={[styles.inner, { opacity: fadeAnim }]}>

        <View style={styles.logoArea}>
          <Image source={require('../assets/icon.png')} style={styles.logoImage} resizeMode="contain" />
          <Text style={styles.appTitle}>Powerbird Portal</Text>
          <Text style={styles.appSub}>Mitarbeiterportal</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Server verbinden</Text>
          <Text style={styles.cardDesc}>
            IP-Adresse oder Hostname des Servers eingeben.{'\n'}
            <Text style={{ color: primaryColor, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>
              Beispiel: 192.168.1.100
            </Text>
          </Text>

          <View style={styles.inputWrap}>
            <Text style={styles.inputPre}>http://</Text>
            <TextInput
              style={styles.input}
              value={inputUrl}
              onChangeText={t => { setInputUrl(t); setError('') }}
              placeholder="IP-Adresse oder Hostname"
              placeholderTextColor="#4a5878"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="go"
              onSubmitEditing={connect}
            />
          </View>

          {error !== '' && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <TouchableOpacity style={[styles.btn, { backgroundColor: primaryColor, shadowColor: primaryColor }, checking && { opacity: 0.6 }]} onPress={connect} disabled={checking}>
            {checking ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Verbinden →</Text>}
          </TouchableOpacity>
        </View>

        <Text style={styles.hintText}>
          Stellen Sie sicher, dass Ihr Gerät im{'\n'}gleichen Netzwerk wie der Server ist.
        </Text>
      </Animated.View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  logoArea: { alignItems: 'center', marginBottom: 36 },
  logoImage: { width: 140, height: 140, marginBottom: 8 },
  appTitle: { fontSize: 30, fontWeight: '800', color: '#e8eaf0', letterSpacing: 0.3 },
  appSub: { fontSize: 13, color: '#4a5878', marginTop: 4 },
  card: { backgroundColor: '#1a2030', borderRadius: 20, padding: 22, borderWidth: 1, borderColor: '#2a3350', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#e8eaf0', marginBottom: 8 },
  cardDesc: { fontSize: 13, color: '#8899bb', lineHeight: 20, marginBottom: 18 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#131720', borderRadius: 12, borderWidth: 1, borderColor: '#2a3350', marginBottom: 14, overflow: 'hidden' },
  inputPre: { color: '#4a5878', fontSize: 14, paddingLeft: 14, paddingRight: 2 },
  input: { flex: 1, color: '#e8eaf0', fontSize: 15, paddingVertical: 14, paddingRight: 14 },
  errorBox: { backgroundColor: 'rgba(239,68,68,0.12)', borderRadius: 10, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)' },
  errorText: { color: '#f87171', fontSize: 13, lineHeight: 18 },
  btn: { borderRadius: 12, paddingVertical: 15, alignItems: 'center', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 4 },
  btnText: { color: 'white', fontSize: 16, fontWeight: '700' },
  hintText: { textAlign: 'center', color: '#4a5878', fontSize: 12, lineHeight: 18, marginTop: 24 },
  appBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 50 : 12, paddingBottom: 10, borderBottomWidth: 1 },
  appBarIcon: { width: 24, height: 24, borderRadius: 6 },
  appBarIconFallback: { width: 24, height: 24, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  appBarIconText: { color: 'white', fontSize: 12, fontWeight: '700' },
  appBarTitle: { fontSize: 15, fontWeight: '700', color: '#e8eaf0' },
  appBarBtn: { padding: 8 },
  loadingScreen: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#131720', alignItems: 'center', justifyContent: 'center' },
})
