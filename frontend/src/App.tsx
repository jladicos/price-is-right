import { Routes, Route } from 'react-router-dom';
import RootPage from './pages/RootPage';
import WelcomePage from './pages/WelcomePage';
import AdminPage from './pages/AdminPage';
import HostControlPage from './pages/HostControlPage';
import GameViewPage from './pages/GameViewPage';
import ProtectedRoute from './components/ProtectedRoute';
import { Toaster } from './components/ui/toaster';

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<RootPage />} />
        <Route
          path="/welcome"
          element={
            <ProtectedRoute>
              <WelcomePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute requireRole="host">
              <AdminPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/host/game-control"
          element={
            <ProtectedRoute requireRole="host">
              <HostControlPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/game"
          element={
            <ProtectedRoute>
              <GameViewPage />
            </ProtectedRoute>
          }
        />
      </Routes>
      <Toaster />
    </>
  );
}

export default App;
