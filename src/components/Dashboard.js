import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi, useHabits } from '../services/apiService';

const Dashboard = () => {
  const { user, logout } = useApi();
  const { habits, loading, error, createHabit, deleteHabit, completeHabit } = useHabits();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newHabit, setNewHabit] = useState({ name: '', description: '' });

  const handleCreateHabit = async (e) => {
    e.preventDefault();
    try {
      await createHabit(newHabit);
      setNewHabit({ name: '', description: '' });
      setShowCreateForm(false);
    } catch (err) {
      console.error('Erro ao criar hábito:', err);
    }
  };

  const handleCompleteHabit = async (habitId) => {
    try {
      await completeHabit(habitId);
      alert('Hábito completado!');
    } catch (err) {
      alert('Erro ao completar hábito: ' + err.message);
    }
  };

  const handleDeleteHabit = async (habitId) => {
    if (window.confirm('Tem certeza que deseja excluir este hábito?')) {
      try {
        await deleteHabit(habitId);
      } catch (err) {
        alert('Erro ao excluir hábito: ' + err.message);
      }
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen">Carregando...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Meus Hábitos</h1>
          <p className="text-gray-600">Olá, {user?.username}!</p>
        </div>
        <button
          onClick={logout}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
        >
          Sair
        </button>
      </div>

      {/* Botão criar hábito */}
      <div className="mb-6">
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          {showCreateForm ? 'Cancelar' : 'Novo Hábito'}
        </button>
      </div>

      {/* Formulário criar hábito */}
      {showCreateForm && (
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-bold mb-4">Criar Novo Hábito</h2>
          <form onSubmit={handleCreateHabit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Nome</label>
              <input
                type="text"
                required
                value={newHabit.name}
                onChange={(e) => setNewHabit(prev => ({ ...prev, name: e.target.value }))}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Descrição</label>
              <textarea
                value={newHabit.description}
                onChange={(e) => setNewHabit(prev => ({ ...prev, description: e.target.value }))}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                rows="3"
              />
            </div>
            <div className="flex space-x-2">
              <button
                type="submit"
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                Criar
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista de hábitos */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {habits.map(habit => (
          <div key={habit.id} className="bg-white p-6 rounded-lg shadow">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{habit.name}</h3>
                {habit.description && (
                  <p className="text-gray-600 text-sm mt-1">{habit.description}</p>
                )}
              </div>
              <span className={`px-2 py-1 text-xs rounded-full ${
                habit.is_active 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {habit.is_active ? 'Ativo' : 'Inativo'}
              </span>
            </div>

            <div className="flex space-x-2">
              <button
                onClick={() => handleCompleteHabit(habit.id)}
                className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
              >
                Completar
              </button>
              <Link
                to={`/habit/${habit.id}`}
                className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
              >
                Detalhes
              </Link>
              <button
                onClick={() => handleDeleteHabit(habit.id)}
                className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
              >
                Excluir
              </button>
            </div>
          </div>
        ))}
      </div>

      {habits.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-500">Nenhum hábito encontrado. Crie seu primeiro hábito!</p>
        </div>
      )}
    </div>
  );
};

export default Dashboard;