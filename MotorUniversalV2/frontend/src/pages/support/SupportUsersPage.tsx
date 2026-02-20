import { useState } from 'react'
import { Mail, Search, SendHorizonal } from 'lucide-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { listSupportUsers, sendSupportUserEmail } from '../../services/supportService'

type EmailTemplate = 'nuevo' | 'registro' | 'reenvio' | 'confirmacion'

const SupportUsersPage = () => {
  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [mailTarget, setMailTarget] = useState('')
  const [emailTemplate, setEmailTemplate] = useState<EmailTemplate>('nuevo')
  const [mailMessage, setMailMessage] = useState<string | null>(null)
  const [mailError, setMailError] = useState<string | null>(null)

  const {
    data: searchResults,
    isLoading: isSearchingUsers,
    isError: isSearchError,
    error: searchError,
    isFetching: isFetchingUsers,
  } = useQuery({
    queryKey: ['support', 'directory-users', appliedSearch],
    queryFn: () =>
      listSupportUsers({
        search: appliedSearch,
        role: '',
        page: 1,
        per_page: 20,
      }),
    enabled: appliedSearch.length >= 3,
  })

  const users = searchResults?.users || []

  const sendEmailMutation = useMutation({
    mutationFn: sendSupportUserEmail,
    onSuccess: (response) => {
      setMailError(null)
      setMailMessage(
        response?.message
          ? `${response.message} (${response.recipient_email})`
          : 'Correo enviado correctamente',
      )
    },
    onError: (err: any) => {
      const backendError = err?.response?.data?.error || err?.response?.data?.message
      setMailMessage(null)
      setMailError(backendError || 'No se pudo enviar el correo')
    },
  })

  const handleSearch = () => {
    const target = searchInput.trim()
    setMailMessage(null)
    setMailError(null)

    if (target.length < 3) {
      setAppliedSearch('')
      setMailError('Escribe al menos 3 caracteres para buscar')
      return
    }

    setAppliedSearch(target)
  }

  const handleSendEmail = () => {
    const target = mailTarget.trim()
    setMailMessage(null)
    setMailError(null)

    if (!target) {
      setMailError('Selecciona o captura un correo/usuario')
      return
    }

    sendEmailMutation.mutate({
      target,
      template: emailTemplate,
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Usuarios</p>
        <h2 className="text-2xl font-semibold text-gray-900">Administración de usuarios</h2>
        <p className="text-sm text-gray-600 max-w-2xl">
          Búsqueda rápida para gestionar cuentas y accesos.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="grid gap-4 md:grid-cols-[1fr_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  handleSearch()
                }
              }}
              placeholder="Usuario, nombre, curp o email"
              className="w-full rounded-xl border border-gray-200 py-2 pl-9 pr-3 text-sm"
            />
          </div>
          <button
            onClick={handleSearch}
            className="rounded-xl bg-primary-600 px-5 py-2 text-sm font-semibold text-white"
          >
            {isFetchingUsers ? 'Buscando...' : 'Buscar'}
          </button>
        </div>

        <div className="rounded-xl border border-gray-200 bg-gray-50/40 px-4 py-3 text-xs text-gray-500">
          Para alto volumen, no se lista todo. Busca y selecciona el usuario correcto para cargar el destinatario.
        </div>

        {isSearchingUsers && (
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
            Buscando usuarios...
          </div>
        )}

        {isSearchError && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            No se pudo buscar usuarios
            {searchError instanceof Error ? `: ${searchError.message}` : ''}
          </div>
        )}

        {!isSearchingUsers && !isSearchError && appliedSearch.length >= 3 && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">
              {searchResults?.total || 0} resultado(s) para "{appliedSearch}".
            </p>
            {users.length === 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                No se encontraron usuarios para esa búsqueda.
              </div>
            ) : (
              <div className="space-y-2">
                {users.map((user) => (
                  <div
                    key={user.id}
                    className="rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-700 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{user.full_name || user.username}</p>
                      <p className="text-xs text-gray-500">
                        @{user.username}
                        {user.email ? ` · ${user.email}` : ''}
                        {user.curp ? ` · CURP: ${user.curp}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setMailTarget(user.email || user.username)
                        setMailMessage('Destinatario seleccionado')
                        setMailError(null)
                      }}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 self-start sm:self-auto"
                    >
                      Seleccionar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <Mail className="h-5 w-5 text-primary-600" />
          <h3 className="text-sm font-semibold text-gray-900">Enviar correo</h3>
        </div>
        <div className="mt-4 space-y-4">
          <input
            value={mailTarget}
            onChange={(event) => setMailTarget(event.target.value)}
            placeholder="Nombre de usuario o correo"
            className="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm"
          />
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'nuevo', label: 'Nuevo' },
              { key: 'registro', label: 'Registro' },
              { key: 'reenvio', label: 'Reenvío' },
              { key: 'confirmacion', label: 'Confirmación' },
            ].map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setEmailTemplate(option.key as EmailTemplate)}
                className={`rounded-lg border px-4 py-2 text-xs font-semibold hover:bg-gray-50 ${
                  emailTemplate === option.key
                    ? 'border-primary-200 bg-primary-50 text-primary-700'
                    : 'border-gray-200 text-gray-600'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          {mailMessage && (
            <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              {mailMessage}
            </p>
          )}
          {mailError && (
            <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              {mailError}
            </p>
          )}
          <button
            type="button"
            onClick={handleSendEmail}
            disabled={sendEmailMutation.isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            <SendHorizonal className="h-4 w-4" />
            {sendEmailMutation.isPending ? 'Enviando...' : 'Enviar correo'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default SupportUsersPage
