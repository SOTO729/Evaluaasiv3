import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ShieldAlert, X } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'

const SESSION_KEY = 'curp_required_modal_dismissed'

/**
 * Modal de aviso para candidatos cuya CURP no ha sido validada.
 * - Aparece automáticamente al iniciar sesión y persiste hasta que el candidato
 *   lo cierre o vaya a /mi-curp.
 * - Una vez cerrado, se mantiene un banner permanente en la parte superior.
 * - No aparece si ya está en /mi-curp.
 */
export default function CurpRequiredModal() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [showModal, setShowModal] = useState(false)

  const requires =
    user?.role === 'candidato' && !!user?.requires_curp_validation

  useEffect(() => {
    if (!requires) return
    if (location.pathname === '/mi-curp') return
    const dismissed = sessionStorage.getItem(SESSION_KEY) === '1'
    if (!dismissed) {
      setShowModal(true)
    }
  }, [requires, location.pathname])

  if (!requires || location.pathname === '/mi-curp') return null

  function handleGo() {
    sessionStorage.setItem(SESSION_KEY, '1')
    setShowModal(false)
    navigate('/mi-curp')
  }

  function handleDismiss() {
    sessionStorage.setItem(SESSION_KEY, '1')
    setShowModal(false)
  }

  return (
    <>
      {/* Banner superior persistente */}
      <div className="bg-amber-100 border-b-2 border-amber-400 text-amber-900 px-4 py-2 flex items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <ShieldAlert className="w-5 h-5 flex-shrink-0" />
          <span className="truncate">
            <strong>Tu CURP no ha sido validada.</strong> No podrás iniciar exámenes ni descargar materiales hasta validarla.
          </span>
        </div>
        <button
          onClick={handleGo}
          className="flex-shrink-0 px-3 py-1 bg-amber-600 text-white rounded font-medium hover:bg-amber-700 text-xs"
        >
          Validar ahora
        </button>
      </div>

      {/* Modal centrado al login */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-gradient-to-r from-amber-500 to-orange-600 p-5 text-white relative">
              <button
                onClick={handleDismiss}
                className="absolute top-3 right-3 text-white/80 hover:text-white"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3">
                <ShieldAlert className="w-10 h-10" />
                <div>
                  <h2 className="text-lg font-bold">Acción requerida: Validar CURP</h2>
                  <p className="text-sm text-amber-50">Necesitamos confirmar tu identidad</p>
                </div>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-700">
                La CURP que se registró en tu cuenta no pudo validarse contra el servicio oficial
                de RENAPO. Para poder iniciar exámenes y acceder a tus materiales de estudio,
                necesitas <strong>ingresarla nuevamente</strong> y validarla.
              </p>
              <div className="bg-amber-50 border-l-4 border-amber-400 p-3 text-xs text-amber-800">
                <p className="font-semibold mb-1">Mientras tanto:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Puedes ver tu panel principal.</li>
                  <li><strong>No</strong> puedes presentar exámenes.</li>
                  <li><strong>No</strong> puedes descargar materiales.</li>
                  <li><strong>No</strong> recibirás certificados.</li>
                </ul>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleDismiss}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
                >
                  Más tarde
                </button>
                <button
                  onClick={handleGo}
                  className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700"
                >
                  Validar ahora
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
