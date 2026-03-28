/**
 * Tests de Aislamiento de Campus para Responsables
 * =================================================
 *
 * Verifica que las páginas que listan candidatos usan los endpoints correctos
 * y solo muestran los candidatos devueltos por el backend (ya filtrados por campus).
 *
 * Componentes cubiertos:
 *   1. GroupAssignCandidatesPage — llama a searchCandidatesAdvanced con exclude_group_id
 *   2. UsersListPage — llama a getUsers y muestra solo candidatos del plantel
 *
 * El filtrado REAL ocurre en el backend. Estos tests verifican que:
 *   - Los componentes llaman al servicio correcto
 *   - Los datos devueltos se renderizan adecuadamente
 *   - No hay bypass del filtro en el frontend
 *
 * Ejecutar:
 *   cd frontend && npx vitest run src/__tests__/ResponsableIsolation.test.tsx
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// ─── Polyfills para jsdom ──────────────────────────────────────────────────

beforeAll(() => {
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as any;
  }
  // matchMedia polyfill
  if (!window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  }
});

// ─── Mocks: partnersService ────────────────────────────────────────────────

const mockSearchCandidatesAdvanced = vi.fn();
const mockGetGroup = vi.fn();
const mockGetGroupMembersCount = vi.fn();
const mockGetGroupExams = vi.fn();
const mockAddGroupMembersBulk = vi.fn();
const mockBulkAssignByCriteria = vi.fn();
const mockGetGroupCampusResponsables = vi.fn();

vi.mock('../services/partnersService', () => ({
  getGroup: (...args: unknown[]) => mockGetGroup(...args),
  getGroupMembersCount: (...args: unknown[]) => mockGetGroupMembersCount(...args),
  getGroupExams: (...args: unknown[]) => mockGetGroupExams(...args),
  searchCandidatesAdvanced: (...args: unknown[]) => mockSearchCandidatesAdvanced(...args),
  addGroupMembersBulk: (...args: unknown[]) => mockAddGroupMembersBulk(...args),
  bulkAssignByCriteria: (...args: unknown[]) => mockBulkAssignByCriteria(...args),
  getGroupCampusResponsables: (...args: unknown[]) => mockGetGroupCampusResponsables(...args),
  getGroups: vi.fn().mockResolvedValue({ groups: [] }),
  getCandidatoBranding: vi.fn().mockResolvedValue({ branding: null }),
}));

// ─── Mocks: userManagementService ──────────────────────────────────────────

const mockGetUsers = vi.fn();
const mockGetUserStats = vi.fn();
const mockGetAvailableRoles = vi.fn();
const mockGetAvailableCampuses = vi.fn();

vi.mock('../services/userManagementService', () => ({
  getUsers: (...args: unknown[]) => mockGetUsers(...args),
  getUserStats: (...args: unknown[]) => mockGetUserStats(...args),
  toggleUserActive: vi.fn(),
  getAvailableRoles: (...args: unknown[]) => mockGetAvailableRoles(...args),
  exportSelectedUsersCredentials: vi.fn(),
  getAvailableCampuses: (...args: unknown[]) => mockGetAvailableCampuses(...args),
  ROLE_LABELS: {
    admin: 'Administrador', coordinator: 'Coordinador', candidato: 'Candidato',
    responsable: 'Responsable', editor: 'Editor', soporte: 'Soporte',
  },
  ROLE_COLORS: {
    admin: 'bg-red-100 text-red-800', coordinator: 'bg-blue-100 text-blue-800',
    candidato: 'bg-green-100 text-green-800', responsable: 'bg-purple-100 text-purple-800',
  },
}));

// ─── Mocks: authStore ──────────────────────────────────────────────────────

const mockUseAuthStore = vi.fn();
vi.mock('../store/authStore', () => ({
  useAuthStore: () => mockUseAuthStore(),
  clearAllCache: vi.fn(),
}));

// ─── Mocks: authService ────────────────────────────────────────────────────
vi.mock('../services/authService', () => ({
  default: { logout: vi.fn() },
}));

// ─── Mocks: supportChatService ─────────────────────────────────────────────
vi.mock('../services/supportChatService', () => ({
  getUnreadCount: vi.fn().mockResolvedValue(0),
}));

// ─── Mocks: lazy-loaded sub components ─────────────────────────────────────
vi.mock('../components/LoadingSpinner', () => ({
  default: () => <div data-testid="loading-spinner">Cargando...</div>,
}));

vi.mock('../components/PartnersBreadcrumb', () => ({
  default: () => <div data-testid="breadcrumb">Breadcrumb</div>,
}));

vi.mock('./CandidateAssignmentSuccessModal', () => ({
  default: () => null,
}));

vi.mock('../components/users/BulkUploadModal', () => ({
  default: () => null,
}));

vi.mock('../components/StyledSelect', () => ({
  default: ({ value, onChange, options, placeholder }: any) => (
    <select data-testid="styled-select" value={value} onChange={e => onChange?.(e.target.value)}>
      {placeholder && <option value="">{placeholder}</option>}
      {(options || []).map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  ),
}));

vi.mock('../components/DatePickerInput', () => ({
  default: () => <input data-testid="date-picker" />,
}));

vi.mock('../components/users/CurpVerificationBadge', () => ({
  default: () => <span>CURP</span>,
}));

// ─── Datos de prueba ───────────────────────────────────────────────────────

// Candidatos del plantel A (lo que el backend devuelve al responsable A)
const CAMPUS_A_CANDIDATES = [
  { id: 'cand-a1', name: 'Ana', first_surname: 'García', second_surname: 'López', full_name: 'Ana García López', email: 'ana@campus-a.com', curp: 'GALA900101MJCRRN09', gender: 'F', created_at: '2026-01-01T00:00:00' },
  { id: 'cand-a2', name: 'Carlos', first_surname: 'Reyes', second_surname: 'Mora', full_name: 'Carlos Reyes Mora', email: 'carlos@campus-a.com', curp: 'REMC900202HJCYSR08', gender: 'M', created_at: '2026-01-02T00:00:00' },
  { id: 'cand-a3', name: 'Diana', first_surname: 'Soto', second_surname: '', full_name: 'Diana Soto', email: 'diana@campus-a.com', curp: 'SOXD900303MJCTNN07', gender: 'F', created_at: '2026-01-03T00:00:00' },
];

// Candidatos del plantel B (lo que el backend devuelve al responsable B)
const CAMPUS_B_CANDIDATES = [
  { id: 'cand-b1', name: 'Eduardo', first_surname: 'Martínez', second_surname: 'Ruiz', full_name: 'Eduardo Martínez Ruiz', email: 'edu@campus-b.com', curp: 'MARE900404HJCRDD06', gender: 'M', created_at: '2026-02-01T00:00:00' },
  { id: 'cand-b2', name: 'Fernanda', first_surname: 'López', second_surname: 'Cruz', full_name: 'Fernanda López Cruz', email: 'fer@campus-b.com', curp: 'LOCF900505MJCPRR05', gender: 'F', created_at: '2026-02-02T00:00:00' },
];

const GROUP_DATA = {
  id: 101, name: 'Grupo Test A', campus_id: 1, is_active: true,
  campus_name: 'Campus A', partner_name: 'Partner Test',
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function setupResponsableAuth(campusId = 1) {
  mockUseAuthStore.mockReturnValue({
    user: {
      id: 'resp-a', role: 'responsable', username: 'resp-a',
      campus_id: campusId, can_manage_groups: true, can_view_reports: true,
    },
    token: 'test-jwt-token',
    isAuthenticated: true,
    logout: vi.fn(),
  });
}

function setupCoordinatorAuth() {
  mockUseAuthStore.mockReturnValue({
    user: {
      id: 'coord-1', role: 'coordinator', username: 'coord-1',
    },
    token: 'test-jwt-token',
    isAuthenticated: true,
    logout: vi.fn(),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests para GroupAssignCandidatesPage
// ─────────────────────────────────────────────────────────────────────────────

describe('GroupAssignCandidatesPage — campus isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupResponsableAuth();

    mockGetGroup.mockResolvedValue(GROUP_DATA);
    mockGetGroupMembersCount.mockResolvedValue({ count: 5 });
    mockGetGroupExams.mockResolvedValue({ assigned_exams: [] });
    mockGetGroupCampusResponsables.mockResolvedValue({ responsables: [], campus_name: 'Campus A' });

    // Backend returns only campus A candidates for responsable A
    mockSearchCandidatesAdvanced.mockResolvedValue({
      candidates: CAMPUS_A_CANDIDATES,
      total: 3,
      pages: 1,
      current_page: 1,
      filters_applied: {},
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function renderAssignPage(groupId = '101', path = '/mi-plantel/grupos/101/assign-candidates') {
    const { default: GroupAssignCandidatesPage } = await import('../pages/partners/GroupAssignCandidatesPage');
    return render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/mi-plantel/grupos/:groupId/assign-candidates" element={<GroupAssignCandidatesPage />} />
          <Route path="/partners/groups/:groupId/assign-candidates" element={<GroupAssignCandidatesPage />} />
        </Routes>
      </MemoryRouter>
    );
  }

  it('calls searchCandidatesAdvanced on mount (backend-side filtering)', async () => {
    await renderAssignPage();
    await waitFor(() => {
      expect(mockSearchCandidatesAdvanced).toHaveBeenCalled();
    });
  });

  it('passes exclude_group_id to searchCandidatesAdvanced', async () => {
    await renderAssignPage();
    await waitFor(() => {
      expect(mockSearchCandidatesAdvanced).toHaveBeenCalled();
      const lastCall = mockSearchCandidatesAdvanced.mock.calls[mockSearchCandidatesAdvanced.mock.calls.length - 1][0];
      expect(lastCall.exclude_group_id).toBe(101);
    });
  });

  it('renders only campus A candidates returned by backend', async () => {
    await renderAssignPage();
    await waitFor(() => {
      expect(screen.getByText('Ana García López')).toBeInTheDocument();
    });
    expect(screen.getByText('Carlos Reyes Mora')).toBeInTheDocument();
    expect(screen.getByText('Diana Soto')).toBeInTheDocument();
    // Campus B candidates should NOT appear (not in the mock data — simulating backend filter)
    expect(screen.queryByText('Eduardo Martínez Ruiz')).not.toBeInTheDocument();
    expect(screen.queryByText('Fernanda López Cruz')).not.toBeInTheDocument();
  });

  it('shows total count matching campus A candidates', async () => {
    await renderAssignPage();
    await waitFor(() => {
      // The total count appears in the header stats
      const elements = screen.getAllByText('3');
      expect(elements.length).toBeGreaterThan(0);
    });
  });

  it('does NOT call any other search endpoint (no bypass)', async () => {
    await renderAssignPage();
    await waitFor(() => {
      expect(mockSearchCandidatesAdvanced).toHaveBeenCalled();
    });
    // The component should ONLY use searchCandidatesAdvanced
    // It should NOT call getUsers or any other listing function
    expect(mockGetUsers).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests para UsersListPage
// ─────────────────────────────────────────────────────────────────────────────

describe('UsersListPage — campus isolation for responsable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupResponsableAuth();

    // Backend returns only campus A candidates for responsable
    mockGetUsers.mockResolvedValue({
      users: CAMPUS_A_CANDIDATES.map(c => ({
        ...c, role: 'candidato', is_active: true, is_verified: true,
        username: c.email?.split('@')[0],
      })),
      total: 3,
      pages: 1,
      current_page: 1,
      has_more: false,
    });

    mockGetUserStats.mockResolvedValue({
      total_users: 3,
      active_users: 3,
      inactive_users: 0,
      by_role: { candidato: 3 },
    });

    mockGetAvailableRoles.mockResolvedValue([
      { value: 'candidato', label: 'Candidato' },
    ]);

    mockGetAvailableCampuses.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function renderUsersPage() {
    const { default: UsersListPage } = await import('../pages/users/UsersListPage');
    return render(
      <MemoryRouter initialEntries={['/user-management']}>
        <Routes>
          <Route path="/user-management" element={<UsersListPage />} />
        </Routes>
      </MemoryRouter>
    );
  }

  it('calls getUsers on mount (backend filters by campus)', async () => {
    await renderUsersPage();
    await waitFor(() => {
      expect(mockGetUsers).toHaveBeenCalled();
    });
  });

  it('renders only candidates returned by backend (campus A)', async () => {
    await renderUsersPage();
    await waitFor(() => {
      expect(screen.getByText('Ana García López')).toBeInTheDocument();
    });
    expect(screen.getByText('Carlos Reyes Mora')).toBeInTheDocument();
    expect(screen.getByText('Diana Soto')).toBeInTheDocument();
    // Campus B candidates NOT in result
    expect(screen.queryByText('Eduardo Martínez Ruiz')).not.toBeInTheDocument();
    expect(screen.queryByText('Fernanda López Cruz')).not.toBeInTheDocument();
  });

  it('calls getUserStats for the responsable dashboard', async () => {
    await renderUsersPage();
    await waitFor(() => {
      expect(mockGetUserStats).toHaveBeenCalled();
    });
  });

  it('does NOT call searchCandidatesAdvanced (uses getUsers instead)', async () => {
    await renderUsersPage();
    await waitFor(() => {
      expect(mockGetUsers).toHaveBeenCalled();
    });
    expect(mockSearchCandidatesAdvanced).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests de aislamiento: coordinador vs responsable
// ─────────────────────────────────────────────────────────────────────────────

describe('Coordinator vs Responsable — search scope', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('coordinator path does NOT include /mi-plantel (full access via backend)', async () => {
    setupCoordinatorAuth();
    mockGetGroup.mockResolvedValue(GROUP_DATA);
    mockGetGroupMembersCount.mockResolvedValue({ count: 0 });
    mockGetGroupExams.mockResolvedValue({ assigned_exams: [] });
    mockGetGroupCampusResponsables.mockResolvedValue({ responsables: [], campus_name: 'Campus A' });

    // Coordinator sees ALL candidates
    mockSearchCandidatesAdvanced.mockResolvedValue({
      candidates: [...CAMPUS_A_CANDIDATES, ...CAMPUS_B_CANDIDATES],
      total: 5,
      pages: 1,
      current_page: 1,
      filters_applied: {},
    });

    const { default: GroupAssignCandidatesPage } = await import('../pages/partners/GroupAssignCandidatesPage');
    render(
      <MemoryRouter initialEntries={['/partners/groups/101/assign-candidates']}>
        <Routes>
          <Route path="/partners/groups/:groupId/assign-candidates" element={<GroupAssignCandidatesPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockSearchCandidatesAdvanced).toHaveBeenCalled();
    });

    // Coordinator sees both campuses
    await waitFor(() => {
      expect(screen.getByText('Ana García López')).toBeInTheDocument();
    });
    expect(screen.getByText('Eduardo Martínez Ruiz')).toBeInTheDocument();
    expect(screen.getByText('Fernanda López Cruz')).toBeInTheDocument();
  });

  it('both coordinator and responsable use the same searchCandidatesAdvanced endpoint (backend applies filter)', async () => {
    // This confirms that the isolation is fully backend-driven — both roles
    // call the same function, but the backend filters differently.
    setupResponsableAuth();
    mockGetGroup.mockResolvedValue(GROUP_DATA);
    mockGetGroupMembersCount.mockResolvedValue({ count: 0 });
    mockGetGroupExams.mockResolvedValue({ assigned_exams: [] });
    mockGetGroupCampusResponsables.mockResolvedValue({ responsables: [], campus_name: 'Campus A' });

    mockSearchCandidatesAdvanced.mockResolvedValue({
      candidates: CAMPUS_A_CANDIDATES,
      total: 3,
      pages: 1,
      current_page: 1,
      filters_applied: {},
    });

    const { default: GroupAssignCandidatesPage } = await import('../pages/partners/GroupAssignCandidatesPage');
    render(
      <MemoryRouter initialEntries={['/mi-plantel/grupos/101/assign-candidates']}>
        <Routes>
          <Route path="/mi-plantel/grupos/:groupId/assign-candidates" element={<GroupAssignCandidatesPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockSearchCandidatesAdvanced).toHaveBeenCalled();
    });

    // Verify the function is called with the same parameters pattern
    const call = mockSearchCandidatesAdvanced.mock.calls[mockSearchCandidatesAdvanced.mock.calls.length - 1][0];
    expect(call).toHaveProperty('exclude_group_id');
    expect(call).toHaveProperty('per_page');
  });
});
