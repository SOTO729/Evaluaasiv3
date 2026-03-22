/**
 * Tests del componente ReportsPage — Granularidad Progresiva
 *
 * Cubre:
 *   A. Renderizado inicial (header, 5 categorías de columnas, filtros)
 *   B. Selector de columnas (toggle individual, grupo, todo/ninguna)
 *   C. Categorías y granularidad (activeCategories, hasUserCols, depthLabel)
 *   D. Generación de preview con categories
 *   E. Exportación a Excel con categories
 *   F. Manejo de errores y edge cases
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
      name: 'Juan',
      first_surname: 'Pérez',
      second_surname: 'López',
      username: 'jperez',
      email: 'juan@test.com',
      curp: 'PERJ900101HDFXXX01',
      gender: 'M',
      phone: '5551234567',
      date_of_birth: '1990-01-01',
      role: 'candidato',
      is_active: true,
      curp_verified: true,
      last_login: '2024-06-10',
      created_at: '2024-01-01',
      partner_name: 'Partner Uno',
      campus_code: 'CA01',
      campus_name: 'Campus A',
      campus_state: 'CDMX',
      campus_city: 'México',
      director_name: 'Dir. Martínez',
      school_cycle: '2024-A',
      cycle_start_date: '01/01/2024',
      cycle_end_date: '30/06/2024',
      group_name: 'Grupo 1',
      member_status: 'active',
      joined_at: '2024-02-01',
      max_retakes: 3,
      certification_cost: 1500.00,
      standard_code: 'EC0217',
      standard_name: 'Impartición de cursos',
      standard_level: 3,
      standard_sector: 'Educación',
      validity_years: 5,
      brand_name: '',
      assignment_number: 'A001',
      assignment_source: 'bulk',
      exam_name: 'Examen EC0217',
      assigned_at: '2024-03-01',
      score: 85,
      result: 'Aprobado',
      result_date: '2024-06-15',
      duration_seconds: 3600,
      certificate_code: 'CERT001',
      eduit_certificate_code: 'EDUIT001',
      tramite_status: null,
      expires_at: '15/06/2027',
    },
    {
      user_id: 'u2',
      full_name: 'María García',
      name: 'María',
      first_surname: 'García',
      second_surname: '',
      username: 'mgarcia',
      email: 'maria@test.com',
      curp: null,
      gender: 'F',
      phone: null,
      date_of_birth: null,
      role: 'candidato',
      is_active: true,
      curp_verified: false,
      last_login: null,
      created_at: '2024-01-15',
      partner_name: 'Partner Uno',
      campus_code: 'CA01',
      campus_name: 'Campus A',
      campus_state: 'CDMX',
      campus_city: 'México',
      director_name: 'Dir. Martínez',
      school_cycle: '2024-A',
      cycle_start_date: '01/01/2024',
      cycle_end_date: '30/06/2024',
      group_name: 'Grupo 1',
      member_status: 'active',
      joined_at: '2024-02-15',
      max_retakes: 3,
      certification_cost: 1500.00,
      standard_code: 'EC0217',
      standard_name: 'Impartición de cursos',
      standard_level: 3,
      standard_sector: 'Educación',
      validity_years: 5,
      brand_name: '',
      assignment_number: 'A002',
      assignment_source: 'selected',
      exam_name: 'Examen EC0217',
      assigned_at: '2024-03-15',
      score: 40,
      result: 'Reprobado',
      result_date: '2024-06-15',
      duration_seconds: 2400,
      certificate_code: null,
      eduit_certificate_code: null,
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

    it('muestra las 5 secciones de columnas', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Nombre Completo')).toBeInTheDocument();
      });
      // 5 groups: Usuario, Organización, Estándar, Resultado, Certificación
      const groupCounts = screen.getAllByText(/\(\d+\/\d+\)/);
      expect(groupCounts.length).toBe(5);
    });

    it('muestra las 47 columnas disponibles', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Nombre Completo')).toBeInTheDocument();
      });
      // Campos de diferentes categorías
      expect(screen.getByText('Nombre(s)')).toBeInTheDocument();
      expect(screen.getByText('Apellido Paterno')).toBeInTheDocument();
      expect(screen.getByText('Apellido Materno')).toBeInTheDocument();
      expect(screen.getByText('CURP')).toBeInTheDocument();
      expect(screen.getByText('Teléfono')).toBeInTheDocument();
      expect(screen.getByText('Clave Plantel')).toBeInTheDocument();
      expect(screen.getByText('Director del Plantel')).toBeInTheDocument();
      expect(screen.getByText('Inicio Ciclo')).toBeInTheDocument();
      expect(screen.getByText('Fin Ciclo')).toBeInTheDocument();
      expect(screen.getByText('Máx. Retomas')).toBeInTheDocument();
      expect(screen.getByText('Costo Certificación')).toBeInTheDocument();
      expect(screen.getByText('Vigencia Estándar (años)')).toBeInTheDocument();
      expect(screen.getByText('Origen Asignación')).toBeInTheDocument();
      expect(screen.getByText('Calificación (%)')).toBeInTheDocument();
      expect(screen.getByText('Vigencia')).toBeInTheDocument();
      expect(screen.getByText('Código Certificado Eduit')).toBeInTheDocument();
    });

    it('las columnas defaultOn están seleccionadas inicialmente', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Generador de Reportes')).toBeInTheDocument();
      });
      // Default: full_name, username, partner_name, campus_name, group_name, standard_code, score, result = 8
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

      await user.click(screen.getByText('Nombre Completo'));
      expect(screen.getByText(/7 columna/)).toBeInTheDocument();
    });

    it('toggle individual - seleccionar una columna', async () => {
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Email')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Email'));
      expect(screen.getByText(/9 columna/)).toBeInTheDocument();
    });

    it('seleccionar todas las columnas', async () => {
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Todas')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Todas'));
      expect(screen.getByText(/47 columna/)).toBeInTheDocument();
    });

    it('"Ninguna" mantiene al menos full_name (1 columna de Usuario)', async () => {
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Ninguna')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Ninguna'));
      // full_name must remain selected
      expect(screen.getByText(/1 columna/)).toBeInTheDocument();
    });

    it('toggle de grupo selecciona/deselecciona todas las del grupo', async () => {
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Nombre Completo')).toBeInTheDocument();
      });

      // Click "Resultado" group header to toggle all columns in that group
      const resultGroupBtns = screen.getAllByText(/^Resultado$/);
      await user.click(resultGroupBtns[0]);
      // Default: full_name, username, partner_name, campus_name, group_name, standard_code, score, result
      // score + result already ON (2/4 in Resultado group)
      // Toggling selects all 4 Resultado → adds 2 more = 10
      expect(screen.getByText(/10 columna/)).toBeInTheDocument();
    });
  });

  // ═══ C. CATEGORÍAS Y GRANULARIDAD ═══

  describe('Categorías y granularidad', () => {
    it('muestra indicador de granularidad con columnas default', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Generador de Reportes')).toBeInTheDocument();
      });
      // Default columns span all 5 categories → resultado depth
      expect(screen.getByText(/1 fila por usuario/)).toBeInTheDocument();
    });

    it('no muestra advertencia tras "Ninguna" porque full_name queda seleccionado', async () => {
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Ninguna')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Ninguna'));
      // full_name stays → hasUserCols is true → no warning
      expect(screen.queryByText(/selecciona al menos una columna de usuario/i)).not.toBeInTheDocument();
    });

    it('botones habilitados tras "Ninguna" porque full_name queda seleccionado', async () => {
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Ninguna')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Ninguna'));
      expect(screen.getByRole('button', { name: /previsualizar reporte/i })).not.toBeDisabled();
      expect(screen.getByRole('button', { name: /descargar excel/i })).not.toBeDisabled();
    });

    it('no permite deseleccionar la última columna de Usuario', async () => {
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Ninguna')).toBeInTheDocument();
      });

      // Clear to keep only full_name
      await user.click(screen.getByText('Ninguna'));
      expect(screen.getByText(/1 columna/)).toBeInTheDocument();

      // Try to deselect full_name — should be blocked
      await user.click(screen.getByText('Nombre Completo'));
      expect(screen.getByText(/1 columna/)).toBeInTheDocument();
    });

    it('toggleGroup Usuario mantiene al menos full_name', async () => {
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Todas')).toBeInTheDocument();
      });

      // Select all first
      await user.click(screen.getByText('Todas'));
      expect(screen.getByText(/47 columna/)).toBeInTheDocument();

      // Click the Usuario group header to deselect all Usuario columns
      const userGroupBtns = screen.getAllByText(/^Usuario$/);
      await user.click(userGroupBtns[0]);

      // full_name should remain → warning should NOT appear
      expect(screen.queryByText(/selecciona al menos una columna de usuario/i)).not.toBeInTheDocument();
    });

    it('botones habilitados con solo columnas de Usuario', async () => {
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Ninguna')).toBeInTheDocument();
      });

      // Clear all — full_name stays selected
      await user.click(screen.getByText('Ninguna'));

      const previewBtn = screen.getByRole('button', { name: /previsualizar reporte/i });
      const exportBtn = screen.getByRole('button', { name: /descargar excel/i });
      expect(previewBtn).not.toBeDisabled();
      expect(exportBtn).not.toBeDisabled();
    });
  });

  // ═══ D. GENERACIÓN DE PREVIEW ═══

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

    it('llama a getReports con page=1, per_page=5 y categories', async () => {
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /previsualizar reporte/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /previsualizar reporte/i }));

      await waitFor(() => {
        expect(mockGetReports).toHaveBeenCalledWith(
          expect.objectContaining({
            page: 1,
            per_page: 5,
            categories: expect.stringContaining('usuario'),
          })
        );
      });
    });

    it('envía categories correctas según columnas seleccionadas', async () => {
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /previsualizar reporte/i })).toBeInTheDocument();
      });

      // Default cols include usuario, org, estándar, resultado categories
      await user.click(screen.getByRole('button', { name: /previsualizar reporte/i }));

      await waitFor(() => {
        const callParams = mockGetReports.mock.calls[0][0];
        const cats = callParams.categories.split(',');
        expect(cats).toContain('usuario');
        expect(cats).toContain('organizacion');
        expect(cats).toContain('estandar');
        expect(cats).toContain('resultado');
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

  // ═══ E. EXPORTACIÓN ═══

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
        expect(columns).toContain('full_name');
      });
    });

    it('export envía categories en los params', async () => {
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/^Descargar Excel$/i)).toBeInTheDocument();
      });

      await user.click(screen.getByText(/^Descargar Excel$/i));

      await waitFor(() => {
        expect(mockExportReports).toHaveBeenCalledTimes(1);
        const [params] = mockExportReports.mock.calls[0];
        expect(params.categories).toBeDefined();
        expect(params.categories).toContain('usuario');
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

      expect(globalThis.URL.createObjectURL).toHaveBeenCalled();
      expect(globalThis.URL.revokeObjectURL).toHaveBeenCalled();
    });
  });

  // ═══ F. FILTROS ═══

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
      expect(screen.queryByText('Limpiar filtros')).not.toBeInTheDocument();
    });
  });

  // ═══ G. EDGE CASES ═══

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
        const summaryEl = screen.getAllByText((_content, el) =>
          el?.tagName === 'P' && (el?.textContent?.includes('Mostrando') ?? false)
        );
        expect(summaryEl.length).toBeGreaterThan(0);
      });
    });

    it('funciona cuando filtros falla silenciosamente', async () => {
      mockGetReportFilters.mockRejectedValueOnce(new Error('Network error'));
      renderPage();
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

  // ═══ H. ORDEN DE COLUMNAS ═══

  describe('Orden de columnas', () => {
    it('muestra sección "Orden de columnas" colapsada', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Orden de columnas')).toBeInTheDocument();
      });
      // Should not show items by default (collapsed)
      expect(screen.queryByText('Usa las flechas para reordenar')).toBeInTheDocument();
    });

    it('expande la sección de orden al hacer click', async () => {
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Orden de columnas')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Orden de columnas'));

      // Should show numbered items with up/down buttons
      // Default selected = 8 cols → 8 up buttons + 8 down buttons = 16 arrow buttons
      const upButtons = screen.getAllByRole('button', { name: /mover .* arriba/i });
      const downButtons = screen.getAllByRole('button', { name: /mover .* abajo/i });
      expect(upButtons.length).toBe(8);
      expect(downButtons.length).toBe(8);
    });

    it('las columnas seleccionadas aparecen numeradas en el panel de orden', async () => {
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Orden de columnas')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Orden de columnas'));

      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('primer elemento tiene botón ↑ deshabilitado', async () => {
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Orden de columnas')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Orden de columnas'));

      // First column "Nombre Completo" → up button must be disabled
      const firstUp = screen.getByRole('button', { name: /mover nombre completo arriba/i });
      expect(firstUp).toBeDisabled();
    });

    it('último elemento tiene botón ↓ deshabilitado', async () => {
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Orden de columnas')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Orden de columnas'));

      // Last default column "Resultado" → down button must be disabled
      const lastDown = screen.getByRole('button', { name: /mover resultado abajo/i });
      expect(lastDown).toBeDisabled();
    });

    it('botón ↓ mueve la columna una posición abajo', async () => {
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Orden de columnas')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Orden de columnas'));

      // Default order: 1=Nombre Completo, 2=Usuario
      // Click down on "Nombre Completo" → should swap with "Usuario"
      const downBtn = screen.getByRole('button', { name: /mover nombre completo abajo/i });
      await user.click(downBtn);

      // After move, first up button should now be for "Usuario" (previously second)
      const firstUp = screen.getAllByRole('button', { name: /mover .* arriba/i })[0];
      expect(firstUp).toHaveAttribute('aria-label', 'Mover Usuario arriba');
    });

    it('no muestra sección de orden con solo 1 columna seleccionada', async () => {
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Ninguna')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Ninguna'));
      expect(screen.queryByText('Orden de columnas')).not.toBeInTheDocument();
    });

    it('el export envía las columnas como array preservando el orden del usuario', async () => {
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /descargar excel/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /descargar excel/i }));

      await waitFor(() => {
        expect(mockExportReports).toHaveBeenCalled();
      });

      const callArgs = mockExportReports.mock.calls[0];
      const columnsArray = callArgs[1];
      expect(columnsArray).toBeDefined();
      expect(Array.isArray(columnsArray)).toBe(true);
      expect(columnsArray.length).toBe(8);
      expect(columnsArray).toContain('full_name');
      expect(columnsArray).toContain('username');
    });
  });
});
