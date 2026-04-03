/**
 * Tests de Branding para Candidatos
 * ===================================
 *
 * Verifica que los candidatos reciben el branding del campus
 * de su asignación más reciente. Cubre:
 *
 *   1. Candidato con branding → CSS variables, favicon, título, nombre en navbar
 *   2. Candidato sin branding (null) → sin CSS variables, sin cambios en título/favicon
 *   3. Candidato con branding parcial (sin secondary_color, sin logo)
 *   4. No dispara query de branding para roles no-candidato
 *
 * Ejecutar:
 *   cd frontend && npx vitest run src/__tests__/CandidatoBranding.test.tsx
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
const mockGetCandidatoBranding = vi.fn();

vi.mock('../services/partnersService', () => ({
  getMiPlantel: (...args: unknown[]) => mockGetMiPlantel(...args),
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

// Mock dashboardService para tests de HomePage
const mockGetDashboard = vi.fn();
vi.mock('../services/dashboardService', () => ({
  dashboardService: { getDashboard: () => mockGetDashboard() },
  __esModule: true,
}));

// Mock sub-dashboards importados por HomePage
vi.mock('../pages/EditorDashboard', () => ({ default: () => <div>Editor</div> }));
vi.mock('../pages/coordinador/CoordinatorDashboard', () => ({ default: () => <div>Coord</div> }));
vi.mock('../pages/responsable/ResponsableDashboard', () => ({ default: () => <div>Resp</div> }));
vi.mock('../pages/responsable_partner/ResponsablePartnerDashboard', () => ({ default: () => <div>RespP</div> }));
vi.mock('../components/candidate/CertificationPathCard', () => ({ default: () => <div>CertCard</div>, __esModule: true }));

// ─── Datos de prueba ───────────────────────────────────────────────────────

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

const ADMIN_USER = {
  ...CANDIDATO_USER,
  id: 'admin-1',
  role: 'admin' as const,
  username: 'admin1',
};

const COORDINATOR_USER = {
  ...CANDIDATO_USER,
  id: 'coord-1',
  role: 'coordinator' as const,
  username: 'coordinator1',
};

const MOCK_BRANDING_FULL = {
  branding: {
    campus_name: 'Campus Guadalajara',
    logo_url: 'https://storage.example.com/logos/campus-gdl.png',
    primary_color: '#059669',
    secondary_color: '#7c3aed',
  },
};

const MOCK_BRANDING_PARTIAL = {
  branding: {
    campus_name: 'Campus Veracruz',
    logo_url: null,
    primary_color: '#e11d48',
    secondary_color: null,
  },
};

const MOCK_BRANDING_NULL = {
  branding: null,
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
}

function renderLayout(route = '/dashboard') {
  const qc = createQueryClient();
  // Dynamic import to get fresh module per test
  return import('../components/layout/Layout').then(({ default: Layout }) => {
    return render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={[route]}>
          <Routes>
            <Route element={<Layout />}>
              <Route path="*" element={<div>Dashboard Content</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  });
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('Branding para Candidatos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: candidato con branding completo
    mockUseAuthStore.mockReturnValue({
      user: CANDIDATO_USER,
      logout: vi.fn(),
    });
    mockGetCandidatoBranding.mockResolvedValue(MOCK_BRANDING_FULL);
    mockGetMiPlantel.mockResolvedValue({ campus: null, group_count: 0, members_count: 0 });
    mockGetDashboard.mockResolvedValue({
      exams: [], materials: [], exam_materials_map: {},
    });

    // Asegurar link[rel=icon]
    let iconLink = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!iconLink) {
      iconLink = document.createElement('link');
      iconLink.rel = 'icon';
      iconLink.href = '/logo.png';
      document.head.appendChild(iconLink);
    }
  });

  afterEach(() => {
    // Limpiar CSS variables
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
  // 1. CANDIDATO CON BRANDING COMPLETO
  // ═══════════════════════════════════════════════════════════════════════

  describe('1. Candidato con branding completo', () => {
    it('1a. Genera paleta CSS primary del campus del candidato', async () => {
      await renderLayout();

      await waitFor(() => {
        const root = document.documentElement;
        expect(root.style.getPropertyValue('--color-primary-500')).toBe('#059669');
      });

      // Verificar todas las 10 tonalidades
      const root = document.documentElement;
      const shades = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900'];
      for (const shade of shades) {
        const val = root.style.getPropertyValue(`--color-primary-${shade}`);
        expect(val).toBeTruthy();
        expect(val).toMatch(/^#[0-9a-f]{6}$/);
      }
    });

    it('1b. Genera paleta CSS secondary del campus del candidato', async () => {
      await renderLayout();

      await waitFor(() => {
        const root = document.documentElement;
        expect(root.style.getPropertyValue('--color-secondary-500')).toBe('#7c3aed');
      });

      const root = document.documentElement;
      const shades = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900'];
      for (const shade of shades) {
        const val = root.style.getPropertyValue(`--color-secondary-${shade}`);
        expect(val).toBeTruthy();
        expect(val).toMatch(/^#[0-9a-f]{6}$/);
      }
    });

    it('1c. Actualiza el título de la pestaña con nombre del campus', async () => {
      await renderLayout();

      await waitFor(() => {
        expect(document.title).toBe('Campus Guadalajara — Evaluaasi');
      });
    });

    it('1d. Actualiza el favicon con el logo del campus', async () => {
      await renderLayout();

      await waitFor(() => {
        const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
        expect(link?.href).toContain('campus-gdl.png');
      });
    });

    it('1e. Muestra nombre del campus en el navbar', async () => {
      await renderLayout();

      await waitFor(() => {
        expect(screen.getByText('Campus Guadalajara')).toBeInTheDocument();
      });
    });

    it('1f. Muestra logo del campus en el navbar con clase responsive', async () => {
      await renderLayout();

      await waitFor(() => {
        const imgs = screen.getAllByRole('img');
        const campusLogo = imgs.find(
          img => img.getAttribute('src') === MOCK_BRANDING_FULL.branding.logo_url
        );
        expect(campusLogo).toBeDefined();
        expect(campusLogo?.className).toContain('max-w-full');
        expect(campusLogo?.className).toContain('max-h-full');
        expect(campusLogo?.className).toContain('object-contain');
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 2. CANDIDATO SIN BRANDING (null)
  // ═══════════════════════════════════════════════════════════════════════

  describe('2. Candidato sin branding (sin grupo asignado)', () => {
    beforeEach(() => {
      mockGetCandidatoBranding.mockResolvedValue(MOCK_BRANDING_NULL);
    });

    it('2a. No genera CSS variables primary', async () => {
      await renderLayout();

      // Esperar a que se estabilice el render
      await new Promise(r => setTimeout(r, 150));

      const root = document.documentElement;
      expect(root.style.getPropertyValue('--color-primary-500')).toBe('');
    });

    it('2b. No cambia el título de la pestaña', async () => {
      const originalTitle = document.title;
      await renderLayout();

      await new Promise(r => setTimeout(r, 150));
      expect(document.title).toBe(originalTitle);
    });

    it('2c. No cambia el favicon', async () => {
      const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      const originalHref = link?.href;

      await renderLayout();

      await new Promise(r => setTimeout(r, 150));
      expect(document.querySelector<HTMLLinkElement>('link[rel="icon"]')?.href).toBe(originalHref);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 3. CANDIDATO CON BRANDING PARCIAL (sin secondary, sin logo)
  // ═══════════════════════════════════════════════════════════════════════

  describe('3. Candidato con branding parcial', () => {
    beforeEach(() => {
      mockGetCandidatoBranding.mockResolvedValue(MOCK_BRANDING_PARTIAL);
    });

    it('3a. Genera paleta primary pero no secondary', async () => {
      await renderLayout();

      await waitFor(() => {
        const root = document.documentElement;
        expect(root.style.getPropertyValue('--color-primary-500')).toBe('#e11d48');
      });

      const root = document.documentElement;
      expect(root.style.getPropertyValue('--color-secondary-500')).toBe('');
    });

    it('3b. No cambia el favicon si no hay logo_url', async () => {
      const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      const originalHref = link?.href;

      await renderLayout();

      await new Promise(r => setTimeout(r, 150));
      expect(document.querySelector<HTMLLinkElement>('link[rel="icon"]')?.href).toBe(originalHref);
    });

    it('3c. Sí actualiza el título con nombre del campus', async () => {
      await renderLayout();

      await waitFor(() => {
        expect(document.title).toBe('Campus Veracruz — Evaluaasi');
      });
    });

    it('3d. Muestra nombre del campus en navbar', async () => {
      await renderLayout();

      await waitFor(() => {
        expect(screen.getByText('Campus Veracruz')).toBeInTheDocument();
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 4. NO DISPARA QUERY PARA ROLES NO-CANDIDATO
  // ═══════════════════════════════════════════════════════════════════════

  describe('4. Roles no-candidato no activan branding de candidato', () => {
    it('4a. Admin no llama getCandidatoBranding', async () => {
      mockUseAuthStore.mockReturnValue({
        user: ADMIN_USER,
        logout: vi.fn(),
      });

      await renderLayout();

      // Esperar a que React Query decida
      await new Promise(r => setTimeout(r, 150));

      expect(mockGetCandidatoBranding).not.toHaveBeenCalled();
    });

    it('4b. Coordinator no llama getCandidatoBranding', async () => {
      mockUseAuthStore.mockReturnValue({
        user: COORDINATOR_USER,
        logout: vi.fn(),
      });

      await renderLayout();

      await new Promise(r => setTimeout(r, 150));

      expect(mockGetCandidatoBranding).not.toHaveBeenCalled();
    });

    it('4c. Admin no genera CSS variables de branding', async () => {
      mockUseAuthStore.mockReturnValue({
        user: ADMIN_USER,
        logout: vi.fn(),
      });

      await renderLayout();

      await new Promise(r => setTimeout(r, 150));

      const root = document.documentElement;
      expect(root.style.getPropertyValue('--color-primary-500')).toBe('');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 5. CANDIDATO SÍ DISPARA QUERY
  // ═══════════════════════════════════════════════════════════════════════

  describe('5. Candidato sí activa la query de branding', () => {
    it('5a. Candidato llama getCandidatoBranding', async () => {
      await renderLayout();

      await waitFor(() => {
        expect(mockGetCandidatoBranding).toHaveBeenCalledTimes(1);
      });
    });

    it('5b. Candidato NO llama getMiPlantel', async () => {
      await renderLayout();

      await new Promise(r => setTimeout(r, 150));

      expect(mockGetMiPlantel).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 6. LOGO DEL CAMPUS EN HOMEPAGE DEL CANDIDATO
  // ═══════════════════════════════════════════════════════════════════════

  describe('6. Logo del campus en HomePage del candidato', () => {
    function renderHomePage() {
      const qc = createQueryClient();
      return import('../pages/HomePage').then(({ default: HomePage }) => {
        return render(
          <QueryClientProvider client={qc}>
            <MemoryRouter initialEntries={['/dashboard']}>
              <Routes>
                <Route path="*" element={<HomePage />} />
              </Routes>
            </MemoryRouter>
          </QueryClientProvider>
        );
      });
    }

    it('6a. Muestra el logo del campus en el hero cuando tiene branding', async () => {
      await renderHomePage();

      await waitFor(() => {
        const imgs = screen.getAllByRole('img');
        const campusLogo = imgs.find(
          img => img.getAttribute('src') === MOCK_BRANDING_FULL.branding.logo_url
        );
        expect(campusLogo).toBeDefined();
        expect(campusLogo).toHaveAttribute('alt', 'Campus Guadalajara');
      });
    });

    it('6a2. Logo del campus en hero usa h-24 (tamaño aumentado)', async () => {
      await renderHomePage();

      await waitFor(() => {
        const imgs = screen.getAllByRole('img');
        const campusLogo = imgs.find(
          img => img.getAttribute('src') === MOCK_BRANDING_FULL.branding.logo_url
        );
        expect(campusLogo).toBeDefined();
        expect(campusLogo?.className).toContain('h-24');
        expect(campusLogo?.className).toContain('rounded-lg');
      });
    });

    it('6b. Muestra el nombre del campus en el hero', async () => {
      await renderHomePage();

      await waitFor(() => {
        expect(screen.getByText('Campus Guadalajara')).toBeInTheDocument();
      });
    });

    it('6c. No muestra logo cuando branding es null', async () => {
      mockGetCandidatoBranding.mockResolvedValue(MOCK_BRANDING_NULL);

      await renderHomePage();

      await waitFor(() => {
        expect(screen.getByText('¡Bienvenido!')).toBeInTheDocument();
      });

      const imgs = screen.queryAllByRole('img');
      const campusLogo = imgs.find(
        img => img.getAttribute('src') === MOCK_BRANDING_FULL.branding.logo_url
      );
      expect(campusLogo).toBeUndefined();
    });

    it('6d. Muestra icono fallback cuando no hay logo_url pero sí branding', async () => {
      mockGetCandidatoBranding.mockResolvedValue(MOCK_BRANDING_PARTIAL);

      await renderHomePage();

      await waitFor(() => {
        expect(screen.getByText('Campus Veracruz')).toBeInTheDocument();
      });

      // No debe haber img del campus
      const imgs = screen.queryAllByRole('img');
      const campusLogo = imgs.find(
        img => img.getAttribute('src') === MOCK_BRANDING_FULL.branding.logo_url
      );
      expect(campusLogo).toBeUndefined();
    });

    it('6e. Hero usa colores de branding cuando tiene primary_color', async () => {
      await renderHomePage();

      await waitFor(() => {
        expect(screen.getByText('¡Bienvenido!')).toBeInTheDocument();
      });

      // El hero debe tener clases de primary (branding), no blue
      const hero = screen.getByText('¡Bienvenido!').closest('.rounded-fluid-xl');
      expect(hero?.className).toContain('from-primary-700');
      expect(hero?.className).not.toContain('from-blue-600');
    });

    it('6f. Hero usa clases primary (CSS vars resuelven a blue sin branding)', async () => {
      mockGetCandidatoBranding.mockResolvedValue(MOCK_BRANDING_NULL);

      await renderHomePage();

      await waitFor(() => {
        expect(screen.getByText('¡Bienvenido!')).toBeInTheDocument();
      });

      const hero = screen.getByText('¡Bienvenido!').closest('.rounded-fluid-xl');
      // Component always uses primary- classes; CSS vars resolve to default blue when no branding
      expect(hero?.className).toContain('from-primary-700');
    });
  });
});
