/**
 * Tests para ExamConfigPage (Subpágina de configuración de examen para editores)
 *
 * Ejecutar:
 *   cd frontend && npx vitest run src/__tests__/ExamConfigPage.test.tsx
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ExamConfigPage from '../pages/exams/ExamConfigPage'

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

const mockGetExam = vi.fn()
const mockUpdateExam = vi.fn()

vi.mock('../services/examService', () => ({
  examService: {
    getExam: (...args: unknown[]) => mockGetExam(...args),
    updateExam: (...args: unknown[]) => mockUpdateExam(...args),
  },
}))

vi.mock('../components/LoadingSpinner', () => ({
  default: ({ message }: { message?: string }) => (
    <div data-testid="loading-spinner" className="animate-spin">{message}</div>
  ),
}))

vi.mock('../components/Breadcrumb', () => ({
  default: ({ items }: { items: { label: string; path?: string; isActive?: boolean }[] }) => (
    <nav data-testid="breadcrumb">
      {items.map((item, i) => (
        <span key={i} data-testid={`breadcrumb-${i}`}>{item.label}</span>
      ))}
    </nav>
  ),
}))

// ─── Test data ──────────────────────────────────────────────────────────

const MOCK_EXAM = {
  id: 42,
  name: 'Excel Avanzado',
  version: '2.0',
  standard: 'EC0435',
  stage_id: 1,
  description: 'Examen de Excel avanzado',
  duration_minutes: 90,
  passing_score: 70,
  pause_on_disconnect: true,
  is_active: true,
  is_published: false,
  total_questions: 30,
  total_exercises: 10,
  total_categories: 3,
  exam_questions_count: 20,
  simulator_questions_count: 10,
  exam_exercises_count: 6,
  simulator_exercises_count: 4,
  default_max_attempts: 3,
  default_max_disconnections: 5,
  default_exam_content_type: 'mixed',
  default_exam_questions_count: null,
  default_exam_exercises_count: null,
  default_simulator_questions_count: null,
  default_simulator_exercises_count: null,
  created_at: '2026-03-01T10:00:00Z',
  updated_at: '2026-03-20T15:00:00Z',
  competency_standard: { id: 5, code: 'EC0435', name: 'Gestión de Datos' },
  categories: [],
}

const MOCK_EXAM_CUSTOM_COUNTS = {
  ...MOCK_EXAM,
  default_exam_questions_count: 15,
  default_exam_exercises_count: 4,
  default_simulator_questions_count: 8,
  default_simulator_exercises_count: 3,
}

// ─── Helpers ────────────────────────────────────────────────────────────

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
}

function renderConfigPage(examId = '42') {
  const queryClient = createQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/exams/${examId}/config`]}>
        <Routes>
          <Route path="/exams/:id/config" element={<ExamConfigPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

// ─── Tests ──────────────────────────────────────────────────────────────

describe('ExamConfigPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── Estado de carga ──
  it('muestra spinner mientras carga', () => {
    mockGetExam.mockReturnValue(new Promise(() => {}))
    renderConfigPage()
    expect(screen.getByTestId('loading-spinner')).toBeTruthy()
    expect(screen.getByText('Cargando configuración...')).toBeTruthy()
  })

  // ── Error al cargar ──
  it('muestra mensaje de error cuando falla la carga', async () => {
    mockGetExam.mockRejectedValue(new Error('Network error'))
    renderConfigPage()
    await waitFor(() => {
      expect(screen.getByText('Error al cargar el examen')).toBeTruthy()
    })
  })

  // ── Renderizado correcto ──
  describe('con datos del examen', () => {
    beforeEach(() => {
      mockGetExam.mockResolvedValue(MOCK_EXAM)
    })

    it('muestra el título "Configuración del Examen"', async () => {
      renderConfigPage()
      await waitFor(() => {
        expect(screen.getByText('Configuración del Examen')).toBeTruthy()
      })
    })

    it('muestra la descripción del propósito', async () => {
      renderConfigPage()
      await waitFor(() => {
        expect(screen.getByText(/se heredan como predeterminados/i)).toBeTruthy()
      })
    })

    it('muestra nombre del examen en el banner', async () => {
      renderConfigPage()
      await waitFor(() => {
        const matches = screen.getAllByText('Excel Avanzado')
        // Aparece en breadcrumb y en el banner h3
        expect(matches.length).toBeGreaterThanOrEqual(2)
      })
    })

    it('muestra versión del examen', async () => {
      renderConfigPage()
      await waitFor(() => {
        expect(screen.getByText('2.0')).toBeTruthy()
      })
    })

    it('muestra código ECM', async () => {
      renderConfigPage()
      await waitFor(() => {
        expect(screen.getByText('ECM: EC0435')).toBeTruthy()
      })
    })

    it('muestra breadcrumb con nombre del examen y Configuración', async () => {
      renderConfigPage()
      await waitFor(() => {
        expect(screen.getByTestId('breadcrumb-0').textContent).toBe('Excel Avanzado')
        expect(screen.getByTestId('breadcrumb-1').textContent).toBe('Configuración')
      })
    })

    it('muestra botón "Volver al examen"', async () => {
      renderConfigPage()
      await waitFor(() => {
        expect(screen.getByText('Volver al examen')).toBeTruthy()
      })
    })

    // ── Sección Intentos y Desconexiones ──
    it('muestra sección "Intentos y Desconexiones"', async () => {
      renderConfigPage()
      await waitFor(() => {
        expect(screen.getByText('Intentos y Desconexiones')).toBeTruthy()
      })
    })

    it('muestra labels de reintentos y desconexiones', async () => {
      renderConfigPage()
      await waitFor(() => {
        expect(screen.getByText('Reintentos Permitidos')).toBeTruthy()
        expect(screen.getByText('Oportunidades de Desconexión')).toBeTruthy()
      })
    })

    it('inicializa reintentos con valor del examen (3)', async () => {
      renderConfigPage()
      await waitFor(() => {
        const inputs = document.querySelectorAll('input[type="number"]')
        const attempts = Array.from(inputs).find(i => (i as HTMLInputElement).value === '3')
        expect(attempts).toBeTruthy()
      })
    })

    it('inicializa desconexiones con valor del examen (5)', async () => {
      renderConfigPage()
      await waitFor(() => {
        const inputs = document.querySelectorAll('input[type="number"]')
        const disconnections = Array.from(inputs).find(i => (i as HTMLInputElement).value === '5')
        expect(disconnections).toBeTruthy()
      })
    })

    // ── Sección Tipo de Contenido ──
    it('muestra sección "Tipo de Contenido"', async () => {
      renderConfigPage()
      await waitFor(() => {
        expect(screen.getByText('Tipo de Contenido')).toBeTruthy()
      })
    })

    it('muestra las 3 opciones de tipo de contenido', async () => {
      renderConfigPage()
      await waitFor(() => {
        expect(screen.getByText('Mixto')).toBeTruthy()
        expect(screen.getByText('Solo Preguntas')).toBeTruthy()
        expect(screen.getByText('Solo Ejercicios')).toBeTruthy()
      })
    })

    it('muestra descripciones de tipos de contenido', async () => {
      renderConfigPage()
      await waitFor(() => {
        expect(screen.getByText('Preguntas y ejercicios interactivos')).toBeTruthy()
        expect(screen.getByText('Únicamente preguntas teóricas')).toBeTruthy()
        expect(screen.getByText('Únicamente ejercicios interactivos')).toBeTruthy()
      })
    })

    // ── Sección Cantidades ──
    it('muestra sección "Cantidad de Contenido"', async () => {
      renderConfigPage()
      await waitFor(() => {
        expect(screen.getByText('Cantidad de Contenido')).toBeTruthy()
      })
    })

    it('muestra secciones de cantidades Examen y Simulador', async () => {
      renderConfigPage()
      await waitFor(() => {
        expect(screen.getByText('Cantidades — Examen')).toBeTruthy()
        expect(screen.getByText('Cantidades — Simulador')).toBeTruthy()
      })
    })

    it('muestra conteos disponibles del examen', async () => {
      renderConfigPage()
      await waitFor(() => {
        expect(screen.getByText('Preg. Examen')).toBeTruthy()
        expect(screen.getByText('Preg. Simulador')).toBeTruthy()
        expect(screen.getByText('Ejer. Examen')).toBeTruthy()
        expect(screen.getByText('Ejer. Simulador')).toBeTruthy()
      })
    })

    it('checkboxes "usar todas" están marcados cuando counts son null', async () => {
      renderConfigPage()
      await waitFor(() => {
        const checkboxes = document.querySelectorAll('input[type="checkbox"]')
        const checked = Array.from(checkboxes).filter(c => (c as HTMLInputElement).checked)
        expect(checked.length).toBe(4)
      })
    })

    // ── Botones ──
    it('muestra botón "Guardar Configuración"', async () => {
      renderConfigPage()
      await waitFor(() => {
        expect(screen.getByText('Guardar Configuración')).toBeTruthy()
      })
    })

    it('muestra botón "Cancelar"', async () => {
      renderConfigPage()
      await waitFor(() => {
        expect(screen.getByText('Cancelar')).toBeTruthy()
      })
    })
  })

  // ── Examen con conteos personalizados ──
  describe('con conteos personalizados', () => {
    beforeEach(() => {
      mockGetExam.mockResolvedValue(MOCK_EXAM_CUSTOM_COUNTS)
    })

    it('checkboxes "usar todas" no están marcados cuando hay conteos', async () => {
      renderConfigPage()
      await waitFor(() => {
        const checkboxes = document.querySelectorAll('input[type="checkbox"]')
        const unchecked = Array.from(checkboxes).filter(c => !(c as HTMLInputElement).checked)
        expect(unchecked.length).toBe(4)
      })
    })

    it('muestra campos numéricos con los valores personalizados', async () => {
      renderConfigPage()
      await waitFor(() => {
        const inputs = document.querySelectorAll('input[type="number"]')
        const values = Array.from(inputs).map(i => (i as HTMLInputElement).value)
        expect(values).toContain('15')
        expect(values).toContain('8')
      })
    })
  })

  // ── Guardado exitoso ──
  describe('guardado', () => {
    beforeEach(() => {
      mockGetExam.mockResolvedValue(MOCK_EXAM)
      mockUpdateExam.mockResolvedValue({
        message: 'Examen actualizado exitosamente',
        exam: MOCK_EXAM,
      })
    })

    it('llama a updateExam con los campos correctos al guardar', async () => {
      renderConfigPage()
      await waitFor(() => {
        expect(screen.getByText('Guardar Configuración')).toBeTruthy()
      })

      fireEvent.click(screen.getByText('Guardar Configuración'))

      await waitFor(() => {
        expect(mockUpdateExam).toHaveBeenCalledTimes(1)
        expect(mockUpdateExam).toHaveBeenCalledWith(42, {
          default_max_attempts: 3,
          default_max_disconnections: 5,
          default_exam_content_type: 'mixed',
          default_exam_questions_count: null,
          default_exam_exercises_count: null,
          default_simulator_questions_count: null,
          default_simulator_exercises_count: null,
        })
      })
    })

    it('muestra toast de éxito al guardar correctamente', async () => {
      renderConfigPage()
      await waitFor(() => {
        expect(screen.getByText('Guardar Configuración')).toBeTruthy()
      })

      fireEvent.click(screen.getByText('Guardar Configuración'))

      await waitFor(() => {
        expect(screen.getByText('Configuración guardada correctamente')).toBeTruthy()
      })
    })
  })

  // ── Error al guardar ──
  describe('error al guardar', () => {
    beforeEach(() => {
      mockGetExam.mockResolvedValue(MOCK_EXAM)
      mockUpdateExam.mockRejectedValue({
        response: { data: { error: 'No tienes permiso para editar este examen' } },
      })
    })

    it('muestra toast de error con mensaje del servidor', async () => {
      renderConfigPage()
      await waitFor(() => {
        expect(screen.getByText('Guardar Configuración')).toBeTruthy()
      })

      fireEvent.click(screen.getByText('Guardar Configuración'))

      await waitFor(() => {
        expect(screen.getByText(/No tienes permiso para editar este examen/)).toBeTruthy()
      })
    })
  })

  // ── Interacción: cambiar tipo de contenido ──
  describe('cambiar tipo de contenido', () => {
    beforeEach(() => {
      mockGetExam.mockResolvedValue(MOCK_EXAM)
      mockUpdateExam.mockResolvedValue({ message: 'ok', exam: MOCK_EXAM })
    })

    it('al seleccionar "Solo Preguntas" se envía content_type correcto', async () => {
      renderConfigPage()
      await waitFor(() => {
        expect(screen.getByText('Solo Preguntas')).toBeTruthy()
      })

      fireEvent.click(screen.getByText('Solo Preguntas'))
      fireEvent.click(screen.getByText('Guardar Configuración'))

      await waitFor(() => {
        expect(mockUpdateExam).toHaveBeenCalledWith(42, expect.objectContaining({
          default_exam_content_type: 'questions_only',
        }))
      })
    })

    it('al seleccionar "Solo Ejercicios" se envía content_type correcto', async () => {
      renderConfigPage()
      await waitFor(() => {
        expect(screen.getByText('Solo Ejercicios')).toBeTruthy()
      })

      fireEvent.click(screen.getByText('Solo Ejercicios'))
      fireEvent.click(screen.getByText('Guardar Configuración'))

      await waitFor(() => {
        expect(mockUpdateExam).toHaveBeenCalledWith(42, expect.objectContaining({
          default_exam_content_type: 'exercises_only',
        }))
      })
    })
  })

  // ── Interacción: cambiar reintentos ──
  describe('cambiar reintentos y desconexiones', () => {
    beforeEach(() => {
      mockGetExam.mockResolvedValue(MOCK_EXAM)
      mockUpdateExam.mockResolvedValue({ message: 'ok', exam: MOCK_EXAM })
    })

    it('permite cambiar reintentos y se envía valor actualizado', async () => {
      renderConfigPage()
      await waitFor(() => {
        expect(screen.getByText('Reintentos Permitidos')).toBeTruthy()
      })

      const inputs = document.querySelectorAll('input[type="number"]')
      const attemptsInput = Array.from(inputs).find(i => (i as HTMLInputElement).value === '3') as HTMLInputElement
      expect(attemptsInput).toBeTruthy()

      fireEvent.change(attemptsInput, { target: { value: '5' } })
      fireEvent.click(screen.getByText('Guardar Configuración'))

      await waitFor(() => {
        expect(mockUpdateExam).toHaveBeenCalledWith(42, expect.objectContaining({
          default_max_attempts: 5,
        }))
      })
    })

    it('permite cambiar desconexiones y se envía valor actualizado', async () => {
      renderConfigPage()
      await waitFor(() => {
        expect(screen.getByText('Oportunidades de Desconexión')).toBeTruthy()
      })

      const inputs = document.querySelectorAll('input[type="number"]')
      const disconnInput = Array.from(inputs).find(i => (i as HTMLInputElement).value === '5') as HTMLInputElement
      expect(disconnInput).toBeTruthy()

      fireEvent.change(disconnInput, { target: { value: '7' } })
      fireEvent.click(screen.getByText('Guardar Configuración'))

      await waitFor(() => {
        expect(mockUpdateExam).toHaveBeenCalledWith(42, expect.objectContaining({
          default_max_disconnections: 7,
        }))
      })
    })
  })

  // ── Interacción: desmarcar checkbox "usar todas" ──
  describe('checkboxes de cantidades', () => {
    beforeEach(() => {
      mockGetExam.mockResolvedValue(MOCK_EXAM)
      mockUpdateExam.mockResolvedValue({ message: 'ok', exam: MOCK_EXAM })
    })

    it('al desmarcar checkbox aparece campo numérico con total disponible', async () => {
      renderConfigPage()
      await waitFor(() => {
        expect(screen.getByText('Cantidad de Contenido')).toBeTruthy()
      })

      // All 4 checkboxes should be checked initially
      const checkboxes = document.querySelectorAll('input[type="checkbox"]')
      expect(checkboxes.length).toBe(4)

      // Uncheck first checkbox (exam questions "usar todas")
      fireEvent.click(checkboxes[0])

      // A new number input should appear with the exam questions count
      await waitFor(() => {
        const inputs = document.querySelectorAll('input[type="number"]')
        const values = Array.from(inputs).map(i => (i as HTMLInputElement).value)
        // Should contain 20 (exam_questions_count from MOCK_EXAM)
        expect(values).toContain('20')
      })
    })
  })
})
