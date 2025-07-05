import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ApiProvider, useApi } from './services/apiService';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import HabitDetail from './components/HabitDetail';
import './index.css'
import './App.css';


// Componente para rotas protegidas
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useApi();
  
  if (loading) {
    return <div className="flex justify-center items-center h-screen">Carregando...</div>;
  }
  
  return isAuthenticated ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <ApiProvider>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/habit/:id" element={
              <ProtectedRoute>
                <HabitDetail />
              </ProtectedRoute>
            } />
          </Routes>
        </div>
      </Router>
    </ApiProvider>
  );
}

export default App;