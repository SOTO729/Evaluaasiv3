/**
 * Tests para MiSaldoResponsablePage (Vouchers del Responsable)
 * 
 * Cubre:
 *  - Renderizado del estado de carga
 *  - Renderizado con datos exitosos (hero, stats cards, links)
 *  - Renderizado del estado de error con botón reintentar
 *  - Vocabulario: usa "vouchers" no "certificados" ni "saldo"
 *  - Cálculo del porcentaje de uso
 *  - Botón de actualizar
 * 
 * Ejecutar:
 *   cd frontend && npx vitest run src/__tests__/MiSaldoResponsablePage.test.tsx
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MiSaldoResponsablePage from '../pages/responsable/MiSaldoResponsablePage';

// ─── Mocks ──────────────────────────────────────────────────────────────

const mockBalanceData = {
  campus: { id: 1, name: 'Campus Test', certification_cost: 500 },
  totals_money: {
    current_balance: 5000,
    total_received: 10000,
    total_spent: 4000,
    total_scholarships: 1000,
  },
  totals_units: {
    current_balance: 10,
    total_received: 20,
    total_spent: 8,
    total_scholarships: 2,
  },
  coordinators_count: 3,
};

const mockGetMyCampusBalance = vi.fn();

vi.mock('../services/balanceService', () => ({
  getMyCampusBalance: (...args: unknown[]) => mockGetMyCampusBalance(...args),
  // Re-export the type for TS
  MyCampusBalanceResponse: undefined,
}));

// Mock lucide-react icons as simple spans
vi.mock('lucide-react', () => ({
  Wallet: (props: Record<string, unknown>) => <span data-testid="icon-wallet" {...props} />,
  TrendingUp: (props: Record<string, unknown>) => <span data-testid="icon-trending-up" {...props} />,
  TrendingDown: (props: Record<string, unknown>) => <span data-testid="icon-trending-down" {...props} />,
  AlertCircle: (props: Record<string, unknown>) => <span data-testid="icon-alert" {...props} />,
  RefreshCw: (props: Record<string, unknown>) => <span data-testid="icon-refresh" {...props} />,
  Award: (props: Record<string, unknown>) => <span data-testid="icon-award" {...props} />,
  Gift: (props: Record<string, unknown>) => <span data-testid="icon-gift" {...props} />,
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <MiSaldoResponsablePage />
    </MemoryRouter>
  );
}

// ─── Tests ──────────────────────────────────────────────────────────────

describe('MiSaldoResponsablePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Estado de carga ──
  it('muestra spinner mientras carga', () => {
    mockGetMyCampusBalance.mockReturnValue(new Promise(() => {})); // never resolves
    renderPage();
    // LoadingSpinner renderiza un div con spinner
    expect(document.querySelector('.animate-spin')).toBeTruthy();
  });

  // ── Datos exitosos ──
  describe('con datos exitosos', () => {
    beforeEach(() => {
      mockGetMyCampusBalance.mockResolvedValue(mockBalanceData);
    });

    it('muestra el título "Mis Vouchers"', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Mis Vouchers')).toBeTruthy();
      });
    });

    it('muestra el nombre del campus', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/Campus Test/)).toBeTruthy();
      });
    });

    it('muestra "Vouchers Disponibles" (no "Certificados" ni "Saldo")', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Vouchers Disponibles')).toBeTruthy();
      });
      // Verificar que NO usa vocabulario antiguo
      expect(screen.queryByText(/Certificados Disponibles/i)).toBeNull();
      expect(screen.queryByText(/Saldo Disponible/i)).toBeNull();
    });

    it('muestra el balance actual en unidades (10)', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('10')).toBeTruthy();
      });
    });

    it('muestra la palabra "vouchers" debajo del balance', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('vouchers')).toBeTruthy();
      });
    });

    it('muestra las 4 tarjetas de stats', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Recibidas')).toBeTruthy();
        expect(screen.getByText('Becas')).toBeTruthy();
        expect(screen.getByText('Consumidas')).toBeTruthy();
        expect(screen.getByText('Total Acreditado')).toBeTruthy();
      });
    });

    it('calcula vouchers comprados = recibidas - becas', async () => {
      renderPage();
      await waitFor(() => {
        // total_received - total_scholarships = 20 - 2 = 18
        expect(screen.getByText('18')).toBeTruthy();
      });
    });

    it('muestra vouchers de beca correctamente', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('2')).toBeTruthy(); // total_scholarships
      });
    });

    it('muestra vouchers consumidos', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('8')).toBeTruthy(); // total_spent
      });
    });

    it('muestra total acreditado', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('20')).toBeTruthy(); // total_received
      });
    });

    it('muestra el porcentaje de uso correctamente', async () => {
      renderPage();
      // 8/20 = 40%
      await waitFor(() => {
        expect(screen.getByText('40% consumido')).toBeTruthy();
      });
    });

    it('tiene botón de Actualizar', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Actualizar')).toBeTruthy();
      });
    });

    it('tiene links de navegación: Solicitar Vouchers y Mi Plantel', async () => {
      renderPage();
      await waitFor(() => {
        const solicitarLinks = screen.getAllByText('Solicitar Vouchers');
        expect(solicitarLinks.length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('Mi Plantel')).toBeTruthy();
      });
    });

    it('los textos de stats mencionan "vouchers" no "certificados"', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('vouchers comprados')).toBeTruthy();
        expect(screen.getByText('vouchers de beca')).toBeTruthy();
        expect(screen.getByText('vouchers utilizados')).toBeTruthy();
        expect(screen.getByText('vouchers en total')).toBeTruthy();
      });
    });

    it('el botón Actualizar llama a getMyCampusBalance de nuevo', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Actualizar')).toBeTruthy();
      });
      fireEvent.click(screen.getByText('Actualizar'));
      expect(mockGetMyCampusBalance).toHaveBeenCalledTimes(2); // initial + refresh
    });
  });

  // ── Estado de error ──
  describe('con error', () => {
    beforeEach(() => {
      mockGetMyCampusBalance.mockRejectedValue({
        response: { data: { error: 'No se encontró un plantel asignado' } },
      });
    });

    it('muestra el mensaje de error', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('No se encontró un plantel asignado')).toBeTruthy();
      });
    });

    it('muestra botón de Reintentar', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Reintentar')).toBeTruthy();
      });
    });

    it('reintentar llama a getMyCampusBalance de nuevo', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Reintentar')).toBeTruthy();
      });
      fireEvent.click(screen.getByText('Reintentar'));
      expect(mockGetMyCampusBalance).toHaveBeenCalledTimes(2);
    });
  });

  // ── Edge cases ──
  describe('edge cases', () => {
    it('balance 0: muestra 0 vouchers sin error', async () => {
      mockGetMyCampusBalance.mockResolvedValue({
        ...mockBalanceData,
        totals_units: {
          current_balance: 0,
          total_received: 0,
          total_spent: 0,
          total_scholarships: 0,
        },
      });
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Vouchers Disponibles')).toBeTruthy();
      });
    });

    it('error genérico sin response.data', async () => {
      mockGetMyCampusBalance.mockRejectedValue(new Error('Network Error'));
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Error al cargar los vouchers')).toBeTruthy();
      });
    });
  });
});
