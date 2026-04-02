/**
 * Tests para ExamsListPage — Badges de pago para candidatos
 *
 * Cubre:
 *  - Badge "Pago requerido" visible cuando requires_payment=true y is_paid=false
 *  - Badge NO visible cuando is_paid=true
 *  - Badge NO visible cuando is_approved=true
 *  - Badge NO visible cuando is_expired=true
 *  - Badge NO visible para editores (no candidatos)
 *  - Costo de certificación visible en la tarjeta
 *
 * Ejecutar:
 *   cd frontend && npx vitest run src/__tests__/ExamsListPaymentBadge.test.tsx
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ─── Polyfills ──────────────────────────────────────────────────────────────
beforeAll(() => {
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as any;
  }
  if (!globalThis.IntersectionObserver) {
    globalThis.IntersectionObserver = class IntersectionObserver {
      constructor() {}
      observe() {}
      unobserve() {}
      disconnect() {}
    } as any;
  }
});

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockGetMisExamenes = vi.fn();
const mockGetExams = vi.fn();

vi.mock('../services/partnersService', () => ({
  getMisExamenes: (...args: unknown[]) => mockGetMisExamenes(...args),
}));

vi.mock('../services/examService', () => ({
  examService: {
    getExams: (...args: unknown[]) => mockGetExams(...args),
  },
}));

let mockUser: any = { role: 'candidato', email: 'test@test.com', name: 'Test' };
vi.mock('../store/authStore', () => ({
  useAuthStore: (selector?: (s: any) => any) => {
    const state = { user: mockUser };
    return selector ? selector(state) : state;
  },
}));

// Mock OptimizedImage
vi.mock('../components/ui/OptimizedImage', () => ({
  OptimizedImage: (props: any) => <img src={props.src} alt={props.alt || ''} />,
}));

// Mock LoadingSpinner
vi.mock('../components/LoadingSpinner', () => ({
  default: () => <div data-testid="loading-spinner" className="animate-spin" />,
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => {
  const icon = (name: string) => (props: Record<string, unknown>) => (
    <span data-testid={`icon-${name}`} {...props} />
  );
  return {
    FileText: icon('file-text'),
    Plus: icon('plus'),
    Eye: icon('eye'),
    EyeOff: icon('eye-off'),
    BookOpen: icon('book-open'),
    Layers: icon('layers'),
    Calendar: icon('calendar'),
    Search: icon('search'),
    ChevronLeft: icon('chevron-left'),
    ChevronRight: icon('chevron-right'),
    Award: icon('award'),
    Timer: icon('timer'),
    Gamepad2: icon('gamepad'),
    CheckCircle: icon('check-circle'),
    Trophy: icon('trophy'),
    ArrowRight: icon('arrow-right'),
    X: icon('x'),
    Clock: icon('clock'),
    AlertTriangle: icon('alert-triangle'),
    Lock: icon('lock'),
    CreditCard: icon('credit-card'),
  };
});

import ExamsListPage from '../pages/exams/ExamsListPage';

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

function renderPage() {
  const qc = createQueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <ExamsListPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

// ─── Test data factory ──────────────────────────────────────────────────────

function makeExam(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    name: 'Examen Word 2021',
    description: 'Test exam',
    version: '1.0',
    is_active: true,
    categories_count: 3,
    questions_count: 20,
    exam_image: null,
    group_id: 10,
    group_exam_id: 5,
    is_approved: false,
    is_expired: false,
    requires_payment: false,
    is_paid: false,
    certification_cost: 0,
    remaining_days: 30,
    max_attempts: 3,
    current_attempts: 0,
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('ExamsListPage — Payment Badges', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { role: 'candidato', email: 'test@test.com', name: 'Test' };
  });

  describe('candidato con examen que requiere pago', () => {
    it('muestra badge "Pago requerido" cuando requires_payment=true y is_paid=false', async () => {
      mockGetMisExamenes.mockResolvedValue({
        exams: [makeExam({ requires_payment: true, is_paid: false, certification_cost: 500 })],
      });
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Pago requerido')).toBeTruthy();
      });
    });

    it('muestra el costo de certificación', async () => {
      mockGetMisExamenes.mockResolvedValue({
        exams: [makeExam({ requires_payment: true, is_paid: false, certification_cost: 500 })],
      });
      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/\$500/)).toBeTruthy();
      });
    });

    it('NO muestra "Pago requerido" cuando ya pagó (is_paid=true)', async () => {
      mockGetMisExamenes.mockResolvedValue({
        exams: [makeExam({ requires_payment: true, is_paid: true, certification_cost: 500 })],
      });
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Examen Word 2021')).toBeTruthy();
      });
      expect(screen.queryByText('Pago requerido')).toBeNull();
    });

    it('NO muestra "Pago requerido" si ya está aprobado', async () => {
      mockGetMisExamenes.mockResolvedValue({
        exams: [makeExam({ requires_payment: true, is_paid: false, is_approved: true })],
      });
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Examen Word 2021')).toBeTruthy();
      });
      expect(screen.queryByText('Pago requerido')).toBeNull();
    });

    it('NO muestra "Pago requerido" si vigencia expirada', async () => {
      mockGetMisExamenes.mockResolvedValue({
        exams: [makeExam({ requires_payment: true, is_paid: false, is_expired: true })],
      });
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Examen Word 2021')).toBeTruthy();
      });
      expect(screen.queryByText('Pago requerido')).toBeNull();
    });
  });

  describe('candidato con examen sin pago requerido', () => {
    it('NO muestra badge "Pago requerido"', async () => {
      mockGetMisExamenes.mockResolvedValue({
        exams: [makeExam({ requires_payment: false })],
      });
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Examen Word 2021')).toBeTruthy();
      });
      expect(screen.queryByText('Pago requerido')).toBeNull();
    });
  });

  describe('editor (no candidato)', () => {
    it('NO muestra badge "Pago requerido" para editores', async () => {
      mockUser = { role: 'editor', email: 'editor@test.com', name: 'Editor' };
      mockGetExams.mockResolvedValue({
        exams: [makeExam({ requires_payment: true, is_paid: false })],
        total: 1,
      });
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Examen Word 2021')).toBeTruthy();
      });
      expect(screen.queryByText('Pago requerido')).toBeNull();
    });
  });
});
