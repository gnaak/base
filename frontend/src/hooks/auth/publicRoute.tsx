import { Navigate } from "react-router-dom";
import { useAuth } from "../common/useAuth";

interface PublicRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
}

export const PublicRoute = ({
  children,
  redirectTo = "/",
}: PublicRouteProps) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="w-full h-screen bg-white" />;
  }

  if (user) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
};