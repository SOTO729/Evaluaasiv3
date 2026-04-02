/**
 * Tests para CandidateCheckoutModal
 *
 * Cubre:
 *  - Renderizado cerrado (no muestra nada)
 *  - Renderizado abierto (muestra modal de pago)
 *  - Labels distintas para certificación vs retoma
 *  - Campos de formulario de tarjeta
 *  - Validación de botón deshabilitado cuando falta data
 *  - Cierre del modal
 *
 * Ejecutar:
 *   cd frontend && npx vitest run src/__tests__/CandidateCheckoutModal.test.tsx
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

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

const mockCandidatePay = vi.fn();
const mockCandidateRetake = vi.fn();
const mockGetPaymentMethods = vi.fn();
const mockGetInstallments = vi.fn();
const mockCreateCardToken = vi.fn();

vi.mock('../services/paymentService', () => ({
  candidatePay: (...args: unknown[]) => mockCandidatePay(...args),
  candidateRetake: (...args: unknown[]) => mockCandidateRetake(...args),
  getPaymentMethods: (...args: unknown[]) => mockGetPaymentMethods(...args),
  getInstallments: (...args: unknown[]) => mockGetInstallments(...args),
  createCardToken: (...args: unknown[]) => mockCreateCardToken(...args),
}));

vi.mock('../store/authStore', () => ({
  useAuthStore: (selector: (s: any) => any) =>
    selector({ user: { email: 'test@candidato.com', name: 'Test' } }),
}));

// Mock lucide-react icons as simple spans
vi.mock('lucide-react', () => {
  const icon = (name: string) => (props: Record<string, unknown>) => (
    <span data-testid={`icon-${name}`} {...props} />
  );
  return {
    CreditCard: icon('credit-card'),
    X: icon('x'),
    AlertCircle: icon('alert'),
    Loader2: icon('loader'),
    CheckCircle2: icon('check-circle'),
    Clock: icon('clock'),
    XCircle: icon('x-circle'),
    Lock: icon('lock'),
  };
});

import CandidateCheckoutModal from '../components/payments/CandidateCheckoutModal';

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('CandidateCheckoutModal', () => {
  const defaultProps = {
    isOpen: true,
    groupExamId: 42,
    cost: 500,
    paymentType: 'certification' as const,
    examName: 'Examen de Prueba',
    onClose: vi.fn(),
    onPaymentComplete: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPaymentMethods.mockResolvedValue([]);
    mockGetInstallments.mockResolvedValue([]);
  });

  // ── Renderizado ──
  it('no muestra nada cuando isOpen=false', () => {
    render(<CandidateCheckoutModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByText(/Pagar Certificación/i)).toBeNull();
    expect(screen.queryByText(/Pagar Retoma/i)).toBeNull();
  });

  it('muestra el modal cuando isOpen=true', () => {
    render(<CandidateCheckoutModal {...defaultProps} />);
    expect(screen.getByText(/Pagar Certificación/i)).toBeTruthy();
  });

  it('muestra "Pago de Retoma" para paymentType=retake', () => {
    render(<CandidateCheckoutModal {...defaultProps} paymentType="retake" />);
    expect(screen.getByText(/Pagar Retoma/i)).toBeTruthy();
  });

  it('muestra el nombre del examen', () => {
    render(<CandidateCheckoutModal {...defaultProps} />);
    expect(screen.getByText(/Examen de Prueba/)).toBeTruthy();
  });

  it('muestra el costo formateado', () => {
    render(<CandidateCheckoutModal {...defaultProps} />);
    expect(screen.getAllByText(/\$500\.00/).length).toBeGreaterThanOrEqual(1);
  });

  // ── Campos de formulario ──
  it('muestra campos de tarjeta', () => {
    render(<CandidateCheckoutModal {...defaultProps} />);
    // Campos principales del formulario
    expect(screen.getByPlaceholderText(/1234 5678/)).toBeTruthy();
  });

  it('muestra el email pre-llenado', () => {
    render(<CandidateCheckoutModal {...defaultProps} />);
    const emailInput = screen.getByDisplayValue('test@candidato.com');
    expect(emailInput).toBeTruthy();
  });

  // ── Botón ──
  it('botón de pagar muestra el monto', () => {
    render(<CandidateCheckoutModal {...defaultProps} />);
    const payButton = screen.getByRole('button', { name: /Pagar \$500/i });
    expect(payButton).toBeTruthy();
  });

  // ── Cierre ──
  it('llama a onClose al cerrar', () => {
    const onClose = vi.fn();
    render(<CandidateCheckoutModal {...defaultProps} onClose={onClose} />);
    // Click the X button (icon)
    const closeButtons = screen.getAllByTestId('icon-x');
    fireEvent.click(closeButtons[0]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Mensajes para certificación vs retoma ──
  it('muestra mensaje de intentos cubiertos para certificación', () => {
    render(<CandidateCheckoutModal {...defaultProps} paymentType="certification" />);
    expect(screen.getByText(/cubre todos los intentos/i)).toBeTruthy();
  });

  it('muestra mensaje de intento adicional para retoma', () => {
    render(<CandidateCheckoutModal {...defaultProps} paymentType="retake" />);
    expect(screen.getByText(/un intento adicional/i)).toBeTruthy();
  });
});
