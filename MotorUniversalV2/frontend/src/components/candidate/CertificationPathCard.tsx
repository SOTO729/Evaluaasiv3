import { useNavigate } from 'react-router-dom'
import { DashboardExam, DashboardMaterial } from '../../services/dashboardService'
import {
  BookOpen,
  FileText,
  Award,
  ChevronRight,
  Target,
  CheckCircle2,
  Play,
  ArrowRight,
  Sparkles,
  Trophy,
  Zap,
  Star
} from 'lucide-react'

export interface Certification {
  id: string
  label: string
  code: string | null
  exams: DashboardExam[]
  materials: DashboardMaterial[]
  lastActivity: string | null
}

interface CertificationPathCardProps {
  certification: Certification
}

const CertificationPathCard = ({ certification }: CertificationPathCardProps) => {
  const navigate = useNavigate()
  const { exams, materials } = certification

  const completedMaterials = materials.filter(m => m.progress.percentage === 100)
  const approvedExams = exams.filter(e => e.user_stats.is_approved)
  const pendingMaterials = materials.length - completedMaterials.length
  const pendingExams = exams.length - approvedExams.length

  const materialCompleted = materials.length > 0 && completedMaterials.length === materials.length
  const allExamsApproved = exams.length > 0 && approvedExams.length === exams.length

  const avgMaterialProgress = materials.length > 0
    ? Math.round(materials.reduce((acc, m) => acc + m.progress.percentage, 0) / materials.length)
    : 0

  const examApprovalRate = exams.length > 0 ? (approvedExams.length / exams.length) * 100 : 0

  const getCurrentStep = () => {
    if (allExamsApproved) return 3
    if (materialCompleted) return 2
    return 1
  }
  const currentStep = getCurrentStep()

  return (
    <>
      {/* Timeline de Progreso */}
      <div className="bg-white rounded-fluid-xl border border-gray-200 fluid-p-8">
        <h2 className="fluid-text-lg font-semibold text-gray-800 fluid-mb-5 flex items-center fluid-gap-2">
          <Target className="fluid-icon text-blue-600" />
          Tu ruta de certificación
          {certification.code && (
            <span className="fluid-text-xs bg-blue-100 text-blue-700 fluid-px-2 py-0.5 rounded-full font-medium">
              {certification.code}
            </span>
          )}
        </h2>

        <div className="relative">
          <div className="absolute top-7 left-7 right-7 h-[clamp(0.125rem,0.1rem+0.1vw,0.25rem)] bg-gray-200 rounded-full">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all duration-1000"
              style={{ width: `${(currentStep - 1) * 50}%` }}
            />
          </div>

          <div className="grid grid-cols-3 fluid-gap-3 relative">
            {/* Paso 1: Estudiar */}
            <div className="flex flex-col items-center text-center">
              <div className={`w-[clamp(3rem,2.5rem+1vw,4rem)] h-[clamp(3rem,2.5rem+1vw,4rem)] rounded-full flex items-center justify-center fluid-mb-2 transition-all duration-300 ${
                currentStep >= 1
                  ? materialCompleted
                    ? 'bg-green-500 text-white shadow-lg shadow-green-500/30'
                    : 'bg-blue-500 text-white shadow-lg shadow-blue-500/30 ring-[clamp(2px,0.15rem+0.1vw,4px)] ring-blue-100'
                  : 'bg-gray-100 text-gray-400'
              }`}>
                {materialCompleted ? (
                  <CheckCircle2 className="fluid-icon-xl" />
                ) : (
                  <BookOpen className="fluid-icon-lg" />
                )}
              </div>
              <h3 className={`font-semibold fluid-text-sm ${currentStep >= 1 ? 'text-gray-800' : 'text-gray-400'}`}>
                Estudiar
              </h3>
              <p className="fluid-text-xs text-gray-500 fluid-mt-1">
                {completedMaterials.length}/{materials.length} materiales
              </p>
              {currentStep === 1 && !materialCompleted && (
                <span className="fluid-mt-1 fluid-text-xs bg-blue-100 text-blue-700 fluid-px-2 py-0.5 rounded-full font-medium">
                  En progreso
                </span>
              )}
            </div>

            {/* Paso 2: Examinar */}
            <div className="flex flex-col items-center text-center">
              <div className={`w-[clamp(3rem,2.5rem+1vw,4rem)] h-[clamp(3rem,2.5rem+1vw,4rem)] rounded-full flex items-center justify-center fluid-mb-2 transition-all duration-300 ${
                currentStep >= 2
                  ? allExamsApproved
                    ? 'bg-green-500 text-white shadow-lg shadow-green-500/30'
                    : 'bg-blue-500 text-white shadow-lg shadow-blue-500/30 ring-[clamp(2px,0.15rem+0.1vw,4px)] ring-blue-100'
                  : 'bg-gray-100 text-gray-400'
              }`}>
                {allExamsApproved ? (
                  <CheckCircle2 className="fluid-icon-xl" />
                ) : (
                  <FileText className="fluid-icon-lg" />
                )}
              </div>
              <h3 className={`font-semibold fluid-text-sm ${currentStep >= 2 ? 'text-gray-800' : 'text-gray-400'}`}>
                Examinar
              </h3>
              <p className="fluid-text-xs text-gray-500 fluid-mt-1">
                {approvedExams.length}/{exams.length} aprobados
              </p>
              {currentStep === 2 && !allExamsApproved && (
                <span className="fluid-mt-1 fluid-text-xs bg-blue-100 text-blue-700 fluid-px-2 py-0.5 rounded-full font-medium">
                  En progreso
                </span>
              )}
            </div>

            {/* Paso 3: Certificar */}
            <div className="flex flex-col items-center text-center">
              <div className={`w-[clamp(3rem,2.5rem+1vw,4rem)] h-[clamp(3rem,2.5rem+1vw,4rem)] rounded-full flex items-center justify-center fluid-mb-2 transition-all duration-300 ${
                currentStep >= 3
                  ? 'bg-gradient-to-br from-yellow-400 to-amber-500 text-white shadow-lg shadow-amber-500/30'
                  : 'bg-gray-100 text-gray-400'
              }`}>
                {allExamsApproved ? (
                  <Trophy className="fluid-icon-xl" />
                ) : (
                  <Award className="fluid-icon-lg" />
                )}
              </div>
              <h3 className={`font-semibold fluid-text-sm ${currentStep >= 3 ? 'text-gray-800' : 'text-gray-400'}`}>
                Certificar
              </h3>
              <p className="fluid-text-xs text-gray-500 fluid-mt-1">
                {allExamsApproved ? '!Completado!' : 'Pendiente'}
              </p>
              {allExamsApproved && (
                <span className="fluid-mt-1 fluid-text-xs bg-green-100 text-green-700 fluid-px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                  <Sparkles className="fluid-icon-xs" />
                  Logrado
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tarjetas de Acceso Rapido */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 fluid-gap-5">
        {/* Materiales de Estudio */}
        <div
          onClick={() => navigate('/study-contents')}
          className="bg-white rounded-fluid-xl border border-gray-200 fluid-p-5 cursor-pointer group hover:border-blue-300 hover:shadow-lg transition-all duration-300 active:scale-[0.98]"
        >
          <div className="flex items-start justify-between fluid-mb-4">
            <div className={`w-[clamp(2.75rem,2.5rem+0.5vw,3.5rem)] h-[clamp(2.75rem,2.5rem+0.5vw,3.5rem)] rounded-fluid-lg flex items-center justify-center ${
              materialCompleted ? 'bg-green-100' : 'bg-blue-100'
            }`}>
              <BookOpen className={`fluid-icon-lg ${materialCompleted ? 'text-green-600' : 'text-blue-600'}`} />
            </div>
            <ChevronRight className="fluid-icon text-gray-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
          </div>

          <h3 className="fluid-text-lg font-semibold text-gray-800 fluid-mb-1">Materiales</h3>
          <p className="fluid-text-sm text-gray-500 fluid-mb-4">Material de estudio para tu preparacion</p>

          <div className="fluid-mb-3">
            <div className="flex justify-between fluid-text-xs text-gray-500 mb-1">
              <span>Progreso</span>
              <span className="font-medium text-gray-700">{avgMaterialProgress}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-[clamp(0.375rem,0.3rem+0.1vw,0.5rem)]">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  materialCompleted ? 'bg-green-500' : 'bg-blue-500'
                }`}
                style={{ width: `${avgMaterialProgress}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="fluid-text-sm text-gray-600">
              {completedMaterials.length} de {materials.length} completos
            </span>
            {materialCompleted && (
              <span className="flex items-center gap-1 text-green-600 fluid-text-xs font-medium">
                <CheckCircle2 className="fluid-icon-sm" />
                Completado
              </span>
            )}
          </div>
        </div>

        {/* Examenes */}
        <div
          onClick={() => navigate('/exams')}
          className="bg-white rounded-fluid-xl border border-gray-200 fluid-p-5 cursor-pointer group hover:border-amber-300 hover:shadow-lg transition-all duration-300 active:scale-[0.98]"
        >
          <div className="flex items-start justify-between fluid-mb-4">
            <div className={`w-[clamp(2.75rem,2.5rem+0.5vw,3.5rem)] h-[clamp(2.75rem,2.5rem+0.5vw,3.5rem)] rounded-fluid-lg flex items-center justify-center ${
              allExamsApproved ? 'bg-green-100' : 'bg-amber-100'
            }`}>
              <FileText className={`fluid-icon-lg ${allExamsApproved ? 'text-green-600' : 'text-amber-600'}`} />
            </div>
            <ChevronRight className="fluid-icon text-gray-300 group-hover:text-amber-500 group-hover:translate-x-1 transition-all" />
          </div>

          <h3 className="fluid-text-lg font-semibold text-gray-800 fluid-mb-1">Examenes</h3>
          <p className="fluid-text-sm text-gray-500 fluid-mb-4">Demuestra tu conocimiento y certificate</p>

          <div className="fluid-mb-3">
            <div className="flex justify-between fluid-text-xs text-gray-500 mb-1">
              <span>Aprobacion</span>
              <span className="font-medium text-gray-700">{Math.round(examApprovalRate)}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-[clamp(0.375rem,0.3rem+0.1vw,0.5rem)]">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  allExamsApproved ? 'bg-green-500' : 'bg-amber-500'
                }`}
                style={{ width: `${examApprovalRate}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="fluid-text-sm text-gray-600">
              {approvedExams.length} de {exams.length} aprobados
            </span>
            {allExamsApproved && (
              <span className="flex items-center gap-1 text-green-600 fluid-text-xs font-medium">
                <CheckCircle2 className="fluid-icon-sm" />
                Completado
              </span>
            )}
          </div>
        </div>

        {/* Certificados */}
        <div
          onClick={() => navigate('/certificates')}
          className="bg-white rounded-fluid-xl border border-green-200 fluid-p-5 cursor-pointer group hover:border-green-400 hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-white to-green-50 active:scale-[0.98] sm:col-span-2 lg:col-span-1"
        >
          <div className="flex items-start justify-between fluid-mb-4">
            <div className="w-[clamp(2.75rem,2.5rem+0.5vw,3.5rem)] h-[clamp(2.75rem,2.5rem+0.5vw,3.5rem)] rounded-fluid-lg flex items-center justify-center bg-gradient-to-br from-yellow-100 to-amber-100">
              <Award className="fluid-icon-lg text-amber-600" />
            </div>
            <ChevronRight className="fluid-icon text-green-400 group-hover:text-green-600 group-hover:translate-x-1 transition-all" />
          </div>

          <h3 className="fluid-text-lg font-semibold text-gray-800 fluid-mb-1">Certificados</h3>
          <p className="fluid-text-sm text-gray-500 fluid-mb-4">
            {approvedExams.length > 0 ? 'Descarga tus certificaciones' : 'Consulta tus certificaciones'}
          </p>

          {approvedExams.length > 0 ? (
            <div className="flex items-center fluid-gap-2 fluid-p-3 bg-green-100 rounded-fluid-lg">
              <Trophy className="fluid-icon text-green-600" />
              <div>
                <p className="fluid-text-sm font-medium text-green-800">{approvedExams.length} certificacion{approvedExams.length !== 1 ? 'es' : ''}</p>
                <p className="fluid-text-xs text-green-600">Disponibles para descargar</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center fluid-gap-2 fluid-p-3 bg-amber-50 rounded-fluid-lg">
              <Target className="fluid-icon text-amber-500" />
              <div>
                <p className="fluid-text-sm font-medium text-amber-700">En progreso</p>
                <p className="fluid-text-xs text-amber-500">Aprueba examenes para obtener certificados</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Estadisticas Rapidas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 fluid-gap-4">
        <div className="bg-white rounded-fluid-lg border border-gray-200 fluid-p-4 text-center">
          <div className="w-[clamp(2rem,1.75rem+0.5vw,2.5rem)] h-[clamp(2rem,1.75rem+0.5vw,2.5rem)] mx-auto fluid-mb-2 bg-blue-100 rounded-full flex items-center justify-center">
            <BookOpen className="fluid-icon text-blue-600" />
          </div>
          <p className="fluid-text-2xl font-bold text-gray-800">{materials.length}</p>
          <p className="fluid-text-xs text-gray-500">Materiales</p>
        </div>

        <div className="bg-white rounded-fluid-lg border border-gray-200 fluid-p-4 text-center">
          <div className="w-[clamp(2rem,1.75rem+0.5vw,2.5rem)] h-[clamp(2rem,1.75rem+0.5vw,2.5rem)] mx-auto fluid-mb-2 bg-amber-100 rounded-full flex items-center justify-center">
            <FileText className="fluid-icon text-amber-600" />
          </div>
          <p className="fluid-text-2xl font-bold text-gray-800">{exams.length}</p>
          <p className="fluid-text-xs text-gray-500">Examenes</p>
        </div>

        <div className="bg-white rounded-fluid-lg border border-gray-200 fluid-p-4 text-center">
          <div className="w-[clamp(2rem,1.75rem+0.5vw,2.5rem)] h-[clamp(2rem,1.75rem+0.5vw,2.5rem)] mx-auto fluid-mb-2 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle2 className="fluid-icon text-green-600" />
          </div>
          <p className="fluid-text-2xl font-bold text-gray-800">{approvedExams.length}</p>
          <p className="fluid-text-xs text-gray-500">Certificaciones</p>
        </div>

        <div className="bg-white rounded-fluid-lg border border-gray-200 fluid-p-4 text-center">
          <div className="w-[clamp(2rem,1.75rem+0.5vw,2.5rem)] h-[clamp(2rem,1.75rem+0.5vw,2.5rem)] mx-auto fluid-mb-2 bg-purple-100 rounded-full flex items-center justify-center">
            <Star className="fluid-icon text-purple-600" />
          </div>
          <p className="fluid-text-2xl font-bold text-gray-800">
            {exams.length > 0 && approvedExams.length > 0
              ? `${Math.round(approvedExams.reduce((acc, e) => acc + (e.user_stats.best_score || 0), 0) / approvedExams.length)}%`
              : '--'}
          </p>
          <p className="fluid-text-xs text-gray-500">Promedio</p>
        </div>
      </div>

      {/* Proximos Pasos - Recomendaciones */}
      {!allExamsApproved && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-fluid-xl border border-blue-100 fluid-p-5">
          <h2 className="fluid-text-lg font-semibold text-gray-800 fluid-mb-4 flex items-center fluid-gap-2">
            <Zap className="fluid-icon text-blue-600" />
            Proximos pasos recomendados
          </h2>

          <div className="flex flex-col fluid-gap-3">
            {!materialCompleted && materials.length > 0 && (
              <div
                onClick={() => navigate('/study-contents')}
                className="flex items-center fluid-gap-4 fluid-p-4 bg-white rounded-fluid-lg border border-blue-100 cursor-pointer hover:border-blue-300 hover:shadow-md transition-all group active:scale-[0.98]"
              >
                <div className="w-[clamp(2.25rem,2rem+0.5vw,2.5rem)] h-[clamp(2.25rem,2rem+0.5vw,2.5rem)] bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Play className="fluid-icon text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium fluid-text-base text-gray-800">Continua estudiando</p>
                  <p className="fluid-text-sm text-gray-500">Te falta completar {pendingMaterials} material{pendingMaterials !== 1 ? 'es' : ''}</p>
                </div>
                <ArrowRight className="fluid-icon text-gray-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
              </div>
            )}

            {(materialCompleted || materials.length === 0) && pendingExams > 0 && (
              <div
                onClick={() => navigate('/exams')}
                className="flex items-center fluid-gap-4 fluid-p-4 bg-white rounded-fluid-lg border border-amber-100 cursor-pointer hover:border-amber-300 hover:shadow-md transition-all group active:scale-[0.98]"
              >
                <div className="w-[clamp(2.25rem,2rem+0.5vw,2.5rem)] h-[clamp(2.25rem,2rem+0.5vw,2.5rem)] bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Target className="fluid-icon text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium fluid-text-base text-gray-800">Presenta tu examen</p>
                  <p className="fluid-text-sm text-gray-500">Tienes {pendingExams} examen{pendingExams !== 1 ? 'es' : ''} por aprobar</p>
                </div>
                <ArrowRight className="fluid-icon text-gray-300 group-hover:text-amber-500 group-hover:translate-x-1 transition-all" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mensaje de felicitacion cuando todo esta completo */}
      {allExamsApproved && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-fluid-xl border border-green-200 fluid-p-5 text-center">
          <div className="w-[clamp(3rem,2.5rem+1vw,4rem)] h-[clamp(3rem,2.5rem+1vw,4rem)] mx-auto fluid-mb-4 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-full flex items-center justify-center shadow-lg shadow-amber-500/30">
            <Trophy className="fluid-icon-xl text-white" />
          </div>
          <h2 className="fluid-text-xl font-bold text-gray-800 fluid-mb-2">!Proceso de certificacion completado!</h2>
          <p className="fluid-text-base text-gray-600 fluid-mb-4">Has aprobado todos tus examenes exitosamente.</p>
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
    </>
  )
}

export default CertificationPathCard
export type { CertificationPathCardProps }
