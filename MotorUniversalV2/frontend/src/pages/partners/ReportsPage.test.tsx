/**
 * Tests del componente ReportsPage
 *
 * Cubre:
 *   A. Renderizado inicial (header, columnas, filtros)
 *   B. Selector de columnas (toggle individual, grupo, todo/ninguna)
 *   C. Generación de preview
 *   D. Exportación a Excel
 *   E. Manejo de errores
 *
 * Ejecutar:
 *   cd frontend && npx vitest run src/pages/partners/ReportsPage.test.tsx
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ReportsPage from './ReportsPage';

// ─── Mocks ─────────────────────────────────────────────────────────────────

// Mock partnersService
const mockGetReportFilters = vi.fn();
const mockGetReports = vi.fn();
const mockExportReports = vi.fn();

vi.mock('../../services/partnersService', () => ({
  getReportFilters: (...args: any[]) => mockGetReportFilters(...args),
  getReports: (...args: any[]) => mockGetReports(...args),
  exportReports: (...args: any[]) => mockExportReports(...args),
}));

// Mock authStore
vi.mock('../../store/authStore', () => ({
  useAuthStore: () => ({
    user: {
      id: '1',
      email: 'admin@test.com',
      username: 'admin',
      name: 'Admin',
      first_surname: 'Test',
      full_name: 'Admin Test',
      role: 'admin' as const,
      is_active: true,
      is_verified: true,
      created_at: '2024-01-01',
    },
  }),
}));

// ─── Datos de prueba ───────────────────────────────────────────────────────

const MOCK_FILTERS = {
  partners: [
    { id: 1, name: 'Partner Uno' },
    { id: 2, name: 'Partner Dos' },
  ],
  campuses: [
    { id: 10, name: 'Campus A', partner_id: 1 },
    { id: 20, name: 'Campus B', partner_id: 2 },
  ],
  school_cycles: [
    { id: 100, name: '2024-A', campus_id: 10 },
  ],
  groups: [
    { id: 1000, name: 'Grupo 1', campus_id: 10, school_cycle_id: 100 },
  ],
  standards: [
    { id: 5, code: 'EC0217', name: 'Impartición de cursos', level: 3, sector: 'Educación', brand_id: null },
  ],
  brands: [
    { id: 1, name: 'Marca Test' },
  ],
};

const MOCK_REPORT_RESPONSE = {
  rows: [
    {
      user_id: 'u1',
      full_name: 'Juan Pérez',
      username: 'jperez',
      email: 'juan@test.com',
      curp: 'PERJ900101HDFXXX01',
      gender: 'M',
      role: 'candidato',
      is_active: true,
      curp_verified: true,
      partner_name: 'Partner Uno',
      campus_name: 'Campus A',
      campus_state: 'CDMX',
      school_cycle: '2024-A',
      group_name: 'Grupo 1',
      standard_code: 'EC0217',
      standard_name: 'Impartición de cursos',
      standard_level: 3,
      standard_sector: 'Educación',
      brand_name: '',
      assignment_number: 'A001',
      exam_name: 'Examen EC0217',
      score: 85,
      score_1000: 850,
      result: 'Aprobado',
      result_date: '2024-06-15',
      duration_seconds: 3600,
      certificate_code: 'CERT001',
      tramite_status: null,
      expires_at: '2027-06-15',
    },
    {
      user_id: 'u2',
      full_name: 'María García',
      username: 'mgarcia',
      email: 'maria@test.com',
      curp: null,
      gender: 'F',
      role: 'candidato',
      is_active: true,
      curp_verified: false,
      partner_name: 'Partner Uno',
      campus_name: 'Campus A',
      campus_state: 'CDMX',
      school_cycle: '2024-A',
      group_name: 'Grupo 1',
      standard_code: 'EC0217',
      standard_name: 'Impartición de cursos',
      standard_level: 3,
      standard_sector: 'Educación',
      brand_name: '',
      assignment_number: 'A002',
      exam_name: 'Examen EC0217',
      score: 40,
      score_1000: 400,
      result: 'Reprobado',
      result_date: '2024-06-15',
      duration_seconds: 2400,
      certificate_code: null,
      tramite_status: null,
      expires_at: null,
    },
  ],
  total: 50,
  page: 1,
  per_page: 5,
  pages: 10,
};


// ─── Helpers ───────────────────────────────────────────────────────────────

function renderPage(backPath = '/partners') {
  return render(
    <MemoryRouter>
      <ReportsPage backPath={backPath} />
    </MemoryRouter>
  );
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('ReportsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetReportFilters.mockResolvedValue(MOCK_FILTERS);
    mockGetReports.mockResolvedValue(MOCK_REPORT_RESPONSE);
    mockExportReports.mockResolvedValue(new Blob(['test'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    // Mock URL.createObjectURL / revokeObjectURL
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  // ═══ A. RENDERIZADO INICIAL ═══

  describe('Renderizado inicial', () => {
    it('muestra el spinner mientras carga filtros', () => {
      // Never-resolving promise to keep loading state
      mockGetReportFilters.mockReturnValue(new Promise(() => {}));
      renderPage();
      expect(screen.getByText(/cargando/i)).toBeInTheDocument();
    });

    it('muestra el título del módulo', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Generador de Reportes')).toBeInTheDocument();
      });
    });

    it('muestra las 4 secciones de columnas', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Nombre Completo')).toBeInTheDocument();
      });
      // Verify the 4 group sections exist via their count indicators (X/Y)
      const groupCounts = screen.getAllByText(/\(\d+\/\d+\)/);
      expect(groupCounts.length).toBe(4); // Usuario, Organización, Estándar, Resultado
    });

    it('muestra las 28 columnas disponibles', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Nombre Completo')).toBeInTheDocument();
      });
      expect(screen.getByText('CURP')).toBeInTheDocument();
      expect(screen.getByText('Plantel')).toBeInTheDocument();
      expect(screen.getByText('Calificación (0-100)')).toBeInTheDocument();
      expect(screen.getByText('Vigencia')).toBeInTheDocument();
    });

    it('las columnas defaultOn están seleccionadas inicialmente', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Generador de Reportes')).toBeInTheDocument();
      });
      // Default columns: full_name, username, partner_name, campus_name, group_name, standard_code, score, result = 8
      expect(screen.getByText(/8 columna/)).toBeInTheDocument();
    });

    it('muestra botones Todas / Ninguna', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Todas')).toBeInTheDocument();
      });
      expect(screen.getByText('Ninguna')).toBeInTheDocument();
    });

    it('muestra el botón Previsualizar Reporte', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /previsualizar reporte/i })).toBeInTheDocument();
      });
    });
  });

  // ═══ B. SELECTOR DE COLUMNAS ═══

  describe('Selector de columnas', () => {
    it('toggle individual - deseleccionar una columna', async () => {
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Nombre Completo')).toBeInTheDocument();
      });

      // Click "Nombre Completo" to deselect (it's default on)
      await user.click(screen.getByText('Nombre Completo'));
      // Should now show 7 columnas (was 8)
      expect(screen.getByText(/7 columna/)).toBeInTheDocument();
    });

    it('toggle individual - seleccionar una columna', async () => {
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Email')).toBeInTheDocument();
      });

      // Click "Email" to select (it's not default on)
      await user.click(screen.getByText('Email'));
      // Should now show 9 columnas (was 8)
      expect(screen.getByText(/9 columna/)).toBeInTheDocument();
    });

    it('seleccionar todas las columnas', async () => {
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Todas')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Todas'));
      expect(screen.getByText(/28 columna/)).toBeInTheDocument();
    });

    it('deseleccionar todas las columnas', async () => {
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Ninguna')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Ninguna'));
      expect(screen.getByText(/0 columna/)).toBeInTheDocument();
    });

    it('toggle de grupo selecciona/deselecciona todas las del grupo', async () => {
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Nombre Completo')).toBeInTheDocument();
      });

      // Click "Resultado" group header button (identified by its count indicator)
      // The group button contains "Resultado" + "(2/8)" count
      const resultGroupBtns = screen.getAllByText(/^Resultado$/);
      // The first "Resultado" is the group toggle button, second is the column chip
      await user.click(resultGroupBtns[0]);
      // Default: full_name, username, partner_name, campus_name, group_name, standard_code, score, result
      // Score and result are already in Resultado group, toggling adds 6 more = 14
      expect(screen.getByText(/14 columna/)).toBeInTheDocument();
    });
  });

  // ═══ C. GENERACIÓN DE PREVIEW ═══

  describe('Generación de vista previa', () => {
    it('muestra datos de preview al hacer click en Generar', async () => {
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /previsualizar reporte/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /previsualizar reporte/i }));

      await waitFor(() => {
        expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
      });
      expect(screen.getByText('María García')).toBeInTheDocument();
    });

    it('llama a getReports con page=1 y per_page=5', async () => {
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /previsualizar reporte/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /previsualizar reporte/i }));

      await waitFor(() => {
        expect(mockGetReports).toHaveBeenCalledWith(
          expect.objectContaining({ page: 1, per_page: 5 })
        );
      });
    });

    it('muestra indicador de registros adicionales', async () => {
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /previsualizar reporte/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /previsualizar reporte/i }));

      await waitFor(() => {
        // total=50, preview=2 rows → footer "X registros más en el reporte completo"
        const matches = screen.getAllByText((_content, el) => {
          return el?.tagName === 'P' && (el?.textContent?.includes('registros más en el reporte completo') ?? false);
        });
        expect(matches.length).toBeGreaterThan(0);
      });
    });

    it('muestra total de registros en header', async () => {
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /previsualizar reporte/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /previsualizar reporte/i }));

      await waitFor(() => {
        expect(screen.getByText(/50 registros/)).toBeInTheDocument();
      });
    });

    it('muestra advertencia si no hay columnas seleccionadas', async () => {
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Ninguna')).toBeInTheDocument();
      });

      // Deselect all
      await user.click(screen.getByText('Ninguna'));

      // The inline warning is always visible when 0 columns selected
      expect(screen.getByText(/selecciona al menos una columna/i)).toBeInTheDocument();
      // The Previsualizar button should be disabled
      const btn = screen.getByRole('button', { name: /previsualizar reporte/i });
      expect(btn).toBeDisabled();
    });

    it('muestra error del API correctamente', async () => {
      mockGetReports.mockRejectedValueOnce({
        response: { data: { error: 'Error del servidor' } },
      });
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /previsualizar reporte/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /previsualizar reporte/i }));

      await waitFor(() => {
        expect(screen.getByText('Error del servidor')).toBeInTheDocument();
      });
    });
  });

  // ═══ D. EXPORTACIÓN ═══

  describe('Exportación a Excel', () => {
    it('el botón Descargar Excel está visible', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/^Descargar Excel$/i)).toBeInTheDocument();
      });
    });

    it('llama a exportReports con las columnas seleccionadas', async () => {
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/^Descargar Excel$/i)).toBeInTheDocument();
      });

      await user.click(screen.getByText(/^Descargar Excel$/i));

      await waitFor(() => {
        expect(mockExportReports).toHaveBeenCalledTimes(1);
        const [params, columns] = mockExportReports.mock.calls[0];
        expect(columns).toBeInstanceOf(Array);
        expect(columns.length).toBeGreaterThan(0);
        // Default columns should include full_name
        expect(columns).toContain('full_name');
      });
    });

    it('crea un enlace de descarga temporal', async () => {
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/^Descargar Excel$/i)).toBeInTheDocument();
      });

      await user.click(screen.getByText(/^Descargar Excel$/i));

      await waitFor(() => {
        expect(mockExportReports).toHaveBeenCalledTimes(1);
      });

      // Verify blob URL was created and cleaned up
      expect(globalThis.URL.createObjectURL).toHaveBeenCalled();
      expect(globalThis.URL.revokeObjectURL).toHaveBeenCalled();
    });
  });

  // ═══ E. FILTROS ═══

  describe('Filtros', () => {
    it('carga filtros desde el API al montar', async () => {
      renderPage();
      await waitFor(() => {
        expect(mockGetReportFilters).toHaveBeenCalledTimes(1);
      });
    });

    it('muestra sección de filtros con el toggle', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/filtros opcionales/i)).toBeInTheDocument();
      });
    });

    it('los filtros están colapsados por defecto', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/filtros opcionales/i)).toBeInTheDocument();
      });
      // Los selects de filtro no deben ser visibles (el panel está colapsado)
      expect(screen.queryByText('Limpiar filtros')).not.toBeInTheDocument();
    });
  });

  // ═══ F. EDGE CASES ═══

  describe('Edge cases', () => {
    it('funciona cuando el API retorna 0 registros', async () => {
      mockGetReports.mockResolvedValueOnce({
        rows: [],
        total: 0,
        page: 1,
        per_page: 5,
        pages: 0,
      });

      const user = userEvent.setup();
      renderPage();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /previsualizar reporte/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /previsualizar reporte/i }));

      await waitFor(() => {
        // With 0 results, the preview section renders "Mostrando 0 de 0 registros"
        const summaryEl = screen.getAllByText((_content, el) =>
          el?.tagName === 'P' && (el?.textContent?.includes('Mostrando') ?? false)
        );
        expect(summaryEl.length).toBeGreaterThan(0);
      });
    });

    it('funciona cuando filtros falla silenciosamente', async () => {
      mockGetReportFilters.mockRejectedValueOnce(new Error('Network error'));
      renderPage();
      // Debe renderizar sin crash
      await waitFor(() => {
        expect(screen.getByText('Generador de Reportes')).toBeInTheDocument();
      });
    });

    it('acepta backPath personalizado', async () => {
      renderPage('/mi-plantel');
      await waitFor(() => {
        expect(screen.getByText('Generador de Reportes')).toBeInTheDocument();
      });
    });
  });
});
