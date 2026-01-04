/**
 * Página para crear/editar un Material de Estudio
 * Diseño similar a ExamCreatePage con sección para relacionar con examen
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { 
  getMaterial, 
  createMaterial, 
  updateMaterial,
  uploadMaterialCoverImage,
  CreateMaterialData 
} from '../../services/studyContentService';
import { examService } from '../../services/examService';
import { 
  ArrowLeft, 
  Loader2,
  Link2,
  X,
  AlertCircle,
  CheckCircle2,
  Search,
  Plus
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';

interface ExamListItem {
  id: number;
  name: string;
  version: string;
  is_published: boolean;
  total_questions: number;
  total_exercises: number;
  total_categories: number;
  image_url?: string;
}

// Configuración del editor de texto
const quillModules = {
  toolbar: [
    [{ 'header': [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
    [{ 'indent': '-1' }, { 'indent': '+1' }],
    [{ 'align': [] }],
    ['link'],
    ['clean']
  ],
};

const quillFormats = [
  'header',
  'bold', 'italic', 'underline', 'strike',
  'list',
  'indent',
  'align',
  'link'
];

const StudyContentCreatePage = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditing = !!id;
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [formData, setFormData] = useState<CreateMaterialData>({
    title: '',
    description: '',
    image_url: '',
    is_published: false,
    exam_ids: [],
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [showSuccess, setShowSuccess] = useState(false);
  const [errorModal, setErrorModal] = useState<{ show: boolean; title: string; message: string }>({ show: false, title: '', message: '' });
  
  // Estado para múltiples exámenes seleccionados
  const [selectedExams, setSelectedExams] = useState<ExamListItem[]>([]);
  const [searchExam, setSearchExam] = useState('');

  // Cargar lista de exámenes
  const { data: examsData } = useQuery({
    queryKey: ['exams-for-link'],
    queryFn: () => examService.getExams(),
  });

  // Filtrar exámenes por búsqueda (excluir los ya seleccionados)
  const filteredExams = examsData?.exams?.filter((exam: ExamListItem) =>
    (exam.name.toLowerCase().includes(searchExam.toLowerCase()) ||
    exam.version.toLowerCase().includes(searchExam.toLowerCase())) &&
    !selectedExams.some(selected => selected.id === exam.id)
  ) || [];

  useEffect(() => {
    if (isEditing) {
      loadMaterial();
    }
  }, [id]);

  // Efecto para cargar exámenes relacionados cuando se obtienen los exámenes
  useEffect(() => {
    if (formData.exam_ids && formData.exam_ids.length > 0 && examsData?.exams && selectedExams.length === 0) {
      const linkedExams = examsData.exams.filter((e: ExamListItem) => 
        formData.exam_ids?.includes(e.id)
      );
      if (linkedExams.length > 0) {
        setSelectedExams(linkedExams);
      }
    }
  }, [examsData, formData.exam_ids]);

  const loadMaterial = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const material = await getMaterial(parseInt(id));
      setFormData({
        title: material.title,
        description: material.description || '',
        image_url: material.image_url || '',
        is_published: material.is_published,
        exam_ids: material.exam_ids || [],
      });
    } catch (error) {
      console.error('Error al cargar material:', error);
      navigate('/study-contents');
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};
    
    if (!formData.title.trim()) {
      newErrors.title = 'El título es requerido';
    } else if (formData.title.length < 3) {
      newErrors.title = 'El título debe tener al menos 3 caracteres';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setSaving(true);
    try {
      const dataToSave = {
        ...formData,
        exam_ids: selectedExams.map(e => e.id),
      };

      if (isEditing && id) {
        await updateMaterial(parseInt(id), dataToSave);
        setShowSuccess(true);
        setTimeout(() => {
          navigate(`/study-contents/${id}`);
        }, 1000);
      } else {
        const newMaterial = await createMaterial(dataToSave);
        setShowSuccess(true);
        setTimeout(() => {
          navigate(`/study-contents/${newMaterial.id}`);
        }, 1000);
      }
    } catch (error: unknown) {
      console.error('Error al guardar material:', error);
      let errorMessage = 'Error desconocido al guardar el material.';
      let errorTitle = 'Error al Guardar';
      
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { data?: { error?: string; message?: string }; status?: number } };
        const responseError = axiosError.response?.data?.error || axiosError.response?.data?.message;
        const status = axiosError.response?.status;
        
        if (status === 401) {
          errorTitle = 'Sesión Expirada';
          errorMessage = 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.';
        } else if (status === 403) {
          errorTitle = 'Sin Permisos';
          errorMessage = 'No tienes permisos para realizar esta acción.';
        } else if (status === 500) {
          errorTitle = 'Error del Servidor';
          errorMessage = responseError || 'Error interno del servidor. Contacta al administrador.';
        } else if (responseError) {
          errorMessage = responseError;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      setErrorModal({ show: true, title: errorTitle, message: errorMessage });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Limpiar error del campo
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  // Handler para el editor de texto enriquecido
  const handleDescriptionChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      description: value,
    }));
  };

  const handleImageUpload = async (file: File) => {
    // Validar tipo de archivo
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setErrors({ image: 'Formato no permitido. Use: PNG, JPG, GIF o WebP' });
      return;
    }

    // Validar tamaño (máximo 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setErrors({ image: 'La imagen no debe superar los 5MB' });
      return;
    }

    setUploadingImage(true);
    setErrors({});

    try {
      const imageUrl = await uploadMaterialCoverImage(file);
      setFormData((prev) => ({ ...prev, image_url: imageUrl }));
    } catch (error) {
      console.error('Error al subir imagen:', error);
      setErrors({ image: 'Error al subir la imagen. Inténtalo de nuevo.' });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageUpload(file);
    }
  };

  // Funciones para drag & drop
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      handleImageUpload(file);
    }
  }, []);

  const removeImage = () => {
    setFormData((prev) => ({ ...prev, image_url: '' }));
  };

  // Funciones para manejar múltiples exámenes
  const handleAddExam = (exam: ExamListItem) => {
    setSelectedExams((prev) => [...prev, exam]);
    setSearchExam('');
  };

  const handleRemoveExam = (examId: number) => {
    setSelectedExams((prev) => prev.filter(e => e.id !== examId));
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6 flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner message="Cargando material..." />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/study-contents')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-4 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
          <span>Volver a la lista</span>
        </button>
        
        <h1 className="text-3xl font-bold mb-2">
          {isEditing ? 'Editar Material de Estudio' : 'Crear Material de Estudio'}
        </h1>
        <p className="text-gray-600">
          {isEditing 
            ? 'Modifica la información del material existente'
            : 'Complete los datos del nuevo material de estudio'
          }
        </p>
      </div>

      {/* Success Message */}
      {showSuccess && (
        <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
          <span className="font-medium">
            Material {isEditing ? 'actualizado' : 'creado'} exitosamente. Redirigiendo...
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Información General */}
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Información General</h2>
          
          <div className="space-y-4">
            {/* Título */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                Título del Material <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="Ej: Introducción a la Mecánica Automotriz"
                className={`input ${errors.title ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
              />
              {errors.title && (
                <p className="text-red-600 text-xs mt-1 font-medium">{errors.title}</p>
              )}
              {!errors.title && formData.title.trim() && (
                <p className="text-green-600 text-xs mt-1 font-medium">✓ Título válido</p>
              )}
            </div>

            {/* Descripción con Editor de Texto */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descripción
              </label>
              <div className="border border-gray-300 rounded-lg overflow-hidden">
                <ReactQuill
                  theme="snow"
                  value={formData.description || ''}
                  onChange={handleDescriptionChange}
                  modules={quillModules}
                  formats={quillFormats}
                  placeholder="Describe el contenido y objetivos del material de estudio..."
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Usa el editor para dar formato al texto: negritas, listas, enlaces, etc.
              </p>
              <style>{`
                .ql-container {
                  min-height: 120px;
                  font-size: 14px;
                }
                .ql-editor {
                  min-height: 120px;
                }
                .ql-toolbar {
                  background: #f9fafb;
                  border-bottom: 1px solid #e5e7eb !important;
                }
                .ql-container {
                  border: none !important;
                }
              `}</style>
            </div>
          </div>

          {/* Imagen del Material */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Imagen del Material (opcional)
            </label>
            
            {formData.image_url ? (
              <div className="relative inline-block">
                <img 
                  src={formData.image_url} 
                  alt="Vista previa" 
                  className="w-full max-w-4xl h-64 object-cover rounded-lg border-2 border-gray-300"
                />
                <button
                  type="button"
                  onClick={removeImage}
                  className="absolute top-2 right-2 bg-red-600 text-white p-2 rounded-full hover:bg-red-700 shadow-lg"
                  title="Eliminar imagen"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <div 
                className="flex items-center justify-center w-full"
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <label className={`flex flex-col items-center justify-center w-full max-w-4xl h-64 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                  dragActive 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
                }`}>
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <svg className="w-10 h-10 mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="mb-2 text-sm text-gray-500"><span className="font-semibold">Click para cargar</span> o arrastra y suelta</p>
                    <p className="text-xs text-gray-500">PNG, JPG, GIF o WEBP (Máx. 5MB)</p>
                  </div>
                  <input 
                    type="file" 
                    className="hidden" 
                    accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                    onChange={handleFileSelect}
                  />
                </label>
              </div>
            )}
            
            {uploadingImage && (
              <div className="mt-3 flex items-center gap-2 text-blue-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Subiendo imagen...</span>
              </div>
            )}
            
            {errors.image && (
              <p className="text-red-600 text-xs mt-2 font-medium flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {errors.image}
              </p>
            )}
          </div>
        </div>

        {/* Vincular con Exámenes */}
        <div className="card">
          <div className="mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Link2 className="h-5 w-5 text-blue-600" />
              Vincular con Exámenes
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Relaciona este material de estudio con uno o varios exámenes (opcional)
            </p>
          </div>

          {/* Exámenes seleccionados */}
          {selectedExams.length > 0 && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Exámenes vinculados ({selectedExams.length})
              </label>
              <div className="space-y-2">
                {selectedExams.map((exam) => (
                  <div 
                    key={exam.id}
                    className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Link2 className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{exam.name}</p>
                        <p className="text-xs text-gray-500 font-mono">{exam.version}</p>
                      </div>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        exam.is_published ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {exam.is_published ? 'Publicado' : 'Borrador'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveExam(exam.id)}
                      className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                      title="Quitar examen"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Buscador y lista para agregar más exámenes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {selectedExams.length > 0 ? 'Agregar otro examen' : 'Buscar y seleccionar exámenes'}
            </label>
            
            {/* Buscador */}
            <div className="mb-3 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchExam}
                onChange={(e) => setSearchExam(e.target.value)}
                placeholder="Buscar examen por nombre o código..."
                className="input pl-10"
              />
            </div>

            {/* Lista de exámenes disponibles */}
            <div className="border border-gray-300 rounded-lg max-h-48 overflow-y-auto">
              {filteredExams.length > 0 ? (
                filteredExams.map((exam: ExamListItem) => (
                  <div
                    key={exam.id}
                    onClick={() => handleAddExam(exam)}
                    className="p-3 cursor-pointer border-b last:border-b-0 transition-colors hover:bg-blue-50 flex items-center justify-between"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900 truncate">{exam.name}</p>
                        <span className={`px-2 py-0.5 text-xs rounded-full whitespace-nowrap ${
                          exam.is_published ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {exam.is_published ? 'Publicado' : 'Borrador'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 font-mono">{exam.version}</p>
                      <div className="flex gap-3 mt-1 text-xs text-gray-500">
                        <span>{exam.total_categories} categorías</span>
                        <span>{exam.total_questions} preguntas</span>
                        <span>{exam.total_exercises} ejercicios</span>
                      </div>
                    </div>
                    <Plus className="h-5 w-5 text-blue-600 flex-shrink-0" />
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-gray-500">
                  {searchExam 
                    ? 'No se encontraron exámenes con ese criterio'
                    : selectedExams.length > 0 
                      ? 'No hay más exámenes disponibles para vincular'
                      : 'No hay exámenes disponibles'
                  }
                </div>
              )}
            </div>

            <p className="text-xs text-gray-500 mt-3">
              <span className="font-medium">Nota:</span> Vincular un material con exámenes permite que los estudiantes 
              accedan al contenido de estudio relacionado antes de tomar los exámenes.
            </p>
          </div>
        </div>

        {/* Botones de Acción */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/study-contents')}
            className="btn btn-secondary"
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="btn btn-primary flex items-center gap-2"
            disabled={saving || uploadingImage || !formData.title.trim()}
          >
            {saving ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                {isEditing ? 'Guardando...' : 'Creando...'}
              </>
            ) : (
              <>
                {isEditing ? 'Guardar Cambios' : 'Crear Material'}
              </>
            )}
          </button>
        </div>
      </form>

      {/* Modal de Error */}
      {errorModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden">
            <div className="bg-red-600 px-6 py-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-6 w-6 text-white" />
                <h3 className="text-lg font-semibold text-white">{errorModal.title}</h3>
              </div>
            </div>
            <div className="px-6 py-4">
              <p className="text-gray-700">{errorModal.message}</p>
            </div>
            <div className="px-6 py-4 bg-gray-50 flex justify-end">
              <button
                type="button"
                onClick={() => setErrorModal({ show: false, title: '', message: '' })}
                className="btn btn-primary"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudyContentCreatePage;
