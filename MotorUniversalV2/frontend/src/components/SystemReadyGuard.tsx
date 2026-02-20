import { useState, useEffect, ReactNode } from 'react'
import { isSupportPreviewEnabled } from '../support/supportPreview'

interface SystemReadyGuardProps {
  children: ReactNode
}

interface SystemStatus {
  isReady: boolean
  isChecking: boolean
  attempts: number
  message: string
  showTip: boolean
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001'
const MAX_ATTEMPTS = 5
const RETRY_DELAY = 5000 // 5 seconds

export default function SystemReadyGuard({ children }: SystemReadyGuardProps) {
  const isDev = import.meta.env.MODE === 'development'
  // DEV ONLY: permitir acceso directo al módulo soporte en /dev/support sin warmup
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/dev/support')) {
    return <>{children}</>
  }
  // DEV ONLY: no bloquear /support por warmup cuando la BD remota no responde
  if (typeof window !== 'undefined' && isDev && window.location.pathname.startsWith('/support')) {
    return <>{children}</>
  }
  // DEV ONLY: permitir acceso directo al módulo soporte en /support con preview sin warmup
  if (
    typeof window !== 'undefined' &&
    isSupportPreviewEnabled() &&
    window.location.pathname.startsWith('/support')
  ) {
    return <>{children}</>
  }

  const [status, setStatus] = useState<SystemStatus>({
    isReady: false,
    isChecking: true,
    attempts: 0,
    message: 'Conectando con el servidor...',
    showTip: false
  })

  useEffect(() => {
    let isMounted = true
    let timeoutId: ReturnType<typeof setTimeout>

    const checkSystem = async () => {
      if (!isMounted) return

      const currentAttempts = status.attempts + 1
      
      setStatus(prev => ({
        ...prev,
        isChecking: true,
        attempts: currentAttempts
      }))

      try {
        const controller = new AbortController()
        const timeoutSignal = setTimeout(() => controller.abort(), 60000) // 60s timeout for cold start

        // API_URL already includes /api in dev/prod config, so use /warmup directly
        const response = await fetch(`${API_URL}/warmup`, {
          signal: controller.signal
        })

        clearTimeout(timeoutSignal)

        if (response.ok) {
          if (isMounted) {
            setStatus({
              isReady: true,
              isChecking: false,
              attempts: 0,
              message: '¡Sistema listo!',
              showTip: false
            })
          }
          return
        }

        // Si el servidor responde pero la BD está iniciando
        if (response.status === 503) {
          if (isMounted) {
            setStatus(prev => ({
              ...prev,
              isChecking: false,
              message: 'La base de datos está iniciando...',
              showTip: true
            }))
          }
          timeoutId = setTimeout(checkSystem, RETRY_DELAY)
          return
        }

        // Para cualquier otro status no exitoso, reintentar hasta MAX_ATTEMPTS
        if (isMounted) {
          if (currentAttempts >= MAX_ATTEMPTS) {
            setStatus(prev => ({
              ...prev,
              isChecking: false,
              message: `Servidor no disponible (HTTP ${response.status}).`,
              showTip: false
            }))
            return
          }

          setStatus(prev => ({
            ...prev,
            isChecking: false,
            message: 'Iniciando el sistema...',
            showTip: currentAttempts >= 2
          }))
          timeoutId = setTimeout(checkSystem, RETRY_DELAY)
        }
        return

      } catch (error) {
        console.log('System check error:', error)
        
        if (isMounted) {
          if (currentAttempts >= MAX_ATTEMPTS) {
            setStatus(prev => ({
              ...prev,
              isChecking: false,
              message: 'El servidor no está disponible. Por favor, intente más tarde.',
              showTip: false
            }))
            return
          }

          setStatus(prev => ({
            ...prev,
            isChecking: false,
            message: 'Iniciando el sistema...',
            showTip: currentAttempts >= 2
          }))
          
          timeoutId = setTimeout(checkSystem, RETRY_DELAY)
        }
      }
    }

    checkSystem()

    return () => {
      isMounted = false
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [])

  if (status.isReady) {
    return <>{children}</>
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="text-center max-w-md animate-fade-in">
        {/* Logo o ícono */}
        <div className="mb-8 animate-pulse">
          <div className="w-20 h-20 mx-auto bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
            <svg 
              className="w-10 h-10 text-white" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" 
              />
            </svg>
          </div>
        </div>

        {/* Título */}
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          Evaluaasi
        </h1>

        {/* Spinner animado */}
        <div className="relative mb-6">
          <div className="w-12 h-12 mx-auto border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        </div>

        {/* Mensaje de estado */}
        <p className="text-gray-600 mb-4 transition-all duration-300">
          {status.message}
        </p>

        {/* Indicador de intentos */}
        {status.attempts > 1 && !status.isReady && (
          <div className="flex justify-center gap-1 mb-4">
            {[...Array(MAX_ATTEMPTS)].map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                  i < status.attempts 
                    ? 'bg-blue-500' 
                    : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
        )}

        {/* Tip informativo */}
        {status.showTip && (
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-700 animate-fade-in">
            <p className="font-medium mb-1">💡 ¿Por qué la espera?</p>
            <p className="text-blue-600">
              El sistema se optimiza automáticamente durante periodos de inactividad. 
              Esto puede tomar hasta un minuto la primera vez del día.
            </p>
          </div>
        )}

        {/* Botón de reintentar manual (después de muchos intentos) */}
        {status.attempts >= MAX_ATTEMPTS && (
          <button
            onClick={() => window.location.reload()}
            className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Reintentar
          </button>
        )}
      </div>
    </div>
  )
}
