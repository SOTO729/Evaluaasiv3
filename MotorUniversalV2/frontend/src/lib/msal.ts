import {
  PublicClientApplication,
  EventType,
  type Configuration,
  type EventMessage,
} from '@azure/msal-browser'

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
 *
 * Incluye un "watchdog" sobre la ventana del popup: en MSAL v5 `loginPopup`
 * espera la respuesta vía BroadcastChannel (hasta 60s) y NO rechaza cuando el
 * usuario cierra el popup manualmente, lo que dejaría el botón de Microsoft
 * cargando hasta que expire ese timeout. Escuchando el evento `POPUP_OPENED`
 * obtenemos la referencia a la ventana y, si se cierra sin completar el flujo,
 * rechazamos nosotros para que la UI pueda reactivar el botón de inmediato.
 */
export async function loginWithMicrosoft(): Promise<string> {
  const pca = await getMsalInstance()

  return new Promise<string>((resolve, reject) => {
    let settled = false
    let pollTimer: ReturnType<typeof setInterval> | null = null

    const cleanup = () => {
      if (pollTimer) {
        clearInterval(pollTimer)
        pollTimer = null
      }
      if (callbackId) {
        pca.removeEventCallback(callbackId)
      }
    }

    const settle = (fn: () => void) => {
      if (settled) return
      settled = true
      cleanup()
      fn()
    }

    // Cuando MSAL abre el popup expone la ventana en el payload del evento.
    // La vigilamos para detectar el cierre manual del usuario.
    const callbackId = pca.addEventCallback((message: EventMessage) => {
      if (message.eventType !== EventType.POPUP_OPENED) return
      const popup = (message.payload as { popupWindow?: Window } | undefined)?.popupWindow
      if (!popup) return
      pollTimer = setInterval(() => {
        if (popup.closed) {
          // Damos una pequeña gracia: si MSAL ya resolvió, `settled` es true.
          settle(() =>
            reject(
              Object.assign(new Error('El usuario cerró el inicio de sesión de Microsoft'), {
                errorCode: 'user_cancelled',
              }),
            ),
          )
        }
      }, 400)
    })

    pca
      .loginPopup({
        scopes: ['openid', 'email', 'profile'],
        prompt: 'select_account',
        // MSAL v5 espera la respuesta del popup por un BroadcastChannel con
        // timeout de 60s y NO detecta el cierre manual de la ventana. Si el
        // usuario cierra el popup, MSAL mantiene el flag `interaction.status`
        // (interaction_in_progress) hasta que expira ese timeout, bloqueando el
        // siguiente intento con `BrowserAuthError: interaction_in_progress`
        // (por eso "una vez cerrado ya no se vuelve a abrir"). Con este flag,
        // cada nuevo intento cancela limpiamente la interacción pendiente
        // (cancelPendingBridgeResponse) y abre un popup nuevo. Es seguro aquí:
        // el botón se deshabilita durante el intento, así que no hay
        // interacciones concurrentes legítimas que podamos pisar.
        overrideInteractionInProgress: true,
      })
      .then((result) => {
        const idToken = result?.idToken
        if (!idToken) {
          settle(() => reject(new Error('Microsoft no devolvió un id_token')))
          return
        }
        settle(() => resolve(idToken))
      })
      .catch((err) => {
        settle(() => reject(err))
      })
  })
}
