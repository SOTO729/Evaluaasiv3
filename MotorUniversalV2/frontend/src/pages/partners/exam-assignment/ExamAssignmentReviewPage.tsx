/**
 * Página 4/4: Revisión de Costo y Confirmación
 * Recibe AssignMembersState de la página anterior
 * Llama a getAssignmentCostPreview + assignExamToGroup
 */
import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft, Users, ClipboardList, CheckCircle2,
  AlertCircle, Loader2, Wallet, TrendingDown,
  ShieldCheck, ShieldAlert,
} from 'lucide-react';
import LoadingSpinner from '../../../components/LoadingSpinner';
import PartnersBreadcrumb from '../../../components/PartnersBreadcrumb';
import {
  getGroup, assignExamToGroup,
  CandidateGroup, ExamAssignmentConfig,
} from '../../../services/partnersService';
import {
  getAssignmentCostPreview, CostPreviewData, formatCurrency,
} from '../../../services/balanceService';
import type { AssignMembersState } from './types';

export default function ExamAssignmentReviewPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const prevState = location.state as AssignMembersState | undefined;

  const [group, setGroup] = useState<CandidateGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [costPreview, setCostPreview] = useState<CostPreviewData | null>(null);
  const [saving, setSaving] = useState(false);

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
        const groupData = await getGroup(Number(groupId));
        setGroup(groupData);

        // Load cost preview
        const preview = await getAssignmentCostPreview(Number(groupId), {
          assignment_type: prevState.assignmentType,
          member_ids: prevState.assignmentType === 'selected' ? prevState.selectedMemberIds : undefined,
        });
        setCostPreview(preview);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Error al calcular el desglose de costo');
      } finally {
        setLoading(false);
      }
    })();
  }, [groupId]);

  const handleConfirm = async () => {
    if (!prevState?.selectedExam) return;
    const { selectedExam, config, selectedMaterialIds, assignmentType, selectedMemberIds } = prevState;

    try {
      setSaving(true);
      setError(null);

      const assignConfig: ExamAssignmentConfig = {
        exam_id: selectedExam.id,
        assignment_type: assignmentType,
        member_ids: assignmentType === 'selected' ? selectedMemberIds : undefined,
        material_ids: selectedMaterialIds.length > 0 ? selectedMaterialIds : undefined,
        time_limit_minutes: config.useExamDefaultTime ? null : config.timeLimitMinutes,
        passing_score: config.useExamDefaultScore ? null : config.passingScore,
        max_attempts: config.maxAttempts,
        max_disconnections: config.maxDisconnections,
        exam_content_type: config.examContentType,
        exam_questions_count: config.useAllExamQuestions ? null : config.examQuestionsCount,
        exam_exercises_count: config.useAllExamExercises ? null : config.examExercisesCount,
        simulator_questions_count: config.useAllSimulatorQuestions ? null : config.simulatorQuestionsCount,
        simulator_exercises_count: config.useAllSimulatorExercises ? null : config.simulatorExercisesCount,
        security_pin: config.requireSecurityPin ? config.securityPin : null,
        require_security_pin: config.requireSecurityPin,
      };

      await assignExamToGroup(Number(groupId), assignConfig);
      navigate(`/partners/groups/${groupId}`);
    } catch (err: any) {
      const errorType = err.response?.data?.error_type;
      if (errorType === 'insufficient_balance') {
        setError(`Saldo insuficiente. Necesitas ${formatCurrency(err.response?.data?.required || 0)} pero solo tienes ${formatCurrency(err.response?.data?.current_balance || 0)}.`);
      } else {
        setError(err.response?.data?.error || 'Error al asignar el examen');
      }
      setSaving(false);
    }
  };

  if (!prevState?.selectedExam) return null;
  if (loading) return <LoadingSpinner message="Calculando desglose de costo..." fullScreen />;
  if (!group || !costPreview) return <div className="p-6"><div className="bg-red-50 border border-red-200 rounded-fluid-xl fluid-p-4"><p className="text-red-600">{error || 'Error al cargar datos'}</p></div></div>;

  const { selectedExam, assignmentType, selectedMemberIds } = prevState;
  const stepLabels = ['Examen', 'Materiales', 'Candidatos', 'Confirmar'];

  return (
    <div className="fluid-p-6 max-w-[2800px] mx-auto animate-fade-in-up">
      <PartnersBreadcrumb items={[
        { label: group.campus?.partner?.name || 'Partner', path: `/partners/${group.campus?.partner_id}` },
        { label: group.campus?.name || 'Plantel', path: `/partners/campuses/${group.campus_id}` },
        { label: group.name, path: `/partners/groups/${groupId}` },
        { label: 'Confirmar Asignación' },
      ]} />

      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 rounded-fluid-2xl fluid-p-6 fluid-mb-6 text-white shadow-xl">
        <div className="flex items-center fluid-gap-4">
          <button onClick={() => navigate(-1)} className="fluid-p-2 hover:bg-white/20 rounded-fluid-xl transition-colors"><ArrowLeft className="fluid-icon-lg" /></button>
          <div>
            <div className="flex items-center fluid-gap-2 fluid-text-sm text-white/80 fluid-mb-1">
              <ClipboardList className="fluid-icon-sm" /><span>{group.name}</span><span>•</span><span>{selectedExam.name}</span>
            </div>
            <h1 className="fluid-text-2xl font-bold">Paso 4: Confirmar Asignación</h1>
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
                  i < 3 ? 'bg-green-500 text-white' : 'bg-blue-600 text-white ring-4 ring-blue-200 shadow-lg'
                }`}>{i < 3 ? <CheckCircle2 className="fluid-icon-base" /> : i + 1}</div>
                <span className={`ml-2 font-medium hidden sm:inline fluid-text-sm ${i === 3 ? 'text-blue-600' : 'text-green-600'}`}>{label}</span>
              </div>
              {i < stepLabels.length - 1 && <div className={`w-8 md:w-12 h-1 rounded-full mx-2 transition-all bg-green-400`} />}
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="fluid-mb-6 bg-red-50 border border-red-200 rounded-fluid-xl fluid-p-5 flex items-start fluid-gap-3">
          <AlertCircle className="fluid-icon-base text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-red-700 fluid-text-base flex-1">{error}</p>
        </div>
      )}

      {/* Cost preview card */}
      <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-5">
        <div className="flex items-center fluid-gap-3 fluid-mb-6">
          <div className="w-10 h-10 bg-emerald-100 rounded-fluid-xl flex items-center justify-center"><Wallet className="fluid-icon-base text-emerald-600" /></div>
          <div>
            <h2 className="fluid-text-lg font-semibold text-gray-900">Desglose de Costo</h2>
            <p className="fluid-text-sm text-gray-500">Revisa el consumo de saldo antes de confirmar la asignación</p>
          </div>
        </div>

        {/* Assignment summary */}
        <div className="bg-gray-50 rounded-fluid-xl fluid-p-4 fluid-mb-6">
          <h3 className="fluid-text-sm font-medium text-gray-500 fluid-mb-2">Resumen de la asignación</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 fluid-gap-4">
            <div>
              <p className="fluid-text-xs text-gray-400">Examen</p>
              <p className="font-medium text-gray-900 fluid-text-base">{selectedExam.name}</p>
              {(selectedExam.ecm_code || selectedExam.standard) && <p className="fluid-text-xs text-blue-600">ECM: {selectedExam.ecm_code || selectedExam.standard}</p>}
            </div>
            <div>
              <p className="fluid-text-xs text-gray-400">Grupo</p>
              <p className="font-medium text-gray-900 fluid-text-base">{costPreview.group_name}</p>
              <p className="fluid-text-xs text-gray-500">{costPreview.campus_name}</p>
            </div>
            <div>
              <p className="fluid-text-xs text-gray-400">Tipo de asignación</p>
              <p className="font-medium text-gray-900 fluid-text-base">
                {assignmentType === 'all' ? 'Todo el grupo' : `${(selectedMemberIds || []).length} candidato(s) seleccionado(s)`}
              </p>
            </div>
          </div>
        </div>

        {/* Cost table */}
        <div className="border border-gray-200 rounded-fluid-xl overflow-hidden fluid-mb-6">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left py-3 px-4 fluid-text-xs font-medium text-gray-500 uppercase">Concepto</th>
                <th className="text-center py-3 px-4 fluid-text-xs font-medium text-gray-500 uppercase">Unidades</th>
                <th className="text-right py-3 px-4 fluid-text-xs font-medium text-gray-500 uppercase">Precio unitario</th>
                <th className="text-right py-3 px-4 fluid-text-xs font-medium text-gray-500 uppercase">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="py-3 px-4">
                  <p className="font-medium text-gray-900 fluid-text-base">Certificación</p>
                  <p className="fluid-text-xs text-gray-500">Origen del costo: {costPreview.cost_source}</p>
                </td>
                <td className="py-3 px-4 text-center">
                  <span className="inline-flex items-center fluid-gap-1 text-gray-900 font-medium fluid-text-base"><Users className="fluid-icon-sm text-gray-400" />{costPreview.units}</span>
                </td>
                <td className="py-3 px-4 text-right font-medium text-gray-900 fluid-text-base">{formatCurrency(costPreview.unit_cost)}</td>
                <td className="py-3 px-4 text-right font-medium text-gray-900 fluid-text-base">{formatCurrency(costPreview.total_cost)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="bg-gray-50">
                <td colSpan={3} className="py-3 px-4 text-right font-semibold text-gray-700 fluid-text-base">Total a descontar</td>
                <td className="py-3 px-4 text-right font-bold fluid-text-lg text-gray-900">{formatCurrency(costPreview.total_cost)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Balance cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 fluid-gap-4 fluid-mb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-fluid-xl fluid-p-4">
            <div className="flex items-center fluid-gap-2 mb-1"><Wallet className="fluid-icon-sm text-blue-500" /><p className="fluid-text-xs font-medium text-blue-600">Saldo actual</p></div>
            <p className="fluid-text-2xl font-bold text-blue-700">{formatCurrency(costPreview.current_balance)}</p>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-fluid-xl fluid-p-4">
            <div className="flex items-center fluid-gap-2 mb-1"><TrendingDown className="fluid-icon-sm text-orange-500" /><p className="fluid-text-xs font-medium text-orange-600">Descuento</p></div>
            <p className="fluid-text-2xl font-bold text-orange-700">- {formatCurrency(costPreview.total_cost)}</p>
          </div>
          <div className={`border rounded-fluid-xl fluid-p-4 ${costPreview.has_sufficient_balance ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <div className="flex items-center fluid-gap-2 mb-1">
              {costPreview.has_sufficient_balance ? <ShieldCheck className="fluid-icon-sm text-green-500" /> : <ShieldAlert className="fluid-icon-sm text-red-500" />}
              <p className={`fluid-text-xs font-medium ${costPreview.has_sufficient_balance ? 'text-green-600' : 'text-red-600'}`}>Saldo restante</p>
            </div>
            <p className={`fluid-text-2xl font-bold ${costPreview.has_sufficient_balance ? 'text-green-700' : 'text-red-700'}`}>{formatCurrency(costPreview.remaining_balance)}</p>
          </div>
        </div>

        {/* Insufficient balance alert */}
        {!costPreview.has_sufficient_balance && (
          <div className="bg-red-50 border border-red-200 rounded-fluid-xl fluid-p-4 fluid-mb-6 flex items-start fluid-gap-3">
            <ShieldAlert className="fluid-icon-base text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-700 fluid-text-base">Saldo insuficiente</p>
              <p className="fluid-text-sm text-red-600 mt-1">
                Necesitas <strong>{formatCurrency(costPreview.total_cost)}</strong> pero tu saldo actual es de{' '}
                <strong>{formatCurrency(costPreview.current_balance)}</strong>.
                Te faltan <strong>{formatCurrency(Math.abs(costPreview.remaining_balance))}</strong> para completar esta asignación.
              </p>
              <Link to="/solicitar-saldo" className="inline-flex items-center fluid-gap-1 fluid-text-sm text-red-700 hover:text-red-900 font-medium mt-2 underline">Solicitar más saldo →</Link>
            </div>
          </div>
        )}

        {/* Zero cost alert */}
        {costPreview.total_cost === 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-fluid-xl fluid-p-4 fluid-mb-6 flex items-start fluid-gap-3">
            <AlertCircle className="fluid-icon-base text-yellow-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-700 fluid-text-base">Sin costo configurado</p>
              <p className="fluid-text-sm text-yellow-600 mt-1">No se ha definido un costo de certificación para este grupo ni su campus. La asignación se realizará sin consumir saldo.</p>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex justify-between pt-6 mt-2 border-t">
          <button onClick={() => navigate(-1)} className="fluid-px-4 fluid-py-2 text-gray-600 hover:text-gray-900 fluid-text-sm font-medium transition-colors">← Volver</button>
          <button onClick={handleConfirm} disabled={saving || (!costPreview.has_sufficient_balance && costPreview.total_cost > 0)}
            className="fluid-px-6 fluid-py-3 bg-green-600 text-white rounded-fluid-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center fluid-gap-2 font-medium shadow-lg transition-all fluid-text-sm">
            {saving ? (
              <><Loader2 className="fluid-icon-base animate-spin" />Asignando y descontando saldo...</>
            ) : (
              <><CheckCircle2 className="fluid-icon-base" />{costPreview.total_cost > 0 ? `Confirmar Asignación (${formatCurrency(costPreview.total_cost)})` : 'Confirmar Asignación'}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
