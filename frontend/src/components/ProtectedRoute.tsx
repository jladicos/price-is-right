import { Navigate } from 'react-router-dom';
import { Center, Spinner } from '@chakra-ui/react';
import { useAuthStore } from '../store/authStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireRole?: 'host' | 'player' | 'audience';
}

export default function ProtectedRoute({ children, requireRole }: ProtectedRouteProps) {
  const { sessionToken, currentPlayer, loading } = useAuthStore();

  // If we're still loading (validating session), show spinner
  if (loading) {
    return (
      <Center h="100vh">
        <Spinner size="xl">Loading</Spinner>
      </Center>
    );
  }

  // If no session token or no current player, redirect to login
  if (!sessionToken || !currentPlayer) {
    return <Navigate to="/" replace />;
  }

  // If a specific role is required, check if user has it
  if (requireRole && currentPlayer.role !== requireRole) {
    // Redirect to welcome page with error state
    return (
      <Navigate
        to="/welcome"
        state={{ error: 'You do not have permission to access this page' }}
        replace
      />
    );
  }

  // User is authenticated and has required role (if specified), render the protected content
  return <>{children}</>;
}
