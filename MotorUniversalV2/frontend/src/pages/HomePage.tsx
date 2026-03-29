import { useState, useEffect, useMemo } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../store/authStore'
import { dashboardService, DashboardData, DashboardExam, DashboardMaterial } from '../services/dashboardService'
import { getCandidatoBranding } from '../services/partnersService'
import EditorDashboard from './EditorDashboard'
import CoordinatorDashboard from './coordinador/CoordinatorDashboard'
import ResponsableDashboard from './responsable/ResponsableDashboard'
import ResponsablePartnerDashboard from './responsable_partner/ResponsablePartnerDashboard'
import CertificationPathCard, { Certification } from '../components/candidate/CertificationPathCard'
import {
  BookOpen,
  FileText,
  Award,
  ArrowRight,
  Trophy,
  CheckCircle2,
  GraduationCap
} from 'lucide-react'

/** Agrupa exámenes y materiales en certificaciones independientes */
export function buildCertifications(
  exams: DashboardExam[],
  materials: DashboardMaterial[],
  examMaterialsMap: Record<number, number[]>
): Certification[] {
  const materialsById = new Map(materials.map(m => [m.id, m]))
  // Agrupar exámenes por competency_standard_id (o exam.id como fallback)
  const groups = new Map<string, { exams: DashboardExam[]; materialIds: Set<number>; label: string; code: string | null }>()

  for (const exam of exams) {
    const key = exam.competency_standard_id
      ? `ecm-${exam.competency_standard_id}`
      : `exam-${exam.id}`

    if (!groups.has(key)) {
      groups.set(key, {
        exams: [],
        materialIds: new Set(),
        label: exam.competency_standard_name || exam.name,
        code: exam.competency_standard_code || null,
      })
    }
    const g = groups.get(key)!
    g.exams.push(exam)
    // Asociar materiales de este examen
    const matIds = examMaterialsMap[exam.id] || []
    for (const mid of matIds) {
      g.materialIds.add(mid)
    }
  }

  // Materiales no asociados a ningún examen
  const assignedMaterialIds = new Set<number>()
  for (const g of groups.values()) {
    for (const mid of g.materialIds) assignedMaterialIds.add(mid)
  }
  const orphanMaterials = materials.filter(m => !assignedMaterialIds.has(m.id))

  const certs: Certification[] = []
  for (const [key, g] of groups) {
    const certMaterials = Array.from(g.materialIds)
      .map(id => materialsById.get(id))
      .filter((m): m is DashboardMaterial => !!m)

    // Determinar última actividad: fecha más reciente de examen o progreso de material
    let lastActivity: string | null = null
    for (const e of g.exams) {
      const attempt = e.user_stats.last_attempt
      if (attempt) {
        const d = attempt.end_date || attempt.start_date
        if (!lastActivity || d > lastActivity) lastActivity = d
      }
    }

    certs.push({
      id: key,
      label: g.label,
      code: g.code,
      exams: g.exams,
      materials: certMaterials,
      lastActivity,
    })
  }

  // Si hay materiales huérfanos, repartirlos: si solo hay 1 grupo ponerlos ahí
  if (orphanMaterials.length > 0) {
    if (certs.length === 1) {
      certs[0].materials = [...certs[0].materials, ...orphanMaterials]
    } else if (certs.length === 0) {
      // Sin exámenes, solo materiales — una sola certificación genérica
      certs.push({
        id: 'general',
        label: 'Mi preparación',
        code: null,
        exams: [],
        materials: orphanMaterials,
        lastActivity: null,
      })
    }
    // Si hay múltiples grupos, los huérfanos se muestran en el primer grupo
    else {
      certs[0].materials = [...certs[0].materials, ...orphanMaterials]
    }
  }

  return certs
}

/** Encuentra el tab con actividad más reciente */
export function findMostRecentTab(certs: Certification[]): string {
  if (certs.length === 0) return ''
  let best = certs[0]
  for (const c of certs) {
    // Priorizar el que tiene exámenes in-progress (intentados pero no aprobados ni completados)
    const hasInProgress = c.exams.some(e => e.user_stats.last_attempt && !e.user_stats.is_approved && !e.user_stats.is_completed)
    if (hasInProgress) {
      // Si hay varios in-progress, elegir el de actividad más reciente
      if (best === certs[0] || !best.exams.some(e => e.user_stats.last_attempt && !e.user_stats.is_approved && !e.user_stats.is_completed)) {
        best = c
      } else if (c.lastActivity && (!best.lastActivity || c.lastActivity > best.lastActivity)) {
        best = c
      }
      continue
    }
    // Si no hay in-progress aún, elegir por fecha más reciente
    const bestIsInProgress = best.exams.some(e => e.user_stats.last_attempt && !e.user_stats.is_approved && !e.user_stats.is_completed)
    if (!bestIsInProgress && c.lastActivity && (!best.lastActivity || c.lastActivity > best.lastActivity)) {
      best = c
    }
  }
  return best.id
}

const HomePage = () => {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string>('')

  const isAdminOrEditor = user?.role === 'editor' || user?.role === 'editor_invitado' || user?.role === 'admin'
  const isCoordinator = user?.role === 'coordinator'
  const isResponsable = user?.role === 'responsable'
  const isResponsablePartner = user?.role === 'responsable_partner'

  // Branding del campus para candidatos (usa cache de Layout)
  const { data: brandingData } = useQuery({
    queryKey: ['candidato-branding'],
    queryFn: getCandidatoBranding,
    enabled: user?.role === 'candidato',
    staleTime: 10 * 60 * 1000,
  })
  const campusLogo = brandingData?.branding?.logo_url
  const campusName = brandingData?.branding?.campus_name
  const hasCampusBranding = !!brandingData?.branding?.primary_color

  const loadDashboard = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await dashboardService.getDashboard()
      setDashboardData(data)
    } catch (err: any) {
      console.error('Error loading dashboard:', err)
      setError(err.response?.data?.error || 'Error al cargar la página de inicio')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isAdminOrEditor && !isCoordinator && !isResponsable && !isResponsablePartner) {
      loadDashboard()
    }
  }, [isAdminOrEditor, isCoordinator, isResponsable, isResponsablePartner])

  // Construir certificaciones a partir de los datos
  const certifications = useMemo(() => {
    if (!dashboardData) return []
    return buildCertifications(
      dashboardData.exams || [],
      dashboardData.materials || [],
      dashboardData.exam_materials_map || {}
    )
  }, [dashboardData])

  // Establecer tab activo cuando llegan datos
  useEffect(() => {
    if (certifications.length > 0 && !activeTab) {
      setActiveTab(findMostRecentTab(certifications))
    }
  }, [certifications, activeTab])

  const activeCert = certifications.find(c => c.id === activeTab) || certifications[0] || null

  // Estadísticas globales (todas las certificaciones combinadas)
  const allExams = dashboardData?.exams || []
  const allMaterials = dashboardData?.materials || []
  const allApproved = allExams.filter(e => e.user_stats.is_approved)
  const allCompletedMats = allMaterials.filter(m => m.progress.percentage === 100)
  const globalAllExamsApproved = allExams.length > 0 && allApproved.length === allExams.length
  const globalMatsCompleted = allMaterials.length > 0 && allCompletedMats.length === allMaterials.length

  const globalAvgMaterial = allMaterials.length > 0
    ? Math.round(allMaterials.reduce((a, m) => a + m.progress.percentage, 0) / allMaterials.length)
    : 0
  const globalExamRate = allExams.length > 0 ? (allApproved.length / allExams.length) * 100 : 0
  const overallProgress = Math.round((globalAvgMaterial * 0.4) + (globalExamRate * 0.6))

  // Mensaje motivacional basado en progreso global
  const getMotivationalMessage = () => {
    if (globalAllExamsApproved) return { title: '¡Felicidades! 🎉', subtitle: 'Has completado todas tus certificaciones exitosamente' }
    if (globalMatsCompleted && allExams.length > 0) return { title: '¡Estás listo!', subtitle: 'Es momento de demostrar lo aprendido en el examen' }
    if (globalAvgMaterial >= 50) return { title: '¡Vas muy bien!', subtitle: 'Continúa con tu preparación para el examen' }
    if (globalAvgMaterial > 0) return { title: '¡Buen comienzo!', subtitle: 'Sigue estudiando para alcanzar tu certificación' }
    return { title: '¡Bienvenido!', subtitle: 'Comienza tu camino hacia la certificación' }
  }
  const motivationalMessage = getMotivationalMessage()

  const getNextAction = () => {
    if (globalAllExamsApproved) return { text: 'Ver mis certificados', route: '/certificates', icon: Award, color: 'bg-green-600 hover:bg-green-700' }
    if (globalMatsCompleted || allMaterials.length === 0) return { text: 'Presentar examen', route: '/exams', icon: FileText, color: 'bg-blue-600 hover:bg-blue-700' }
    return { text: 'Continuar estudiando', route: '/study-contents', icon: BookOpen, color: 'bg-blue-600 hover:bg-blue-700' }
  }
  const nextAction = getNextAction()

  if (isAdminOrEditor) return <EditorDashboard />
  if (user?.role === 'soporte') return <Navigate to="/support/dashboard" replace />
  if (isCoordinator) return <CoordinatorDashboard />
  if (isResponsable) return <ResponsableDashboard />
  if (isResponsablePartner) return <ResponsablePartnerDashboard />

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-4 border-blue-900"></div>
        <p className="mt-4 text-base font-medium text-gray-700">Cargando panel...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-600 rounded-lg">
        <p>{error}</p>
        <button onClick={loadDashboard} className="mt-2 text-sm text-red-700 underline hover:no-underline">
          Reintentar
        </button>
      </div>
    )
  }

  return (
    <div className="fluid-gap-5 flex flex-col">
      {/* Hero Section */}
      <div className={`rounded-fluid-xl fluid-p-8 text-white relative overflow-hidden ${
        hasCampusBranding
          ? 'bg-gradient-to-r from-primary-700 via-primary-600 to-primary-500'
          : 'bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700'
      }`}>
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-36 h-36 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

        <div className="relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between fluid-gap-4">
            <div className="flex-1">
              {/* Logo y nombre del campus */}
              {(campusLogo || campusName) && (
                <div className="flex items-center fluid-gap-3 fluid-mb-3">
                  {campusLogo ? (
                    <img src={campusLogo} alt={campusName || 'Campus'} className="h-24 sm:h-28 w-auto object-contain rounded-lg bg-white/10 p-2" />
                  ) : (
                    <GraduationCap className="fluid-icon-lg text-white/60" />
                  )}
                  {campusName && (
                    <span className="fluid-text-sm text-white/70 font-medium">{campusName}</span>
                  )}
                </div>
              )}
              <h1 className="fluid-text-4xl font-bold fluid-mb-2">
                {motivationalMessage.title}
              </h1>
              <p className={`fluid-text-base ${hasCampusBranding ? 'text-primary-100' : 'text-blue-100'}`}>
                {motivationalMessage.subtitle}
              </p>
              <p className={`fluid-text-sm fluid-mt-1 ${hasCampusBranding ? 'text-primary-200' : 'text-blue-200'}`}>
                Hola, <span className="font-medium text-white">{user?.name}</span>
              </p>
            </div>

            {/* Progreso circular */}
            <div className="flex items-center fluid-gap-4">
              <div className="relative w-[clamp(4rem,3rem+2vw,6rem)] h-[clamp(4rem,3rem+2vw,6rem)]">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="50%" cy="50%" r="45%" stroke="rgba(255,255,255,0.2)" strokeWidth="8" fill="none" />
                  <circle cx="50%" cy="50%" r="45%" stroke="white" strokeWidth="8" fill="none" strokeLinecap="round"
                    strokeDasharray={`${overallProgress * 2.83} 283`} className="transition-all duration-1000" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="fluid-text-xl font-bold">{overallProgress}%</span>
                </div>
              </div>
              <div className="fluid-text-sm">
                <p className={hasCampusBranding ? 'text-primary-100' : 'text-blue-100'}>Progreso</p>
                <p className="font-semibold">General</p>
              </div>
            </div>
          </div>

          <button
            onClick={() => navigate(nextAction.route)}
            className={`fluid-mt-5 w-full sm:w-auto inline-flex items-center justify-center fluid-gap-2 fluid-px-5 fluid-py-3 ${nextAction.color} rounded-fluid-lg font-semibold fluid-text-base text-white shadow-lg hover:shadow-xl transition-all transform hover:scale-105`}
          >
            <nextAction.icon className="fluid-icon" />
            {nextAction.text}
            <ArrowRight className="fluid-icon-sm" />
          </button>
        </div>
      </div>

      {/* Tabs de certificación (solo si hay más de 1) */}
      {certifications.length > 1 && (
        <div className="bg-white rounded-fluid-xl border border-gray-200 fluid-p-4">
          <div className="flex items-center fluid-gap-2 fluid-mb-3">
            <GraduationCap className="fluid-icon text-blue-600" />
            <h2 className="font-semibold fluid-text-sm text-gray-700">Mis Certificaciones</h2>
            <span className="fluid-text-xs text-gray-400 font-normal">({certifications.length})</span>
          </div>
          <div className={`grid grid-cols-1 ${certifications.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3'} fluid-gap-3`}>
            {certifications.map(cert => {
              const isActive = cert.id === activeTab
              const certApproved = cert.exams.length > 0 && cert.exams.every(e => e.user_stats.is_approved)
              const certApprovedExams = cert.exams.filter(e => e.user_stats.is_approved)
              const certCompletedMats = cert.materials.filter(m => m.progress.percentage === 100)
              const certAvgMat = cert.materials.length > 0
                ? Math.round(cert.materials.reduce((a, m) => a + m.progress.percentage, 0) / cert.materials.length)
                : 0
              const certExamRate = cert.exams.length > 0 ? Math.round((certApprovedExams.length / cert.exams.length) * 100) : 0
              const certProgress = Math.round((certAvgMat * 0.4) + (certExamRate * 0.6))
              const certHasActivity = cert.exams.some(e => e.user_stats.last_attempt)
              const isLastActive = cert.id === findMostRecentTab(certifications)

              return (
                <button
                  key={cert.id}
                  onClick={() => setActiveTab(cert.id)}
                  className={`relative text-left fluid-p-4 rounded-fluid-xl border-2 transition-all duration-200 ${
                    isActive
                      ? 'border-blue-500 bg-blue-50 shadow-md ring-1 ring-blue-200'
                      : certApproved
                        ? 'border-green-200 bg-green-50/50 hover:border-green-300 hover:shadow-sm'
                        : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                  }`}
                >
                  {/* Badge "Última actividad" */}
                  {isLastActive && !isActive && (
                    <span className="absolute -top-2 right-3 fluid-text-xs bg-amber-100 text-amber-700 fluid-px-2 py-0.5 rounded-full font-medium border border-amber-200">
                      Última actividad
                    </span>
                  )}

                  {/* Cabecera: ícono + nombre */}
                  <div className="flex items-start fluid-gap-3 fluid-mb-3">
                    <div className={`w-[clamp(2rem,1.75rem+0.5vw,2.5rem)] h-[clamp(2rem,1.75rem+0.5vw,2.5rem)] rounded-fluid-lg flex items-center justify-center flex-shrink-0 ${
                      certApproved
                        ? 'bg-green-100'
                        : isActive ? 'bg-blue-100' : 'bg-gray-100'
                    }`}>
                      {certApproved ? (
                        <CheckCircle2 className={`fluid-icon text-green-600`} />
                      ) : (
                        <Trophy className={`fluid-icon ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className={`font-semibold fluid-text-sm truncate ${
                        isActive ? 'text-blue-900' : 'text-gray-800'
                      }`}>
                        {cert.label}
                      </h3>
                      {cert.code && (
                        <span className="fluid-text-xs bg-blue-100 text-blue-600 fluid-px-2 py-0.5 rounded-full font-medium inline-block fluid-mt-1">
                          {cert.code}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Barra de progreso */}
                  <div className="fluid-mb-2">
                    <div className="flex justify-between fluid-text-xs text-gray-500 mb-1">
                      <span>Progreso</span>
                      <span className={`font-semibold ${
                        certApproved ? 'text-green-600' : isActive ? 'text-blue-600' : 'text-gray-600'
                      }`}>{certProgress}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-[clamp(0.25rem,0.2rem+0.1vw,0.375rem)]">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          certApproved ? 'bg-green-500' : isActive ? 'bg-blue-500' : 'bg-gray-400'
                        }`}
                        style={{ width: `${certProgress}%` }}
                      />
                    </div>
                  </div>

                  {/* Estado / Detalle */}
                  <div className="flex items-center justify-between fluid-text-xs">
                    {certApproved ? (
                      <span className="text-green-600 font-medium flex items-center fluid-gap-1">
                        <CheckCircle2 className="fluid-icon-xs" />
                        Completada
                      </span>
                    ) : certHasActivity ? (
                      <span className="text-blue-600 font-medium">En progreso</span>
                    ) : (
                      <span className="text-gray-400">Sin iniciar</span>
                    )}
                    <span className="text-gray-400">
                      {cert.exams.length} exam{cert.exams.length !== 1 ? '.' : ''} · {cert.materials.length} mat.
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Contenido de la certificación activa */}
      {activeCert && (
        <CertificationPathCard certification={activeCert} />
      )}

      {/* Mensaje de felicitación global cuando TODAS están completas */}
      {globalAllExamsApproved && allExams.length > 0 && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-fluid-xl border border-green-200 fluid-p-5 text-center">
          <div className="w-[clamp(3rem,2.5rem+1vw,4rem)] h-[clamp(3rem,2.5rem+1vw,4rem)] mx-auto fluid-mb-4 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-full flex items-center justify-center shadow-lg shadow-amber-500/30">
            <Trophy className="fluid-icon-xl text-white" />
          </div>
          <h2 className="fluid-text-xl font-bold text-gray-800 fluid-mb-2">
            {certifications.length > 1 ? '¡Todas las certificaciones completadas!' : '¡Proceso de certificación completado!'}
          </h2>
          <p className="fluid-text-base text-gray-600 fluid-mb-4">Has aprobado todos tus exámenes exitosamente.</p>
          <button
            onClick={() => navigate('/certificates')}
            className="w-full sm:w-auto inline-flex items-center justify-center fluid-gap-2 fluid-px-5 fluid-py-3 bg-green-600 hover:bg-green-700 text-white rounded-fluid-lg font-semibold fluid-text-base transition-all transform hover:scale-105 active:scale-[0.98]"
          >
            <Award className="fluid-icon" />
            Ver mis certificados
            <ArrowRight className="fluid-icon-sm" />
          </button>
        </div>
      )}
    </div>
  )
}

export default HomePage
