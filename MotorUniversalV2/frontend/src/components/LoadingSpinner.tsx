interface LoadingSpinnerProps {
  message?: string
  fullScreen?: boolean
}

const LoadingSpinner = ({ message = 'Cargando...', fullScreen = false }: LoadingSpinnerProps) => {
  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white bg-opacity-95 flex items-center justify-center z-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-4 border-primary-600"></div>
          <p className="mt-4 text-lg font-medium text-gray-700">{message}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-4 border-primary-600"></div>
      <p className="mt-4 text-base font-medium text-gray-700">{message}</p>
    </div>
  )
}

export default LoadingSpinner
