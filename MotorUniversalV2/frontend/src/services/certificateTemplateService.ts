/**
 * Servicio API para Plantillas de Certificado por ECM
 */
import api from './api';

export interface FieldConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  maxFontSize?: number;
  color?: string;
}

export interface QrFieldConfig {
  x: number;
  y: number;
  size: number;
  background: 'white' | 'transparent';
  showCode?: boolean;
  showText?: boolean;
}

export interface TemplateConfig {
  name_field: FieldConfig;
  cert_name_field: FieldConfig;
  qr_field: QrFieldConfig;
}

export interface CertificateTemplate {
  id: number;
  competency_standard_id: number;
  template_blob_url: string;
  pdf_width: number;
  pdf_height: number;
  config: TemplateConfig;
  created_by: string;
  created_at: string;
  updated_by?: string;
  updated_at?: string;
}

/**
 * Obtener plantilla de certificado de un ECM
 */
export const getCertificateTemplate = async (
  standardId: number
): Promise<{ template: CertificateTemplate | null; has_template: boolean }> => {
  const response = await api.get(
    `/competency-standards/${standardId}/certificate-template`
  );
  return response.data;
};

/**
 * Subir una nueva plantilla PDF de certificado
 */
export const uploadCertificateTemplate = async (
  standardId: number,
  file: File
): Promise<{ message: string; template: CertificateTemplate }> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post(
    `/competency-standards/${standardId}/certificate-template`,
    formData
  );
  return response.data;
};

/**
 * Actualizar la configuración de posiciones de la plantilla
 */
export const updateCertificateTemplate = async (
  standardId: number,
  config: TemplateConfig
): Promise<{ message: string; template: CertificateTemplate }> => {
  const response = await api.put(
    `/competency-standards/${standardId}/certificate-template`,
    { config }
  );
  return response.data;
};

/**
 * Eliminar la plantilla de certificado
 */
export const deleteCertificateTemplate = async (
  standardId: number
): Promise<{ message: string }> => {
  const response = await api.delete(
    `/competency-standards/${standardId}/certificate-template`
  );
  return response.data;
};

/**
 * Obtener URL de preview del certificado (retorna PDF)
 */
export const getPreviewUrl = (standardId: number): string => {
  const baseURL =
    import.meta.env.VITE_API_URL ||
    (import.meta.env.MODE === 'production'
      ? 'https://evaluaasi-motorv2-api.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api'
      : '/api');
  return `${baseURL}/competency-standards/${standardId}/certificate-template/preview`;
};
