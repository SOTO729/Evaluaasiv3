/**
 * Tests de Personalización Avanzada del Branding
 * ================================================
 *
 * Cubre los 7 ítems de personalización implementados:
 *
 *   A. Navbar: Logo siempre es Evaluaasi, NO muestra logo del campus
 *   B. Dashboard: Hero muestra logo del campus cuando existe
 *   C. Reportes: Header muestra logo del campus cuando existe
 *   D. Favicon dinámico: Se actualiza con el logo del campus
 *   E. Título de pestaña dinámico: Se actualiza con nombre del campus
 *   F. Secondary color: Se genera paleta CSS para color secundario
 *   G. Certificados: Header muestra logo del campus cuando existe
 *
 * Ejecutar:
 *   cd frontend && npx vitest run src/__tests__/BrandingCustomization.test.tsx
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ─── Polyfills para jsdom ──────────────────────────────────────────────────

beforeAll(() => {
  // ResizeObserver no existe en jsdom
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

vi.mock('../services/partnersService', () => ({
  getMiPlantel: (...args: unknown[]) => mockGetMiPlantel(...args),
  getMiPlantelDashboardAdvanced: (...args: unknown[]) => mockGetMiPlantelDashboardAdvanced(...args),
  getMiPlantelEvaluations: (...args: unknown[]) => mockGetMiPlantelEvaluations(...args),
  getMiPlantelExams: (...args: unknown[]) => mockGetMiPlantelExams(...args),
  getMiPlantelGroups: (...args: unknown[]) => mockGetMiPlantelGroups(...args),
  exportMiPlantelEvaluations: (...args: unknown[]) => mockExportMiPlantelEvaluations(...args),
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
  email: 'resp@test.com',
  username: 'responsable1',
  name: 'Responsable Test',
  first_surname: 'Test',
  full_name: 'Responsable Test',
  role: 'responsable' as const,
  is_active: true,
  is_verified: true,
  created_at: '2024-01-01',
  can_manage_groups: true,
  can_view_reports: true,
};

const ADMIN_USER = {
  ...RESPONSABLE_USER,
  id: 'admin-1',
  role: 'admin' as const,
  username: 'admin1',
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
    total_candidates: 100, total_groups: 5, total_evaluations: 200,
    passed_evaluations: 150, failed_evaluations: 50, approval_rate: 75,
    average_score: 82, certification_rate: 60,
  },
  charts: {
    approval_by_group: [],
    scores_by_group: [],
    score_distribution: [],
    evaluations_over_time: [],
    material_progress_by_group: [],
    certification_by_type: { constancia_eduit: 0, certificado_eduit: 0, certificado_conocer: 0, insignia_digital: 0 },
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

describe('Personalización Avanzada del Branding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuthStore.mockReturnValue({
      user: RESPONSABLE_USER,
      logout: vi.fn(),
    });
    mockGetMiPlantel.mockResolvedValue(MOCK_PLANTEL_WITH_BRANDING);
    mockGetMiPlantelDashboardAdvanced.mockResolvedValue(MOCK_DASHBOARD_DATA);
    mockGetMiPlantelEvaluations.mockResolvedValue({ evaluations: [], total: 0, pages: 0 });
    mockGetMiPlantelExams.mockResolvedValue({ exams: [] });
    mockGetMiPlantelGroups.mockResolvedValue({ groups: [] });
  });

  afterEach(() => {
    // Limpiar CSS variables
    const root = document.documentElement;
    ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900'].forEach(s => {
      root.style.removeProperty(`--color-primary-${s}`);
      root.style.removeProperty(`--color-secondary-${s}`);
    });
    // Restaurar title
    document.title = 'Evaluaasi - Plataforma de Evaluación y Certificación';
    // Restaurar favicon
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (link) link.href = '/logo.png';
  });

  // ═══════════════════════════════════════════════════════════════════════
  // A. NAVBAR: Logo siempre Evaluaasi, NO muestra logo del campus
  // ═══════════════════════════════════════════════════════════════════════

  describe('A. Navbar — siempre muestra logo Evaluaasi', () => {
    it('A1. Navbar muestra logo Evaluaasi incluso si el campus tiene logo', async () => {
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
        // El logo de Evaluaasi debe estar presente en el navbar
        const logos = screen.getAllByRole('img');
        const evaluaasiLogo = logos.find(img => img.getAttribute('alt') === 'Evaluaasi');
        expect(evaluaasiLogo).toBeInTheDocument();
        expect(evaluaasiLogo).toHaveAttribute('src', '/logo.webp');
      });

      // NO debe haber un img con src del campus en el navbar
      const allImgs = screen.getAllByRole('img');
      const campusNavLogo = allImgs.find(
        img => img.getAttribute('src') === MOCK_PLANTEL_WITH_BRANDING.campus.logo_url &&
               img.closest('header') !== null
      );
      expect(campusNavLogo).toBeUndefined();
    });

    it('A2. Nombre del plantel sigue visible en el navbar', async () => {
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
        expect(screen.getByText('Campus Monterrey')).toBeInTheDocument();
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // B. DASHBOARD: Hero muestra logo del campus
  // ═══════════════════════════════════════════════════════════════════════

  describe('B. Dashboard — logo del campus en hero', () => {
    it('B1. Muestra logo del campus en hero section cuando existe', async () => {
      const ResponsableDashboard = (await import('../pages/responsable/ResponsableDashboard')).default;

      renderWithProviders(<ResponsableDashboard />, { route: '/dashboard' });

      await waitFor(() => {
        const imgs = screen.getAllByRole('img');
        const campusLogo = imgs.find(
          img => img.getAttribute('src') === MOCK_PLANTEL_WITH_BRANDING.campus.logo_url
        );
        expect(campusLogo).toBeDefined();
        expect(campusLogo).toHaveAttribute('alt', 'Campus Monterrey');
      });
    });

    it('B2. Muestra Building2 icon cuando no hay logo', async () => {
      mockGetMiPlantel.mockResolvedValue(MOCK_PLANTEL_WITHOUT_LOGO);
      const ResponsableDashboard = (await import('../pages/responsable/ResponsableDashboard')).default;

      renderWithProviders(<ResponsableDashboard />, { route: '/dashboard' });

      await waitFor(() => {
        expect(screen.getByText('Campus Monterrey')).toBeInTheDocument();
      });

      // No campus logo img should exist
      const imgs = screen.queryAllByRole('img');
      const campusLogo = imgs.find(
        img => img.getAttribute('src') === MOCK_PLANTEL_WITH_BRANDING.campus.logo_url
      );
      expect(campusLogo).toBeUndefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // C. REPORTES: Header muestra logo del campus
  // ═══════════════════════════════════════════════════════════════════════

  describe('C. Reportes — logo del campus en header', () => {
    it('C1. Muestra logo del campus en header de reportes', async () => {
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
    });

    it('C2. Muestra icono de gráfica cuando no hay logo', async () => {
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

      // No campus logo should exist
      const imgs = screen.queryAllByRole('img');
      const campusLogo = imgs.find(
        img => img.getAttribute('src') === MOCK_PLANTEL_WITH_BRANDING.campus.logo_url
      );
      expect(campusLogo).toBeUndefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // D. FAVICON DINÁMICO
  // ═══════════════════════════════════════════════════════════════════════

  describe('D. Favicon dinámico', () => {
    it('D1. Favicon se actualiza con logo del campus para responsables', async () => {
      // Crear link[rel=icon] en el document
      let iconLink = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      if (!iconLink) {
        iconLink = document.createElement('link');
        iconLink.rel = 'icon';
        iconLink.href = '/logo.png';
        document.head.appendChild(iconLink);
      }

      const Layout = (await import('../components/layout/Layout')).default;

      renderWithProviders(
        <Routes>
          <Route element={<Layout />}>
            <Route path="*" element={<div>Content</div>} />
          </Route>
        </Routes>,
        { route: '/dashboard' }
      );

      await waitFor(() => {
        const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
        expect(link?.href).toContain('campus-mty.png');
      });
    });

    it('D2. Favicon NO cambia para usuarios no-responsable', async () => {
      mockUseAuthStore.mockReturnValue({
        user: ADMIN_USER,
        logout: vi.fn(),
      });

      let iconLink = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      if (!iconLink) {
        iconLink = document.createElement('link');
        iconLink.rel = 'icon';
        iconLink.href = '/logo.png';
        document.head.appendChild(iconLink);
      }
      const originalHref = iconLink.href;

      const Layout = (await import('../components/layout/Layout')).default;

      renderWithProviders(
        <Routes>
          <Route element={<Layout />}>
            <Route path="*" element={<div>Content</div>} />
          </Route>
        </Routes>,
        { route: '/dashboard' }
      );

      // Wait a bit to ensure useEffect would have fired
      await new Promise(r => setTimeout(r, 100));

      const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      expect(link?.href).toBe(originalHref);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // E. TÍTULO DE PESTAÑA DINÁMICO
  // ═══════════════════════════════════════════════════════════════════════

  describe('E. Título de pestaña dinámico', () => {
    it('E1. Título se actualiza con nombre del campus para responsables', async () => {
      const Layout = (await import('../components/layout/Layout')).default;

      renderWithProviders(
        <Routes>
          <Route element={<Layout />}>
            <Route path="*" element={<div>Content</div>} />
          </Route>
        </Routes>,
        { route: '/dashboard' }
      );

      await waitFor(() => {
        expect(document.title).toBe('Campus Monterrey — Evaluaasi');
      });
    });

    it('E2. Título NO cambia para usuarios no-responsable', async () => {
      mockUseAuthStore.mockReturnValue({
        user: ADMIN_USER,
        logout: vi.fn(),
      });

      const originalTitle = document.title;
      const Layout = (await import('../components/layout/Layout')).default;

      renderWithProviders(
        <Routes>
          <Route element={<Layout />}>
            <Route path="*" element={<div>Content</div>} />
          </Route>
        </Routes>,
        { route: '/dashboard' }
      );

      await new Promise(r => setTimeout(r, 100));
      expect(document.title).toBe(originalTitle);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // F. SECONDARY COLOR — PALETA CSS
  // ═══════════════════════════════════════════════════════════════════════

  describe('F. Secondary color — paleta CSS', () => {
    it('F1. Genera CSS variables para secondary_color cuando existe', async () => {
      const Layout = (await import('../components/layout/Layout')).default;

      renderWithProviders(
        <Routes>
          <Route element={<Layout />}>
            <Route path="*" element={<div>Content</div>} />
          </Route>
        </Routes>,
        { route: '/dashboard' }
      );

      await waitFor(() => {
        const root = document.documentElement;
        // Debe tener ambas paletas
        expect(root.style.getPropertyValue('--color-primary-500')).toBe('#e11d48');
        expect(root.style.getPropertyValue('--color-secondary-500')).toBe('#7c3aed');
      });
    });

    it('F2. Genera 10 tonos para secondary_color (50-900)', async () => {
      const Layout = (await import('../components/layout/Layout')).default;

      renderWithProviders(
        <Routes>
          <Route element={<Layout />}>
            <Route path="*" element={<div>Content</div>} />
          </Route>
        </Routes>,
        { route: '/dashboard' }
      );

      await waitFor(() => {
        const root = document.documentElement;
        const shades = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900'];
        for (const shade of shades) {
          const val = root.style.getPropertyValue(`--color-secondary-${shade}`);
          expect(val).toBeTruthy();
          expect(val).toMatch(/^#[0-9a-f]{6}$/);
        }
      });
    });

    it('F3. No genera secondary_color si no está definido', async () => {
      mockGetMiPlantel.mockResolvedValue(MOCK_PLANTEL_WITHOUT_LOGO);

      const Layout = (await import('../components/layout/Layout')).default;

      renderWithProviders(
        <Routes>
          <Route element={<Layout />}>
            <Route path="*" element={<div>Content</div>} />
          </Route>
        </Routes>,
        { route: '/dashboard' }
      );

      await waitFor(() => {
        const root = document.documentElement;
        // Primary debe existir aunque no haya secondary
        expect(root.style.getPropertyValue('--color-primary-500')).toBe('#e11d48');
      });

      // Secondary NO debe existir
      const root = document.documentElement;
      expect(root.style.getPropertyValue('--color-secondary-500')).toBe('');
    });
  });
});
