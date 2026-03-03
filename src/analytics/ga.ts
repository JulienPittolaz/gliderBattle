type AnalyticsWindow = Window & {
  dataLayer?: unknown[]
  gtag?: (...args: unknown[]) => void
}

const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim() ?? ''
const debugMode = parseBoolean(import.meta.env.VITE_ANALYTICS_DEBUG) ?? false

let initialized = false
let disabledReasonLogged = false

function parseBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined) {
    return undefined
  }

  const normalized = value.trim().toLowerCase()
  if (normalized === 'true') {
    return true
  }
  if (normalized === 'false') {
    return false
  }
  return undefined
}

function isLocalhostHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
}

function getEnabledStatus(): { enabled: boolean; reason: string } {
  if (!measurementId) {
    return { enabled: false, reason: 'missing measurement id' }
  }

  const explicitEnabled = parseBoolean(import.meta.env.VITE_ANALYTICS_ENABLED)
  if (explicitEnabled === false) {
    return { enabled: false, reason: 'explicitly disabled' }
  }

  if (explicitEnabled === true) {
    return { enabled: true, reason: '' }
  }

  if (isLocalhostHost(window.location.hostname)) {
    return { enabled: false, reason: 'localhost' }
  }

  return { enabled: true, reason: '' }
}

function logDisabledReasonOnce(reason: string): void {
  if (!import.meta.env.DEV || disabledReasonLogged || !reason) {
    return
  }
  console.info(`[analytics] disabled: ${reason}`)
  disabledReasonLogged = true
}

function ensureScriptTag(id: string): void {
  const existing = document.querySelector(`script[data-ga-id="${id}"]`)
  if (existing) {
    return
  }

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`
  script.dataset.gaId = id
  script.onerror = () => {
    if (import.meta.env.DEV) {
      console.warn('[analytics] failed to load gtag script')
    }
  }
  document.head.appendChild(script)
}

function getAnalyticsWindow(): AnalyticsWindow {
  return window as AnalyticsWindow
}

export function initAnalytics(): boolean {
  const status = getEnabledStatus()
  if (!status.enabled) {
    logDisabledReasonOnce(status.reason)
    return false
  }

  if (initialized) {
    return true
  }

  const analyticsWindow = getAnalyticsWindow()
  analyticsWindow.dataLayer = analyticsWindow.dataLayer ?? []
  analyticsWindow.gtag = analyticsWindow.gtag ?? ((...args: unknown[]) => {
    analyticsWindow.dataLayer?.push(args)
  })

  analyticsWindow.gtag('js', new Date())
  analyticsWindow.gtag('config', measurementId, {
    send_page_view: false,
    ...(debugMode ? { debug_mode: true } : {}),
  })

  ensureScriptTag(measurementId)
  initialized = true
  return true
}

export function trackPageView(path = `${window.location.pathname}${window.location.search}${window.location.hash}`): void {
  if (!initAnalytics()) {
    return
  }

  const analyticsWindow = getAnalyticsWindow()
  analyticsWindow.gtag?.('event', 'page_view', {
    page_location: window.location.href,
    page_path: path,
    page_title: document.title,
  })
}
