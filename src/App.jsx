import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { SettingsProvider } from './contexts/SettingsContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Rooms from './pages/Rooms';
import Calendar from './pages/Calendar';
import Bookings from './pages/Bookings';
import Guests from './pages/Guests';
import Finance from './pages/Finance';
import Organization from './pages/Organization';
import Areas from './pages/Areas';
import Tasks from './pages/Tasks';
import './i18n';

function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register/:token" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/" element={
            <ProtectedRoute>
              <Layout><Dashboard /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/calendar" element={
            <ProtectedRoute>
              <Layout><Calendar /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/bookings" element={
            <ProtectedRoute>
              <Layout><Bookings /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/rooms" element={
            <ProtectedRoute>
              <Layout><Rooms /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/guests" element={
            <ProtectedRoute>
              <Layout><Guests /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/finance" element={
            <ProtectedRoute>
              <Layout><Finance /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/organization" element={
            <ProtectedRoute>
              <Layout><Organization /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/areas" element={
            <ProtectedRoute>
              <Layout><Areas /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/tasks" element={
            <ProtectedRoute>
              <Layout><Tasks /></Layout>
            </ProtectedRoute>
          } />
        </Routes>
        </Router>
      </SettingsProvider>
    </AuthProvider>
  );
}

export default App;
