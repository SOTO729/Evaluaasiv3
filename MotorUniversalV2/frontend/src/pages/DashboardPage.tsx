import { useAuthStore } from '../store/authStore'

const DashboardPage = () => {
  const { user } = useAuthStore()

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">
        Bienvenido, {user?.name}
      </h1>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Exámenes Disponibles
          </h3>
          <p className="text-3xl font-bold text-primary-600">0</p>
        </div>

        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Exámenes Completados
          </h3>
          <p className="text-3xl font-bold text-green-600">0</p>
        </div>

        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Promedio
          </h3>
          <p className="text-3xl font-bold text-blue-600">0%</p>
        </div>
      </div>

      <div className="mt-8">
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Actividad Reciente</h2>
          <p className="text-gray-500">No hay actividad reciente</p>
        </div>
      </div>
    </div>
  )
}

export default DashboardPage
