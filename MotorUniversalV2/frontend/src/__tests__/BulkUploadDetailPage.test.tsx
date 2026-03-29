/**
 * Tests para BulkUploadDetailPage — filtro de status en descarga de Excel
 *
 * Verifica:
 *  1. Renderiza stats, info y tabla al cargar
 *  2. Tabs de filtro muestran contadores correctos
 *  3. Click en tab filtra la tabla de miembros
 *  4. Botón de descarga dice "Descargar Excel" cuando filtro es "Todos"
 *  5. Botón de descarga refleja el filtro activo (ej: "Descargar Error")
 *  6. Export pasa statusFilter al service cuando hay filtro activo
 *  7. Export NO pasa status cuando filtro es "all"
 *  8. Búsqueda filtra miembros por nombre/email
 *  9. Búsqueda + tab status se combinan correctamente
 * 10. Muestra badge de status correcto para cada miembro
 *
 * Ejecutar:
 *   cd frontend && npx vitest run src/__tests__/BulkUploadDetailPage.test.tsx
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

// ── Mocks ──
const mockGetDetail = vi.fn()
const mockExport = vi.fn()

vi.mock('../services/userManagementService', () => ({
  getBulkUploadDetail: (...args: unknown[]) => mockGetDetail(...args),
  exportBulkUploadBatch: (...args: unknown[]) => mockExport(...args),
}))

vi.mock('../components/LoadingSpinner', () => ({
  default: ({ message }: { message?: string }) => <div data-testid="spinner">{message}</div>,
}))

// ── Datos de prueba ──
const MOCK_BATCH = {
  id: 27,
  uploaded_by_id: 'user-1',
  uploaded_by_name: 'Juan Pérez',
  partner_id: 1,
  partner_name: 'Partner Test',
  campus_id: 10,
  campus_name: 'Campus Alpha',
  group_id: 5,
  group_name: 'Grupo A',
  country: 'México',
  state_name: 'CDMX',
  total_processed: 5,
  total_created: 2,
  total_existing_assigned: 1,
  total_errors: 1,
  total_skipped: 1,
  emails_sent: 3,
  emails_failed: 0,
  original_filename: 'candidatos.xlsx',
  created_at: '2026-03-15T10:30:00Z',
  members: [
    { id: 1, batch_id: 27, user_id: 'u1', row_number: 1, email: 'ana@test.com', full_name: 'Ana López', username: 'analopez', curp: 'LOPM900101HDFPRA01', gender: 'F', status: 'created', error_message: null, created_at: '2026-03-15T10:30:00Z' },
    { id: 2, batch_id: 27, user_id: 'u2', row_number: 2, email: 'bob@test.com', full_name: 'Bob Smith', username: 'bobsmith', curp: 'SMTB900202HDFPRA02', gender: 'M', status: 'created', error_message: null, created_at: '2026-03-15T10:30:00Z' },
    { id: 3, batch_id: 27, user_id: 'u3', row_number: 3, email: 'carlos@test.com', full_name: 'Carlos Ruiz', username: 'carlosr', curp: 'RUZC900303HDFPRA03', gender: 'M', status: 'existing_assigned', error_message: null, created_at: '2026-03-15T10:30:00Z' },
    { id: 4, batch_id: 27, user_id: null, row_number: 4, email: 'diana@test.com', full_name: 'Diana Vega', username: 'dianav', curp: 'INVALID', gender: 'F', status: 'error', error_message: 'CURP formato inválido', created_at: '2026-03-15T10:30:00Z' },
    { id: 5, batch_id: 27, user_id: null, row_number: 5, email: '', full_name: 'Eva Torres', username: '', curp: '', gender: '', status: 'skipped', error_message: 'Fila vacía', created_at: '2026-03-15T10:30:00Z' },
  ],
}

function renderPage(batchId = '27') {
  mockGetDetail.mockResolvedValue(MOCK_BATCH)
  mockExport.mockResolvedValue(undefined)
  return render(
    <MemoryRouter initialEntries={[`/user-management/bulk-history/${batchId}`]}>
      <Routes>
        <Route path="/user-management/bulk-history/:batchId" element={
          <BulkUploadDetailPageWrapper />
        } />
      </Routes>
    </MemoryRouter>
  )
}

// Lazy import to allow mocks to register first
let BulkUploadDetailPage: any
function BulkUploadDetailPageWrapper() {
  return <BulkUploadDetailPage />
}

beforeEach(async () => {
  vi.clearAllMocks()
  const mod = await import('../pages/users/BulkUploadDetailPage')
  BulkUploadDetailPage = mod.default
})

// ── Tests ──
describe('BulkUploadDetailPage', () => {
  it('T1: renderiza stats y tabla tras cargar', async () => {
    renderPage()
    // Esperar a que carguen los miembros (=datos completos)
    await waitFor(() => {
      expect(screen.getByText('Ana López')).toBeInTheDocument()
    })
    // Stats cards visibles
    expect(screen.getByText('Total Procesados')).toBeInTheDocument()
    expect(screen.getByText('Bob Smith')).toBeInTheDocument()
    expect(mockGetDetail).toHaveBeenCalledWith(27)
  })

  it('T2: tabs muestran contadores correctos', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Ana López')).toBeInTheDocument())

    // "Todos" tab has count 5
    const todosTab = screen.getByRole('button', { name: /Todos/i })
    expect(todosTab).toHaveTextContent('5')

    // "Creados" has count 2
    const creadosTab = screen.getByRole('button', { name: /Creados/i })
    expect(creadosTab).toHaveTextContent('2')

    // "Errores" has count 1
    const erroresTab = screen.getByRole('button', { name: /Errores/i })
    expect(erroresTab).toHaveTextContent('1')
  })

  it('T3: click en tab filtra tabla de miembros', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Ana López')).toBeInTheDocument())

    // Click "Errores" tab
    const erroresTab = screen.getByRole('button', { name: /Errores/i })
    await userEvent.click(erroresTab)

    // Solo Diana (error) visible
    await waitFor(() => {
      expect(screen.getByText('Diana Vega')).toBeInTheDocument()
    })
    expect(screen.queryByText('Ana López')).not.toBeInTheDocument()
    expect(screen.queryByText('Bob Smith')).not.toBeInTheDocument()
  })

  it('T4: botón dice "Descargar Excel" cuando filtro es Todos', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Ana López')).toBeInTheDocument())

    const btn = screen.getByRole('button', { name: /Descargar Excel/i })
    expect(btn).toBeInTheDocument()
  })

  it('T5: botón refleja filtro activo', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Ana López')).toBeInTheDocument())

    // Click "Errores" tab
    const erroresTab = screen.getByRole('button', { name: /Errores/i })
    await userEvent.click(erroresTab)

    // Botón cambia texto
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Descargar Error/i })).toBeInTheDocument()
    })
  })

  it('T6: export pasa statusFilter al service con filtro activo', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Ana López')).toBeInTheDocument())

    // Seleccionar "Creados"
    const creadosTab = screen.getByRole('button', { name: /Creados/i })
    await userEvent.click(creadosTab)

    // Click descargar
    const downloadBtn = screen.getByRole('button', { name: /Descargar Creado/i })
    await userEvent.click(downloadBtn)

    await waitFor(() => {
      expect(mockExport).toHaveBeenCalledWith(27, 'Grupo A', 'created')
    })
  })

  it('T7: export no pasa status cuando filtro es all', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Ana López')).toBeInTheDocument())

    const downloadBtn = screen.getByRole('button', { name: /Descargar Excel/i })
    await userEvent.click(downloadBtn)

    await waitFor(() => {
      expect(mockExport).toHaveBeenCalledWith(27, 'Grupo A', 'all')
    })
  })

  it('T8: búsqueda filtra miembros por nombre', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Ana López')).toBeInTheDocument())

    const searchInput = screen.getByPlaceholderText(/Buscar candidato/i)
    await userEvent.type(searchInput, 'Carlos')

    await waitFor(() => {
      expect(screen.getByText('Carlos Ruiz')).toBeInTheDocument()
    })
    expect(screen.queryByText('Ana López')).not.toBeInTheDocument()
    expect(screen.queryByText('Diana Vega')).not.toBeInTheDocument()
  })

  it('T9: búsqueda + tab status se combinan', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Ana López')).toBeInTheDocument())

    // Filtrar por "Creados"
    const creadosTab = screen.getByRole('button', { name: /Creados/i })
    await userEvent.click(creadosTab)

    // Buscar "Ana"
    const searchInput = screen.getByPlaceholderText(/Buscar candidato/i)
    await userEvent.type(searchInput, 'Ana')

    await waitFor(() => {
      expect(screen.getByText('Ana López')).toBeInTheDocument()
    })
    // Bob es "created" pero no matchea "Ana"
    expect(screen.queryByText('Bob Smith')).not.toBeInTheDocument()
    // Carlos es "existing_assigned", no matched by status
    expect(screen.queryByText('Carlos Ruiz')).not.toBeInTheDocument()
  })

  it('T10: muestra badge de error con mensaje', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Diana Vega')).toBeInTheDocument())

    expect(screen.getByText('CURP formato inválido')).toBeInTheDocument()
  })
})
