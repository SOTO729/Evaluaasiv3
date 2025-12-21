import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'

// Pages
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import ExamsListPage from './pages/exams/ExamsListPage'
import ExamCreatePage from './pages/exams/ExamCreatePage'
import ExamEditPage from './pages/exams/ExamEditPage'
import CategoryDetailPage from './pages/categories/CategoryDetailPage'
import TopicDetailPage from './pages/topics/TopicDetailPage'
import TrueFalseAnswerPage from './pages/answers/TrueFalseAnswerPage'
import MultipleChoiceAnswerPage from './pages/answers/MultipleChoiceAnswerPage'
import { MultipleSelectAnswerPage } from './pages/answers/MultipleSelectAnswerPage'
import { OrderingAnswerPage } from './pages/answers/OrderingAnswerPage'

// Components
import Layout from './components/layout/Layout'
import ProtectedRoute from './components/auth/ProtectedRoute'

function App() {
  const { isAuthenticated } = useAuthStore()

  return (
    <BrowserRouter>
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
            
            {/* Categories */}
            <Route path="/exams/:examId/categories/:categoryId" element={<CategoryDetailPage />} />
            
            {/* Topics */}
            <Route path="/exams/:examId/categories/:categoryId/topics/:topicId" element={<TopicDetailPage />} />
            
            {/* Answers */}
            <Route path="/exams/:examId/categories/:categoryId/topics/:topicId/questions/:questionId/answer" element={<TrueFalseAnswerPage />} />
            <Route path="/exams/:examId/categories/:categoryId/topics/:topicId/questions/:questionId/multiple-choice" element={<MultipleChoiceAnswerPage />} />
            <Route path="/exams/:examId/categories/:categoryId/topics/:topicId/questions/:questionId/multiple-select" element={<MultipleSelectAnswerPage />} />
            <Route path="/exams/:examId/categories/:categoryId/topics/:topicId/questions/:questionId/ordering" element={<OrderingAnswerPage />} />
            
            {/* Redirect root to dashboard */}
            <Route path="/" element={<Navigate to="/dashboard" />} />
          </Route>
        </Route>

        {/* 404 */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
