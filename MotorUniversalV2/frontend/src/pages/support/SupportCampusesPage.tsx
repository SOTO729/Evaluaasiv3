import { FormEvent, useEffect, useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSupportCampuses } from '../../hooks/support/useSupportCampuses'
import { createSupportCampus, listSupportPartners } from '../../services/supportService'

const MEXICAN_STATES = [
  'Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche', 'Chiapas', 'Chihuahua',
  'Ciudad de México', 'Coahuila', 'Colima', 'Durango', 'Estado de México', 'Guanajuato', 'Guerrero',
  'Hidalgo', 'Jalisco', 'Michoacán', 'Morelos', 'Nayarit', 'Nuevo León', 'Oaxaca', 'Puebla',
  'Querétaro', 'Quintana Roo', 'San Luis Potosí', 'Sinaloa', 'Sonora', 'Tabasco', 'Tamaulipas',
  'Tlaxcala', 'Veracruz', 'Yucatán', 'Zacatecas',
]

const SupportCampusesPage = () => {
  const { data, isLoading, isError, error } = useSupportCampuses({ activeOnly: 'all' })
  const { data: partners = [] } = useQuery({
    queryKey: ['support', 'partners'],
    queryFn: () => listSupportPartners(),
  })
  const queryClient = useQueryClient()
  const [expandedState, setExpandedState] = useState<string | null>(null)
  const [submitMessage, setSubmitMessage] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [form, setForm] = useState({
    partner_id: '',
    name: '',
    state_name: '',
    city: '',
    contact_name: '',
    email: '',
    phone: '',
  })

  const stateGroups = useMemo(() => data?.states || [], [data])
  const stateOptions = useMemo(() => {
    const fromApi = stateGroups.map((stateGroup) => stateGroup.state_name)
    return Array.from(new Set([...MEXICAN_STATES, ...fromApi])).sort((a, b) => a.localeCompare(b))
  }, [stateGroups])

  const createCampusMutation = useMutation({
    mutationFn: createSupportCampus,
    onSuccess: (response) => {
      setSubmitError(null)
      setSubmitMessage(response?.message || 'Plantel registrado correctamente')
      queryClient.invalidateQueries({ queryKey: ['support', 'campuses'] })
      setForm((prev) => ({
        ...prev,
        name: '',
        state_name: '',
        city: '',
        contact_name: '',
        email: '',
        phone: '',
      }))
    },
    onError: (err: any) => {
      const backendError = err?.response?.data?.error || err?.response?.data?.message
      setSubmitMessage(null)
      setSubmitError(backendError || 'No se pudo registrar el plantel')
    },
  })

  useEffect(() => {
    if (!expandedState && stateGroups.length > 0) {
      setExpandedState(stateGroups[0].state_name)
    }
  }, [expandedState, stateGroups])

  useEffect(() => {
    if (!form.partner_id && partners.length > 0) {
      setForm((prev) => ({ ...prev, partner_id: String(partners[0].id) }))
    }
  }, [partners, form.partner_id])

  const handleSubmitCampus = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitMessage(null)
    setSubmitError(null)

    if (!form.partner_id) {
      setSubmitError('Selecciona una empresa')
      return
    }

    createCampusMutation.mutate({
      partner_id: Number(form.partner_id),
      name: form.name.trim(),
      country: 'México',
      state_name: form.state_name.trim(),
      city: form.city.trim() || undefined,
      contact_name: form.contact_name.trim() || undefined,
      email: form.email.trim(),
      phone: form.phone.trim(),
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Planteles</p>
          <h2 className="text-2xl font-semibold text-gray-900">Planteles a cargo</h2>
          <p className="text-sm text-gray-700 max-w-2xl">
            Selecciona el estado para revisar los planteles asociados.
          </p>
        </div>
        <button className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white">
          Cargar plantel nuevo
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
          {isLoading && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
              Cargando campus...
            </div>
          )}

          {isError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              No se pudieron cargar los campus
              {error instanceof Error ? `: ${error.message}` : ''}
            </div>
          )}

          {!isLoading && !isError && stateGroups.length === 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              {data?.message || 'No hay campus disponibles'}
            </div>
          )}

          {stateGroups.map((item) => {
            const isOpen = expandedState === item.state_name
            return (
              <div key={item.state_name} className="space-y-2">
                <button
                  onClick={() => setExpandedState(isOpen ? null : item.state_name)}
                  className="w-full flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-700 shadow-sm"
                >
                  <span className="font-medium text-gray-800">
                    {item.state_name}{' '}
                    <span className="text-gray-500">· {item.total} campus{item.total === 1 ? '' : 'es'}</span>
                  </span>
                  <ChevronDown className={`h-4 w-4 text-gray-500 transition ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {item.campuses.map((campus) => (
                      <div
                        key={String(campus.id)}
                        className="rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-2 text-sm text-gray-700"
                      >
                        <p className="font-medium text-gray-800">{campus.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {[campus.city, campus.state_name].filter(Boolean).join(', ') || campus.location || 'Sin ubicación'}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Nuevo plantel</p>
            <h3 className="text-lg font-semibold text-gray-900 mt-2">Registrar plantel</h3>
            <p className="text-sm text-gray-700 mt-1">
              Captura la información básica para agregar un plantel al sistema.
            </p>
          </div>
          <form className="space-y-3" onSubmit={handleSubmitCampus}>
            <select
              required
              value={form.partner_id}
              onChange={(event) => setForm((prev) => ({ ...prev, partner_id: event.target.value }))}
              className="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-700"
            >
              <option value="">Empresa / Partner</option>
              {partners.map((partner) => (
                <option key={partner.id} value={partner.id}>
                  {partner.name}
                </option>
              ))}
            </select>
            {partners.length === 0 && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                No hay empresas activas para asociar el plantel.
              </p>
            )}
            <input
              required
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Nombre del plantel"
              className="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <select
                required
                value={form.state_name}
                onChange={(event) => setForm((prev) => ({ ...prev, state_name: event.target.value }))}
                className="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-700"
              >
                <option value="">Estado</option>
                {stateOptions.map((stateName) => (
                  <option key={stateName}>{stateName}</option>
                ))}
              </select>
              <input
                value={form.city}
                onChange={(event) => setForm((prev) => ({ ...prev, city: event.target.value }))}
                placeholder="Municipio"
                className="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm"
              />
            </div>
            <input
              value={form.contact_name}
              onChange={(event) => setForm((prev) => ({ ...prev, contact_name: event.target.value }))}
              placeholder="Contacto principal"
              className="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                required
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                placeholder="Correo de contacto"
                className="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm"
              />
              <input
                required
                value={form.phone}
                onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                placeholder="Teléfono"
                className="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm"
              />
            </div>
            {submitMessage && (
              <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                {submitMessage}
              </p>
            )}
            {submitError && (
              <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                {submitError}
              </p>
            )}
            <button
              type="submit"
              disabled={createCampusMutation.isPending || partners.length === 0}
              className="w-full rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {createCampusMutation.isPending ? 'Guardando...' : 'Guardar plantel'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default SupportCampusesPage
