import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { useAuthStore } from './store/authStore'
import LoadingSpinner from './components/LoadingSpinner'

// Eager imports (necesarios inmediatamente)
import Layout from './components/layout/Layout'
import ProtectedRoute from './components/auth/ProtectedRoute'

// Lazy imports (cargados bajo demanda)
const LoginPage = lazy(() => import('./pages/auth/LoginPage'))
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const ExamsListPage = lazy(() => import('./pages/exams/ExamsListPage'))
const ExamCreatePage = lazy(() => import('./pages/exams/ExamCreatePage'))
const ExamEditPage = lazy(() => import('./pages/exams/ExamEditPage'))
const CategoryDetailPage = lazy(() => import('./pages/categories/CategoryDetailPage'))
const TopicDetailPage = lazy(() => import('./pages/topics/TopicDetailPage'))
const TrueFalseAnswerPage = lazy(() => import('./pages/answers/TrueFalseAnswerPage'))
const MultipleChoiceAnswerPage = lazy(() => import('./pages/answers/MultipleChoiceAnswerPage'))
const MultipleSelectAnswerPage = lazy(() => import('./pages/answers/MultipleSelectAnswerPage').then(module => ({ default: module.MultipleSelectAnswerPage })))
const OrderingAnswerPage = lazy(() => import('./pages/answers/OrderingAnswerPage').then(module => ({ default: module.OrderingAnswerPage })))
const ExamTestListPage = lazy(() => import('./pages/ExamTestListPage'))
const ExamTestRunPage = lazy(() => import('./pages/ExamTestRunPage'))
const ExamTestResultsPage = lazy(() => import('./pages/ExamTestResultsPage'))

// Study Contents
const StudyContentsListPage = lazy(() => import('./pages/study-contents/StudyContentsListPage'))
const StudyContentCreatePage = lazy(() => import('./pages/study-contents/StudyContentCreatePage'))
const StudyContentDetailPage = lazy(() => import('./pages/study-contents/StudyContentDetailPage'))
const StudyInteractiveExercisePage = lazy(() => import('./pages/study-contents/StudyInteractiveExercisePage'))

function App() {
  const { isAuthenticated } = useAuthStore()

  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingSpinner message="Cargando..." fullScreen />}>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={
            isAuthenticated ? <Navigate to="/dashboard" /> : <LoginPage />
          } />
          <Route path="/register" element={
            isAuthenticated ? <Navigate to="/dashboard" /> : <RegisterPage />
          } />

          {/* Protected routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              
              {/* Exams */}
              <Route path="/exams" element={<ExamsListPage />} />
              <Route path="/exams/create" element={<ExamCreatePage />} />
              <Route path="/exams/:id/edit" element={<ExamEditPage />} />
              
              {/* Exam Testing */}
              <Route path="/test-exams" element={<ExamTestListPage />} />
              <Route path="/test-exams/:examId/run" element={<ExamTestRunPage />} />
              <Route path="/test-exams/:examId/results" element={<ExamTestResultsPage />} />
              
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
              <Route path="/study-contents/:id" element={<StudyContentDetailPage />} />
              <Route path="/study-contents/:id/edit" element={<StudyContentCreatePage />} />
              <Route path="/study-contents/:id/sessions/:sessionId/topics/:topicId/interactive" element={<StudyInteractiveExercisePage />} />
              
              {/* Redirect root to dashboard */}
              <Route path="/" element={<Navigate to="/dashboard" />} />
            </Route>
          </Route>

          {/* 404 */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App
