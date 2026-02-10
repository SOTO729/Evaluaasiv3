import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { useAuthStore } from './store/authStore'
import LoadingSpinner from './components/LoadingSpinner'
import InactivityWatcher from './components/InactivityWatcher'
import SystemReadyGuard from './components/SystemReadyGuard'
import GlobalNotifications from './components/ui/GlobalNotifications'
import AuthProvider from './components/auth/AuthProvider'

// Eager imports (necesarios inmediatamente)
import Layout from './components/layout/Layout'
import ProtectedRoute from './components/auth/ProtectedRoute'

// Lazy imports (cargados bajo demanda)
const LandingPage = lazy(() => import('./pages/landing/LandingPage'))
const PrivacyPolicyPage = lazy(() => import('./pages/landing/PrivacyPolicyPage'))
const PrivacyPolicyFullPage = lazy(() => import('./pages/landing/PrivacyPolicyFullPage'))
const TermsOfServicePage = lazy(() => import('./pages/landing/TermsOfServicePage'))
const VerifyPage = lazy(() => import('./pages/verify/VerifyPage'))
const LoginPage = lazy(() => import('./pages/auth/LoginPage'))
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'))
const HomePage = lazy(() => import('./pages/HomePage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const ExamsListPage = lazy(() => import('./pages/exams/ExamsListPage'))
const ExamCreatePage = lazy(() => import('./pages/exams/ExamCreatePage'))
const ExamEditPage = lazy(() => import('./pages/exams/ExamEditPage'))
const CategoryDetailPage = lazy(() => import('./pages/categories/CategoryDetailPage'))
const TopicDetailPage = lazy(() => import('./pages/topics/TopicDetailPage'))
const TrueFalseAnswerPage = lazy(() => import('./pages/answers/TrueFalseAnswerPage'))
const MultipleChoiceAnswerPage = lazy(() => import('./pages/answers/MultipleChoiceAnswerPage'))
const MultipleSelectAnswerPage = lazy(() => import('./pages/answers/MultipleSelectAnswerPage').then(module => ({ default: module.MultipleSelectAnswerPage })))
const OrderingAnswerPage = lazy(() => import('./pages/answers/OrderingAnswerPage').then(module => ({ default: module.OrderingAnswerPage })))
const DragDropAnswerPage = lazy(() => import('./pages/answers/DragDropAnswerPage').then(module => ({ default: module.DragDropAnswerPage })))
const ColumnGroupingAnswerPage = lazy(() => import('./pages/answers/ColumnGroupingAnswerPage').then(module => ({ default: module.ColumnGroupingAnswerPage })))
const ExamTestRunPage = lazy(() => import('./pages/ExamTestRunPage'))
const ExamTestResultsPage = lazy(() => import('./pages/ExamTestResultsPage'))
const ExamPreviewPage = lazy(() => import('./pages/exams/ExamPreviewPage'))
const ExamModeSelectorPage = lazy(() => import('./pages/exams/ExamModeSelectorPage'))
const ExamOnboardingPage = lazy(() => import('./pages/exams/ExamOnboardingPage'))

// Study Contents
const StudyContentsListPage = lazy(() => import('./pages/study-contents/StudyContentsListPage'))
const StudyContentCreatePage = lazy(() => import('./pages/study-contents/StudyContentCreatePage'))
const StudyContentDetailPage = lazy(() => import('./pages/study-contents/StudyContentDetailPage'))
const StudyContentCandidatePage = lazy(() => import('./pages/study-contents/StudyContentCandidatePage'))
const StudyContentPreviewPage = lazy(() => import('./pages/study-contents/StudyContentPreviewPage'))
const StudyInteractiveExercisePage = lazy(() => import('./pages/study-contents/StudyInteractiveExercisePage'))
const ReadingEditorPage = lazy(() => import('./pages/study-contents/ReadingEditorPage'))
const VideoEditorPage = lazy(() => import('./pages/study-contents/VideoEditorPage'))
const DownloadableEditorPage = lazy(() => import('./pages/study-contents/DownloadableEditorPage'))

// Componente que decide qué página de detalle mostrar según el rol
const StudyContentDetailRouter = () => {
  const { user } = useAuthStore()
  return (user?.role === 'candidato' || user?.role === 'responsable') ? <StudyContentCandidatePage /> : <StudyContentDetailPage />
}

// Componente que envuelve ExamTestResultsPage en Layout para candidatos
const ExamTestResultsRouter = () => {
  const { user } = useAuthStore()
  if (user?.role === 'candidato' || user?.role === 'responsable') {
    return (
      <Layout>
        <ExamTestResultsPage />
      </Layout>
    )
  }
  return <ExamTestResultsPage />
}

// Componente que redirige al coordinador si intenta acceder a rutas restringidas
const RestrictedForCoordinator = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuthStore()
  if (user?.role === 'coordinator') {
    return <Navigate to="/dashboard" replace />
  }
  return <>{children}</>
}

// Certificates
const CertificatesPage = lazy(() => import('./pages/certificates/CertificatesPage'))
const EvaluationReportDetailPage = lazy(() => import('./pages/certificates/EvaluationReportDetailPage'))
const ResultDetailPage = lazy(() => import('./pages/certificates/ResultDetailPage'))

// Standards (ECM)
const StandardsListPage = lazy(() => import('./pages/standards/StandardsListPage'))
const StandardFormPage = lazy(() => import('./pages/standards/StandardFormPage'))
const StandardDetailPage = lazy(() => import('./pages/standards/StandardDetailPage'))
const DeletionRequestsPage = lazy(() => import('./pages/standards/DeletionRequestsPage'))
const BrandsListPage = lazy(() => import('./pages/standards/BrandsListPage'))
const BrandFormPage = lazy(() => import('./pages/standards/BrandFormPage'))

// Partners (Coordinador)
const PartnersDashboardPage = lazy(() => import('./pages/partners/PartnersDashboardPage'))
const PartnersListPage = lazy(() => import('./pages/partners/PartnersListPage'))
const PartnerFormPage = lazy(() => import('./pages/partners/PartnerFormPage'))
const PartnerDetailPage = lazy(() => import('./pages/partners/PartnerDetailPage'))
const CampusFormPage = lazy(() => import('./pages/partners/CampusFormPage'))
const CampusDetailPage = lazy(() => import('./pages/partners/CampusDetailPage'))
const GroupFormPage = lazy(() => import('./pages/partners/GroupFormPage'))
const GroupDetailPage = lazy(() => import('./pages/partners/GroupDetailPage'))
const GroupMembersPage = lazy(() => import('./pages/partners/GroupMembersPage'))
const GroupExamsPage = lazy(() => import('./pages/partners/GroupExamsPage'))
const GroupDocumentsPage = lazy(() => import('./pages/partners/GroupDocumentsPage'))
const GroupAssignCandidatesPage = lazy(() => import('./pages/partners/GroupAssignCandidatesPage'))
const GroupAssignExamPage = lazy(() => import('./pages/partners/GroupAssignExamPage'))
const GroupAssignMaterialsPage = lazy(() => import('./pages/partners/GroupAssignMaterialsPage'))
const GroupEditAssignmentMembersPage = lazy(() => import('./pages/partners/GroupEditAssignmentMembersPage'))
const CampusActivationPage = lazy(() => import('./pages/partners/CampusActivationPage'))
const SchoolCycleDetailPage = lazy(() => import('./pages/partners/SchoolCycleDetailPage'))
const EcmAssignmentsPage = lazy(() => import('./pages/partners/EcmAssignmentsPage'))
const EcmAssignmentDetailPage = lazy(() => import('./pages/partners/EcmAssignmentDetailPage'))

// Responsable de Plantel
const MiPlantelPage = lazy(() => import('./pages/responsable/MiPlantelPage'))
const MiPlantelReportesPage = lazy(() => import('./pages/responsable/MiPlantelReportesPage'))

// Financiero (Gestión de saldos)
const FinancieroDashboard = lazy(() => import('./pages/financiero/FinancieroDashboard'))
const FinancieroSolicitudesPage = lazy(() => import('./pages/financiero/FinancieroSolicitudesPage'))
const FinancieroSolicitudDetailPage = lazy(() => import('./pages/financiero/FinancieroSolicitudDetailPage'))

// Gerente (Portal de gerencia)
const GerenteDashboard = lazy(() => import('./pages/gerente/GerenteDashboard'))
const GerenteApprovalsPage = lazy(() => import('./pages/gerente/GerenteApprovalsPage'))
const GerenteApprovalDetailPage = lazy(() => import('./pages/gerente/GerenteApprovalDetailPage'))
const GerenteActivityLogsPage = lazy(() => import('./pages/gerente/GerenteActivityLogsPage'))
const GerenteSecurityPage = lazy(() => import('./pages/gerente/GerenteSecurityPage'))
const GerenteReportsPage = lazy(() => import('./pages/gerente/GerenteReportsPage'))

// Coordinador - Saldo
const MiSaldoPage = lazy(() => import('./pages/coordinador/MiSaldoPage'))
const MiSolicitudDetailPage = lazy(() => import('./pages/coordinador/MiSolicitudDetailPage'))
const SolicitarSaldoPage = lazy(() => import('./pages/coordinador/SolicitarSaldoPage'))
const SolicitarBecaPage = lazy(() => import('./pages/coordinador/SolicitarBecaPage'))
const HistorialSolicitudesPage = lazy(() => import('./pages/coordinador/HistorialSolicitudesPage'))
const HistorialMovimientosPage = lazy(() => import('./pages/coordinador/HistorialMovimientosPage'))
const HistorialAsignacionesPage = lazy(() => import('./pages/coordinador/HistorialAsignacionesPage'))

// Grupos (gestión de grupos por plantel)
const GruposListPage = lazy(() => import('./pages/grupos/GruposListPage'))

// User Management (Gestión de Usuarios)
const UsersListPage = lazy(() => import('./pages/users/UsersListPage'))
const UserFormPage = lazy(() => import('./pages/users/UserFormPage'))
const UserDetailPage = lazy(() => import('./pages/users/UserDetailPage'))

function App() {
  const { isAuthenticated } = useAuthStore()

  return (
    <SystemReadyGuard>
      <AuthProvider>
        <GlobalNotifications />
        <BrowserRouter>
          <InactivityWatcher timeoutMinutes={15}>
            <Suspense fallback={<LoadingSpinner message="Cargando..." fullScreen />}>
              <Routes>
            {/* Landing Page - Public */}
            <Route path="/" element={
              isAuthenticated ? <Navigate to="/dashboard" /> : <LandingPage />
            } />
          
          {/* Privacy Policy - Public */}
          <Route path="/privacidad" element={<PrivacyPolicyPage />} />
          <Route path="/politica-privacidad" element={<PrivacyPolicyFullPage />} />
          <Route path="/terminos" element={<TermsOfServicePage />} />
          
          {/* Certificate Verification - Public */}
          <Route path="/verify/:code" element={<VerifyPage />} />
          
          {/* Public routes */}
          <Route path="/login" element={
            isAuthenticated ? <Navigate to="/dashboard" /> : <LoginPage />
          } />
          <Route path="/register" element={
            isAuthenticated ? <Navigate to="/dashboard" /> : <RegisterPage />
          } />

          {/* Protected routes */}
          <Route element={<ProtectedRoute />}>
            {/* Rutas de pantalla completa (sin navbar) */}
            <Route path="/test-exams/:examId/run" element={<ExamTestRunPage />} />
            <Route path="/test-exams/:examId/results" element={<ExamTestResultsRouter />} />
            
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<HomePage />} />
              <Route path="/profile" element={<ProfilePage />} />
              
              {/* Study Contents Preview - con navbar */}
              <Route path="/study-contents/:id/preview" element={<RestrictedForCoordinator><StudyContentPreviewPage /></RestrictedForCoordinator>} />
              
              {/* Exams - Restringido para coordinador */}
              <Route path="/exams" element={<RestrictedForCoordinator><ExamsListPage /></RestrictedForCoordinator>} />
              <Route path="/exams/create" element={<RestrictedForCoordinator><ExamCreatePage /></RestrictedForCoordinator>} />
              <Route path="/exams/:id/edit" element={<RestrictedForCoordinator><ExamEditPage /></RestrictedForCoordinator>} />
              <Route path="/exams/:id/select-mode" element={<RestrictedForCoordinator><ExamModeSelectorPage /></RestrictedForCoordinator>} />
              <Route path="/exams/:id/preview/:mode" element={<RestrictedForCoordinator><ExamPreviewPage /></RestrictedForCoordinator>} />
              <Route path="/exams/:id/preview" element={<RestrictedForCoordinator><ExamPreviewPage /></RestrictedForCoordinator>} />
              <Route path="/exams/:id/onboarding/:mode" element={<RestrictedForCoordinator><ExamOnboardingPage /></RestrictedForCoordinator>} />
              
              {/* Categories - Restringido para coordinador */}
              <Route path="/exams/:examId/categories/:categoryId" element={<RestrictedForCoordinator><CategoryDetailPage /></RestrictedForCoordinator>} />
              
              {/* Topics - Restringido para coordinador */}
              <Route path="/exams/:examId/categories/:categoryId/topics/:topicId" element={<RestrictedForCoordinator><TopicDetailPage /></RestrictedForCoordinator>} />
              
              {/* Answers - Restringido para coordinador */}
              <Route path="/exams/:examId/categories/:categoryId/topics/:topicId/questions/:questionId/answer" element={<RestrictedForCoordinator><TrueFalseAnswerPage /></RestrictedForCoordinator>} />
              <Route path="/exams/:examId/categories/:categoryId/topics/:topicId/questions/:questionId/multiple-choice" element={<RestrictedForCoordinator><MultipleChoiceAnswerPage /></RestrictedForCoordinator>} />
              <Route path="/exams/:examId/categories/:categoryId/topics/:topicId/questions/:questionId/multiple-select" element={<RestrictedForCoordinator><MultipleSelectAnswerPage /></RestrictedForCoordinator>} />
              <Route path="/exams/:examId/categories/:categoryId/topics/:topicId/questions/:questionId/ordering" element={<RestrictedForCoordinator><OrderingAnswerPage /></RestrictedForCoordinator>} />
              <Route path="/exams/:examId/categories/:categoryId/topics/:topicId/questions/:questionId/drag-drop" element={<RestrictedForCoordinator><DragDropAnswerPage /></RestrictedForCoordinator>} />
              <Route path="/exams/:examId/categories/:categoryId/topics/:topicId/questions/:questionId/column-grouping" element={<RestrictedForCoordinator><ColumnGroupingAnswerPage /></RestrictedForCoordinator>} />
              
              {/* Study Contents - Restringido para coordinador */}
              <Route path="/study-contents" element={<RestrictedForCoordinator><StudyContentsListPage /></RestrictedForCoordinator>} />
              <Route path="/study-contents/create" element={<RestrictedForCoordinator><StudyContentCreatePage /></RestrictedForCoordinator>} />
              <Route path="/study-contents/:id" element={<RestrictedForCoordinator><StudyContentDetailRouter /></RestrictedForCoordinator>} />
              <Route path="/study-contents/:id/edit" element={<RestrictedForCoordinator><StudyContentCreatePage /></RestrictedForCoordinator>} />
              <Route path="/study-contents/:id/reading" element={<RestrictedForCoordinator><ReadingEditorPage /></RestrictedForCoordinator>} />
              <Route path="/study-contents/:id/video" element={<RestrictedForCoordinator><VideoEditorPage /></RestrictedForCoordinator>} />
              <Route path="/study-contents/:id/downloadable" element={<RestrictedForCoordinator><DownloadableEditorPage /></RestrictedForCoordinator>} />
              <Route path="/study-contents/:id/sessions/:sessionId/topics/:topicId/interactive" element={<RestrictedForCoordinator><StudyInteractiveExercisePage /></RestrictedForCoordinator>} />
              
              {/* Standards (ECM) - Restringido para coordinador */}
              <Route path="/standards" element={<RestrictedForCoordinator><StandardsListPage /></RestrictedForCoordinator>} />
              <Route path="/standards/new" element={<RestrictedForCoordinator><StandardFormPage /></RestrictedForCoordinator>} />
              <Route path="/standards/brands" element={<RestrictedForCoordinator><BrandsListPage /></RestrictedForCoordinator>} />
              <Route path="/standards/brands/new" element={<RestrictedForCoordinator><BrandFormPage /></RestrictedForCoordinator>} />
              <Route path="/standards/brands/:id/edit" element={<RestrictedForCoordinator><BrandFormPage /></RestrictedForCoordinator>} />
              <Route path="/standards/:id" element={<RestrictedForCoordinator><StandardDetailPage /></RestrictedForCoordinator>} />
              <Route path="/standards/:id/edit" element={<RestrictedForCoordinator><StandardFormPage /></RestrictedForCoordinator>} />
              <Route path="/standards/deletion-requests" element={<RestrictedForCoordinator><DeletionRequestsPage /></RestrictedForCoordinator>} />
              
              {/* Certificates - Restringido para coordinador */}
              <Route path="/certificates" element={<RestrictedForCoordinator><CertificatesPage /></RestrictedForCoordinator>} />
              <Route path="/certificates/evaluation-report/:examId" element={<RestrictedForCoordinator><EvaluationReportDetailPage /></RestrictedForCoordinator>} />
              <Route path="/certificates/evaluation-report/:examId/result/:resultId" element={<RestrictedForCoordinator><ResultDetailPage /></RestrictedForCoordinator>} />
              
              {/* Partners (Coordinador) */}
              <Route path="/partners/dashboard" element={<PartnersDashboardPage />} />
              <Route path="/partners" element={<PartnersListPage />} />
              <Route path="/partners/new" element={<PartnerFormPage />} />
              <Route path="/partners/:partnerId" element={<PartnerDetailPage />} />
              <Route path="/partners/:partnerId/edit" element={<PartnerFormPage />} />
              <Route path="/partners/:partnerId/campuses/new" element={<CampusFormPage />} />
              <Route path="/partners/campuses/:campusId" element={<CampusDetailPage />} />
              <Route path="/partners/campuses/:campusId/edit" element={<CampusFormPage />} />
              <Route path="/partners/campuses/:campusId/activate" element={<CampusActivationPage />} />
              <Route path="/partners/campuses/:campusId/groups/new" element={<GroupFormPage />} />
              <Route path="/partners/cycles/:cycleId" element={<SchoolCycleDetailPage />} />
              <Route path="/partners/groups/:groupId" element={<GroupDetailPage />} />
              <Route path="/partners/groups/:groupId/members" element={<GroupMembersPage />} />
              <Route path="/partners/groups/:groupId/exams" element={<GroupExamsPage />} />
              <Route path="/partners/groups/:groupId/documents" element={<GroupDocumentsPage />} />
              <Route path="/partners/groups/:groupId/edit" element={<GroupFormPage />} />
              <Route path="/partners/groups/:groupId/assign-candidates" element={<GroupAssignCandidatesPage />} />
              <Route path="/partners/groups/:groupId/assign-exam" element={<GroupAssignExamPage />} />
              <Route path="/partners/groups/:groupId/assign-materials" element={<GroupAssignMaterialsPage />} />
              <Route path="/partners/groups/:groupId/assignments/:assignmentId/edit-members" element={<GroupEditAssignmentMembersPage />} />
              
              {/* Asignaciones por ECM */}
              <Route path="/asignaciones-ecm" element={<EcmAssignmentsPage />} />
              <Route path="/asignaciones-ecm/:ecmId" element={<EcmAssignmentDetailPage />} />
              
              {/* Responsable de Plantel */}
              <Route path="/mi-plantel" element={<MiPlantelPage />} />
              <Route path="/mi-plantel/reportes" element={<MiPlantelReportesPage />} />
              
              {/* Financiero - Gestión de Solicitudes de Saldo */}
              <Route path="/financiero" element={<FinancieroDashboard />} />
              <Route path="/financiero/solicitudes" element={<FinancieroSolicitudesPage />} />
              <Route path="/financiero/solicitudes/:id" element={<FinancieroSolicitudDetailPage />} />
              
              {/* Gerente - Portal de Gerencia */}
              <Route path="/gerente" element={<GerenteDashboard />} />
              <Route path="/gerente/aprobaciones" element={<GerenteApprovalsPage />} />
              <Route path="/gerente/aprobaciones/:id" element={<GerenteApprovalDetailPage />} />
              <Route path="/gerente/actividad" element={<GerenteActivityLogsPage />} />
              <Route path="/gerente/seguridad" element={<GerenteSecurityPage />} />
              <Route path="/gerente/reportes" element={<GerenteReportsPage />} />
              
              {/* Coordinador - Gestión de Saldo */}
              <Route path="/mi-saldo" element={<MiSaldoPage />} />
              <Route path="/mi-saldo/solicitud/:id" element={<MiSolicitudDetailPage />} />
              <Route path="/solicitar-saldo" element={<SolicitarSaldoPage />} />
              <Route path="/solicitar-beca" element={<SolicitarBecaPage />} />
              <Route path="/historial-solicitudes" element={<HistorialSolicitudesPage />} />
              <Route path="/historial-movimientos" element={<HistorialMovimientosPage />} />
              <Route path="/historial-asignaciones" element={<HistorialAsignacionesPage />} />
              
              {/* Grupos - Gestión de grupos por plantel */}
              <Route path="/grupos" element={<GruposListPage />} />
              
              {/* User Management (Gestión de Usuarios) */}
              <Route path="/user-management" element={<UsersListPage />} />
              <Route path="/user-management/new" element={<UserFormPage />} />
              <Route path="/user-management/:userId" element={<UserDetailPage />} />
              <Route path="/user-management/:userId/edit" element={<UserFormPage />} />
            </Route>
          </Route>

          {/* 404 */}
          <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Suspense>
        </InactivityWatcher>
      </BrowserRouter>
      </AuthProvider>
    </SystemReadyGuard>
  )
}

export default App
