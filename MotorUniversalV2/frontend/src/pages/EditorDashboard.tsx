import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { editorDashboardService, EditorDashboardData } from '../services/editorDashboardService'
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  RadialBarChart, RadialBar, Legend
} from 'recharts'
import { 
  ClipboardList, 
  FileText, 
  BookOpen, 
  ChevronRight, 
  Plus,
  CheckCircle2,
  Clock,
  HelpCircle,
  TrendingUp,
  Edit3,
  AlertCircle,
  ArrowRight,
  Sparkles,
  Zap,
  Target,
  BarChart3,
  GraduationCap
} from 'lucide-react'

const COLORS = {
  purple: { bg: '#7c3aed', light: '#ede9fe', text: '#6d28d9', border: '#c4b5fd' },
  blue: { bg: '#2563eb', light: '#dbeafe', text: '#1d4ed8', border: '#93c5fd' },
  emerald: { bg: '#059669', light: '#d1fae5', text: '#047857', border: '#6ee7b7' },
  amber: { bg: '#d97706', light: '#fef3c7', text: '#b45309', border: '#fcd34d' },
  rose: { bg: '#e11d48', light: '#ffe4e6', text: '#be123c', border: '#fda4af' },
} as const

const PIE_COLORS = ['#7c3aed', '#2563eb', '#059669', '#d97706', '#e11d48', '#0891b2']

const EditorDashboard = () => {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [dashboardData, setDashboardData] = useState<EditorDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeFlowStep, setActiveFlowStep] = useState<number | null>(null)

  useEffect(() => {
    loadDashboard()
  }, [])

  const loadDashboard = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await editorDashboardService.getDashboard()
      setDashboardData(data)
    } catch (err: any) {
      console.error('Error loading editor dashboard:', err)
      setError(err.response?.data?.error || 'Error al cargar el dashboard del editor')
    } finally {
      setLoading(false)
    }
  }

  const summary = dashboardData?.summary
  const recentStandards = dashboardData?.recent_standards || []
  const recentExams = dashboardData?.recent_exams || []
  const recentMaterials = dashboardData?.recent_materials || []

  // Datos para gráfico de distribución de contenido
  const contentDistribution = useMemo(() => {
    if (!summary) return []
    return [
      { name: 'Estándares', value: summary.standards.total, color: COLORS.purple.bg },
      { name: 'Exámenes', value: summary.exams.total, color: COLORS.blue.bg },
      { name: 'Materiales', value: summary.materials.total, color: COLORS.emerald.bg },
    ].filter(d => d.value > 0)
  }, [summary])

  // Datos para gráfico de estado de publicación
  const publishStatus = useMemo(() => {
    if (!summary) return []
    return [
      { name: 'Exámenes', publicados: summary.exams.published, borradores: summary.exams.draft },
      { name: 'Materiales', publicados: summary.materials.published, borradores: summary.materials.draft },
      { name: 'ECM', publicados: summary.standards.active, borradores: summary.standards.total - summary.standards.active },
    ]
  }, [summary])

  // Datos para gráfico radial de progreso
  const progressData = useMemo(() => {
    if (!summary) return []
    const examRate = summary.exams.total > 0 ? Math.round((summary.exams.published / summary.exams.total) * 100) : 0
    const matRate = summary.materials.total > 0 ? Math.round((summary.materials.published / summary.materials.total) * 100) : 0
    const stdRate = summary.standards.total > 0 ? Math.round((summary.standards.active / summary.standards.total) * 100) : 0
    return [
      { name: 'Exámenes pub.', value: examRate, fill: COLORS.blue.bg },
      { name: 'Materiales pub.', value: matRate, fill: COLORS.emerald.bg },
      { name: 'ECM activos', value: stdRate, fill: COLORS.purple.bg },
    ]
  }, [summary])

  // Datos para preguntas por tipo
  const questionsByType = useMemo(() => {
    if (!summary?.questions.by_type) return []
    const typeLabels: Record<string, string> = {
      'multiple_choice': 'Opción Múltiple',
      'multiple_selection': 'Sel. Múltiple',
      'multiple_select': 'Sel. Múltiple',
      'true_false': 'V / F',
      'ordering': 'Ordenamiento',
    }
    return Object.entries(summary.questions.by_type).map(([type, count], i) => ({
      name: typeLabels[type] || type,
      cantidad: count as number,
      fill: PIE_COLORS[i % PIE_COLORS.length]
    }))
  }, [summary])

  // Total contenido
  const totalContent = (summary?.standards.total || 0) + (summary?.exams.total || 0) + (summary?.materials.total || 0)

  // Flow steps
  const flowSteps = [
    {
      num: 1,
      title: 'Crear ECM',
      subtitle: 'Estándar de Competencia',
      description: 'Define el estándar de competencia o certificación. Es la base para organizar exámenes y materiales. Incluye código, sector, nivel y centro evaluador.',
      icon: ClipboardList,
      color: COLORS.purple,
      action: () => navigate('/standards/new'),
      actionLabel: 'Nuevo ECM',
      link: '/standards',
      required: true,
    },
    {
      num: 2,
      title: 'Crear Examen',
      subtitle: 'Evaluación de conocimientos',
      description: 'Crea un examen vinculado a un ECM. Agrega categorías, preguntas de distintos tipos, configura puntaje y tiempo límite.',
      icon: FileText,
      color: COLORS.blue,
      action: () => navigate('/exams/new'),
      actionLabel: 'Nuevo Examen',
      link: '/exams',
      required: true,
    },
    {
      num: 3,
      title: 'Crear Material',
      subtitle: 'Contenido de estudio',
      description: 'Diseña materiales de estudio con sesiones y temas. Incluye texto enriquecido, imágenes y videos. No requiere examen previo.',
      icon: BookOpen,
      color: COLORS.emerald,
      action: () => navigate('/study-contents/new'),
      actionLabel: 'Nuevo Material',
      link: '/study-contents',
      required: false,
    },
  ]

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-blue-200 rounded-full animate-spin border-t-blue-600"></div>
          <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-blue-600" />
        </div>
        <p className="fluid-mt-4 fluid-text-base font-medium text-gray-600">Preparando tu panel...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="fluid-p-6 bg-red-50 text-red-600 rounded-fluid-xl border border-red-200">
        <div className="flex items-center fluid-gap-3">
          <AlertCircle className="fluid-icon text-red-500" />
          <div>
            <p className="font-medium">{error}</p>
            <button onClick={loadDashboard} className="fluid-mt-1 fluid-text-sm text-red-700 underline hover:no-underline">
              Reintentar
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col fluid-gap-6">
      {/* Estilos */}
      <style>{`
        @keyframes gradientShift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animated-gradient-editor {
          background: linear-gradient(-45deg, #1e3a8a, #1e40af, #1d4ed8, #2563eb, #1e3a8a, #172554, #1e40af, #1d4ed8);
          background-size: 400% 400%;
          animation: gradientShift 20s ease infinite;
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-slide-up {
          animation: fadeSlideUp 0.5s ease-out forwards;
        }
        .delay-100 { animation-delay: 0.1s; opacity: 0; }
        .delay-200 { animation-delay: 0.2s; opacity: 0; }
        .delay-300 { animation-delay: 0.3s; opacity: 0; }
        @keyframes pulse-soft {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        .hover-pulse:hover {
          animation: pulse-soft 0.6s ease-in-out;
        }
      `}</style>

      {/* ===== HERO SECTION ===== */}
      <div className="animated-gradient-editor rounded-fluid-2xl fluid-p-8 text-white relative overflow-hidden">
        {/* Decoraciones de fondo */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-white/5 rounded-full -translate-y-1/3 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-56 h-56 bg-white/5 rounded-full translate-y-1/3 -translate-x-1/3" />
        <div className="absolute top-1/2 right-1/4 w-32 h-32 bg-white/3 rounded-full" />
        
        <div className="relative z-10">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between fluid-gap-6">
            <div className="flex-1">
              <div className="flex items-center fluid-gap-3 fluid-mb-3">
                <div className="w-10 h-10 bg-white/15 rounded-fluid-lg flex items-center justify-center backdrop-blur-sm">
                  <Edit3 className="w-5 h-5" />
                </div>
                <span className="text-blue-200 fluid-text-sm font-semibold uppercase tracking-widest">
                  {user?.role === 'editor_invitado' ? 'Editor Invitado' : 'Panel de Editor'}
                </span>
              </div>
              <h1 className="fluid-text-3xl font-bold fluid-mb-2">
                ¡{user?.gender === 'F' ? 'Bienvenida' : 'Bienvenido'}, {user?.name}!
              </h1>
              <p className="text-blue-100 fluid-text-base max-w-xl">
                {totalContent > 0
                  ? `Tienes ${totalContent} contenidos creados. Sigue construyendo experiencias de aprendizaje.`
                  : 'Comienza creando tu primer Estándar de Competencia y construye contenido de certificación.'
                }
              </p>
            </div>
            
            {/* Stats cards en hero */}
            <div className="grid grid-cols-3 fluid-gap-3 lg:min-w-[320px]">
              <div className="text-center bg-white/10 backdrop-blur-sm rounded-fluid-xl fluid-p-4 border border-white/10 hover:bg-white/15 transition-colors">
                <ClipboardList className="w-5 h-5 mx-auto fluid-mb-1 text-purple-300" />
                <p className="fluid-text-2xl font-bold">{summary?.standards.total || 0}</p>
                <p className="fluid-text-xs text-blue-200">ECM</p>
              </div>
              <div className="text-center bg-white/10 backdrop-blur-sm rounded-fluid-xl fluid-p-4 border border-white/10 hover:bg-white/15 transition-colors">
                <FileText className="w-5 h-5 mx-auto fluid-mb-1 text-blue-300" />
                <p className="fluid-text-2xl font-bold">{summary?.exams.total || 0}</p>
                <p className="fluid-text-xs text-blue-200">Exámenes</p>
              </div>
              <div className="text-center bg-white/10 backdrop-blur-sm rounded-fluid-xl fluid-p-4 border border-white/10 hover:bg-white/15 transition-colors">
                <BookOpen className="w-5 h-5 mx-auto fluid-mb-1 text-emerald-300" />
                <p className="fluid-text-2xl font-bold">{summary?.materials.total || 0}</p>
                <p className="fluid-text-xs text-blue-200">Materiales</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== FLUJO DE CREACIÓN ===== */}
      <div className="bg-white rounded-fluid-2xl border border-gray-200 fluid-p-6 animate-fade-slide-up">
        <div className="flex items-center fluid-gap-3 fluid-mb-6">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-fluid-xl flex items-center justify-center shadow-md">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="fluid-text-lg font-bold text-gray-900">Flujo de Creación</h2>
            <p className="fluid-text-sm text-gray-500">Sigue estos pasos para crear contenido de certificación</p>
          </div>
        </div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 fluid-gap-4">
          {flowSteps.map((step, index) => {
            const Icon = step.icon
            const isActive = activeFlowStep === index
            return (
              <div 
                key={step.num}
                className={`relative rounded-fluid-xl border-2 fluid-p-5 transition-all duration-300 cursor-pointer group ${
                  isActive 
                    ? 'shadow-lg' 
                    : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                }`}
                onMouseEnter={() => setActiveFlowStep(index)}
                onMouseLeave={() => setActiveFlowStep(null)}
                style={{ 
                  borderColor: isActive ? step.color.bg + '40' : undefined, 
                  backgroundColor: isActive ? step.color.light + '30' : undefined 
                }}
              >
                {/* Step number badge */}
                <div className="flex items-start fluid-gap-4">
                  <div 
                    className="w-[52px] h-[52px] rounded-fluid-xl flex items-center justify-center flex-shrink-0 shadow-md transition-transform group-hover:scale-110"
                    style={{ backgroundColor: step.color.bg }}
                  >
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center fluid-gap-2 fluid-mb-1">
                      <span 
                        className="fluid-text-xs font-bold px-2 py-0.5 rounded-full text-white"
                        style={{ backgroundColor: step.color.bg }}
                      >
                        Paso {step.num}
                      </span>
                      {!step.required && (
                        <span className="fluid-text-xs text-gray-400 italic">opcional*</span>
                      )}
                    </div>
                    <h3 className="font-bold text-gray-900 fluid-text-base">{step.title}</h3>
                    <p className="fluid-text-xs text-gray-500 fluid-mt-0.5">{step.subtitle}</p>
                  </div>
                </div>

                {/* Descripción expandida */}
                <p className={`fluid-text-sm text-gray-600 fluid-mt-3 leading-relaxed transition-all duration-300 ${
                  isActive ? 'opacity-100 max-h-40' : 'opacity-70 max-h-12 overflow-hidden'
                }`}>
                  {step.description}
                </p>

                {/* Acciones */}
                <div className="flex items-center fluid-gap-2 fluid-mt-4">
                  <button
                    onClick={(e) => { e.stopPropagation(); step.action(); }}
                    className="flex-1 flex items-center justify-center fluid-gap-2 fluid-py-2.5 rounded-fluid-lg font-semibold fluid-text-sm text-white transition-all hover:shadow-md active:scale-95"
                    style={{ backgroundColor: step.color.bg }}
                  >
                    <Plus className="w-4 h-4" />
                    {step.actionLabel}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate(step.link); }}
                    className="flex items-center justify-center fluid-py-2.5 fluid-px-3 rounded-fluid-lg font-medium fluid-text-sm border-2 transition-all hover:shadow-sm"
                    style={{ borderColor: step.color.border, color: step.color.text }}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Nota */}
        <div className="flex items-start fluid-gap-2 fluid-mt-4 fluid-p-3 bg-amber-50 rounded-fluid-lg border border-amber-200">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="fluid-text-xs text-amber-700">
            <strong>Nota:</strong> Puedes crear materiales de estudio sin necesidad de crear un examen primero. 
            Sin embargo, se recomienda seguir el flujo completo: ECM → Examen → Material.
          </p>
        </div>
      </div>

      {/* ===== ESTADÍSTICAS Y GRÁFICOS ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 fluid-gap-6">
        {/* Distribución de contenido (Pie Chart) */}
        <div className="bg-white rounded-fluid-2xl border border-gray-200 fluid-p-6 animate-fade-slide-up delay-100">
          <div className="flex items-center fluid-gap-3 fluid-mb-4">
            <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-fluid-lg flex items-center justify-center shadow-sm">
              <Target className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">Distribución de Contenido</h3>
              <p className="fluid-text-xs text-gray-500">{totalContent} contenidos totales</p>
            </div>
          </div>
          
          {contentDistribution.length > 0 ? (
            <div className="flex items-center fluid-gap-4">
              <div className="w-[180px] h-[180px] flex-shrink-0" style={{ minWidth: 180, minHeight: 180 }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                  <PieChart>
                    <Pie
                      data={contentDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {contentDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value) => [`${value}`, '']}
                      contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '13px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 flex flex-col fluid-gap-3">
                {contentDistribution.map((item, i) => (
                  <div key={i} className="flex items-center fluid-gap-3">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="fluid-text-sm text-gray-700 flex-1">{item.name}</span>
                    <span className="fluid-text-lg font-bold text-gray-900">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-[180px] text-gray-400">
              <BarChart3 className="w-10 h-10 fluid-mb-2 opacity-40" />
              <p className="fluid-text-sm">Crea contenido para ver estadísticas</p>
            </div>
          )}
        </div>

        {/* Estado de publicación (Bar Chart) */}
        <div className="bg-white rounded-fluid-2xl border border-gray-200 fluid-p-6 animate-fade-slide-up delay-200">
          <div className="flex items-center fluid-gap-3 fluid-mb-4">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-fluid-lg flex items-center justify-center shadow-sm">
              <BarChart3 className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">Estado de Publicación</h3>
              <p className="fluid-text-xs text-gray-500">Publicados vs. borradores/inactivos</p>
            </div>
          </div>
          
          {totalContent > 0 ? (
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <BarChart data={publishStatus} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 11, fill: '#6b7280' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis 
                    tick={{ fontSize: 11, fill: '#6b7280' }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '13px' }}
                  />
                  <Bar dataKey="publicados" fill="#059669" radius={[6, 6, 0, 0]} name="Publicados / Activos" />
                  <Bar dataKey="borradores" fill="#d97706" radius={[6, 6, 0, 0]} name="Borradores / Inactivos" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-[180px] text-gray-400">
              <TrendingUp className="w-10 h-10 fluid-mb-2 opacity-40" />
              <p className="fluid-text-sm">Sin datos aún</p>
            </div>
          )}
        </div>
      </div>

      {/* ===== PROGRESO RADIAL + PREGUNTAS ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 fluid-gap-6">
        {/* Tasa de publicación (Radial) */}
        <div className="bg-white rounded-fluid-2xl border border-gray-200 fluid-p-6 animate-fade-slide-up delay-300">
          <div className="flex items-center fluid-gap-3 fluid-mb-4">
            <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-fluid-lg flex items-center justify-center shadow-sm">
              <GraduationCap className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">Tasa de Publicación</h3>
              <p className="fluid-text-xs text-gray-500">Porcentaje de contenido listo</p>
            </div>
          </div>
          
          {totalContent > 0 ? (
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <RadialBarChart
                  cx="50%"
                  cy="50%"
                  innerRadius="30%"
                  outerRadius="90%"
                  barSize={16}
                  data={progressData}
                  startAngle={180}
                  endAngle={0}
                >
                  <RadialBar
                    background={{ fill: '#f3f4f6' }}
                    dataKey="value"
                    cornerRadius={8}
                  />
                  <Legend 
                    iconSize={10}
                    wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
                  />
                  <Tooltip 
                    formatter={(value) => [`${value}%`, '']}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '13px' }}
                  />
                </RadialBarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-[200px] text-gray-400">
              <CheckCircle2 className="w-10 h-10 fluid-mb-2 opacity-40" />
              <p className="fluid-text-sm">Publica contenido para ver el progreso</p>
            </div>
          )}
        </div>

        {/* Banco de Preguntas */}
        <div className="bg-white rounded-fluid-2xl border border-gray-200 fluid-p-6 animate-fade-slide-up delay-300">
          <div className="flex items-center fluid-gap-3 fluid-mb-4">
            <div className="w-9 h-9 bg-gradient-to-br from-amber-500 to-orange-600 rounded-fluid-lg flex items-center justify-center shadow-sm">
              <HelpCircle className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">Banco de Preguntas</h3>
              <p className="fluid-text-xs text-gray-500">{summary?.questions.total || 0} preguntas en total</p>
            </div>
          </div>
          
          {questionsByType.length > 0 ? (
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <BarChart data={questionsByType} layout="vertical" barSize={20}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '13px' }} />
                  <Bar dataKey="cantidad" radius={[0, 6, 6, 0]}>
                    {questionsByType.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-[200px] text-gray-400">
              <HelpCircle className="w-10 h-10 fluid-mb-2 opacity-40" />
              <p className="fluid-text-sm">Crea exámenes para agregar preguntas</p>
            </div>
          )}
        </div>
      </div>

      {/* ===== ACCIONES RÁPIDAS ===== */}
      <div className="grid grid-cols-1 md:grid-cols-3 fluid-gap-4">
        {/* Estándares ECM */}
        <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-fluid-xl border border-purple-200 fluid-p-5 hover:shadow-lg transition-all group">
          <div className="flex items-center justify-between fluid-mb-3">
            <div className="w-11 h-11 bg-purple-600 rounded-fluid-xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
              <ClipboardList className="w-5 h-5 text-white" />
            </div>
            <button
              onClick={() => navigate('/standards/new')}
              className="flex items-center fluid-gap-1 fluid-px-3 fluid-py-1.5 bg-purple-600 text-white rounded-fluid-lg fluid-text-sm font-medium hover:bg-purple-700 transition-colors shadow-sm hover-pulse"
            >
              <Plus className="w-3.5 h-3.5" />
              Crear
            </button>
          </div>
          
          <h3 className="font-bold text-gray-900 fluid-mb-1">Estándares ECM</h3>
          
          <div className="flex items-center justify-between fluid-text-sm fluid-mb-3">
            <div className="flex items-center fluid-gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
              <span className="text-gray-600">{summary?.standards.active || 0} activos</span>
            </div>
            <span className="text-gray-400 fluid-text-xs">{summary?.standards.total || 0} total</span>
          </div>
          
          <button
            onClick={() => navigate('/standards')}
            className="w-full flex items-center justify-center fluid-gap-2 fluid-py-2 text-purple-700 bg-white/60 hover:bg-white rounded-fluid-lg transition-colors fluid-text-sm font-medium border border-purple-200"
          >
            Ver todos <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Exámenes */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-fluid-xl border border-blue-200 fluid-p-5 hover:shadow-lg transition-all group">
          <div className="flex items-center justify-between fluid-mb-3">
            <div className="w-11 h-11 bg-blue-600 rounded-fluid-xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <button
              onClick={() => navigate('/exams/new')}
              className="flex items-center fluid-gap-1 fluid-px-3 fluid-py-1.5 bg-blue-600 text-white rounded-fluid-lg fluid-text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm hover-pulse"
            >
              <Plus className="w-3.5 h-3.5" />
              Crear
            </button>
          </div>
          
          <h3 className="font-bold text-gray-900 fluid-mb-1">Exámenes</h3>
          
          <div className="flex items-center justify-between fluid-text-sm fluid-mb-3">
            <div className="flex items-center fluid-gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
              <span className="text-gray-600">{summary?.exams.published || 0} pub.</span>
            </div>
            <div className="flex items-center fluid-gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-amber-600 fluid-text-xs">{summary?.exams.draft || 0} borr.</span>
            </div>
          </div>
          
          <button
            onClick={() => navigate('/exams')}
            className="w-full flex items-center justify-center fluid-gap-2 fluid-py-2 text-blue-700 bg-white/60 hover:bg-white rounded-fluid-lg transition-colors fluid-text-sm font-medium border border-blue-200"
          >
            Ver todos <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Materiales de Estudio */}
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-fluid-xl border border-emerald-200 fluid-p-5 hover:shadow-lg transition-all group">
          <div className="flex items-center justify-between fluid-mb-3">
            <div className="w-11 h-11 bg-emerald-600 rounded-fluid-xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <button
              onClick={() => navigate('/study-contents/new')}
              className="flex items-center fluid-gap-1 fluid-px-3 fluid-py-1.5 bg-emerald-600 text-white rounded-fluid-lg fluid-text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm hover-pulse"
            >
              <Plus className="w-3.5 h-3.5" />
              Crear
            </button>
          </div>
          
          <h3 className="font-bold text-gray-900 fluid-mb-1">Materiales de Estudio</h3>
          
          <div className="flex items-center justify-between fluid-text-sm fluid-mb-3">
            <div className="flex items-center fluid-gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
              <span className="text-gray-600">{summary?.materials.published || 0} pub.</span>
            </div>
            <div className="flex items-center fluid-gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-amber-600 fluid-text-xs">{summary?.materials.draft || 0} borr.</span>
            </div>
          </div>
          
          <button
            onClick={() => navigate('/study-contents')}
            className="w-full flex items-center justify-center fluid-gap-2 fluid-py-2 text-emerald-700 bg-white/60 hover:bg-white rounded-fluid-lg transition-colors fluid-text-sm font-medium border border-emerald-200"
          >
            Ver todos <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ===== ACTIVIDAD RECIENTE ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 fluid-gap-6">
        {/* Estándares Recientes */}
        <div className="bg-white rounded-fluid-2xl border border-gray-200 fluid-p-5">
          <div className="flex items-center justify-between fluid-mb-4">
            <div className="flex items-center fluid-gap-2">
              <TrendingUp className="w-5 h-5 text-purple-600" />
              <h3 className="fluid-text-sm font-bold text-gray-800">ECM Recientes</h3>
            </div>
            <span className="fluid-text-2xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Últ. modificado</span>
          </div>
          
          {recentStandards.length === 0 ? (
            <div className="text-center fluid-py-8 text-gray-400">
              <ClipboardList className="w-10 h-10 mx-auto fluid-mb-2 opacity-30" />
              <p className="fluid-text-sm">Sin estándares aún</p>
              <button
                onClick={() => navigate('/standards/new')}
                className="fluid-mt-3 fluid-text-sm text-purple-600 font-medium hover:underline"
              >
                Crear primero →
              </button>
            </div>
          ) : (
            <div className="flex flex-col fluid-gap-2">
              {recentStandards.map((standard) => (
                <div 
                  key={standard.id}
                  onClick={() => navigate(`/standards/${standard.id}`)}
                  className="fluid-p-3 bg-gray-50 rounded-fluid-lg hover:bg-purple-50 cursor-pointer transition-colors group border border-transparent hover:border-purple-200"
                >
                  <div className="flex items-center justify-between fluid-gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center fluid-gap-2 fluid-mb-0.5">
                        <p className="fluid-text-sm font-semibold text-gray-800 group-hover:text-purple-700">
                          {standard.code}
                        </p>
                        <span className={`px-1.5 py-0.5 fluid-text-2xs rounded font-medium ${
                          standard.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                        }`}>
                          {standard.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>
                      <p className="fluid-text-xs text-gray-500 truncate">{standard.name}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-purple-500 flex-shrink-0" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Exámenes Recientes */}
        <div className="bg-white rounded-fluid-2xl border border-gray-200 fluid-p-5">
          <div className="flex items-center justify-between fluid-mb-4">
            <div className="flex items-center fluid-gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <h3 className="fluid-text-sm font-bold text-gray-800">Exámenes Recientes</h3>
            </div>
            <span className="fluid-text-2xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Últ. modificado</span>
          </div>
          
          {recentExams.length === 0 ? (
            <div className="text-center fluid-py-8 text-gray-400">
              <FileText className="w-10 h-10 mx-auto fluid-mb-2 opacity-30" />
              <p className="fluid-text-sm">Sin exámenes aún</p>
              <button
                onClick={() => navigate('/exams/new')}
                className="fluid-mt-3 fluid-text-sm text-blue-600 font-medium hover:underline"
              >
                Crear primero →
              </button>
            </div>
          ) : (
            <div className="flex flex-col fluid-gap-2">
              {recentExams.map((exam) => (
                <div 
                  key={exam.id}
                  onClick={() => navigate(`/exams/${exam.id}`)}
                  className="fluid-p-3 bg-gray-50 rounded-fluid-lg hover:bg-blue-50 cursor-pointer transition-colors group border border-transparent hover:border-blue-200"
                >
                  <div className="flex items-center justify-between fluid-gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center fluid-gap-2 fluid-mb-0.5">
                        <p className="fluid-text-sm font-semibold text-gray-800 group-hover:text-blue-700 truncate">
                          {exam.name}
                        </p>
                        <span className={`px-1.5 py-0.5 fluid-text-2xs rounded font-medium flex-shrink-0 ${
                          exam.is_published ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {exam.is_published ? 'Pub' : 'Borr'}
                        </span>
                      </div>
                      <div className="flex items-center fluid-gap-2 fluid-text-2xs text-gray-400">
                        <span>{exam.competency_standard?.code || 'Sin ECM'}</span>
                        <span>•</span>
                        <span>{exam.duration_minutes || 0} min</span>
                        <span>•</span>
                        <span>{exam.passing_score || 0}%</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 flex-shrink-0" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Materiales Recientes */}
        <div className="bg-white rounded-fluid-2xl border border-gray-200 fluid-p-5">
          <div className="flex items-center justify-between fluid-mb-4">
            <div className="flex items-center fluid-gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              <h3 className="fluid-text-sm font-bold text-gray-800">Materiales Recientes</h3>
            </div>
            <span className="fluid-text-2xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Últ. modificado</span>
          </div>
          
          {recentMaterials.length === 0 ? (
            <div className="text-center fluid-py-8 text-gray-400">
              <BookOpen className="w-10 h-10 mx-auto fluid-mb-2 opacity-30" />
              <p className="fluid-text-sm">Sin materiales aún</p>
              <button
                onClick={() => navigate('/study-contents/new')}
                className="fluid-mt-3 fluid-text-sm text-emerald-600 font-medium hover:underline"
              >
                Crear primero →
              </button>
            </div>
          ) : (
            <div className="flex flex-col fluid-gap-2">
              {recentMaterials.map((material) => (
                <div 
                  key={material.id}
                  onClick={() => navigate(`/study-contents/${material.id}`)}
                  className="fluid-p-3 bg-gray-50 rounded-fluid-lg hover:bg-emerald-50 cursor-pointer transition-colors group border border-transparent hover:border-emerald-200"
                >
                  <div className="flex items-center justify-between fluid-gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center fluid-gap-2 fluid-mb-0.5">
                        <p className="fluid-text-sm font-semibold text-gray-800 group-hover:text-emerald-700 truncate">
                          {material.title}
                        </p>
                        <span className={`px-1.5 py-0.5 fluid-text-2xs rounded font-medium flex-shrink-0 ${
                          material.is_published ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {material.is_published ? 'Pub' : 'Borr'}
                        </span>
                      </div>
                      <div className="flex items-center fluid-gap-2 fluid-text-2xs text-gray-400">
                        <span>{material.sessions_count || 0} sesiones</span>
                        <span>•</span>
                        <span>{material.topics_count || 0} temas</span>
                        {material.estimated_time_minutes && material.estimated_time_minutes > 0 && (
                          <>
                            <span>•</span>
                            <span>{material.estimated_time_minutes} min</span>
                          </>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-emerald-500 flex-shrink-0" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ===== PENDIENTES DE PUBLICAR ===== */}
      {((summary?.exams.draft || 0) > 0 || (summary?.materials.draft || 0) > 0) && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-fluid-2xl border border-amber-200 fluid-p-5">
          <div className="flex items-center fluid-gap-2 fluid-mb-3">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            <h3 className="font-bold text-gray-800">Contenido Pendiente</h3>
          </div>
          
          <div className="flex flex-wrap fluid-gap-3">
            {(summary?.exams.draft || 0) > 0 && (
              <button
                onClick={() => navigate('/exams')}
                className="flex items-center fluid-gap-2 fluid-px-4 fluid-py-2.5 bg-white border border-amber-200 rounded-fluid-lg fluid-text-sm text-amber-700 hover:bg-amber-50 transition-colors shadow-sm"
              >
                <FileText className="w-4 h-4" />
                {summary?.exams.draft} examen{(summary?.exams.draft || 0) !== 1 ? 'es' : ''} en borrador
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
            
            {(summary?.materials.draft || 0) > 0 && (
              <button
                onClick={() => navigate('/study-contents')}
                className="flex items-center fluid-gap-2 fluid-px-4 fluid-py-2.5 bg-white border border-amber-200 rounded-fluid-lg fluid-text-sm text-amber-700 hover:bg-amber-50 transition-colors shadow-sm"
              >
                <BookOpen className="w-4 h-4" />
                {summary?.materials.draft} material{(summary?.materials.draft || 0) !== 1 ? 'es' : ''} en borrador
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default EditorDashboard
