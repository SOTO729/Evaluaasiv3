/**
 * Tests de Pestañas de Certificación
 * ====================================
 *
 * Cubre la lógica de buildCertifications() que agrupa exámenes y materiales
 * en certificaciones independientes para el dashboard del candidato.
 *
 * Ejecutar:
 *   cd frontend && npx vitest run src/__tests__/CertificationTabs.test.tsx
 */

import { describe, it, expect } from 'vitest'
import { buildCertifications, findMostRecentTab } from '../pages/HomePage'
import type { Certification } from '../components/candidate/CertificationPathCard'
import type { DashboardExam, DashboardMaterial } from '../services/dashboardService'

// ─── Helpers para crear datos de prueba ────────────────────────────────────

function makeExam(overrides: Partial<DashboardExam> = {}): DashboardExam {
  return {
    id: 1,
    name: 'Examen de prueba',
    description: '',
    version: '1.0',
    time_limit_minutes: 60,
    passing_score: 70,
    is_published: true,
    categories_count: 1,
    competency_standard_id: null,
    competency_standard_name: null,
    competency_standard_code: null,
    user_stats: {
      attempts: 0,
      best_score: null,
      is_completed: false,
      is_approved: false,
      last_attempt: null,
    },
    ...overrides,
  }
}

function makeMaterial(overrides: Partial<DashboardMaterial> = {}): DashboardMaterial {
  return {
    id: 100,
    title: 'Material de prueba',
    description: '',
    image_url: null,
    sessions_count: 1,
    progress: { total_contents: 5, completed_contents: 0, percentage: 0 },
    ...overrides,
  }
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('buildCertifications', () => {
  it('1 examen sin ECM genera 1 certificación individual', () => {
    const exams = [makeExam({ id: 10, name: 'Excel Básico' })]
    const result = buildCertifications(exams, [], {})

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('exam-10')
    expect(result[0].label).toBe('Excel Básico')
    expect(result[0].code).toBeNull()
    expect(result[0].exams).toHaveLength(1)
  })

  it('2 exámenes con mismo ECM generan 1 certificación agrupada', () => {
    const exams = [
      makeExam({
        id: 1,
        name: 'Excel v1',
        competency_standard_id: 5,
        competency_standard_name: 'EC0435 Gestión de Datos',
        competency_standard_code: 'EC0435',
      }),
      makeExam({
        id: 2,
        name: 'Excel v2',
        competency_standard_id: 5,
        competency_standard_name: 'EC0435 Gestión de Datos',
        competency_standard_code: 'EC0435',
      }),
    ]
    const result = buildCertifications(exams, [], {})

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('ecm-5')
    expect(result[0].label).toBe('EC0435 Gestión de Datos')
    expect(result[0].code).toBe('EC0435')
    expect(result[0].exams).toHaveLength(2)
  })

  it('2 exámenes con ECMs distintos generan 2 certificaciones', () => {
    const exams = [
      makeExam({
        id: 1,
        competency_standard_id: 5,
        competency_standard_name: 'EC0435 Gestión de Datos',
        competency_standard_code: 'EC0435',
      }),
      makeExam({
        id: 2,
        competency_standard_id: 8,
        competency_standard_name: 'EC0772 Ciberseguridad',
        competency_standard_code: 'EC0772',
      }),
    ]
    const result = buildCertifications(exams, [], {})

    expect(result).toHaveLength(2)
    expect(result.map(c => c.id).sort()).toEqual(['ecm-5', 'ecm-8'])
  })

  it('materiales se asocian correctamente vía exam_materials_map', () => {
    const exams = [makeExam({ id: 10 })]
    const materials = [
      makeMaterial({ id: 100, title: 'Material A' }),
      makeMaterial({ id: 200, title: 'Material B' }),
    ]
    const map = { 10: [100, 200] }

    const result = buildCertifications(exams, materials, map)

    expect(result).toHaveLength(1)
    expect(result[0].materials).toHaveLength(2)
    expect(result[0].materials.map(m => m.id).sort()).toEqual([100, 200])
  })

  it('materiales huérfanos se asignan al único grupo existente', () => {
    const exams = [makeExam({ id: 10 })]
    const materials = [
      makeMaterial({ id: 100, title: 'Asignado' }),
      makeMaterial({ id: 200, title: 'Huérfano' }),
    ]
    const map = { 10: [100] } // solo 100 está mapeado

    const result = buildCertifications(exams, materials, map)

    expect(result).toHaveLength(1)
    // Tanto el mapeado como el huérfano deben estar
    expect(result[0].materials).toHaveLength(2)
    expect(result[0].materials.map(m => m.id).sort()).toEqual([100, 200])
  })

  it('materiales huérfanos van al primer grupo si hay múltiples certificaciones', () => {
    const exams = [
      makeExam({ id: 1, competency_standard_id: 5, competency_standard_name: 'ECM A', competency_standard_code: 'A' }),
      makeExam({ id: 2, competency_standard_id: 8, competency_standard_name: 'ECM B', competency_standard_code: 'B' }),
    ]
    const materials = [makeMaterial({ id: 300, title: 'Huérfano' })]
    const map: Record<number, number[]> = {} // nada mapeado

    const result = buildCertifications(exams, materials, map)

    expect(result).toHaveLength(2)
    // El huérfano debe ir al primer grupo
    const allMaterials = result.flatMap(c => c.materials)
    expect(allMaterials).toHaveLength(1)
    expect(result[0].materials).toHaveLength(1)
    expect(result[0].materials[0].id).toBe(300)
  })

  it('exam_materials_map vacío funciona sin crash', () => {
    const exams = [makeExam({ id: 10 })]
    const materials = [makeMaterial({ id: 100 })]
    const map: Record<number, number[]> = {}

    const result = buildCertifications(exams, materials, map)

    expect(result).toHaveLength(1)
    // Material es huérfano y se asigna al único grupo
    expect(result[0].materials).toHaveLength(1)
  })

  it('sin exámenes ni materiales devuelve array vacío', () => {
    const result = buildCertifications([], [], {})
    expect(result).toHaveLength(0)
  })

  it('sin exámenes pero con materiales crea certificación genérica', () => {
    const materials = [makeMaterial({ id: 100, title: 'Lectura Libre' })]
    const result = buildCertifications([], materials, {})

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('general')
    expect(result[0].label).toBe('Mi preparación')
    expect(result[0].exams).toHaveLength(0)
    expect(result[0].materials).toHaveLength(1)
  })

  it('mezcla de exámenes con y sin ECM se agrupan correctamente', () => {
    const exams = [
      makeExam({ id: 1, name: 'Sin ECM', competency_standard_id: null }),
      makeExam({ id: 2, competency_standard_id: 5, competency_standard_name: 'ECM X', competency_standard_code: 'X' }),
      makeExam({ id: 3, competency_standard_id: 5, competency_standard_name: 'ECM X', competency_standard_code: 'X' }),
    ]
    const result = buildCertifications(exams, [], {})

    // 2 certificaciones: exam-1 (individual) + ecm-5 (agrupada con 2 exámenes)
    expect(result).toHaveLength(2)
    const individual = result.find(c => c.id === 'exam-1')
    const grouped = result.find(c => c.id === 'ecm-5')
    expect(individual).toBeDefined()
    expect(individual!.exams).toHaveLength(1)
    expect(grouped).toBeDefined()
    expect(grouped!.exams).toHaveLength(2)
  })
})

// ─── Helpers para findMostRecentTab ────────────────────────────────────────

function makeCert(overrides: Partial<Certification> = {}): Certification {
  return {
    id: 'cert-1',
    label: 'Certificación 1',
    code: null,
    exams: [],
    materials: [],
    lastActivity: null,
    ...overrides,
  }
}

function makeCertExam(overrides: Partial<DashboardExam> = {}): DashboardExam {
  return makeExam(overrides)
}

// ─── Tests de findMostRecentTab ────────────────────────────────────────────

describe('findMostRecentTab', () => {
  it('devuelve string vacío si no hay certificaciones', () => {
    expect(findMostRecentTab([])).toBe('')
  })

  it('devuelve la única certificación si solo hay 1', () => {
    const certs = [makeCert({ id: 'only-one' })]
    expect(findMostRecentTab(certs)).toBe('only-one')
  })

  it('selecciona la certificación con fecha de actividad más RECIENTE', () => {
    const certs = [
      makeCert({ id: 'old', lastActivity: '2026-01-01T00:00:00' }),
      makeCert({ id: 'recent', lastActivity: '2026-03-28T10:00:00' }),
      makeCert({ id: 'mid', lastActivity: '2026-02-15T00:00:00' }),
    ]
    expect(findMostRecentTab(certs)).toBe('recent')
  })

  it('selecciona la primera si ninguna tiene actividad', () => {
    const certs = [
      makeCert({ id: 'a', lastActivity: null }),
      makeCert({ id: 'b', lastActivity: null }),
    ]
    expect(findMostRecentTab(certs)).toBe('a')
  })

  it('prioriza in-progress sobre fecha más reciente', () => {
    const certs = [
      makeCert({
        id: 'recent-approved',
        lastActivity: '2026-03-28T12:00:00',
        exams: [makeCertExam({
          id: 1,
          user_stats: {
            attempts: 1, best_score: 95, is_completed: true, is_approved: true,
            last_attempt: { score: 95, status: 2, result: 1, start_date: '2026-03-28T11:00:00', end_date: '2026-03-28T12:00:00', certificate_code: 'C1', certificate_url: null },
          },
        })],
      }),
      makeCert({
        id: 'older-in-progress',
        lastActivity: '2026-02-01T10:00:00',
        exams: [makeCertExam({
          id: 2,
          user_stats: {
            attempts: 1, best_score: 40, is_completed: false, is_approved: false,
            last_attempt: { score: 40, status: 1, result: 0, start_date: '2026-02-01T09:00:00', end_date: '2026-02-01T10:00:00', certificate_code: null, certificate_url: null },
          },
        })],
      }),
    ]
    // In-progress tiene prioridad aunque su fecha sea más antigua
    expect(findMostRecentTab(certs)).toBe('older-in-progress')
  })

  it('entre múltiples in-progress elige el de actividad más reciente', () => {
    const certs = [
      makeCert({
        id: 'in-progress-old',
        lastActivity: '2026-01-15T10:00:00',
        exams: [makeCertExam({
          id: 1,
          user_stats: {
            attempts: 1, best_score: 30, is_completed: false, is_approved: false,
            last_attempt: { score: 30, status: 1, result: 0, start_date: '2026-01-15T09:00:00', end_date: '2026-01-15T10:00:00', certificate_code: null, certificate_url: null },
          },
        })],
      }),
      makeCert({
        id: 'in-progress-recent',
        lastActivity: '2026-03-20T10:00:00',
        exams: [makeCertExam({
          id: 2,
          user_stats: {
            attempts: 2, best_score: 55, is_completed: false, is_approved: false,
            last_attempt: { score: 55, status: 1, result: 0, start_date: '2026-03-20T09:00:00', end_date: '2026-03-20T10:00:00', certificate_code: null, certificate_url: null },
          },
        })],
      }),
    ]
    expect(findMostRecentTab(certs)).toBe('in-progress-recent')
  })

  it('selecciona cert con actividad sobre cert sin actividad', () => {
    const certs = [
      makeCert({ id: 'no-activity', lastActivity: null }),
      makeCert({ id: 'has-activity', lastActivity: '2026-01-01T00:00:00' }),
    ]
    expect(findMostRecentTab(certs)).toBe('has-activity')
  })

  it('cert completada (approved) no bloquea selección de in-progress', () => {
    const certs = [
      makeCert({
        id: 'completed',
        lastActivity: '2026-03-28T15:00:00',
        exams: [makeCertExam({
          id: 1,
          user_stats: {
            attempts: 1, best_score: 90, is_completed: true, is_approved: true,
            last_attempt: { score: 90, status: 2, result: 1, start_date: '2026-03-28T14:00:00', end_date: '2026-03-28T15:00:00', certificate_code: 'CERT', certificate_url: null },
          },
        })],
      }),
      makeCert({
        id: 'in-progress',
        lastActivity: '2026-03-25T10:00:00',
        exams: [makeCertExam({
          id: 2,
          user_stats: {
            attempts: 1, best_score: 60, is_completed: false, is_approved: false,
            last_attempt: { score: 60, status: 1, result: 0, start_date: '2026-03-25T09:00:00', end_date: '2026-03-25T10:00:00', certificate_code: null, certificate_url: null },
          },
        })],
      }),
      makeCert({
        id: 'not-started',
        lastActivity: null,
        exams: [makeCertExam({ id: 3 })],
      }),
    ]
    expect(findMostRecentTab(certs)).toBe('in-progress')
  })
})
