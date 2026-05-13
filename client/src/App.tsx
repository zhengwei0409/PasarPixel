import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import AuthCallback from './pages/AuthCallback';
import ProtectedRoute from './components/ProtectedRoute';


function App() {
  return (
    <Routes>
      <Route path='/' element={<HomePage/>} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route path="/auth/callback" element={<AuthCallback />} />
    </Routes>
  )
}

export default App
