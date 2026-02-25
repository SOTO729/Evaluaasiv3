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
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('./pages/auth/ResetPasswordPage'))
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
// @ts-ignore: Reserved for future use
const RestrictedForCoordinator = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuthStore()
  if (user?.role === 'coordinator') {
    return <Navigate to="/dashboard" replace />
  }
  return <>{children}</>
}

// Componente que redirige a gerente/financiero si intenta acceder a rutas restringidas
const RestrictedForGerenteFin = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuthStore()
  if (user?.role === 'coordinator' || user?.role === 'gerente' || user?.role === 'financiero') {
    return <Navigate to="/dashboard" replace />
  }
  return <>{children}</>
}

// Componente que solo bloquea gerente/financiero (permite coordinator y editor)
const RestrictedForGerenteFinOnly = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuthStore()
  if (user?.role === 'gerente' || user?.role === 'financiero') {
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
// GroupExamsPage removed — functionality merged into GroupDetailPage
const GroupDocumentsPage = lazy(() => import('./pages/partners/GroupDocumentsPage'))
const GroupCertReportePage = lazy(() => import('./pages/partners/certificates/GroupCertReportePage'))
const GroupCertEduitPage = lazy(() => import('./pages/partners/certificates/GroupCertEduitPage'))
const GroupCertConocerPage = lazy(() => import('./pages/partners/certificates/GroupCertConocerPage'))
const GroupCertInsigniaPage = lazy(() => import('./pages/partners/certificates/GroupCertInsigniaPage'))
const GroupAnalyticsPage = lazy(() => import('./pages/partners/GroupAnalyticsPage'))
const GroupAssignCandidatesPage = lazy(() => import('./pages/partners/GroupAssignCandidatesPage'))
const GroupBulkUploadPage = lazy(() => import('./pages/partners/GroupBulkUploadPage'))
const ExamSelectConfigPage = lazy(() => import('./pages/partners/exam-assignment/ExamSelectConfigPage'))
const ExamSelectMaterialsPage = lazy(() => import('./pages/partners/exam-assignment/ExamSelectMaterialsPage'))
const ExamAssignMembersPage = lazy(() => import('./pages/partners/exam-assignment/ExamAssignMembersPage'))
const ExamAssignmentReviewPage = lazy(() => import('./pages/partners/exam-assignment/ExamAssignmentReviewPage'))
const GroupAssignMaterialsPage = lazy(() => import('./pages/partners/GroupAssignMaterialsPage'))
const GroupEditAssignmentMembersPage = lazy(() => import('./pages/partners/GroupEditAssignmentMembersPage'))
const AssignmentDetailPage = lazy(() => import('./pages/partners/AssignmentDetailPage'))
const CampusActivationPage = lazy(() => import('./pages/partners/CampusActivationPage'))
const SchoolCycleDetailPage = lazy(() => import('./pages/partners/SchoolCycleDetailPage'))
const EcmAssignmentsPage = lazy(() => import('./pages/partners/EcmAssignmentsPage'))
const EcmAssignmentDetailPage = lazy(() => import('./pages/partners/EcmAssignmentDetailPage'))
const CandidateAssignmentDetailPage = lazy(() => import('./pages/partners/CandidateAssignmentDetailPage'))
const ConocerTramitesPage = lazy(() => import('./pages/partners/ConocerTramitesPage'))
const ConocerUploadPage = lazy(() => import('./pages/partners/ConocerUploadPage'))
const ConocerUploadHistoryPage = lazy(() => import('./pages/partners/ConocerUploadHistoryPage'))
const ConocerUploadDetailPage = lazy(() => import('./pages/partners/ConocerUploadDetailPage'))
const ConocerContactsPage = lazy(() => import('./pages/partners/ConocerContactsPage'))

// Responsable de Plantel
const MiPlantelPage = lazy(() => import('./pages/responsable/MiPlantelPage'))
const MiPlantelReportesPage = lazy(() => import('./pages/responsable/MiPlantelReportesPage'))
const MiPlantelCertificadosPage = lazy(() => import('./pages/responsable/MiPlantelCertificadosPage'))
const MiPlantelGrupoDetailPage = lazy(() => import('./pages/responsable/MiPlantelGrupoDetailPage'))

// Responsable de Partner
const ResponsablePartnerDashboard = lazy(() => import('./pages/responsable_partner/ResponsablePartnerDashboard'))
const ResponsablePartnerCertificadosPage = lazy(() => import('./pages/responsable_partner/ResponsablePartnerCertificadosPage'))

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
const GerenteDelegacionesPage = lazy(() => import('./pages/gerente/GerenteDelegacionesPage'))

// Coordinador - Saldo
const MiSaldoPage = lazy(() => import('./pages/coordinador/MiSaldoPage'))
const MiSolicitudDetailPage = lazy(() => import('./pages/coordinador/MiSolicitudDetailPage'))
const SolicitarSaldoPage = lazy(() => import('./pages/coordinador/SolicitarSaldoPage'))
const SolicitarBecaPage = lazy(() => import('./pages/coordinador/SolicitarBecaPage'))
const HistorialSolicitudesPage = lazy(() => import('./pages/coordinador/HistorialSolicitudesPage'))
const HistorialMovimientosPage = lazy(() => import('./pages/coordinador/HistorialMovimientosPage'))
const HistorialAsignacionesPage = lazy(() => import('./pages/coordinador/HistorialAsignacionesPage'))

// VM Sessions (Máquinas Virtuales)
const VmSchedulingPage = lazy(() => import('./pages/vm-sessions/VmSchedulingPage'))

// Grupos (gestión de grupos por plantel)
const GruposListPage = lazy(() => import('./pages/grupos/GruposListPage'))

// User Management (Gestión de Usuarios)
const UsersListPage = lazy(() => import('./pages/users/UsersListPage'))
const UserFormPage = lazy(() => import('./pages/users/UserFormPage'))
const UserDetailPage = lazy(() => import('./pages/users/UserDetailPage'))

// Badges (Insignias Digitales)
const BadgeTemplatesPage = lazy(() => import('./pages/badges/BadgeTemplatesPage'))
const BadgeTemplateFormPage = lazy(() => import('./pages/badges/BadgeTemplateFormPage'))

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
          <Route path="/forgot-password" element={
            isAuthenticated ? <Navigate to="/dashboard" /> : <ForgotPasswordPage />
          } />
          <Route path="/reset-password" element={
            isAuthenticated ? <Navigate to="/dashboard" /> : <ResetPasswordPage />
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
              <Route path="/study-contents/:id/preview" element={<RestrictedForGerenteFin><StudyContentPreviewPage /></RestrictedForGerenteFin>} />
              
              {/* Exams - Restringido para coordinador, gerente y financiero */}
              <Route path="/exams" element={<RestrictedForGerenteFin><ExamsListPage /></RestrictedForGerenteFin>} />
              <Route path="/exams/create" element={<RestrictedForGerenteFin><ExamCreatePage /></RestrictedForGerenteFin>} />
              <Route path="/exams/:id/edit" element={<RestrictedForGerenteFin><ExamEditPage /></RestrictedForGerenteFin>} />
              <Route path="/exams/:id/select-mode" element={<RestrictedForGerenteFin><ExamModeSelectorPage /></RestrictedForGerenteFin>} />
              <Route path="/exams/:id/preview/:mode" element={<RestrictedForGerenteFin><ExamPreviewPage /></RestrictedForGerenteFin>} />
              <Route path="/exams/:id/preview" element={<RestrictedForGerenteFin><ExamPreviewPage /></RestrictedForGerenteFin>} />
              <Route path="/exams/:id/onboarding/:mode" element={<RestrictedForGerenteFin><ExamOnboardingPage /></RestrictedForGerenteFin>} />
              
              {/* Categories - Restringido para coordinador, gerente y financiero */}
              <Route path="/exams/:examId/categories/:categoryId" element={<RestrictedForGerenteFin><CategoryDetailPage /></RestrictedForGerenteFin>} />
              
              {/* Topics - Restringido para coordinador, gerente y financiero */}
              <Route path="/exams/:examId/categories/:categoryId/topics/:topicId" element={<RestrictedForGerenteFin><TopicDetailPage /></RestrictedForGerenteFin>} />
              
              {/* Answers - Restringido para coordinador, gerente y financiero */}
              <Route path="/exams/:examId/categories/:categoryId/topics/:topicId/questions/:questionId/answer" element={<RestrictedForGerenteFin><TrueFalseAnswerPage /></RestrictedForGerenteFin>} />
              <Route path="/exams/:examId/categories/:categoryId/topics/:topicId/questions/:questionId/multiple-choice" element={<RestrictedForGerenteFin><MultipleChoiceAnswerPage /></RestrictedForGerenteFin>} />
              <Route path="/exams/:examId/categories/:categoryId/topics/:topicId/questions/:questionId/multiple-select" element={<RestrictedForGerenteFin><MultipleSelectAnswerPage /></RestrictedForGerenteFin>} />
              <Route path="/exams/:examId/categories/:categoryId/topics/:topicId/questions/:questionId/ordering" element={<RestrictedForGerenteFin><OrderingAnswerPage /></RestrictedForGerenteFin>} />
              <Route path="/exams/:examId/categories/:categoryId/topics/:topicId/questions/:questionId/drag-drop" element={<RestrictedForGerenteFin><DragDropAnswerPage /></RestrictedForGerenteFin>} />
              <Route path="/exams/:examId/categories/:categoryId/topics/:topicId/questions/:questionId/column-grouping" element={<RestrictedForGerenteFin><ColumnGroupingAnswerPage /></RestrictedForGerenteFin>} />
              
              {/* Study Contents - Restringido para coordinador, gerente y financiero */}
              <Route path="/study-contents" element={<RestrictedForGerenteFin><StudyContentsListPage /></RestrictedForGerenteFin>} />
              <Route path="/study-contents/create" element={<RestrictedForGerenteFin><StudyContentCreatePage /></RestrictedForGerenteFin>} />
              <Route path="/study-contents/:id" element={<RestrictedForGerenteFin><StudyContentDetailRouter /></RestrictedForGerenteFin>} />
              <Route path="/study-contents/:id/edit" element={<RestrictedForGerenteFin><StudyContentCreatePage /></RestrictedForGerenteFin>} />
              <Route path="/study-contents/:id/reading" element={<RestrictedForGerenteFin><ReadingEditorPage /></RestrictedForGerenteFin>} />
              <Route path="/study-contents/:id/video" element={<RestrictedForGerenteFin><VideoEditorPage /></RestrictedForGerenteFin>} />
              <Route path="/study-contents/:id/downloadable" element={<RestrictedForGerenteFin><DownloadableEditorPage /></RestrictedForGerenteFin>} />
              <Route path="/study-contents/:id/sessions/:sessionId/topics/:topicId/interactive" element={<RestrictedForGerenteFin><StudyInteractiveExercisePage /></RestrictedForGerenteFin>} />
              
              {/* Standards (ECM) - Restringido para coordinador, gerente y financiero */}
              <Route path="/standards" element={<RestrictedForGerenteFin><StandardsListPage /></RestrictedForGerenteFin>} />
              <Route path="/standards/new" element={<RestrictedForGerenteFin><StandardFormPage /></RestrictedForGerenteFin>} />
              <Route path="/standards/brands" element={<RestrictedForGerenteFin><BrandsListPage /></RestrictedForGerenteFin>} />
              <Route path="/standards/brands/new" element={<RestrictedForGerenteFin><BrandFormPage /></RestrictedForGerenteFin>} />
              <Route path="/standards/brands/:id/edit" element={<RestrictedForGerenteFin><BrandFormPage /></RestrictedForGerenteFin>} />
              <Route path="/standards/:id" element={<RestrictedForGerenteFin><StandardDetailPage /></RestrictedForGerenteFin>} />
              <Route path="/standards/:id/edit" element={<RestrictedForGerenteFin><StandardFormPage /></RestrictedForGerenteFin>} />
              <Route path="/standards/deletion-requests" element={<RestrictedForGerenteFin><DeletionRequestsPage /></RestrictedForGerenteFin>} />
              
              {/* Certificates - Restringido para coordinador, gerente y financiero */}
              <Route path="/certificates" element={<RestrictedForGerenteFin><CertificatesPage /></RestrictedForGerenteFin>} />
              <Route path="/certificates/evaluation-report/:examId" element={<RestrictedForGerenteFin><EvaluationReportDetailPage /></RestrictedForGerenteFin>} />
              <Route path="/certificates/evaluation-report/:examId/result/:resultId" element={<RestrictedForGerenteFin><ResultDetailPage /></RestrictedForGerenteFin>} />
              
              {/* Badges (Insignias Digitales) - Permitido para admin, developer, coordinator, editor */}
              <Route path="/badges/templates" element={<RestrictedForGerenteFinOnly><BadgeTemplatesPage /></RestrictedForGerenteFinOnly>} />
              <Route path="/badges/templates/new" element={<RestrictedForGerenteFinOnly><BadgeTemplateFormPage /></RestrictedForGerenteFinOnly>} />
              <Route path="/badges/templates/:id/edit" element={<RestrictedForGerenteFinOnly><BadgeTemplateFormPage /></RestrictedForGerenteFinOnly>} />
              
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
              {/* /partners/groups/:groupId/exams removed — handled in GroupDetailPage */}
              <Route path="/partners/groups/:groupId/documents" element={<GroupDocumentsPage />} />
              <Route path="/partners/groups/:groupId/documents/reporte" element={<GroupCertReportePage />} />
              <Route path="/partners/groups/:groupId/documents/eduit" element={<GroupCertEduitPage />} />
              <Route path="/partners/groups/:groupId/documents/conocer" element={<GroupCertConocerPage />} />
              <Route path="/partners/groups/:groupId/documents/insignia" element={<GroupCertInsigniaPage />} />
              <Route path="/partners/groups/:groupId/analytics" element={<GroupAnalyticsPage />} />
              <Route path="/partners/groups/:groupId/edit" element={<GroupFormPage />} />
              <Route path="/partners/groups/:groupId/assign-candidates" element={<GroupAssignCandidatesPage />} />
              <Route path="/partners/groups/:groupId/bulk-upload" element={<GroupBulkUploadPage />} />
              <Route path="/partners/groups/:groupId/assign-exam" element={<ExamSelectConfigPage />} />
              <Route path="/partners/groups/:groupId/assign-exam/materials" element={<ExamSelectMaterialsPage />} />
              <Route path="/partners/groups/:groupId/assign-exam/members" element={<ExamAssignMembersPage />} />
              <Route path="/partners/groups/:groupId/assign-exam/review" element={<ExamAssignmentReviewPage />} />
              <Route path="/partners/groups/:groupId/assign-materials" element={<GroupAssignMaterialsPage />} />
              <Route path="/partners/groups/:groupId/assignments/:examId/detail" element={<AssignmentDetailPage />} />
              <Route path="/partners/groups/:groupId/assignments/:assignmentId/edit-members" element={<GroupEditAssignmentMembersPage />} />
              
              {/* Asignaciones por ECM */}
              <Route path="/asignaciones-ecm" element={<EcmAssignmentsPage />} />
              <Route path="/asignaciones-ecm/:ecmId" element={<EcmAssignmentDetailPage />} />
              <Route path="/asignaciones-ecm/candidato/:ecaId" element={<CandidateAssignmentDetailPage />} />
              
              {/* Trámites CONOCER */}
              <Route path="/tramites-conocer" element={<ConocerTramitesPage />} />
              <Route path="/tramites-conocer/subir" element={<ConocerUploadPage />} />
              <Route path="/tramites-conocer/historial" element={<ConocerUploadHistoryPage />} />
              <Route path="/tramites-conocer/historial/:batchId" element={<ConocerUploadDetailPage />} />
              <Route path="/tramites-conocer/contactos" element={<ConocerContactsPage />} />
              
              {/* Responsable de Plantel */}
              <Route path="/mi-plantel" element={<MiPlantelPage />} />
              <Route path="/mi-plantel/reportes" element={<MiPlantelReportesPage />} />
              <Route path="/mi-plantel/certificados" element={<MiPlantelCertificadosPage />} />
              <Route path="/mi-plantel/grupos/:groupId" element={<MiPlantelGrupoDetailPage />} />
              
              {/* Responsable de Partner */}
              <Route path="/mi-partner" element={<ResponsablePartnerDashboard />} />
              <Route path="/mi-partner/certificados" element={<ResponsablePartnerCertificadosPage />} />
              
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
              <Route path="/gerente/delegaciones" element={<GerenteDelegacionesPage />} />
              
              {/* Coordinador - Gestión de Saldo */}
              <Route path="/mi-saldo" element={<MiSaldoPage />} />
              <Route path="/mi-saldo/solicitud/:id" element={<MiSolicitudDetailPage />} />
              <Route path="/solicitar-saldo" element={<SolicitarSaldoPage />} />
              <Route path="/solicitar-beca" element={<SolicitarBecaPage />} />
              <Route path="/historial-solicitudes" element={<HistorialSolicitudesPage />} />
              <Route path="/historial-movimientos" element={<HistorialMovimientosPage />} />
              <Route path="/historial-asignaciones" element={<HistorialAsignacionesPage />} />
              
              {/* Máquinas Virtuales - Calendario de sesiones */}
              <Route path="/vm-sessions" element={<VmSchedulingPage />} />
              
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
