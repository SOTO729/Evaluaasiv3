/**
 * Tests de BrandingConfigPage — Personalización del portal del responsable
 *
 * Cubre:
 *   A. Renderizado inicial y carga de datos
 *   B. Selector de colores y paletas predefinidas
 *   C. Guardado de colores (mutation)
 *   D. Upload y eliminación de logo
 *   E. Vista previa en vivo
 *   F. Validaciones y edge cases
 *
 * Ejecutar:
 *   cd frontend && npx vitest run src/pages/responsable/BrandingConfigPage.test.tsx
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ─── Mocks ─────────────────────────────────────────────────────────────────

const mockGetMiPlantel = vi.fn();
const mockUpdateMiPlantelBranding = vi.fn();
const mockUploadMiPlantelLogo = vi.fn();
const mockDeleteMiPlantelLogo = vi.fn();

vi.mock('../../services/partnersService', () => ({
  getMiPlantel: (...args: unknown[]) => mockGetMiPlantel(...args),
  updateMiPlantelBranding: (...args: unknown[]) => mockUpdateMiPlantelBranding(...args),
  uploadMiPlantelLogo: (...args: unknown[]) => mockUploadMiPlantelLogo(...args),
  deleteMiPlantelLogo: (...args: unknown[]) => mockDeleteMiPlantelLogo(...args),
}));

const mockUseAuthStore = vi.fn();
vi.mock('../../store/authStore', () => ({
  useAuthStore: () => mockUseAuthStore(),
}));

vi.mock('../../components/LoadingSpinner', () => ({
  default: () => <div data-testid="loading-spinner">Cargando...</div>,
}));

// ─── Datos de prueba ───────────────────────────────────────────────────────

const RESPONSABLE_USER = {
  id: 'resp-1',
  email: 'resp@test.com',
  username: 'responsable1',
  name: 'Responsable',
  first_surname: 'Test',
  full_name: 'Responsable Test',
  role: 'responsable' as const,
  is_active: true,
  is_verified: true,
  created_at: '2024-01-01',
};

const MOCK_PLANTEL_DATA = {
  campus: {
    id: 10,
    name: 'Campus Monterrey',
    logo_url: null as string | null,
    primary_color: null as string | null,
    secondary_color: null as string | null,
    state: 'Nuevo León',
    city: 'Monterrey',
    partner_id: 1,
    responsable_id: 'resp-1',
    is_active: true,
  },
  group_count: 3,
  members_count: 50,
};

const MOCK_PLANTEL_WITH_BRANDING = {
  campus: {
    ...MOCK_PLANTEL_DATA.campus,
    logo_url: 'https://storage.example.com/campus-logos/10/logo.png',
    primary_color: '#e11d48',
    secondary_color: '#be123c',
  },
  group_count: 3,
  members_count: 50,
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// A. RENDERIZADO INICIAL Y CARGA
// ═══════════════════════════════════════════════════════════════════════════

describe('BrandingConfigPage', () => {
  let BrandingConfigPage: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockUseAuthStore.mockReturnValue({ user: RESPONSABLE_USER });
    mockGetMiPlantel.mockResolvedValue(MOCK_PLANTEL_DATA);
    mockUpdateMiPlantelBranding.mockResolvedValue({
      message: 'Branding actualizado exitosamente',
      campus: { ...MOCK_PLANTEL_DATA.campus, primary_color: '#e11d48', secondary_color: '#be123c' },
    });
    mockUploadMiPlantelLogo.mockResolvedValue({
      message: 'Logo actualizado exitosamente',
      logo_url: 'https://storage.example.com/campus-logos/10/new-logo.png',
      campus: { ...MOCK_PLANTEL_DATA.campus, logo_url: 'https://storage.example.com/campus-logos/10/new-logo.png' },
    });
    mockDeleteMiPlantelLogo.mockResolvedValue({
      message: 'Logo eliminado exitosamente',
      campus: { ...MOCK_PLANTEL_DATA.campus, logo_url: null },
    });

    const mod = await import('./BrandingConfigPage');
    BrandingConfigPage = mod.default;
  });

  function renderPage(plantelData = MOCK_PLANTEL_DATA) {
    mockGetMiPlantel.mockResolvedValue(plantelData);
    const queryClient = createQueryClient();
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/mi-plantel/branding']}>
          <Routes>
            <Route path="/mi-plantel/branding" element={<BrandingConfigPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  }

  // ─── A. Renderizado inicial ──────────────────────────────────────────

  it('A1. muestra spinner mientras carga', () => {
    mockGetMiPlantel.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('A2. muestra el título "Personalizar Portal"', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Personalizar Portal')).toBeInTheDocument();
    });
  });

  it('A3. muestra el nombre del campus', async () => {
    renderPage();
    await waitFor(() => {
      const campusNames = screen.getAllByText('Campus Monterrey');
      expect(campusNames.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('A4. muestra sección de Logo del Plantel', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Logo del Plantel')).toBeInTheDocument();
    });
  });

  it('A5. muestra sección de Colores del Portal', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Colores del Portal')).toBeInTheDocument();
    });
  });

  it('A6. muestra sección de Paletas predefinidas', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Paletas predefinidas')).toBeInTheDocument();
    });
  });

  it('A7. muestra sección de Vista previa', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Vista previa')).toBeInTheDocument();
    });
  });

  it('A8. muestra "Sin logo configurado" cuando no hay logo', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Sin logo configurado')).toBeInTheDocument();
    });
  });

  it('A9. llama getMiPlantel al cargar', async () => {
    renderPage();
    await waitFor(() => {
      expect(mockGetMiPlantel).toHaveBeenCalledTimes(1);
    });
  });

  // ─── B. Colores y paletas predefinidas ───────────────────────────────

  it('B1. muestra color pickers primario y secundario', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Color primario')).toBeInTheDocument();
      expect(screen.getByText('Color secundario')).toBeInTheDocument();
    });
  });

  it('B2. muestra las 12 paletas predefinidas', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Azul (predeterminado)')).toBeInTheDocument();
      expect(screen.getByText('Índigo')).toBeInTheDocument();
      expect(screen.getByText('Violeta')).toBeInTheDocument();
      expect(screen.getByText('Verde')).toBeInTheDocument();
      expect(screen.getByText('Esmeralda')).toBeInTheDocument();
      expect(screen.getByText('Rojo')).toBeInTheDocument();
      expect(screen.getByText('Naranja')).toBeInTheDocument();
      expect(screen.getByText('Ámbar')).toBeInTheDocument();
      expect(screen.getByText('Rosa')).toBeInTheDocument();
      expect(screen.getByText('Cian')).toBeInTheDocument();
      expect(screen.getByText('Gris')).toBeInTheDocument();
      expect(screen.getByText('Slate')).toBeInTheDocument();
    });
  });

  it('B3. seleccionar paleta Rojo actualiza los inputs de color', async () => {
    renderPage();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('Rojo')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Rojo'));

    // Los inputs de texto deben mostrar los colores de la paleta Rojo
    const textInputs = screen.getAllByRole('textbox');
    const hexInputs = textInputs.filter((input) =>
      (input as HTMLInputElement).value.startsWith('#')
    );
    expect(hexInputs.length).toBeGreaterThanOrEqual(2);
    expect((hexInputs[0] as HTMLInputElement).value).toBe('#ef4444');
    expect((hexInputs[1] as HTMLInputElement).value).toBe('#dc2626');
  });

  it('B4. botón "Guardar colores" aparece deshabilitado sin cambios', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Guardar colores')).toBeInTheDocument();
    });
    // Sin cambios respecto al default, debería estar deshabilitado
    const saveBtn = screen.getByText('Guardar colores').closest('button');
    expect(saveBtn).toBeDisabled();
  });

  it('B5. botón "Restaurar" está disponible', async () => {
    renderPage();
    await waitFor(() => {
      const resetBtn = screen.getByTitle('Restaurar colores predeterminados');
      expect(resetBtn).toBeInTheDocument();
      expect(resetBtn).not.toBeDisabled();
    });
  });

  it('B6. seleccionar paleta habilita botón "Guardar colores"', async () => {
    renderPage();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('Verde')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Verde'));

    const saveBtn = screen.getByText('Guardar colores').closest('button');
    expect(saveBtn).not.toBeDisabled();
  });

  it('B7. restaurar colores devuelve al default azul', async () => {
    renderPage();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('Rojo')).toBeInTheDocument();
    });

    // Change to Rojo
    await user.click(screen.getByText('Rojo'));

    // Now restore
    await user.click(screen.getByTitle('Restaurar colores predeterminados'));

    const textInputs = screen.getAllByRole('textbox');
    const hexInputs = textInputs.filter((input) =>
      (input as HTMLInputElement).value.startsWith('#')
    );
    expect((hexInputs[0] as HTMLInputElement).value).toBe('#3b82f6');
    expect((hexInputs[1] as HTMLInputElement).value).toBe('#2563eb');
  });

  // ─── C. Guardar colores (mutation) ───────────────────────────────────

  it('C1. guardar colores llama updateMiPlantelBranding', async () => {
    renderPage();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('Rojo')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Rojo'));

    const saveBtn = screen.getByText('Guardar colores').closest('button')!;
    await user.click(saveBtn);

    await waitFor(() => {
      expect(mockUpdateMiPlantelBranding).toHaveBeenCalledWith(
        { primary_color: '#ef4444', secondary_color: '#dc2626' },
        expect.anything(),
      );
    });
  });

  it('C2. muestra mensaje de éxito tras guardar', async () => {
    renderPage();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('Verde')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Verde'));
    const saveBtn = screen.getByText('Guardar colores').closest('button')!;
    await user.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText('Branding actualizado exitosamente')).toBeInTheDocument();
    });
  });

  it('C3. muestra mensaje de error si falla el guardado', async () => {
    mockUpdateMiPlantelBranding.mockRejectedValue({
      response: { data: { error: 'Color primario inválido. Formato: #RRGGBB' } },
    });

    renderPage();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('Rojo')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Rojo'));
    const saveBtn = screen.getByText('Guardar colores').closest('button')!;
    await user.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText('Color primario inválido. Formato: #RRGGBB')).toBeInTheDocument();
    });
  });

  // ─── D. Upload y eliminación de logo ─────────────────────────────────

  it('D1. muestra botón "Subir logo"', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Subir logo')).toBeInTheDocument();
    });
  });

  it('D2. no muestra botón "Eliminar" cuando no hay logo', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Subir logo')).toBeInTheDocument();
    });
    expect(screen.queryByText('Eliminar')).not.toBeInTheDocument();
  });

  it('D3. muestra botón "Eliminar" cuando hay logo', async () => {
    renderPage(MOCK_PLANTEL_WITH_BRANDING);
    await waitFor(() => {
      expect(screen.getByText('Eliminar')).toBeInTheDocument();
    });
  });

  it('D4. muestra imagen del logo cuando existe', async () => {
    renderPage(MOCK_PLANTEL_WITH_BRANDING);
    await waitFor(() => {
      const img = screen.getByAltText('Logo del plantel');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', 'https://storage.example.com/campus-logos/10/logo.png');
    });
  });

  it('D5. subir archivo llama uploadMiPlantelLogo', async () => {
    renderPage();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('Subir logo')).toBeInTheDocument();
    });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();

    const file = new File(['fake-image-content'], 'logo.png', { type: 'image/png' });
    await user.upload(fileInput, file);

    await waitFor(() => {
      expect(mockUploadMiPlantelLogo).toHaveBeenCalledWith(
        file,
        expect.anything(),
      );
    });
  });

  it('D6. eliminar logo llama deleteMiPlantelLogo', async () => {
    renderPage(MOCK_PLANTEL_WITH_BRANDING);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('Eliminar')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Eliminar'));

    await waitFor(() => {
      expect(mockDeleteMiPlantelLogo).toHaveBeenCalledTimes(1);
    });
  });

  it('D7. muestra mensaje de éxito tras subir logo', async () => {
    renderPage();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('Subir logo')).toBeInTheDocument();
    });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['image'], 'logo.png', { type: 'image/png' });
    await user.upload(fileInput, file);

    await waitFor(() => {
      expect(screen.getByText('Logo actualizado exitosamente')).toBeInTheDocument();
    });
  });

  // ─── E. Vista previa ────────────────────────────────────────────────

  it('E1. muestra "Mi Plantel" en la barra de preview', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Mi Plantel')).toBeInTheDocument();
    });
  });

  it('E2. muestra nombre del campus en preview', async () => {
    renderPage();
    await waitFor(() => {
      const campusNames = screen.getAllByText('Campus Monterrey');
      expect(campusNames.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('E3. muestra botones de Acción primaria y Secundaria en preview', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Acción primaria')).toBeInTheDocument();
      expect(screen.getByText('Secundaria')).toBeInTheDocument();
    });
  });

  it('E4. muestra estadísticas en preview', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('95%')).toBeInTheDocument();
      expect(screen.getByText('aprobación')).toBeInTheDocument();
    });
  });

  it('E5. muestra tabs Grupos y Reportes en preview', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Grupos')).toBeInTheDocument();
      expect(screen.getByText('Reportes')).toBeInTheDocument();
    });
  });

  // ─── F. Estados con branding existente ───────────────────────────────

  it('F1. carga colores existentes del campus', async () => {
    renderPage(MOCK_PLANTEL_WITH_BRANDING);
    await waitFor(() => {
      const textInputs = screen.getAllByRole('textbox');
      const hexInputs = textInputs.filter((input) =>
        (input as HTMLInputElement).value.startsWith('#')
      );
      expect((hexInputs[0] as HTMLInputElement).value).toBe('#e11d48');
      expect((hexInputs[1] as HTMLInputElement).value).toBe('#be123c');
    });
  });

  it('F2. acepta formato de archivo correcto', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Subir logo')).toBeInTheDocument();
    });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput.accept).toContain('image/png');
    expect(fileInput.accept).toContain('image/jpeg');
    expect(fileInput.accept).toContain('image/webp');
    expect(fileInput.accept).toContain('image/svg+xml');
  });

  it('F3. muestra descripción de formatos permitidos', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/PNG, JPG, WebP, SVG/i)).toBeInTheDocument();
    });
  });

  it('F4. muestra límite de 2MB', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/M[aá]x\.?\s*2\s*MB/i)).toBeInTheDocument();
    });
  });

  it('F5. descripción de colores presente', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Se aplicarán en botones, enlaces y elementos destacados/i)).toBeInTheDocument();
    });
  });

  it('F6. muestra "Paleta generada"', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Paleta generada')).toBeInTheDocument();
    });
  });

  it('F7. guardar con paleta default envía null', async () => {
    // Si los colores son el default, se envía null
    renderPage(MOCK_PLANTEL_WITH_BRANDING);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByTitle('Restaurar colores predeterminados')).toBeInTheDocument();
    });

    // Restaurar al default
    await user.click(screen.getByTitle('Restaurar colores predeterminados'));

    const saveBtn = screen.getByText('Guardar colores').closest('button')!;
    await user.click(saveBtn);

    await waitFor(() => {
      expect(mockUpdateMiPlantelBranding).toHaveBeenCalledWith(
        { primary_color: null, secondary_color: null },
        expect.anything(),
      );
    });
  });
});
