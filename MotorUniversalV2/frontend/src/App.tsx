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
