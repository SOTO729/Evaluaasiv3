/**
 * Página principal del plantel para el responsable
 * Muestra estadísticas, candidatos y acceso a reportes
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  getMiPlantel, 
  getMiPlantelStats, 
  getMiPlantelGroups,
  MiPlantelStats,
  Campus,
  CandidateGroup
} from '../../services/partnersService';
import LoadingSpinner from '../../components/LoadingSpinner';

const MiPlantelPage = () => {
  const [campus, setCampus] = useState<Campus | null>(null);
  const [stats, setStats] = useState<MiPlantelStats['stats'] | null>(null);
  const [groups, setGroups] = useState<CandidateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [plantelRes, statsRes, groupsRes] = await Promise.all([
        getMiPlantel(),
        getMiPlantelStats(),
        getMiPlantelGroups()
      ]);
      
      setCampus(plantelRes.campus);
      setStats(statsRes.stats);
      setGroups(groupsRes.groups);
    } catch (err: any) {
      console.error('Error loading plantel data:', err);
      setError(err.response?.data?.error || 'Error al cargar los datos del plantel');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Cargando información del plantel..." fullScreen />;
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={loadData}
            className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{campus?.name || 'Mi Plantel'}</h1>
            <p className="text-gray-600 mt-1">
              <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">{campus?.code}</span>
              {campus?.city && campus?.state_name && (
                <span className="ml-3">{campus.city}, {campus.state_name}</span>
              )}
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              to="/mi-plantel/reportes"
              className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Ver Reportes
            </Link>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Candidatos */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-600">Candidatos</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.total_candidates || 0}</p>
            </div>
          </div>
        </div>

        {/* Grupos */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-600">Grupos</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.total_groups || 0}</p>
            </div>
          </div>
        </div>

        {/* Evaluaciones Completadas */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-600">Evaluaciones</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.total_evaluations || 0}</p>
            </div>
          </div>
        </div>

        {/* Certificados */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-600">Certificados</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.candidates_certified || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Estadísticas Detalladas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Rendimiento */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Rendimiento de Evaluaciones</h2>
          <div className="space-y-4">
            {/* Tasa de Aprobación */}
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Tasa de Aprobación</span>
                <span className="font-semibold text-gray-900">{stats?.approval_rate || 0}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-green-500 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${stats?.approval_rate || 0}%` }}
                ></div>
              </div>
            </div>
            
            {/* Calificación Promedio */}
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Calificación Promedio</span>
                <span className="font-semibold text-gray-900">{stats?.average_score || 0}/100</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-blue-500 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${stats?.average_score || 0}%` }}
                ></div>
              </div>
            </div>

            {/* Estadísticas de evaluaciones */}
            <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{stats?.passed_evaluations || 0}</p>
                <p className="text-sm text-gray-600">Aprobadas</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">{stats?.failed_evaluations || 0}</p>
                <p className="text-sm text-gray-600">Reprobadas</p>
              </div>
            </div>
          </div>
        </div>

        {/* Progreso de Materiales */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Progreso en Materiales</h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Avance General</span>
                <span className="font-semibold text-gray-900">{stats?.material_completion_rate || 0}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-purple-500 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${stats?.material_completion_rate || 0}%` }}
                ></div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t">
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-600">{stats?.completed_material_progress || 0}</p>
                <p className="text-sm text-gray-600">Completados</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-400">{(stats?.total_material_progress || 0) - (stats?.completed_material_progress || 0)}</p>
                <p className="text-sm text-gray-600">Pendientes</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lista de Grupos */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Grupos del Plantel</h2>
        
        {groups.length === 0 ? (
          <div className="text-center py-8">
            <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <p className="text-gray-600">No hay grupos activos en el plantel</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groups.map(group => (
              <div 
                key={group.id} 
                className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">{group.name}</h3>
                    <p className="text-sm text-gray-600">
                      {group.member_count || 0} candidatos
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Configuración del Plantel */}
      {campus && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Configuración del Plantel</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${campus.enable_tier_basic ? 'bg-green-500' : 'bg-gray-300'}`}></span>
              <span className="text-sm text-gray-600">Constancia Eduit</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${campus.enable_tier_standard ? 'bg-green-500' : 'bg-gray-300'}`}></span>
              <span className="text-sm text-gray-600">Certificado Eduit</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${campus.enable_tier_advanced ? 'bg-green-500' : 'bg-gray-300'}`}></span>
              <span className="text-sm text-gray-600">Certificado CONOCER</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${campus.enable_digital_badge ? 'bg-green-500' : 'bg-gray-300'}`}></span>
              <span className="text-sm text-gray-600">Insignia Digital</span>
            </div>
          </div>
          
          {campus.license_start_date && campus.license_end_date && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-gray-600">
                <span className="font-medium">Vigencia:</span>{' '}
                {new Date(campus.license_start_date).toLocaleDateString('es-MX')} - {new Date(campus.license_end_date).toLocaleDateString('es-MX')}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MiPlantelPage;
