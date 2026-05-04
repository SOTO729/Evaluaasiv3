import { api } from './api'

export interface OfficeApp {
  id: number
  app_name: string
  app_type: string  // examen, simulador, parcial
  min_version: string | null
  latest_version: string | null
  download_url: string | null
  is_active: boolean
  updated_at: string | null
}

export interface OfficeAppsResponse {
  apps: OfficeApp[]
  total: number
}

export const downloadsService = {
  /** Lista las aplicaciones Office disponibles para descarga */
  async getOfficeApps(): Promise<OfficeAppsResponse> {
    const { data } = await api.get('/downloads/office-apps')
    return data
  },

  /** (Admin) Crear o actualizar un registro de app */
  async createOfficeApp(appData: Partial<OfficeApp>): Promise<{ app: OfficeApp; message: string }> {
    const { data } = await api.post('/downloads/office-apps', appData)
    return data
  },

  /** (Admin) Actualizar un registro de app */
  async updateOfficeApp(id: number, appData: Partial<OfficeApp>): Promise<{ app: OfficeApp; message: string }> {
    const { data } = await api.put(`/downloads/office-apps/${id}`, appData)
    return data
  },

  /** (Admin) Desactivar un registro de app */
  async deleteOfficeApp(id: number): Promise<{ message: string }> {
    const { data } = await api.delete(`/downloads/office-apps/${id}`)
    return data
  },

  /** (Admin) Subir archivo binario (EXE/MSI/ZIP) a Azure Blob y obtener URL */
  async uploadOfficeAppFile(
    file: File,
    onProgress?: (pct: number) => void
  ): Promise<{ url: string; filename: string; size_bytes: number }> {
    const form = new FormData()
    form.append('file', file)
    const { data } = await api.post('/downloads/office-apps/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (evt) => {
        if (onProgress && evt.total) {
          onProgress(Math.round((evt.loaded * 100) / evt.total))
        }
      },
    })
    return data
  },
}
