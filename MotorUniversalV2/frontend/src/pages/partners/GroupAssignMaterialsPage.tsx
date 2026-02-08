/**
 * Página de Asignación de Materiales de Estudio a Grupo (Sin Examen)
 * Permite asignar materiales de estudio publicados directamente a un grupo
 * sin necesidad de asociarlos a un examen.
 * 
 * Casos de uso:
 * - Partners que solo compran materiales de estudio
 * - Complementar la formación antes de presentar exámenes
 */
import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  Users,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Search,
  ChevronsLeft,
  ChevronsRight,
  Save,
  Layers,
  Calendar,
  Lock,
  FileText,
  Edit3,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import PartnersBreadcrumb from '../../components/PartnersBreadcrumb';
import {
  getGroup,
  getGroupMembers,
  getAvailableStudyMaterials,
  assignStudyMaterialsToGroup,
  CandidateGroup,
  GroupMember,
  StudyMaterialItem,
} from '../../services/partnersService';

type Step = 'select-materials' | 'assign-members';

export default function GroupAssignMaterialsPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();

  // Estado del grupo y miembros
  const [group, setGroup] = useState<CandidateGroup | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estado del wizard
  const [currentStep, setCurrentStep] = useState<Step>('select-materials');

  // Paso 1: Selección de materiales
  const [availableMaterials, setAvailableMaterials] = useState<StudyMaterialItem[]>([]);
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<number[]>([]);
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  const [materialSearchQuery, setMaterialSearchQuery] = useState('');
  const [materialPage, setMaterialPage] = useState(1);
  const [materialTotalPages, setMaterialTotalPages] = useState(1);
  const [materialTotal, setMaterialTotal] = useState(0);
  const MATERIALS_PER_PAGE = 12;

  // Paso 2: Asignación de miembros
  const [assignmentType, setAssignmentType] = useState<'all' | 'selected'>('all');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');

  // Fechas de disponibilidad (opcional)
  const [useAvailabilityDates, setUseAvailabilityDates] = useState(false);
  const [availableFrom, setAvailableFrom] = useState<string>('');
  const [availableUntil, setAvailableUntil] = useState<string>('');

  // Modal de material ya asignado
  const [showAlreadyAssignedModal, setShowAlreadyAssignedModal] = useState(false);
  const [attemptedMaterial, setAttemptedMaterial] = useState<StudyMaterialItem | null>(null);

  // Estado de guardado
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [groupId]);

  // Cargar materiales cuando cambia la página o búsqueda
  useEffect(() => {
    const timer = setTimeout(() => {
      loadMaterials();
    }, materialSearchQuery ? 300 : 0);
    return () => clearTimeout(timer);
  }, [materialPage, materialSearchQuery]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [groupData, membersData] = await Promise.all([
        getGroup(Number(groupId)),
        getGroupMembers(Number(groupId)),
      ]);
      setGroup(groupData);
      setMembers(membersData.members);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar el grupo');
    } finally {
      setLoading(false);
    }
  };

  const loadMaterials = async () => {
    try {
      setLoadingMaterials(true);
      const data = await getAvailableStudyMaterials({
        page: materialPage,
        per_page: MATERIALS_PER_PAGE,
        search: materialSearchQuery || undefined,
        group_id: Number(groupId),
      });
      setAvailableMaterials(data.materials);
      setMaterialTotalPages(data.pages);
      setMaterialTotal(data.total);
    } catch (err) {
      console.error('Error cargando materiales:', err);
    } finally {
      setLoadingMaterials(false);
    }
  };

  const handleMaterialSearchChange = (query: string) => {
    setMaterialSearchQuery(query);
    setMaterialPage(1);
  };

  const handleToggleMaterial = (material: StudyMaterialItem) => {
    // Si el material ya está asignado al grupo directamente, mostrar modal
    if (material.is_assigned_to_group) {
      setAttemptedMaterial(material);
      setShowAlreadyAssignedModal(true);
      return;
    }
    
    // Si el material está en un examen ya asignado al grupo, mostrar modal
    if (material.is_in_assigned_exam) {
      setAttemptedMaterial(material);
      setShowAlreadyAssignedModal(true);
      return;
    }
    
    setSelectedMaterialIds((prev) =>
      prev.includes(material.id)
        ? prev.filter((id) => id !== material.id)
        : [...prev, material.id]
    );
  };

  const handleToggleMember = (userId: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSelectAllMembers = () => {
    if (selectedMemberIds.length === members.length) {
      setSelectedMemberIds([]);
    } else {
      setSelectedMemberIds(members.map((m) => m.user_id));
    }
  };

  const filteredMembers = members.filter((m) => {
    if (!memberSearchQuery.trim()) return true;
    const query = memberSearchQuery.toLowerCase();
    const fullName = m.user?.full_name?.toLowerCase() || '';
    const email = m.user?.email?.toLowerCase() || '';
    const curp = m.user?.curp?.toLowerCase() || '';
    return fullName.includes(query) || email.includes(query) || curp.includes(query);
  });

  const handleGoToMemberAssignment = () => {
    if (selectedMaterialIds.length === 0) {
      setError('Debes seleccionar al menos un material de estudio');
      return;
    }
    setError(null);
    setCurrentStep('assign-members');
  };

  const handleBackToMaterialSelection = () => {
    setCurrentStep('select-materials');
  };

  const handleAssignMaterials = async () => {
    if (selectedMaterialIds.length === 0) {
      setError('Debes seleccionar al menos un material de estudio');
      return;
    }

    if (assignmentType === 'selected' && selectedMemberIds.length === 0) {
      setError('Debes seleccionar al menos un candidato');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const config = {
        material_ids: selectedMaterialIds,
        assignment_type: assignmentType,
        member_ids: assignmentType === 'selected' ? selectedMemberIds : undefined,
        available_from: useAvailabilityDates && availableFrom ? availableFrom : undefined,
        available_until: useAvailabilityDates && availableUntil ? availableUntil : undefined,
      };

      await assignStudyMaterialsToGroup(Number(groupId), config);

      // Redirigir directamente
      navigate(`/partners/groups/${groupId}`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al asignar los materiales');
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Cargando..." fullScreen />;
  }

  if (saving) {
    return <LoadingSpinner message="Asignando materiales al grupo..." fullScreen />;
  }

  if (!group) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">Grupo no encontrado</p>
        </div>
      </div>
    );
  }

  const stepIndicator = (
    <div className="flex items-center justify-center mb-8">
      <div className="flex items-center space-x-4">
        {/* Paso 1: Seleccionar Materiales */}
        <div
          className={`flex items-center ${
            currentStep === 'select-materials' ? 'text-blue-600' : 'text-gray-400'
          }`}
        >
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              currentStep === 'select-materials'
                ? 'bg-blue-600 text-white'
                : selectedMaterialIds.length > 0
                ? 'bg-green-500 text-white'
                : 'bg-gray-200 text-gray-600'
            }`}
          >
            {selectedMaterialIds.length > 0 && currentStep !== 'select-materials' ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              '1'
            )}
          </div>
          <span className="ml-2 font-medium hidden sm:inline">Materiales</span>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-300" />

        {/* Paso 2: Asignar */}
        <div
          className={`flex items-center ${
            currentStep === 'assign-members' ? 'text-blue-600' : 'text-gray-400'
          }`}
        >
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              currentStep === 'assign-members' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
            }`}
          >
            2
          </div>
          <span className="ml-2 font-medium hidden sm:inline">Asignar</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fluid-p-6 max-w-[2800px] mx-auto animate-fade-in-up">
      {/* Breadcrumb */}
      <PartnersBreadcrumb 
        items={[
          { label: group.campus?.partner?.name || 'Partner', path: `/partners/${group.campus?.partner_id}` },
          { label: group.campus?.name || 'Plantel', path: `/partners/campuses/${group.campus_id}` },
          { label: group.name, path: `/partners/groups/${groupId}` },
          { label: 'Asignar Materiales' }
        ]} 
      />
      
      {/* Header */}
      <div className="mb-6">
        <Link
          to={`/partners/groups/${groupId}`}
          className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver al grupo
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-green-600" />
          Asignar Materiales de Estudio
        </h1>
        <p className="text-gray-500 mt-1">
          {group.name} • {group.member_count} miembros
        </p>
        <p className="text-sm text-gray-400 mt-2">
          Asigna materiales de estudio directamente al grupo sin necesidad de un examen.
        </p>
      </div>

      {/* Mensajes */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
          <AlertCircle className="w-5 h-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Indicador de pasos */}
      {stepIndicator}

      {/* Paso 1: Selección de Materiales */}
      {currentStep === 'select-materials' && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Layers className="w-5 h-5 text-blue-500" />
                Seleccionar Materiales de Estudio
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Selecciona los materiales de estudio que estarán disponibles para el grupo.
              </p>
            </div>
            {selectedMaterialIds.length > 0 && (
              <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
                {selectedMaterialIds.length} seleccionado(s)
              </span>
            )}
          </div>

          {/* Buscador */}
          <div className="mb-4 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar materiales..."
              value={materialSearchQuery}
              onChange={(e) => handleMaterialSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Lista de materiales */}
          {loadingMaterials ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
          ) : availableMaterials.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <BookOpen className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No hay materiales de estudio publicados disponibles</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                {availableMaterials.map((material) => (
                  <div
                    key={material.id}
                    onClick={() => handleToggleMaterial(material)}
                    className={`border rounded-lg p-4 transition-all ${
                      material.is_assigned_to_group
                        ? 'border-orange-300 bg-orange-50/50 cursor-not-allowed opacity-70'
                        : selectedMaterialIds.includes(material.id)
                        ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200 cursor-pointer'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-5 h-5 rounded border flex-shrink-0 mt-1 flex items-center justify-center ${
                          material.is_assigned_to_group
                            ? 'bg-orange-400 border-orange-400'
                            : selectedMaterialIds.includes(material.id)
                            ? 'bg-blue-500 border-blue-500'
                            : 'border-gray-300'
                        }`}
                      >
                        {material.is_assigned_to_group ? (
                          <Lock className="w-3 h-3 text-white" />
                        ) : selectedMaterialIds.includes(material.id) ? (
                          <CheckCircle2 className="w-4 h-4 text-white" />
                        ) : null}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-gray-900 truncate">{material.title}</h3>
                          {material.is_assigned_to_group && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full flex-shrink-0">
                              <Lock className="w-3 h-3" />
                              Ya asignado
                            </span>
                          )}
                        </div>
                        {material.description && (
                          <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                            {material.description}
                          </p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                          <span>{material.sessions_count} sesiones</span>
                          <span>{material.topics_count} temas</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Paginación */}
              {materialTotalPages > 1 && (
                <div className="flex items-center justify-between border-t pt-4">
                  <span className="text-sm text-gray-500">
                    Mostrando {(materialPage - 1) * MATERIALS_PER_PAGE + 1} -{' '}
                    {Math.min(materialPage * MATERIALS_PER_PAGE, materialTotal)} de {materialTotal}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setMaterialPage(1)}
                      disabled={materialPage === 1}
                      className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronsLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setMaterialPage((p) => Math.max(1, p - 1))}
                      disabled={materialPage === 1}
                      className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="px-3 py-1 text-sm">
                      Página {materialPage} de {materialTotalPages}
                    </span>
                    <button
                      onClick={() => setMaterialPage((p) => Math.min(materialTotalPages, p + 1))}
                      disabled={materialPage === materialTotalPages}
                      className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setMaterialPage(materialTotalPages)}
                      disabled={materialPage === materialTotalPages}
                      className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronsRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Botones de navegación */}
          <div className="flex justify-end mt-6 pt-4 border-t">
            <button
              onClick={handleGoToMemberAssignment}
              disabled={selectedMaterialIds.length === 0}
              className="inline-flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Siguiente
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Paso 2: Asignación de Miembros */}
      {currentStep === 'assign-members' && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-500" />
            Asignar a Candidatos
          </h2>

          {/* Resumen de materiales seleccionados */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-medium text-blue-800 mb-2">
              Materiales seleccionados ({selectedMaterialIds.length})
            </h3>
            <div className="flex flex-wrap gap-2">
              {availableMaterials
                .filter((m) => selectedMaterialIds.includes(m.id))
                .map((m) => (
                  <span
                    key={m.id}
                    className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-sm"
                  >
                    {m.title}
                  </span>
                ))}
            </div>
          </div>

          {/* Tipo de asignación */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              ¿A quién asignar los materiales?
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div
                onClick={() => setAssignmentType('all')}
                className={`border rounded-lg p-4 cursor-pointer transition-all ${
                  assignmentType === 'all'
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Users className="w-6 h-6 text-blue-500" />
                  <div>
                    <h3 className="font-medium text-gray-900">Todo el grupo</h3>
                    <p className="text-sm text-gray-500">
                      Los {group.member_count} miembros tendrán acceso
                    </p>
                  </div>
                </div>
              </div>
              <div
                onClick={() => setAssignmentType('selected')}
                className={`border rounded-lg p-4 cursor-pointer transition-all ${
                  assignmentType === 'selected'
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <UserCheck className="w-6 h-6 text-purple-500" />
                  <div>
                    <h3 className="font-medium text-gray-900">Candidatos específicos</h3>
                    <p className="text-sm text-gray-500">Seleccionar manualmente</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Selección de miembros específicos */}
          {assignmentType === 'selected' && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <label className="block text-sm font-medium text-gray-700">
                  Seleccionar candidatos
                </label>
                <button
                  onClick={handleSelectAllMembers}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  {selectedMemberIds.length === members.length
                    ? 'Deseleccionar todos'
                    : 'Seleccionar todos'}
                </button>
              </div>

              {/* Buscador de miembros */}
              <div className="mb-4 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Buscar por nombre, email o CURP..."
                  value={memberSearchQuery}
                  onChange={(e) => setMemberSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Lista de miembros */}
              <div className="max-h-60 overflow-y-auto border rounded-lg divide-y">
                {filteredMembers.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    No se encontraron candidatos
                  </div>
                ) : (
                  filteredMembers.map((member) => (
                    <div
                      key={member.user_id}
                      onClick={() => handleToggleMember(member.user_id)}
                      className={`p-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50 ${
                        selectedMemberIds.includes(member.user_id) ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center ${
                          selectedMemberIds.includes(member.user_id)
                            ? 'bg-blue-500 border-blue-500'
                            : 'border-gray-300'
                        }`}
                      >
                        {selectedMemberIds.includes(member.user_id) && (
                          <CheckCircle2 className="w-4 h-4 text-white" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {member.user?.full_name || 'Sin nombre'}
                        </p>
                        <p className="text-sm text-gray-500 truncate">{member.user?.email}</p>
                        {member.user?.curp && (
                          <p className="text-xs text-gray-400 font-mono truncate">{member.user.curp}</p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
              {assignmentType === 'selected' && selectedMemberIds.length > 0 && (
                <p className="mt-2 text-sm text-gray-500">
                  {selectedMemberIds.length} candidato(s) seleccionado(s)
                </p>
              )}
            </div>
          )}

          {/* Fechas de disponibilidad (opcional) */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <input
                type="checkbox"
                id="useAvailabilityDates"
                checked={useAvailabilityDates}
                onChange={(e) => setUseAvailabilityDates(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="useAvailabilityDates" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Establecer período de disponibilidad
              </label>
            </div>

            {useAvailabilityDates && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Disponible desde
                  </label>
                  <input
                    type="datetime-local"
                    value={availableFrom}
                    onChange={(e) => setAvailableFrom(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Disponible hasta
                  </label>
                  <input
                    type="datetime-local"
                    value={availableUntil}
                    onChange={(e) => setAvailableUntil(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Botones de navegación */}
          <div className="flex justify-between mt-6 pt-4 border-t">
            <button
              onClick={handleBackToMaterialSelection}
              className="inline-flex items-center gap-2 px-4 py-2 text-gray-700 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
              Atrás
            </button>
            <button
              onClick={handleAssignMaterials}
              disabled={
                saving ||
                (assignmentType === 'selected' && selectedMemberIds.length === 0)
              }
              className="inline-flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Asignando...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Asignar Materiales
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Modal: Material ya asignado */}
      {showAlreadyAssignedModal && attemptedMaterial && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fadeIn"
          onClick={() => setShowAlreadyAssignedModal(false)}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden animate-slideUp"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header con gradiente */}
            <div className={`p-6 text-white ${attemptedMaterial.is_in_assigned_exam ? 'bg-gradient-to-r from-purple-500 to-indigo-500' : 'bg-gradient-to-r from-orange-500 to-amber-500'}`}>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center animate-bounce">
                  <Lock className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">
                    {attemptedMaterial.is_in_assigned_exam 
                      ? 'Material incluido en examen' 
                      : 'Material ya asignado'}
                  </h3>
                  <p className={`text-sm ${attemptedMaterial.is_in_assigned_exam ? 'text-purple-100' : 'text-orange-100'}`}>
                    {attemptedMaterial.is_in_assigned_exam
                      ? 'Este material ya está vinculado a un examen del grupo'
                      : 'Este material ya pertenece al grupo'}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Contenido */}
            <div className="p-6">
              <div className="flex items-start gap-3 mb-4">
                <AlertCircle className={`w-6 h-6 flex-shrink-0 mt-0.5 ${attemptedMaterial.is_in_assigned_exam ? 'text-purple-500' : 'text-orange-500'}`} />
                <div>
                  {attemptedMaterial.is_in_assigned_exam ? (
                    <>
                      <p className="text-gray-700 font-medium">
                        El material <span className="text-purple-600">"{attemptedMaterial.title}"</span> ya está 
                        incluido en el examen <span className="text-indigo-600">"{attemptedMaterial.assigned_exam_info?.exam_name}"</span>.
                      </p>
                      <p className="text-gray-500 text-sm mt-2">
                        No es necesario asignarlo como material adicional. Los candidatos asignados a ese examen 
                        ya tienen acceso automático a este material.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-gray-700 font-medium">
                        El material <span className="text-orange-600">"{attemptedMaterial.title}"</span> ya está asignado a este grupo.
                      </p>
                      <p className="text-gray-500 text-sm mt-2">
                        Si deseas modificar los candidatos asignados a este material, 
                        puedes hacerlo con el botón de editar candidatos.
                      </p>
                    </>
                  )}
                </div>
              </div>
              
              {/* Info del material/examen */}
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                {attemptedMaterial.is_in_assigned_exam && attemptedMaterial.assigned_exam_info ? (
                  <>
                    <p className="text-sm font-medium text-gray-700 mb-2">Examen vinculado:</p>
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                      <FileText className="w-4 h-4 text-indigo-500" />
                      <span className="font-medium">{attemptedMaterial.assigned_exam_info.exam_name}</span>
                    </div>
                    <div className="border-t pt-3 mt-2">
                      <p className="text-sm font-medium text-gray-700 mb-2">Material:</p>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span className="flex items-center">
                          <Layers className="w-4 h-4 mr-1 text-gray-400" />
                          {attemptedMaterial.sessions_count} sesiones
                        </span>
                        <span className="flex items-center">
                          <BookOpen className="w-4 h-4 mr-1 text-gray-400" />
                          {attemptedMaterial.topics_count} temas
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-gray-700 mb-2">Detalles del material:</p>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span className="flex items-center">
                        <Layers className="w-4 h-4 mr-1 text-gray-400" />
                        {attemptedMaterial.sessions_count} sesiones
                      </span>
                      <span className="flex items-center">
                        <BookOpen className="w-4 h-4 mr-1 text-gray-400" />
                        {attemptedMaterial.topics_count} temas
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
            
            {/* Footer con botones de acción */}
            <div className="bg-gray-50 px-6 py-4 flex flex-wrap justify-end gap-3">
              <button
                onClick={() => setShowAlreadyAssignedModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                Entendido
              </button>
              
              {attemptedMaterial.is_in_assigned_exam && attemptedMaterial.assigned_exam_info ? (
                <Link
                  to={`/partners/groups/${groupId}/assignments/${attemptedMaterial.assigned_exam_info.exam_id}/edit-members?type=exam&name=${encodeURIComponent(attemptedMaterial.assigned_exam_info.exam_name)}`}
                  className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors font-medium flex items-center gap-2"
                >
                  <Edit3 className="w-4 h-4" />
                  Editar candidatos del examen
                </Link>
              ) : (
                <Link
                  to={`/partners/groups/${groupId}/assignments/${attemptedMaterial.id}/edit-members?type=material&name=${encodeURIComponent(attemptedMaterial.title)}`}
                  className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium flex items-center gap-2"
                >
                  <Edit3 className="w-4 h-4" />
                  Editar candidatos
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Estilos de animación */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { 
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          to { 
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
