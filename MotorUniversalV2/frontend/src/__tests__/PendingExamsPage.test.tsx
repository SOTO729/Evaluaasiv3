/**
 * Tests para PendingExamsPage y botón rojo en ExamsListPage
 *
 * Ejecutar:
 *   cd frontend && npx vitest run src/__tests__/PendingExamsPage.test.tsx
 */
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import PendingExamsPage from '../pages/exams/PendingExamsPage'
import ExamsListPage from '../pages/exams/ExamsListPage'

// ─── Polyfills ──────────────────────────────────────────────────────────

beforeAll(() => {
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }
})

// ─── Mocks ──────────────────────────────────────────────────────────────

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('../services/examService', () => ({
  examService: {
    getExams: vi.fn().mockResolvedValue({ exams: [], pages: 1, total: 0 }),
    deleteExam: vi.fn(),
  },
}))

vi.mock('../services/partnersService', () => ({
  getMisExamenes: vi.fn().mockResolvedValue({ exams: [], pages: 1, total: 0 }),
}))

vi.mock('../store/authStore', () => ({
  useAuthStore: () => ({
    user: { id: 1, role: 'candidato', name: 'Test Candidato' },
    token: 'mock-token',
  }),
}))

vi.mock('../components/LoadingSpinner', () => ({
  default: ({ message }: { message?: string }) => (
    <div data-testid="loading-spinner">{message}</div>
  ),
}))

vi.mock('../components/ui/OptimizedImage', () => ({
  OptimizedImage: ({ alt }: { alt: string }) => <img alt={alt} />,
}))

// ─── Helpers ──────────────────────────────────────────────────────────────

function makeSessionData(overrides: Record<string, unknown> = {}) {
  return {
    timeRemaining: 1800,
    savedAt: Date.now(),
    pauseOnDisconnect: true,
    examName: 'Examen de Prueba',
    answers: {},
    exerciseResponses: {},
    selectedItems: [
      { type: 'question', id: 1 },
      { type: 'question', id: 2 },
      { type: 'question', id: 3 },
      { type: 'exercise', id: 4 },
    ],
    disconnectionCount: 0,
    ...overrides,
  }
}

function setSession(examId: string, mode: string, data: Record<string, unknown>) {
  localStorage.setItem(`exam_session_${examId}_${mode}`, JSON.stringify(data))
}

function queryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
}

function renderPending() {
  return render(
    <QueryClientProvider client={queryClient()}>
      <MemoryRouter initialEntries={['/exams/pending']}>
        <Routes>
          <Route path="/exams/pending" element={<PendingExamsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

function renderExamsList() {
  return render(
    <QueryClientProvider client={queryClient()}>
      <MemoryRouter initialEntries={['/exams']}>
        <Routes>
          <Route path="/exams" element={<ExamsListPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

// ─── Cleanup ──────────────────────────────────────────────────────────────

beforeEach(() => {
  localStorage.clear()
  mockNavigate.mockClear()
})

afterEach(() => {
  localStorage.clear()
})

// ═══════════════════════════════════════════════════════════════════════════
// PendingExamsPage Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('PendingExamsPage', () => {
  it('T1: muestra mensaje vacío cuando no hay sesiones pendientes', () => {
    renderPending()
    expect(screen.getByText('Sin exámenes pendientes')).toBeInTheDocument()
    expect(screen.getByText('Ver exámenes disponibles')).toBeInTheDocument()
  })

  it('T2: muestra sesión pendiente con nombre, tiempo y progreso', () => {
    setSession('42', 'exam', makeSessionData({
      examName: 'Excel Avanzado',
      timeRemaining: 2700,
      answers: { '1': 'a', '2': 'b' },
    }))
    renderPending()
    expect(screen.getByText('Excel Avanzado')).toBeInTheDocument()
    expect(screen.getByText('2/4 respondidos')).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument()
    expect(screen.getByText('Examen')).toBeInTheDocument()
  })

  it('T3: muestra sesión de simulador con badge correcto', () => {
    setSession('42', 'simulator', makeSessionData({
      examName: 'Simulador Word',
    }))
    renderPending()
    expect(screen.getByText('Simulador')).toBeInTheDocument()
  })

  it('T4: muestra múltiples sesiones pendientes', () => {
    setSession('10', 'exam', makeSessionData({ examName: 'Examen A' }))
    setSession('20', 'simulator', makeSessionData({ examName: 'Examen B' }))
    renderPending()
    expect(screen.getByText('Examen A')).toBeInTheDocument()
    expect(screen.getByText('Examen B')).toBeInTheDocument()
    expect(screen.getByText(/2 exámenes pendientes/)).toBeInTheDocument()
  })

  it('T5: botón Continuar navega al examen correcto', () => {
    setSession('42', 'exam', makeSessionData({ examName: 'Test Nav' }))
    renderPending()
    fireEvent.click(screen.getByText('Continuar'))
    expect(mockNavigate).toHaveBeenCalledWith('/test-exams/42/run', {
      state: { questionCount: 3, exerciseCount: 1, mode: 'exam' }
    })
  })

  it('T6: botón Eliminar requiere confirmación', () => {
    setSession('42', 'exam', makeSessionData({ examName: 'Para Borrar' }))
    renderPending()
    
    // Primer click: muestra confirmación
    fireEvent.click(screen.getByText('Eliminar'))
    expect(screen.getByText('Confirmar')).toBeInTheDocument()
    expect(screen.getByText('Cancelar')).toBeInTheDocument()
  })

  it('T7: confirmar eliminación remueve la sesión', () => {
    setSession('42', 'exam', makeSessionData({ examName: 'Para Borrar' }))
    renderPending()
    
    fireEvent.click(screen.getByText('Eliminar'))
    fireEvent.click(screen.getByText('Confirmar'))
    
    expect(localStorage.getItem('exam_session_42_exam')).toBeNull()
    expect(screen.getByText('Sin exámenes pendientes')).toBeInTheDocument()
  })

  it('T8: cancelar eliminación mantiene la sesión', () => {
    setSession('42', 'exam', makeSessionData({ examName: 'Mantener' }))
    renderPending()
    
    fireEvent.click(screen.getByText('Eliminar'))
    fireEvent.click(screen.getByText('Cancelar'))
    
    expect(localStorage.getItem('exam_session_42_exam')).not.toBeNull()
    expect(screen.getByText('Mantener')).toBeInTheDocument()
  })

  it('T9: muestra estado "Pausado" cuando pauseOnDisconnect=true', () => {
    setSession('42', 'exam', makeSessionData({ pauseOnDisconnect: true }))
    renderPending()
    expect(screen.getByText('Pausado')).toBeInTheDocument()
  })

  it('T10: muestra indicador "(corriendo)" cuando pauseOnDisconnect=false', () => {
    setSession('42', 'exam', makeSessionData({ pauseOnDisconnect: false }))
    renderPending()
    expect(screen.getByText('(corriendo)')).toBeInTheDocument()
  })

  it('T11: muestra conteo de desconexiones', () => {
    setSession('42', 'exam', makeSessionData({ disconnectionCount: 3 }))
    const { container } = renderPending()
    const el = container.querySelector('.text-orange-600')
    expect(el).toBeTruthy()
    expect(el!.textContent).toContain('3 desconexi')
  })

  it('T12: ignora sesiones con timeRemaining <= 0', () => {
    setSession('42', 'exam', makeSessionData({ timeRemaining: 0 }))
    renderPending()
    expect(screen.getByText('Sin exámenes pendientes')).toBeInTheDocument()
  })

  it('T13: botón Volver navega a /exams', () => {
    renderPending()
    fireEvent.click(screen.getByText('Volver a exámenes'))
    expect(mockNavigate).toHaveBeenCalledWith('/exams')
  })

  it('T18: usa clases primary (branding) en sesión de examen, no blue hardcodeado', () => {
    setSession('42', 'exam', makeSessionData({ examName: 'Branding Test' }))
    const { container } = renderPending()
    // Border izquierdo del card debe usar primary
    expect(container.querySelector('.border-l-primary-500')).toBeTruthy()
    // Badge de modo examen debe usar primary
    expect(container.querySelector('.bg-primary-100')).toBeTruthy()
    // No debe haber clases blue hardcodeadas
    expect(container.querySelector('.bg-blue-500')).toBeNull()
    expect(container.querySelector('.bg-blue-600')).toBeNull()
    expect(container.querySelector('.border-l-blue-500')).toBeNull()
  })

  it('T19: sesión de simulador mantiene colores amber (no primary)', () => {
    setSession('42', 'simulator', makeSessionData({ examName: 'Sim Test' }))
    const { container } = renderPending()
    expect(container.querySelector('.border-l-amber-500')).toBeTruthy()
    expect(container.querySelector('.bg-amber-100')).toBeTruthy()
  })

  it('T20: botón "Ver exámenes disponibles" usa clases primary', () => {
    const { container } = renderPending()
    const btn = screen.getByText('Ver exámenes disponibles').closest('button')
    expect(btn?.className).toContain('bg-primary-600')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// ExamsListPage - Red Pending Button Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('ExamsListPage — Botón Rojo Exámenes Pendientes', () => {
  it('T14: NO muestra botón rojo cuando no hay sesiones', () => {
    renderExamsList()
    expect(screen.queryByText(/Examen(es)? Pendiente(s)?/)).not.toBeInTheDocument()
  })

  it('T15: muestra botón Pendientes cuando hay 1 sesión pendiente', () => {
    setSession('42', 'exam', makeSessionData())
    renderExamsList()
    expect(screen.getByText('Pendientes')).toBeInTheDocument()
    // Badge con el count
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('T16: muestra botón Pendientes con badge para múltiples sesiones', () => {
    setSession('42', 'exam', makeSessionData())
    setSession('43', 'simulator', makeSessionData())
    renderExamsList()
    expect(screen.getByText('Pendientes')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('T17: botón Pendientes navega a /exams/pending', () => {
    setSession('42', 'exam', makeSessionData())
    renderExamsList()
    fireEvent.click(screen.getByText('Pendientes'))
    expect(mockNavigate).toHaveBeenCalledWith('/exams/pending')
  })
})
