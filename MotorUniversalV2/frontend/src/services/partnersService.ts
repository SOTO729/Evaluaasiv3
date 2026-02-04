/**
 * Servicio para gestión de Partners, Planteles y Grupos
 */
import api from './api';

// ============== TIPOS ==============

export interface Partner {
  id: number;
  name: string;
  legal_name?: string;
  rfc?: string;
  country?: string;
  email?: string;
  phone?: string;
  website?: string;
  logo_url?: string;
  is_active: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
  states?: PartnerStatePresence[];
  campuses?: Campus[];
  campus_count?: number;
}

export interface PartnerStatePresence {
  id: number;
  partner_id: number;
  state_name: string;
  regional_contact_name?: string;
  regional_contact_email?: string;
  regional_contact_phone?: string;
  is_active: boolean;
  created_at: string;
}

export interface SchoolCycle {
  id: number;
  campus_id: number;
  name: string;
  cycle_type: 'annual' | 'semester';
  start_date: string;
  end_date: string;
  is_active: boolean;
  is_current: boolean;
  created_at: string;
  updated_at: string;
  groups?: CandidateGroup[];
  group_count?: number;
  campus?: Campus;
}

// Responsable del plantel (usuario con rol 'responsable')
export interface CampusResponsable {
  id: string;
  username: string;
  full_name: string;
  email: string;
  curp?: string;
  gender?: string;
  date_of_birth?: string;
  can_bulk_create_candidates: boolean;
  can_manage_groups: boolean;
  is_active: boolean;
  created_at?: string;
  temporary_password?: string;  // Solo se devuelve al crear
}

export interface Campus {
  id: number;
  partner_id: number;
  code: string;
  name: string;
  country?: string;
  state_name?: string;
  city?: string;
  address?: string;
  postal_code?: string;
  email?: string;
  phone?: string;
  website?: string;
  // Director del plantel (datos completos como candidato)
  director_name?: string;
  director_first_surname?: string;
  director_second_surname?: string;
  director_email?: string;
  director_phone?: string;
  director_curp?: string;
  director_gender?: string;
  director_date_of_birth?: string;
  director_full_name?: string;  // Nombre completo calculado
  // Campos de activación
  responsable_id?: string;
  responsable?: CampusResponsable;
  activation_status: 'pending' | 'configuring' | 'active';
  activated_at?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Campos de configuración
  office_version?: 'office_2016' | 'office_2019' | 'office_365';
  enable_tier_basic?: boolean;
  enable_tier_standard?: boolean;
  enable_tier_advanced?: boolean;
  enable_digital_badge?: boolean;
  enable_partial_evaluations?: boolean;
  enable_unscheduled_partials?: boolean;
  enable_virtual_machines?: boolean;
  enable_online_payments?: boolean;
  license_start_date?: string;
  license_end_date?: string;
  certification_cost?: number;
  retake_cost?: number;
  configuration_completed?: boolean;
  configuration_completed_at?: string;
  // Relaciones
  groups?: CandidateGroup[];
  group_count?: number;
  cycle_count?: number;
  school_cycles?: SchoolCycle[];
  partner?: Partner;
}

export interface CandidateGroup {
  id: number;
  campus_id: number;
  school_cycle_id?: number;
  name: string;
  code?: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  members?: GroupMember[];
  member_count?: number;
  campus?: Campus;
  school_cycle?: SchoolCycle;
  // Configuración
  use_custom_config?: boolean;
  config?: GroupConfigOverrides;
  effective_config?: {
    office_version: string;
    enable_tier_basic: boolean;
    enable_tier_standard: boolean;
    enable_tier_advanced: boolean;
    enable_digital_badge: boolean;
    enable_partial_evaluations: boolean;
    enable_unscheduled_partials: boolean;
    enable_virtual_machines: boolean;
    enable_online_payments: boolean;
    certification_cost: number;
    retake_cost: number;
    license_start_date: string | null;
    license_end_date: string | null;
  };
}

export interface GroupMember {
  id: number;
  group_id: number;
  user_id: string;
  status: 'active' | 'suspended';
  notes?: string;
  joined_at: string;
  // Estado de asignación calculado por el backend
  assignment_status?: 'exam_and_material' | 'exam_only' | 'material_only' | 'none';
  has_exam?: boolean;
  has_material?: boolean;
  // Estado de certificación calculado por el backend
  certification_status?: 'certified' | 'in_progress' | 'failed' | 'pending';
  user?: {
    id: string;
    email: string;
    name: string;
    first_surname: string;
    second_surname?: string;
    full_name: string;
    curp?: string;
    phone?: string;
    is_active: boolean;
  };
  group?: CandidateGroup;
}

export interface CandidateSearchResult {
  id: string;
  email: string;
  name: string;
  first_surname: string;
  second_surname?: string;
  full_name: string;
  curp?: string;
  gender?: string;
  created_at?: string;
  current_group?: {
    group_id: number;
    group_name: string;
    campus_id?: number;
    campus_name?: string;
    state_name?: string;
    city?: string;
    school_cycle_id?: number;
    school_cycle_name?: string;
    partner_id?: number;
    partner_name?: string;
  } | null;
}

export interface DashboardStats {
  stats: {
    total_partners: number;
    total_campuses: number;
    total_groups: number;
    total_members: number;
  };
  partners_by_state: Array<{ state: string; count: number }>;
  recent_groups: CandidateGroup[];
}

// Datos para crear un responsable del plantel
export interface CreateResponsableData {
  name: string;
  first_surname: string;
  second_surname: string;
  email: string;
  curp: string;
  gender: 'M' | 'F' | 'O';
  date_of_birth: string;  // Formato YYYY-MM-DD
  can_bulk_create_candidates?: boolean;
  can_manage_groups?: boolean;
}

// Datos para actualizar un responsable
export interface UpdateResponsableData {
  name?: string;
  first_surname?: string;
  second_surname?: string;
  gender?: string;
  phone?: string;
  can_bulk_create_candidates?: boolean;
  can_manage_groups?: boolean;
  is_active?: boolean;
}

// ============== ESTADOS MEXICANOS ==============

export async function getMexicanStates(): Promise<string[]> {
  const response = await api.get('/partners/mexican-states');
  return response.data.states;
}

export async function getCountries(): Promise<string[]> {
  const response = await api.get('/partners/countries');
  return response.data.countries;
}

// ============== PARTNERS ==============

export async function getPartners(params?: {
  page?: number;
  per_page?: number;
  search?: string;
  active_only?: boolean;
}): Promise<{
  partners: Partner[];
  total: number;
  pages: number;
  current_page: number;
}> {
  const response = await api.get('/partners', { params });
  return response.data;
}

export async function getPartner(partnerId: number): Promise<Partner> {
  const response = await api.get(`/partners/${partnerId}`);
  return response.data.partner;
}

export async function createPartner(data: Partial<Partner>): Promise<Partner> {
  const response = await api.post('/partners', data);
  return response.data.partner;
}

export async function updatePartner(partnerId: number, data: Partial<Partner>): Promise<Partner> {
  const response = await api.put(`/partners/${partnerId}`, data);
  return response.data.partner;
}

export async function deletePartner(partnerId: number): Promise<void> {
  await api.delete(`/partners/${partnerId}`);
}

// ============== PRESENCIA EN ESTADOS ==============

export async function getPartnerStates(partnerId: number): Promise<{
  partner_id: number;
  partner_name: string;
  states: PartnerStatePresence[];
}> {
  const response = await api.get(`/partners/${partnerId}/states`);
  return response.data;
}

export async function addPartnerState(partnerId: number, data: {
  state_name: string;
  regional_contact_name?: string;
  regional_contact_email?: string;
  regional_contact_phone?: string;
}): Promise<PartnerStatePresence> {
  const response = await api.post(`/partners/${partnerId}/states`, data);
  return response.data.presence;
}

export async function removePartnerState(partnerId: number, presenceId: number): Promise<void> {
  await api.delete(`/partners/${partnerId}/states/${presenceId}`);
}

// ============== PLANTELES (CAMPUSES) ==============

export async function getCampuses(partnerId: number, params?: {
  state?: string;
  active_only?: boolean;
}): Promise<{
  partner_id: number;
  partner_name: string;
  campuses: Campus[];
  total: number;
}> {
  const response = await api.get(`/partners/${partnerId}/campuses`, { params });
  return response.data;
}

export async function getCampus(campusId: number): Promise<Campus> {
  const response = await api.get(`/partners/campuses/${campusId}`);
  return response.data.campus;
}

export interface CreateCampusResult {
  campus: Campus;
  message: string;
  state_auto_created: boolean;
  partner_states: PartnerStatePresence[];
}

export async function createCampus(partnerId: number, data: Partial<Campus>): Promise<CreateCampusResult> {
  const response = await api.post(`/partners/${partnerId}/campuses`, data);
  return {
    campus: response.data.campus,
    message: response.data.message,
    state_auto_created: response.data.state_auto_created || false,
    partner_states: response.data.partner_states || [],
  };
}

export async function updateCampus(campusId: number, data: Partial<Campus>): Promise<Campus> {
  const response = await api.put(`/partners/campuses/${campusId}`, data);
  return response.data.campus;
}

export async function deleteCampus(campusId: number): Promise<void> {
  await api.delete(`/partners/campuses/${campusId}`);
}

// ============== ACTIVACIÓN DE PLANTEL - RESPONSABLE ==============

export async function getCampusResponsable(campusId: number): Promise<{
  responsable: CampusResponsable | null;
  activation_status: string;
}> {
  const response = await api.get(`/partners/campuses/${campusId}/responsable`);
  return response.data;
}

export async function createCampusResponsable(
  campusId: number, 
  data: CreateResponsableData
): Promise<{
  message: string;
  responsable: CampusResponsable;
  campus: {
    id: number;
    name: string;
    code: string;
    activation_status: string;
  };
}> {
  const response = await api.post(`/partners/campuses/${campusId}/responsable`, data);
  return response.data;
}

export async function updateCampusResponsable(
  campusId: number,
  data: UpdateResponsableData
): Promise<{
  message: string;
  responsable: CampusResponsable;
}> {
  const response = await api.put(`/partners/campuses/${campusId}/responsable`, data);
  return response.data;
}

export async function activateCampus(campusId: number): Promise<{
  message: string;
  campus: Campus;
}> {
  const response = await api.post(`/partners/campuses/${campusId}/activate`);
  return response.data;
}

export async function deactivateCampus(campusId: number): Promise<{
  message: string;
  campus: Campus;
}> {
  const response = await api.post(`/partners/campuses/${campusId}/deactivate`);
  return response.data;
}

// ============== CONFIGURACIÓN DE PLANTEL ==============

export type OfficeVersion = 'office_2016' | 'office_2019' | 'office_365';

export interface CampusConfiguration {
  // Versión de Office
  office_version: OfficeVersion;
  
  // Niveles de certificación disponibles
  enable_tier_basic: boolean;      // Constancia de participación (Eduit)
  enable_tier_standard: boolean;   // Certificado Eduit oficial
  enable_tier_advanced: boolean;   // Certificado CONOCER
  enable_digital_badge: boolean;   // Insignia Digital
  
  // Evaluaciones parciales
  enable_partial_evaluations: boolean;  // Habilitar parciales
  enable_unscheduled_partials: boolean; // Parciales sin agendar (alumno selecciona)
  
  // Características adicionales
  enable_virtual_machines: boolean;  // Máquinas virtuales para exámenes
  enable_online_payments: boolean;   // Pagos en línea
  
  // Vigencia
  license_start_date: string | null;  // Fecha inicio de licencia
  license_end_date: string | null;    // Fecha fin de licencia
  
  // Costos
  certification_cost: number;  // Costo por certificación
  retake_cost: number;         // Costo por retoma
  
  // Estado de configuración
  configuration_completed?: boolean;
  configuration_completed_at?: string;
}

export interface ConfigureCampusRequest {
  office_version?: OfficeVersion;
  enable_tier_basic?: boolean;
  enable_tier_standard?: boolean;
  enable_tier_advanced?: boolean;
  enable_digital_badge?: boolean;
  enable_partial_evaluations?: boolean;
  enable_unscheduled_partials?: boolean;
  enable_virtual_machines?: boolean;
  enable_online_payments?: boolean;
  license_start_date?: string | null;
  license_end_date?: string | null;
  certification_cost?: number;
  retake_cost?: number;
  complete_configuration?: boolean;  // Marcar configuración como completada
}

/**
 * Obtiene la configuración actual de un plantel
 */
export async function getCampusConfiguration(campusId: number): Promise<{
  campus_id: number;
  campus_name: string;
  configuration: CampusConfiguration;
}> {
  const response = await api.get(`/partners/campuses/${campusId}/config`);
  return response.data;
}

/**
 * Configura un plantel (versión de Office, tiers, parciales, etc.)
 */
export async function configureCampus(campusId: number, data: ConfigureCampusRequest): Promise<{
  message: string;
  campus: Campus;
  configuration: CampusConfiguration;
}> {
  const response = await api.post(`/partners/campuses/${campusId}/configure`, data);
  return response.data;
}

// ============== CICLOS ESCOLARES ==============

export async function getSchoolCycles(campusId: number, params?: {
  active_only?: boolean;
}): Promise<{
  cycles: SchoolCycle[];
  total: number;
}> {
  const response = await api.get(`/partners/campuses/${campusId}/cycles`, { params });
  return response.data;
}

export async function getSchoolCycle(cycleId: number): Promise<SchoolCycle> {
  const response = await api.get(`/partners/cycles/${cycleId}`);
  return response.data.cycle;
}

export async function createSchoolCycle(campusId: number, data: {
  name: string;
  cycle_type: 'annual' | 'semester';
  start_date: string;
  end_date: string;
  is_current?: boolean;
}): Promise<SchoolCycle> {
  const response = await api.post(`/partners/campuses/${campusId}/cycles`, data);
  return response.data.cycle;
}

export async function updateSchoolCycle(cycleId: number, data: Partial<SchoolCycle>): Promise<SchoolCycle> {
  const response = await api.put(`/partners/cycles/${cycleId}`, data);
  return response.data.cycle;
}

export async function deleteSchoolCycle(cycleId: number): Promise<void> {
  await api.delete(`/partners/cycles/${cycleId}`);
}

// ============== GRUPOS ==============

export async function getGroups(campusId: number, params?: {
  active_only?: boolean;
  cycle_id?: number;
}): Promise<{
  campus_id: number;
  campus_name: string;
  groups: CandidateGroup[];
  total: number;
}> {
  const response = await api.get(`/partners/campuses/${campusId}/groups`, { params });
  return response.data;
}

export async function getGroup(groupId: number): Promise<CandidateGroup> {
  const response = await api.get(`/partners/groups/${groupId}`);
  return response.data.group;
}

export async function createGroup(campusId: number, data: Partial<CandidateGroup>): Promise<CandidateGroup> {
  const response = await api.post(`/partners/campuses/${campusId}/groups`, data);
  return response.data.group;
}

export async function updateGroup(groupId: number, data: Partial<CandidateGroup>): Promise<CandidateGroup> {
  const response = await api.put(`/partners/groups/${groupId}`, data);
  return response.data.group;
}

export async function deleteGroup(groupId: number): Promise<void> {
  await api.delete(`/partners/groups/${groupId}`);
}

// ============== CONFIGURACIÓN DE GRUPO ==============

export interface GroupConfigOverrides {
  office_version_override?: string | null;
  enable_tier_basic_override?: boolean | null;
  enable_tier_standard_override?: boolean | null;
  enable_tier_advanced_override?: boolean | null;
  enable_digital_badge_override?: boolean | null;
  enable_partial_evaluations_override?: boolean | null;
  enable_unscheduled_partials_override?: boolean | null;
  enable_virtual_machines_override?: boolean | null;
  enable_online_payments_override?: boolean | null;
  certification_cost_override?: number | null;
  retake_cost_override?: number | null;
  group_start_date?: string | null;
  group_end_date?: string | null;
}

export interface GroupConfigResponse {
  group_id: number;
  group_name: string;
  campus_id: number;
  campus_name: string;
  use_custom_config: boolean;
  campus_config: {
    office_version: string;
    enable_tier_basic: boolean;
    enable_tier_standard: boolean;
    enable_tier_advanced: boolean;
    enable_digital_badge: boolean;
    enable_partial_evaluations: boolean;
    enable_unscheduled_partials: boolean;
    enable_virtual_machines: boolean;
    enable_online_payments: boolean;
    certification_cost: number;
    retake_cost: number;
    license_start_date: string | null;
    license_end_date: string | null;
  };
  group_overrides: GroupConfigOverrides;
  effective_config: {
    office_version: string;
    enable_tier_basic: boolean;
    enable_tier_standard: boolean;
    enable_tier_advanced: boolean;
    enable_digital_badge: boolean;
    enable_partial_evaluations: boolean;
    enable_unscheduled_partials: boolean;
    enable_virtual_machines: boolean;
    enable_online_payments: boolean;
    certification_cost: number;
    retake_cost: number;
    start_date: string | null;
    end_date: string | null;
  };
}

export async function getGroupConfig(groupId: number): Promise<GroupConfigResponse> {
  const response = await api.get(`/partners/groups/${groupId}/config`);
  return response.data;
}

export async function updateGroupConfig(groupId: number, data: GroupConfigOverrides & { use_custom_config?: boolean }): Promise<{
  message: string;
  group: CandidateGroup;
}> {
  const response = await api.put(`/partners/groups/${groupId}/config`, data);
  return response.data;
}

export async function resetGroupConfig(groupId: number): Promise<{
  message: string;
  group: CandidateGroup;
}> {
  const response = await api.post(`/partners/groups/${groupId}/config/reset`);
  return response.data;
}

// ============== MIEMBROS DE GRUPO ==============

export async function getGroupMembers(groupId: number, params?: {
  status?: string;
}): Promise<{
  group_id: number;
  group_name: string;
  members: GroupMember[];
  total: number;
}> {
  const response = await api.get(`/partners/groups/${groupId}/members`, { params });
  return response.data;
}

export async function addGroupMember(groupId: number, data: {
  user_id: string;
  status?: string;
  notes?: string;
}): Promise<GroupMember> {
  const response = await api.post(`/partners/groups/${groupId}/members`, data);
  return response.data.member;
}

export async function addGroupMembersBulk(groupId: number, userIds: string[]): Promise<{
  message: string;
  added: string[];
  errors: Array<{ user_id: string; error: string }>;
}> {
  const response = await api.post(`/partners/groups/${groupId}/members/bulk`, { user_ids: userIds });
  return response.data;
}

export async function updateGroupMember(groupId: number, memberId: number, data: {
  status?: string;
  notes?: string;
}): Promise<GroupMember> {
  const response = await api.put(`/partners/groups/${groupId}/members/${memberId}`, data);
  return response.data.member;
}

export async function removeGroupMember(groupId: number, memberId: number): Promise<void> {
  await api.delete(`/partners/groups/${groupId}/members/${memberId}`);
}

// ============== BÚSQUEDA DE CANDIDATOS ==============

export async function searchCandidates(params: {
  search?: string;
  search_field?: string;
  exclude_group_id?: number;
  page?: number;
  per_page?: number;
}): Promise<{
  candidates: CandidateSearchResult[];
  total: number;
  pages: number;
  current_page: number;
}> {
  const response = await api.get('/partners/candidates/search', { params });
  return response.data;
}

// ============== ASIGNACIÓN MASIVA DE CANDIDATOS ==============

export async function downloadGroupMembersTemplate(): Promise<void> {
  const response = await api.get('/partners/groups/members/template', {
    responseType: 'blob'
  });
  
  // Crear link de descarga
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'plantilla_asignacion_candidatos.xlsx');
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function uploadGroupMembersExcel(
  groupId: number, 
  file: File, 
  mode: 'move' | 'add' = 'add'
): Promise<{
  message: string;
  added: string[];
  moved: Array<{ identifier: string; from_group: string }>;
  errors: Array<{ identifier: string; error: string }>;
  total_processed: number;
  mode: string;
}> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('mode', mode);
  
  const response = await api.post(`/partners/groups/${groupId}/members/upload`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return response.data;
}

// ============== PREVIEW EXCEL ANTES DE ASIGNAR ==============

export interface ExcelPreviewRow {
  row: number;
  identifier: string;
  notes?: string;
  status: 'ready' | 'already_member' | 'not_found' | 'capacity_exceeded';
  error?: string;
  user?: {
    id: string;
    email: string;
    name: string;
    first_surname: string;
    second_surname?: string;
    full_name: string;
    curp?: string;
    gender?: string;
  };
}

export interface ExcelPreviewResult {
  group_name: string;
  current_members: number;
  preview: ExcelPreviewRow[];
  summary: {
    total: number;
    ready: number;
    already_member: number;
    not_found: number;
  };
  can_proceed: boolean;
}

export async function previewGroupMembersExcel(groupId: number, file: File): Promise<ExcelPreviewResult> {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await api.post(`/partners/groups/${groupId}/members/upload/preview`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return response.data;
}

// ============== MOVER CANDIDATOS ENTRE GRUPOS ==============

export interface MoveMembersResult {
  message: string;
  moved: Array<{ user_id: string; name: string; email: string }>;
  errors: Array<{ user_id: string; name: string; error: string }>;
  source_group: string;
  target_group: string;
}

export async function moveMembersToGroup(
  sourceGroupId: number,
  targetGroupId: number,
  userIds: string[]
): Promise<MoveMembersResult> {
  const response = await api.post(`/partners/groups/${sourceGroupId}/members/move`, {
    target_group_id: targetGroupId,
    user_ids: userIds
  });
  return response.data;
}

// ============== BÚSQUEDA AVANZADA DE CANDIDATOS ==============

export interface AdvancedSearchParams {
  search?: string;
  search_field?: string;
  page?: number;
  per_page?: number;
  has_group?: 'yes' | 'no';
  group_id?: number;
  exclude_group_id?: number;
  partner_id?: number;
  campus_id?: number;
  state?: string;
  gender?: string;
  sort_by?: 'name' | 'recent';
}

export async function searchCandidatesAdvanced(params: AdvancedSearchParams): Promise<{
  candidates: CandidateSearchResult[];
  total: number;
  pages: number;
  current_page: number;
  filters_applied: AdvancedSearchParams;
}> {
  const response = await api.get('/partners/candidates/search/advanced', { params });
  return response.data;
}

// ============== LISTAR TODOS LOS GRUPOS (PARA SELECTORES) ==============

export interface GroupListItem {
  id: number;
  name: string;
  campus_name?: string;
  partner_name?: string;
  current_members: number;
}

export async function listAllGroups(): Promise<{
  groups: GroupListItem[];
  total: number;
}> {
  const response = await api.get('/partners/groups/list-all');
  return response.data;
}

// ============== DASHBOARD ==============

export async function getPartnersDashboard(): Promise<DashboardStats> {
  const response = await api.get('/partners/dashboard');
  return response.data;
}

// ============== ASOCIACIÓN USUARIO-PARTNER ==============

export interface UserPartnerInfo {
  id: string;
  email: string;
  name: string;
  first_surname: string;
  second_surname?: string;
  full_name: string;
  role: string;
  is_active: boolean;
  curp?: string;
  phone?: string;
  partners?: Array<{ id: number; name: string; logo_url?: string }>;
}

export interface UserPartnerDetail {
  user_id: string;
  user_name: string;
  partners: Array<Partner & {
    user_groups: Array<{
      group: CandidateGroup;
      campus: Campus;
      membership_status: string;
      joined_at: string;
    }>;
  }>;
  total: number;
}

export async function getPartnerUsers(partnerId: number, params?: {
  page?: number;
  per_page?: number;
  search?: string;
}): Promise<{
  partner_id: number;
  partner_name: string;
  users: UserPartnerInfo[];
  total: number;
  pages: number;
  current_page: number;
}> {
  const response = await api.get(`/partners/${partnerId}/users`, { params });
  return response.data;
}

export async function addUserToPartner(partnerId: number, userId: string): Promise<{
  message: string;
  user: UserPartnerInfo;
}> {
  const response = await api.post(`/partners/${partnerId}/users/${userId}`);
  return response.data;
}

export async function removeUserFromPartner(partnerId: number, userId: string): Promise<void> {
  await api.delete(`/partners/${partnerId}/users/${userId}`);
}

export async function getUserPartners(userId: string): Promise<UserPartnerDetail> {
  const response = await api.get(`/partners/users/${userId}/partners`);
  return response.data;
}

export async function setUserPartners(userId: string, partnerIds: number[]): Promise<{
  message: string;
  user: UserPartnerInfo;
}> {
  const response = await api.post(`/partners/users/${userId}/partners`, { partner_ids: partnerIds });
  return response.data;
}

// ============== ENDPOINTS PARA CANDIDATOS (MIS PARTNERS) ==============

export interface MyPartnerInfo {
  id: number;
  name: string;
  logo_url?: string;
  email?: string;
  phone?: string;
  website?: string;
  states: string[];
  my_groups: Array<{
    group_id: number;
    group_name: string;
    campus_id: number;
    campus_name: string;
    campus_city?: string;
    state_name: string;
    joined_at?: string;
  }>;
}

export interface AvailablePartner {
  id: number;
  name: string;
  logo_url?: string;
  is_linked: boolean;
  states: string[];
}

/**
 * Obtener los partners a los que está ligado el candidato actual
 */
export async function getMyPartners(): Promise<{
  partners: MyPartnerInfo[];
  total: number;
}> {
  const response = await api.get('/partners/my-partners');
  return response.data;
}

/**
 * Obtener lista de partners disponibles para ligarse
 */
export async function getAvailablePartners(): Promise<{
  partners: AvailablePartner[];
  total: number;
}> {
  const response = await api.get('/partners/available');
  return response.data;
}

/**
 * Ligarse a un partner
 */
export async function linkToPartner(partnerId: number): Promise<{
  message: string;
  partner: { id: number; name: string; logo_url?: string };
}> {
  const response = await api.post(`/partners/my-partners/${partnerId}`);
  return response.data;
}

/**
 * Desligarse de un partner
 */
export async function unlinkFromPartner(partnerId: number): Promise<{
  message: string;
}> {
  const response = await api.delete(`/partners/my-partners/${partnerId}`);
  return response.data;
}


// ============== EXÁMENES ASIGNADOS A GRUPOS ==============

export type ExamContentType = 'questions_only' | 'exercises_only' | 'mixed';

export interface GroupExamAssignment {
  id: number;
  group_id: number;
  exam_id: number;
  assigned_at: string;
  assigned_by_id?: string;
  available_from?: string;
  available_until?: string;
  is_active: boolean;
  assignment_type?: 'all' | 'selected';
  assigned_members_count?: number;
  // Configuración del examen
  time_limit_minutes?: number | null;
  passing_score?: number | null;
  max_attempts?: number;
  max_disconnections?: number;
  exam_content_type?: ExamContentType;
  exam?: {
    id: number;
    name: string;
    version?: string;
    standard?: string;
    description?: string;
    duration_minutes: number;
    passing_score: number;
    is_published: boolean;
  };
  study_materials?: Array<{
    id: number;
    title: string;
    description?: string;
    cover_image_url?: string;
  }>;
  assigned_members?: Array<{
    id: number;
    user_id: string;
    assigned_at: string;
    user?: {
      id: string;
      email: string;
      name: string;
      first_surname: string;
      full_name: string;
    };
  }>;
}

export interface ExamAssignmentConfig {
  exam_id: number;
  assignment_type: 'all' | 'selected';
  member_ids?: string[];
  material_ids?: number[];  // IDs de materiales seleccionados
  available_from?: string;
  available_until?: string;
  time_limit_minutes?: number | null;
  passing_score?: number | null;
  max_attempts?: number;
  max_disconnections?: number;
  exam_content_type?: ExamContentType;
  // Configuración de cantidad - Examen
  exam_questions_count?: number | null;
  exam_exercises_count?: number | null;
  // Configuración de cantidad - Simulador
  simulator_questions_count?: number | null;
  simulator_exercises_count?: number | null;
  // PIN solo para examen
  security_pin?: string | null;
  require_security_pin?: boolean;
}

export interface AvailableExam {
  id: number;
  name: string;
  version?: string;
  standard?: string;
  ecm_code?: string;  // Código ECM del estándar de competencia
  ecm_name?: string;  // Nombre del estándar de competencia
  description?: string;
  duration_minutes: number;
  passing_score: number;
  is_published: boolean;
  study_materials_count: number;
  total_questions: number;  // Total de preguntas disponibles
  total_exercises: number;  // Total de ejercicios disponibles
  exam_questions_count: number;  // Preguntas tipo examen
  simulator_questions_count: number;  // Preguntas tipo simulador
  exam_exercises_count: number;  // Ejercicios tipo examen
  simulator_exercises_count: number;  // Ejercicios tipo simulador
  is_assigned_to_group?: boolean;  // Ya está asignado al grupo actual
}

/**
 * Obtener exámenes asignados a un grupo
 */
export async function getGroupExams(groupId: number): Promise<{
  group_id: number;
  group_name: string;
  assigned_exams: GroupExamAssignment[];
  total: number;
}> {
  const response = await api.get(`/partners/groups/${groupId}/exams`);
  return response.data;
}

/**
 * Asignar un examen a un grupo con configuración completa
 */
export async function assignExamToGroup(groupId: number, config: ExamAssignmentConfig): Promise<{
  message: string;
  assignment: GroupExamAssignment;
  study_materials_count: number;
  assigned_members_count: number;
}> {
  const response = await api.post(`/partners/groups/${groupId}/exams`, config);
  return response.data;
}

/**
 * Desasignar un examen de un grupo
 */
export async function unassignExamFromGroup(groupId: number, examId: number): Promise<{
  message: string;
}> {
  const response = await api.delete(`/partners/groups/${groupId}/exams/${examId}`);
  return response.data;
}

/**
 * Obtener miembros asignados a un examen
 */
export async function getGroupExamMembers(groupId: number, examId: number): Promise<{
  assignment_type: 'all' | 'selected';
  members: Array<{
    id: number;
    user_id: number;
    assigned_at: string;
    user?: {
      id: number;
      first_name: string;
      last_name: string;
      email: string;
    };
  }>;
  total_members: number;
}> {
  const response = await api.get(`/partners/groups/${groupId}/exams/${examId}/members`);
  return response.data;
}

/**
 * Actualizar miembros asignados a un examen
 */
export async function updateGroupExamMembers(groupId: number, examId: number, data: {
  assignment_type: 'all' | 'selected';
  member_ids?: string[];
}): Promise<{
  message: string;
  assignment: GroupExamAssignment;
}> {
  const response = await api.put(`/partners/groups/${groupId}/exams/${examId}/members`, data);
  return response.data;
}

/**
 * Obtener exámenes disponibles para asignar
 * @param group_id - Si se proporciona, incluye is_assigned_to_group para indicar si ya está asignado
 */
export async function getAvailableExams(params?: {
  search?: string;
  page?: number;
  per_page?: number;
  group_id?: number;
}): Promise<{
  exams: AvailableExam[];
  total: number;
  pages: number;
  current_page: number;
}> {
  const response = await api.get('/partners/exams/available', { params });
  return response.data;
}

// ============== MATERIALES DE UN EXAMEN PARA ASIGNACIÓN ==============

export interface ExamMaterialForAssignment {
  id: number;
  title: string;
  description?: string;
  cover_image_url?: string;
  is_published: boolean;
  is_linked: boolean;  // Vinculado directamente al examen
  is_selected: boolean; // Seleccionado para asignar
  sessions_count: number;
  topics_count: number;
}

export interface ExamMaterialsForAssignmentResponse {
  exam_id: number;
  exam_name: string;
  materials: ExamMaterialForAssignment[];
  linked_count: number;
  total_count: number;
}

/**
 * Obtener materiales disponibles para asignar con un examen
 * Retorna primero los materiales ligados al examen (solo publicados),
 * luego los demás materiales publicados.
 */
export async function getExamMaterialsForAssignment(examId: number): Promise<ExamMaterialsForAssignmentResponse> {
  const response = await api.get(`/partners/exams/${examId}/materials`);
  return response.data;
}

// ============== MATERIALES PERSONALIZADOS POR GRUPO-EXAMEN ==============

export interface GroupExamMaterialItem {
  id: number;
  title: string;
  description?: string;
  cover_image_url?: string;
  is_published: boolean;
  is_linked: boolean;  // Vinculado directamente al examen
  is_included: boolean; // Incluido para este grupo
}

export interface GroupExamMaterialsResponse {
  group_exam_id: number;
  exam_id: number;
  exam_name: string;
  materials: GroupExamMaterialItem[];
  has_customizations: boolean;
}

/**
 * Obtener materiales disponibles y seleccionados para un grupo-examen
 */
export async function getGroupExamMaterials(groupExamId: number): Promise<GroupExamMaterialsResponse> {
  const response = await api.get(`/partners/group-exams/${groupExamId}/materials`);
  return response.data;
}

/**
 * Actualizar materiales seleccionados para un grupo-examen
 */
export async function updateGroupExamMaterials(
  groupExamId: number, 
  materials: Array<{ id: number; is_included: boolean }>
): Promise<{ message: string; group_exam_id: number }> {
  const response = await api.put(`/partners/group-exams/${groupExamId}/materials`, { materials });
  return response.data;
}

/**
 * Resetear materiales a los valores por defecto del examen
 */
export async function resetGroupExamMaterials(groupExamId: number): Promise<{ message: string; group_exam_id: number }> {
  const response = await api.post(`/partners/group-exams/${groupExamId}/materials/reset`);
  return response.data;
}

// ============== MATERIALES DE ESTUDIO SIN EXAMEN ==============

export interface StudyMaterialItem {
  id: number;
  title: string;
  description?: string;
  image_url?: string;
  is_published: boolean;
  sessions_count: number;
  topics_count: number;
  is_assigned_to_group?: boolean;
  is_in_assigned_exam?: boolean;
  assigned_exam_info?: {
    exam_id: number;
    exam_name: string;
    group_exam_id: number;
  };
}

export interface AvailableStudyMaterialsResponse {
  materials: StudyMaterialItem[];
  total: number;
  pages: number;
  current_page: number;
}

export interface GroupStudyMaterialAssignment {
  id: number;
  group_id: number;
  study_material_id: number;
  assigned_at: string;
  assigned_by_id: string;
  available_from?: string;
  available_until?: string;
  assignment_type: 'all' | 'selected';
  is_active: boolean;
  study_material?: StudyMaterialItem;
  members?: Array<{ id: number; user_id: string; assigned_at: string }>;
}

export interface GroupStudyMaterialsResponse {
  group_id: number;
  group_name: string;
  assigned_materials: GroupStudyMaterialAssignment[];
  total: number;
}

export interface AssignStudyMaterialsConfig {
  material_ids: number[];
  assignment_type: 'all' | 'selected';
  member_ids?: string[];
  available_from?: string;
  available_until?: string;
}

/**
 * Obtener materiales de estudio publicados disponibles para asignar
 */
export async function getAvailableStudyMaterials(params?: {
  page?: number;
  per_page?: number;
  search?: string;
  group_id?: number;
}): Promise<AvailableStudyMaterialsResponse> {
  const response = await api.get('/partners/study-materials/available', { params });
  return response.data;
}

/**
 * Obtener materiales de estudio asignados directamente a un grupo (sin examen)
 */
export async function getGroupStudyMaterials(groupId: number): Promise<GroupStudyMaterialsResponse> {
  const response = await api.get(`/partners/groups/${groupId}/study-materials`);
  return response.data;
}

/**
 * Asignar materiales de estudio a un grupo sin necesidad de examen
 */
export async function assignStudyMaterialsToGroup(
  groupId: number,
  config: AssignStudyMaterialsConfig
): Promise<{
  message: string;
  assignments: GroupStudyMaterialAssignment[];
  materials_count: number;
}> {
  const response = await api.post(`/partners/groups/${groupId}/study-materials`, config);
  return response.data;
}

/**
 * Desasignar un material de estudio del grupo
 */
export async function unassignStudyMaterialFromGroup(
  groupId: number,
  materialId: number
): Promise<{ message: string }> {
  const response = await api.delete(`/partners/groups/${groupId}/study-materials/${materialId}`);
  return response.data;
}

/**
 * Exportar miembros del grupo a Excel
 */
export async function exportGroupMembersToExcel(groupId: number): Promise<Blob> {
  const response = await api.get(`/partners/groups/${groupId}/export-members`, {
    responseType: 'blob'
  });
  return response.data;
}

// ============== GESTIÓN DE MIEMBROS DE ASIGNACIONES ==============

/**
 * Obtener miembros asignados a un material de estudio específico
 */
export async function getStudyMaterialMembers(
  groupId: number,
  materialId: number
): Promise<{
  assignment_id: number;
  material_id: number;
  assignment_type: 'all' | 'selected';
  assigned_user_ids: string[];
}> {
  const response = await api.get(`/partners/groups/${groupId}/study-materials/${materialId}/members`);
  return response.data;
}

/**
 * Actualizar miembros asignados a un material de estudio
 */
export async function updateStudyMaterialMembers(
  groupId: number,
  materialId: number,
  userIds: string[]
): Promise<{
  message: string;
  added: string[];
  removed: string[];
  total_members: number;
}> {
  const response = await api.put(`/partners/groups/${groupId}/study-materials/${materialId}/members`, {
    user_ids: userIds
  });
  return response.data;
}

/**
 * Agregar miembros a un material de estudio existente
 */
export async function addMembersToStudyMaterial(
  groupId: number,
  materialId: number,
  userIds: string[]
): Promise<{
  message: string;
  added: string[];
}> {
  const response = await api.post(`/partners/groups/${groupId}/study-materials/${materialId}/members/add`, {
    user_ids: userIds
  });
  return response.data;
}

/**
 * Obtener miembros asignados a un examen específico
 */
export async function getExamMembers(
  groupId: number,
  examId: number
): Promise<{
  assignment_id: number;
  exam_id: number;
  assignment_type: 'all' | 'selected';
  assigned_user_ids: string[];
  members: any[];
  total_members: number;
}> {
  const response = await api.get(`/partners/groups/${groupId}/exams/${examId}/members`);
  return response.data;
}

/**
 * Actualizar miembros asignados a un examen
 */
export async function updateExamMembers(
  groupId: number,
  examId: number,
  assignmentType: 'all' | 'selected',
  memberIds: string[]
): Promise<{
  message: string;
  assignment: any;
}> {
  const response = await api.put(`/partners/groups/${groupId}/exams/${examId}/members`, {
    assignment_type: assignmentType,
    member_ids: memberIds
  });
  return response.data;
}

/**
 * Agregar miembros a un examen existente
 */
export async function addMembersToExam(
  groupId: number,
  examId: number,
  userIds: string[]
): Promise<{
  message: string;
  added: string[];
}> {
  const response = await api.post(`/partners/groups/${groupId}/exams/${examId}/members/add`, {
    user_ids: userIds
  });
  return response.data;
}
