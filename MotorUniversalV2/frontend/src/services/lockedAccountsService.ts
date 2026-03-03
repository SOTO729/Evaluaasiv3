import api from './api'

export interface LockedAccountUser {
  id: number
  name: string
  email: string
  username: string
  role: string
  is_active: boolean
}

export interface LockedAccount {
  username: string
  remaining_seconds: number
  remaining_minutes: number
  failed_attempts: number
  unlock_time: string
  user: LockedAccountUser | null
}

export interface FailedAttempt {
  username: string
  failed_attempts: number
  is_locked: boolean
  remaining_seconds: number | null
  user: LockedAccountUser | null
}

export interface LockoutConfig {
  max_attempts: number
  lockout_duration_seconds: number
  lockout_duration_minutes: number
}

export interface LockedAccountsResponse {
  locked_accounts: LockedAccount[]
  failed_attempts: FailedAttempt[]
  config: LockoutConfig
}

export interface UnlockResponse {
  message: string
  user: LockedAccountUser | null
}

export interface UnlockAllResponse {
  message: string
  unlocked_count: number
}

const lockedAccountsService = {
  /**
   * Obtener todas las cuentas bloqueadas y con intentos fallidos
   */
  async getLockedAccounts(): Promise<LockedAccountsResponse> {
    const response = await api.get('/auth/admin/locked-accounts')
    return response.data
  },

  /**
   * Desbloquear una cuenta específica
   */
  async unlockAccount(username: string): Promise<UnlockResponse> {
    const response = await api.post('/auth/admin/unlock-account', { username })
    return response.data
  },

  /**
   * Desbloquear todas las cuentas bloqueadas
   */
  async unlockAll(): Promise<UnlockAllResponse> {
    const response = await api.post('/auth/admin/unlock-all')
    return response.data
  },
}

export default lockedAccountsService
