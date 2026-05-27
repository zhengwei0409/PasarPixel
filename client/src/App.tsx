import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import MarketplacePage from './pages/MarketplacePage';
import AssetDetailPage from './pages/AssetDetailPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import AuthCallback from './pages/AuthCallback';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import ProtectedRoute from './components/ProtectedRoute';
import ProfilePage from './pages/ProfilePage';
import SellerApplicationPage from './pages/SellerApplicationPage';
import SellerUploadPage from './pages/SellerUploadPage';
import MySellerListingsPage from './pages/MySellerListingsPage';
import AdminApplicationsPage from './pages/AdminApplicationsPage';
import AdminAssetReviewPage from './pages/AdminAssetReviewPage';
import ForbiddenPage from './pages/ForbiddenPage';
import Navbar from './components/layout/Navbar';


function App() {
  return (
    <>
    <Navbar />
    <Routes>
      <Route path='/' element={<HomePage/>} />
      <Route path='/marketplace' element={<MarketplacePage/>} />
      <Route path='/assets/:id' element={<AssetDetailPage/>} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/forbidden" element={<ForbiddenPage />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Route>

      <Route element={<ProtectedRoute allowedRoles={["BUYER"]} />}>
        <Route path="/seller-application" element={<SellerApplicationPage />} />
      </Route>

      <Route element={<ProtectedRoute allowedRoles={["SELLER"]} />}>
        <Route path="/seller/upload" element={<SellerUploadPage />} />
        <Route path="/seller/upload/:assetId" element={<SellerUploadPage />} />
        <Route path="/seller/listings" element={<MySellerListingsPage />} />
      </Route>

      <Route element={<ProtectedRoute allowedRoles={["ADMIN"]} />}>
        <Route path="/admin/applications" element={<AdminApplicationsPage />} />
        <Route path="/admin/assets/pending" element={<AdminAssetReviewPage />} />
      </Route>
    </Routes>
    </>
  )
}

export default App
