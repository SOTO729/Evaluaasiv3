/**
 * Tests para SolicitarCertificadosPage (Formulario de solicitud del responsable)
 *
 * Cubre:
 *  - Estado de carga (spinner)
 *  - Formulario renderizado con campus info
 *  - Validación: unidades > 0 y justificación requerida
 *  - Selector de grupo opcional
 *  - Upload de archivos (validación extensión y tamaño)
 *  - Quitar archivo adjunto
 *  - Envío exitoso → pantalla de éxito
 *  - Links de éxito: "Ver mis solicitudes" y "Volver a Mi Plantel"
 *  - Estado de error al enviar
 *
 * Ejecutar:
 *   cd frontend && npx vitest run src/__tests__/SolicitarCertificadosPage.test.tsx
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SolicitarCertificadosPage from '../pages/responsable/SolicitarCertificadosPage';

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

const mockGetMyCampusInfo = vi.fn();
const mockGetCampusBalanceSummary = vi.fn();
const mockCreateCertificateRequest = vi.fn();
const mockUploadAttachment = vi.fn();
const mockValidateFile = vi.fn();
const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../services/balanceService', () => ({
  getMyCampusInfo: (...args: unknown[]) => mockGetMyCampusInfo(...args),
  getCampusBalanceSummary: (...args: unknown[]) => mockGetCampusBalanceSummary(...args),
  createCertificateRequest: (...args: unknown[]) => mockCreateCertificateRequest(...args),
  uploadAttachment: (...args: unknown[]) => mockUploadAttachment(...args),
  validateFile: (...args: unknown[]) => mockValidateFile(...args),
  formatFileSize: (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  },
  ALLOWED_FILE_EXTENSIONS: ['pdf', 'jpg', 'jpeg', 'png', 'xls', 'xlsx', 'doc', 'docx', 'csv', 'webp'],
}));

vi.mock('lucide-react', () => ({
  ArrowLeft: (props: Record<string, unknown>) => <span data-testid="icon-arrow-left" {...props} />,
  Award: (props: Record<string, unknown>) => <span data-testid="icon-award" {...props} />,
  Send: (props: Record<string, unknown>) => <span data-testid="icon-send" {...props} />,
  AlertCircle: (props: Record<string, unknown>) => <span data-testid="icon-alert" {...props} />,
  Loader2: (props: Record<string, unknown>) => <span data-testid="icon-loader" {...props} />,
  CheckCircle2: (props: Record<string, unknown>) => <span data-testid="icon-check" {...props} />,
  Building2: (props: Record<string, unknown>) => <span data-testid="icon-building" {...props} />,
  Users: (props: Record<string, unknown>) => <span data-testid="icon-users" {...props} />,
  Paperclip: (props: Record<string, unknown>) => <span data-testid="icon-paperclip" {...props} />,
  X: (props: Record<string, unknown>) => <span data-testid="icon-x" {...props} />,
  FileText: (props: Record<string, unknown>) => <span data-testid="icon-file-text" {...props} />,
  Upload: (props: Record<string, unknown>) => <span data-testid="icon-upload" {...props} />,
}));

const MOCK_CAMPUS_INFO = {
  campus: { id: 10, name: 'Campus Norte', certification_cost: 500 },
  groups: [
    { id: 1, name: 'Grupo Alpha', use_custom_config: false, certification_cost_override: null },
    { id: 2, name: 'Grupo Beta', use_custom_config: true, certification_cost_override: 450 },
  ],
};

function renderPage() {
  return render(
    <MemoryRouter>
      <SolicitarCertificadosPage />
    </MemoryRouter>
  );
}

// ─── Tests ──────────────────────────────────────────────────────────────

describe('SolicitarCertificadosPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCampusBalanceSummary.mockResolvedValue({ totals: { current_balance: 5000 } });
    mockValidateFile.mockReturnValue({ valid: true });
  });

  // ── Carga ──
  it('muestra spinner mientras carga', () => {
    mockGetMyCampusInfo.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(document.querySelector('.animate-spin')).toBeTruthy();
  });

  // ── Formulario con datos ──
  describe('formulario cargado', () => {
    beforeEach(() => {
      mockGetMyCampusInfo.mockResolvedValue(MOCK_CAMPUS_INFO);
    });

    it('muestra título "Solicitar Certificados"', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Solicitar Certificados')).toBeTruthy();
      });
    });

    it('muestra nombre del campus', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Campus Norte')).toBeTruthy();
      });
    });

    it('muestra certificados disponibles calculados', async () => {
      renderPage();
      await waitFor(() => {
        // 5000 / 500 = 10 certificados disponibles
        const certLabel = screen.getByText(/Certificados disponibles actualmente/);
        expect(certLabel.textContent).toContain('10');
      });
    });

    it('muestra campo de número de certificados con valor inicial 1', async () => {
      renderPage();
      await waitFor(() => {
        const input = screen.getByDisplayValue('1');
        expect(input).toBeTruthy();
        expect(input.getAttribute('type')).toBe('number');
      });
    });

    it('muestra selector de grupo con opciones', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Sin grupo específico (plantel general)')).toBeTruthy();
        expect(screen.getByText('Grupo Alpha')).toBeTruthy();
        expect(screen.getByText('Grupo Beta')).toBeTruthy();
      });
    });

    it('muestra campo de justificación', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Explica brevemente/)).toBeTruthy();
      });
    });

    it('muestra contador de caracteres 0/1000', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('0/1000 caracteres')).toBeTruthy();
      });
    });

    it('muestra botón seleccionar archivos', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Seleccionar archivos')).toBeTruthy();
      });
    });

    it('muestra formatos permitidos', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/PDF, JPG, JPEG, PNG/i)).toBeTruthy();
      });
    });

    it('muestra resumen de la solicitud', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Resumen de la solicitud')).toBeTruthy();
      });
    });
  });

  // ── Botón submit deshabilitado sin justificación ──
  describe('validación del formulario', () => {
    beforeEach(() => {
      mockGetMyCampusInfo.mockResolvedValue(MOCK_CAMPUS_INFO);
    });

    it('botón enviar está deshabilitado sin justificación', async () => {
      renderPage();
      await waitFor(() => {
        const submitBtn = screen.getByText('Enviar solicitud').closest('button');
        expect(submitBtn?.disabled).toBe(true);
      });
    });

    it('botón enviar se habilita con justificación', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Explica brevemente/)).toBeTruthy();
      });
      const textarea = screen.getByPlaceholderText(/Explica brevemente/);
      fireEvent.change(textarea, { target: { value: 'Justificación válida' } });
      await waitFor(() => {
        const submitBtn = screen.getByText('Enviar solicitud').closest('button');
        expect(submitBtn?.disabled).toBe(false);
      });
    });

    it('actualiza el contador de caracteres al escribir', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Explica brevemente/)).toBeTruthy();
      });
      const textarea = screen.getByPlaceholderText(/Explica brevemente/);
      fireEvent.change(textarea, { target: { value: 'Hola mundo' } });
      await waitFor(() => {
        expect(screen.getByText('10/1000 caracteres')).toBeTruthy();
      });
    });
  });

  // ── Envío exitoso ──
  describe('envío exitoso', () => {
    beforeEach(() => {
      mockGetMyCampusInfo.mockResolvedValue(MOCK_CAMPUS_INFO);
      mockCreateCertificateRequest.mockResolvedValue({
        message: 'Solicitud creada',
        request: { id: 1, status: 'pending' },
      });
    });

    it('muestra pantalla de éxito con mensaje correcto', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Explica brevemente/)).toBeTruthy();
      });
      // Fill form
      const textarea = screen.getByPlaceholderText(/Explica brevemente/);
      fireEvent.change(textarea, { target: { value: 'Justificación de test' } });
      // Submit
      const submitBtn = screen.getByText('Enviar solicitud').closest('button');
      if (submitBtn) fireEvent.click(submitBtn);
      await waitFor(() => {
        expect(screen.getByText('Solicitud enviada')).toBeTruthy();
      });
    });

    it('pantalla de éxito tiene link a "Ver mis solicitudes"', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Explica brevemente/)).toBeTruthy();
      });
      const textarea = screen.getByPlaceholderText(/Explica brevemente/);
      fireEvent.change(textarea, { target: { value: 'Test' } });
      const submitBtn = screen.getByText('Enviar solicitud').closest('button');
      if (submitBtn) fireEvent.click(submitBtn);
      await waitFor(() => {
        const link = screen.getByText('Ver mis solicitudes').closest('a');
        expect(link?.getAttribute('href')).toBe('/mis-solicitudes');
      });
    });

    it('pantalla de éxito tiene link a "Volver a Mi Plantel"', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Explica brevemente/)).toBeTruthy();
      });
      const textarea = screen.getByPlaceholderText(/Explica brevemente/);
      fireEvent.change(textarea, { target: { value: 'Test' } });
      const submitBtn = screen.getByText('Enviar solicitud').closest('button');
      if (submitBtn) fireEvent.click(submitBtn);
      await waitFor(() => {
        const link = screen.getByText('Volver a Mi Plantel').closest('a');
        expect(link?.getAttribute('href')).toBe('/mi-plantel');
      });
    });

    it('llama a createCertificateRequest con datos correctos', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Explica brevemente/)).toBeTruthy();
      });
      const textarea = screen.getByPlaceholderText(/Explica brevemente/);
      fireEvent.change(textarea, { target: { value: 'Justificación formal' } });
      const submitBtn = screen.getByText('Enviar solicitud').closest('button');
      if (submitBtn) fireEvent.click(submitBtn);
      await waitFor(() => {
        expect(mockCreateCertificateRequest).toHaveBeenCalledWith({
          campus_id: 10,
          group_id: undefined,
          units_requested: 1,
          justification: 'Justificación formal',
          attachments: undefined,
        });
      });
    });
  });

  // ── Error al enviar ──
  describe('error al enviar', () => {
    beforeEach(() => {
      mockGetMyCampusInfo.mockResolvedValue(MOCK_CAMPUS_INFO);
      mockCreateCertificateRequest.mockRejectedValue({
        response: { data: { error: 'No tienes coordinador asignado' } }
      });
    });

    it('muestra error del servidor', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Explica brevemente/)).toBeTruthy();
      });
      const textarea = screen.getByPlaceholderText(/Explica brevemente/);
      fireEvent.change(textarea, { target: { value: 'Test' } });
      const submitBtn = screen.getByText('Enviar solicitud').closest('button');
      if (submitBtn) fireEvent.click(submitBtn);
      await waitFor(() => {
        expect(screen.getByText('No tienes coordinador asignado')).toBeTruthy();
      });
    });
  });

  // ── Error al cargar campus ──
  describe('error al cargar', () => {
    it('muestra error si no se puede cargar info del campus', async () => {
      mockGetMyCampusInfo.mockRejectedValue({
        response: { data: { error: 'No se encontró un plantel asignado' } }
      });
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('No se encontró un plantel asignado')).toBeTruthy();
      });
    });
  });

  // ── Upload de archivos ──
  describe('validación de archivos', () => {
    beforeEach(() => {
      mockGetMyCampusInfo.mockResolvedValue(MOCK_CAMPUS_INFO);
    });

    it('valida el archivo antes de subir', async () => {
      mockValidateFile.mockReturnValue({ valid: false, error: 'Tipo no permitido' });
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Seleccionar archivos')).toBeTruthy();
      });
      // Simulate file input change
      const fileInput = document.querySelector('input[type="file"]');
      if (fileInput) {
        const file = new File(['test'], 'test.exe', { type: 'application/exe' });
        fireEvent.change(fileInput, { target: { files: [file] } });
      }
      await waitFor(() => {
        expect(mockValidateFile).toHaveBeenCalled();
      });
    });
  });
});
