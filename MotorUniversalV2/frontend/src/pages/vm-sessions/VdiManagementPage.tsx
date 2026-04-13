import { useState, useEffect, useCallback } from 'react';
import { Monitor, Power, PowerOff, RefreshCw, Activity, Server, Wifi, WifiOff, ChevronDown, ChevronUp, Users, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  getWorkstations,
  toggleWorkstation,
  getWorkstationStatus,
  getConfigHealth,
  getSoapHealth,
  getSoapUsers,
  getSoapHorarios,
  getSoapCompletedUsers,
  getSoapExpiredUsers,
  getSoapApplications,
  type Workstation,
  type AdUser,
} from '../../services/vmSessionsService';

type TabId = 'workstations' | 'ad-users' | 'completed-users' | 'expired-users' | 'horarios';

export default function VdiManagementPage() {
  const [activeTab, setActiveTab] = useState<TabId>('workstations');

  // Workstations
  const [workstations, setWorkstations] = useState<Workstation[]>([]);
  const [showAll, setShowAll] = useState(true);
  const [wLoading, setWLoading] = useState(true);
  const [toggleLoading, setToggleLoading] = useState<number | null>(null);

  // Status
  const [statusData, setStatusData] = useState<{
    current_slot: string;
    total_active_vdis: number;
    occupied_now: number;
    available_now: number;
  } | null>(null);

  // Health
  const [configHealth, setConfigHealth] = useState<{ connected: boolean; error?: string } | null>(null);
  const [soapHealth, setSoapHealth] = useState<{ connected: boolean; url: string; message?: string; error?: string } | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);

  // AD Users
  const [adUsers, setAdUsers] = useState<AdUser[]>([]);
  const [adLoading, setAdLoading] = useState(false);
  const [adError, setAdError] = useState('');
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  // Horarios
  const [horarios, setHorarios] = useState<{ equipo: string; horarios: string }[]>([]);
  const [horariosLoading, setHorariosLoading] = useState(false);

  // Completed users
  const [completedUsers, setCompletedUsers] = useState<AdUser[]>([]);
  const [completedLoading, setCompletedLoading] = useState(false);
  const [completedError, setCompletedError] = useState('');

  // Expired users
  const [expiredUsers, setExpiredUsers] = useState<AdUser[]>([]);
  const [expiredLoading, setExpiredLoading] = useState(false);
  const [expiredError, setExpiredError] = useState('');

  // Applications per user
  const [userApps, setUserApps] = useState<Record<string, string[]>>({});
  const [appsLoading, setAppsLoading] = useState<string | null>(null);

  const [error, setError] = useState('');

  const loadWorkstations = useCallback(async () => {
    setWLoading(true);
    try {
      const data = await getWorkstations(showAll);
      setWorkstations(data.workstations);
    } catch {
      setError('Error cargando VDIs');
    } finally {
      setWLoading(false);
    }
  }, [showAll]);

  const loadStatus = useCallback(async () => {
    try {
      const data = await getWorkstationStatus();
      setStatusData({
        current_slot: data.current_slot,
        total_active_vdis: data.total_active_vdis,
        occupied_now: data.occupied_now,
        available_now: data.available_now,
      });
    } catch {
      // Non-fatal
    }
  }, []);

  const loadHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      const [ch, sh] = await Promise.all([
        getConfigHealth().catch(() => ({ connected: false, error: 'Sin conexión' })),
        getSoapHealth().catch(() => ({ connected: false, url: '', error: 'Sin conexión' })),
      ]);
      setConfigHealth(ch);
      setSoapHealth(sh);
    } finally {
      setHealthLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkstations();
    loadStatus();
    loadHealth();
  }, [loadWorkstations, loadStatus, loadHealth]);

  const handleToggle = async (equipoId: number, currentActive: boolean) => {
    setToggleLoading(equipoId);
    try {
      await toggleWorkstation(equipoId, !currentActive);
      await loadWorkstations();
      await loadStatus();
    } catch {
      setError('Error actualizando VDI');
    } finally {
      setToggleLoading(null);
    }
  };

  const loadAdUsers = async () => {
    setAdLoading(true);
    setAdError('');
    try {
      const data = await getSoapUsers();
      setAdUsers(data.users);
    } catch {
      setAdError('Error obteniendo usuarios AD');
    } finally {
      setAdLoading(false);
    }
  };

  const loadHorarios = async () => {
    setHorariosLoading(true);
    try {
      const data = await getSoapHorarios();
      setHorarios(data.horarios);
    } catch {
      setError('Error obteniendo horarios');
    } finally {
      setHorariosLoading(false);
    }
  };

  const loadCompletedUsers = async () => {
    setCompletedLoading(true);
    setCompletedError('');
    try {
      const data = await getSoapCompletedUsers();
      setCompletedUsers(data.users);
    } catch {
      setCompletedError('Error obteniendo usuarios completados');
    } finally {
      setCompletedLoading(false);
    }
  };

  const loadExpiredUsers = async () => {
    setExpiredLoading(true);
    setExpiredError('');
    try {
      const data = await getSoapExpiredUsers();
      setExpiredUsers(data.users);
    } catch {
      setExpiredError('Error obteniendo usuarios expirados');
    } finally {
      setExpiredLoading(false);
    }
  };

  const loadApplications = async (username: string) => {
    if (userApps[username]) return;
    setAppsLoading(username);
    try {
      const data = await getSoapApplications(username);
      setUserApps(prev => ({ ...prev, [username]: data.applications }));
    } catch {
      setUserApps(prev => ({ ...prev, [username]: [] }));
    } finally {
      setAppsLoading(null);
    }
  };

  useEffect(() => {
    if (activeTab === 'ad-users' && adUsers.length === 0 && !adLoading) {
      loadAdUsers();
    } else if (activeTab === 'horarios' && horarios.length === 0 && !horariosLoading) {
      loadHorarios();
    } else if (activeTab === 'completed-users' && completedUsers.length === 0 && !completedLoading) {
      loadCompletedUsers();
    } else if (activeTab === 'expired-users' && expiredUsers.length === 0 && !expiredLoading) {
      loadExpiredUsers();
    }
  }, [activeTab]);

  const activeCount = workstations.filter(w => w.activo).length;
  const inactiveCount = workstations.filter(w => !w.activo).length;

  const tabs: { id: TabId; label: string; icon: typeof Monitor }[] = [
    { id: 'workstations', label: 'VDIs', icon: Monitor },
    { id: 'ad-users', label: 'Usuarios AD', icon: Users },
    { id: 'completed-users', label: 'Completados', icon: CheckCircle2 },
    { id: 'expired-users', label: 'Expirados', icon: AlertTriangle },
    { id: 'horarios', label: 'Horarios', icon: Clock },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Server className="w-6 h-6 text-purple-600" />
            Administración de VDIs
          </h1>
          <p className="text-sm text-gray-500 mt-1">Gestionar máquinas virtuales, usuarios AD y conexiones</p>
        </div>
        <button
          onClick={() => { loadWorkstations(); loadStatus(); loadHealth(); }}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Actualizar
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
          <button onClick={() => setError('')} className="ml-2 text-red-500 hover:text-red-700 font-bold">×</button>
        </div>
      )}

      {/* Health Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Activity className="w-4 h-4" />
            Slot Actual
          </div>
          <p className="text-lg font-bold text-gray-900">{statusData?.current_slot || '—'}</p>
          <p className="text-xs text-gray-400 mt-1">
            {statusData ? `${statusData.occupied_now} ocupadas / ${statusData.available_now} libres` : 'Cargando...'}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Monitor className="w-4 h-4" />
            VDIs
          </div>
          <p className="text-lg font-bold text-gray-900">{activeCount} <span className="text-sm font-normal text-gray-400">activas</span></p>
          <p className="text-xs text-gray-400 mt-1">{inactiveCount} inactivas / {workstations.length} total</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            {configHealth?.connected ? <Wifi className="w-4 h-4 text-green-500" /> : <WifiOff className="w-4 h-4 text-red-500" />}
            EvaluaasiConfig DB
          </div>
          <p className={`text-lg font-bold ${configHealth?.connected ? 'text-green-600' : 'text-red-600'}`}>
            {healthLoading ? '...' : (configHealth?.connected ? 'Conectado' : 'Desconectado')}
          </p>
          {configHealth?.error && <p className="text-xs text-red-400 mt-1 truncate">{configHealth.error}</p>}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            {soapHealth?.connected ? <Wifi className="w-4 h-4 text-green-500" /> : <WifiOff className="w-4 h-4 text-red-500" />}
            SOAP AD Service
          </div>
          <p className={`text-lg font-bold ${soapHealth?.connected ? 'text-green-600' : 'text-red-600'}`}>
            {healthLoading ? '...' : (soapHealth?.connected ? 'Conectado' : 'Desconectado')}
          </p>
          {soapHealth?.message && <p className="text-xs text-gray-400 mt-1 truncate">{soapHealth.message}</p>}
          {soapHealth?.error && <p className="text-xs text-red-400 mt-1 truncate">{soapHealth.error}</p>}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-md transition-colors ${
              activeTab === tab.id
                ? 'bg-white text-purple-700 font-medium shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'workstations' && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Equipos VDI ({workstations.length})</h2>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={showAll}
                onChange={(e) => setShowAll(e.target.checked)}
                className="rounded text-purple-600 focus:ring-purple-500"
              />
              Mostrar inactivas
            </label>
          </div>

          {wLoading ? (
            <div className="p-8"><LoadingSpinner /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    <th className="px-4 py-3 font-medium text-gray-500">ID</th>
                    <th className="px-4 py-3 font-medium text-gray-500">Nombre</th>
                    <th className="px-4 py-3 font-medium text-gray-500">Tipo</th>
                    <th className="px-4 py-3 font-medium text-gray-500">Color</th>
                    <th className="px-4 py-3 font-medium text-gray-500">Estado</th>
                    <th className="px-4 py-3 font-medium text-gray-500">Soporte</th>
                    <th className="px-4 py-3 font-medium text-gray-500 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {workstations.map(w => (
                    <tr key={w.equipo_id} className={`hover:bg-gray-50 ${!w.activo ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3 font-mono text-gray-600">{w.equipo_id}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{w.nombre}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          w.cert_type === 'AZ900'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-orange-100 text-orange-700'
                        }`}>
                          {w.cert_type || 'N/A'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {w.color ? (
                          <div className="flex items-center gap-1.5">
                            <div className="w-4 h-4 rounded" style={{ backgroundColor: w.color }} />
                            <span className="text-gray-500 text-xs font-mono">{w.color}</span>
                          </div>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium ${w.activo ? 'text-green-600' : 'text-gray-400'}`}>
                          {w.activo ? <Power className="w-3 h-3" /> : <PowerOff className="w-3 h-3" />}
                          {w.activo ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{w.soporte ? 'Sí' : 'No'}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleToggle(w.equipo_id, w.activo)}
                          disabled={toggleLoading === w.equipo_id}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                            w.activo
                              ? 'bg-red-50 text-red-600 hover:bg-red-100'
                              : 'bg-green-50 text-green-600 hover:bg-green-100'
                          } disabled:opacity-50`}
                        >
                          {toggleLoading === w.equipo_id ? '...' : (w.activo ? 'Desactivar' : 'Activar')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'ad-users' && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">
              Usuarios AD ({adUsers.length})
              <span className="text-xs font-normal text-gray-400 ml-2">Creados por el EXE legacy</span>
            </h2>
            <button
              onClick={loadAdUsers}
              disabled={adLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${adLoading ? 'animate-spin' : ''}`} />
              Recargar
            </button>
          </div>

          {adError && (
            <div className="mx-4 mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{adError}</div>
          )}

          {adLoading ? (
            <div className="p-8"><LoadingSpinner /></div>
          ) : adUsers.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">No hay usuarios AD activos</div>
          ) : (
            <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
              {adUsers.map((u, i) => (
                <div key={i} className="px-4 py-3">
                  <button
                    onClick={() => {
                      const next = expandedUser === u.sam_account_name ? null : u.sam_account_name;
                      setExpandedUser(next);
                      if (next && !userApps[next]) loadApplications(next);
                    }}
                    className="w-full flex items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 text-xs font-bold">
                        {(u.given_name || u.name || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{u.display_name || u.name || u.sam_account_name}</p>
                        <p className="text-xs text-gray-400">
                          {u.sam_account_name} · {u.subsystem || 'Sin subsistema'}
                          {u.logon_workstations && ` · VDI: ${u.logon_workstations}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {u.day && (
                        <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                          {u.day} {u.begin != null ? `${u.begin}:00-${u.end}:00` : ''}
                        </span>
                      )}
                      {expandedUser === u.sam_account_name ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </div>
                  </button>
                  {expandedUser === u.sam_account_name && (
                    <div className="mt-2 ml-11 p-3 bg-gray-50 rounded-lg text-xs space-y-1">
                      <p><span className="text-gray-500">UPN:</span> {u.user_principal_name || '—'}</p>
                      <p><span className="text-gray-500">Path:</span> {u.path || '—'}</p>
                      <p><span className="text-gray-500">Profile:</span> {u.profile_path || '—'}</p>
                      <p><span className="text-gray-500">Workstations:</span> {u.logon_workstations || '—'}</p>
                      <p><span className="text-gray-500">Expira:</span> {u.expired || '—'}</p>
                      {/* Aplicaciones */}
                      <div className="mt-2 pt-2 border-t border-gray-200">
                        <p className="text-gray-500 font-medium mb-1">Aplicaciones:</p>
                        {appsLoading === u.sam_account_name ? (
                          <p className="text-gray-400 italic">Cargando...</p>
                        ) : userApps[u.sam_account_name] ? (
                          userApps[u.sam_account_name].length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {userApps[u.sam_account_name].map((app, idx) => (
                                <span key={idx} className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full text-xs">{app}</span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-gray-400 italic">Sin aplicaciones</p>
                          )
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); loadApplications(u.sam_account_name); }}
                            className="text-purple-600 hover:text-purple-800 underline"
                          >
                            Ver aplicaciones
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'horarios' && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">
              Horarios por Equipo ({horarios.length})
            </h2>
            <button
              onClick={loadHorarios}
              disabled={horariosLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${horariosLoading ? 'animate-spin' : ''}`} />
              Recargar
            </button>
          </div>

          {horariosLoading ? (
            <div className="p-8"><LoadingSpinner /></div>
          ) : horarios.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">No hay horarios configurados</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    <th className="px-4 py-3 font-medium text-gray-500">Equipo</th>
                    <th className="px-4 py-3 font-medium text-gray-500">Horarios</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {horarios.map((h, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{h.equipo}</td>
                      <td className="px-4 py-3 text-gray-600 font-mono text-xs">{h.horarios}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Completed users tab */}
      {activeTab === 'completed-users' && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">
              Usuarios Completados ({completedUsers.length})
              <span className="text-xs font-normal text-gray-400 ml-2">Marcados como completados en AD</span>
            </h2>
            <button
              onClick={loadCompletedUsers}
              disabled={completedLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${completedLoading ? 'animate-spin' : ''}`} />
              Recargar
            </button>
          </div>

          {completedError && (
            <div className="mx-4 mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{completedError}</div>
          )}

          {completedLoading ? (
            <div className="p-8"><LoadingSpinner /></div>
          ) : completedUsers.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">No hay usuarios completados</div>
          ) : (
            <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
              {completedUsers.map((u, i) => (
                <div key={i} className="px-4 py-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{u.display_name || u.name || u.sam_account_name}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {u.sam_account_name} · {u.subsystem || '—'}
                      {u.logon_workstations && ` · VDI: ${u.logon_workstations}`}
                    </p>
                  </div>
                  {u.day && (
                    <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full whitespace-nowrap">
                      {u.day} {u.begin != null ? `${u.begin}:00-${u.end}:00` : ''}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Expired users tab */}
      {activeTab === 'expired-users' && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">
              Usuarios Expirados ({expiredUsers.length})
              <span className="text-xs font-normal text-gray-400 ml-2">Cuentas AD que han expirado</span>
            </h2>
            <button
              onClick={loadExpiredUsers}
              disabled={expiredLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${expiredLoading ? 'animate-spin' : ''}`} />
              Recargar
            </button>
          </div>

          {expiredError && (
            <div className="mx-4 mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{expiredError}</div>
          )}

          {expiredLoading ? (
            <div className="p-8"><LoadingSpinner /></div>
          ) : expiredUsers.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">No hay usuarios expirados</div>
          ) : (
            <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
              {expiredUsers.map((u, i) => (
                <div key={i} className="px-4 py-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 text-xs font-bold">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{u.display_name || u.name || u.sam_account_name}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {u.sam_account_name} · {u.subsystem || '—'}
                      {u.logon_workstations && ` · VDI: ${u.logon_workstations}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {u.expired && (
                      <span className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full whitespace-nowrap">
                        Expiró: {u.expired}
                      </span>
                    )}
                    {u.day && (
                      <span className="text-xs bg-gray-50 text-gray-500 px-2 py-0.5 rounded-full whitespace-nowrap">
                        {u.day} {u.begin != null ? `${u.begin}:00-${u.end}:00` : ''}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
