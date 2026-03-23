/**
 * Página principal del plantel para el responsable
 * Carga el campus ID del responsable y renderiza CampusDetailPage con todos sus módulos
 */
import { useState, useEffect } from 'react'
import { getMiPlantel } from '../../services/partnersService'
import CampusDetailPage from '../partners/CampusDetailPage'

const MiPlantelPage = () => {
  const [campusId, setCampusId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const res = await getMiPlantel()
        setCampusId(res.campus.id)
      } catch (err: any) {
        setError(err.response?.data?.error || 'Error al cargar los datos del plantel')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-4 border-primary-900"></div>
        <p className="mt-4 text-base font-medium text-gray-700">Cargando plantel...</p>
      </div>
    )
  }

  if (error || !campusId) {
    return (
      <div className="p-6 bg-red-50 text-red-600 rounded-xl">
        <p>{error || 'No se encontró el plantel asignado'}</p>
      </div>
    )
  }

  return <CampusDetailPage campusIdProp={campusId} isResponsable />
}

export default MiPlantelPage
