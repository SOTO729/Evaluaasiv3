import { PublicClientApplication, type Configuration } from '@azure/msal-browser'

// Configuración MSAL para "Iniciar sesión con Microsoft" (Entra ID).
// Usa la authority "common" para aceptar cualquier cuenta Microsoft
// (organizacional o personal), espejando el comportamiento de Google.
const clientId = import.meta.env.VITE_MICROSOFT_CLIENT_ID || ''

const msalConfig: Configuration = {
  auth: {
    clientId,
    authority: 'https://login.microsoftonline.com/common',
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
}

let instance: PublicClientApplication | null = null
let initPromise: Promise<PublicClientApplication> | null = null

/**
 * Devuelve la instancia MSAL inicializada (singleton). MSAL v3 requiere
 * llamar a initialize() antes de usar cualquier API interactiva.
 */
export async function getMsalInstance(): Promise<PublicClientApplication> {
  if (instance) return instance
  if (!initPromise) {
    const pca = new PublicClientApplication(msalConfig)
    initPromise = pca.initialize().then(() => {
      instance = pca
      return pca
    })
  }
  return initPromise
}

export const isMicrosoftLoginEnabled = (): boolean => Boolean(clientId)

/**
 * Pre-inicializa MSAL de forma anticipada (warm-up). Es importante llamarlo
 * al montar la pantalla de login para que, al hacer clic en el botón, MSAL ya
 * esté inicializado y `loginPopup()` se invoque dentro del mismo gesto del
 * usuario; de lo contrario el `await initialize()` rompe la activación y el
 * navegador bloquea el popup.
 */
export function warmupMicrosoftLogin(): void {
  if (!clientId) return
  void getMsalInstance().catch(() => {})
}

// Arranca la inicialización en cuanto se importa el módulo (sin bloquear).
warmupMicrosoftLogin()

/**
 * Abre el popup de Microsoft (Entra ID) y devuelve el `id_token` (JWT OpenID
 * Connect) que el backend valida en /auth/microsoft. Lanza un error si el
 * usuario cancela o si no se obtiene un id_token.
 */
export async function loginWithMicrosoft(): Promise<string> {
  const pca = await getMsalInstance()
  const result = await pca.loginPopup({
    scopes: ['openid', 'email', 'profile'],
    prompt: 'select_account',
  })
  const idToken = result?.idToken
  if (!idToken) {
    throw new Error('Microsoft no devolvió un id_token')
  }
  return idToken
}
