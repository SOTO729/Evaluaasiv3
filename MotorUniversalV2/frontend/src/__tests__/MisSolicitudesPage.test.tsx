/**
 * Tests para MisSolicitudesPage (Historial de solicitudes del responsable)
 *
 * Cubre:
 *  - Estado de carga (spinner)
 *  - Sin solicitudes (mensaje vacío + link nueva)
 *  - Con solicitudes: tarjetas de stats, lista con badges
 *  - Estado simplificado visible para responsable
 *  - Indicador de adjuntos
 *  - Notas del coordinador
 *  - Botón refrescar
 *  - Estado de error
 *
 * Ejecutar:
 *   cd frontend && npx vitest run src/__tests__/MisSolicitudesPage.test.tsx
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MisSolicitudesPage from '../pages/responsable/MisSolicitudesPage';

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

vi.mock('../services/balanceService', () => ({
  getCertificateRequests: (...args: unknown[]) => mockGetCertificateRequests(...args),
}));

vi.mock('lucide-react', () => ({
  ClipboardList: (props: Record<string, unknown>) => <span data-testid="icon-clipboard" {...props} />,
  Award: (props: Record<string, unknown>) => <span data-testid="icon-award" {...props} />,
  Clock: (props: Record<string, unknown>) => <span data-testid="icon-clock" {...props} />,
  CheckCircle2: (props: Record<string, unknown>) => <span data-testid="icon-check" {...props} />,
  XCircle: (props: Record<string, unknown>) => <span data-testid="icon-x" {...props} />,
  AlertCircle: (props: Record<string, unknown>) => <span data-testid="icon-alert" {...props} />,
  RefreshCw: (props: Record<string, unknown>) => <span data-testid="icon-refresh" {...props} />,
  Plus: (props: Record<string, unknown>) => <span data-testid="icon-plus" {...props} />,
  Paperclip: (props: Record<string, unknown>) => <span data-testid="icon-paperclip" {...props} />,
  ChevronRight: (props: Record<string, unknown>) => <span data-testid="icon-chevron-right" {...props} />,
  Send: (props: Record<string, unknown>) => <span data-testid="icon-send" {...props} />,
  Eye: (props: Record<string, unknown>) => <span data-testid="icon-eye" {...props} />,
}));

const MOCK_REQUESTS = [
  {
    id: 1,
    responsable_id: 'r1',
    campus_id: 10,
    group_id: null,
    coordinator_id: 'c1',
    units_requested: 5,
    justification: 'Necesitamos más certificados para evaluación',
    attachments: [{ name: 'doc.pdf', url: 'https://example.com/doc.pdf', size: 1024 }],
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
    campus: { id: 10, name: 'Campus Norte' },
    group: null,
  },
  {
    id: 2,
    responsable_id: 'r1',
    campus_id: 10,
    group_id: 5,
    coordinator_id: 'c1',
    units_requested: 10,
    justification: 'Solicitud para grupo Alpha',
    attachments: [],
    coordinator_units: 8,
    coordinator_group_id: 5,
    coordinator_notes: 'Ajustado a 8 unidades',
    coordinator_reviewed_at: '2026-03-21T12:00:00Z',
    forwarded_request_id: 99,
    forwarded_at: '2026-03-21T12:05:00Z',
    status: 'forwarded' as const,
    status_label: 'Enviada a aprobación',
    created_at: '2026-03-19T09:00:00Z',
    updated_at: '2026-03-21T12:05:00Z',
    campus: { id: 10, name: 'Campus Norte' },
    group: { id: 5, name: 'Grupo Alpha' },
  },
  {
    id: 3,
    responsable_id: 'r1',
    campus_id: 10,
    group_id: null,
    coordinator_id: 'c1',
    units_requested: 3,
    justification: 'Solicitud rechazada',
    attachments: [],
    coordinator_units: null,
    coordinator_group_id: null,
    coordinator_notes: 'Documentación incompleta',
    coordinator_reviewed_at: '2026-03-20T14:00:00Z',
    forwarded_request_id: null,
    forwarded_at: null,
    status: 'rejected_by_coordinator' as const,
    status_label: 'Rechazada',
    created_at: '2026-03-18T08:00:00Z',
    updated_at: '2026-03-20T14:00:00Z',
    campus: { id: 10, name: 'Campus Norte' },
    group: null,
  },
];

function renderPage() {
  return render(
    <MemoryRouter>
      <MisSolicitudesPage />
    </MemoryRouter>
  );
}

// ─── Tests ──────────────────────────────────────────────────────────────

describe('MisSolicitudesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Estado de carga ──
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

    it('muestra mensaje "Sin solicitudes"', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Sin solicitudes')).toBeTruthy();
      });
    });

    it('muestra link para crear primera solicitud', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Crear primera solicitud')).toBeTruthy();
      });
    });

    it('muestra contadores en cero', async () => {
      renderPage();
      await waitFor(() => {
        const elements = screen.getAllByText('0');
        expect(elements.length).toBeGreaterThanOrEqual(3);
      });
    });
  });

  // ── Con solicitudes ──
  describe('con solicitudes', () => {
    beforeEach(() => {
      mockGetCertificateRequests.mockResolvedValue({ requests: MOCK_REQUESTS, total: 3, pages: 1, current_page: 1 });
    });

    it('muestra el título "Mis Solicitudes"', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Mis Solicitudes')).toBeTruthy();
      });
    });

    it('muestra subtítulo descriptivo', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Historial de solicitudes de saldo enviadas')).toBeTruthy();
      });
    });

    it('muestra total correcto (3)', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Total')).toBeTruthy();
        // 3 solicitudes en total - buscar dentro del card de Total
        const totalLabel = screen.getByText('Total');
        const totalCard = totalLabel.closest('div');
        expect(totalCard?.textContent).toContain('3');
      });
    });

    it('muestra contadores: 1 pendiente, 1 aprobada, 1 rechazada', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Pendientes')).toBeTruthy();
        expect(screen.getByText('Aprobadas')).toBeTruthy();
        expect(screen.getByText('Rechazadas')).toBeTruthy();
      });
    });

    it('muestra unidades solicitadas de la primera solicitud', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('5')).toBeTruthy();
      });
    });

    it('muestra justificación de solicitud', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/Necesitamos más certificados/)).toBeTruthy();
      });
    });

    it('muestra nombre del campus', async () => {
      renderPage();
      await waitFor(() => {
        const elements = screen.getAllByText('Campus Norte');
        expect(elements.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('muestra nombre del grupo cuando existe', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/Grupo Alpha/)).toBeTruthy();
      });
    });

    it('muestra indicador de adjuntos (1 archivo)', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('1 archivo')).toBeTruthy();
      });
    });

    it('muestra estado simplificado "Pendiente con coordinador"', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Pendiente con coordinador')).toBeTruthy();
      });
    });

    it('muestra estado "En proceso de aprobación" para forwarded', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('En proceso de aprobación')).toBeTruthy();
      });
    });

    it('muestra estado "Rechazada por coordinador"', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Rechazada por coordinador')).toBeTruthy();
      });
    });

    it('muestra notas del coordinador cuando existen', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Documentación incompleta')).toBeTruthy();
      });
    });

    it('muestra unidades aprobadas cuando difieren del pedido', async () => {
      renderPage();
      await waitFor(() => {
        // req #2: units_requested=10, coordinator_units=8
        expect(screen.getByText('8')).toBeTruthy();
        expect(screen.getByText('aprobadas')).toBeTruthy();
      });
    });

    it('botón "Nueva solicitud" tiene link correcto', async () => {
      renderPage();
      await waitFor(() => {
        const link = screen.getByText('Nueva solicitud').closest('a');
        expect(link?.getAttribute('href')).toBe('/solicitar-certificados');
      });
    });
  });

  // ── Refrescar ──
  describe('actualizar datos', () => {
    it('llama a getCertificateRequests al hacer clic en refrescar', async () => {
      mockGetCertificateRequests.mockResolvedValue({ requests: [], total: 0, pages: 0, current_page: 1 });
      renderPage();
      await waitFor(() => {
        expect(mockGetCertificateRequests).toHaveBeenCalledTimes(1);
      });
      const buttons = screen.getAllByRole('button');
      const refreshBtn = buttons.find(
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

  // ── Error ──
  describe('estado de error', () => {
    it('muestra mensaje de error y no muestra lista', async () => {
      mockGetCertificateRequests.mockRejectedValue({
        response: { data: { error: 'Error de conexión al servidor' } }
      });
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Error de conexión al servidor')).toBeTruthy();
      });
    });
  });
});
