/**
 * Página de Analítica de Certificados para Gerencia
 * Muestra KPIs, desglose por tipo, reconciliación financiera,
 * tendencia mensual y tabla de coordinadores.
 */
import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Award,
  DollarSign,
  TrendingUp,
  Users,
  FileText,
  Shield,
  BadgeCheck,
  Download,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Calendar,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  getCertificateAnalytics,
  CertificateAnalytics,
  formatCurrency,
} from '../../services/balanceService';

type DateRange = '7d' | '30d' | '90d' | 'all';

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export default function GerenteCertificadosPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CertificateAnalytics | null>(null);
  const [range, setRange] = useState<DateRange>('all');
  const [refreshing, setRefreshing] = useState(false);

  const dateParams = useMemo(() => {
    if (range === 'all') return {};
    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - (range === '7d' ? 7 : range === '30d' ? 30 : 90));
    return { date_from: from.toISOString().split('T')[0], date_to: now.toISOString().split('T')[0] };
  }, [range]);

  const loadData = async () => {
    try {
      setError(null);
      const result = await getCertificateAnalytics(dateParams);
      setData(result);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar analítica');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { setLoading(true); loadData(); }, [dateParams]);

  const handleRefresh = () => { setRefreshing(true); loadData(); };

  const exportCSV = () => {
    if (!data?.coordinators) return;
    const rows = [['#', 'Coordinador', 'Aprobado', 'Gastado', 'Eficiencia %']];
    data.coordinators.forEach((c, i) => {
      rows.push([String(i + 1), c.coordinator_name, String(c.amount_approved), String(c.amount_spent), String(c.efficiency)]);
    });
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'coordinadores_certificados.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="fluid-px-6 fluid-py-6 max-w-[2800px] mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-fluid-2xl fluid-p-6 text-center">
          <AlertCircle className="fluid-icon-xl text-red-500 mx-auto fluid-mb-4" />
          <h2 className="fluid-text-xl font-semibold text-red-800 fluid-mb-2">Error</h2>
          <p className="text-red-600 fluid-text-base">{error}</p>
          <button onClick={loadData} className="fluid-mt-4 fluid-px-4 fluid-py-2 bg-red-600 text-white rounded-fluid-xl hover:bg-red-700 transition-colors">
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { certificates: cert, financials: fin, pass_fail: pf, monthly_trend: trend, coordinators: coords } = data;

  // Helpers
  const maxTrend = Math.max(...trend.map(t => t.count), 1);
  const certTypes = [
    { label: 'Reporte Evaluación', count: cert.tier_basic, color: 'from-amber-400 to-amber-600', bg: 'bg-amber-100', text: 'text-amber-700' },
    { label: 'Certificado Eduit', count: cert.tier_standard, color: 'from-blue-400 to-blue-600', bg: 'bg-blue-100', text: 'text-blue-700' },
    { label: 'Certificado CONOCER', count: cert.tier_advanced, color: 'from-emerald-400 to-emerald-600', bg: 'bg-emerald-100', text: 'text-emerald-700' },
    { label: 'Insignia Digital', count: cert.digital_badge, color: 'from-purple-400 to-purple-600', bg: 'bg-purple-100', text: 'text-purple-700' },
  ];
  const maxCertType = Math.max(...certTypes.map(t => t.count), 1);
  const maxCoordApproved = Math.max(...coords.map(c => c.amount_approved), 1);

  // Donut gradient
  const spent = fin.total_certification_spent;
  const balance = fin.current_balance;
  const totalPie = spent + balance || 1;
  const spentPct = (spent / totalPie) * 100;
  const donutGradient = `conic-gradient(#f59e0b 0% ${spentPct}%, #10b981 ${spentPct}% 100%)`;

  return (
    <div className="fluid-px-6 fluid-py-6 max-w-[2800px] mx-auto animate-fade-in-up">
      {/* ===== HEADER ===== */}
      <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 rounded-fluid-2xl fluid-p-6 fluid-mb-6 text-white relative overflow-hidden shadow-lg">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full" />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/5 rounded-full" />
        <div className="absolute top-1/2 right-1/4 w-24 h-24 bg-white/5 rounded-full" />

        <div className="relative">
          <div className="flex items-center justify-between fluid-mb-4">
            <div className="flex items-center fluid-gap-4">
              <Link to="/gerente" className="fluid-p-2 bg-white/15 hover:bg-white/25 rounded-fluid-xl transition-all backdrop-blur-sm">
                <ArrowLeft className="fluid-icon-lg text-white" />
              </Link>
              <div className="fluid-p-3 bg-white/15 rounded-fluid-xl backdrop-blur-sm">
                <Award className="fluid-icon-xl text-white" />
              </div>
              <div>
                <h1 className="fluid-text-3xl font-bold text-white">Analítica de Certificados</h1>
                <p className="fluid-text-base text-white/80">Emisión, reconciliación financiera y tendencias</p>
              </div>
            </div>
            <div className="flex items-center fluid-gap-3">
              {/* Date range selector */}
              <div className="flex bg-white/15 rounded-fluid-xl backdrop-blur-sm overflow-hidden">
                {(['7d', '30d', '90d', 'all'] as DateRange[]).map(r => (
                  <button
                    key={r}
                    onClick={() => setRange(r)}
                    className={`fluid-px-3 fluid-py-1.5 fluid-text-xs font-medium transition-all ${
                      range === r ? 'bg-white text-orange-600' : 'text-white/90 hover:bg-white/10'
                    }`}
                  >
                    {r === 'all' ? 'Todo' : r}
                  </button>
                ))}
              </div>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="fluid-p-2.5 bg-white/15 hover:bg-white/25 rounded-fluid-xl transition-all duration-300 hover:scale-105 backdrop-blur-sm"
              >
                <RefreshCw className={`fluid-icon-lg text-white ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ===== 4 KPI CARDS ===== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 fluid-gap-4 fluid-mb-6">
        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200/80 fluid-p-5 group hover:shadow-md transition-all">
          <div className="flex items-center fluid-gap-3 fluid-mb-3">
            <div className="fluid-p-2.5 bg-gradient-to-br from-amber-500 to-orange-500 rounded-fluid-xl shadow-md">
              <Award className="fluid-icon-sm text-white" />
            </div>
            <p className="fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Certificados</p>
          </div>
          <p className="fluid-text-3xl font-bold text-gray-900">{cert.total.toLocaleString()}</p>
          <p className="fluid-text-xs text-gray-400 fluid-mt-1">4 tipos combinados</p>
        </div>

        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200/80 fluid-p-5 group hover:shadow-md transition-all">
          <div className="flex items-center fluid-gap-3 fluid-mb-3">
            <div className="fluid-p-2.5 bg-gradient-to-br from-green-500 to-emerald-500 rounded-fluid-xl shadow-md">
              <DollarSign className="fluid-icon-sm text-white" />
            </div>
            <p className="fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider">Fondos Aprobados</p>
          </div>
          <p className="fluid-text-3xl font-bold text-gray-900">{formatCurrency(fin.total_approved)}</p>
          <p className="fluid-text-xs text-gray-400 fluid-mt-1">Solicitudes aprobadas</p>
        </div>

        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200/80 fluid-p-5 group hover:shadow-md transition-all">
          <div className="flex items-center fluid-gap-3 fluid-mb-3">
            <div className="fluid-p-2.5 bg-gradient-to-br from-amber-400 to-amber-600 rounded-fluid-xl shadow-md">
              <TrendingUp className="fluid-icon-sm text-white" />
            </div>
            <p className="fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider">Gasto Certificaciones</p>
          </div>
          <p className="fluid-text-3xl font-bold text-gray-900">{formatCurrency(fin.total_certification_spent)}</p>
          <p className="fluid-text-xs text-gray-400 fluid-mt-1">{fin.utilization_rate.toFixed(1)}% utilización</p>
        </div>

        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200/80 fluid-p-5 group hover:shadow-md transition-all">
          <div className="flex items-center fluid-gap-3 fluid-mb-3">
            <div className="fluid-p-2.5 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-fluid-xl shadow-md">
              <CheckCircle2 className="fluid-icon-sm text-white" />
            </div>
            <p className="fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider">Tasa Aprobación</p>
          </div>
          <p className="fluid-text-3xl font-bold text-gray-900">{pf.pass_rate.toFixed(1)}%</p>
          <p className="fluid-text-xs text-gray-400 fluid-mt-1">{pf.total_passed} de {pf.total_completed} evaluaciones</p>
        </div>
      </div>

      {/* ===== SECCIÓN 2: DESGLOSE + RECONCILIACIÓN ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 fluid-gap-6 fluid-mb-6">
        {/* Desglose por tipo */}
        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200/80 overflow-hidden">
          <div className="fluid-p-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
            <h2 className="fluid-text-lg font-semibold text-gray-900 flex items-center fluid-gap-2">
              <FileText className="fluid-icon-sm text-amber-500" />
              Desglose por Tipo
            </h2>
          </div>
          <div className="fluid-p-5 space-y-4">
            {certTypes.map(ct => (
              <div key={ct.label}>
                <div className="flex items-center justify-between fluid-mb-1.5">
                  <span className="fluid-text-sm font-medium text-gray-700">{ct.label}</span>
                  <span className={`fluid-text-sm font-bold ${ct.text}`}>{ct.count.toLocaleString()}</span>
                </div>
                <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full bg-gradient-to-r ${ct.color} rounded-full transition-all duration-700`}
                    style={{ width: `${(ct.count / maxCertType) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            <div className="fluid-pt-3 border-t border-gray-100 flex items-center justify-between">
              <span className="fluid-text-sm font-semibold text-gray-600">Total</span>
              <span className="fluid-text-lg font-bold text-gray-900">{cert.total.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Reconciliación financiera */}
        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200/80 overflow-hidden">
          <div className="fluid-p-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
            <h2 className="fluid-text-lg font-semibold text-gray-900 flex items-center fluid-gap-2">
              <DollarSign className="fluid-icon-sm text-emerald-500" />
              Reconciliación Financiera
            </h2>
          </div>
          <div className="fluid-p-5 flex items-center fluid-gap-6">
            {/* Donut */}
            <div className="relative flex-shrink-0">
              <div
                className="w-36 h-36 rounded-full"
                style={{ background: donutGradient }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-24 h-24 bg-white rounded-full flex flex-col items-center justify-center shadow-inner">
                  <p className="fluid-text-xl font-bold text-gray-900">{fin.utilization_rate.toFixed(0)}%</p>
                  <p className="fluid-text-xs text-gray-500">Utilización</p>
                </div>
              </div>
            </div>
            {/* Legend */}
            <div className="flex-1 space-y-3">
              <div className="flex items-center fluid-gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-500 flex-shrink-0" />
                <div className="flex-1">
                  <p className="fluid-text-xs text-gray-500">Gastado en certificaciones</p>
                  <p className="fluid-text-sm font-bold text-gray-800">{formatCurrency(spent)}</p>
                </div>
              </div>
              <div className="flex items-center fluid-gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500 flex-shrink-0" />
                <div className="flex-1">
                  <p className="fluid-text-xs text-gray-500">Saldo restante</p>
                  <p className="fluid-text-sm font-bold text-gray-800">{formatCurrency(balance)}</p>
                </div>
              </div>
              <div className="fluid-pt-2 border-t border-gray-100">
                <p className="fluid-text-xs text-gray-500">Total aprobado</p>
                <p className="fluid-text-base font-bold text-gray-900">{formatCurrency(fin.total_approved)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== SECCIÓN 3: PASS/FAIL + TENDENCIA ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 fluid-gap-6 fluid-mb-6">
        {/* Pass / Fail */}
        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200/80 overflow-hidden">
          <div className="fluid-p-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
            <h2 className="fluid-text-lg font-semibold text-gray-900 flex items-center fluid-gap-2">
              <Shield className="fluid-icon-sm text-blue-500" />
              Resultados de Evaluación
            </h2>
          </div>
          <div className="fluid-p-5">
            {/* Stacked horizontal bar */}
            <div className="fluid-mb-4">
              <div className="flex w-full h-8 rounded-full overflow-hidden bg-gray-100">
                {pf.total_completed > 0 ? (
                  <>
                    <div
                      className="bg-gradient-to-r from-green-400 to-green-600 flex items-center justify-center transition-all duration-700"
                      style={{ width: `${(pf.total_passed / pf.total_completed) * 100}%` }}
                    >
                      {pf.total_passed > 0 && (
                        <span className="text-white fluid-text-xs font-bold">{pf.total_passed}</span>
                      )}
                    </div>
                    <div
                      className="bg-gradient-to-r from-red-400 to-red-600 flex items-center justify-center transition-all duration-700"
                      style={{ width: `${(pf.total_failed / pf.total_completed) * 100}%` }}
                    >
                      {pf.total_failed > 0 && (
                        <span className="text-white fluid-text-xs font-bold">{pf.total_failed}</span>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="w-full flex items-center justify-center text-gray-400 fluid-text-xs">Sin datos</div>
                )}
              </div>
            </div>
            {/* Stats grid */}
            <div className="grid grid-cols-3 fluid-gap-3">
              <div className="text-center fluid-p-3 bg-gray-50 rounded-fluid-xl">
                <Users className="fluid-icon-sm text-gray-400 mx-auto fluid-mb-1" />
                <p className="fluid-text-xl font-bold text-gray-800">{pf.total_completed}</p>
                <p className="fluid-text-xs text-gray-500">Evaluados</p>
              </div>
              <div className="text-center fluid-p-3 bg-green-50 rounded-fluid-xl">
                <CheckCircle2 className="fluid-icon-sm text-green-500 mx-auto fluid-mb-1" />
                <p className="fluid-text-xl font-bold text-green-700">{pf.total_passed}</p>
                <p className="fluid-text-xs text-green-600">Aprobados</p>
              </div>
              <div className="text-center fluid-p-3 bg-red-50 rounded-fluid-xl">
                <XCircle className="fluid-icon-sm text-red-500 mx-auto fluid-mb-1" />
                <p className="fluid-text-xl font-bold text-red-700">{pf.total_failed}</p>
                <p className="fluid-text-xs text-red-600">Reprobados</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tendencia mensual */}
        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200/80 overflow-hidden">
          <div className="fluid-p-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
            <h2 className="fluid-text-lg font-semibold text-gray-900 flex items-center fluid-gap-2">
              <Calendar className="fluid-icon-sm text-orange-500" />
              Tendencia Mensual
            </h2>
          </div>
          <div className="fluid-p-5">
            {trend.length === 0 ? (
              <div className="text-center fluid-py-8 text-gray-500">
                <TrendingUp className="fluid-icon-xl mx-auto fluid-mb-2 text-gray-300" />
                <p className="fluid-text-sm">Sin datos de tendencia</p>
              </div>
            ) : (
              <div className="flex items-end justify-between fluid-gap-2" style={{ height: '160px' }}>
                {trend.map((m, i) => {
                  const pct = (m.count / maxTrend) * 100;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                      <span className="fluid-text-xs font-bold text-gray-700 fluid-mb-1">{m.count}</span>
                      <div
                        className="w-full bg-gradient-to-t from-orange-500 to-amber-400 rounded-t-lg transition-all duration-700 min-h-[4px]"
                        style={{ height: `${Math.max(pct, 3)}%` }}
                      />
                      <span className="fluid-text-xs text-gray-500 fluid-mt-2">{MONTH_NAMES[m.month - 1]}</span>
                      <span className="fluid-text-xs text-gray-400">{m.year}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== SECCIÓN 4: TABLA COORDINADORES ===== */}
      <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200/80 overflow-hidden">
        <div className="fluid-p-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white flex items-center justify-between">
          <h2 className="fluid-text-lg font-semibold text-gray-900 flex items-center fluid-gap-2">
            <Users className="fluid-icon-sm text-purple-500" />
            Coordinadores — Fondos vs Gasto
          </h2>
          <button
            onClick={exportCSV}
            className="flex items-center fluid-gap-1.5 fluid-px-3 fluid-py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-fluid-xl fluid-text-xs font-medium transition-colors"
          >
            <Download className="fluid-icon-xs" />
            CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          {coords.length === 0 ? (
            <div className="text-center fluid-py-10 text-gray-500">
              <Users className="fluid-icon-xl mx-auto fluid-mb-3 text-gray-300" />
              <p className="fluid-text-sm">Sin datos de coordinadores</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-100">
                  <th className="fluid-px-4 fluid-py-3 text-left fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider">#</th>
                  <th className="fluid-px-4 fluid-py-3 text-left fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider">Coordinador</th>
                  <th className="fluid-px-4 fluid-py-3 text-right fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider">Aprobado</th>
                  <th className="fluid-px-4 fluid-py-3 text-left fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider w-48">Distribución</th>
                  <th className="fluid-px-4 fluid-py-3 text-right fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider">Gastado</th>
                  <th className="fluid-px-4 fluid-py-3 text-right fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider">Eficiencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {coords.map((c, i) => {
                  const barWidth = (c.amount_approved / maxCoordApproved) * 100;
                  const spentWidth = c.amount_approved > 0 ? (c.amount_spent / c.amount_approved) * 100 : 0;
                  return (
                    <tr key={c.coordinator_id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="fluid-px-4 fluid-py-3 fluid-text-sm text-gray-400 font-medium">{i + 1}</td>
                      <td className="fluid-px-4 fluid-py-3">
                        <p className="fluid-text-sm font-medium text-gray-800 truncate max-w-[200px]">{c.coordinator_name}</p>
                      </td>
                      <td className="fluid-px-4 fluid-py-3 text-right">
                        <span className="fluid-text-sm font-semibold text-gray-800">{formatCurrency(c.amount_approved)}</span>
                      </td>
                      <td className="fluid-px-4 fluid-py-3">
                        <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden" title={`${spentWidth.toFixed(0)}% gastado`}>
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${barWidth}%`,
                              background: `linear-gradient(to right, #f59e0b ${spentWidth}%, #d1d5db ${spentWidth}%)`,
                            }}
                          />
                        </div>
                      </td>
                      <td className="fluid-px-4 fluid-py-3 text-right">
                        <span className="fluid-text-sm font-semibold text-amber-600">{formatCurrency(c.amount_spent)}</span>
                      </td>
                      <td className="fluid-px-4 fluid-py-3 text-right">
                        <span className={`inline-block fluid-px-2 fluid-py-0.5 rounded-full fluid-text-xs font-bold ${
                          c.efficiency >= 80 ? 'bg-green-100 text-green-700'
                          : c.efficiency >= 50 ? 'bg-amber-100 text-amber-700'
                          : c.efficiency > 0 ? 'bg-red-100 text-red-700'
                          : 'bg-gray-100 text-gray-500'
                        }`}>
                          {c.efficiency.toFixed(0)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
