/**
 * Página 2/4: Selección de Materiales de Estudio
 * Recibe SelectExamState de la página anterior
 * Navega a → /assign-exam/members con SelectMaterialsState
 */
import { useState, useEffect, useLayoutEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft, BookOpen, ClipboardList, CheckCircle2,
  AlertCircle, X, Loader2, Search,
} from 'lucide-react';
import LoadingSpinner from '../../../components/LoadingSpinner';
import PartnersBreadcrumb from '../../../components/PartnersBreadcrumb';
import {
  getGroup, getExamMaterialsForAssignment,
  CandidateGroup, ExamMaterialForAssignment,
} from '../../../services/partnersService';
import type { SelectExamState, SelectMaterialsState } from './types';

export default function ExamSelectMaterialsPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const prevState = location.state as SelectExamState | undefined;

  // Scroll to top on mount
  useLayoutEffect(() => { window.scrollTo(0, 0); }, []);

  const [group, setGroup] = useState<CandidateGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [availableMaterials, setAvailableMaterials] = useState<ExamMaterialForAssignment[]>([]);
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<number[]>([]);
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  const [materialSearchQuery, setMaterialSearchQuery] = useState('');

  // Redirect if no state
  useEffect(() => {
    if (!prevState?.selectedExam) {
      navigate(`/partners/groups/${groupId}/assign-exam`, { replace: true });
    }
  }, []);

  useEffect(() => {
    if (!prevState?.selectedExam) return;
    (async () => {
      try {
        setLoading(true);
        const [groupData] = await Promise.all([
          getGroup(Number(groupId)),
        ]);
        setGroup(groupData);

        // Load materials
        setLoadingMaterials(true);
        const data = await getExamMaterialsForAssignment(prevState.selectedExam.id);
        setAvailableMaterials(data.materials || []);
        // Preseleccionar todos los materiales disponibles
        const allIds = (data.materials || []).map(m => m.id);
        setSelectedMaterialIds(allIds);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Error al cargar datos');
      } finally {
        setLoading(false);
        setLoadingMaterials(false);
      }
    })();
  }, [groupId]);

  const handleToggleMaterial = (materialId: number) => {
    setSelectedMaterialIds(prev =>
      prev.includes(materialId) ? prev.filter(id => id !== materialId) : [...prev, materialId]
    );
  };

  const handleContinue = () => {
    if (!prevState) return;
    const state: SelectMaterialsState = {
      ...prevState,
      selectedMaterialIds,
    };
    navigate(`/partners/groups/${groupId}/assign-exam/members`, { state });
  };

  const filteredMaterials = availableMaterials.filter(m => {
    if (!materialSearchQuery.trim()) return true;
    const q = materialSearchQuery.toLowerCase();
    return m.title.toLowerCase().includes(q) || (m.description?.toLowerCase() || '').includes(q);
  });

  if (!prevState?.selectedExam) return null;
  if (loading) return <LoadingSpinner message="Cargando materiales..." fullScreen />;
  if (!group) return <div className="p-6"><div className="bg-red-50 border border-red-200 rounded-fluid-xl fluid-p-4"><p className="text-red-600">Grupo no encontrado</p></div></div>;

  const { selectedExam } = prevState;

  const stepLabels = ['ECM', 'Examen', 'Materiales', 'Miembros', 'Confirmar'];

  return (
    <div className="fluid-p-6 max-w-[2800px] mx-auto animate-fade-in-up">
      <PartnersBreadcrumb items={[
        { label: group.campus?.partner?.name || 'Partner', path: `/partners/${group.campus?.partner_id}` },
        { label: group.campus?.name || 'Plantel', path: `/partners/campuses/${group.campus_id}` },
        { label: group.name, path: `/partners/groups/${groupId}` },
        { label: 'Materiales de Estudio' },
      ]} />

      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 rounded-fluid-2xl fluid-p-6 fluid-mb-6 text-white shadow-xl">
        <div className="flex items-center fluid-gap-4">
          <button onClick={() => navigate(`/partners/groups/${groupId}/assign-exam`)} className="fluid-p-2 hover:bg-white/20 rounded-fluid-xl transition-colors">
            <ArrowLeft className="fluid-icon-lg" />
          </button>
          <div>
            <div className="flex items-center fluid-gap-2 fluid-text-sm text-white/80 fluid-mb-1">
              <ClipboardList className="fluid-icon-sm" /><span>{group.name}</span><span>•</span><span>{selectedExam.name}</span>
            </div>
            <h1 className="fluid-text-2xl font-bold">Paso 3: Materiales de Estudio</h1>
          </div>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center justify-center fluid-mb-6">
        <div className="flex items-center">
          {stepLabels.map((label, i) => (
            <div key={label} className="flex items-center">
              <div className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center fluid-text-sm font-semibold transition-all ${
                i < 2 ? 'bg-green-500 text-white' : i === 2 ? 'bg-blue-600 text-white ring-4 ring-blue-200 shadow-lg' : 'bg-gray-200 text-gray-600'
              }`}>{i < 2 ? <CheckCircle2 className="fluid-icon-base" /> : i + 1}</div>
              <span className={`ml-2 font-medium hidden sm:inline fluid-text-sm ${i === 2 ? 'text-blue-600' : i < 2 ? 'text-green-600' : 'text-gray-400'}`}>{label}</span>
            </div>
            {i < stepLabels.length - 1 && <div className={`w-8 md:w-12 h-1 rounded-full mx-2 transition-all ${i < 2 ? 'bg-green-400' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="fluid-mb-6 bg-red-50 border border-red-200 rounded-fluid-xl fluid-p-5 flex items-start fluid-gap-3">
          <AlertCircle className="fluid-icon-base text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-red-700 fluid-text-base flex-1">{error}</p>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600"><X className="fluid-icon-base" /></button>
        </div>
      )}

      {/* Exam summary banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-fluid-xl fluid-p-5 fluid-mb-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="fluid-text-sm text-blue-600 font-medium">Examen seleccionado</p>
            <h3 className="font-semibold text-gray-900 mt-1 fluid-text-base">{selectedExam.name}</h3>
            {(selectedExam.ecm_code || selectedExam.standard) && <p className="fluid-text-sm text-gray-600">ECM: {selectedExam.ecm_code || selectedExam.standard}</p>}
          </div>
        </div>
      </div>

      {/* Materials list */}
      <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-5">
        <div className="flex items-center justify-between fluid-mb-4">
          <h2 className="fluid-text-lg font-semibold text-gray-900 flex items-center fluid-gap-2">
            <BookOpen className="fluid-icon-base text-indigo-600" />Selecciona los Materiales de Estudio
          </h2>
          <span className="fluid-text-sm text-gray-500">{selectedMaterialIds.length} seleccionado(s)</span>
        </div>

        <p className="fluid-text-sm text-gray-500 fluid-mb-4">Los materiales ligados al examen se seleccionan automáticamente. Puedes agregar o quitar materiales según necesites.</p>

        {/* Search */}
        <div className="relative fluid-mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 fluid-icon-sm" />
          <input type="text" placeholder="Buscar material..." value={materialSearchQuery} onChange={(e) => setMaterialSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 fluid-py-2 border border-gray-300 rounded-fluid-lg fluid-text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
        </div>

        {loadingMaterials ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="fluid-icon-lg animate-spin text-blue-600" /><span className="ml-2 text-gray-500 fluid-text-sm">Cargando materiales...</span></div>
        ) : filteredMaterials.length > 0 ? (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {filteredMaterials.map((material) => (
              <div key={material.id} onClick={() => handleToggleMaterial(material.id)}
                className={`fluid-p-4 border rounded-fluid-xl cursor-pointer transition-all ${
                  selectedMaterialIds.includes(material.id) ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                }`}>
                <div className="flex items-start fluid-gap-3">
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    selectedMaterialIds.includes(material.id) ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                  }`}>{selectedMaterialIds.includes(material.id) && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}</div>
                  <div className="flex-1">
                    <div className="flex items-center fluid-gap-2">
                      <h3 className="font-medium text-gray-900 fluid-text-base">{material.title}</h3>
                      {material.is_linked && <span className="fluid-px-2 py-0.5 fluid-text-xs font-medium bg-green-100 text-green-700 rounded-full">Ligado al examen</span>}
                    </div>
                    {material.description && <p className="fluid-text-sm text-gray-500 mt-1 line-clamp-2">{material.description}</p>}
                    <div className="flex items-center fluid-gap-4 mt-2 fluid-text-xs text-gray-400">
                      <span>{material.sessions_count} sesiones</span><span>{material.topics_count} temas</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <BookOpen className="w-12 h-12 mx-auto text-gray-300 fluid-mb-3" /><p className="fluid-text-base">No hay materiales de estudio disponibles</p>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between pt-4 border-t mt-6">
          <button onClick={() => navigate(`/partners/groups/${groupId}/assign-exam`)} className="fluid-px-4 fluid-py-2 text-gray-600 hover:text-gray-900 fluid-text-sm font-medium transition-colors">← Volver</button>
          <button onClick={handleContinue} className="fluid-px-6 fluid-py-3 bg-blue-600 text-white rounded-fluid-xl hover:bg-blue-700 fluid-text-sm font-medium shadow-lg transition-all">
            Continuar: Candidatos →
          </button>
        </div>
      </div>
    </div>
  );
}
