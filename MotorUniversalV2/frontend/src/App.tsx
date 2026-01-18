import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { useAuthStore } from './store/authStore'
import LoadingSpinner from './components/LoadingSpinner'
import InactivityWatcher from './components/InactivityWatcher'

// Eager imports (necesarios inmediatamente)
import Layout from './components/layout/Layout'
import ProtectedRoute from './components/auth/ProtectedRoute'

// Lazy imports (cargados bajo demanda)
const LandingPage = lazy(() => import('./pages/landing/LandingPage'))
const PrivacyPolicyPage = lazy(() => import('./pages/landing/PrivacyPolicyPage'))
const PrivacyPolicyFullPage = lazy(() => import('./pages/landing/PrivacyPolicyFullPage'))
const TermsOfServicePage = lazy(() => import('./pages/landing/TermsOfServicePage'))
const LoginPage = lazy(() => import('./pages/auth/LoginPage'))
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'))
const HomePage = lazy(() => import('./pages/HomePage'))
const ExamsListPage = lazy(() => import('./pages/exams/ExamsListPage'))
const ExamCreatePage = lazy(() => import('./pages/exams/ExamCreatePage'))
const ExamEditPage = lazy(() => import('./pages/exams/ExamEditPage'))
const CategoryDetailPage = lazy(() => import('./pages/categories/CategoryDetailPage'))
const TopicDetailPage = lazy(() => import('./pages/topics/TopicDetailPage'))
const TrueFalseAnswerPage = lazy(() => import('./pages/answers/TrueFalseAnswerPage'))
const MultipleChoiceAnswerPage = lazy(() => import('./pages/answers/MultipleChoiceAnswerPage'))
const MultipleSelectAnswerPage = lazy(() => import('./pages/answers/MultipleSelectAnswerPage').then(module => ({ default: module.MultipleSelectAnswerPage })))
const OrderingAnswerPage = lazy(() => import('./pages/answers/OrderingAnswerPage').then(module => ({ default: module.OrderingAnswerPage })))
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

// Componente que decide qué página de detalle mostrar según el rol
const StudyContentDetailRouter = () => {
  const { user } = useAuthStore()
  return user?.role === 'candidato' ? <StudyContentCandidatePage /> : <StudyContentDetailPage />
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

function App() {
  const { isAuthenticated } = useAuthStore()

  return (
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
            <Route path="/test-exams/:examId/results" element={<ExamTestResultsPage />} />
            
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<HomePage />} />
              
              {/* Study Contents Preview - con navbar */}
              <Route path="/study-contents/:id/preview" element={<StudyContentPreviewPage />} />
              
              {/* Exams */}
              <Route path="/exams" element={<ExamsListPage />} />
              <Route path="/exams/create" element={<ExamCreatePage />} />
              <Route path="/exams/:id/edit" element={<ExamEditPage />} />
              <Route path="/exams/:id/select-mode" element={<ExamModeSelectorPage />} />
              <Route path="/exams/:id/preview/:mode" element={<ExamPreviewPage />} />
              <Route path="/exams/:id/preview" element={<ExamPreviewPage />} />
              <Route path="/exams/:id/onboarding/:mode" element={<ExamOnboardingPage />} />
              
              {/* Categories */}
              <Route path="/exams/:examId/categories/:categoryId" element={<CategoryDetailPage />} />
              
              {/* Topics */}
              <Route path="/exams/:examId/categories/:categoryId/topics/:topicId" element={<TopicDetailPage />} />
              
              {/* Answers */}
              <Route path="/exams/:examId/categories/:categoryId/topics/:topicId/questions/:questionId/answer" element={<TrueFalseAnswerPage />} />
              <Route path="/exams/:examId/categories/:categoryId/topics/:topicId/questions/:questionId/multiple-choice" element={<MultipleChoiceAnswerPage />} />
              <Route path="/exams/:examId/categories/:categoryId/topics/:topicId/questions/:questionId/multiple-select" element={<MultipleSelectAnswerPage />} />
              <Route path="/exams/:examId/categories/:categoryId/topics/:topicId/questions/:questionId/ordering" element={<OrderingAnswerPage />} />
              
              {/* Study Contents */}
              <Route path="/study-contents" element={<StudyContentsListPage />} />
              <Route path="/study-contents/create" element={<StudyContentCreatePage />} />
              <Route path="/study-contents/:id" element={<StudyContentDetailRouter />} />
              <Route path="/study-contents/:id/edit" element={<StudyContentCreatePage />} />
              
              {/* Standards (ECM) */}
              <Route path="/standards" element={<StandardsListPage />} />
              <Route path="/standards/new" element={<StandardFormPage />} />
              <Route path="/standards/deletion-requests" element={<DeletionRequestsPage />} />
              <Route path="/standards/:id" element={<StandardDetailPage />} />
              <Route path="/standards/:id/edit" element={<StandardFormPage />} />
              <Route path="/study-contents/:id/sessions/:sessionId/topics/:topicId/interactive" element={<StudyInteractiveExercisePage />} />
              
              {/* Certificates */}
              <Route path="/certificates" element={<CertificatesPage />} />
              <Route path="/certificates/evaluation-report/:examId" element={<EvaluationReportDetailPage />} />
              <Route path="/certificates/evaluation-report/:examId/result/:resultId" element={<ResultDetailPage />} />
            </Route>
          </Route>

          {/* 404 */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Suspense>
      </InactivityWatcher>
    </BrowserRouter>
  )
}

export default App
