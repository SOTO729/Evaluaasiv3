/**
 * Página de detalle de un Examen dentro del módulo de Estándares
 * Vista de solo lectura con configuración, categorías/temas y materiales de estudio
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { examService } from '../../services/examService';
import { getStandard, CompetencyStandard } from '../../services/standardsService';
import {
  ArrowLeft,
  FileText,
  Clock,
  Target,
  Settings,
  BookOpen,
  Layers,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Hash,
  Wifi,
  WifiOff,
  RefreshCw,
  HelpCircle,
  Dumbbell,
  GraduationCap,
  Library,
  Award,
  Edit3,
  Trash2,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import type { Exam, Category, Topic } from '../../types';

export default function StandardExamDetailPage() {
  const { id: standardId, examId } = useParams<{ id: string; examId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [exam, setExam] = useState<Exam | null>(null);
  const [standard, setStandard] = useState<CompetencyStandard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set());
  const [expandedMaterials, setExpandedMaterials] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadData();
  }, [standardId, examId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [examData, standardData] = await Promise.all([
        examService.getExam(Number(examId), true),
        getStandard(Number(standardId)),
      ]);
      setExam(examData);
      setStandard(standardData);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar el examen');
    } finally {
      setLoading(false);
    }
  };

  const toggleCategory = (catId: number) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      next.has(catId) ? next.delete(catId) : next.add(catId);
      return next;
    });
  };

  const toggleMaterial = (matId: number) => {
    setExpandedMaterials((prev) => {
      const next = new Set(prev);
      next.has(matId) ? next.delete(matId) : next.add(matId);
      return next;
    });
  };

  const getContentTypeLabel = (type?: string) => {
    const labels: Record<string, string> = {
      mixed: 'Mixto (Preguntas + Ejercicios)',
      questions_only: 'Solo Preguntas',
      exercises_only: 'Solo Ejercicios',
    };
    return labels[type || 'mixed'] || type || 'Mixto';
  };

  if (loading) {
    return (
      <div className="fluid-p-6 max-w-[1920px] mx-auto">
        <LoadingSpinner message="Cargando examen..." />
      </div>
    );
  }

  if (error || !exam) {
    return (
      <div className="fluid-p-6 max-w-[1920px] mx-auto animate-fade-in-up">
        <div className="bg-red-50 border border-red-200 rounded-fluid-xl fluid-p-5 flex items-center fluid-gap-4">
          <AlertCircle className="fluid-icon-sm text-red-600 flex-shrink-0" />
          <p className="fluid-text-sm text-red-700">{error || 'Examen no encontrado'}</p>
        </div>
        <button
          onClick={() => navigate(`/standards/${standardId}`)}
          className="fluid-mt-4 inline-flex items-center fluid-gap-2 text-primary-600 hover:text-primary-500 fluid-text-sm"
        >
          <ArrowLeft className="fluid-icon-sm" />
          Volver al estándar
        </button>
      </div>
    );
  }

  const isAdmin = user?.role === 'admin' || user?.role === 'developer';
  const isEditor = user?.role === 'editor' || user?.role === 'editor_invitado' || user?.role === 'coordinator';
  const categories = exam.categories || [];
  const materials = exam.linked_study_materials || [];

  return (
    <div className="fluid-p-6 max-w-[1920px] mx-auto animate-fade-in-up">
      {/* Navegación */}
      <div className="fluid-mb-6 flex items-center fluid-gap-2 fluid-text-sm text-gray-500">
        <button
          onClick={() => navigate('/standards')}
          className="hover:text-primary-600 transition-colors"
        >
          Estándares
        </button>
        <ChevronRight className="w-4 h-4" />
        <button
          onClick={() => navigate(`/standards/${standardId}`)}
          className="hover:text-primary-600 transition-colors"
        >
          {standard?.code || 'Estándar'}
        </button>
        <ChevronRight className="w-4 h-4" />
        <span className="text-gray-900 font-medium truncate">{exam.name}</span>
      </div>

      {/* Standard info bar */}
      {standard && (
        <div className="bg-white shadow rounded-fluid-xl overflow-hidden fluid-mb-6">
          <div className="fluid-px-6 fluid-py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between fluid-gap-4">
            <div className="flex items-center fluid-gap-4">
              {standard.logo_url && (
                <img
                  src={standard.logo_url}
                  alt={`Logo ${standard.code}`}
                  className="w-12 h-12 object-contain rounded-fluid-lg bg-gray-50 p-1"
                />
              )}
              <div className="min-w-0">
                <p className="fluid-text-sm font-semibold text-gray-900 truncate">
                  {standard.code} — {standard.name}
                </p>
                <div className="flex flex-wrap items-center fluid-gap-2 fluid-mt-0.5">
                  {standard.brand && (
                    <span className="fluid-text-xs text-gray-500">Marca: {standard.brand.name}</span>
                  )}
                  {standard.sector && (
                    <span className="fluid-text-xs text-gray-500">• {standard.sector}</span>
                  )}
                  {standard.certifying_body && (
                    <span className="fluid-text-xs text-gray-500">• {standard.certifying_body}</span>
                  )}
                </div>
              </div>
            </div>
            {(isAdmin || isEditor) && (
              <div className="flex flex-wrap fluid-gap-2 flex-shrink-0">
                <button
                  onClick={() => navigate(`/standards/${standard.id}/certificate-template`)}
                  className="inline-flex items-center fluid-gap-2 fluid-px-3 fluid-py-1.5 border border-gray-300 rounded-fluid-lg fluid-text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Award className="w-3.5 h-3.5" />
                  Plantilla Certificado
                </button>
                <button
                  onClick={() => navigate(`/standards/${standard.id}/edit`)}
                  className="inline-flex items-center fluid-gap-2 fluid-px-3 fluid-py-1.5 border border-gray-300 rounded-fluid-lg fluid-text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Editar Estándar
                </button>
                {isAdmin && (
                  <button
                    onClick={() => navigate(`/standards/${standard.id}`)}
                    className="inline-flex items-center fluid-gap-2 fluid-px-3 fluid-py-1.5 border border-gray-300 rounded-fluid-lg fluid-text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Gestionar
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Header Card */}
      <div className="bg-white shadow rounded-fluid-xl overflow-hidden fluid-mb-8">
        <div className="fluid-px-6 fluid-py-5 bg-gradient-to-r from-primary-600 to-primary-700">
          <div className="flex flex-col sm:flex-row sm:items-start fluid-gap-4">
            {exam.image_url && (
              <img
                src={exam.image_url}
                alt={exam.name}
                className="w-24 h-24 object-cover rounded-fluid-lg bg-white/10 shadow-md flex-shrink-0"
              />
            )}
            <div className="text-white flex-1 min-w-0">
              <div className="flex flex-wrap items-center fluid-gap-3 fluid-mb-1">
                <h1 className="fluid-text-2xl font-bold truncate">{exam.name}</h1>
                {exam.version && (
                  <span className="inline-flex items-center fluid-px-3 fluid-py-1 rounded-fluid-md fluid-text-xs font-medium bg-white/20 text-white">
                    v{exam.version}
                  </span>
                )}
                {exam.is_published ? (
                  <span className="inline-flex items-center fluid-gap-1 fluid-px-3 fluid-py-1 rounded-fluid-md fluid-text-xs font-medium bg-green-100 text-green-700">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Publicado
                  </span>
                ) : (
                  <span className="inline-flex items-center fluid-gap-1 fluid-px-3 fluid-py-1 rounded-fluid-md fluid-text-xs font-medium bg-amber-100 text-amber-700">
                    <XCircle className="w-3.5 h-3.5" />
                    Borrador
                  </span>
                )}
              </div>
              {exam.description && (
                <p className="fluid-text-sm text-primary-100 fluid-mt-1">{exam.description}</p>
              )}
            </div>
          </div>
        </div>

        {/* Stats bar */}
        <div className="fluid-px-6 fluid-py-4 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 fluid-gap-4 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center fluid-gap-2">
            <Clock className="w-4 h-4 text-gray-400" />
            <div>
              <div className="fluid-text-xs text-gray-500">Duración</div>
              <div className="fluid-text-sm font-semibold text-gray-900">{exam.duration_minutes ? `${exam.duration_minutes} min` : 'Sin límite'}</div>
            </div>
          </div>
          <div className="flex items-center fluid-gap-2">
            <Target className="w-4 h-4 text-gray-400" />
            <div>
              <div className="fluid-text-xs text-gray-500">Puntaje mínimo</div>
              <div className="fluid-text-sm font-semibold text-gray-900">{exam.passing_score}%</div>
            </div>
          </div>
          <div className="flex items-center fluid-gap-2">
            <Layers className="w-4 h-4 text-gray-400" />
            <div>
              <div className="fluid-text-xs text-gray-500">Categorías</div>
              <div className="fluid-text-sm font-semibold text-gray-900">{exam.total_categories}</div>
            </div>
          </div>
          <div className="flex items-center fluid-gap-2">
            <HelpCircle className="w-4 h-4 text-gray-400" />
            <div>
              <div className="fluid-text-xs text-gray-500">Preguntas</div>
              <div className="fluid-text-sm font-semibold text-gray-900">{exam.total_questions}</div>
            </div>
          </div>
          <div className="flex items-center fluid-gap-2">
            <Dumbbell className="w-4 h-4 text-gray-400" />
            <div>
              <div className="fluid-text-xs text-gray-500">Ejercicios</div>
              <div className="fluid-text-sm font-semibold text-gray-900">{exam.total_exercises}</div>
            </div>
          </div>
          <div className="flex items-center fluid-gap-2">
            <Library className="w-4 h-4 text-gray-400" />
            <div>
              <div className="fluid-text-xs text-gray-500">Materiales</div>
              <div className="fluid-text-sm font-semibold text-gray-900">{materials.length}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 fluid-gap-8">
        {/* Left column: Config + Materials */}
        <div className="xl:col-span-1 space-y-6">
          {/* Configuración */}
          <div className="bg-white shadow rounded-fluid-xl overflow-hidden">
            <div className="fluid-px-6 fluid-py-4 border-b border-gray-200 flex items-center fluid-gap-2">
              <Settings className="fluid-icon-sm text-primary-600" />
              <h2 className="fluid-text-lg font-semibold text-gray-900">Configuración</h2>
            </div>
            <div className="fluid-p-6 space-y-4">
              <ConfigRow label="Tipo de contenido" value={getContentTypeLabel(exam.default_exam_content_type)} />
              <ConfigRow label="Intentos máximos" value={String(exam.default_max_attempts ?? 2)} />
              <ConfigRow label="Desconexiones máximas" value={String(exam.default_max_disconnections ?? 3)} />
              <ConfigRow
                label="Pausar al desconectar"
                value={exam.pause_on_disconnect !== false ? 'Sí' : 'No'}
                icon={exam.pause_on_disconnect !== false ? <WifiOff className="w-4 h-4 text-amber-500" /> : <Wifi className="w-4 h-4 text-green-500" />}
              />

              {(exam.default_exam_content_type === 'mixed' || exam.default_exam_content_type === 'questions_only' || !exam.default_exam_content_type) && (
                <>
                  <div className="border-t border-gray-100 pt-4">
                    <p className="fluid-text-xs font-medium text-gray-500 uppercase tracking-wide fluid-mb-3 flex items-center fluid-gap-1">
                      <GraduationCap className="w-3.5 h-3.5" />
                      Modo Examen
                    </p>
                    <ConfigRow label="Preguntas" value={exam.default_exam_questions_count != null ? String(exam.default_exam_questions_count) : 'Todas'} />
                    {(exam.default_exam_content_type === 'mixed' || !exam.default_exam_content_type) && (
                      <ConfigRow label="Ejercicios" value={exam.default_exam_exercises_count != null ? String(exam.default_exam_exercises_count) : 'Todos'} />
                    )}
                  </div>
                </>
              )}

              {(exam.default_exam_content_type === 'mixed' || !exam.default_exam_content_type) && (
                <div className="border-t border-gray-100 pt-4">
                  <p className="fluid-text-xs font-medium text-gray-500 uppercase tracking-wide fluid-mb-3 flex items-center fluid-gap-1">
                    <RefreshCw className="w-3.5 h-3.5" />
                    Modo Simulador
                  </p>
                  <ConfigRow label="Preguntas" value={exam.default_simulator_questions_count != null ? String(exam.default_simulator_questions_count) : 'Todas'} />
                  <ConfigRow label="Ejercicios" value={exam.default_simulator_exercises_count != null ? String(exam.default_simulator_exercises_count) : 'Todos'} />
                </div>
              )}

              {/* Mode content availability */}
              <div className="border-t border-gray-100 pt-4">
                <p className="fluid-text-xs font-medium text-gray-500 uppercase tracking-wide fluid-mb-3">Contenido disponible</p>
                <div className="flex flex-wrap fluid-gap-2">
                  {exam.has_exam_content && (
                    <span className="inline-flex items-center fluid-gap-1 fluid-px-3 fluid-py-1 rounded-fluid-md fluid-text-xs font-medium bg-blue-100 text-blue-700">
                      <GraduationCap className="w-3 h-3" />
                      Examen: {exam.exam_questions_count || 0}P / {exam.exam_exercises_count || 0}E
                    </span>
                  )}
                  {exam.has_simulator_content && (
                    <span className="inline-flex items-center fluid-gap-1 fluid-px-3 fluid-py-1 rounded-fluid-md fluid-text-xs font-medium bg-purple-100 text-purple-700">
                      <RefreshCw className="w-3 h-3" />
                      Simulador: {exam.simulator_questions_count || 0}P / {exam.simulator_exercises_count || 0}E
                    </span>
                  )}
                  {!exam.has_exam_content && !exam.has_simulator_content && (
                    <span className="fluid-text-xs text-gray-400">Sin contenido asignado a modos</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Materiales de estudio */}
          <div className="bg-white shadow rounded-fluid-xl overflow-hidden">
            <div className="fluid-px-6 fluid-py-4 border-b border-gray-200 flex items-center fluid-gap-2">
              <BookOpen className="fluid-icon-sm text-primary-600" />
              <h2 className="fluid-text-lg font-semibold text-gray-900">Materiales de Estudio</h2>
              <span className="fluid-text-sm text-gray-500">({materials.length})</span>
            </div>
            {materials.length === 0 ? (
              <div className="fluid-p-8 text-center">
                <BookOpen className="w-10 h-10 text-gray-300 mx-auto fluid-mb-3" />
                <p className="fluid-text-sm text-gray-500">No hay materiales de estudio ligados</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {materials.map((mat) => (
                  <div key={mat.id}>
                    <button
                      onClick={() => toggleMaterial(mat.id)}
                      className="w-full flex items-center fluid-gap-3 fluid-px-6 fluid-py-4 hover:bg-gray-50 transition-colors text-left"
                    >
                      {mat.image_url ? (
                        <img src={mat.image_url} alt={mat.title} className="w-10 h-10 rounded-fluid-md object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-fluid-md bg-primary-50 flex items-center justify-center flex-shrink-0">
                          <BookOpen className="w-5 h-5 text-primary-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="fluid-text-sm font-medium text-gray-900 truncate">{mat.title}</p>
                      </div>
                      {expandedMaterials.has(mat.id) ? (
                        <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      )}
                    </button>
                    {expandedMaterials.has(mat.id) && (
                      <MaterialDetail materialId={mat.id} />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column: Categories & Topics */}
        <div className="xl:col-span-2">
          <div className="bg-white shadow rounded-fluid-xl overflow-hidden">
            <div className="fluid-px-6 fluid-py-4 border-b border-gray-200 flex items-center fluid-gap-2">
              <Layers className="fluid-icon-sm text-primary-600" />
              <h2 className="fluid-text-lg font-semibold text-gray-900">Categorías y Temas</h2>
              <span className="fluid-text-sm text-gray-500">({categories.length} categorías)</span>
            </div>

            {categories.length === 0 ? (
              <div className="fluid-p-10 text-center">
                <Layers className="w-12 h-12 text-gray-300 mx-auto fluid-mb-3" />
                <p className="fluid-text-sm text-gray-500">No hay categorías definidas</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {categories.map((cat, catIdx) => (
                  <CategorySection
                    key={cat.id}
                    category={cat}
                    index={catIdx}
                    isExpanded={expandedCategories.has(cat.id)}
                    onToggle={() => toggleCategory(cat.id)}
                  />
                ))}
              </div>
            )}

            {/* Percentage summary */}
            {categories.length > 0 && (
              <div className="fluid-px-6 fluid-py-4 bg-gray-50 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <span className="fluid-text-sm font-medium text-gray-600">Total de porcentajes</span>
                  <TotalPercentageBadge categories={categories} />
                </div>
                {/* Visual bar */}
                <div className="fluid-mt-3 h-3 bg-gray-200 rounded-full overflow-hidden flex">
                  {categories.map((cat, i) => {
                    const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-purple-500', 'bg-cyan-500', 'bg-orange-500', 'bg-teal-500'];
                    return (
                      <div
                        key={cat.id}
                        className={`${colors[i % colors.length]} transition-all`}
                        style={{ width: `${cat.percentage}%` }}
                        title={`${cat.name}: ${cat.percentage}%`}
                      />
                    );
                  })}
                </div>
                <div className="fluid-mt-2 flex flex-wrap fluid-gap-x-4 fluid-gap-y-1">
                  {categories.map((cat, i) => {
                    const dotColors = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-purple-500', 'bg-cyan-500', 'bg-orange-500', 'bg-teal-500'];
                    return (
                      <span key={cat.id} className="inline-flex items-center fluid-gap-1 fluid-text-xs text-gray-600">
                        <span className={`w-2 h-2 rounded-full ${dotColors[i % dotColors.length]}`} />
                        {cat.name}: {cat.percentage}%
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Instructions */}
      {exam.instructions && (
        <div className="fluid-mt-8 bg-white shadow rounded-fluid-xl overflow-hidden">
          <div className="fluid-px-6 fluid-py-4 border-b border-gray-200 flex items-center fluid-gap-2">
            <FileText className="fluid-icon-sm text-primary-600" />
            <h2 className="fluid-text-lg font-semibold text-gray-900">Instrucciones</h2>
          </div>
          <div
            className="fluid-p-6 prose prose-sm max-w-none fluid-text-sm text-gray-700"
            dangerouslySetInnerHTML={{ __html: exam.instructions }}
          />
        </div>
      )}

      {/* Metadata */}
      <div className="fluid-mt-6 bg-gray-50 rounded-fluid-xl fluid-p-5 fluid-text-xs text-gray-500 flex flex-wrap fluid-gap-x-6 fluid-gap-y-2">
        <span className="inline-flex items-center fluid-gap-1">
          <Clock className="w-3 h-3" />
          Creado: {new Date(exam.created_at).toLocaleDateString('es-MX', { dateStyle: 'long' })}
        </span>
        {exam.updated_at && (
          <span className="inline-flex items-center fluid-gap-1">
            <RefreshCw className="w-3 h-3" />
            Actualizado: {new Date(exam.updated_at).toLocaleDateString('es-MX', { dateStyle: 'long' })}
          </span>
        )}
      </div>
    </div>
  );
}

/* ─── Sub-components ─── */

function ConfigRow({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between fluid-py-1">
      <span className="fluid-text-sm text-gray-600">{label}</span>
      <span className="fluid-text-sm font-medium text-gray-900 flex items-center fluid-gap-1.5">
        {icon}
        {value}
      </span>
    </div>
  );
}

function TotalPercentageBadge({ categories }: { categories: Category[] }) {
  const total = categories.reduce((sum, c) => sum + (c.percentage || 0), 0);
  const isValid = total === 100;
  return (
    <span className={`inline-flex items-center fluid-gap-1 fluid-px-3 fluid-py-1 rounded-fluid-md fluid-text-sm font-semibold ${isValid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
      {isValid ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
      {total}%
    </span>
  );
}

function CategorySection({ category, index, isExpanded, onToggle }: { category: Category; index: number; isExpanded: boolean; onToggle: () => void }) {
  const topics = category.topics || [];
  const borderColors = ['border-l-blue-500', 'border-l-emerald-500', 'border-l-amber-500', 'border-l-rose-500', 'border-l-purple-500', 'border-l-cyan-500', 'border-l-orange-500', 'border-l-teal-500'];

  return (
    <div className={`border-l-4 ${borderColors[index % borderColors.length]}`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center fluid-px-6 fluid-py-4 hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center fluid-gap-3">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 fluid-text-xs font-bold text-gray-600">
              {index + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="fluid-text-sm font-semibold text-gray-900 truncate">{category.name}</p>
              {category.description && (
                <p className="fluid-text-xs text-gray-500 truncate">{category.description}</p>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center fluid-gap-4 flex-shrink-0 fluid-ml-4">
          <span className="inline-flex items-center fluid-px-2.5 fluid-py-1 rounded-fluid-md fluid-text-xs font-medium bg-primary-100 text-primary-700">
            {category.percentage}%
          </span>
          <div className="hidden sm:flex items-center fluid-gap-3 fluid-text-xs text-gray-500">
            <span className="inline-flex items-center fluid-gap-1">
              <Hash className="w-3 h-3" />
              {topics.length} temas
            </span>
            <span className="inline-flex items-center fluid-gap-1">
              <HelpCircle className="w-3 h-3" />
              {category.total_questions || 0} preg.
            </span>
            <span className="inline-flex items-center fluid-gap-1">
              <Dumbbell className="w-3 h-3" />
              {category.total_exercises || 0} ejer.
            </span>
          </div>
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </button>

      {isExpanded && topics.length > 0 && (
        <div className="fluid-px-6 fluid-pb-4">
          <div className="ml-10 space-y-2">
            {topics.map((topic: Topic, tIdx: number) => (
              <div
                key={topic.id}
                className="bg-gray-50 rounded-fluid-lg fluid-px-4 fluid-py-3 flex items-center justify-between"
              >
                <div className="flex items-center fluid-gap-3 min-w-0 flex-1">
                  <span className="fluid-text-xs font-medium text-gray-400 flex-shrink-0">{index + 1}.{tIdx + 1}</span>
                  <div className="min-w-0">
                    <p className="fluid-text-sm font-medium text-gray-800 truncate">{topic.name}</p>
                    {topic.description && (
                      <p className="fluid-text-xs text-gray-500 truncate">{topic.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center fluid-gap-3 flex-shrink-0 fluid-ml-4">
                  <span className="inline-flex items-center fluid-px-2 fluid-py-0.5 rounded fluid-text-xs font-medium bg-gray-200 text-gray-600">
                    {topic.percentage}%
                  </span>
                  <span className="inline-flex items-center fluid-gap-1 fluid-text-xs text-gray-500">
                    <HelpCircle className="w-3 h-3" />
                    {topic.total_questions}
                  </span>
                  <span className="inline-flex items-center fluid-gap-1 fluid-text-xs text-gray-500">
                    <Dumbbell className="w-3 h-3" />
                    {topic.total_exercises}
                  </span>
                </div>
              </div>
            ))}
          </div>
          {/* Topic percentage bar within category */}
          {topics.length > 1 && (
            <div className="ml-10 fluid-mt-3">
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden flex">
                {topics.map((t: Topic) => (
                  <div
                    key={t.id}
                    className="bg-primary-400 first:rounded-l-full last:rounded-r-full"
                    style={{ width: `${t.percentage}%` }}
                    title={`${t.name}: ${t.percentage}%`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {isExpanded && topics.length === 0 && (
        <div className="fluid-px-6 fluid-pb-4">
          <div className="ml-10 fluid-text-xs text-gray-400 italic">Sin temas definidos</div>
        </div>
      )}
    </div>
  );
}

function MaterialDetail({ materialId }: { materialId: number }) {
  const [material, setMaterial] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMaterial();
  }, [materialId]);

  const loadMaterial = async () => {
    try {
      const { getMaterial } = await import('../../services/studyContentService');
      const data = await getMaterial(materialId);
      setMaterial(data);
    } catch {
      setMaterial(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="fluid-px-6 fluid-pb-4 flex items-center fluid-gap-2 text-gray-400 fluid-text-xs">
        <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
        Cargando detalles...
      </div>
    );
  }

  if (!material) {
    return (
      <div className="fluid-px-6 fluid-pb-4 fluid-text-xs text-gray-400 italic">
        No se pudo cargar el detalle del material
      </div>
    );
  }

  const sessions = material.sessions || [];

  return (
    <div className="fluid-px-6 fluid-pb-4 bg-gray-50/50">
      <div className="flex flex-wrap fluid-gap-x-4 fluid-gap-y-1 fluid-text-xs text-gray-500 fluid-mb-3 fluid-pl-13">
        <span>{material.sessions_count || sessions.length} sesiones</span>
        <span>{material.topics_count || 0} temas</span>
        {material.estimated_time_minutes > 0 && (
          <span className="inline-flex items-center fluid-gap-1">
            <Clock className="w-3 h-3" />
            ~{material.estimated_time_minutes} min
          </span>
        )}
        <span className={material.is_published ? 'text-green-600' : 'text-amber-600'}>
          {material.is_published ? 'Publicado' : 'Borrador'}
        </span>
      </div>

      {sessions.length > 0 && (
        <div className="fluid-pl-13 space-y-2">
          {sessions.map((session: any, sIdx: number) => (
            <div key={session.id} className="bg-white rounded-fluid-lg fluid-p-3 border border-gray-100">
              <p className="fluid-text-xs font-semibold text-gray-700 fluid-mb-2">
                Sesión {session.session_number || sIdx + 1}: {session.title}
              </p>
              {session.topics && session.topics.length > 0 ? (
                <div className="space-y-1.5">
                  {session.topics.map((topic: any) => (
                    <div key={topic.id} className="flex items-center justify-between fluid-text-xs fluid-pl-3">
                      <span className="text-gray-600 truncate flex-1">{topic.title}</span>
                      <div className="flex items-center fluid-gap-2 flex-shrink-0 fluid-ml-2">
                        {topic.estimated_time_minutes > 0 && (
                          <span className="text-gray-400">{topic.estimated_time_minutes} min</span>
                        )}
                        <div className="flex fluid-gap-1">
                          {topic.allow_reading && <span className="fluid-px-1.5 fluid-py-0.5 rounded bg-blue-50 text-blue-600 font-medium">L</span>}
                          {topic.allow_video && <span className="fluid-px-1.5 fluid-py-0.5 rounded bg-red-50 text-red-600 font-medium">V</span>}
                          {topic.allow_downloadable && <span className="fluid-px-1.5 fluid-py-0.5 rounded bg-green-50 text-green-600 font-medium">D</span>}
                          {topic.allow_interactive && <span className="fluid-px-1.5 fluid-py-0.5 rounded bg-purple-50 text-purple-600 font-medium">I</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="fluid-text-xs text-gray-400 italic fluid-pl-3">Sin temas</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
