/**
 * Tests para VerifyEmailPage y flujo de verificación de correo
 *
 * Ejecutar:
 *   cd frontend && npx vitest run src/__tests__/VerifyEmailPage.test.tsx
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// ─── Mocks ──────────────────────────────────────────────────────────────

const mockVerifyEmail = vi.fn()
const mockResendVerification = vi.fn()

vi.mock('../services/authService', () => ({
  authService: {
    verifyEmail: (...args: unknown[]) => mockVerifyEmail(...args),
    resendVerification: (...args: unknown[]) => mockResendVerification(...args),
  },
}))

// ─── Helpers ────────────────────────────────────────────────────────────

function renderPage(initialPath = '/verify-email?token=test-token-123') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

// Lazy import after mock setup
let VerifyEmailPage: React.ComponentType

beforeEach(async () => {
  vi.clearAllMocks()
  const mod = await import('../pages/auth/VerifyEmailPage')
  VerifyEmailPage = mod.default
})

// ═══════════════════════════════════════════════════════════════════════════
// PARTE A — Rendering & Loading
// ═══════════════════════════════════════════════════════════════════════════

describe('VerifyEmailPage — Rendering', () => {
  it('shows loading spinner while verifying', () => {
    // Make verifyEmail hang (never resolve) to see the loading state
    mockVerifyEmail.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByText(/verificando tu correo/i)).toBeInTheDocument()
  })

  it('shows header with "Verificación de Correo"', () => {
    mockVerifyEmail.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByText(/verificación de correo/i)).toBeInTheDocument()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// PARTE B — Success State
// ═══════════════════════════════════════════════════════════════════════════

describe('VerifyEmailPage — Success', () => {
  it('shows success message when verification succeeds', async () => {
    mockVerifyEmail.mockResolvedValue({
      message: 'Tu correo electrónico ha sido verificado exitosamente.',
    })
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/¡correo verificado!/i)).toBeInTheDocument()
    })
  })

  it('shows "Iniciar Sesión" link on success', async () => {
    mockVerifyEmail.mockResolvedValue({
      message: 'Verificado correctamente.',
    })
    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('link', { name: /iniciar sesión/i })).toBeInTheDocument()
    })
  })

  it('link points to /login', async () => {
    mockVerifyEmail.mockResolvedValue({ message: 'OK' })
    renderPage()
    await waitFor(() => {
      const link = screen.getByRole('link', { name: /iniciar sesión/i })
      expect(link).toHaveAttribute('href', '/login')
    })
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// PARTE C — Already Verified State
// ═══════════════════════════════════════════════════════════════════════════

describe('VerifyEmailPage — Already Verified', () => {
  it('shows "ya verificado" message', async () => {
    mockVerifyEmail.mockResolvedValue({
      message: 'Tu correo electrónico ya fue verificado anteriormente.',
      already_verified: true,
    })
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/correo ya verificado/i)).toBeInTheDocument()
    })
  })

  it('shows "Iniciar Sesión" link when already verified', async () => {
    mockVerifyEmail.mockResolvedValue({
      message: 'Ya verificado.',
      already_verified: true,
    })
    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('link', { name: /iniciar sesión/i })).toBeInTheDocument()
    })
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// PARTE D — Error State
// ═══════════════════════════════════════════════════════════════════════════

describe('VerifyEmailPage — Error', () => {
  it('shows error message on API failure', async () => {
    mockVerifyEmail.mockRejectedValue({
      response: { data: { error: 'El enlace de verificación ha expirado.' } },
    })
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/error de verificación/i)).toBeInTheDocument()
    })
  })

  it('shows API error text', async () => {
    mockVerifyEmail.mockRejectedValue({
      response: { data: { error: 'El enlace de verificación ha expirado.' } },
    })
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/el enlace de verificación ha expirado/i)).toBeInTheDocument()
    })
  })

  it('shows resend form on error', async () => {
    mockVerifyEmail.mockRejectedValue({
      response: { data: { error: 'Token inválido' } },
    })
    renderPage()
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/tu correo electrónico/i)).toBeInTheDocument()
    })
  })

  it('shows error when no token in URL', async () => {
    mockVerifyEmail.mockRejectedValue({})
    renderPage('/verify-email')
    await waitFor(() => {
      expect(screen.getByText(/error de verificación/i)).toBeInTheDocument()
    })
  })

  it('shows default error for unknown failures', async () => {
    mockVerifyEmail.mockRejectedValue(new Error('Network error'))
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/error de verificación/i)).toBeInTheDocument()
    })
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// PARTE E — Resend Verification
// ═══════════════════════════════════════════════════════════════════════════

describe('VerifyEmailPage — Resend', () => {
  beforeEach(async () => {
    mockVerifyEmail.mockRejectedValue({
      response: { data: { error: 'Token expirado' } },
    })
  })

  it('disables resend button when email is empty', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/reenviar/i)).toBeInTheDocument()
    })
    const btn = screen.getByRole('button', { name: /reenviar/i })
    expect(btn).toBeDisabled()
  })

  it('enables resend button when email is typed', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/tu correo electrónico/i)).toBeInTheDocument()
    })
    const input = screen.getByPlaceholderText(/tu correo electrónico/i)
    fireEvent.change(input, { target: { value: 'test@example.com' } })
    const btn = screen.getByRole('button', { name: /reenviar/i })
    expect(btn).not.toBeDisabled()
  })

  it('calls resendVerification with entered email', async () => {
    mockResendVerification.mockResolvedValue({
      message: 'Si el correo está registrado, recibirás un nuevo enlace.',
    })
    renderPage()
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/tu correo electrónico/i)).toBeInTheDocument()
    })

    const input = screen.getByPlaceholderText(/tu correo electrónico/i)
    fireEvent.change(input, { target: { value: 'user@test.com' } })

    const btn = screen.getByRole('button', { name: /reenviar/i })
    fireEvent.click(btn)

    await waitFor(() => {
      expect(mockResendVerification).toHaveBeenCalledWith('user@test.com')
    })
  })

  it('shows resend success message', async () => {
    mockResendVerification.mockResolvedValue({
      message: 'Si el correo está registrado, recibirás un nuevo enlace.',
    })
    renderPage()
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/tu correo electrónico/i)).toBeInTheDocument()
    })

    const input = screen.getByPlaceholderText(/tu correo electrónico/i)
    fireEvent.change(input, { target: { value: 'user@test.com' } })
    fireEvent.click(screen.getByRole('button', { name: /reenviar/i }))

    await waitFor(() => {
      expect(screen.getByText(/si el correo está registrado/i)).toBeInTheDocument()
    })
  })

  it('shows back to login link on error state', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/volver al inicio de sesión/i)).toBeInTheDocument()
    })
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// PARTE F — Token passing
// ═══════════════════════════════════════════════════════════════════════════

describe('VerifyEmailPage — Token', () => {
  it('passes token from URL to verifyEmail', async () => {
    mockVerifyEmail.mockResolvedValue({ message: 'OK' })
    renderPage('/verify-email?token=abc123.xyz')
    await waitFor(() => {
      expect(mockVerifyEmail).toHaveBeenCalledWith('abc123.xyz')
    })
  })

  it('does not call verifyEmail when token is missing', async () => {
    renderPage('/verify-email')
    await waitFor(() => {
      expect(screen.getByText(/error de verificación/i)).toBeInTheDocument()
    })
    expect(mockVerifyEmail).not.toHaveBeenCalled()
  })
})
