/**
 * Tipos compartidos para el flujo de asignación de examen (4 páginas)
 * Los datos fluyen entre páginas via React Router state
 */
import type { AvailableExam, ExamContentType, BulkExamAssignResult } from '../../../services/partnersService';

export interface ExamConfig {
  timeLimitMinutes: number | null;
  useExamDefaultTime: boolean;
  passingScore: number;
  useExamDefaultScore: boolean;
  maxAttempts: number;
  maxDisconnections: number;
  examContentType: ExamContentType;
  // Cantidades - Examen
  examQuestionsCount: number | null;
  examExercisesCount: number | null;
  useAllExamQuestions: boolean;
  useAllExamExercises: boolean;
  // Cantidades - Simulador
  simulatorQuestionsCount: number | null;
  simulatorExercisesCount: number | null;
  useAllSimulatorQuestions: boolean;
  useAllSimulatorExercises: boolean;
}

/** State passed from Page 1 → Page 2 */
export interface SelectExamState {
  selectedExam: AvailableExam;
  config: ExamConfig;
}

/** State passed from Page 2 → Page 3 */
export interface SelectMaterialsState extends SelectExamState {
  selectedMaterialIds: number[];
}

/** State passed from Page 3 → Page 4 */
export interface AssignMembersState extends SelectMaterialsState {
  assignmentType: 'all' | 'selected' | 'bulk';
  selectedMemberIds?: string[];
  // Bulk-specific fields (only present when assignmentType === 'bulk')
  bulkFile?: File;
  bulkEcmCode?: string;
  bulkPreview?: BulkExamAssignResult;
}

export const EXAM_CONTENT_TYPES: { value: ExamContentType; label: string; description: string }[] = [
  {
    value: 'mixed',
    label: 'Preguntas y Ejercicios',
    description: 'El examen combinará preguntas teóricas con ejercicios prácticos.',
  },
  {
    value: 'questions_only',
    label: 'Solo Preguntas',
    description: 'El examen contendrá únicamente preguntas de opción múltiple, verdadero/falso, etc.',
  },
  {
    value: 'exercises_only',
    label: 'Solo Ejercicios',
    description: 'El examen contendrá únicamente ejercicios prácticos para resolver.',
  },
];
