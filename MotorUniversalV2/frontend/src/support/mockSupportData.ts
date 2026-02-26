/**
 * Mock/placeholder data for support preview mode.
 * Used when isSupportPreviewEnabled() returns true so the UI can render
 * without hitting the real API.
 */

import type { SupportTicket, SupportCompany } from '../services/supportService'

export const mockTickets: SupportTicket[] = []

export const mockCompanies: SupportCompany[] = []
