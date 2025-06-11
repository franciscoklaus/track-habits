// components/HabitDetail.js
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useHabitEntries, useHabitStats } from '../services/apiService';

const HabitDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const habitId = parseInt(id);
  
  const { entries, loading: entriesLoading, addEntry } = useHabitEntries(habitId);
  const { stats, loading: statsLoading } = useHabitStats(habitId);

  const handleAddEntry = async () => {
    const notes = prompt('Adicionar notas (opcional):');
    try {
      await addEntry({ notes: notes || '' });
      alert('Entrada adicionada com sucesso!');
    } catch (err) {
      alert('Erro ao adicionar entrada: ' + err.message);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (entriesLoading || statsLoading) {
    return <div className="flex justify-center items-center h-screen">Carregando...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center mb-6">
        <button 
          onClick={() => navigate('/')}
          className="text-blue-600 hover:text-blue-700 mr-4"
        >
          ← Voltar
        </button>
        <h1 className="text-3xl font-bold">Detalhes do Hábito</h1>
      </div>

      {/* Estatísticas */}
      {stats && (
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-bold mb-4">Estatísticas</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.total_count}</div>
              <div className="text-sm text-gray-600">Total</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.current_streak}</div>
              <div className="text-sm text-gray-600">Sequência Atual</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{stats.longest_streak}</div>
              <div className="text-sm text-gray-600">Maior Sequência</div>
            </div>
          </div>
        </div>
      )}

      {/* Adicionar entrada */}
      <div className="mb-6">
        <button 
          onClick={handleAddEntry}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
        >
          Adicionar Entrada
        </button>
      </div>

      {/* Lista de entradas */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold">Histórico de Entradas</h2>
        </div>
        
        {entries.length > 0 ? (
          <div className="divide-y">
            {entries.map((entry) => (
              <div key={entry.id} className="p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                      <span className="text-sm text-gray-600">
                        {formatDate(entry.created_at)}
                      </span>
                    </div>
                    {entry.notes && (
                      <div className="ml-6">
                        <p className="text-gray-700 bg-gray-50 p-3 rounded-lg">
                          {entry.notes}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      #{entry.id}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 text-center text-gray-500">
            <div className="mb-4">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-lg">Nenhuma entrada encontrada</p>
            <p className="text-sm mt-2">Adicione sua primeira entrada para começar a acompanhar este hábito!</p>
          </div>
        )}
      </div>

      {/* Estatísticas adicionais se houver entradas */}
      {entries.length > 0 && (
        <div className="mt-6 bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-bold mb-4">Informações Adicionais</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Primeira entrada:</span>
              <div className="font-medium">
                {formatDate(entries[entries.length - 1]?.created_at)}
              </div>
            </div>
            <div>
              <span className="text-gray-600">Última entrada:</span>
              <div className="font-medium">
                {formatDate(entries[0]?.created_at)}
              </div>
            </div>
            <div>
              <span className="text-gray-600">Entradas com notas:</span>
              <div className="font-medium">
                {entries.filter(entry => entry.notes && entry.notes.trim()).length}
              </div>
            </div>
            <div>
              <span className="text-gray-600">Média por semana:</span>
              <div className="font-medium">
                {stats.total_count}
                {stats ? (stats.total_count / Math.max(1, Math.ceil((new Date() - new Date(entries[entries.length - 1]?.created_at)) / (7 * 24 * 60 * 60 * 1000)))).toFixed(1) : '0'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HabitDetail;