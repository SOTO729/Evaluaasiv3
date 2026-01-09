/**
 * Servicio de Contenidos de Estudio
 * Estructura: Material de Estudio → Sesiones → Temas → (4 elementos)
 */
import api from './api';

// ==================== Tipos ====================

export interface StudyMaterial {
  id: number;
  title: string;
  description?: string;
  image_url?: string;
  is_published: boolean;
  order: number;
  exam_id?: number;
  exam_ids?: number[];
  linked_exams?: { id: number; name: string; version: string }[];
  sessions_count?: number;
  topics_count?: number;
  created_at: string;
  updated_at?: string;
  created_by?: number;
  sessions?: StudySession[];
}

export interface StudySession {
  id: number;
  material_id: number;
  session_number: number;
  title: string;
  description?: string;
  allow_reading?: boolean;
  allow_video?: boolean;
  allow_downloadable?: boolean;
  allow_interactive?: boolean;
  topics_count?: number;
  created_at: string;
  topics?: StudyTopic[];
}

export interface StudyTopic {
  id: number;
  session_id: number;
  title: string;
  description?: string;
  order: number;
  estimated_time_minutes?: number;
  created_at: string;
  // Tipos de contenido permitidos
  allow_reading?: boolean;
  allow_video?: boolean;
  allow_downloadable?: boolean;
  allow_interactive?: boolean;
  // Los 4 elementos
  reading?: StudyReading;
  video?: StudyVideo;
  downloadable_exercise?: StudyDownloadableExercise;
  interactive_exercise?: StudyInteractiveExercise;
}

export interface StudyReading {
  id: number;
  topic_id: number;
  title: string;
  content: string;
  estimated_time_minutes?: number;
  created_at: string;
}

export interface StudyVideo {
  id: number;
  topic_id: number;
  title: string;
  description?: string;
  video_url: string;
  video_type: 'youtube' | 'vimeo' | 'direct';
  thumbnail_url?: string;
  duration_minutes?: number;
  created_at: string;
}

export interface StudyDownloadableExercise {
  id: number;
  topic_id: number;
  title: string;
  description?: string;
  file_url: string;
  file_name: string;
  file_type?: string;
  file_size_bytes?: number;
  created_at: string;
}

export interface StudyInteractiveExercise {
  id: string;
  topic_id: number;
  title: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  steps?: StudyInteractiveExerciseStep[];
}

export interface StudyInteractiveExerciseStep {
  id: string;
  exercise_id: string;
  step_number: number;
  title?: string;
  description?: string;
  image_url?: string;
  image_width?: number;
  image_height?: number;
  actions?: StudyInteractiveExerciseAction[];
}

export interface StudyInteractiveExerciseAction {
  id: string;
  step_id: string;
  action_number: number;
  action_type: 'button' | 'text_input';
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  label?: string;
  placeholder?: string;
  correct_answer?: string;
  is_case_sensitive: boolean;
  scoring_mode: 'exact' | 'contains' | 'regex' | 'similarity' | 'text_cursor' | 'default_cursor';
  on_error_action: 'retry' | 'next_step' | 'show_hint' | 'end_exercise' | 'show_message' | 'next_exercise';
  error_message?: string;
  max_attempts: number;
  text_color?: string;
  font_family?: string;
  label_style?: 'invisible' | 'text_only' | 'text_with_shadow' | 'shadow_only';
}

// Interfaces para crear/actualizar
export interface CreateMaterialData {
  title: string;
  description?: string;
  image_url?: string;
  is_published?: boolean;
  order?: number;
  exam_id?: number;
  exam_ids?: number[];
}

export interface CreateSessionData {
  title: string;
  description?: string;
  session_number?: number;
  allow_reading?: boolean;
  allow_video?: boolean;
  allow_downloadable?: boolean;
  allow_interactive?: boolean;
}

export interface CreateTopicData {
  title: string;
  description?: string;
  order?: number;
  estimated_time_minutes?: number;
  allow_reading?: boolean;
  allow_video?: boolean;
  allow_downloadable?: boolean;
  allow_interactive?: boolean;
}

export interface CreateReadingData {
  title: string;
  content: string;
  estimated_time_minutes?: number;
}

export interface CreateVideoData {
  title: string;
  description?: string;
  video_url: string;
  video_type?: 'youtube' | 'vimeo' | 'direct';
  thumbnail_url?: string;
  duration_minutes?: number;
}

export interface CreateDownloadableData {
  title: string;
  description?: string;
  file_url: string;
  file_name: string;
  file_type?: string;
  file_size_bytes?: number;
}

export interface CreateInteractiveData {
  title?: string;
  description?: string;
}

export interface CreateStepData {
  title?: string;
  description?: string;
  step_number?: number;
  image_url?: string;
  image_width?: number;
  image_height?: number;
}

export interface CreateActionData {
  action_type?: 'button' | 'text_input';
  action_number?: number;
  position_x?: number;
  position_y?: number;
  width?: number;
  height?: number;
  label?: string;
  placeholder?: string;
  correct_answer?: string;
  is_case_sensitive?: boolean;
  scoring_mode?: 'exact' | 'contains' | 'regex' | 'similarity' | 'text_cursor' | 'default_cursor';
  on_error_action?: 'retry' | 'next_step' | 'show_hint' | 'end_exercise' | 'show_message' | 'next_exercise';
  error_message?: string;
  max_attempts?: number;
  text_color?: string;
  font_family?: string;
  label_style?: 'invisible' | 'text_only' | 'text_with_shadow' | 'shadow_only';
}

// Interfaces de respuesta
export interface MaterialsResponse {
  materials: StudyMaterial[];
  total: number;
  pages: number;
  current_page: number;
}

// ==================== Servicios de Materiales ====================

export const getMaterials = async (
  page: number = 1,
  perPage: number = 10,
  search: string = ''
): Promise<MaterialsResponse> => {
  const params = new URLSearchParams({
    page: page.toString(),
    per_page: perPage.toString(),
  });
  if (search) params.append('search', search);
  
  const response = await api.get(`/study-contents?${params}`);
  return response.data;
};

export const getMaterial = async (materialId: number): Promise<StudyMaterial> => {
  const response = await api.get(`/study-contents/${materialId}`);
  return response.data;
};

export const createMaterial = async (data: CreateMaterialData): Promise<StudyMaterial> => {
  const response = await api.post('/study-contents', data);
  return response.data.material;
};

export const updateMaterial = async (
  materialId: number,
  data: Partial<CreateMaterialData>
): Promise<StudyMaterial> => {
  const response = await api.put(`/study-contents/${materialId}`, data);
  return response.data.material;
};

export const deleteMaterial = async (materialId: number): Promise<void> => {
  await api.delete(`/study-contents/${materialId}`);
};

// Subir imagen de portada para material de estudio
export const uploadMaterialCoverImage = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append('image', file);
  
  // Usar la instancia api que maneja refresh token automáticamente
  // El interceptor elimina Content-Type cuando detecta FormData
  const response = await api.post('/study-contents/upload-cover-image', formData);
  
  return response.data.url;
};

// ==================== Servicios de Sesiones ====================

export const getSessions = async (materialId: number): Promise<StudySession[]> => {
  const response = await api.get(`/study-contents/${materialId}/sessions`);
  return response.data;
};

export const getSession = async (
  materialId: number,
  sessionId: number
): Promise<StudySession> => {
  const response = await api.get(`/study-contents/${materialId}/sessions/${sessionId}`);
  return response.data;
};

export const createSession = async (
  materialId: number,
  data: CreateSessionData
): Promise<StudySession> => {
  const response = await api.post(`/study-contents/${materialId}/sessions`, data);
  return response.data.session;
};

export const updateSession = async (
  materialId: number,
  sessionId: number,
  data: Partial<CreateSessionData>
): Promise<StudySession> => {
  const response = await api.put(`/study-contents/${materialId}/sessions/${sessionId}`, data);
  return response.data.session;
};

export const deleteSession = async (materialId: number, sessionId: number): Promise<void> => {
  await api.delete(`/study-contents/${materialId}/sessions/${sessionId}`);
};

// ==================== Servicios de Temas ====================

export const getTopics = async (
  materialId: number,
  sessionId: number
): Promise<StudyTopic[]> => {
  const response = await api.get(
    `/study-contents/${materialId}/sessions/${sessionId}/topics`
  );
  return response.data;
};

export const getTopic = async (
  materialId: number,
  sessionId: number,
  topicId: number
): Promise<StudyTopic> => {
  const response = await api.get(
    `/study-contents/${materialId}/sessions/${sessionId}/topics/${topicId}`
  );
  return response.data;
};

export const createTopic = async (
  materialId: number,
  sessionId: number,
  data: CreateTopicData
): Promise<StudyTopic> => {
  console.log('Creating topic with data:', JSON.stringify(data, null, 2));
  const response = await api.post(
    `/study-contents/${materialId}/sessions/${sessionId}/topics`,
    data
  );
  return response.data.topic;
};

export const updateTopic = async (
  materialId: number,
  sessionId: number,
  topicId: number,
  data: Partial<CreateTopicData>
): Promise<StudyTopic> => {
  const response = await api.put(
    `/study-contents/${materialId}/sessions/${sessionId}/topics/${topicId}`,
    data
  );
  return response.data.topic;
};

export const deleteTopic = async (
  materialId: number,
  sessionId: number,
  topicId: number
): Promise<void> => {
  await api.delete(
    `/study-contents/${materialId}/sessions/${sessionId}/topics/${topicId}`
  );
};

// ==================== Servicios de Elementos ====================

// --- Lectura ---
export const upsertReading = async (
  materialId: number,
  sessionId: number,
  topicId: number,
  data: CreateReadingData
): Promise<StudyReading> => {
  const response = await api.post(
    `/study-contents/${materialId}/sessions/${sessionId}/topics/${topicId}/reading`,
    data
  );
  return response.data.reading;
};

export const deleteReading = async (
  materialId: number,
  sessionId: number,
  topicId: number
): Promise<void> => {
  await api.delete(
    `/study-contents/${materialId}/sessions/${sessionId}/topics/${topicId}/reading`
  );
};

// --- Video ---
export const upsertVideo = async (
  materialId: number,
  sessionId: number,
  topicId: number,
  data: CreateVideoData
): Promise<StudyVideo> => {
  const response = await api.post(
    `/study-contents/${materialId}/sessions/${sessionId}/topics/${topicId}/video`,
    data
  );
  return response.data.video;
};

export const uploadVideo = async (
  materialId: number,
  sessionId: number,
  topicId: number,
  file: File,
  title: string,
  description?: string,
  durationMinutes?: number,
  onProgress?: (progress: number) => void
): Promise<StudyVideo> => {
  // Paso 1: Obtener URL de subida con SAS token del backend
  const sasResponse = await api.post(
    `/study-contents/${materialId}/sessions/${sessionId}/topics/${topicId}/video/get-upload-url`,
    { filename: file.name }
  );
  
  const { upload_url, download_url } = sasResponse.data;
  
  // Paso 2: Subir directamente a Azure Blob Storage (sin límite de tamaño)
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', upload_url, true);
    xhr.setRequestHeader('x-ms-blob-type', 'BlockBlob');
    xhr.setRequestHeader('Content-Type', file.type || 'video/mp4');
    
    xhr.upload.onprogress = (event) => {
      if (onProgress && event.lengthComputable) {
        const progress = Math.round((event.loaded * 100) / event.total);
        onProgress(progress);
      }
    };
    
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Error al subir: ${xhr.status} ${xhr.statusText}`));
      }
    };
    
    xhr.onerror = () => reject(new Error('Error de red al subir el video'));
    xhr.ontimeout = () => reject(new Error('Tiempo de espera agotado'));
    xhr.timeout = 1800000; // 30 minutos
    
    xhr.send(file);
  });
  
  // Paso 3: Confirmar en el backend
  const confirmResponse = await api.post(
    `/study-contents/${materialId}/sessions/${sessionId}/topics/${topicId}/video/confirm-upload`,
    {
      video_url: download_url,
      title,
      description: description || '',
      duration_minutes: durationMinutes || 0
    }
  );
  
  return confirmResponse.data.video;
};

export const deleteVideo = async (
  materialId: number,
  sessionId: number,
  topicId: number
): Promise<void> => {
  await api.delete(
    `/study-contents/${materialId}/sessions/${sessionId}/topics/${topicId}/video`
  );
};

/**
 * Obtener URL de video con SAS token fresco (válido por 24 horas)
 * Usar este endpoint antes de reproducir videos de Azure Blob Storage
 */
export interface VideoSignedUrlResponse {
  video_url: string;
  video_type: string;
  requires_refresh: boolean;
  expires_in_hours?: number;
}

export const getVideoSignedUrl = async (videoId: number): Promise<VideoSignedUrlResponse> => {
  const response = await api.get(`/study-contents/video-url/${videoId}`);
  return response.data;
};

export const getVideoSignedUrlByTopic = async (topicId: number): Promise<VideoSignedUrlResponse> => {
  const response = await api.get(`/study-contents/video-url-by-topic/${topicId}`);
  return response.data;
};

// --- Ejercicio Descargable ---
export const upsertDownloadable = async (
  materialId: number,
  sessionId: number,
  topicId: number,
  data: CreateDownloadableData
): Promise<StudyDownloadableExercise> => {
  const response = await api.post(
    `/study-contents/${materialId}/sessions/${sessionId}/topics/${topicId}/downloadable`,
    data
  );
  return response.data.downloadable_exercise;
};

export const deleteDownloadable = async (
  materialId: number,
  sessionId: number,
  topicId: number
): Promise<void> => {
  await api.delete(
    `/study-contents/${materialId}/sessions/${sessionId}/topics/${topicId}/downloadable`
  );
};

export const updateDownloadable = async (
  materialId: number,
  sessionId: number,
  topicId: number,
  data: { title: string; description?: string }
): Promise<StudyDownloadableExercise> => {
  const response = await api.put(
    `/study-contents/${materialId}/sessions/${sessionId}/topics/${topicId}/downloadable`,
    data
  );
  return response.data.downloadable_exercise;
};

export const uploadDownloadable = async (
  materialId: number,
  sessionId: number,
  topicId: number,
  files: File[],
  title: string,
  description?: string,
  onProgress?: (progress: number) => void
): Promise<StudyDownloadableExercise> => {
  const formData = new FormData();
  
  // Agregar archivos (soporta múltiples)
  files.forEach((file) => {
    formData.append('files', file);
  });
  
  formData.append('title', title);
  if (description) formData.append('description', description);
  
  const response = await api.post(
    `/study-contents/${materialId}/sessions/${sessionId}/topics/${topicId}/downloadable/upload`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
    }
  );
  return response.data.downloadable_exercise;
};

// --- Ejercicio Interactivo ---
export const createInteractive = async (
  materialId: number,
  sessionId: number,
  topicId: number,
  data: CreateInteractiveData
): Promise<StudyInteractiveExercise> => {
  const response = await api.post(
    `/study-contents/${materialId}/sessions/${sessionId}/topics/${topicId}/interactive`,
    data
  );
  return response.data.interactive_exercise;
};

export const updateInteractive = async (
  materialId: number,
  sessionId: number,
  topicId: number,
  data: Partial<CreateInteractiveData & { is_active?: boolean }>
): Promise<StudyInteractiveExercise> => {
  const response = await api.put(
    `/study-contents/${materialId}/sessions/${sessionId}/topics/${topicId}/interactive`,
    data
  );
  return response.data.interactive_exercise;
};

export const deleteInteractive = async (
  materialId: number,
  sessionId: number,
  topicId: number
): Promise<void> => {
  await api.delete(
    `/study-contents/${materialId}/sessions/${sessionId}/topics/${topicId}/interactive`
  );
};

// ==================== Servicios de Pasos y Acciones ====================

export const createStep = async (
  materialId: number,
  sessionId: number,
  topicId: number,
  data: CreateStepData
): Promise<StudyInteractiveExerciseStep> => {
  const response = await api.post(
    `/study-contents/${materialId}/sessions/${sessionId}/topics/${topicId}/interactive/steps`,
    data
  );
  return response.data.step;
};

export const updateStep = async (
  materialId: number,
  sessionId: number,
  topicId: number,
  stepId: string,
  data: Partial<CreateStepData>
): Promise<StudyInteractiveExerciseStep> => {
  const response = await api.put(
    `/study-contents/${materialId}/sessions/${sessionId}/topics/${topicId}/interactive/steps/${stepId}`,
    data
  );
  return response.data.step;
};

export const deleteStep = async (
  materialId: number,
  sessionId: number,
  topicId: number,
  stepId: string
): Promise<void> => {
  await api.delete(
    `/study-contents/${materialId}/sessions/${sessionId}/topics/${topicId}/interactive/steps/${stepId}`
  );
};

export interface ActionMutationResponse {
  action: StudyInteractiveExerciseAction;
  all_actions?: StudyInteractiveExerciseAction[];
}

export const createAction = async (
  materialId: number,
  sessionId: number,
  topicId: number,
  stepId: string,
  data: CreateActionData
): Promise<ActionMutationResponse> => {
  const response = await api.post(
    `/study-contents/${materialId}/sessions/${sessionId}/topics/${topicId}/interactive/steps/${stepId}/actions`,
    data
  );
  return response.data;
};

export const updateAction = async (
  materialId: number,
  sessionId: number,
  topicId: number,
  stepId: string,
  actionId: string,
  data: Partial<CreateActionData>
): Promise<ActionMutationResponse> => {
  const response = await api.put(
    `/study-contents/${materialId}/sessions/${sessionId}/topics/${topicId}/interactive/steps/${stepId}/actions/${actionId}`,
    data
  );
  return response.data;
};

export const deleteAction = async (
  materialId: number,
  sessionId: number,
  topicId: number,
  stepId: string,
  actionId: string
): Promise<void> => {
  await api.delete(
    `/study-contents/${materialId}/sessions/${sessionId}/topics/${topicId}/interactive/steps/${stepId}/actions/${actionId}`
  );
};

// ==================== Progreso del Estudiante ====================

export interface ContentProgress {
  is_completed: boolean;
  score?: number;
  completed_at?: string;
}

export interface TopicProgressData {
  total_contents: number;
  completed_contents: number;
  progress_percentage: number;
  is_completed: boolean;
}

export interface TopicProgressResponse {
  topic_progress: TopicProgressData;
  content_progress: {
    reading: Record<number, ContentProgress>;
    video: Record<number, ContentProgress>;
    downloadable: Record<number, ContentProgress>;
    interactive: Record<number, ContentProgress>;
  };
}

export interface MaterialProgressResponse {
  material_id: number;
  title: string;
  total_contents: number;
  completed_contents: number;
  progress_percentage: number;
  sessions: Array<{
    session_id: number;
    session_number: number;
    title: string;
    topics: Array<{
      topic_id: number;
      topic_number: number;
      title: string;
      progress: TopicProgressData;
      completed_contents: {
        reading: number[];
        video: number[];
        downloadable: number[];
        interactive: string[];
      };
      interactive_scores?: Record<string, number>;
    }>;
  }>;
  all_completed_contents: {
    reading: number[];
    video: number[];
    downloadable: number[];
    interactive: string[];
  };
  interactive_scores?: Record<string, number>;
}

/**
 * Registrar progreso de un contenido específico
 */
export const registerContentProgress = async (
  contentType: 'reading' | 'video' | 'downloadable' | 'interactive',
  contentId: number | string,
  data: { is_completed?: boolean; score?: number }
): Promise<{ message: string; progress: ContentProgress }> => {
  const response = await api.post(`/study-contents/progress/${contentType}/${contentId}`, data);
  return response.data;
};

/**
 * Obtener progreso de un tema específico
 */
export const getTopicProgress = async (topicId: number): Promise<TopicProgressResponse> => {
  const response = await api.get(`/study-contents/progress/topic/${topicId}`);
  return response.data;
};

/**
 * Obtener progreso de todo el material de estudio
 */
export const getMaterialProgress = async (materialId: number): Promise<MaterialProgressResponse> => {
  const response = await api.get(`/study-contents/progress/material/${materialId}`);
  return response.data;
};

// Exportar todo como default también
export default {
  // Materiales
  getMaterials,
  getMaterial,
  createMaterial,
  updateMaterial,
  deleteMaterial,
  // Sesiones
  getSessions,
  getSession,
  createSession,
  updateSession,
  deleteSession,
  // Temas
  getTopics,
  getTopic,
  createTopic,
  updateTopic,
  deleteTopic,
  // Elementos
  upsertReading,
  deleteReading,
  upsertVideo,
  uploadVideo,
  deleteVideo,
  upsertDownloadable,
  uploadDownloadable,
  updateDownloadable,
  deleteDownloadable,
  createInteractive,
  updateInteractive,
  deleteInteractive,
  // Pasos y Acciones
  createStep,
  updateStep,
  deleteStep,
  createAction,
  updateAction,
  deleteAction,
  // Progreso del estudiante
  registerContentProgress,
  getTopicProgress,
  getMaterialProgress,
};
