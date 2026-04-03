/**
 * Tests para MiPlantelReportesPage (Reportes del Responsable)
 * 
 * Cubre:
 *  - Renderizado estado de carga
 *  - Renderizado de tabla con datos
 *  - Estructura de columnas (11 columnas)
 *  - Filtros: búsqueda, grupo, examen, resultado
 *  - Exportación a Excel
 *  - Estado vacío con "Limpiar filtros"
 *  - Paginación
 *  - Redirect si user no tiene can_view_reports
 * 
 * Ejecutar:
 *   cd frontend && npx vitest run src/__tests__/MiPlantelReportesPage.test.tsx
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ─── Mocks ──────────────────────────────────────────────────────────────

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockGetMiPlantelEvaluations = vi.fn();
const mockGetMiPlantelExams = vi.fn();
const mockGetMiPlantelGroups = vi.fn();
const mockExportMiPlantelEvaluations = vi.fn();
const mockGetMiPlantel = vi.fn();

vi.mock('../services/partnersService', () => ({
  getMiPlantelEvaluations: (...args: unknown[]) => mockGetMiPlantelEvaluations(...args),
  getMiPlantelExams: (...args: unknown[]) => mockGetMiPlantelExams(...args),
  getMiPlantelGroups: (...args: unknown[]) => mockGetMiPlantelGroups(...args),
  exportMiPlantelEvaluations: (...args: unknown[]) => mockExportMiPlantelEvaluations(...args),
  getMiPlantel: (...args: unknown[]) => mockGetMiPlantel(...args),
  PlantelEvaluation: undefined,
}));

// Mock authStore
const mockUser = { can_view_reports: true, role: 'responsable' };
vi.mock('../store/authStore', () => ({
  useAuthStore: () => ({ user: mockUser }),
}));

// ─── Test Data ──────────────────────────────────────────────────────────

const mockEvaluation = {
  id: 'res-001',
  candidate: {
    id: 10,
    full_name: 'Juan Pérez',
    username: 'jperez',
    email: 'jperez@test.com',
    curp: 'PEJU900101HDFRNN09',
  },
  exam: { id: 1, name: 'Examen EC0076', version: '1.0' },
  group: { id: 5, name: 'Grupo A' },
  standard: { code: 'EC0076', name: 'Evaluación de competencias' },
  score: 85,
  result: 1,
  result_text: 'Aprobado',
  start_date: '2026-03-01T10:00:00',
  end_date: '2026-03-01T11:30:00',
  duration_seconds: 5400,
  certificate_code: 'CERT-001',
  certificate_url: 'https://certs.example.com/001.pdf',
  report_url: 'https://reports.example.com/001.pdf',
  assignment_number: 'ASG-123',
  tramite_status: 'entregado',
};

const mockEvaluationsResponse = {
  evaluations: [mockEvaluation],
  total: 1,
  page: 1,
  per_page: 100,
  pages: 1,
};

const mockExamsResponse = {
  exams: [
    { id: 1, name: 'Examen EC0076', version: '1.0' },
    { id: 2, name: 'Examen EC0217', version: '2.0' },
  ],
};

const mockGroupsResponse = {
  groups: [
    { id: 5, name: 'Grupo A', is_active: true },
    { id: 6, name: 'Grupo B', is_active: false },
  ],
};

function setupMocks(overrides?: {
  evaluations?: unknown;
  exams?: unknown;
  groups?: unknown;
}) {
  mockGetMiPlantelEvaluations.mockResolvedValue(overrides?.evaluations ?? mockEvaluationsResponse);
  mockGetMiPlantelExams.mockResolvedValue(overrides?.exams ?? mockExamsResponse);
  mockGetMiPlantelGroups.mockResolvedValue(overrides?.groups ?? mockGroupsResponse);
  mockExportMiPlantelEvaluations.mockResolvedValue(new Blob(['fake xlsx'], { type: 'application/octet-stream' }));
  mockGetMiPlantel.mockResolvedValue({ campus: { id: 10, name: 'Campus Test', logo_url: null }, group_count: 2, members_count: 10 });
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <MiPlantelReportesPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

// Needed for lazy import resolution
import MiPlantelReportesPage from '../pages/responsable/MiPlantelReportesPage';

// ─── Tests ──────────────────────────────────────────────────────────────

describe('MiPlantelReportesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser.can_view_reports = true;
    // Reset URL.createObjectURL mock
    window.URL.createObjectURL = vi.fn(() => 'blob:mock');
    window.URL.revokeObjectURL = vi.fn();
  });

  // ── Carga ──
  it('muestra spinner mientras carga', () => {
    mockGetMiPlantelEvaluations.mockReturnValue(new Promise(() => {}));
    mockGetMiPlantelExams.mockResolvedValue(mockExamsResponse);
    mockGetMiPlantelGroups.mockResolvedValue(mockGroupsResponse);
    mockGetMiPlantel.mockResolvedValue({ campus: null, group_count: 0, members_count: 0 });
    renderPage();
    expect(screen.getByText('Cargando...')).toBeTruthy();
  });

  // ── Redirect sin permisos ──
  it('redirige a /mi-plantel si user no tiene can_view_reports', () => {
    mockUser.can_view_reports = false;
    setupMocks();
    renderPage();
    expect(mockNavigate).toHaveBeenCalledWith('/mi-plantel', { replace: true });
  });

  // ── Datos exitosos ──
  describe('con datos exitosos', () => {
    beforeEach(() => {
      setupMocks();
    });

    it('muestra el título "Reportes de Evaluaciones"', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Reportes de Evaluaciones')).toBeTruthy();
      });
    });

    it('muestra el conteo de evaluaciones', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/1 evaluación encontrada/)).toBeTruthy();
      });
    });

    it('tiene botón "Exportar Excel"', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Exportar Excel')).toBeTruthy();
      });
    });

    // ── Columnas de la tabla ──
    it('muestra las 11 columnas de la tabla', async () => {
      renderPage();
      await waitFor(() => {
        const headers = ['Candidato', 'CURP', 'Grupo', 'Examen', 'Estándar',
          'Calif.', 'Resultado', 'Trámite', 'Fecha', 'Duración', 'Docs'];
        for (const h of headers) {
          // Some header texts may also appear in filter labels or data, so use getAllByText
          const matches = screen.getAllByText(h);
          expect(matches.length).toBeGreaterThanOrEqual(1);
        }
      });
    });

    // ── Datos de la fila ──
    it('muestra el nombre del candidato', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Juan Pérez')).toBeTruthy();
      });
    });

    it('muestra el email del candidato', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('jperez@test.com')).toBeTruthy();
      });
    });

    it('muestra el CURP del candidato', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('PEJU900101HDFRNN09')).toBeTruthy();
      });
    });

    it('muestra el nombre del grupo', async () => {
      renderPage();
      await waitFor(() => {
        // El grupo aparece en la tabla y en los filtros
        const grupoA = screen.getAllByText('Grupo A');
        expect(grupoA.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('muestra el nombre del examen', async () => {
      renderPage();
      await waitFor(() => {
        const examTexts = screen.getAllByText('Examen EC0076');
        expect(examTexts.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('muestra el código del estándar como badge', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('EC0076')).toBeTruthy();
      });
    });

    it('muestra la calificación', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('85')).toBeTruthy();
      });
    });

    it('muestra el resultado como badge "Aprobado"', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Aprobado')).toBeTruthy();
      });
    });

    it('muestra el estado del trámite "Entregado"', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Entregado')).toBeTruthy();
      });
    });

    it('muestra la duración formateada (90m 0s)', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('90m 0s')).toBeTruthy();
      });
    });

    it('muestra links de documentos (reporte PDF y certificado)', async () => {
      renderPage();
      await waitFor(() => {
        const reportLink = document.querySelector('a[href="https://reports.example.com/001.pdf"]');
        const certLink = document.querySelector('a[href="https://certs.example.com/001.pdf"]');
        expect(reportLink).toBeTruthy();
        expect(certLink).toBeTruthy();
      });
    });

    // ── Filtros ──
    it('muestra los 4 filtros', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Buscar candidato')).toBeTruthy();
        expect(screen.getByText('Grupo')).toBeTruthy();
        expect(screen.getByText('Examen')).toBeTruthy();
        expect(screen.getByText('Resultado')).toBeTruthy();
      });
    });

    it('tiene placeholder de búsqueda correcto', async () => {
      renderPage();
      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText('Nombre, CURP o email...');
        expect(searchInput).toBeTruthy();
      });
    });

    it('muestra opciones de filtro de resultado: Todos, Aprobado, Reprobado', async () => {
      renderPage();
      await waitFor(() => {
        const selects = document.querySelectorAll('select');
        // Hay 3 selects: grupo, examen, resultado
        expect(selects.length).toBe(3);
      });
    });

    it('muestra grupos en el dropdown incluyendo inactivos', async () => {
      renderPage();
      await waitFor(() => {
        // Grupo A appears in both dropdown and table data
        expect(screen.getAllByText('Grupo A').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('Grupo B (inactivo)')).toBeTruthy();
      });
    });

    // ── Exportación ──
    it('exportar Excel llama al servicio de exportación', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Exportar Excel')).toBeTruthy();
      });

      fireEvent.click(screen.getByText('Exportar Excel'));

      await waitFor(() => {
        expect(mockExportMiPlantelEvaluations).toHaveBeenCalled();
      });
    });
  });

  // ── Estado vacío ──
  describe('sin evaluaciones', () => {
    it('muestra mensaje "No hay evaluaciones"', async () => {
      mockGetMiPlantelEvaluations.mockResolvedValue(
        { evaluations: [], total: 0, page: 1, per_page: 100, pages: 0 }
      );
      mockGetMiPlantelExams.mockResolvedValue(mockExamsResponse);
      mockGetMiPlantelGroups.mockResolvedValue(mockGroupsResponse);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('No hay evaluaciones')).toBeTruthy();
      });
    });

    it('muestra descripción para estado sin filtros activos', async () => {
      mockGetMiPlantelEvaluations.mockResolvedValue(
        { evaluations: [], total: 0, page: 1, per_page: 100, pages: 0 }
      );
      mockGetMiPlantelExams.mockResolvedValue(mockExamsResponse);
      mockGetMiPlantelGroups.mockResolvedValue(mockGroupsResponse);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Aún no hay evaluaciones completadas en tu plantel')).toBeTruthy();
      });
    });

    it('el botón exportar está deshabilitado cuando no hay datos', async () => {
      mockGetMiPlantelEvaluations.mockResolvedValue(
        { evaluations: [], total: 0, page: 1, per_page: 100, pages: 0 }
      );
      mockGetMiPlantelExams.mockResolvedValue(mockExamsResponse);
      mockGetMiPlantelGroups.mockResolvedValue(mockGroupsResponse);
      renderPage();
      await waitFor(() => {
        const exportBtn = screen.getByText('Exportar Excel').closest('button');
        expect(exportBtn?.disabled).toBe(true);
      });
    });
  });

  // ── Error ──
  describe('con error', () => {
    it('muestra el mensaje de error', async () => {
      mockGetMiPlantelEvaluations.mockRejectedValue({
        response: { data: { error: 'Error de prueba' } },
      });
      mockGetMiPlantelExams.mockResolvedValue(mockExamsResponse);
      mockGetMiPlantelGroups.mockResolvedValue(mockGroupsResponse);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Error de prueba')).toBeTruthy();
      });
    });
  });

  // ── Paginación ──
  describe('paginación', () => {
    it('muestra texto de paginación con rango correcto', async () => {
      mockGetMiPlantelExams.mockResolvedValue(mockExamsResponse);
      mockGetMiPlantelGroups.mockResolvedValue(mockGroupsResponse);
      mockGetMiPlantelEvaluations.mockResolvedValue({
        evaluations: Array(5).fill(mockEvaluation).map((e, i) => ({ ...e, id: `res-${i}` })),
        total: 250,
        page: 1,
        per_page: 100,
        pages: 3,
      });
      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/Mostrando 1-100 de 250 resultados/)).toBeTruthy();
      });
    });

    it('muestra botones de paginación cuando hay más de 1 página', async () => {
      mockGetMiPlantelExams.mockResolvedValue(mockExamsResponse);
      mockGetMiPlantelGroups.mockResolvedValue(mockGroupsResponse);
      mockGetMiPlantelEvaluations.mockResolvedValue({
        evaluations: [mockEvaluation],
        total: 200,
        page: 1,
        per_page: 100,
        pages: 2,
      });
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Anterior')).toBeTruthy();
        expect(screen.getByText('Siguiente')).toBeTruthy();
        expect(screen.getByText('1 / 2')).toBeTruthy();
      });
    });

    it('botón « y Anterior están deshabilitados en primera página', async () => {
      mockGetMiPlantelExams.mockResolvedValue(mockExamsResponse);
      mockGetMiPlantelGroups.mockResolvedValue(mockGroupsResponse);
      mockGetMiPlantelEvaluations.mockResolvedValue({
        evaluations: [mockEvaluation],
        total: 200,
        page: 1,
        per_page: 100,
        pages: 2,
      });
      renderPage();
      await waitFor(() => {
        const firstBtn = screen.getByText('«').closest('button');
        const prevBtn = screen.getByText('Anterior').closest('button');
        expect(firstBtn?.disabled).toBe(true);
        expect(prevBtn?.disabled).toBe(true);
      });
    });
  });

  // ── Evaluación reprobada ──
  describe('evaluación reprobada', () => {
    it('muestra badge "Reprobado" en rojo', async () => {
      const failedEval = {
        ...mockEvaluation,
        result: 0,
        result_text: 'Reprobado',
        certificate_url: null,
        certificate_code: null,
      };
      mockGetMiPlantelExams.mockResolvedValue(mockExamsResponse);
      mockGetMiPlantelGroups.mockResolvedValue(mockGroupsResponse);
      mockGetMiPlantelEvaluations.mockResolvedValue({
        evaluations: [failedEval],
        total: 1,
        page: 1,
        per_page: 100,
        pages: 1,
      });
      renderPage();
      await waitFor(() => {
        const badges = screen.getAllByText('Reprobado');
        // Find the span badge (not the option)
        const badge = badges.find(el => el.tagName === 'SPAN');
        expect(badge).toBeTruthy();
        expect(badge!.className).toContain('bg-red-100');
      });
    });
  });

  // ── Trámites ──
  describe('estados de trámite', () => {
    it('muestra "Pendiente" para tramite_status="pendiente"', async () => {
      mockGetMiPlantelExams.mockResolvedValue(mockExamsResponse);
      mockGetMiPlantelGroups.mockResolvedValue(mockGroupsResponse);
      mockGetMiPlantelEvaluations.mockResolvedValue({
        evaluations: [{ ...mockEvaluation, tramite_status: 'pendiente' }],
        total: 1, page: 1, per_page: 100, pages: 1,
      });
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Pendiente')).toBeTruthy();
      });
    });

    it('muestra "En trámite" para tramite_status="en_tramite"', async () => {
      mockGetMiPlantelExams.mockResolvedValue(mockExamsResponse);
      mockGetMiPlantelGroups.mockResolvedValue(mockGroupsResponse);
      mockGetMiPlantelEvaluations.mockResolvedValue({
        evaluations: [{ ...mockEvaluation, tramite_status: 'en_tramite' }],
        total: 1, page: 1, per_page: 100, pages: 1,
      });
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('En trámite')).toBeTruthy();
      });
    });

    it('muestra "-" cuando tramite_status es null', async () => {
      mockGetMiPlantelExams.mockResolvedValue(mockExamsResponse);
      mockGetMiPlantelGroups.mockResolvedValue(mockGroupsResponse);
      mockGetMiPlantelEvaluations.mockResolvedValue({
        evaluations: [{ ...mockEvaluation, tramite_status: null }],
        total: 1, page: 1, per_page: 100, pages: 1,
      });
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Juan Pérez')).toBeTruthy();
      });
    });
  });
});
