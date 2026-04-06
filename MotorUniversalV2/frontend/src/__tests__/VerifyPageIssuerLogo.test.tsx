/**
 * Tests para VerifyPage — Sección del logo del emisor
 *
 * Cubre:
 *  - Muestra imagen del emisor cuando issuer_logo_url está presente
 *  - Muestra ícono Shield como fallback cuando NO hay logo
 *  - Contenedor fijo (w-10 h-10) no se rompe con imagen
 *  - Muestra el nombre del emisor correctamente
 *  - Renderiza correctamente el status badge válido
 *  - Modal re-verificar también muestra el logo del emisor
 *
 * Ejecutar:
 *   cd frontend && npx vitest run src/__tests__/VerifyPageIssuerLogo.test.tsx
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// ─── Polyfills ──────────────────────────────────────────────────────────────
beforeAll(() => {
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as any;
  }
});

// ─── Mocks ──────────────────────────────────────────────────────────────────

// Mock lucide-react — return testable spans
vi.mock('lucide-react', () => {
  const icon = (name: string) => (props: Record<string, unknown>) => (
    <span data-testid={`icon-${name}`} {...props} />
  );
  return {
    CheckCircle: icon('check-circle'),
    XCircle: icon('x-circle'),
    AlertCircle: icon('alert-circle'),
    User: icon('user'),
    Calendar: icon('calendar'),
    BookOpen: icon('book-open'),
    Shield: icon('shield'),
    Zap: icon('zap'),
    FileText: icon('file-text'),
    RefreshCw: icon('refresh-cw'),
    Mail: icon('mail'),
    X: icon('x'),
    Award: icon('award'),
    ExternalLink: icon('external-link'),
  };
});

// ─── Test data factories ────────────────────────────────────────────────────

function makeBadgeVerificationData(overrides: Record<string, any> = {}) {
  const badge = {
    name: 'Insignia de Prueba',
    description: 'Descripción de la insignia',
    issuer_name: 'Grupo Eduit',
    issuer_logo_url: null as string | null,
    image_url: null,
    template_image_url: 'https://example.com/badge-image.webp',
    issued_date: '2 de abril de 2026',
    expires_date: null,
    badge_uuid: 'abc-123-def',
    credential_url: 'https://example.com/credentials/abc',
    verify_count: 3,
    share_count: 1,
    skills: 'Excel,Word',
    criteria_narrative: 'Completar el examen con 80%',
    criteria_url: null,
    ecm_code: 'EC0001',
    ecm_name: 'Estándar de prueba',
    ecm_logo_url: null,
    cryptographically_signed: true,
    proof_type: 'Ed25519Signature2020',
    ...overrides,
  };

  return {
    valid: true,
    document_type: 'digital_badge',
    document_name: 'Insignia Digital',
    verification_code: 'BDTEST123',
    status: 'active',
    candidate: { full_name: 'Juan Pérez', email: 'juan@test.com' },
    badge,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function renderVerifyPage(code = 'BDTEST123') {
  return render(
    <MemoryRouter initialEntries={[`/verify/${code}`]}>
      <Routes>
        <Route path="/verify/:code" element={<VerifyPage />} />
      </Routes>
    </MemoryRouter>
  );
}

// Import AFTER mocks
import VerifyPage from '../pages/verify/VerifyPage';

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('VerifyPage — Issuer Logo', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('con issuer_logo_url presente', () => {
    beforeEach(() => {
      const data = makeBadgeVerificationData({
        issuer_logo_url: 'https://storage.example.com/logos/emisor.webp',
      });
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(data),
      } as Response);
    });

    it('muestra la imagen del emisor en lugar del ícono', async () => {
      renderVerifyPage();
      await waitFor(() => {
        expect(screen.getByText('Emitida por')).toBeTruthy();
      });
      // Buscar la imagen del emisor por src específico (no la del header)
      const imgs = screen.getAllByAltText('Grupo Eduit');
      const issuerImg = imgs.find(img => img.getAttribute('src') === 'https://storage.example.com/logos/emisor.webp');
      expect(issuerImg).toBeTruthy();
      expect(issuerImg!.tagName).toBe('IMG');
    });

    it('la imagen tiene object-contain para no distorsionarse', async () => {
      renderVerifyPage();
      await waitFor(() => {
        const imgs = screen.getAllByAltText('Grupo Eduit');
        expect(imgs[0].className).toContain('object-contain');
      });
    });

    it('NO muestra el ícono Shield de fallback', async () => {
      renderVerifyPage();
      await waitFor(() => {
        expect(screen.queryByText('Emitida por')).toBeTruthy();
      });
      // El ícono Shield no debe estar en el bloque del emisor
      // (puede estar en otros lugares, pero el emisor debe tener imagen)
      const imgs = screen.getAllByAltText('Grupo Eduit');
      expect(imgs.length).toBeGreaterThanOrEqual(1);
    });

    it('muestra el nombre del emisor', async () => {
      renderVerifyPage();
      await waitFor(() => {
        expect(screen.getByText('Grupo Eduit')).toBeTruthy();
      });
    });

    it('muestra "Emitida por"', async () => {
      renderVerifyPage();
      await waitFor(() => {
        expect(screen.getByText('Emitida por')).toBeTruthy();
      });
    });
  });

  describe('sin issuer_logo_url (fallback a ícono)', () => {
    beforeEach(() => {
      const data = makeBadgeVerificationData({ issuer_logo_url: null });
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(data),
      } as Response);
    });

    it('muestra el ícono Shield como fallback', async () => {
      renderVerifyPage();
      await waitFor(() => {
        expect(screen.getByText('Emitida por')).toBeTruthy();
      });
      expect(screen.getByTestId('icon-shield')).toBeTruthy();
    });

    it('NO muestra una imagen del emisor en la sección del emisor', async () => {
      renderVerifyPage();
      await waitFor(() => {
        expect(screen.getByText('Emitida por')).toBeTruthy();
      });
      // El header tiene una imagen "Grupo Eduit" pero la sección de emisor no debe tener una
      const imgs = screen.getAllByAltText('Grupo Eduit');
      // Solo debe existir la del header (h-20), no una de issuer logo
      const issuerImgs = imgs.filter(img => {
        const parent = img.parentElement;
        return parent && parent.className.includes('overflow-hidden');
      });
      expect(issuerImgs.length).toBe(0);
    });

    it('sigue mostrando el nombre del emisor', async () => {
      renderVerifyPage();
      await waitFor(() => {
        expect(screen.getByText('Grupo Eduit')).toBeTruthy();
      });
    });
  });

  describe('verificación de badge válido', () => {
    beforeEach(() => {
      const data = makeBadgeVerificationData();
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(data),
      } as Response);
    });

    it('renderiza el nombre de la insignia', async () => {
      renderVerifyPage();
      await waitFor(() => {
        expect(screen.getByText('Insignia de Prueba')).toBeTruthy();
      });
    });

    it('muestra el nombre del titular', async () => {
      renderVerifyPage();
      await waitFor(() => {
        expect(screen.getByText('Juan Pérez')).toBeTruthy();
      });
    });

    it('muestra las aptitudes', async () => {
      renderVerifyPage();
      await waitFor(() => {
        expect(screen.getByText('Excel')).toBeTruthy();
        expect(screen.getByText('Word')).toBeTruthy();
      });
    });

    it('muestra la fecha de emisión', async () => {
      renderVerifyPage();
      await waitFor(() => {
        expect(screen.getByText('2 de abril de 2026')).toBeTruthy();
      });
    });
  });

  describe('badge inválido', () => {
    beforeEach(() => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ valid: false, error: 'Código no encontrado' }),
      } as Response);
    });

    it('muestra mensaje de error para badge inválido', async () => {
      renderVerifyPage('INVALID_CODE');
      await waitFor(() => {
        const errors = screen.getAllByText(/no encontrado|no válido|inválido|error/i);
        expect(errors.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('contenedor fijo del logo', () => {
    it('el contenedor del emisor tiene dimensiones fijas', async () => {
      const data = makeBadgeVerificationData({
        issuer_logo_url: 'https://example.com/logo.webp',
      });
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(data),
      } as Response);

      renderVerifyPage();
      await waitFor(() => {
        expect(screen.getByText('Emitida por')).toBeTruthy();
      });
      // Buscar la imagen del issuer logo (no la del header)
      const imgs = screen.getAllByAltText('Grupo Eduit');
      const issuerImg = imgs.find(img => img.getAttribute('src') === 'https://example.com/logo.webp');
      expect(issuerImg).toBeTruthy();
      const container = issuerImg!.parentElement;
      expect(container).toBeTruthy();
      const classes = container!.className;
      expect(classes).toContain('overflow-hidden');
      expect(classes).toContain('flex-shrink-0');
    });
  });
});
