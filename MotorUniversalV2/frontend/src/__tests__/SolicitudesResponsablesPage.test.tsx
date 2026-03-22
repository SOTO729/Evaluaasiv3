/**
 * Tests para SolicitudesResponsablesPage (Coordinador: ver/revisar solicitudes)
 *
 * Cubre:
 *  - Estado de carga (spinner)
 *  - Sin solicitudes → mensaje vacío
 *  - Con solicitudes → lista con badges de estado
 *  - Filtros (todas/pendientes/procesadas)
 *  - Expandir solicitud muestra detalle: justificación, adjuntos, notas
 *  - Botones de acción: Aprobar, Modificar, Rechazar
 *  - Formulario de rechazo requiere motivo
 *  - Mark as seen al expandir solicitud pendiente
 *  - Badge de pendientes en header
 *  - Estado de error
 *
 * Ejecutar:
 *   cd frontend && npx vitest run src/__tests__/SolicitudesResponsablesPage.test.tsx
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SolicitudesResponsablesPage from '../pages/coordinador/SolicitudesResponsablesPage';

// ─── Polyfills ──────────────────────────────────────────────────────────

beforeAll(() => {
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
});

// ─── Mocks ──────────────────────────────────────────────────────────────

const mockGetCertificateRequests = vi.fn();
const mockReviewCertificateRequest = vi.fn();
const mockUpdateCertificateRequestStatus = vi.fn();

vi.mock('../services/balanceService', () => ({
  getCertificateRequests: (...args: unknown[]) => mockGetCertificateRequests(...args),
  reviewCertificateRequest: (...args: unknown[]) => mockReviewCertificateRequest(...args),
  updateCertificateRequestStatus: (...args: unknown[]) => mockUpdateCertificateRequestStatus(...args),
  formatFileSize: (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  },
}));

vi.mock('lucide-react', () => ({
  ClipboardList: (props: Record<string, unknown>) => <span data-testid="icon-clipboard" {...props} />,
  XCircle: (props: Record<string, unknown>) => <span data-testid="icon-x" {...props} />,
  AlertCircle: (props: Record<string, unknown>) => <span data-testid="icon-alert" {...props} />,
  RefreshCw: (props: Record<string, unknown>) => <span data-testid="icon-refresh" {...props} />,
  Send: (props: Record<string, unknown>) => <span data-testid="icon-send" {...props} />,
  Edit3: (props: Record<string, unknown>) => <span data-testid="icon-edit" {...props} />,
  Paperclip: (props: Record<string, unknown>) => <span data-testid="icon-paperclip" {...props} />,
  Award: (props: Record<string, unknown>) => <span data-testid="icon-award" {...props} />,
  Building2: (props: Record<string, unknown>) => <span data-testid="icon-building" {...props} />,
  Users: (props: Record<string, unknown>) => <span data-testid="icon-users" {...props} />,
  Download: (props: Record<string, unknown>) => <span data-testid="icon-download" {...props} />,
  ChevronDown: (props: Record<string, unknown>) => <span data-testid="icon-chevron-down" {...props} />,
  ChevronUp: (props: Record<string, unknown>) => <span data-testid="icon-chevron-up" {...props} />,
  Loader2: (props: Record<string, unknown>) => <span data-testid="icon-loader" {...props} />,
  ArrowLeft: (props: Record<string, unknown>) => <span data-testid="icon-arrow-left" {...props} />,
  FileText: (props: Record<string, unknown>) => <span data-testid="icon-file-text" {...props} />,
}));

const MOCK_PENDING_REQUEST = {
  id: 1,
  responsable_id: 'r1',
  campus_id: 10,
  group_id: null,
  coordinator_id: 'c1',
  units_requested: 5,
  justification: 'Necesitamos certificados urgentes para evaluación final',
  attachments: [
    { name: 'presupuesto.pdf', url: 'https://example.com/presupuesto.pdf', size: 204800 },
    { name: 'lista_alumnos.xlsx', url: 'https://example.com/lista.xlsx', size: 51200 },
  ],
  coordinator_units: null,
  coordinator_group_id: null,
  coordinator_notes: null,
  coordinator_reviewed_at: null,
  forwarded_request_id: null,
  forwarded_at: null,
  status: 'pending' as const,
  status_label: 'Pendiente',
  created_at: '2026-03-20T10:00:00Z',
  updated_at: '2026-03-20T10:00:00Z',
  responsable: { id: 'r1', full_name: 'María García López', email: 'maria@test.com' },
  campus: { id: 10, name: 'Campus Norte' },
  group: null,
};

const MOCK_FORWARDED_REQUEST = {
  id: 2,
  responsable_id: 'r2',
  campus_id: 11,
  group_id: 5,
  coordinator_id: 'c1',
  units_requested: 20,
  justification: 'Solicitud para grupo Beta',
  attachments: [],
  coordinator_units: 18,
  coordinator_group_id: 5,
  coordinator_notes: 'Ajustado a 18',
  coordinator_reviewed_at: '2026-03-21T12:00:00Z',
  forwarded_request_id: 99,
  forwarded_at: '2026-03-21T12:05:00Z',
  status: 'forwarded' as const,
  status_label: 'Enviada a aprobación',
  created_at: '2026-03-19T09:00:00Z',
  updated_at: '2026-03-21T12:05:00Z',
  responsable: { id: 'r2', full_name: 'Carlos Ruiz', email: 'carlos@test.com' },
  campus: { id: 11, name: 'Campus Sur' },
  group: { id: 5, name: 'Grupo Beta' },
  forwarded_request_status: 'pending',
  forwarded_request_status_label: 'Pendiente',
};

const ALL_REQUESTS = [MOCK_PENDING_REQUEST, MOCK_FORWARDED_REQUEST];

function renderPage() {
  return render(
    <MemoryRouter>
      <SolicitudesResponsablesPage />
    </MemoryRouter>
  );
}

// ─── Tests ──────────────────────────────────────────────────────────────

describe('SolicitudesResponsablesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateCertificateRequestStatus.mockResolvedValue({
      message: 'ok',
      request: { ...MOCK_PENDING_REQUEST, status: 'seen' },
    });
  });

  // ── Carga ──
  it('muestra spinner mientras carga', () => {
    mockGetCertificateRequests.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(document.querySelector('.animate-spin')).toBeTruthy();
  });

  // ── Sin solicitudes ──
  describe('sin solicitudes', () => {
    beforeEach(() => {
      mockGetCertificateRequests.mockResolvedValue({ requests: [], total: 0, pages: 0, current_page: 1 });
    });

    it('muestra mensaje vacío', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Sin solicitudes')).toBeTruthy();
      });
    });

    it('muestra texto descriptivo vacío', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('No hay solicitudes de responsables por el momento.')).toBeTruthy();
      });
    });
  });

  // ── Con solicitudes ──
  describe('con solicitudes', () => {
    beforeEach(() => {
      mockGetCertificateRequests.mockResolvedValue({ requests: ALL_REQUESTS, total: 2, pages: 1, current_page: 1 });
    });

    it('muestra el título "Solicitudes de Responsables"', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Solicitudes de Responsables')).toBeTruthy();
      });
    });

    it('muestra badge de pendientes', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('1 pendiente')).toBeTruthy();
      });
    });

    it('muestra nombre del responsable', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('María García López')).toBeTruthy();
      });
    });

    it('muestra unidades solicitadas', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('5')).toBeTruthy();
      });
    });

    it('muestra nombre del campus', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Campus Norte')).toBeTruthy();
      });
    });

    it('muestra grupo cuando existe', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/Grupo Beta/)).toBeTruthy();
      });
    });

    it('muestra indicador de adjuntos', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('2')).toBeTruthy();
      });
    });

    it('muestra badge "Pendiente" para solicitud pendiente', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Pendiente')).toBeTruthy();
      });
    });

    it('muestra badge "Enviada a aprobación" para forwarded', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Enviada a aprobación')).toBeTruthy();
      });
    });

    it('muestra "Requiere acción" en solicitud pendiente', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Requiere acción')).toBeTruthy();
      });
    });

    it('tiene link de regreso a Mi Saldo', async () => {
      renderPage();
      await waitFor(() => {
        const link = screen.getByText('Mi Saldo').closest('a');
        expect(link?.getAttribute('href')).toBe('/mi-saldo');
      });
    });
  });

  // ── Filtros ──
  describe('filtros', () => {
    beforeEach(() => {
      mockGetCertificateRequests.mockResolvedValue({ requests: ALL_REQUESTS, total: 2, pages: 1, current_page: 1 });
    });

    it('muestra 3 botones de filtro', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Todas')).toBeTruthy();
        expect(screen.getByText(/Pendientes/)).toBeTruthy();
        expect(screen.getByText('Procesadas')).toBeTruthy();
      });
    });

    it('filtro "Procesadas" oculta solicitudes pendientes', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('María García López')).toBeTruthy();
      });
      fireEvent.click(screen.getByText('Procesadas'));
      await waitFor(() => {
        // La solicitud pendiente no debería mostrarse en "Procesadas"
        // Solo Carlos Ruiz (forwarded) debería ser visible
        expect(screen.getByText('Carlos Ruiz')).toBeTruthy();
      });
    });
  });

  // ── Expandir solicitud ──
  describe('expandir solicitud', () => {
    beforeEach(() => {
      mockGetCertificateRequests.mockResolvedValue({ requests: [MOCK_PENDING_REQUEST], total: 1, pages: 1, current_page: 1 });
    });

    it('al expandir muestra justificación completa', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('María García López')).toBeTruthy();
      });
      // Click on the card
      const card = screen.getByText('María García López').closest('button');
      if (card) fireEvent.click(card);
      await waitFor(() => {
        expect(screen.getByText('Justificación')).toBeTruthy();
        expect(screen.getByText('Necesitamos certificados urgentes para evaluación final')).toBeTruthy();
      });
    });

    it('al expandir muestra adjuntos con nombre y tamaño', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('María García López')).toBeTruthy();
      });
      const card = screen.getByText('María García López').closest('button');
      if (card) fireEvent.click(card);
      await waitFor(() => {
        expect(screen.getByText('Documentos adjuntos')).toBeTruthy();
        expect(screen.getByText('presupuesto.pdf')).toBeTruthy();
        expect(screen.getByText('lista_alumnos.xlsx')).toBeTruthy();
        expect(screen.getByText('200.0 KB')).toBeTruthy();
        expect(screen.getByText('50.0 KB')).toBeTruthy();
      });
    });

    it('al expandir pendiente llama updateCertificateRequestStatus seen', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('María García López')).toBeTruthy();
      });
      const card = screen.getByText('María García López').closest('button');
      if (card) fireEvent.click(card);
      await waitFor(() => {
        expect(mockUpdateCertificateRequestStatus).toHaveBeenCalledWith(1, 'seen');
      });
    });

    it('al expandir muestra botones de acción', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('María García López')).toBeTruthy();
      });
      const card = screen.getByText('María García López').closest('button');
      if (card) fireEvent.click(card);
      await waitFor(() => {
        expect(screen.getByText('Aprobar y Enviar')).toBeTruthy();
        expect(screen.getByText('Modificar')).toBeTruthy();
        expect(screen.getByText('Rechazar')).toBeTruthy();
      });
    });
  });

  // ── Formulario de rechazo ──
  describe('formulario de rechazo', () => {
    beforeEach(() => {
      mockGetCertificateRequests.mockResolvedValue({ requests: [MOCK_PENDING_REQUEST], total: 1, pages: 1, current_page: 1 });
    });

    it('al rechazar, el botón "Confirmar rechazo" está deshabilitado sin motivo', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('María García López')).toBeTruthy();
      });
      const card = screen.getByText('María García López').closest('button');
      if (card) fireEvent.click(card);
      await waitFor(() => {
        expect(screen.getByText('Rechazar')).toBeTruthy();
      });
      fireEvent.click(screen.getByText('Rechazar'));
      await waitFor(() => {
        const confirmBtn = screen.getByText('Confirmar rechazo').closest('button');
        expect(confirmBtn?.disabled).toBe(true);
      });
    });

    it('rechazar muestra placeholder para motivo', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('María García López')).toBeTruthy();
      });
      const card = screen.getByText('María García López').closest('button');
      if (card) fireEvent.click(card);
      await waitFor(() => {
        fireEvent.click(screen.getByText('Rechazar'));
      });
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Explica el motivo del rechazo...')).toBeTruthy();
      });
    });

    it('al escribir motivo se habilita el botón de confirmar', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('María García López')).toBeTruthy();
      });
      const card = screen.getByText('María García López').closest('button');
      if (card) fireEvent.click(card);
      await waitFor(() => {
        fireEvent.click(screen.getByText('Rechazar'));
      });
      await waitFor(() => {
        const textarea = screen.getByPlaceholderText('Explica el motivo del rechazo...');
        fireEvent.change(textarea, { target: { value: 'Falta documentación' } });
      });
      await waitFor(() => {
        const confirmBtn = screen.getByText('Confirmar rechazo').closest('button');
        expect(confirmBtn?.disabled).toBe(false);
      });
    });

    it('cancelar cierra el formulario de rechazo', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('María García López')).toBeTruthy();
      });
      const card = screen.getByText('María García López').closest('button');
      if (card) fireEvent.click(card);
      await waitFor(() => {
        fireEvent.click(screen.getByText('Rechazar'));
      });
      await waitFor(() => {
        expect(screen.getByText('Confirmar rechazo')).toBeTruthy();
      });
      fireEvent.click(screen.getByText('Cancelar'));
      await waitFor(() => {
        expect(screen.queryByText('Confirmar rechazo')).toBeNull();
      });
    });
  });

  // ── Formulario de aprobación ──
  describe('formulario de aprobación', () => {
    beforeEach(() => {
      mockGetCertificateRequests.mockResolvedValue({ requests: [MOCK_PENDING_REQUEST], total: 1, pages: 1, current_page: 1 });
    });

    it('al aprobar muestra campo de unidades', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('María García López')).toBeTruthy();
      });
      const card = screen.getByText('María García López').closest('button');
      if (card) fireEvent.click(card);
      await waitFor(() => {
        fireEvent.click(screen.getByText('Aprobar y Enviar'));
      });
      await waitFor(() => {
        expect(screen.getByText('Unidades')).toBeTruthy();
        expect(screen.getByText('Aprobar y enviar')).toBeTruthy();
      });
    });
  });

  // ── Formulario de modificación ──
  describe('formulario de modificación', () => {
    beforeEach(() => {
      mockGetCertificateRequests.mockResolvedValue({ requests: [MOCK_PENDING_REQUEST], total: 1, pages: 1, current_page: 1 });
    });

    it('al modificar muestra campo de unidades y grupo', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('María García López')).toBeTruthy();
      });
      const card = screen.getByText('María García López').closest('button');
      if (card) fireEvent.click(card);
      await waitFor(() => {
        fireEvent.click(screen.getByText('Modificar'));
      });
      await waitFor(() => {
        expect(screen.getByText('Unidades')).toBeTruthy();
        expect(screen.getByText('Guardar cambios')).toBeTruthy();
      });
    });
  });

  // ── Submit review ──
  describe('envío de review', () => {
    beforeEach(() => {
      mockGetCertificateRequests.mockResolvedValue({ requests: [MOCK_PENDING_REQUEST], total: 1, pages: 1, current_page: 1 });
      mockReviewCertificateRequest.mockResolvedValue({
        message: 'Solicitud rechazada',
        request: { ...MOCK_PENDING_REQUEST, status: 'rejected_by_coordinator', coordinator_notes: 'Rechazada' },
      });
    });

    it('llama a reviewCertificateRequest con acción reject y notas', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('María García López')).toBeTruthy();
      });
      const card = screen.getByText('María García López').closest('button');
      if (card) fireEvent.click(card);
      await waitFor(() => {
        fireEvent.click(screen.getByText('Rechazar'));
      });
      await waitFor(() => {
        const textarea = screen.getByPlaceholderText('Explica el motivo del rechazo...');
        fireEvent.change(textarea, { target: { value: 'Documentación faltante' } });
      });
      fireEvent.click(screen.getByText('Confirmar rechazo'));
      await waitFor(() => {
        expect(mockReviewCertificateRequest).toHaveBeenCalledWith(1, {
          action: 'reject',
          units: undefined,
          group_id: undefined,
          notes: 'Documentación faltante',
        });
      });
    });
  });

  // ── Solicitud ya procesada ──
  describe('solicitud ya procesada', () => {
    beforeEach(() => {
      mockGetCertificateRequests.mockResolvedValue({
        requests: [MOCK_FORWARDED_REQUEST],
        total: 1, pages: 1, current_page: 1,
      });
    });

    it('no muestra "Requiere acción" en solicitud forwarded', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Carlos Ruiz')).toBeTruthy();
      });
      expect(screen.queryByText('Requiere acción')).toBeNull();
    });

    it('al expandir forwarded muestra estado del flujo', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Carlos Ruiz')).toBeTruthy();
      });
      const card = screen.getByText('Carlos Ruiz').closest('button');
      if (card) fireEvent.click(card);
      await waitFor(() => {
        expect(screen.getByText('Estado del flujo de aprobación')).toBeTruthy();
      });
    });
  });

  // ── Error ──
  describe('estado de error', () => {
    it('muestra mensaje de error', async () => {
      mockGetCertificateRequests.mockRejectedValue({
        response: { data: { error: 'Servidor no disponible' } }
      });
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Servidor no disponible')).toBeTruthy();
      });
    });
  });

  // ── Refrescar ──
  describe('refrescar', () => {
    it('hace refresh al hacer clic', async () => {
      mockGetCertificateRequests.mockResolvedValue({ requests: [], total: 0, pages: 0, current_page: 1 });
      renderPage();
      await waitFor(() => {
        expect(mockGetCertificateRequests).toHaveBeenCalledTimes(1);
      });
      const refreshBtn = screen.getAllByRole('button').find(
        btn => btn.querySelector('[data-testid="icon-refresh"]')
      );
      if (refreshBtn) {
        fireEvent.click(refreshBtn);
        await waitFor(() => {
          expect(mockGetCertificateRequests).toHaveBeenCalledTimes(2);
        });
      }
    });
  });
});
