/**
 * Página para crear/editar un Material de Estudio
 */
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  getMaterial, 
  createMaterial, 
  updateMaterial,
  CreateMaterialData 
} from '../../services/studyContentService';
import { 
  BookOpen, 
  ArrowLeft, 
  Save, 
  Image as ImageIcon,
  Loader2
} from 'lucide-react';

const StudyContentCreatePage = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditing = !!id;
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<CreateMaterialData>({
    title: '',
    description: '',
    image_url: '',
    is_published: false,
    order: 0,
  });

  useEffect(() => {
    if (isEditing) {
      loadMaterial();
    }
  }, [id]);

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
        order: material.order,
        exam_id: material.exam_id,
      });
    } catch (error) {
      console.error('Error al cargar material:', error);
      navigate('/study-contents');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      alert('El título es requerido');
      return;
    }

    setSaving(true);
    try {
      if (isEditing && id) {
        await updateMaterial(parseInt(id), formData);
        navigate(`/study-contents/${id}`);
      } else {
        const newMaterial = await createMaterial(formData);
        navigate(`/study-contents/${newMaterial.id}`);
      }
    } catch (error) {
      console.error('Error al guardar material:', error);
      alert('Error al guardar el material');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Cargando material...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/study-contents')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Volver a la lista
        </button>
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <BookOpen className="h-7 w-7 text-blue-600" />
          {isEditing ? 'Editar Material' : 'Nuevo Material de Estudio'}
        </h1>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
        {/* Título */}
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
            Título *
          </label>
          <input
            type="text"
            id="title"
            name="title"
            value={formData.title}
            onChange={handleChange}
            placeholder="Ej: Fundamentos de Matemáticas"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>

        {/* Descripción */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
            Descripción
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Describe el contenido del material..."
            rows={4}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* URL de imagen */}
        <div>
          <label htmlFor="image_url" className="block text-sm font-medium text-gray-700 mb-1">
            URL de la imagen de portada
          </label>
          <div className="flex gap-4">
            <div className="flex-1">
              <input
                type="url"
                id="image_url"
                name="image_url"
                value={formData.image_url}
                onChange={handleChange}
                placeholder="https://ejemplo.com/imagen.jpg"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            {formData.image_url ? (
              <img
                src={formData.image_url}
                alt="Preview"
                className="h-16 w-16 rounded-lg object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '';
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="h-16 w-16 rounded-lg bg-gray-100 flex items-center justify-center">
                <ImageIcon className="h-8 w-8 text-gray-400" />
              </div>
            )}
          </div>
        </div>

        {/* Orden */}
        <div>
          <label htmlFor="order" className="block text-sm font-medium text-gray-700 mb-1">
            Orden de aparición
          </label>
          <input
            type="number"
            id="order"
            name="order"
            value={formData.order}
            onChange={handleChange}
            min={0}
            className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-sm text-gray-500 mt-1">
            Los materiales se ordenan de menor a mayor
          </p>
        </div>

        {/* Publicado */}
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="is_published"
            name="is_published"
            checked={formData.is_published}
            onChange={handleChange}
            className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
          />
          <label htmlFor="is_published" className="text-sm font-medium text-gray-700">
            Publicar material (visible para estudiantes)
          </label>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={() => navigate('/study-contents')}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="h-5 w-5" />
                {isEditing ? 'Guardar Cambios' : 'Crear Material'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default StudyContentCreatePage;
