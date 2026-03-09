/**
 * Crear Grupo - Responsable de Plantel
 * Formulario simple para crear un grupo dentro de un ciclo escolar
 */
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Layers,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  createMiPlantelGroup,
  getMiPlantelCycles,
  SchoolCycle,
} from '../../services/partnersService';

export default function MiPlantelGrupoNuevoPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedCycleId = searchParams.get('cycleId');

  const [cycles, setCycles] = useState<SchoolCycle[]>([]);
  const [loadingCycles, setLoadingCycles] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    school_cycle_id: preselectedCycleId ? parseInt(preselectedCycleId) : 0,
  });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCycles();
  }, []);

  const loadCycles = async () => {
    try {
      setLoadingCycles(true);
      const result = await getMiPlantelCycles({ active_only: true });
      const data = result.cycles;
      setCycles(data);
      if (!preselectedCycleId && data.length > 0) {
        setFormData(prev => ({ ...prev, school_cycle_id: data[0].id }));
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar los ciclos');
    } finally {
      setLoadingCycles(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    if (!formData.school_cycle_id) {
      setError('Debes seleccionar un ciclo escolar');
      return;
    }

    try {
      setCreating(true);
      setError(null);
      const result = await createMiPlantelGroup({
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        school_cycle_id: formData.school_cycle_id,
      });
      navigate(`/mi-plantel/grupos/${result.group.id}`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al crear el grupo');
    } finally {
      setCreating(false);
    }
  };

  if (loadingCycles) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="fluid-p-6 max-w-3xl mx-auto animate-fade-in-up">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-fluid-2xl fluid-p-6 fluid-mb-6 text-white shadow-xl">
        <div className="flex items-center fluid-gap-4">
          <div className="fluid-p-3 bg-white/20 rounded-fluid-xl backdrop-blur-sm">
            <Layers className="fluid-icon-xl text-white" />
          </div>
          <div>
            <h1 className="fluid-text-2xl font-bold">Nuevo Grupo</h1>
            <p className="fluid-text-sm text-white/80 fluid-mt-1">Crea un grupo dentro de tu plantel</p>
          </div>
        </div>
      </div>

      {/* Formulario */}
      <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-fluid-xl fluid-p-4 fluid-mb-5 flex items-center fluid-gap-3">
            <AlertCircle className="fluid-icon-sm text-red-600 flex-shrink-0" />
            <p className="fluid-text-sm text-red-700">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Ciclo escolar */}
          <div>
            <label className="block fluid-text-sm font-semibold text-gray-700 fluid-mb-1.5">
              Ciclo Escolar *
            </label>
            <select
              value={formData.school_cycle_id}
              onChange={(e) => setFormData(prev => ({ ...prev, school_cycle_id: parseInt(e.target.value) }))}
              className="w-full fluid-px-4 fluid-py-2.5 border border-gray-300 rounded-fluid-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent fluid-text-sm"
            >
              <option value={0}>Seleccionar ciclo...</option>
              {cycles.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Nombre */}
          <div>
            <label className="block fluid-text-sm font-semibold text-gray-700 fluid-mb-1.5">
              Nombre del Grupo *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Ej: Grupo 2026-A"
              className="w-full fluid-px-4 fluid-py-2.5 border border-gray-300 rounded-fluid-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent fluid-text-sm"
              required
            />
          </div>

          {/* Descripción */}
          <div>
            <label className="block fluid-text-sm font-semibold text-gray-700 fluid-mb-1.5">
              Descripción
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Descripción breve del grupo (opcional)"
              rows={3}
              className="w-full fluid-px-4 fluid-py-2.5 border border-gray-300 rounded-fluid-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent fluid-text-sm resize-none"
            />
          </div>

          {/* Botones */}
          <div className="flex items-center justify-between fluid-pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-fluid-xl fluid-text-sm font-semibold transition-all"
            >
              <ArrowLeft className="fluid-icon-sm" />
              Cancelar
            </button>
            <button
              type="submit"
              disabled={creating || !formData.name.trim() || !formData.school_cycle_id}
              className="inline-flex items-center fluid-gap-2 fluid-px-6 fluid-py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-fluid-xl fluid-text-sm font-semibold transition-all duration-300 shadow-md disabled:shadow-none"
            >
              {creating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Creando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="fluid-icon-sm" />
                  Crear Grupo
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
