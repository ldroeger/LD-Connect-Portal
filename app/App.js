import React, { useState, useEffect, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform,
  StatusBar, Animated, Alert, Image, AppState
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { WebView } from 'react-native-webview'
import NetInfo from '@react-native-community/netinfo'
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

const STORAGE_KEY = 'powerbird_server_url'
const BRANDING_KEY = 'powerbird_branding'
const PUSH_TOKEN_KEY = 'powerbird_push_token'

export default function App() {
  const [serverUrl, setServerUrl] = useState('')
  const [inputUrl, setInputUrl] = useState('')
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const [branding, setBranding] = useState({ company_name: 'LD Connect Portal', primary_color: '#2563EB', favicon_url: '' })
  const [isOnline, setIsOnline] = useState(true)
  const [serverReachable, setServerReachable] = useState(true)
  const [showOffline, setShowOffline] = useState(false)
  const fadeAnim = useRef(new Animated.Value(0)).current
  const webviewRef = useRef(null)
  const appState = useRef(AppState.currentState)

  useEffect(() => {
    loadSaved()
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start()

    // Monitor network
    registerForPushNotifications()

    const unsubNet = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected)
      if (!state.isConnected) setShowOffline(true)
    })

    // Monitor app state - check server when coming to foreground
    const unsubApp = AppState.addEventListener('change', nextState => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        checkServerReachable()
      }
      appState.current = nextState
    })

    return () => { unsubNet(); unsubApp.remove() }
  }, [])

  // Check server every 30s when app is active
  useEffect(() => {
    if (!ready || !serverUrl) return
    const interval = setInterval(checkServerReachable, 30000)
    return () => clearInterval(interval)
  }, [ready, serverUrl])

  const checkServerReachable = async () => {
    if (!serverUrl) return
    try {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 5000)
      const r = await fetch(`${serverUrl}/api/health`, {
        method: 'GET',
        signal: ctrl.signal,
      })
      clearTimeout(t)
      const wasOffline = !serverReachable
      setServerReachable(r.ok)
      setShowOffline(!r.ok)
      // If came back online - reload webview
      if (wasOffline && r.ok) webviewRef.current?.reload()
    } catch(e) {
      setServerReachable(false)
      setShowOffline(true)
    }
  }



  const loadSaved = async () => {
    try {
      const url = await AsyncStorage.getItem(STORAGE_KEY)
      const b = await AsyncStorage.getItem(BRANDING_KEY)
      if (b) setBranding(JSON.parse(b))
      if (url) { setServerUrl(url); setReady(true); checkServerReachable() }
    } catch(e) {}
  }

  const normalize = (url) => {
    let u = url.trim()
    if (!u.startsWith('http://') && !u.startsWith('https://')) u = 'http://' + u
    return u.replace(/\/$/, '')
  }

  const fetchBranding = async (url) => {
    try {
      const ctrl2 = new AbortController()
      const t2 = setTimeout(() => ctrl2.abort(), 4000)
      const r = await fetch(`${url}/api/branding`, { signal: ctrl2.signal })
      clearTimeout(t2)
      if (r.ok) {
        const data = await r.json()
        const b = {
          company_name: data.company_name || 'LD Connect Portal',
          primary_color: data.primary_color || '#2563EB',
          favicon_url: data.favicon_url ? `${url}${data.favicon_url}` : '',
        }
        setBranding(b)
        await AsyncStorage.setItem(BRANDING_KEY, JSON.stringify(b))
      }
    } catch(e) {}
  }

  const registerForPushNotifications = async () => {
    if (!Device.isDevice) return
    try {
      const { status: existing } = await Notifications.getPermissionsAsync()
      let finalStatus = existing
      if (existing !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync()
        finalStatus = status
      }
      if (finalStatus !== 'granted') return

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Standard',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
        })
        await Notifications.setNotificationChannelAsync('vacation', {
          name: 'Urlaubsanträge',
          importance: Notifications.AndroidImportance.HIGH,
        })
      }

      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: '4e805cd2-cdfc-4f70-b076-533a0d2a2068',
      })
      const token = tokenData.data
      await AsyncStorage.setItem(PUSH_TOKEN_KEY, token)
      const savedUrl = await AsyncStorage.getItem(STORAGE_KEY)
      if (savedUrl) await registerTokenWithServer(savedUrl, token).catch(() => {})
    } catch(e) { console.log('Push error:', e.message) }
  }

  const registerTokenWithServer = async (url, token) => {
    const authToken = await AsyncStorage.getItem('auth_token')
    if (!authToken) return
    await fetch(`${url}/api/push/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
      body: JSON.stringify({ token }),
    })
  }

  const connect = async () => {
    if (!inputUrl.trim()) return setError('Bitte Server-Adresse eingeben')
    setChecking(true); setError('')
    const url = normalize(inputUrl)
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 8000)
      const r = await fetch(`${url}/api/health`, { signal: controller.signal })
      clearTimeout(timeout)
      if (!r.ok) throw new Error(`Server antwortete mit Status ${r.status}`)
      await AsyncStorage.setItem(STORAGE_KEY, url)
      await fetchBranding(url)
      setServerUrl(url)
      setServerReachable(true)
      setShowOffline(false)
      setReady(true)
      const pushToken = await AsyncStorage.getItem(PUSH_TOKEN_KEY)
      if (pushToken) registerTokenWithServer(url, pushToken).catch(() => {})
    } catch(e) {
      const msg = e.name === 'AbortError' ? 'Timeout' : e.message
      setError(`Fehler: ${msg}\n\nURL: ${url}\n\nStellen Sie sicher dass die URL korrekt ist und Sie im gleichen Netzwerk sind.`)
    }
    setChecking(false)
  }

  const resetServer = () => {
    Alert.alert('Server ändern', 'Server-Adresse zurücksetzen?', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Zurücksetzen', style: 'destructive', onPress: async () => {
        await AsyncStorage.multiRemove([STORAGE_KEY, BRANDING_KEY])
        setServerUrl(''); setReady(false); setInputUrl('')
        setBranding({ company_name: 'LD Connect Portal', primary_color: '#2563EB', favicon_url: '' })
      }}
    ])
  }



  const handleMessage = async (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data)
      if (data.type === 'auth_token' && data.token) {
        await AsyncStorage.setItem('auth_token', data.token)
        const pushToken = await AsyncStorage.getItem(PUSH_TOKEN_KEY)
        if (pushToken && serverUrl) registerTokenWithServer(serverUrl, pushToken).catch(() => {})
      }
    } catch(e) {}
  }

  const injectedJS = `(function() {
    var orig = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function(k, v) {
      orig(k, v);
      if (k === 'token') window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({type:'auth_token',token:v}));
    };
    var t = localStorage.getItem('token');
    if (t) window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({type:'auth_token',token:t}));
    true;
  })()`

  const primaryColor = branding.primary_color || '#2563EB'

  if (ready && serverUrl) {
    return (
      <View style={{ flex: 1, backgroundColor: '#131720' }}>
        <StatusBar barStyle="light-content" backgroundColor="#131720" />
        <View style={[styles.appBar, { borderBottomColor: '#2a3350' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {branding.favicon_url
              ? <Image source={{ uri: branding.favicon_url }} style={styles.appBarIcon} resizeMode="contain" />
              : <View style={[styles.appBarIconFallback, { backgroundColor: primaryColor }]}>
                  <Image source={require('./assets/icon.png')} style={{ width: 22, height: 22, borderRadius: 5 }} resizeMode="contain" />
                </View>
            }
            <Text style={styles.appBarTitle}>{branding.company_name}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {!isOnline && (
              <View style={styles.offlineBadge}>
                <Text style={styles.offlineBadgeText}>Offline</Text>
              </View>
            )}
            <TouchableOpacity onLongPress={resetServer} delayLongPress={1500} style={styles.appBarBtn}>
              <Text style={{ color: '#4a5878', fontSize: 18 }}>⋯</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Offline Banner */}
        {showOffline && (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineBannerText}>
              {!isOnline ? '📶 Keine Internetverbindung' : '🔌 Server nicht erreichbar'}
            </Text>
            <TouchableOpacity onPress={() => {
              checkServerReachable()
              webviewRef.current?.reload()
            }} style={styles.retryBtn}>
              <Text style={styles.retryBtnText}>Neu laden</Text>
            </TouchableOpacity>
          </View>
        )}

        <WebView
          ref={webviewRef}
          source={{ uri: serverUrl }}
          style={{ flex: 1 }}
          pullToRefreshEnabled={true}
          sharedCookiesEnabled={true}
          thirdPartyCookiesEnabled={true}
          allowsLinkPreview={false}
          applicationNameForUserAgent="LDConnectApp/1.0"
          injectedJavaScript={injectedJS}
          onMessage={handleMessage}
          onError={() => {
            setServerReachable(false)
            setShowOffline(true)
          }}
          onHttpError={(e) => {
            if (e.nativeEvent.statusCode >= 500) {
              setShowOffline(true)
            }
          }}
          onLoad={() => {
            setServerReachable(true)
            setShowOffline(false)
          }}
          renderLoading={() => (
            <View style={styles.loadingScreen}>
              <ActivityIndicator size="large" color={primaryColor} />
              <Text style={{ color: '#8899bb', marginTop: 12, fontSize: 13 }}>
                Verbinde mit {branding.company_name}…
              </Text>
            </View>
          )}
          startInLoadingState={true}
        />
      </View>
    )
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar barStyle="light-content" backgroundColor="#131720" />
      <Animated.View style={[styles.inner, { opacity: fadeAnim }]}>
        <View style={styles.logoArea}>
          <Image source={require('./assets/icon.png')} style={styles.logoImage} resizeMode="contain" />
          <Text style={styles.appTitle}>LD Connect Portal</Text>
          <Text style={styles.appSub}>Mitarbeiterportal</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Server verbinden</Text>
          <Text style={styles.cardDesc}>
            IP-Adresse oder URL des Servers eingeben.{'\n'}
            <Text style={{ color: primaryColor, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>
              Beispiel: 192.168.1.100
            </Text>
          </Text>
          <TextInput
            style={styles.input}
            value={inputUrl}
            onChangeText={t => { setInputUrl(t); setError('') }}
            placeholder="http://192.168.1.100 oder https://..."
            placeholderTextColor="#4a5878"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="go"
            onSubmitEditing={connect}
          />
          {error !== '' && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: primaryColor }, checking && { opacity: 0.6 }]}
            onPress={connect}
            disabled={checking}>
            {checking
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Verbinden →</Text>}
          </TouchableOpacity>
        </View>
        <Text style={styles.hintText}>
          Gerät und Server müssen im gleichen Netzwerk sein.
        </Text>
      </Animated.View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#131720' },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  logoArea: { alignItems: 'center', marginBottom: 36 },
  logoImage: { width: 130, height: 130, marginBottom: 8 },
  appTitle: { fontSize: 28, fontWeight: '800', color: '#e8eaf0' },
  appSub: { fontSize: 13, color: '#4a5878', marginTop: 4 },
  card: { backgroundColor: '#1a2030', borderRadius: 20, padding: 22, borderWidth: 1, borderColor: '#2a3350', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#e8eaf0', marginBottom: 8 },
  cardDesc: { fontSize: 13, color: '#8899bb', lineHeight: 20, marginBottom: 18 },
  input: { backgroundColor: '#131720', borderRadius: 12, borderWidth: 1, borderColor: '#2a3350', color: '#e8eaf0', fontSize: 15, paddingVertical: 14, paddingHorizontal: 14, marginBottom: 14 },
  errorBox: { backgroundColor: 'rgba(239,68,68,0.12)', borderRadius: 10, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)' },
  errorText: { color: '#f87171', fontSize: 13, lineHeight: 18 },
  btn: { borderRadius: 12, paddingVertical: 15, alignItems: 'center', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 4 },
  btnText: { color: 'white', fontSize: 16, fontWeight: '700' },
  hintText: { textAlign: 'center', color: '#4a5878', fontSize: 12, lineHeight: 18, marginTop: 24 },
  appBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 50 : 12, paddingBottom: 10, backgroundColor: '#131720', borderBottomWidth: 1 },
  appBarIcon: { width: 24, height: 24, borderRadius: 6 },
  appBarIconFallback: { width: 24, height: 24, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  appBarTitle: { fontSize: 15, fontWeight: '700', color: '#e8eaf0' },
  appBarBtn: { padding: 8 },
  offlineBadge: { backgroundColor: '#EF4444', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  offlineBadgeText: { color: 'white', fontSize: 11, fontWeight: '600' },
  offlineBanner: { backgroundColor: '#1a2030', borderBottomWidth: 1, borderBottomColor: '#EF444440', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  offlineBannerText: { color: '#f87171', fontSize: 13, fontWeight: '500', flex: 1 },
  retryBtn: { backgroundColor: '#2a3350', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, marginLeft: 8 },
  retryBtnText: { color: '#e8eaf0', fontSize: 12, fontWeight: '600' },
  loadingScreen: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#131720', alignItems: 'center', justifyContent: 'center' },
})
