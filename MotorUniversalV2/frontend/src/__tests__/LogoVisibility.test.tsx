/**
 * Tests de Visibilidad del Logo del Campus
 * ==========================================
 *
 * Verifica los cambios de visibilidad del logo implementados:
 *
 *   A. Navbar: muestra logo del campus junto al nombre (responsable y candidato)
 *      - Logo con clase responsive clamp (1.75rem a 2.75rem)
 *      - Separador border-l entre logo Evaluaasi y logo campus
 *      - No muestra logo cuando no hay logo_url
 *   B. ResponsableDashboard hero: logo con h-16 y p-1.5
 *   C. MiPlantelReportesPage header: logo con h-10
 *   D. HomePage hero (candidato): ver CandidatoBranding.test.tsx
 *
 * Ejecutar:
 *   cd frontend && npx vitest run src/__tests__/LogoVisibility.test.tsx
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ─── Polyfills para jsdom ──────────────────────────────────────────────────

beforeAll(() => {
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as any;
  }
});

// ─── Mocks ─────────────────────────────────────────────────────────────────

const mockGetMiPlantel = vi.fn();
const mockGetMiPlantelDashboardAdvanced = vi.fn();
const mockGetMiPlantelEvaluations = vi.fn();
const mockGetMiPlantelExams = vi.fn();
const mockGetMiPlantelGroups = vi.fn();
const mockExportMiPlantelEvaluations = vi.fn();
const mockGetCandidatoBranding = vi.fn();

vi.mock('../services/partnersService', () => ({
  getMiPlantel: (...args: unknown[]) => mockGetMiPlantel(...args),
  getMiPlantelDashboardAdvanced: (...args: unknown[]) => mockGetMiPlantelDashboardAdvanced(...args),
  getMiPlantelEvaluations: (...args: unknown[]) => mockGetMiPlantelEvaluations(...args),
  getMiPlantelExams: (...args: unknown[]) => mockGetMiPlantelExams(...args),
  getMiPlantelGroups: (...args: unknown[]) => mockGetMiPlantelGroups(...args),
  exportMiPlantelEvaluations: (...args: unknown[]) => mockExportMiPlantelEvaluations(...args),
  getCandidatoBranding: (...args: unknown[]) => mockGetCandidatoBranding(...args),
}));

const mockUseAuthStore = vi.fn();
vi.mock('../store/authStore', () => ({
  useAuthStore: () => mockUseAuthStore(),
  clearAllCache: vi.fn(),
}));

vi.mock('../services/authService', () => ({
  authService: { logout: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../services/supportChatService', () => ({
  supportChatService: { getUnreadCount: vi.fn().mockResolvedValue(0) },
}));

vi.mock('../components/ExamInProgressWidget', () => ({
  default: () => null,
}));

vi.mock('../components/LoadingSpinner', () => ({
  default: () => <div data-testid="loading-spinner">Cargando...</div>,
}));



// ─── Datos de prueba ───────────────────────────────────────────────────────

const RESPONSABLE_USER = {
  id: 'resp-1',
  email: 'responsable@test.com',
  username: 'responsable1',
  name: 'María',
  first_surname: 'García',
  full_name: 'María García',
  role: 'responsable' as const,
  is_active: true,
  is_verified: true,
  created_at: '2024-01-01',
  can_view_reports: true,
};

const CANDIDATO_USER = {
  id: 'cand-1',
  email: 'candidato@test.com',
  username: 'candidato1',
  name: 'Carlos',
  first_surname: 'López',
  full_name: 'Carlos López',
  role: 'candidato' as const,
  is_active: true,
  is_verified: true,
  created_at: '2024-01-01',
};

const MOCK_PLANTEL_WITH_BRANDING = {
  campus: {
    id: 10,
    name: 'Campus Monterrey',
    code: 'MTY-001',
    logo_url: 'https://storage.example.com/logos/campus-mty.png',
    primary_color: '#e11d48',
    secondary_color: '#7c3aed',
    state_name: 'Nuevo León',
    city: 'Monterrey',
    partner_id: 1,
    responsable_id: 'resp-1',
    is_active: true,
  },
  group_count: 3,
  members_count: 50,
};

const MOCK_PLANTEL_WITHOUT_LOGO = {
  campus: {
    ...MOCK_PLANTEL_WITH_BRANDING.campus,
    logo_url: null,
    secondary_color: null,
  },
  group_count: 3,
  members_count: 50,
};

const MOCK_DASHBOARD_DATA = {
  campus: { id: 10, name: 'Campus Monterrey', code: 'MTY-001' },
  stats: {
    total_candidates: 50, total_groups: 3, total_evaluations: 100,
    passed_evaluations: 85, failed_evaluations: 15, approval_rate: 85,
    average_score: 82, certification_rate: 70,
  },
  charts: {
    approval_by_group: [],
    scores_by_group: [],
    score_distribution: [],
    evaluations_over_time: [],
    material_progress_by_group: [],
    certification_by_type: { constancia_eduit: 10, certificado_eduit: 5, certificado_conocer: 3, insignia_digital: 2 },
  },
};

const MOCK_BRANDING_FULL = {
  branding: {
    campus_name: 'Campus Guadalajara',
    logo_url: 'https://storage.example.com/logos/campus-gdl.png',
    primary_color: '#059669',
    secondary_color: '#7c3aed',
  },
};

const MOCK_BRANDING_WITHOUT_LOGO = {
  branding: {
    campus_name: 'Campus Veracruz',
    logo_url: null,
    primary_color: '#e11d48',
    secondary_color: null,
  },
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
}

function renderWithProviders(ui: React.ReactElement, { route = '/' } = {}) {
  const qc = createQueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[route]}>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>
  );
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('Visibilidad del Logo del Campus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: responsable con branding completo
    mockUseAuthStore.mockReturnValue({
      user: RESPONSABLE_USER,
      logout: vi.fn(),
    });
    mockGetMiPlantel.mockResolvedValue(MOCK_PLANTEL_WITH_BRANDING);
    mockGetMiPlantelDashboardAdvanced.mockResolvedValue(MOCK_DASHBOARD_DATA);
    mockGetMiPlantelEvaluations.mockResolvedValue({ evaluations: [], total: 0, pages: 0 });
    mockGetMiPlantelExams.mockResolvedValue({ exams: [] });
    mockGetMiPlantelGroups.mockResolvedValue({ groups: [] });
    mockGetCandidatoBranding.mockResolvedValue({ branding: null });

  });

  afterEach(() => {
    const root = document.documentElement;
    ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900'].forEach(s => {
      root.style.removeProperty(`--color-primary-${s}`);
      root.style.removeProperty(`--color-secondary-${s}`);
    });
    document.title = 'Evaluaasi - Plataforma de Evaluación y Certificación';
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (link) link.href = '/logo.png';
  });

  // ═══════════════════════════════════════════════════════════════════════
  // A. NAVBAR: Logo del campus junto al nombre (responsable)
  // ═══════════════════════════════════════════════════════════════════════

  describe('A. Navbar — logo del campus para responsable', () => {
    it('A1. Muestra logo del campus en el navbar cuando existe', async () => {
      const Layout = (await import('../components/layout/Layout')).default;

      renderWithProviders(
        <Routes>
          <Route element={<Layout />}>
            <Route path="*" element={<div>Dashboard</div>} />
          </Route>
        </Routes>,
        { route: '/dashboard' }
      );

      await waitFor(() => {
        const imgs = screen.getAllByRole('img');
        const campusLogo = imgs.find(
          img => img.getAttribute('src') === MOCK_PLANTEL_WITH_BRANDING.campus.logo_url
        );
        expect(campusLogo).toBeDefined();
        expect(campusLogo).toHaveAttribute('alt', 'Campus Monterrey');
      });
    });

    it('A2. Logo del campus usa tamaño responsive', async () => {
      const Layout = (await import('../components/layout/Layout')).default;

      renderWithProviders(
        <Routes>
          <Route element={<Layout />}>
            <Route path="*" element={<div>Dashboard</div>} />
          </Route>
        </Routes>,
        { route: '/dashboard' }
      );

      await waitFor(() => {
        const imgs = screen.getAllByRole('img');
        const campusLogo = imgs.find(
          img => img.getAttribute('src') === MOCK_PLANTEL_WITH_BRANDING.campus.logo_url
        );
        expect(campusLogo).toBeDefined();
        expect(campusLogo?.className).toContain('max-w-full');
        expect(campusLogo?.className).toContain('max-h-full');
        expect(campusLogo?.className).toContain('object-contain');
      });
    });

    it('A3. Separador visual entre logo Evaluaasi y logo campus', async () => {
      const Layout = (await import('../components/layout/Layout')).default;

      renderWithProviders(
        <Routes>
          <Route element={<Layout />}>
            <Route path="*" element={<div>Dashboard</div>} />
          </Route>
        </Routes>,
        { route: '/dashboard' }
      );

      await waitFor(() => {
        const imgs = screen.getAllByRole('img');
        const campusLogo = imgs.find(
          img => img.getAttribute('src') === MOCK_PLANTEL_WITH_BRANDING.campus.logo_url
        );
        expect(campusLogo).toBeDefined();
        // El contenedor padre debe tener border-l como separador
        const container = campusLogo?.closest('.border-l');
        expect(container).toBeTruthy();
        expect(container?.className).toContain('border-gray-200');
      });
    });

    it('A4. NO muestra logo del campus cuando no hay logo_url', async () => {
      mockGetMiPlantel.mockResolvedValue(MOCK_PLANTEL_WITHOUT_LOGO);

      const Layout = (await import('../components/layout/Layout')).default;

      renderWithProviders(
        <Routes>
          <Route element={<Layout />}>
            <Route path="*" element={<div>Dashboard</div>} />
          </Route>
        </Routes>,
        { route: '/dashboard' }
      );

      // Esperar a que el nombre del campus aparezca (el branding está activo)
      await waitFor(() => {
        expect(screen.getByText('Campus Monterrey')).toBeInTheDocument();
      });

      // Pero no debe haber imagen del campus
      const imgs = screen.queryAllByRole('img');
      const campusLogo = imgs.find(
        img => img.getAttribute('src') === MOCK_PLANTEL_WITH_BRANDING.campus.logo_url
      );
      expect(campusLogo).toBeUndefined();
    });

    it('A5. Logo Evaluaasi sigue presente junto al logo campus', async () => {
      const Layout = (await import('../components/layout/Layout')).default;

      renderWithProviders(
        <Routes>
          <Route element={<Layout />}>
            <Route path="*" element={<div>Dashboard</div>} />
          </Route>
        </Routes>,
        { route: '/dashboard' }
      );

      await waitFor(() => {
        const imgs = screen.getAllByRole('img');
        const evaluaasiLogo = imgs.find(img => img.getAttribute('alt') === 'Evaluaasi');
        const campusLogo = imgs.find(
          img => img.getAttribute('src') === MOCK_PLANTEL_WITH_BRANDING.campus.logo_url
        );
        // Ambos logos deben coexistir
        expect(evaluaasiLogo).toBeInTheDocument();
        expect(campusLogo).toBeDefined();
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // A-bis. NAVBAR: Logo del campus para candidato
  // ═══════════════════════════════════════════════════════════════════════

  describe('A-bis. Navbar — logo del campus para candidato', () => {
    beforeEach(() => {
      mockUseAuthStore.mockReturnValue({
        user: CANDIDATO_USER,
        logout: vi.fn(),
      });
      mockGetCandidatoBranding.mockResolvedValue(MOCK_BRANDING_FULL);
      mockGetMiPlantel.mockResolvedValue({ campus: null, group_count: 0, members_count: 0 });
    });

    it('A-bis1. Muestra logo del campus en navbar para candidato', async () => {
      const Layout = (await import('../components/layout/Layout')).default;

      renderWithProviders(
        <Routes>
          <Route element={<Layout />}>
            <Route path="*" element={<div>Dashboard</div>} />
          </Route>
        </Routes>,
        { route: '/dashboard' }
      );

      await waitFor(() => {
        const imgs = screen.getAllByRole('img');
        const campusLogo = imgs.find(
          img => img.getAttribute('src') === MOCK_BRANDING_FULL.branding.logo_url
        );
        expect(campusLogo).toBeDefined();
        expect(campusLogo).toHaveAttribute('alt', 'Campus Guadalajara');
      });
    });

    it('A-bis2. Logo del campus para candidato usa tamaño responsive', async () => {
      const Layout = (await import('../components/layout/Layout')).default;

      renderWithProviders(
        <Routes>
          <Route element={<Layout />}>
            <Route path="*" element={<div>Dashboard</div>} />
          </Route>
        </Routes>,
        { route: '/dashboard' }
      );

      await waitFor(() => {
        const imgs = screen.getAllByRole('img');
        const campusLogo = imgs.find(
          img => img.getAttribute('src') === MOCK_BRANDING_FULL.branding.logo_url
        );
        expect(campusLogo).toBeDefined();
        expect(campusLogo?.className).toContain('max-w-full');
        expect(campusLogo?.className).toContain('max-h-full');
      });
    });

    it('A-bis3. NO muestra logo del campus para candidato sin logo_url', async () => {
      mockGetCandidatoBranding.mockResolvedValue(MOCK_BRANDING_WITHOUT_LOGO);

      const Layout = (await import('../components/layout/Layout')).default;

      renderWithProviders(
        <Routes>
          <Route element={<Layout />}>
            <Route path="*" element={<div>Dashboard</div>} />
          </Route>
        </Routes>,
        { route: '/dashboard' }
      );

      await waitFor(() => {
        expect(screen.getByText('Campus Veracruz')).toBeInTheDocument();
      });

      const imgs = screen.queryAllByRole('img');
      const campusLogo = imgs.find(
        img => img.getAttribute('src') === MOCK_BRANDING_FULL.branding.logo_url
      );
      expect(campusLogo).toBeUndefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // B. RESPONSABLE DASHBOARD: Logo en hero con h-16
  // ═══════════════════════════════════════════════════════════════════════

  describe('B. ResponsableDashboard — logo del campus en hero', () => {
    it('B1. Logo del campus en hero usa h-16 (tamaño aumentado)', async () => {
      const ResponsableDashboard = (await import('../pages/responsable/ResponsableDashboard')).default;

      renderWithProviders(<ResponsableDashboard />, { route: '/dashboard' });

      await waitFor(() => {
        const imgs = screen.getAllByRole('img');
        const campusLogo = imgs.find(
          img => img.getAttribute('src') === MOCK_PLANTEL_WITH_BRANDING.campus.logo_url
        );
        expect(campusLogo).toBeDefined();
        expect(campusLogo?.className).toContain('h-16');
      });
    });

    it('B2. Logo del campus en hero tiene padding adecuado (p-1.5)', async () => {
      const ResponsableDashboard = (await import('../pages/responsable/ResponsableDashboard')).default;

      renderWithProviders(<ResponsableDashboard />, { route: '/dashboard' });

      await waitFor(() => {
        const imgs = screen.getAllByRole('img');
        const campusLogo = imgs.find(
          img => img.getAttribute('src') === MOCK_PLANTEL_WITH_BRANDING.campus.logo_url
        );
        expect(campusLogo).toBeDefined();
        expect(campusLogo?.className).toContain('p-1.5');
      });
    });

    it('B3. Logo del campus en hero tiene rounded-lg y bg-white/10', async () => {
      const ResponsableDashboard = (await import('../pages/responsable/ResponsableDashboard')).default;

      renderWithProviders(<ResponsableDashboard />, { route: '/dashboard' });

      await waitFor(() => {
        const imgs = screen.getAllByRole('img');
        const campusLogo = imgs.find(
          img => img.getAttribute('src') === MOCK_PLANTEL_WITH_BRANDING.campus.logo_url
        );
        expect(campusLogo).toBeDefined();
        expect(campusLogo?.className).toContain('rounded-lg');
        expect(campusLogo?.className).toContain('bg-white/10');
      });
    });

    it('B4. No muestra logo en hero cuando no hay logo_url', async () => {
      mockGetMiPlantel.mockResolvedValue(MOCK_PLANTEL_WITHOUT_LOGO);

      const ResponsableDashboard = (await import('../pages/responsable/ResponsableDashboard')).default;

      renderWithProviders(<ResponsableDashboard />, { route: '/dashboard' });

      await waitFor(() => {
        expect(screen.getByText('Campus Monterrey')).toBeInTheDocument();
      });

      const imgs = screen.queryAllByRole('img');
      const campusLogo = imgs.find(
        img => img.getAttribute('src') === MOCK_PLANTEL_WITH_BRANDING.campus.logo_url
      );
      expect(campusLogo).toBeUndefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // C. REPORTES: Logo en header con h-10
  // ═══════════════════════════════════════════════════════════════════════

  describe('C. MiPlantelReportesPage — logo del campus en header', () => {
    it('C1. Logo del campus en header usa h-10 (tamaño aumentado)', async () => {
      const MiPlantelReportesPage = (await import('../pages/responsable/MiPlantelReportesPage')).default;

      renderWithProviders(
        <Routes>
          <Route path="/mi-plantel/reportes" element={<MiPlantelReportesPage />} />
        </Routes>,
        { route: '/mi-plantel/reportes' }
      );

      await waitFor(() => {
        expect(screen.getByText('Reportes de Evaluaciones')).toBeInTheDocument();
      });

      const imgs = screen.queryAllByRole('img');
      const campusLogo = imgs.find(
        img => img.getAttribute('src') === MOCK_PLANTEL_WITH_BRANDING.campus.logo_url
      );
      expect(campusLogo).toBeDefined();
      expect(campusLogo?.className).toContain('h-10');
    });

    it('C2. Logo del campus en header tiene object-contain', async () => {
      const MiPlantelReportesPage = (await import('../pages/responsable/MiPlantelReportesPage')).default;

      renderWithProviders(
        <Routes>
          <Route path="/mi-plantel/reportes" element={<MiPlantelReportesPage />} />
        </Routes>,
        { route: '/mi-plantel/reportes' }
      );

      await waitFor(() => {
        expect(screen.getByText('Reportes de Evaluaciones')).toBeInTheDocument();
      });

      const imgs = screen.queryAllByRole('img');
      const campusLogo = imgs.find(
        img => img.getAttribute('src') === MOCK_PLANTEL_WITH_BRANDING.campus.logo_url
      );
      expect(campusLogo).toBeDefined();
      expect(campusLogo?.className).toContain('object-contain');
    });

    it('C3. No muestra logo en header cuando no hay logo_url', async () => {
      mockGetMiPlantel.mockResolvedValue(MOCK_PLANTEL_WITHOUT_LOGO);

      const MiPlantelReportesPage = (await import('../pages/responsable/MiPlantelReportesPage')).default;

      renderWithProviders(
        <Routes>
          <Route path="/mi-plantel/reportes" element={<MiPlantelReportesPage />} />
        </Routes>,
        { route: '/mi-plantel/reportes' }
      );

      await waitFor(() => {
        expect(screen.getByText('Reportes de Evaluaciones')).toBeInTheDocument();
      });

      const imgs = screen.queryAllByRole('img');
      const campusLogo = imgs.find(
        img => img.getAttribute('src') === MOCK_PLANTEL_WITH_BRANDING.campus.logo_url
      );
      expect(campusLogo).toBeUndefined();
    });
  });

});
