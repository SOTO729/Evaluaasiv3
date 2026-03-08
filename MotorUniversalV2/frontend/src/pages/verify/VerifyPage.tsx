import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle, XCircle, AlertCircle, User, Calendar, BookOpen, Shield, Zap } from 'lucide-react'

interface VerificationData {
  valid: boolean
  error?: string
  document_type?: string
  document_name?: string
  verification_code?: string
  status?: string
  candidate?: {
    full_name: string
  }
  certification?: {
    exam_name: string
    ecm_code: string | null
    ecm_name: string | null
    ecm_logo_url: string | null
    brand_logo_url: string | null
    brand_name: string | null
    completion_date: string | null
    score: number | null
    result: string
  }
  badge?: {
    name: string
    description: string | null
    issuer_name: string
    image_url: string | null
    template_image_url: string | null
    issued_date: string | null
    expires_date?: string | null
    badge_uuid: string
    credential_url: string
    verify_count?: number
    share_count?: number
    ecm_code?: string | null
    ecm_name?: string | null
    ecm_logo_url?: string | null
    skills?: string | null
    criteria_narrative?: string | null
    cryptographically_signed?: boolean
    proof_type?: string
  }
}

const VerifyPage = () => {
  const { code } = useParams<{ code: string }>()
  const [data, setData] = useState<VerificationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const verifyCode = async () => {
      if (!code) {
        setError('Código de verificación no proporcionado')
        setLoading(false)
        return
      }

      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'https://evaluaasi-motorv2-api.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api'
        const response = await fetch(`${apiUrl}/verify/${code}`)
        const result = await response.json()

        if (!response.ok) {
          setData({ valid: false, error: result.error || 'Error al verificar el código' })
        } else {
          setData(result)
        }
      } catch (err) {
        setError('Error de conexión. Por favor intenta de nuevo.')
      } finally {
        setLoading(false)
      }
    }

    verifyCode()
  }, [code])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Verificando documento...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-10 h-10 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Error de Verificación</h1>
          <p className="text-gray-600 mb-6">{error}</p>
        </div>
      </div>
    )
  }

  if (!data?.valid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <XCircle className="w-10 h-10 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Documento No Válido</h1>
          <p className="text-gray-600 mb-4">{data?.error || 'No se pudo verificar este documento.'}</p>
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-500">Código consultado:</p>
            <code className="text-lg font-mono text-gray-800">{code}</code>
          </div>
        </div>
      </div>
    )
  }

  // helpers
  const isBadge = data.document_type === 'digital_badge'

  // Documento válido
  return (
    <div className={`min-h-screen py-8 px-4 ${isBadge ? 'bg-gradient-to-br from-emerald-50 via-green-50 to-teal-100' : 'bg-gradient-to-br from-green-50 to-emerald-100'}`}>
      <div className={`mx-auto ${isBadge ? 'max-w-3xl' : 'max-w-2xl'}`}>
        {/* Header */}
        <div className="text-center mb-8">
          {/* Logo: Eduit para insignias, marca del ECM o Evaluaasi para certificados */}
          {isBadge ? (
            <img 
              src="/images/eduit-logo.webp" 
              alt="Grupo Eduit" 
              className="h-20 min-w-[80px] max-w-[200px] mx-auto mb-4 object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          ) : data.certification?.brand_logo_url ? (
            <img 
              src={data.certification.brand_logo_url} 
              alt={data.certification.brand_name || 'Marca'} 
              className="h-20 min-w-[80px] max-w-[200px] mx-auto mb-4 object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          ) : (
            <img 
              src="/images/evaluaasi-icon.webp" 
              alt="Evaluaasi" 
              className="h-20 mx-auto mb-4"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          )}
          <h1 className="text-3xl font-bold text-gray-900">
            {isBadge ? 'Verificación de Insignia' : 'Verificación de Documento'}
          </h1>
          <p className="text-gray-600 mt-2">Sistema de Evaluación y Certificación</p>
        </div>

        {/* Card de verificación */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Status bar */}
          <div className={`px-6 py-4 flex items-center gap-3 ${isBadge ? 'bg-gradient-to-r from-emerald-500 to-green-500' : 'bg-green-500'}`}>
            <CheckCircle className="w-8 h-8 text-white" />
            <div>
              <h2 className="text-white font-bold text-lg">
                {isBadge ? 'Insignia Verificada' : 'Documento Verificado'}
              </h2>
              <p className="text-green-100 text-sm">
                {isBadge ? 'Esta insignia es auténtica y válida' : 'Este documento es auténtico y válido'}
              </p>
            </div>
          </div>

          {/* Contenido */}
          <div className="p-6 space-y-6">

            {/* ═══ BADGE LAYOUT ═══ */}
            {isBadge && data.badge && (
              <>
                {/* Nombre de la insignia */}
                <div className="text-center">
                  <p className="text-xs font-medium text-emerald-600 uppercase tracking-wider mb-1">Insignia Digital</p>
                  <h3 className="text-xl font-bold text-gray-900">{data.badge.name}</h3>
                </div>

                {/* Imagen de la plantilla – justo debajo del título, centrada y grande */}
                {data.badge.template_image_url && (
                  <div className="flex justify-center py-4">
                    <div className="relative group">
                      <div className="absolute -inset-4 bg-gradient-to-br from-emerald-200 via-green-100 to-teal-200 rounded-3xl opacity-60 blur-lg" />
                      <img
                        src={data.badge.template_image_url}
                        alt={data.badge.name}
                        className="relative h-72 w-auto rounded-2xl object-contain shadow-xl ring-2 ring-white"
                      />
                      <div className="absolute -bottom-3 -right-3 w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg ring-3 ring-white">
                        <CheckCircle className="w-6 h-6 text-white" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Grid 2 cols: Titular + Emisor */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 bg-blue-50 rounded-xl p-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-gray-500">Titular</p>
                      <p className="font-semibold text-gray-900 truncate">{data.candidate?.full_name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 bg-purple-50 rounded-xl p-4">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Shield className="w-5 h-5 text-purple-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-gray-500">Emitida por</p>
                      <p className="font-semibold text-gray-900 truncate">{data.badge.issuer_name}</p>
                    </div>
                  </div>
                </div>

                {/* Grid 2 cols: Fechas */}
                <div className="grid grid-cols-2 gap-4">
                  {data.badge.issued_date && (
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="text-xs text-gray-500">Fecha de Emisión</p>
                      <p className="font-semibold text-gray-900 text-sm mt-0.5">{data.badge.issued_date}</p>
                    </div>
                  )}
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-xs text-gray-500">Fecha de Caducidad</p>
                    {data.badge.expires_date ? (
                      <p className={`font-semibold text-sm mt-0.5 ${data.status === 'expired' ? 'text-red-600' : 'text-gray-900'}`}>
                        {data.badge.expires_date}
                      </p>
                    ) : (
                      <p className="font-semibold text-green-700 text-sm mt-0.5">Sin caducidad</p>
                    )}
                  </div>
                </div>

                {/* Aptitudes */}
                {data.badge.skills && (
                  <div className="bg-emerald-50/70 rounded-xl p-4">
                    <p className="text-xs text-gray-500 mb-2 flex items-center gap-1.5 font-medium">
                      <Zap className="w-3.5 h-3.5 text-emerald-600" />
                      Aptitudes
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {data.badge.skills.split(',').map(s => s.trim()).filter(Boolean).map((skill, i) => (
                        <span key={i} className="inline-flex items-center px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-xs font-medium">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Descripción de la insignia */}
                {data.badge.description && (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-xs text-gray-500 mb-2 flex items-center gap-1.5 font-medium">
                      <BookOpen className="w-3.5 h-3.5 text-gray-600" />
                      Descripción
                    </p>
                    <p className="text-sm text-gray-700 leading-relaxed">{data.badge.description}</p>
                  </div>
                )}

                {/* Criterios de obtención */}
                {data.badge.criteria_narrative && (
                  <div className="bg-indigo-50 rounded-xl p-4">
                    <p className="text-xs text-gray-500 mb-2 flex items-center gap-1.5 font-medium">
                      <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                      Criterios de Obtención
                    </p>
                    <p className="text-sm text-gray-700 leading-relaxed">{data.badge.criteria_narrative}</p>
                  </div>
                )}

                {/* OB3 credential link */}
                {data.badge.credential_url && (
                  <div className="bg-blue-50 rounded-xl p-3 text-center">
                    <a
                      href={data.badge.credential_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 text-xs font-medium transition-colors"
                    >
                      🔗 Ver Credencial Open Badges 3.0 (JSON-LD)
                    </a>
                  </div>
                )}

                {/* Ed25519 cryptographic signature indicator */}
                {data.badge.cryptographically_signed && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <svg className="w-5 h-5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>
                      <span className="text-sm font-semibold text-emerald-700">Firma Criptográfica Verificada</span>
                    </div>
                    <p className="text-xs text-emerald-600">
                      {data.badge.proof_type || 'Ed25519Signature2020'} — Esta credencial es verificable sin conexión al servidor emisor
                    </p>
                  </div>
                )}
              </>
            )}

            {/* ═══ CERTIFICATE LAYOUT (non-badge) ═══ */}
            {!isBadge && (
              <>
                {/* Información del candidato */}
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <User className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Persona Certificada</p>
                <p className="font-semibold text-gray-900 text-lg">{data.candidate?.full_name}</p>
              </div>
            </div>

            {/* Certificación */}
            <div className="flex items-start gap-3">
              {/* Logo del ECM o ícono por defecto */}
              {data.certification?.ecm_logo_url ? (
                <img 
                  src={data.certification.ecm_logo_url} 
                  alt={data.certification.ecm_code || 'ECM'} 
                  className="w-12 h-12 rounded-xl flex-shrink-0 object-contain bg-gray-50 p-1"
                  onError={(e) => {
                    // Si falla, mostrar ícono por defecto
                    e.currentTarget.style.display = 'none'
                    e.currentTarget.nextElementSibling?.classList.remove('hidden')
                  }}
                />
              ) : null}
              <div className={`w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0 ${data.certification?.ecm_logo_url ? 'hidden' : ''}`}>
                <Shield className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">
                  Certificación
                  {data.certification?.ecm_code && (
                    <span className="font-mono bg-gray-100 px-2 py-0.5 rounded ml-2 text-gray-700">{data.certification.ecm_code}</span>
                  )}
                </p>
                <p className="font-semibold text-gray-900">{data.certification?.exam_name}</p>
              </div>
            </div>

            {/* Fecha */}
            {data.certification?.completion_date && (
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">
                    {data.document_type === 'evaluation_report' ? 'Fecha de Evaluación' : 'Fecha de Certificación'}
                  </p>
                  <p className="font-semibold text-gray-900">{data.certification.completion_date}</p>
                </div>
              </div>
            )}

            {/* Resultado (solo para reporte de evaluación) */}
            {data.document_type === 'evaluation_report' && data.certification && data.certification.score !== null && (
              <div className="bg-gray-50 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Resultado de Evaluación</p>
                  <p className={`font-bold text-lg ${data.certification.result === 'Aprobado' ? 'text-green-600' : 'text-red-600'}`}>
                    {data.certification.result}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">Puntaje</p>
                  <p className="font-bold text-2xl text-gray-900">{data.certification.score}%</p>
                </div>
              </div>
            )}
              </>
            )}

            {/* Código de verificación */}
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <p className="text-sm text-gray-500 mb-2">Código de Verificación</p>
              <code className="text-xl font-mono font-bold text-primary-600 tracking-wider">
                {data.verification_code}
              </code>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 text-center text-sm text-gray-500">
            <p>Este documento fue emitido por el sistema Evaluaasi.</p>
            <p>Verificación realizada el {new Date().toLocaleDateString('es-MX', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default VerifyPage
