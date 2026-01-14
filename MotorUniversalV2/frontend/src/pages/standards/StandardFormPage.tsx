/**
 * Formulario para crear/editar Estándares de Competencia
 */
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  getStandard,
  createStandard,
  updateStandard,
  CreateStandardDTO,
} from '../../services/standardsService';

export default function StandardFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = !!id;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<CreateStandardDTO>({
    code: '',
    name: '',
    description: '',
    sector: '',
    level: undefined,
    validity_years: 5,
    certifying_body: 'CONOCER',
  });

  useEffect(() => {
    if (isEditing) {
      loadStandard();
    }
  }, [id]);

  const loadStandard = async () => {
    try {
      setLoading(true);
      const standard = await getStandard(Number(id));
      setFormData({
        code: standard.code,
        name: standard.name,
        description: standard.description || '',
        sector: standard.sector || '',
        level: standard.level,
        validity_years: standard.validity_years,
        certifying_body: standard.certifying_body,
      });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar el estándar');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'number' ? (value ? Number(value) : undefined) : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      if (isEditing) {
        await updateStandard(Number(id), formData);
        alert('Estándar actualizado exitosamente');
      } else {
        await createStandard(formData);
        alert('Estándar creado exitosamente');
      }
      navigate('/standards');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al guardar el estándar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <button
          onClick={() => navigate('/standards')}
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
        >
          <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Volver a estándares
        </button>
        <h1 className="mt-4 text-2xl font-bold text-gray-900">
          {isEditing ? 'Editar Estándar' : 'Nuevo Estándar de Competencia'}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {isEditing
            ? 'Actualiza la información del estándar de competencia.'
            : 'Define un nuevo ECM para crear exámenes basados en él.'}
        </p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 bg-white shadow sm:rounded-lg p-6">
        {/* Código */}
        <div>
          <label htmlFor="code" className="block text-sm font-medium text-gray-700">
            Código del Estándar *
          </label>
          <input
            type="text"
            name="code"
            id="code"
            required
            disabled={isEditing}
            value={formData.code}
            onChange={handleChange}
            placeholder="Ej: EC0217"
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100"
          />
          <p className="mt-1 text-xs text-gray-500">
            Código único del estándar CONOCER (no se puede modificar después de crear)
          </p>
        </div>

        {/* Nombre */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            Nombre del Estándar *
          </label>
          <input
            type="text"
            name="name"
            id="name"
            required
            value={formData.name}
            onChange={handleChange}
            placeholder="Ej: Impartición de cursos de formación del capital humano"
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
        </div>

        {/* Descripción */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">
            Descripción
          </label>
          <textarea
            name="description"
            id="description"
            rows={4}
            value={formData.description}
            onChange={handleChange}
            placeholder="Describe el propósito y alcance del estándar..."
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {/* Sector */}
          <div>
            <label htmlFor="sector" className="block text-sm font-medium text-gray-700">
              Sector Productivo
            </label>
            <input
              type="text"
              name="sector"
              id="sector"
              value={formData.sector}
              onChange={handleChange}
              placeholder="Ej: Educación y Formación"
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>

          {/* Nivel */}
          <div>
            <label htmlFor="level" className="block text-sm font-medium text-gray-700">
              Nivel de Competencia
            </label>
            <select
              name="level"
              id="level"
              value={formData.level || ''}
              onChange={handleChange}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            >
              <option value="">Seleccionar nivel</option>
              <option value="1">Nivel 1 - Competencias simples</option>
              <option value="2">Nivel 2 - Competencias básicas</option>
              <option value="3">Nivel 3 - Competencias intermedias</option>
              <option value="4">Nivel 4 - Competencias avanzadas</option>
              <option value="5">Nivel 5 - Competencias expertas</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {/* Años de vigencia */}
          <div>
            <label htmlFor="validity_years" className="block text-sm font-medium text-gray-700">
              Años de Vigencia
            </label>
            <input
              type="number"
              name="validity_years"
              id="validity_years"
              min="1"
              max="10"
              value={formData.validity_years || ''}
              onChange={handleChange}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
            <p className="mt-1 text-xs text-gray-500">
              Duración de la validez del certificado (default: 5 años)
            </p>
          </div>

          {/* Organismo certificador */}
          <div>
            <label htmlFor="certifying_body" className="block text-sm font-medium text-gray-700">
              Organismo Certificador
            </label>
            <input
              type="text"
              name="certifying_body"
              id="certifying_body"
              value={formData.certifying_body}
              onChange={handleChange}
              placeholder="CONOCER"
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>
        </div>

        {/* Botones */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={() => navigate('/standards')}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'Guardando...' : isEditing ? 'Guardar Cambios' : 'Crear Estándar'}
          </button>
        </div>
      </form>
    </div>
  );
}
