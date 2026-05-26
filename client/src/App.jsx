import { Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import AppShell from "./components/layout/AppShell";
import AccountSettingsPage from "./pages/AccountSettingsPage";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import BecomeHelperPage from "./pages/BecomeHelperPage";
import BookingDetailsPage from "./pages/BookingDetailsPage";
import BookingsPage from "./pages/BookingsPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import HelperDashboardPage from "./pages/HelperDashboardPage";
import HelperDetailsPage from "./pages/HelperDetailsPage";
import HelpersPage from "./pages/HelpersPage";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import NotFoundPage from "./pages/NotFoundPage";
import RegisterPage from "./pages/RegisterPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";

function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route
          path="/account"
          element={
            <ProtectedRoute>
              <AccountSettingsPage />
            </ProtectedRoute>
          }
        />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route
          path="/admin-dashboard"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <AdminDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/become-helper"
          element={
            <ProtectedRoute allowedRoles={["helper", "admin"]}>
              <BecomeHelperPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/helper-dashboard"
          element={
            <ProtectedRoute allowedRoles={["helper", "admin"]}>
              <HelperDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route path="/helpers" element={<HelpersPage />} />
        <Route path="/helpers/:helperId" element={<HelperDetailsPage />} />
        <Route
          path="/bookings"
          element={
            <ProtectedRoute allowedRoles={["customer", "admin"]}>
              <BookingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/bookings/:bookingId"
          element={
            <ProtectedRoute>
              <BookingDetailsPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AppShell>
  );
}

export default App;
