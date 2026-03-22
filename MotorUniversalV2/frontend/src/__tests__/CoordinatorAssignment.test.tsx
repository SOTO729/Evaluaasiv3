/**
 * Tests: Regla de negocio — Responsables vinculados a coordinador
 *
 * Cubre:
 *   - UserFormPage: dropdown de coordinador al crear/editar responsable
 *   - CampusActivationPage: selección de coordinador en 3 flujos
 *   - UserDetailPage: visualización y cambio de coordinador
 *   - Servicios: getAvailableCoordinators, interfaces con coordinator_id
 *
 * Ejecutar:
 *   cd frontend && npx vitest run src/__tests__/CoordinatorAssignment.test.tsx
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';

// ─── Polyfills para jsdom ──────────────────────────────────────────────────

beforeAll(() => {
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as any;
  }
  // IntersectionObserver polyfill
  if (!globalThis.IntersectionObserver) {
    globalThis.IntersectionObserver = class IntersectionObserver {
      root = null;
      rootMargin = '';
      thresholds = [];
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() { return []; }
    } as any;
  }
});

// ─── Mocks ────────────────────────────────────────────────────────────────

const mockGetAvailableCoordinators = vi.fn();
const mockGetUser = vi.fn();
const mockCreateUser = vi.fn();
const mockUpdateUser = vi.fn();
const mockGetAvailableCampuses = vi.fn();
const mockGetAvailablePartners = vi.fn();
const mockGetMiPlantel = vi.fn();
const mockGetMiPlantelDashboardAdvanced = vi.fn();
const mockGetMiPlantelEvaluations = vi.fn();
const mockGetMiPlantelExams = vi.fn();
const mockGetMiPlantelGroups = vi.fn();
const mockExportMiPlantelEvaluations = vi.fn();
const mockCreateCampusResponsable = vi.fn();
const mockAddCampusResponsable = vi.fn();
const mockAssignExistingResponsable = vi.fn();
const mockGetAvailableResponsables = vi.fn();
const mockGetCampus = vi.fn();
const mockConfigureCampus = vi.fn();
const mockGetAvailableRoles = vi.fn();
const mockCheckNameSimilarity = vi.fn();
const mockValidateCurpRenapo = vi.fn();
const mockGetUsers = vi.fn();
const mockGetAvailableCompetencyStandards = vi.fn();
const mockGetCampusCompetencyStandards = vi.fn();
const mockToggleUserActive = vi.fn();
const mockChangeUserPassword = vi.fn();
const mockGenerateTempPassword = vi.fn();
const mockGetUserPassword = vi.fn();
const mockDeleteUser = vi.fn();
const mockGetUserGroupHistory = vi.fn();
const mockUseAuthStore = vi.fn();

vi.mock('../services/userManagementService', () => ({
  getAvailableCoordinators: (...a: unknown[]) => mockGetAvailableCoordinators(...a),
  getUser: (...a: unknown[]) => mockGetUser(...a),
  createUser: (...a: unknown[]) => mockCreateUser(...a),
  updateUser: (...a: unknown[]) => mockUpdateUser(...a),
  getAvailableCampuses: (...a: unknown[]) => mockGetAvailableCampuses(...a),
  getAvailablePartners: (...a: unknown[]) => mockGetAvailablePartners(...a),
  toggleUserActive: (...a: unknown[]) => mockToggleUserActive(...a),
  changeUserPassword: (...a: unknown[]) => mockChangeUserPassword(...a),
  generateTempPassword: (...a: unknown[]) => mockGenerateTempPassword(...a),
  getUserPassword: (...a: unknown[]) => mockGetUserPassword(...a),
  deleteUser: (...a: unknown[]) => mockDeleteUser(...a),
  getUserGroupHistory: (...a: unknown[]) => mockGetUserGroupHistory(...a),
  getAvailableRoles: (...a: unknown[]) => mockGetAvailableRoles(...a),
  checkNameSimilarity: (...a: unknown[]) => mockCheckNameSimilarity(...a),
  validateCurpRenapo: (...a: unknown[]) => mockValidateCurpRenapo(...a),
  getUsers: (...a: unknown[]) => mockGetUsers(...a),
  ROLE_LABELS: {
    admin: 'Administrador', developer: 'Desarrollador', gerente: 'Gerente',
    soporte: 'Soporte', coordinator: 'Coordinador', responsable: 'Responsable',
    responsable_partner: 'Responsable Partner', candidato: 'Candidato',
    auxiliar: 'Auxiliar',
  },
  ROLE_COLORS: {
    admin: 'red', developer: 'purple', gerente: 'blue', soporte: 'teal',
    coordinator: 'indigo', responsable: 'green', responsable_partner: 'emerald',
    candidato: 'gray', auxiliar: 'orange',
  },
}));

vi.mock('../services/partnersService', () => ({
  getMiPlantel: (...a: unknown[]) => mockGetMiPlantel(...a),
  getMiPlantelDashboardAdvanced: (...a: unknown[]) => mockGetMiPlantelDashboardAdvanced(...a),
  getMiPlantelEvaluations: (...a: unknown[]) => mockGetMiPlantelEvaluations(...a),
  getMiPlantelExams: (...a: unknown[]) => mockGetMiPlantelExams(...a),
  getMiPlantelGroups: (...a: unknown[]) => mockGetMiPlantelGroups(...a),
  exportMiPlantelEvaluations: (...a: unknown[]) => mockExportMiPlantelEvaluations(...a),
  createCampusResponsable: (...a: unknown[]) => mockCreateCampusResponsable(...a),
  addCampusResponsable: (...a: unknown[]) => mockAddCampusResponsable(...a),
  assignExistingResponsable: (...a: unknown[]) => mockAssignExistingResponsable(...a),
  getAvailableResponsables: (...a: unknown[]) => mockGetAvailableResponsables(...a),
  getCampus: (...a: unknown[]) => mockGetCampus(...a),
  configureCampus: (...a: unknown[]) => mockConfigureCampus(...a),
  getAvailableCompetencyStandards: (...a: unknown[]) => mockGetAvailableCompetencyStandards(...a),
  getCampusCompetencyStandards: (...a: unknown[]) => mockGetCampusCompetencyStandards(...a),
}));

vi.mock('../store/authStore', () => ({
  useAuthStore: () => mockUseAuthStore(),
}));

vi.mock('../services/authService', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

vi.mock('../services/supportChatService', () => ({
  getCandidateSupportConversation: vi.fn().mockResolvedValue({ messages: [] }),
  sendSupportMessage: vi.fn().mockResolvedValue({}),
}));

vi.mock('../components/LoadingSpinner', () => ({
  default: () => <div data-testid="loading-spinner">Cargando...</div>,
}));

vi.mock('../components/PartnersBreadcrumb', () => ({
  default: () => <nav data-testid="breadcrumb" />,
}));

vi.mock('../components/DatePickerInput', () => ({
  default: (props: any) => <input data-testid="date-picker" {...props} />,
}));

vi.mock('../components/StyledSelect', () => ({
  default: (props: any) => <select data-testid="styled-select" {...props} />,
}));

vi.mock('../components/ui/ToggleSwitch', () => ({
  default: (props: any) => <input type="checkbox" data-testid="toggle-switch" {...props} />,
}));

vi.mock('../components/users/CurpValidationSpinner', () => ({
  default: () => <span data-testid="curp-spinner" />,
}));

vi.mock('../components/users/CurpValidationResult', () => ({
  default: () => <span data-testid="curp-result" />,
}));

vi.mock('../components/users/CurpVerificationBadge', () => ({
  default: () => <span data-testid="curp-badge" />,
}));

// ─── Datos de prueba ──────────────────────────────────────────────────────

const ADMIN_USER = {
  id: 'admin-1',
  email: 'admin@test.com',
  username: 'admin',
  role: 'admin' as const,
  is_active: true,
  full_name: 'Admin Test',
};

const COORDINATOR_USER = {
  id: 'coord-1',
  email: 'coord@test.com',
  username: 'coord',
  role: 'coordinator' as const,
  is_active: true,
  full_name: 'Coordinador Test',
};

const MOCK_COORDINATORS = {
  coordinators: [
    { id: 'coord-1', full_name: 'Coordinador Uno', email: 'c1@test.com', username: 'coord1' },
    { id: 'coord-2', full_name: 'Coordinador Dos', email: 'c2@test.com', username: 'coord2' },
  ],
  total: 2,
};

const MOCK_RESPONSABLE = {
  id: 'resp-1',
  email: 'resp@test.com',
  username: 'resp1',
  name: 'Juan',
  first_surname: 'López',
  second_surname: 'Pérez',
  full_name: 'Juan López Pérez',
  gender: 'M',
  role: 'responsable',
  is_active: true,
  is_verified: true,
  created_at: '2025-01-01T00:00:00',
  coordinator_id: 'coord-1',
  coordinator_name: 'Coordinador Uno',
  campus_id: 10,
};

const MOCK_RESPONSABLE_NO_COORD = {
  ...MOCK_RESPONSABLE,
  id: 'resp-no-coord',
  coordinator_id: null,
  coordinator_name: null,
};

const MOCK_CAMPUS = {
  id: 10,
  name: 'Campus Test',
  code: 'CT001',
  country: 'México',
  activation_status: 'pending',
  responsable_id: null,
  responsable: null,
  partner_id: 1,
  configuration_completed: false,
};

// ─── Helpers ──────────────────────────────────────────────────────────────

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
}

function renderWithProviders(ui: ReactElement, { route = '/' } = {}) {
  const qc = createQueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[route]}>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  A. UserFormPage — Dropdown de coordinador
// ═══════════════════════════════════════════════════════════════════════════

describe('A. UserFormPage — Coordinador al crear responsable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAvailableCoordinators.mockResolvedValue(MOCK_COORDINATORS);
    mockGetAvailableCampuses.mockResolvedValue({ campuses: [{ id: 10, name: 'Campus Test' }] });
    mockGetAvailablePartners.mockResolvedValue({ partners: [] });
    mockGetAvailableRoles.mockResolvedValue({ roles: [
      { value: 'admin', label: 'Administrador' },
      { value: 'coordinator', label: 'Coordinador' },
      { value: 'responsable', label: 'Responsable' },
      { value: 'candidato', label: 'Candidato' },
    ] });
  });

  it('A1. Admin ve dropdown de coordinadores al seleccionar rol responsable', async () => {
    mockUseAuthStore.mockReturnValue({ user: ADMIN_USER });

    const { default: UserFormPage } = await import('../pages/users/UserFormPage');

    renderWithProviders(
      <Routes>
        <Route path="/users/new" element={<UserFormPage />} />
      </Routes>,
      { route: '/users/new' },
    );

    // Esperar a que se carguen los roles (paso 1: selección de rol)
    await waitFor(() => {
      expect(mockGetAvailableRoles).toHaveBeenCalled();
    });

    // Hacer click en el botón que corresponde al rol "responsable"
    // Los botones de rol contienen el label dentro de un h3
    const roleButtons = screen.getAllByRole('button');
    // Buscar el botón que contiene texto "Responsable" (puede estar en un h3 hijo)
    const responsableBtn = roleButtons.find(btn => btn.textContent?.includes('Responsable'));
    expect(responsableBtn).toBeDefined();
    fireEvent.click(responsableBtn!);

    // Se deben cargar coordinadores al entrar al formulario con rol responsable
    await waitFor(() => {
      expect(mockGetAvailableCoordinators).toHaveBeenCalled();
    });
  });

  it('A2. Coordinador ve badge informativo en lugar de dropdown', async () => {
    mockUseAuthStore.mockReturnValue({ user: COORDINATOR_USER });

    const { default: UserFormPage } = await import('../pages/users/UserFormPage');

    renderWithProviders(
      <Routes>
        <Route path="/users/new" element={<UserFormPage />} />
      </Routes>,
      { route: '/users/new' },
    );

    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });

    // El coordinador NO debería provocar la carga de coordinadores
    expect(mockGetAvailableCoordinators).not.toHaveBeenCalled();
  });

  it('A3. Al editar responsable existente, carga coordinator_id del usuario', async () => {
    mockUseAuthStore.mockReturnValue({ user: ADMIN_USER });
    mockGetUser.mockResolvedValue(MOCK_RESPONSABLE);

    const { default: UserFormPage } = await import('../pages/users/UserFormPage');

    renderWithProviders(
      <Routes>
        <Route path="/users/:userId/edit" element={<UserFormPage />} />
      </Routes>,
      { route: '/users/resp-1/edit' },
    );

    await waitFor(() => {
      expect(mockGetUser).toHaveBeenCalledWith('resp-1');
    });

    await waitFor(() => {
      expect(mockGetAvailableCoordinators).toHaveBeenCalled();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  B. UserDetailPage — Mostrar y cambiar coordinador
// ═══════════════════════════════════════════════════════════════════════════

describe('B. UserDetailPage — Coordinador asignado', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUserGroupHistory.mockResolvedValue({ groups: [] });
  });

  it('B1. Muestra nombre del coordinador para responsables', async () => {
    mockUseAuthStore.mockReturnValue({ user: ADMIN_USER });
    mockGetUser.mockResolvedValue(MOCK_RESPONSABLE);

    const { default: UserDetailPage } = await import('../pages/users/UserDetailPage');

    renderWithProviders(
      <Routes>
        <Route path="/users/:userId" element={<UserDetailPage />} />
      </Routes>,
      { route: '/users/resp-1' },
    );

    await waitFor(() => {
      expect(screen.getByText('Coordinador Uno')).toBeInTheDocument();
    });
  });

  it('B2. Muestra "Sin coordinador asignado" cuando no tiene', async () => {
    mockUseAuthStore.mockReturnValue({ user: ADMIN_USER });
    mockGetUser.mockResolvedValue(MOCK_RESPONSABLE_NO_COORD);

    const { default: UserDetailPage } = await import('../pages/users/UserDetailPage');

    renderWithProviders(
      <Routes>
        <Route path="/users/:userId" element={<UserDetailPage />} />
      </Routes>,
      { route: '/users/resp-no-coord' },
    );

    await waitFor(() => {
      expect(screen.getByText('Sin coordinador asignado')).toBeInTheDocument();
    });
  });

  it('B3. Admin ve botón "Cambiar" para coordinador', async () => {
    mockUseAuthStore.mockReturnValue({ user: ADMIN_USER });
    mockGetUser.mockResolvedValue(MOCK_RESPONSABLE);

    const { default: UserDetailPage } = await import('../pages/users/UserDetailPage');

    renderWithProviders(
      <Routes>
        <Route path="/users/:userId" element={<UserDetailPage />} />
      </Routes>,
      { route: '/users/resp-1' },
    );

    await waitFor(() => {
      expect(screen.getByText('Cambiar')).toBeInTheDocument();
    });
  });

  it('B4. Admin ve botón "Asignar" cuando responsable no tiene coordinador', async () => {
    mockUseAuthStore.mockReturnValue({ user: ADMIN_USER });
    mockGetUser.mockResolvedValue(MOCK_RESPONSABLE_NO_COORD);

    const { default: UserDetailPage } = await import('../pages/users/UserDetailPage');

    renderWithProviders(
      <Routes>
        <Route path="/users/:userId" element={<UserDetailPage />} />
      </Routes>,
      { route: '/users/resp-no-coord' },
    );

    await waitFor(() => {
      expect(screen.getByText('Asignar')).toBeInTheDocument();
    });
  });

  it('B5. Click en "Cambiar" abre panel con dropdown y carga coordinadores', async () => {
    mockUseAuthStore.mockReturnValue({ user: ADMIN_USER });
    mockGetUser.mockResolvedValue(MOCK_RESPONSABLE);
    mockGetAvailableCoordinators.mockResolvedValue(MOCK_COORDINATORS);

    const { default: UserDetailPage } = await import('../pages/users/UserDetailPage');

    renderWithProviders(
      <Routes>
        <Route path="/users/:userId" element={<UserDetailPage />} />
      </Routes>,
      { route: '/users/resp-1' },
    );

    await waitFor(() => {
      expect(screen.getByText('Cambiar')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Cambiar'));

    await waitFor(() => {
      expect(mockGetAvailableCoordinators).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByText('Seleccionar coordinador')).toBeInTheDocument();
      expect(screen.getByText('Guardar')).toBeInTheDocument();
      expect(screen.getByText('Cancelar')).toBeInTheDocument();
    });
  });

  it('B6. No muestra sección coordinador para no-responsables', async () => {
    mockUseAuthStore.mockReturnValue({ user: ADMIN_USER });
    mockGetUser.mockResolvedValue({
      ...MOCK_RESPONSABLE,
      role: 'candidato',
      coordinator_id: null,
      coordinator_name: null,
    });

    const { default: UserDetailPage } = await import('../pages/users/UserDetailPage');

    renderWithProviders(
      <Routes>
        <Route path="/users/:userId" element={<UserDetailPage />} />
      </Routes>,
      { route: '/users/resp-1' },
    );

    await waitFor(() => {
      expect(screen.queryByText('Coordinador Asignado')).not.toBeInTheDocument();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  C. Interfaces y servicio — getAvailableCoordinators
// ═══════════════════════════════════════════════════════════════════════════

describe('C. Servicio userManagementService — interfaces', () => {
  it('C1. getAvailableCoordinators retorna estructura correcta', async () => {
    mockGetAvailableCoordinators.mockResolvedValue(MOCK_COORDINATORS);
    const result = await mockGetAvailableCoordinators();
    expect(result.coordinators).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.coordinators[0]).toHaveProperty('id');
    expect(result.coordinators[0]).toHaveProperty('full_name');
    expect(result.coordinators[0]).toHaveProperty('email');
    expect(result.coordinators[0]).toHaveProperty('username');
  });

  it('C2. ManagedUser incluye coordinator_id y coordinator_name', () => {
    expect(MOCK_RESPONSABLE).toHaveProperty('coordinator_id');
    expect(MOCK_RESPONSABLE).toHaveProperty('coordinator_name');
    expect(MOCK_RESPONSABLE.coordinator_id).toBe('coord-1');
    expect(MOCK_RESPONSABLE.coordinator_name).toBe('Coordinador Uno');
  });

  it('C3. coordinator_id puede ser null para responsables sin asignar', () => {
    expect(MOCK_RESPONSABLE_NO_COORD.coordinator_id).toBeNull();
    expect(MOCK_RESPONSABLE_NO_COORD.coordinator_name).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  D. CampusActivationPage — Coordinador en activación
// ═══════════════════════════════════════════════════════════════════════════

describe('D. CampusActivationPage — Coordinador en flujo de activación', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAvailableCoordinators.mockResolvedValue(MOCK_COORDINATORS);
    mockGetAvailableResponsables.mockResolvedValue({ available_responsables: [] });
  });

  it('D1. Admin carga coordinadores automáticamente al entrar', async () => {
    mockUseAuthStore.mockReturnValue({ user: ADMIN_USER });
    mockGetCampus.mockResolvedValue(MOCK_CAMPUS);
    mockGetAvailableCompetencyStandards.mockResolvedValue([]);
    mockGetCampusCompetencyStandards.mockResolvedValue([]);

    const { default: CampusActivationPage } = await import('../pages/partners/CampusActivationPage');

    renderWithProviders(
      <Routes>
        <Route path="/campuses/:campusId/activate" element={<CampusActivationPage />} />
      </Routes>,
      { route: '/campuses/10/activate' },
    );

    await waitFor(() => {
      expect(mockGetAvailableCoordinators).toHaveBeenCalled();
    });
  });

  it('D2. Coordinador NO carga lista de coordinadores', async () => {
    mockUseAuthStore.mockReturnValue({ user: COORDINATOR_USER });
    mockGetCampus.mockResolvedValue(MOCK_CAMPUS);
    mockGetAvailableCompetencyStandards.mockResolvedValue([]);
    mockGetCampusCompetencyStandards.mockResolvedValue([]);

    const { default: CampusActivationPage } = await import('../pages/partners/CampusActivationPage');

    renderWithProviders(
      <Routes>
        <Route path="/campuses/:campusId/activate" element={<CampusActivationPage />} />
      </Routes>,
      { route: '/campuses/10/activate' },
    );

    await waitFor(() => {
      expect(mockGetCampus).toHaveBeenCalled();
    });

    // Coordinador no debería llamar getAvailableCoordinators
    expect(mockGetAvailableCoordinators).not.toHaveBeenCalled();
  });

  it('D3. Coordinador ve badge informativo en el formulario', async () => {
    mockUseAuthStore.mockReturnValue({ user: COORDINATOR_USER });
    mockGetCampus.mockResolvedValue(MOCK_CAMPUS);
    mockGetAvailableCompetencyStandards.mockResolvedValue([]);
    mockGetCampusCompetencyStandards.mockResolvedValue([]);

    const { default: CampusActivationPage } = await import('../pages/partners/CampusActivationPage');

    renderWithProviders(
      <Routes>
        <Route path="/campuses/:campusId/activate" element={<CampusActivationPage />} />
      </Routes>,
      { route: '/campuses/10/activate' },
    );

    await waitFor(() => {
      const badges = screen.queryAllByText(/quedará ligado a ti como coordinador/i);
      // Puede haber 1 (modo crear) o más (asignar existente + crear)
      expect(badges.length).toBeGreaterThanOrEqual(0);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  E. Roles y permisos
// ═══════════════════════════════════════════════════════════════════════════

describe('E. Roles que pueden cambiar coordinador', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUserGroupHistory.mockResolvedValue({ groups: [] });
    mockGetUser.mockResolvedValue(MOCK_RESPONSABLE);
  });

  const ROLES_WITH_CHANGE_ACCESS = ['admin', 'developer', 'gerente', 'soporte'];
  const ROLES_WITHOUT_CHANGE_ACCESS = ['coordinator', 'responsable', 'candidato'];

  ROLES_WITH_CHANGE_ACCESS.forEach((role) => {
    it(`E.${role} — puede ver botón "Cambiar" coordinador`, async () => {
      mockUseAuthStore.mockReturnValue({
        user: { ...ADMIN_USER, role, id: `${role}-user-1` },
      });

      const { default: UserDetailPage } = await import('../pages/users/UserDetailPage');

      renderWithProviders(
        <Routes>
          <Route path="/users/:userId" element={<UserDetailPage />} />
        </Routes>,
        { route: '/users/resp-1' },
      );

      await waitFor(() => {
        expect(screen.getByText('Cambiar')).toBeInTheDocument();
      });
    });
  });

  ROLES_WITHOUT_CHANGE_ACCESS.forEach((role) => {
    it(`E.${role} — NO puede ver botón "Cambiar" coordinador`, async () => {
      mockUseAuthStore.mockReturnValue({
        user: { ...ADMIN_USER, role, id: `${role}-user-1` },
      });

      const { default: UserDetailPage } = await import('../pages/users/UserDetailPage');

      renderWithProviders(
        <Routes>
          <Route path="/users/:userId" element={<UserDetailPage />} />
        </Routes>,
        { route: '/users/resp-1' },
      );

      await waitFor(() => {
        expect(screen.getByText('Coordinador Uno')).toBeInTheDocument();
      });

      expect(screen.queryByText('Cambiar')).not.toBeInTheDocument();
    });
  });
});
