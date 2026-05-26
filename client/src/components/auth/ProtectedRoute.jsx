import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

function ProtectedRoute({ children, allowedRoles }) {
  const location = useLocation();
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <section className="mx-auto w-[min(1120px,calc(100%-32px))] py-12">
        <div className="h-56 animate-pulse rounded-[28px] border border-black/5 bg-white/50" />
      </section>
    );
  }

  if (!isAuthenticated) {
    return <Navigate replace state={{ from: location }} to="/login" />;
  }

  if (allowedRoles?.length && !allowedRoles.includes(user.role)) {
    return <Navigate replace to="/" />;
  }

  return children;
}

export default ProtectedRoute;
