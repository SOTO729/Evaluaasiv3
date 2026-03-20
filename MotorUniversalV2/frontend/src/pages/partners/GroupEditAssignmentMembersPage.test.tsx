/**
 * Tests de módulo de Asignación y Carga Masiva en GroupEditAssignmentMembersPage
 *
 * Cubre:
 *   A. Botones del toolbar (Asignar + Carga masiva)
 *   B. Modal de Asignar Candidatos (apertura, búsqueda, selección, confirmación)
 *   C. Modal de Carga Masiva (paso 1: archivo, paso 2: preview, paso 3: resultado)
 *   D. Servicio addAssignmentsToExam
 *   E. Errores y edge cases
 *
 * Ejecutar:
 *   cd frontend && npx vitest run src/pages/partners/GroupEditAssignmentMembersPage.test.tsx
 *   cd frontend && npx vitest run src/pages/partners/GroupEditAssignmentMembersPage.test.tsx -t "Asignar"
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// ─── Mocks ──────────────────────────────────────────────────────────────

const mockGetGroup = vi.fn();
const mockGetExamMembersDetail = vi.fn();
const mockSwapExamMember = vi.fn();
const mockBulkSwapExamMembers = vi.fn();
const mockPreviewEcmRetake = vi.fn();
const mockApplyEcmRetake = vi.fn();
const mockAddAssignmentsToExam = vi.fn();
const mockBulkAssignExamsByECM = vi.fn();
const mockDownloadBulkExamAssignTemplate = vi.fn();

vi.mock('../../services/partnersService', () => ({
  getGroup: (...args: unknown[]) => mockGetGroup(...args),
  getExamMembersDetail: (...args: unknown[]) => mockGetExamMembersDetail(...args),
  swapExamMember: (...args: unknown[]) => mockSwapExamMember(...args),
  bulkSwapExamMembers: (...args: unknown[]) => mockBulkSwapExamMembers(...args),
  previewEcmRetake: (...args: unknown[]) => mockPreviewEcmRetake(...args),
  applyEcmRetake: (...args: unknown[]) => mockApplyEcmRetake(...args),
  addAssignmentsToExam: (...args: unknown[]) => mockAddAssignmentsToExam(...args),
  bulkAssignExamsByECM: (...args: unknown[]) => mockBulkAssignExamsByECM(...args),
  downloadBulkExamAssignTemplate: (...args: unknown[]) => mockDownloadBulkExamAssignTemplate(...args),
}));

const mockUseAuthStore = vi.fn();
vi.mock('../../store/authStore', () => ({
  useAuthStore: () => mockUseAuthStore(),
}));

vi.mock('../../components/LoadingSpinner', () => ({
  default: () => <div data-testid="loading-spinner">Cargando...</div>,
}));

vi.mock('../../components/PartnersBreadcrumb', () => ({
  default: () => <nav data-testid="breadcrumb">Breadcrumb</nav>,
}));

// ─── Datos de prueba ────────────────────────────────────────────────────

const COORD_USER = {
  id: 'coord-1',
  email: 'coord@test.com',
  username: 'coord1',
  name: 'Coordinador',
  first_surname: 'Test',
  full_name: 'Coordinador Test',
  role: 'coordinator' as const,
  is_active: true,
  is_verified: true,
  created_at: '2024-01-01',
};

const MOCK_GROUP = {
  id: 130,
  name: 'Grupo Test',
  campus_id: 10,
  status: 'active',
  members: [],
};

const makeMember = (
  id: string,
  name: string,
  assignmentNumber: string | null,
  isLocked = false,
) => ({
  user_id: id,
  user: {
    id,
    name,
    first_surname: 'Apellido',
    second_surname: 'Segundo',
    full_name: `${name} Apellido`,
    email: `${name.toLowerCase()}@test.com`,
    curp: null,
    username: name.toLowerCase(),
  },
  assignment_number: assignmentNumber,
  ecm_assignment_id: assignmentNumber ? 100 : null,
  ecm_assignment_date: assignmentNumber ? '2024-06-01' : null,
  material_progress: 0,
  has_opened_exam: false,
  results_count: 0,
  is_locked: isLocked,
  lock_reasons: isLocked ? ['has_progress'] : [],
  retakes_count: 0,
  retakes_active: 0,
  max_retakes: 2,
  total_allowed_attempts: 3,
  attempts_remaining: 3,
  attempts_exhausted: false,
  can_retake: false,
});

const MEMBER_WITH_ASSIGNMENT = makeMember('u1', 'Juan', 'ASG-ABC12345', false);
const MEMBER_WITHOUT_ASSIGNMENT = makeMember('u2', 'Maria', null, false);
const MEMBER_WITHOUT_ASSIGNMENT_2 = makeMember('u3', 'Pedro', null, false);
const MEMBER_LOCKED = makeMember('u4', 'Ana', 'ASG-DEF67890', true);

const MOCK_DETAIL_RESPONSE = {
  assignment_id: 1249,
  exam_id: 50,
  exam_name: 'Examen de Prueba',
  ecm_id: 5,
  ecm_code: 'ECM-TEST-001',
  assignment_type: 'selected' as const,
  max_attempts: 3,
  max_retakes: 2,
  members: [MEMBER_WITH_ASSIGNMENT, MEMBER_WITHOUT_ASSIGNMENT, MEMBER_WITHOUT_ASSIGNMENT_2, MEMBER_LOCKED],
  total: 4,
  page: 1,
  pages: 1,
  per_page: 150,
  locked_count: 1,
  swappable_count: 1,
};

const MOCK_ASSIGN_RESULT = {
  message: '2 asignación(es) creada(s) exitosamente',
  assigned: [
    { user_id: 'u2', user_name: 'Maria Apellido', assignment_number: 'ASG-NEW00001' },
    { user_id: 'u3', user_name: 'Pedro Apellido', assignment_number: 'ASG-NEW00002' },
  ],
  assigned_count: 2,
  already_assigned: [],
  already_assigned_count: 0,
  total_cost: 500.0,
  unit_cost: 250.0,
};

const MOCK_ASSIGN_RESULT_PARTIAL = {
  message: '1 asignación(es) creada(s) exitosamente',
  assigned: [
    { user_id: 'u2', user_name: 'Maria Apellido', assignment_number: 'ASG-NEW00001' },
  ],
  assigned_count: 1,
  already_assigned: [
    { user_id: 'u1', user_name: 'Juan Apellido', assignment_number: 'ASG-ABC12345' },
  ],
  already_assigned_count: 1,
  total_cost: 250.0,
  unit_cost: 250.0,
};

const MOCK_BULK_PREVIEW = {
  message: 'Vista previa de asignación masiva',
  results: {
    processed: 3,
    assigned: [
      { row: 2, username: 'maria', user_name: 'Maria Apellido', exam_name: 'Examen de Prueba' },
      { row: 3, username: 'pedro', user_name: 'Pedro Apellido', exam_name: 'Examen de Prueba' },
    ],
    skipped: [
      { row: 4, username: 'juan', user_name: 'Juan Apellido', reason: 'Ya tiene asignación' },
    ],
    errors: [],
  },
  summary: { total_processed: 3, assigned: 2, skipped: 1, errors: 0 },
};

const MOCK_BULK_RESULT = {
  message: '2 asignaciones creadas exitosamente',
  results: {
    processed: 3,
    assigned: [
      { row: 2, username: 'maria', user_name: 'Maria', exam_name: 'Examen' },
      { row: 3, username: 'pedro', user_name: 'Pedro', exam_name: 'Examen' },
    ],
    skipped: [
      { row: 4, username: 'juan', user_name: 'Juan', reason: 'Ya tiene asignación' },
    ],
    errors: [],
  },
  summary: { total_processed: 3, assigned: 2, skipped: 1, errors: 0 },
};

// ═══════════════════════════════════════════════════════════════════════════

describe('GroupEditAssignmentMembersPage — Asignación y Carga Masiva', () => {
  let GroupEditAssignmentMembersPage: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockUseAuthStore.mockReturnValue({ user: COORD_USER });
    mockGetGroup.mockResolvedValue(MOCK_GROUP);
    mockGetExamMembersDetail.mockResolvedValue(MOCK_DETAIL_RESPONSE);
    mockAddAssignmentsToExam.mockResolvedValue(MOCK_ASSIGN_RESULT);
    mockBulkAssignExamsByECM.mockResolvedValue(MOCK_BULK_PREVIEW);
    mockDownloadBulkExamAssignTemplate.mockResolvedValue(new Blob(['template'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    globalThis.URL.revokeObjectURL = vi.fn();

    const mod = await import('./GroupEditAssignmentMembersPage');
    GroupEditAssignmentMembersPage = mod.default;
  });

  function renderPage() {
    return render(
      <MemoryRouter initialEntries={['/partners/groups/130/assignments/1249/edit-members?type=exam&name=Examen+de+Prueba']}>
        <Routes>
          <Route
            path="/partners/groups/:groupId/assignments/:assignmentId/edit-members"
            element={<GroupEditAssignmentMembersPage />}
          />
        </Routes>
      </MemoryRouter>
    );
  }

  async function waitForPageLoad() {
    // Esperar que desaparezca el spinner (getGroup cargó)
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    }, { timeout: 5000 });
    // Esperar que detailData se haya cargado (handleSearch debounced 400ms)
    await waitFor(() => {
      expect(screen.getByText('ECM-TEST-001')).toBeInTheDocument();
    }, { timeout: 5000 });
  }

  // ─── A. Toolbar Buttons ────────────────────────────────────────────

  describe('A. Botones del toolbar', () => {
    it('A1. muestra botón "Asignar" en el toolbar', async () => {
      renderPage();
      await waitForPageLoad();
      expect(screen.getByText('Asignar')).toBeInTheDocument();
    });

    it('A2. muestra botón "Carga masiva" en el toolbar', async () => {
      renderPage();
      await waitForPageLoad();
      expect(screen.getByText('Carga masiva')).toBeInTheDocument();
    });

    it('A3. botón Asignar abre el modal de asignación', async () => {
      renderPage();
      const user = userEvent.setup();
      await waitForPageLoad();

      await user.click(screen.getByText('Asignar'));

      await waitFor(() => {
        expect(screen.getByText('Asignar Candidatos')).toBeInTheDocument();
      });
    });

    it('A4. botón Carga masiva abre el modal de carga', async () => {
      renderPage();
      const user = userEvent.setup();
      await waitForPageLoad();

      await user.click(screen.getByText('Carga masiva'));

      await waitFor(() => {
        expect(screen.getByText('Carga Masiva de Asignaciones')).toBeInTheDocument();
      });
    });
  });

  // ─── B. Modal de Asignar Candidatos ────────────────────────────────

  describe('B. Modal de Asignar Candidatos', () => {
    async function openAssignModal() {
      renderPage();
      const user = userEvent.setup();
      await waitForPageLoad();
      await user.click(screen.getByText('Asignar'));
      await waitFor(() => {
        expect(screen.getByText('Asignar Candidatos')).toBeInTheDocument();
      });
      return user;
    }

    it('B1. muestra título y descripción del modal', async () => {
      await openAssignModal();
      expect(screen.getByText('Asignar Candidatos')).toBeInTheDocument();
      expect(screen.getByText(/Selecciona miembros del grupo/)).toBeInTheDocument();
    });

    it('B2. muestra campo de búsqueda', async () => {
      await openAssignModal();
      expect(screen.getByPlaceholderText(/buscar miembro sin asignación/i)).toBeInTheDocument();
    });

    it('B3. carga candidatos sin asignación al abrir', async () => {
      await openAssignModal();

      // Debería haber llamado a getExamMembersDetail para obtener candidatos
      await waitFor(() => {
        expect(mockGetExamMembersDetail).toHaveBeenCalled();
      });
    });

    it('B4. muestra candidatos sin assignment_number', async () => {
      await openAssignModal();

      // Wait for modal candidate list to load (has 400ms debounce)
      await waitFor(() => {
        expect(screen.getByText('Seleccionar todos')).toBeInTheDocument();
      }, { timeout: 3000 });

      // Los candidatos sin asignación: Maria, Pedro (aparecen TAMBIÉN en la tabla)
      const mariaElements = screen.getAllByText('Maria Apellido');
      expect(mariaElements.length).toBeGreaterThanOrEqual(2); // tabla + modal
      const pedroElements = screen.getAllByText('Pedro Apellido');
      expect(pedroElements.length).toBeGreaterThanOrEqual(2);
    });

    it('B5. permite seleccionar/deseleccionar candidatos', async () => {
      const user = await openAssignModal();

      await waitFor(() => {
        expect(screen.getByText('Seleccionar todos')).toBeInTheDocument();
      }, { timeout: 3000 });

      // Seleccionar Maria — buscar la instancia que está dentro de un <button>
      const allMarias = screen.getAllByText('Maria Apellido');
      const mariaInModal = allMarias.find(el => el.closest('button'));
      expect(mariaInModal).toBeTruthy();
      await user.click(mariaInModal!.closest('button')!);

      // Verificar que el botón de confirmar muestra 1 candidato
      await waitFor(() => {
        expect(screen.getByText(/Asignar 1 candidato\b/)).toBeInTheDocument();
      });
    });

    it('B6. botón "Seleccionar todos" selecciona todos los candidatos', async () => {
      const user = await openAssignModal();

      await waitFor(() => {
        expect(screen.getByText('Seleccionar todos')).toBeInTheDocument();
      }, { timeout: 3000 });

      const selectAllBtn = screen.getByText('Seleccionar todos');
      await user.click(selectAllBtn);

      await waitFor(() => {
        expect(screen.getByText(/Asignar 2 candidatos/)).toBeInTheDocument();
      });
    });

    it('B7. botón confirmar llama addAssignmentsToExam con ids seleccionados', async () => {
      const user = await openAssignModal();

      await waitFor(() => {
        expect(screen.getByText('Seleccionar todos')).toBeInTheDocument();
      }, { timeout: 3000 });

      // Seleccionar todos
      await user.click(screen.getByText('Seleccionar todos'));

      await waitFor(() => {
        expect(screen.getByText(/Asignar 2 candidatos/)).toBeInTheDocument();
      });

      // Confirmar
      await user.click(screen.getByText(/Asignar 2 candidatos/));

      await waitFor(() => {
        expect(mockAddAssignmentsToExam).toHaveBeenCalledWith(130, 1249, expect.any(Array));
      });

      // Verificar user_ids enviados
      const calledUserIds = mockAddAssignmentsToExam.mock.calls[0][2] as string[];
      expect(calledUserIds).toContain('u2');
      expect(calledUserIds).toContain('u3');
    });

    it('B8. muestra resultados de asignación tras confirmar', async () => {
      const user = await openAssignModal();

      await waitFor(() => {
        expect(screen.getByText('Seleccionar todos')).toBeInTheDocument();
      }, { timeout: 3000 });

      await user.click(screen.getByText('Seleccionar todos'));

      await waitFor(() => {
        expect(screen.getByText(/Asignar 2 candidatos/)).toBeInTheDocument();
      });

      await user.click(screen.getByText(/Asignar 2 candidatos/));

      await waitFor(() => {
        expect(screen.getAllByText(/2 asignación\(es\) creada\(s\)/).length).toBeGreaterThanOrEqual(1);
      });

      // Los números de asignación generados deben mostrarse
      expect(screen.getByText('ASG-NEW00001')).toBeInTheDocument();
      expect(screen.getByText('ASG-NEW00002')).toBeInTheDocument();
    });

    it('B9. muestra already_assigned cuando hay duplicados', async () => {
      mockAddAssignmentsToExam.mockResolvedValue(MOCK_ASSIGN_RESULT_PARTIAL);
      const user = await openAssignModal();

      await waitFor(() => {
        expect(screen.getByText('Seleccionar todos')).toBeInTheDocument();
      }, { timeout: 3000 });

      const mariaInModal = screen.getAllByText('Maria Apellido').find(el => el.closest('button'));
      await user.click(mariaInModal!.closest('button')!);

      await waitFor(() => {
        expect(screen.getByText(/Asignar 1 candidato\b/)).toBeInTheDocument();
      });

      await user.click(screen.getByText(/Asignar 1 candidato\b/));

      await waitFor(() => {
        expect(screen.getByText(/1 ya tenía\(n\) asignación/)).toBeInTheDocument();
      });
    });

    it('B10. muestra costo total cuando hay créditos cobrados', async () => {
      const user = await openAssignModal();

      await waitFor(() => {
        expect(screen.getByText('Seleccionar todos')).toBeInTheDocument();
      }, { timeout: 3000 });

      await user.click(screen.getByText('Seleccionar todos'));
      await waitFor(() => {
        expect(screen.getByText(/Asignar 2 candidatos/)).toBeInTheDocument();
      });
      await user.click(screen.getByText(/Asignar 2 candidatos/));

      await waitFor(() => {
        expect(screen.getByText(/\$500\.00/)).toBeInTheDocument();
      });
    });

    it('B11. botón confirmar deshabilitado sin selección', async () => {
      await openAssignModal();

      await waitFor(() => {
        const btn = screen.getByText(/Asignar 0 candidato/);
        expect(btn.closest('button')).toBeDisabled();
      });
    });

    it('B12. error del servicio muestra mensaje', async () => {
      mockAddAssignmentsToExam.mockRejectedValue({
        response: { data: { error: 'Saldo insuficiente' } },
      });
      const user = await openAssignModal();

      await waitFor(() => {
        expect(screen.getByText('Seleccionar todos')).toBeInTheDocument();
      }, { timeout: 3000 });

      const mariaInModal = screen.getAllByText('Maria Apellido').find(el => el.closest('button'));
      await user.click(mariaInModal!.closest('button')!);
      await waitFor(() => {
        expect(screen.getByText(/Asignar 1 candidato\b/)).toBeInTheDocument();
      });
      await user.click(screen.getByText(/Asignar 1 candidato\b/));

      await waitFor(() => {
        expect(screen.getByText(/Saldo insuficiente/)).toBeInTheDocument();
      });
    });

    it('B13. cerrar modal con botón Cancelar', async () => {
      const user = await openAssignModal();
      const cancelBtn = screen.getByText('Cancelar');
      await user.click(cancelBtn);

      await waitFor(() => {
        expect(screen.queryByText('Asignar Candidatos')).not.toBeInTheDocument();
      });
    });
  });

  // ─── C. Modal de Carga Masiva ──────────────────────────────────────

  describe('C. Modal de Carga Masiva', () => {
    async function openBulkModal() {
      renderPage();
      const user = userEvent.setup();
      await waitForPageLoad();
      await user.click(screen.getByText('Carga masiva'));
      await waitFor(() => {
        expect(screen.getByText('Carga Masiva de Asignaciones')).toBeInTheDocument();
      });
      return user;
    }

    it('C1. muestra paso 1 al abrir', async () => {
      await openBulkModal();
      expect(screen.getByText('Paso 1 de 3')).toBeInTheDocument();
      expect(screen.getByText(/Sube un archivo Excel/)).toBeInTheDocument();
    });

    it('C2. muestra instrucciones en paso 1', async () => {
      await openBulkModal();
      expect(screen.getByText(/Instrucciones:/)).toBeInTheDocument();
      expect(screen.getByText(/El archivo debe ser Excel/)).toBeInTheDocument();
    });

    it('C3. muestra botón de descargar plantilla', async () => {
      await openBulkModal();
      const dlBtn = screen.getByText('Descargar plantilla Excel');
      expect(dlBtn).toBeInTheDocument();
    });

    it('C4. descargar plantilla llama al servicio', async () => {
      const user = await openBulkModal();
      await user.click(screen.getByText('Descargar plantilla Excel'));

      await waitFor(() => {
        expect(mockDownloadBulkExamAssignTemplate).toHaveBeenCalledWith(130);
      });
    });

    it('C5. botón Previsualizar deshabilitado sin archivo', async () => {
      await openBulkModal();
      const previewBtn = screen.getByText('Previsualizar');
      expect(previewBtn.closest('button')).toBeDisabled();
    });

    it('C6. subir archivo habilita el botón Previsualizar', async () => {
      const user = await openBulkModal();

      // Simular subir archivo
      const file = new File(['data'], 'asignaciones.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      expect(input).not.toBeNull();
      await user.upload(input, file);

      await waitFor(() => {
        expect(screen.getByText('asignaciones.xlsx')).toBeInTheDocument();
      });

      const previewBtn = screen.getByText('Previsualizar');
      expect(previewBtn.closest('button')).not.toBeDisabled();
    });

    it('C7. previsualizar llama a bulkAssignExamsByECM con dryRun=true', async () => {
      const user = await openBulkModal();

      const file = new File(['data'], 'test.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      await user.upload(input, file);

      // Wait for file name to appear AND button to be enabled
      await waitFor(() => {
        expect(screen.getByText('test.xlsx')).toBeInTheDocument();
        const btn = screen.getByText('Previsualizar').closest('button')!;
        expect(btn).not.toBeDisabled();
      });

      await user.click(screen.getByText('Previsualizar').closest('button')!);

      await waitFor(() => {
        expect(mockBulkAssignExamsByECM).toHaveBeenCalledWith(
          130,
          expect.any(File),
          'ECM-TEST-001',
          undefined,
          true, // dryRun
        );
      }, { timeout: 3000 });
    });

    it('C8. paso 2 muestra resumen de preview (asignados, omitidos, errores)', async () => {
      const user = await openBulkModal();

      const file = new File(['data'], 'test.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      await user.upload(input, file);
      await waitFor(() => expect(screen.getByText('test.xlsx')).toBeInTheDocument());

      await user.click(screen.getByText('Previsualizar'));

      await waitFor(() => {
        expect(screen.getByText('Paso 2 de 3')).toBeInTheDocument();
      });

      // Resumen números — pueden aparecer múltiples '2' y '1' en la página
      expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Por asignar')).toBeInTheDocument();
      expect(screen.getByText('Omitidos')).toBeInTheDocument();
    });

    it('C9. paso 2 muestra botón Confirmar con count', async () => {
      const user = await openBulkModal();

      const file = new File(['data'], 'test.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      await user.upload(input, file);
      await waitFor(() => expect(screen.getByText('test.xlsx')).toBeInTheDocument());
      await user.click(screen.getByText('Previsualizar'));

      await waitFor(() => {
        expect(screen.getByText(/Confirmar 2 asignaciones/)).toBeInTheDocument();
      });
    });

    it('C10. confirmar asignación masiva llama con dryRun=false', async () => {
      mockBulkAssignExamsByECM
        .mockResolvedValueOnce(MOCK_BULK_PREVIEW)  // Preview
        .mockResolvedValueOnce(MOCK_BULK_RESULT);    // Confirm

      const user = await openBulkModal();

      const file = new File(['data'], 'test.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      await user.upload(input, file);
      await waitFor(() => expect(screen.getByText('test.xlsx')).toBeInTheDocument());
      await user.click(screen.getByText('Previsualizar'));

      await waitFor(() => {
        expect(screen.getByText(/Confirmar 2 asignaciones/)).toBeInTheDocument();
      });

      await user.click(screen.getByText(/Confirmar 2 asignaciones/));

      await waitFor(() => {
        expect(mockBulkAssignExamsByECM).toHaveBeenCalledTimes(2);
        // Segunda llamada con dryRun=false
        expect(mockBulkAssignExamsByECM).toHaveBeenLastCalledWith(
          130,
          expect.any(File),
          'ECM-TEST-001',
          undefined,
          false,
        );
      });
    });

    it('C11. paso 3 muestra resultado final', async () => {
      mockBulkAssignExamsByECM
        .mockResolvedValueOnce(MOCK_BULK_PREVIEW)
        .mockResolvedValueOnce(MOCK_BULK_RESULT);

      const user = await openBulkModal();

      const file = new File(['data'], 'test.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      await user.upload(input, file);
      await waitFor(() => expect(screen.getByText('test.xlsx')).toBeInTheDocument());
      await user.click(screen.getByText('Previsualizar'));
      await waitFor(() => expect(screen.getByText(/Confirmar 2 asignaciones/)).toBeInTheDocument());
      await user.click(screen.getByText(/Confirmar 2 asignaciones/));

      await waitFor(() => {
        expect(screen.getByText('Paso 3 de 3')).toBeInTheDocument();
      });

      expect(screen.getAllByText(/2 asignaciones creadas/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Asignados').length).toBeGreaterThanOrEqual(1);
    });

    it('C12. botón Volver en paso 2 regresa a paso 1', async () => {
      const user = await openBulkModal();

      const file = new File(['data'], 'test.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      await user.upload(input, file);
      await waitFor(() => expect(screen.getByText('test.xlsx')).toBeInTheDocument());
      await user.click(screen.getByText('Previsualizar'));
      await waitFor(() => expect(screen.getByText('Paso 2 de 3')).toBeInTheDocument());

      await user.click(screen.getByText('Volver'));

      await waitFor(() => {
        expect(screen.getByText('Paso 1 de 3')).toBeInTheDocument();
      });
    });

    it('C13. cerrar modal en paso 3 muestra botón Cerrar', async () => {
      mockBulkAssignExamsByECM
        .mockResolvedValueOnce(MOCK_BULK_PREVIEW)
        .mockResolvedValueOnce(MOCK_BULK_RESULT);

      const user = await openBulkModal();

      const file = new File(['data'], 'test.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      await user.upload(input, file);
      await waitFor(() => expect(screen.getByText('test.xlsx')).toBeInTheDocument());
      await user.click(screen.getByText('Previsualizar'));
      await waitFor(() => expect(screen.getByText(/Confirmar 2 asignaciones/)).toBeInTheDocument());
      await user.click(screen.getByText(/Confirmar 2 asignaciones/));
      await waitFor(() => expect(screen.getByText('Paso 3 de 3')).toBeInTheDocument());

      expect(screen.getByText('Cerrar')).toBeInTheDocument();
    });

    it('C14. error en preview muestra mensaje', async () => {
      mockBulkAssignExamsByECM.mockRejectedValue({
        response: { data: { error: 'Archivo inválido' } },
      });

      const user = await openBulkModal();

      const file = new File(['data'], 'bad.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      await user.upload(input, file);
      await waitFor(() => expect(screen.getByText('bad.xlsx')).toBeInTheDocument());

      await user.click(screen.getByText('Previsualizar'));

      await waitFor(() => {
        expect(screen.getByText(/Archivo inválido/)).toBeInTheDocument();
      });
    });
  });

  // ─── D. Servicio addAssignmentsToExam ──────────────────────────────

  describe('D. Integración del servicio', () => {
    it('D1. addAssignmentsToExam recibe groupId y examId del URL', async () => {
      renderPage();
      const user = userEvent.setup();
      await waitForPageLoad();

      await user.click(screen.getByText('Asignar'));
      await waitFor(() => expect(screen.getByText('Asignar Candidatos')).toBeInTheDocument());

      await waitFor(() => expect(screen.getByText('Seleccionar todos')).toBeInTheDocument(), { timeout: 3000 });

      const mariaInModal = screen.getAllByText('Maria Apellido').find(el => el.closest('button'));
      await user.click(mariaInModal!.closest('button')!);
      await waitFor(() => expect(screen.getByText(/Asignar 1 candidato\b/)).toBeInTheDocument());
      await user.click(screen.getByText(/Asignar 1 candidato\b/));

      await waitFor(() => {
        expect(mockAddAssignmentsToExam).toHaveBeenCalledWith(
          130,   // groupId from URL
          1249,  // assignmentId from URL
          ['u2'], // Maria's user_id
        );
      });
    });

    it('D2. bulkAssignExamsByECM usa ecm_code del detailData', async () => {
      const user = userEvent.setup();
      renderPage();
      await waitForPageLoad();

      await user.click(screen.getByText('Carga masiva'));
      await waitFor(() => expect(screen.getByText('Carga Masiva de Asignaciones')).toBeInTheDocument());

      const file = new File(['data'], 'test.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      await user.upload(input, file);
      await waitFor(() => expect(screen.getByText('test.xlsx')).toBeInTheDocument());
      await user.click(screen.getByText('Previsualizar'));

      await waitFor(() => {
        expect(mockBulkAssignExamsByECM).toHaveBeenCalledWith(
          130,
          expect.any(File),
          'ECM-TEST-001', // from detailData.ecm_code
          undefined,
          true,
        );
      });
    });

    it('D3. después de cerrar modal con asignaciones creadas, refresca la tabla', async () => {
      renderPage();
      const user = userEvent.setup();
      await waitForPageLoad();

      const initialCallCount = mockGetExamMembersDetail.mock.calls.length;

      await user.click(screen.getByText('Asignar'));
      await waitFor(() => expect(screen.getByText('Asignar Candidatos')).toBeInTheDocument());
      await waitFor(() => expect(screen.getByText('Seleccionar todos')).toBeInTheDocument(), { timeout: 3000 });

      await user.click(screen.getByText('Seleccionar todos'));
      await waitFor(() => expect(screen.getByText(/Asignar 2 candidatos/)).toBeInTheDocument());
      await user.click(screen.getByText(/Asignar 2 candidatos/));

      await waitFor(() => expect(screen.getAllByText(/2 asignación\(es\) creada\(s\)/).length).toBeGreaterThanOrEqual(1));

      // Cerrar el modal (después de resultados exitosos)
      await user.click(screen.getByText('Cerrar'));

      // Debe refrescar datos
      await waitFor(() => {
        expect(mockGetExamMembersDetail.mock.calls.length).toBeGreaterThan(initialCallCount);
      });
    });
  });

  // ─── E. Edge cases ────────────────────────────────────────────────

  describe('E. Edge cases', () => {
    it('E1. sin candidatos sin asignación muestra mensaje vacío', async () => {
      // Todos tienen assignment_number
      mockGetExamMembersDetail.mockResolvedValue({
        ...MOCK_DETAIL_RESPONSE,
        members: [MEMBER_WITH_ASSIGNMENT, MEMBER_LOCKED],
      });

      renderPage();
      const user = userEvent.setup();
      await waitForPageLoad();

      await user.click(screen.getByText('Asignar'));
      await waitFor(() => expect(screen.getByText('Asignar Candidatos')).toBeInTheDocument());

      await waitFor(() => {
        expect(screen.getByText(/No hay miembros sin asignación/)).toBeInTheDocument();
      });
    });

    it('E2. carga masiva con 0 asignaciones posibles deshabilita confirmar', async () => {
      mockBulkAssignExamsByECM.mockResolvedValue({
        message: 'Sin asignaciones',
        results: { processed: 1, assigned: [], skipped: [], errors: [{ row: 2, identifier: 'bad', error: 'No encontrado' }] },
        summary: { total_processed: 1, assigned: 0, skipped: 0, errors: 1 },
      });

      const user = userEvent.setup();
      renderPage();
      await waitForPageLoad();

      await user.click(screen.getByText('Carga masiva'));
      await waitFor(() => expect(screen.getByText('Carga Masiva de Asignaciones')).toBeInTheDocument());

      const file = new File(['data'], 'test.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      await user.upload(input, file);
      await waitFor(() => expect(screen.getByText('test.xlsx')).toBeInTheDocument());
      await user.click(screen.getByText('Previsualizar'));

      await waitFor(() => {
        expect(screen.getByText('Paso 2 de 3')).toBeInTheDocument();
      });

      const confirmBtn = screen.getByText(/Confirmar 0 asignaciones/);
      expect(confirmBtn.closest('button')).toBeDisabled();
    });
  });
});
