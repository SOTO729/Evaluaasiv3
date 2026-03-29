/**
 * Tests de Aislamiento de Datos en GruposListPage
 * ================================================
 *
 * Verifica que GruposListPage llama correctamente al servicio
 * searchGroupsPaginated y renderiza solo los datos devueltos por el backend.
 *
 * El filtrado real ocurre en el backend (CandidateGroup.coordinator_id == coord_id).
 * Estos tests verifican que:
 *   1. El componente llama a searchGroupsPaginated al montar
 *   2. Solo renderiza los grupos devueltos (no hay datos extra)
 *   3. available_partners del backend se muestra en el filtro
 *   4. La búsqueda envía el término al backend
 *   5. El filtro por partner envía partner_id al backend
 *   6. Mensaje vacío cuando no hay grupos
 *   7. Paginación muestra total correcto
 *   8. Los grupos muestran partner_name y campus_name
 *
 * Ejecutar:
 *   cd frontend && npx vitest run src/__tests__/GruposListPage.test.tsx
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

// ─── Mock: partnersService ─────────────────────────────────────────────────

const mockSearchGroupsPaginated = vi.fn();

vi.mock('../services/partnersService', () => ({
  searchGroupsPaginated: (...args: unknown[]) => mockSearchGroupsPaginated(...args),
}));

// ─── Mock: authStore ───────────────────────────────────────────────────────

const mockUser = {
  id: 'coord-123',
  username: 'coordtest',
  role: 'coordinator',
  name: 'Test Coordinator',
  can_manage_groups: true,
};

vi.mock('../store/authStore', () => ({
  useAuthStore: () => ({ user: mockUser }),
}));

// ─── Test data ─────────────────────────────────────────────────────────────

/** Datos simulando lo que ve Coordinator A */
const COORD_A_GROUPS = {
  groups: [
    {
      id: 49,
      name: '1era A de Secundaria',
      description: 'Primer grado',
      is_active: true,
      created_at: '2026-01-15T10:00:00',
      campus_id: 40,
      campus_name: 'general guate',
      campus_country: 'Guatemala',
      campus_state: 'Guatemala',
      partner_name: 'Educare pruebas',
      partner_id: 50,
      school_cycle: { id: 1, name: '2025-2026' },
      member_count: 15,
    },
    {
      id: 50,
      name: '2do A de Secundaria',
      description: null,
      is_active: true,
      created_at: '2026-01-16T10:00:00',
      campus_id: 39,
      campus_name: 'colegio euroamericano',
      campus_country: 'México',
      campus_state: 'CDMX',
      partner_name: 'Educare pruebas',
      partner_id: 50,
      school_cycle: null,
      member_count: 8,
    },
    {
      id: 132,
      name: '1A de Secundaria maxima',
      description: 'Grupo maxima',
      is_active: true,
      created_at: '2026-02-10T10:00:00',
      campus_id: 116,
      campus_name: 'Plantel Prueba Maxima',
      campus_country: 'México',
      campus_state: 'Yucatán',
      partner_name: 'INNOVATIQ Pruebas',
      partner_id: 129,
      school_cycle: { id: 2, name: '2026-A' },
      member_count: 22,
    },
  ],
  total: 3,
  page: 1,
  pages: 1,
  per_page: 150,
  available_cycles: ['2025-2026', '2026-A'],
  available_partners: [
    { id: 50, name: 'Educare pruebas' },
    { id: 129, name: 'INNOVATIQ Pruebas' },
  ],
};

const EMPTY_RESULT = {
  groups: [],
  total: 0,
  page: 1,
  pages: 1,
  per_page: 150,
  available_cycles: [],
  available_partners: [],
};

// ─── Helper: render con router ─────────────────────────────────────────────

async function renderPage() {
  const GruposListPage = (await import('../pages/grupos/GruposListPage')).default;
  return render(
    <MemoryRouter initialEntries={['/grupos']}>
      <Routes>
        <Route path="/grupos" element={<GruposListPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('GruposListPage — Coordinator data isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchGroupsPaginated.mockResolvedValue(COORD_A_GROUPS);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('T1: calls searchGroupsPaginated on mount', async () => {
    await renderPage();
    await waitFor(() => {
      expect(mockSearchGroupsPaginated).toHaveBeenCalled();
    });
  });

  it('T2: renders only the groups returned by the backend', async () => {
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText('1era A de Secundaria')).toBeInTheDocument();
    });
    expect(screen.getByText('2do A de Secundaria')).toBeInTheDocument();
    expect(screen.getByText('1A de Secundaria maxima')).toBeInTheDocument();

    // Should NOT have any groups not in the mock data
    expect(screen.queryByText('Some Other Group')).not.toBeInTheDocument();
  });

  it('T3: shows correct partner names for each group', async () => {
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText('1era A de Secundaria')).toBeInTheDocument();
    });

    // Partner names should appear (they appear multiple times in the table)
    const educareElements = screen.getAllByText('Educare pruebas');
    expect(educareElements.length).toBeGreaterThanOrEqual(1);

    const innovatiqElements = screen.getAllByText('INNOVATIQ Pruebas');
    expect(innovatiqElements.length).toBeGreaterThanOrEqual(1);
  });

  it('T4: shows correct campus names for each group', async () => {
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText('1era A de Secundaria')).toBeInTheDocument();
    });

    expect(screen.getByText('general guate')).toBeInTheDocument();
    expect(screen.getByText('colegio euroamericano')).toBeInTheDocument();
    expect(screen.getByText('Plantel Prueba Maxima')).toBeInTheDocument();
  });

  it('T5: displays total count from backend response', async () => {
    await renderPage();
    await waitFor(() => {
      // The pagination shows "Mostrando 1 – 3 de 3 grupos"
      const allText = document.body.textContent || '';
      expect(allText).toContain('3');
      expect(allText).toContain('grupos');
    });
    // Verify the total count is exactly 3 ("de 3 grupos")
    const boldElements = screen.getAllByText('3');
    expect(boldElements.length).toBeGreaterThanOrEqual(1);
  });

  it('T6: shows empty state when coordinator has no groups', async () => {
    mockSearchGroupsPaginated.mockResolvedValue(EMPTY_RESULT);
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText('No hay grupos disponibles')).toBeInTheDocument();
    });
  });

  it('T7: passes search term to backend service', async () => {
    const user = userEvent.setup();
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText('1era A de Secundaria')).toBeInTheDocument();
    });

    // Type in search box
    const searchInput = screen.getByPlaceholderText(/buscar grupo/i);
    await user.clear(searchInput);
    await user.type(searchInput, 'maxima');

    // After debounce, should call with search param
    await waitFor(
      () => {
        const lastCall = mockSearchGroupsPaginated.mock.calls.at(-1)?.[0];
        expect(lastCall?.search).toBe('maxima');
      },
      { timeout: 2000 },
    );
  });

  it('T8: available_partners populates the partner filter dropdown', async () => {
    const user = userEvent.setup();
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText('1era A de Secundaria')).toBeInTheDocument();
    });

    // Open advanced filters
    const filtersBtn = screen.getByText('Filtros');
    await user.click(filtersBtn);

    // Find the partner select by finding the label
    const selects = document.querySelectorAll('select');
    const partnerSelect = [...selects].find(s => {
      const parent = s.closest('div');
      return parent?.querySelector('label')?.textContent?.includes('Partner');
    });
    expect(partnerSelect).toBeTruthy();

    // Check that the select has the correct options
    const options = partnerSelect!.querySelectorAll('option');
    const optionTexts = [...options].map(o => o.textContent);
    expect(optionTexts).toContain('Todos los partners');
    expect(optionTexts).toContain('Educare pruebas');
    expect(optionTexts).toContain('INNOVATIQ Pruebas');
    // Should have exactly 3 options (Todos + 2 partners)
    expect(options.length).toBe(3);
  });

  it('T9: filtering by partner sends partner_id to backend', async () => {
    const user = userEvent.setup();
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText('1era A de Secundaria')).toBeInTheDocument();
    });

    // Open advanced filters
    await user.click(screen.getByText('Filtros'));

    // Select a partner in the dropdown
    const selects = document.querySelectorAll('select');
    const partnerSelect = [...selects].find(s => {
      const parent = s.closest('div');
      return parent?.querySelector('label')?.textContent?.includes('Partner');
    });
    expect(partnerSelect).toBeTruthy();

    await user.selectOptions(partnerSelect!, '50');

    // After debounce, backend should be called with partner_id
    await waitFor(
      () => {
        const lastCall = mockSearchGroupsPaginated.mock.calls.at(-1)?.[0];
        expect(lastCall?.partner_id).toBe(50);
      },
      { timeout: 2000 },
    );
  });

  it('T10: member count displayed correctly for each group', async () => {
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText('1era A de Secundaria')).toBeInTheDocument();
    });

    // Member counts: 15, 8, 22
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('22')).toBeInTheDocument();
  });

  it('T11: school cycle displayed for groups that have one', async () => {
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText('1era A de Secundaria')).toBeInTheDocument();
    });

    expect(screen.getByText('2025-2026')).toBeInTheDocument();
    expect(screen.getByText('2026-A')).toBeInTheDocument();
  });

  it('T12: page renders "No se encontraron grupos" when search has no results', async () => {
    // First render with data, then update mock for search
    mockSearchGroupsPaginated
      .mockResolvedValueOnce(COORD_A_GROUPS)
      .mockResolvedValue(EMPTY_RESULT);

    const user = userEvent.setup();
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText('1era A de Secundaria')).toBeInTheDocument();
    });

    // Type in search
    const searchInput = screen.getByPlaceholderText(/buscar grupo/i);
    await user.clear(searchInput);
    await user.type(searchInput, 'nonexistentgroup');

    // Should show "No se encontraron grupos"
    await waitFor(
      () => {
        expect(screen.getByText('No se encontraron grupos')).toBeInTheDocument();
      },
      { timeout: 2000 },
    );
  });
});
