/**
 * GroupCascadeSelector
 * Selector opcional Partner → Campus → Ciclo → Grupo para asignar un candidato
 * a un grupo al darlo de alta. Para responsables auto-rellena Partner+Campus
 * desde su user.campus_id y solo muestra Ciclo+Grupo.
 *
 * Cuando hay un valor seleccionado en `groupId`, el componente padre puede
 * enviarlo en el body del POST /user-management/users como `group_id`.
 */
import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import StyledSelect from '../StyledSelect';
import {
  getPartners,
  getCampuses,
  getCampus,
  getSchoolCycles,
  getGroups,
} from '../../services/partnersService';

interface Option {
  value: string;
  label: string;
}

interface Props {
  /** Rol del usuario en sesión (decide qué niveles mostrar). */
  currentRole: string;
  /** campus_id del responsable en sesión, si aplica. */
  currentUserCampusId?: number | null;
  /** Valor controlado del grupo seleccionado (number) o '' / undefined. */
  groupId: number | '' | undefined;
  /** Callback cuando cambia el grupo. */
  onChange: (groupId: number | '') => void;
  /** Si true, muestra el componente colapsable (solo aparece si el usuario lo activa). */
  collapsible?: boolean;
}

export default function GroupCascadeSelector({
  currentRole,
  currentUserCampusId,
  groupId,
  onChange,
  collapsible = true,
}: Props) {
  const isResponsable = currentRole === 'responsable';
  const [open, setOpen] = useState(!collapsible);

  const [partnerId, setPartnerId] = useState<number | ''>('');
  const [campusId, setCampusId] = useState<number | ''>('');
  const [cycleId, setCycleId] = useState<number | ''>('');

  const [partners, setPartners] = useState<Option[]>([]);
  const [campuses, setCampuses] = useState<Option[]>([]);
  const [cycles, setCycles] = useState<Option[]>([]);
  const [groups, setGroups] = useState<Option[]>([]);

  const [loadingPartners, setLoadingPartners] = useState(false);
  const [loadingCampuses, setLoadingCampuses] = useState(false);
  const [loadingCycles, setLoadingCycles] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(false);

  // Para responsable: precargar partner+campus desde su campus_id
  useEffect(() => {
    if (!open || !isResponsable || !currentUserCampusId) return;
    setLoadingCampuses(true);
    getCampus(currentUserCampusId)
      .then((c: any) => {
        setPartnerId(c.partner_id);
        setPartners([{ value: String(c.partner_id), label: c.partner_name || 'Partner' }]);
        setCampusId(c.id);
        setCampuses([{ value: String(c.id), label: c.name }]);
      })
      .catch(() => {})
      .finally(() => setLoadingCampuses(false));
  }, [open, isResponsable, currentUserCampusId]);

  // Cargar partners (no responsable)
  useEffect(() => {
    if (!open || isResponsable || partners.length > 0) return;
    setLoadingPartners(true);
    getPartners({ page: 1, per_page: 500 })
      .then((res: any) =>
        setPartners((res.partners || []).map((p: any) => ({ value: String(p.id), label: p.name })))
      )
      .catch(() => {})
      .finally(() => setLoadingPartners(false));
  }, [open, isResponsable, partners.length]);

  // Campuses por partner (no responsable)
  useEffect(() => {
    if (isResponsable) return;
    setCampuses([]);
    setCampusId('');
    setCycles([]);
    setCycleId('');
    setGroups([]);
    onChange('');
    if (partnerId) {
      setLoadingCampuses(true);
      getCampuses(Number(partnerId))
        .then((res: any) =>
          setCampuses((res.campuses || []).map((c: any) => ({ value: String(c.id), label: c.name })))
        )
        .catch(() => {})
        .finally(() => setLoadingCampuses(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partnerId]);

  // Ciclos por campus
  useEffect(() => {
    setCycles([]);
    setCycleId('');
    setGroups([]);
    onChange('');
    if (campusId) {
      setLoadingCycles(true);
      getSchoolCycles(Number(campusId), { active_only: true })
        .then((res: any) =>
          setCycles((res.cycles || []).map((c: any) => ({ value: String(c.id), label: c.name })))
        )
        .catch(() => {})
        .finally(() => setLoadingCycles(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campusId]);

  // Grupos por ciclo
  useEffect(() => {
    setGroups([]);
    onChange('');
    if (campusId && cycleId) {
      setLoadingGroups(true);
      getGroups(Number(campusId), { cycle_id: Number(cycleId) })
        .then((res: any) =>
          setGroups((res.groups || []).map((g: any) => ({ value: String(g.id), label: g.name })))
        )
        .catch(() => {})
        .finally(() => setLoadingGroups(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campusId, cycleId]);

  if (collapsible && !open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 fluid-text-sm text-emerald-700 hover:text-emerald-900 underline"
      >
        <Users className="w-4 h-4" />
        Asignar a un grupo (opcional)
      </button>
    );
  }

  return (
    <div className="border border-emerald-200 bg-emerald-50/40 rounded-lg fluid-p-4 fluid-gap-3 flex flex-col">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-medium text-emerald-800 fluid-text-sm">
          <Users className="w-4 h-4" />
          Asignación a grupo (opcional)
        </div>
        {collapsible && (
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onChange('');
              setPartnerId('');
              setCampusId('');
              setCycleId('');
            }}
            className="fluid-text-xs text-gray-500 hover:text-gray-700"
          >
            Quitar
          </button>
        )}
      </div>
      <p className="fluid-text-xs text-gray-600">
        Si seleccionas un grupo, el candidato se asignará automáticamente. Si el correo o CURP ya
        existen en el sistema, ese usuario se reusará y se agregará a este grupo.
      </p>

      {!isResponsable && (
        <StyledSelect
          value={partnerId === '' ? '' : String(partnerId)}
          onChange={(v) => setPartnerId(v ? Number(v) : '')}
          options={partners}
          placeholder={loadingPartners ? 'Cargando partners...' : 'Selecciona partner'}
          colorScheme="emerald"
        />
      )}
      {!isResponsable && (
        <StyledSelect
          value={campusId === '' ? '' : String(campusId)}
          onChange={(v) => setCampusId(v ? Number(v) : '')}
          options={campuses}
          placeholder={loadingCampuses ? 'Cargando planteles...' : 'Selecciona plantel'}
          disabled={!partnerId}
          colorScheme="emerald"
        />
      )}
      <StyledSelect
        value={cycleId === '' ? '' : String(cycleId)}
        onChange={(v) => setCycleId(v ? Number(v) : '')}
        options={cycles}
        placeholder={loadingCycles ? 'Cargando ciclos...' : 'Selecciona ciclo escolar'}
        disabled={!campusId}
        colorScheme="emerald"
      />
      <StyledSelect
        value={groupId === '' || groupId === undefined ? '' : String(groupId)}
        onChange={(v) => onChange(v ? Number(v) : '')}
        options={groups}
        placeholder={loadingGroups ? 'Cargando grupos...' : 'Selecciona grupo'}
        disabled={!cycleId}
        colorScheme="emerald"
      />
    </div>
  );
}
