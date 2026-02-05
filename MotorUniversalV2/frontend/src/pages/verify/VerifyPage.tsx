import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { CheckCircle, XCircle, AlertCircle, Award, User, Calendar, BookOpen, Shield, ArrowLeft } from 'lucide-react'

interface VerificationData {
  valid: boolean
  error?: string
  document_type?: string
  document_name?: string
  verification_code?: string
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
          <Link 
            to="/"
            className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Ir al inicio
          </Link>
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
          <Link 
            to="/"
            className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Ir al inicio
          </Link>
        </div>
      </div>
    )
  }

  // Documento válido
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          {/* Logo de la marca del ECM */}
          {data.certification?.brand_logo_url ? (
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
              src="/images/evaluaasi-icon.png" 
              alt="Evaluaasi" 
              className="h-20 mx-auto mb-4"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          )}
          <h1 className="text-3xl font-bold text-gray-900">Verificación de Documento</h1>
          <p className="text-gray-600 mt-2">Sistema de Evaluación y Certificación</p>
        </div>

        {/* Card de verificación */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Status bar */}
          <div className="bg-green-500 px-6 py-4 flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-white" />
            <div>
              <h2 className="text-white font-bold text-lg">Documento Verificado</h2>
              <p className="text-green-100 text-sm">Este documento es auténtico y válido</p>
            </div>
          </div>

          {/* Contenido */}
          <div className="p-6 space-y-6">
            {/* Tipo de documento */}
            <div className="flex items-center gap-3 pb-4 border-b">
              <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
                {data.document_type === 'eduit_certificate' ? (
                  <Award className="w-6 h-6 text-primary-600" />
                ) : (
                  <BookOpen className="w-6 h-6 text-primary-600" />
                )}
              </div>
              <div>
                <p className="text-sm text-gray-500">Tipo de Documento</p>
                <p className="font-semibold text-gray-900">{data.document_name}</p>
              </div>
            </div>

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
                  className="w-14 h-14 min-w-[56px] rounded-xl flex-shrink-0 object-contain bg-gray-50 p-1"
                  onError={(e) => {
                    // Si falla, mostrar ícono por defecto
                    e.currentTarget.style.display = 'none'
                    e.currentTarget.nextElementSibling?.classList.remove('hidden')
                  }}
                />
              ) : null}
              <div className={`w-14 h-14 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0 ${data.certification?.ecm_logo_url ? 'hidden' : ''}`}>
                <Shield className="w-7 h-7 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Certificación</p>
                <p className="font-semibold text-gray-900">{data.certification?.exam_name}</p>
                {data.certification?.ecm_code && (
                  <p className="text-sm text-gray-600 mt-1">
                    <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">{data.certification.ecm_code}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Fecha */}
            {data.certification?.completion_date && (
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Fecha de Completación</p>
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

        {/* Link al inicio */}
        <div className="text-center mt-6">
          <Link 
            to="/"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-800 font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Ir al inicio de Evaluaasi
          </Link>
        </div>
      </div>
    </div>
  )
}

export default VerifyPage
