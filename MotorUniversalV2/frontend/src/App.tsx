import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore.tsx'

// Pages
import LoginPage from './pages/auth/LoginPage.tsx'
import RegisterPage from './pages/auth/RegisterPage.tsx'
import DashboardPage from './pages/DashboardPage.tsx'
import ExamsListPage from './pages/exams/ExamsListPage.tsx'
import ExamCreatePage from './pages/exams/ExamCreatePage.tsx'
import ExamEditPage from './pages/exams/ExamEditPage.tsx'

// Components
import Layout from './components/layout/Layout.tsx'
import ProtectedRoute from './components/auth/ProtectedRoute.tsx'

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
