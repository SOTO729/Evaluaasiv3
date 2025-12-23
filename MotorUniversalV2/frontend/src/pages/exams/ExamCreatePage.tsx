import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { examService } from '../../services/examService'
import type { CreateExamData, CreateCategoryData } from '../../types'

interface ModuleInputErrors {
  name?: string
  percentage?: string
}

const ExamCreatePage = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Datos del formulario
  const [formData, setFormData] = useState<Omit<CreateExamData, 'stage_id' | 'categories' | 'standard'>>({
    name: '',
    version: '',
    duration_minutes: 60,
    passing_score: 70,
  })
  
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  
  // Módulos/Categorías
  const [modules, setModules] = useState<CreateCategoryData[]>([
    { name: '', description: '', percentage: 0 }
  ])
  
  // Errores de validación
  const [versionError, setVersionError] = useState<string | null>(null)
  const [nameError, setNameError] = useState<string | null>(null)
  const [durationError, setDurationError] = useState<string | null>(null)
  const [passingScoreError, setPassingScoreError] = useState<string | null>(null)
  const [percentageError, setPercentageError] = useState<string | null>(null)
  const [moduleErrors, setModuleErrors] = useState<ModuleInputErrors[]>([{}])
  
  // Validar código ECM
  const validateVersion = (value: string): boolean => {
    if (!value || value.trim() === '') {
      setVersionError('El código ECM es requerido')
      return false
    }
    
    if (!value.includes('ECM')) {
      setVersionError('El código debe contener "ECM"')
      return false
    }
    
    // Debe tener exactamente 7 caracteres en total
    if (value.length !== 7) {
      setVersionError('El código debe tener exactamente 7 caracteres (incluyendo ECM)')
      return false
    }
    
    setVersionError(null)
    return true
  }
  
  // Validar nombre del examen
  const validateName = (value: string): boolean => {
    if (!value || value.trim() === '') {
      setNameError('El nombre del examen es requerido')
      return false
    }
    
    setNameError(null)
    return true
  }
  
  // Validar duración
  const validateDuration = (value: number): boolean => {
    if (!value || value <= 0) {
      setDurationError('La duración debe ser mayor a 0 minutos')
      return false
    }
    
    setDurationError(null)
    return true
  }
  
  // Validar puntaje mínimo
  const validatePassingScore = (value: number): boolean => {
    if (value === null || value === undefined || value < 0) {
      setPassingScoreError('El puntaje mínimo es requerido')
      return false
    }
    
    if (value > 100) {
      setPassingScoreError('El puntaje no puede ser mayor a 100%')
      return false
    }
    
    setPassingScoreError(null)
    return true
  }
  
  // Manejar carga de imagen
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      setError('Por favor selecciona un archivo de imagen válido')
      return
    }
    
    // Validar tamaño (máximo 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setError('La imagen no debe superar los 2MB')
      return
    }
    
    // Convertir a base64
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64String = reader.result as string
      setFormData({ ...formData, image_url: base64String })
      setImagePreview(base64String)
    }
    reader.readAsDataURL(file)
  }
  
  // Eliminar imagen
  const handleRemoveImage = () => {
    setFormData({ ...formData, image_url: undefined })
    setImagePreview(null)
  }
  
  // Validar suma de porcentajes
  const validatePercentages = (): boolean => {
    const total = modules.reduce((sum, mod) => sum + (mod.percentage || 0), 0)
    
    if (total !== 100) {
      setPercentageError(`La suma de porcentajes debe ser 100 (actual: ${total})`)
      return false
    }
    
    setPercentageError(null)
    return true
  }
  
  // Agregar categoría
  const addModule = () => {
    setModules([...modules, { name: '', description: '', percentage: 0 }])
    setModuleErrors([...moduleErrors, {}])
  }
  
  // Eliminar categoría
  const removeModule = (index: number) => {
    if (modules.length === 1) {
      setError('Debe haber al menos una categoría')
      return
    }
    
    const newModules = modules.filter((_, i) => i !== index)
    const newErrors = moduleErrors.filter((_, i) => i !== index)
    setModules(newModules)
    setModuleErrors(newErrors)
    setError(null)
  }
  
  // Actualizar categoría
  const updateModule = (index: number, field: keyof CreateCategoryData, value: string | number) => {
    const newModules = [...modules]
    newModules[index] = { ...newModules[index], [field]: value }
    setModules(newModules)
    
    // Validar campo específico
    const newErrors = [...moduleErrors]
    if (field === 'name' && !value) {
      newErrors[index] = { ...newErrors[index], name: 'El nombre es requerido' }
    } else if (field === 'name') {
      const { name, ...rest } = newErrors[index]
      newErrors[index] = rest
    }
    
    if (field === 'percentage') {
      const numValue = Number(value)
      if (numValue < 0 || numValue > 100) {
        newErrors[index] = { ...newErrors[index], percentage: 'Debe estar entre 0 y 100' }
      } else {
        const { percentage, ...rest } = newErrors[index]
        newErrors[index] = rest
      }
    }
    
    setModuleErrors(newErrors)
  }
  
  // Distribuir porcentajes equitativamente
  const distributePercentages = () => {
    const equalPercentage = Math.floor(100 / modules.length)
    const remainder = 100 % modules.length
    
    const newModules = modules.map((mod, index) => ({
      ...mod,
      percentage: equalPercentage + (index < remainder ? 1 : 0)
    }))
    
    setModules(newModules)
    setPercentageError(null)
  }
  
  // Manejar envío del formulario
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    
    // Validaciones
    if (!validateVersion(formData.version)) {
      return
    }
    
    if (!validateName(formData.name)) {
      return
    }
    
    if (!validateDuration(formData.duration_minutes ?? 0)) {
      return
    }
    
    if (!validatePassingScore(formData.passing_score ?? 0)) {
      return
    }
    
    // Validar categorías
    const hasEmptyNames = modules.some(mod => !mod.name.trim())
    if (hasEmptyNames) {
      setError('Todas las categorías deben tener un nombre')
      return
    }
    
    if (!validatePercentages()) {
      return
    }
    
    // Validar que todos los porcentajes sean válidos
    const hasInvalidPercentages = modules.some(mod => {
      const p = mod.percentage
      return p < 0 || p > 100
    })
    
    if (hasInvalidPercentages) {
      setError('Todos los porcentajes deben estar entre 0 y 100')
      return
    }
    
    try {
      setLoading(true)
      
      const examData: CreateExamData = {
        ...formData,
        standard: 'ECM', // Estándar fijo
        stage_id: 1, // Por defecto, se puede hacer dinámico después
        categories: modules
      }
      
      await examService.createExam(examData)
      
      // Redirigir a la lista de exámenes
      navigate('/exams')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al crear el examen')
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Crear Examen</h1>
        <p className="text-gray-600">Complete los datos del nuevo examen y sus módulos</p>
      </div>
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Información General */}
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Información General</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Código ECM */}
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Código ECM <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={formData.version}
                onChange={(e) => {
                  const value = e.target.value.toUpperCase()
                  setFormData({ ...formData, version: value })
                  validateVersion(value)
                }}
                onBlur={(e) => validateVersion(e.target.value)}
                className={`input ${versionError ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                placeholder="Ej: ECM2024"
                maxLength={7}
                required
              />
              {versionError && (
                <p className="text-red-600 text-xs mt-1 font-medium">{versionError}</p>
              )}
              {!versionError && formData.version && (
                <p className="text-green-600 text-xs mt-1 font-medium">✓ Código válido</p>
              )}
            </div>
            
            {/* Nombre del Examen */}
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre del Examen <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value })
                  if (e.target.value.trim()) {
                    setNameError(null)
                  }
                }}
                onBlur={(e) => validateName(e.target.value)}
                className={`input ${nameError ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                placeholder="Ej: Microsoft Office Specialist - Excel 2019"
                required
              />
              {nameError && (
                <p className="text-red-600 text-xs mt-1 font-medium">{nameError}</p>
              )}
              {!nameError && formData.name.trim() && (
                <p className="text-green-600 text-xs mt-1 font-medium">✓ Nombre válido</p>
              )}
            </div>
            
            {/* Duración */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Duración (minutos) <span className="text-red-600">*</span>
              </label>
              <input
                type="number"
                value={formData.duration_minutes}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || 0
                  setFormData({ ...formData, duration_minutes: value })
                  if (value > 0) {
                    setDurationError(null)
                  }
                }}
                onBlur={(e) => validateDuration(parseInt(e.target.value) || 0)}
                className={`input ${durationError ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                min="1"
                required
              />
              {durationError && (
                <p className="text-red-600 text-xs mt-1 font-medium">{durationError}</p>
              )}
              {!durationError && (formData.duration_minutes ?? 0) > 0 && (
                <p className="text-green-600 text-xs mt-1 font-medium">✓ Duración válida</p>
              )}
            </div>
            
            {/* Puntaje Mínimo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Puntaje Mínimo para Aprobar (%) <span className="text-red-600">*</span>
              </label>
              <input
                type="number"
                value={formData.passing_score}
                onChange={(e) => {
                  const value = parseInt(e.target.value)
                  setFormData({ ...formData, passing_score: isNaN(value) ? 0 : value })
                  if (!isNaN(value) && value >= 0 && value <= 100) {
                    setPassingScoreError(null)
                  }
                }}
                onBlur={(e) => validatePassingScore(parseInt(e.target.value) || 0)}
                className={`input ${passingScoreError ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                min="0"
                max="100"
                required
              />
              {passingScoreError && (
                <p className="text-red-600 text-xs mt-1 font-medium">{passingScoreError}</p>
              )}
              {!passingScoreError && (formData.passing_score ?? 0) >= 0 && (formData.passing_score ?? 0) <= 100 && (
                <p className="text-green-600 text-xs mt-1 font-medium">✓ Puntaje válido</p>
              )}
            </div>
          </div>
          
          {/* Imagen del Examen */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Imagen del Examen (opcional)
            </label>
            
            {imagePreview ? (
              <div className="relative inline-block">
                <img 
                  src={imagePreview} 
                  alt="Vista previa" 
                  className="w-full max-w-4xl h-64 object-cover rounded-lg border-2 border-gray-300"
                />
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="absolute top-2 right-2 bg-red-600 text-white p-2 rounded-full hover:bg-red-700 shadow-lg"
                  title="Eliminar imagen"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-center w-full">
                <label className="flex flex-col items-center justify-center w-full max-w-4xl h-64 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <svg className="w-10 h-10 mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="mb-2 text-sm text-gray-500"><span className="font-semibold">Click para cargar</span> o arrastra y suelta</p>
                    <p className="text-xs text-gray-500">PNG, JPG o JPEG (Máx. 2MB)</p>
                  </div>
                  <input 
                    type="file" 
                    className="hidden" 
                    accept="image/png,image/jpeg,image/jpg"
                    onChange={handleImageChange}
                  />
                </label>
              </div>
            )}
          </div>
        </div>
        
        {/* Categorías */}
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-xl font-semibold">Categorías del Examen</h2>
              <p className="text-sm text-gray-600">La suma de porcentajes debe ser 100%</p>
            </div>
            <button
              type="button"
              onClick={distributePercentages}
              className="btn btn-secondary text-sm"
            >
              Distribuir Equitativamente
            </button>
          </div>
          
          <div className="space-y-4">
            {modules.map((module, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-medium text-gray-900">Categoría {index + 1}</h3>
                  {modules.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeModule(index)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Eliminar
                    </button>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Nombre del Módulo */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nombre <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={module.name}
                      onChange={(e) => updateModule(index, 'name', e.target.value)}
                      className={`input ${moduleErrors[index]?.name ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                      placeholder="Ej: Gestión de hojas de cálculo"
                      required
                    />
                    {moduleErrors[index]?.name && (
                      <p className="text-red-600 text-xs mt-1 font-medium">{moduleErrors[index].name}</p>
                    )}
                  </div>
                  
                  {/* Porcentaje */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Porcentaje (%) <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="number"
                      value={module.percentage === 0 ? '' : module.percentage}
                      onChange={(e) => {
                        const value = e.target.value === '' ? 0 : parseInt(e.target.value)
                        updateModule(index, 'percentage', value)
                        // Revalidar suma cuando cambia un porcentaje
                        setTimeout(() => validatePercentages(), 0)
                      }}
                      onBlur={(e) => {
                        // Si el campo está vacío al salir, poner 0
                        if (e.target.value === '') {
                          updateModule(index, 'percentage', 0)
                        }
                        // Revalidar suma al salir del campo
                        setTimeout(() => validatePercentages(), 0)
                      }}
                      className={`input ${moduleErrors[index]?.percentage ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                      min="0"
                      max="100"
                      required
                    />
                    {moduleErrors[index]?.percentage && (
                      <p className="text-red-600 text-xs mt-1 font-medium">{moduleErrors[index].percentage}</p>
                    )}
                  </div>
                  
                  {/* Descripción */}
                  <div className="md:col-span-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Descripción
                    </label>
                    <input
                      type="text"
                      value={module.description}
                      onChange={(e) => updateModule(index, 'description', e.target.value)}
                      className="input"
                      placeholder="Descripción de la categoría (opcional)"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <button
            type="button"
            onClick={addModule}
            className="btn btn-secondary w-full mt-4"
          >
              + Agregar Categoría
            </button>
          
          {/* Resumen de Porcentajes */}
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-blue-900">Total de Porcentajes:</span>
              <span className={`text-lg font-bold ${
                modules.reduce((sum, m) => sum + (m.percentage || 0), 0) === 100 
                  ? 'text-green-600' 
                  : 'text-red-600'
              }`}>
                {modules.reduce((sum, m) => sum + (m.percentage || 0), 0)}%
              </span>
            </div>
          </div>
          
          {/* Mensaje de error de suma de porcentajes */}
          {percentageError && (
            <div className="mt-3 bg-red-50 border border-red-300 text-red-700 px-3 py-2 rounded text-sm font-medium">
              ⚠️ {percentageError}
            </div>
          )}
        </div>
        
        {/* Botones de Acción */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/exams')}
            className="btn btn-secondary"
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || !!versionError || !!nameError || !!durationError || !!passingScoreError || !!percentageError}
          >
            {loading ? 'Creando...' : 'Crear Examen'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default ExamCreatePage
