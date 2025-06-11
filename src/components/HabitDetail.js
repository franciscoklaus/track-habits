// components/HabitDetail.js
import {React, useState} from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useHabitEntries, useHabitStats } from '../services/apiService';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { Calendar, TrendingUp, Award, Target } from 'lucide-react';


const HabitDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const habitId = parseInt(id);
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();

  const { entries, loading: entriesLoading, addEntry } = useHabitEntries(habitId);
  const { stats, loading: statsLoading } = useHabitStats(habitId);
  
  
  const hasEntryToday = () => {
    if (!entries || entries.length === 0) return false;
    
    const today = new Date();
    const todayString = today.toDateString();
    
    return entries.some(entry => {
      const entryDate = new Date(entry.completed_at);
      return entryDate.toDateString() === todayString;
    });
  };

  const canAddEntry = !hasEntryToday();

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

  const formatDateLong = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

 

  const processDataForCharts = () => {
    const dailyData = {};
    const weeklyData = {};
    const monthlyData = {};

    entries.forEach(entry => {
      const date = new Date(entry.completed_at);
      const dayKey = date.toISOString().split('T')[0];
      const weekKey = `Semana ${Math.ceil(date.getDate() / 7)}`;
      const monthKey = date.toLocaleDateString('pt-BR', { month: 'short' });

      // Dados diários
      dailyData[dayKey] = (dailyData[dayKey] || 0) + 1;

      // Dados semanais
      weeklyData[weekKey] = (weeklyData[weekKey] || 0) + 1;

      // Dados mensais
      monthlyData[monthKey] = (monthlyData[monthKey] || 0) + 1;
    });

     if (entriesLoading || statsLoading) {
    return <div className="flex justify-center items-center h-screen">Carregando...</div>;
  }

    return {
      daily: Object.entries(dailyData).map(([date, count]) => ({
        date: new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        completions: count,
        fullDate: date
      })).sort((a, b) => new Date(a.fullDate) - new Date(b.fullDate)),

      weekly: Object.entries(weeklyData).map(([week, count]) => ({
        week,
        completions: count
      })),

      monthly: Object.entries(monthlyData).map(([month, count]) => ({
        month,
        completions: count
      }))
    };
  };

  const chartData = processDataForCharts();
  const completed = stats ? stats.total_count : 0;
  const pieData = [
    { name: 'Completado', value: completed, color: '#22c55e' },
    { name: 'Não Completado', value: 100 - completed, color: '#ef4444' }
  ];

  const [activeChart, setActiveChart] = useState('daily');

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
          disabled={!canAddEntry}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            canAddEntry 
              ? 'bg-green-600 text-white hover:bg-green-700' 
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          {canAddEntry ? 'Adicionar Entrada' : 'Já adicionado hoje'}
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
                        {formatDate(entry.completed_at)}
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
                {formatDate(entries[entries.length - 1]?.completed_at)}
              </div>
            </div>
            <div>
              <span className="text-gray-600">Última entrada:</span>
              <div className="font-medium">
                {formatDate(entries[0]?.completed_at)}
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
                {stats ? (stats.total_count / Math.max(1, Math.ceil((new Date() - new Date(entries[entries.length - 1]?.completed_at)) / (7 * 24 * 60 * 60 * 1000)))).toFixed(1) : '0'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Entrada Real se houver entradas*/}
      {entries.length > 0 && (
        <div className="mt-8 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold mb-4">📝 Suas Entradas Reais</h3>

        {entries.map((entry) => (
        <div key={entry.id} className="bg-blue-50 p-4 rounded-lg border border-blue-200 mb-4">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <div className="w-3 h-3 bg-blue-500 rounded-full mt-2"></div>
            </div>
            <div>
              <p className="font-medium text-blue-900">
                {new Date(entry.completed_at).toLocaleDateString('pt-BR', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
              <p className="text-blue-700 text-sm mt-1">Notas: {entry.notes}</p>
              <div className="mt-2 flex items-center space-x-4 text-xs text-blue-600">
                <span>ID: {entry.id}</span>
                <span>Hábito: {entry.habit_id}</span>
              </div>
            </div>
          </div>
        </div>
        ))}
      </div>
      )}
      <br/>

     
      {/* Seletor de Gráfico */}
      {entries.length > 0 && (
      <div className="mb-6">
        <div className="flex space-x-2 bg-white p-1 rounded-lg shadow-sm border border-gray-200 w-fit">
          {[
            { key: 'daily', label: 'Diário' },
            { key: 'weekly', label: 'Semanal' },
            { key: 'monthly', label: 'Mensal' },
            { key: 'completion', label: 'Taxa de Conclusão' }
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveChart(key)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeChart === key
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      )}
      
      {/* Gráficos */}
      {entries.length > 0 && (
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        {activeChart === 'daily' && (
          <div>
            <h3 className="text-lg font-semibold mb-4">📈 Conclusões Diárias</h3>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={chartData.daily}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={(label) => `Data: ${label}`}
                  formatter={(value) => [value, 'Conclusões']}
                />
                <Line 
                  type="monotone" 
                  dataKey="completions" 
                  stroke="#3b82f6" 
                  strokeWidth={3}
                  dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {activeChart === 'weekly' && (
          <div>
            <h3 className="text-lg font-semibold mb-4">📊 Conclusões Semanais</h3>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={chartData.weekly}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="completions" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {activeChart === 'monthly' && (
          <div>
            <h3 className="text-lg font-semibold mb-4">📅 Conclusões Mensais</h3>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={chartData.monthly}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="completions" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {activeChart === 'completion' && (
          <div>
            <h3 className="text-lg font-semibold mb-4">🎯 Taxa de Conclusão</h3>
            <div className="flex justify-center">
              <ResponsiveContainer width={400} height={400}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={150}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `${value}%`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center space-x-6 mt-4">
              {pieData.map((entry, index) => (
                <div key={index} className="flex items-center">
                  <div 
                    className="w-4 h-4 rounded mr-2"
                    style={{ backgroundColor: entry.color }}
                  ></div>
                  <span className="text-sm text-gray-600">
                    {entry.name}: {entry.value}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      )}
      


    </div>
                
  );
};

export default HabitDetail;