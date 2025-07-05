// components/HabitDetail.js
import {React, useState, useEffect} from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useHabitEntries, useHabitStats, useApi } from '../services/apiService';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

// Constantes para categorias e ícones
const CATEGORIES = [
  { value: 'geral', label: 'Geral' },
  { value: 'saude', label: 'Saúde' },
  { value: 'exercicio', label: 'Exercício' },
  { value: 'estudo', label: 'Estudo' },
  { value: 'trabalho', label: 'Trabalho' },
  { value: 'lazer', label: 'Lazer' },
  { value: 'financas', label: 'Finanças' }
];

const ICONS = [
  { value: 'target', label: '🎯 Alvo' },
  { value: 'water', label: '💧 Água' },
  { value: 'book', label: '📚 Livro' },
  { value: 'exercise', label: '💪 Exercício' },
  { value: 'meditation', label: '🧘 Meditação' },
  { value: 'sleep', label: '😴 Sono' },
  { value: 'work', label: '💼 Trabalho' },
  { value: 'money', label: '💰 Dinheiro' },
  { value: 'heart', label: '❤️ Coração' },
  { value: 'star', label: '⭐ Estrela' }
];

const GOAL_TYPES = [
  { value: 'streak', label: 'Sequência de dias' },
  { value: 'count', label: 'Número de vezes por dia' },
  { value: 'weekly', label: 'Vezes por semana' },
  { value: 'monthly', label: 'Vezes por mês' }
];


const HabitDetail = () => {
  const [messages, setMessages] = useState([]);
  const [habit, setHabit] = useState(null);
  const [loadingHabit, setLoadingHabit] = useState(true);
  
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEntriesExpanded, setIsEntriesExpanded] = useState(false); // Começa expandido
  const [isStatsExpanded, setIsStatsExpanded] = useState(true); // Começa expandido
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEntryNotes, setNewEntryNotes] = useState('');
  const { id } = useParams();
  const navigate = useNavigate();
  const habitId = parseInt(id);
  const { api } = useApi();

  const { entries, loading: entriesLoading, addEntry, deleteEntry } = useHabitEntries(habitId);
  const { stats, loading: statsLoading, fetchStats } = useHabitStats(habitId);
  const [activeChart, setActiveChart] = useState('daily');

  // Função para obter emoji do ícone
  const getIconEmoji = (iconValue) => {
    const icon = ICONS.find(i => i.value === iconValue);
    return icon ? icon.label.split(' ')[0] : '🎯';
  };

  // Função para obter label da categoria
  const getCategoryLabel = (categoryValue) => {
    const category = CATEGORIES.find(cat => cat.value === categoryValue);
    return category ? category.label : 'Geral';
  };

  // Função para obter label do tipo de meta
  const getGoalTypeLabel = (goalType) => {
    const type = GOAL_TYPES.find(t => t.value === goalType);
    return type ? type.label : 'Sequência de dias';
  };

  // Função para calcular progresso da meta
  const calculateGoalProgress = () => {
    if (!habit || !habit.goal || habit.goal === 0 || !entries) return null;

    const today = new Date();
    
    switch (habit.goal_type) {
      case 'count': {
        // Contar entradas de hoje
        const todayEntries = entries.filter(entry => {
          const entryDate = new Date(entry.completed_at).toDateString();
          return entryDate === today.toDateString();
        }).length;
        return { 
          current: todayEntries, 
          target: habit.goal, 
          percentage: Math.min((todayEntries / habit.goal) * 100, 100),
          label: 'hoje'
        };
      }
      case 'weekly': {
        // Contar entradas desta semana
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        const weekEntries = entries.filter(entry => {
          const entryDate = new Date(entry.completed_at);
          return entryDate >= startOfWeek;
        }).length;
        return { 
          current: weekEntries, 
          target: habit.goal, 
          percentage: Math.min((weekEntries / habit.goal) * 100, 100),
          label: 'esta semana'
        };
      }
      case 'monthly': {
        // Contar entradas deste mês
        const monthEntries = entries.filter(entry => {
          const entryDate = new Date(entry.completed_at);
          return entryDate.getMonth() === today.getMonth() && entryDate.getFullYear() === today.getFullYear();
        }).length;
        return { 
          current: monthEntries, 
          target: habit.goal, 
          percentage: Math.min((monthEntries / habit.goal) * 100, 100),
          label: 'este mês'
        };
      }
      case 'streak':
      default: {
        // Usar current_streak das estatísticas
        const currentStreak = stats?.current_streak || 0;
        return { 
          current: currentStreak, 
          target: habit.goal, 
          percentage: Math.min((currentStreak / habit.goal) * 100, 100),
          label: 'sequência atual'
        };
      }
    }
  };

  // Buscar informações do hábito
  useEffect(() => {
    const fetchHabit = async () => {
      try {
        setLoadingHabit(true);
        const habitData = await api.getHabit(habitId);
        setHabit(habitData);
      } catch (err) {
        console.error('Erro ao buscar hábito:', err);
        setMessages(prev => [...prev, { type: 'error', text: 'Erro ao carregar informações do hábito' }]);
      } finally {
        setLoadingHabit(false);
      }
    };

    if (habitId) {
      fetchHabit();
    }
  }, [habitId, api]);
  
  // Fechar modal com Escape
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        if (showDeleteModal) {
          setShowDeleteModal(false);
          setEntryToDelete(null);
        }
        if (showAddModal) {
          setShowAddModal(false);
          setNewEntryNotes('');
        }
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showDeleteModal, showAddModal]);
  
  // Verificar se está carregando
  if (entriesLoading || statsLoading || loadingHabit) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex justify-center items-center">
        <div className="bg-white p-8 rounded-2xl shadow-xl">
          <div className="flex items-center space-x-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="text-lg font-medium text-gray-700">Carregando detalhes...</span>
          </div>
        </div>
      </div>
    );
  }
  
  
  const hasEntryToday = () => {
    if (!entries || entries.length === 0) return false;
    
    const today = new Date();
    const todayString = today.toDateString();
    
    return entries.some(entry => {
      const entryDate = new Date(entry.completed_at);
      return entryDate.toDateString() === todayString;
    });
  };

  // Função para verificar se pode adicionar entrada
  const canAddEntry = () => {
    // Se o hábito não foi carregado ainda, não permitir
    if (!habit) return false;
    
    // Se permite múltiplas atualizações, sempre pode adicionar
    if (habit.multipleUpdate) {
      return true;
    }
    
    // Se não permite múltiplas atualizações, só pode adicionar se não tem entrada hoje
    return !hasEntryToday();
  };

  const handleAddEntry = async () => {
    setShowAddModal(true);
  };

  const confirmAddEntry = async () => {
    try {
      await addEntry({ notes: newEntryNotes || '' });
      // Recarregar as estatísticas após adicionar a entrada
      await fetchStats();
      setMessages(prev => [...prev, { type: 'success', text: 'Entrada adicionada com sucesso!' }]);
      setTimeout(() => {
        setMessages(prev => prev.filter(msg => msg.text !== 'Entrada adicionada com sucesso!'));
      }, 3000);
    } catch (err) {
      setMessages(prev => [...prev, { type: 'error', text: 'Erro ao adicionar entrada: ' + err.message }]);
      setTimeout(() => {
        setMessages(prev => prev.filter(msg => msg.text.includes('Erro ao adicionar entrada')));
      }, 3000);
    } finally {
      setShowAddModal(false);
      setNewEntryNotes('');
    }
  };

  const cancelAddEntry = () => {
    setShowAddModal(false);
    setNewEntryNotes('');
  };

  const handleDeleteEntry = async (entryId, date) => {
    setEntryToDelete({ id: entryId, date: date });
    setShowDeleteModal(true);
  };

  const confirmDeleteEntry = async () => {
    if (!entryToDelete) return;
    
    try {
      await deleteEntry(entryToDelete.id);
      // Recarregar as estatísticas após deletar a entrada
      await fetchStats();
      setMessages(prev => [...prev, { type: 'success', text: 'Entrada deletada com sucesso!' }]);
      setTimeout(() => {
        setMessages(prev => prev.filter(msg => msg.text !== 'Entrada deletada com sucesso!'));
      }, 3000);
    } catch (err) {
      setMessages(prev => [...prev, { type: 'error', text: 'Erro ao deletar entrada: ' + err.message }]);
      setTimeout(() => {
        setMessages(prev => prev.filter(msg => msg.text.includes('Erro ao deletar entrada')));
      }, 3000);
    } finally {
      setShowDeleteModal(false);
      setEntryToDelete(null);
    }
  };

  const cancelDeleteEntry = () => {
    setShowDeleteModal(false);
    setEntryToDelete(null);
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

  // Verificar se está carregando
  if (entriesLoading || statsLoading) {
    return <div className="flex justify-center items-center h-screen">Carregando...</div>;
  }

  const chartData = processDataForCharts();
  const completed = stats ? stats.total_count : 0;
  
  // Obter o mês e ano atual
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  // Calcular o total de dias no mês atual
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();

  // Calcular a porcentagem baseada nos dias do mês
  const completedPercentage = Math.round((completed / totalDaysInMonth) * 100);
  const notCompletedPercentage = 100 - completedPercentage;

  const pieData = [
    { name: 'Completado', value: completedPercentage, color: '#374151' },
    { name: 'Não Completado', value: notCompletedPercentage, color: '#d1d5db' }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <button 
              onClick={() => navigate('/')}
              className="bg-white text-gray-700 hover:text-gray-900 hover:bg-gray-100 border border-gray-300 px-6 py-3 rounded-lg font-medium transition-all duration-200 shadow-sm mr-6 flex items-center space-x-2"
            >
              <span>←</span>
              <span>Voltar</span>
            </button>
            <div>
              <div className="flex items-center gap-4 mb-2">
                {habit?.icon && (
                  <span className="text-4xl">{getIconEmoji(habit.icon)}</span>
                )}
                <div>
                  <h1 className="text-4xl font-bold text-gray-800">
                    {habit?.name || 'Detalhes do Hábito'}
                  </h1>
                  {habit?.category && (
                    <span className="text-sm text-gray-500 font-medium">
                      {getCategoryLabel(habit.category)}
                    </span>
                  )}
                </div>
              </div>
              {habit?.description && (
                <p className="text-gray-600 mt-2 text-lg">{habit.description}</p>
              )}
            </div>
          </div>
          
          {habit && (
            <div className="flex flex-col items-end space-y-2">
              <span className={`px-4 py-2 text-sm font-medium rounded-lg border ${
                habit.is_active 
                  ? 'bg-gray-100 text-gray-800 border-gray-300' 
                  : 'bg-gray-50 text-gray-600 border-gray-200'
              }`}>
                {habit.is_active ? 'Ativo' : 'Inativo'}
              </span>
              <span className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-100 text-gray-700 border border-gray-300">
                {habit.multipleUpdate ? 'Múltiplas/dia' : 'Uma vez/dia'}
              </span>
              {habit.reminder_enabled && (
                <span className="px-4 py-2 text-sm font-medium rounded-lg bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-2">
                  🔔 {habit.reminder_time}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Mensagens */}
        {messages.length > 0 && (
          <div className={`rounded-lg px-6 py-4 mb-8 shadow-sm border ${
            messages.some(msg => msg.type === 'error') 
              ? 'bg-red-50 border-red-200 text-red-700' 
              : 'bg-green-50 border-green-200 text-green-700'
          }`}>
            <div className="flex items-center">
              <div>
                {messages.map((msg, index) => (
                  <div key={index} className="mb-1 last:mb-0 font-medium">
                    {msg.text}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Meta e Progresso */}
        {habit && (() => {
          const goalProgress = calculateGoalProgress();
          return goalProgress && (
            <div className="bg-white p-8 rounded-lg shadow-sm mb-8 border border-gray-200">
              <h2 className="text-2xl font-bold mb-6 text-gray-800 flex items-center gap-3">
                🎯 Meta do Hábito
              </h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Informações da Meta */}
                <div className="space-y-4">
                  <div className="bg-gray-50 p-6 rounded-lg border border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Configuração da Meta</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Tipo de Meta:</span>
                        <span className="font-medium text-gray-800">{getGoalTypeLabel(habit.goal_type)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Objetivo:</span>
                        <span className="font-bold text-gray-800">{habit.goal}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Progresso {goalProgress.label}:</span>
                        <span className="font-bold text-gray-800">
                          {goalProgress.current} de {goalProgress.target}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Status da Meta */}
                  <div className={`p-4 rounded-lg border-2 ${
                    goalProgress.percentage >= 100 
                      ? 'bg-green-50 border-green-200 text-green-800'
                      : goalProgress.percentage >= 70
                      ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
                      : 'bg-blue-50 border-blue-200 text-blue-800'
                  }`}>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">
                        {goalProgress.percentage >= 100 ? '🎉' : goalProgress.percentage >= 70 ? '🔥' : '💪'}
                      </span>
                      <span className="font-medium">
                        {goalProgress.percentage >= 100 
                          ? 'Meta alcançada! Parabéns!'
                          : goalProgress.percentage >= 70
                          ? 'Quase lá! Continue assim!'
                          : 'Continue firme em direção à sua meta!'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Barra de Progresso Visual */}
                <div className="flex flex-col justify-center">
                  <div className="text-center mb-6">
                    <div className="text-5xl font-bold text-gray-800 mb-2">
                      {Math.round(goalProgress.percentage)}%
                    </div>
                    <p className="text-gray-600">da meta alcançada</p>
                  </div>
                  
                  {/* Barra de progresso circular */}
                  <div className="relative w-48 h-48 mx-auto">
                    <svg className="transform -rotate-90 w-48 h-48">
                      {/* Círculo de fundo */}
                      <circle
                        cx="96"
                        cy="96"
                        r="88"
                        stroke="currentColor"
                        strokeWidth="8"
                        fill="transparent"
                        className="text-gray-200"
                      />
                      {/* Círculo de progresso */}
                      <circle
                        cx="96"
                        cy="96"
                        r="88"
                        stroke="currentColor"
                        strokeWidth="8"
                        fill="transparent"
                        strokeDasharray={`${2 * Math.PI * 88}`}
                        strokeDashoffset={`${2 * Math.PI * 88 * (1 - goalProgress.percentage / 100)}`}
                        className={
                          goalProgress.percentage >= 100 
                            ? 'text-green-500'
                            : goalProgress.percentage >= 70
                            ? 'text-yellow-500'
                            : 'text-blue-500'
                        }
                        style={{ transition: 'stroke-dashoffset 0.5s ease-in-out' }}
                      />
                    </svg>
                    
                    {/* Texto central */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-gray-800">
                          {goalProgress.current}
                        </div>
                        <div className="text-sm text-gray-500">
                          de {goalProgress.target}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}        {/* Estatísticas */}
        {stats && (
          <div className="bg-white p-8 rounded-lg shadow-sm mb-8 border border-gray-200">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">
              Estatísticas do Hábito
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-6 bg-gray-50 rounded-lg border border-gray-200">
                <div className="text-4xl font-bold text-gray-800 mb-2">{stats.total_count}</div>
                <div className="text-sm text-gray-600 font-medium">Total de Conclusões</div>
              </div>
              <div className="text-center p-6 bg-gray-50 rounded-lg border border-gray-200">
                <div className="text-4xl font-bold text-gray-800 mb-2">{stats.current_streak}</div>
                <div className="text-sm text-gray-600 font-medium">Sequência Atual</div>
              </div>
              <div className="text-center p-6 bg-gray-50 rounded-lg border border-gray-200">
                <div className="text-4xl font-bold text-gray-800 mb-2">{stats.longest_streak}</div>
                <div className="text-sm text-gray-600 font-medium">Maior Sequência</div>
              </div>
            </div>
          </div>
        )}        {/* Adicionar entrada */}
        <div className="mb-8">
          <button 
            onClick={handleAddEntry}
            disabled={!canAddEntry()}
            className={`px-8 py-4 rounded-lg font-medium text-lg transition-all duration-200 shadow-sm border flex items-center space-x-3 ${
              canAddEntry() 
                ? 'bg-gray-800 text-white border-gray-800 hover:bg-gray-700' 
                : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
            }`}
          >
            <span className="text-xl">{canAddEntry() ? '+' : '✓'}</span>
            <span>{canAddEntry() ? 'Adicionar Nova Entrada' : 'Já completado hoje'}</span>
          </button>
        </div>        {/* Lista de entradas */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-8">
          <div 
            className="p-6 border-b border-gray-200 flex justify-between items-center cursor-pointer hover:bg-gray-50 transition-colors duration-200" 
            onClick={() => setIsEntriesExpanded(!isEntriesExpanded)}
          >
            <h2 className="text-2xl font-bold text-gray-800">
              Histórico de Entradas
            </h2>
            <div className="flex items-center space-x-2">
              <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-lg text-sm font-medium">
                {entries.length} entradas
              </span>
              <span className={`text-xl transition-transform duration-200 ${isEntriesExpanded ? 'rotate-180' : ''}`}>
                ▼
              </span>
            </div>
          </div>
        
        {isEntriesExpanded && (
          <>
            {entries.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {entries.map((entry, index) => (
                  <div key={entry.id} className="p-6 hover:bg-gray-50 transition-colors duration-200">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center mb-3">
                          <div className="w-3 h-3 bg-gray-400 rounded-full mr-4"></div>
                          <span className="text-lg font-medium text-gray-700">
                            {formatDate(entry.completed_at)}
                          </span>
                        </div>
                        {entry.notes && (
                          <div className="ml-7">
                            <p className="text-gray-600 bg-gray-50 border border-gray-200 p-4 rounded-lg">
                              {entry.notes}
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center space-x-3 ml-6">
                        <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-lg font-medium">
                          #{index + 1}
                        </span>
                        <button
                          onClick={() => handleDeleteEntry(entry.id, entry.completed_at)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
                          title="Deletar entrada"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center">
                <div className="bg-gray-50 rounded-lg p-8 border border-gray-200">
                  <div className="text-4xl mb-4 text-gray-400">📋</div>
                  <h3 className="text-xl font-medium text-gray-700 mb-2">Nenhuma entrada encontrada</h3>
                  <p className="text-gray-500">
                    Adicione sua primeira entrada para começar a acompanhar este hábito!
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>        {/* Estatísticas adicionais se houver entradas */}
        {entries.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-8">
            <div 
              className="p-6 border-b border-gray-200 flex justify-between items-center cursor-pointer hover:bg-gray-50 transition-colors duration-200"
              onClick={() => setIsStatsExpanded(!isStatsExpanded)}
            >
              <h3 className="text-xl font-bold text-gray-800">
                Informações Adicionais
              </h3>
              <span className={`text-xl transition-transform duration-200 ${isStatsExpanded ? 'rotate-180' : ''}`}>
                ▼
              </span>
            </div>
            
            {isStatsExpanded && (
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <span className="text-gray-700 font-medium block mb-2">
                      Primeira entrada:
                    </span>
                    <div className="font-medium text-gray-900">
                      {formatDate(entries[entries.length - 1]?.completed_at)}
                    </div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <span className="text-gray-700 font-medium block mb-2">
                      Última entrada:
                    </span>
                    <div className="font-medium text-gray-900">
                      {formatDate(entries[0]?.completed_at)}
                    </div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <span className="text-gray-700 font-medium block mb-2">
                      Entradas com notas:
                    </span>
                    <div className="font-medium text-gray-900">
                      {entries.filter(entry => entry.notes && entry.notes.trim()).length}
                    </div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <span className="text-gray-700 font-medium block mb-2">
                      Média por semana:
                    </span>
                    <div className="font-medium text-gray-900">
                      {stats ? (stats.total_count / Math.max(1, Math.ceil((new Date() - new Date(entries[entries.length - 1]?.completed_at)) / (7 * 24 * 60 * 60 * 1000)))).toFixed(1) : '0'}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Timeline de Entradas */}
        {entries.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-8">
            <div 
              className="p-6 border-b border-gray-200 flex justify-between items-center cursor-pointer hover:bg-gray-50 transition-colors duration-200"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              <h3 className="text-xl font-bold text-gray-800">
                Timeline de Entradas
              </h3>
              <span className={`text-xl transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                ▼
              </span>
            </div>

            {isExpanded && (
              <div className="p-6">
                <div className="space-y-4">
                  {entries.map((entry) => (
                    <div key={entry.id} className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-4 flex-1">
                          <div className="flex-shrink-0">
                            <div className="w-3 h-3 bg-gray-400 rounded-full mt-2"></div>
                          </div>
                          <div>
                            <p className="font-medium text-gray-800 text-lg">
                              {new Date(entry.completed_at).toLocaleDateString('pt-BR', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                            {entry.notes && (
                              <p className="text-gray-600 mt-2 bg-white p-3 rounded-lg border border-gray-200">
                                {entry.notes}
                              </p>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteEntry(entry.id, entry.completed_at)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 ml-4"
                          title="Deletar entrada"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      <div className="mb-8"></div>        {/* Seletor de Gráfico */}
        {entries.length > 0 && (
          <div className="mb-8 flex justify-center">
            <div className="bg-white p-2 rounded-lg shadow-sm border border-gray-200">
              <div className="flex space-x-1">
                {[
                  { key: 'daily', label: 'Diário' },
                  { key: 'weekly', label: 'Semanal' },
                  { key: 'monthly', label: 'Mensal' },
                  { key: 'completion', label: 'Taxa de Conclusão' }
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setActiveChart(key)}
                    className={`px-6 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                      activeChart === key
                        ? 'bg-gray-800 text-white'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}        {/* Gráficos */}
        {entries.length > 0 && (
          <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200 mb-8">
            {activeChart === 'daily' && (
              <div>
                <h3 className="text-2xl font-bold mb-6 text-gray-800">
                  Conclusões Diárias
                </h3>
                <div className="bg-gray-50 p-6 rounded-lg">
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={chartData.daily}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                        angle={-45}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis tick={{ fill: '#6b7280' }} />
                      <Tooltip 
                        labelFormatter={(label) => `Data: ${label}`}
                        formatter={(value) => [value, 'Conclusões']}
                        contentStyle={{
                          backgroundColor: 'white',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                        }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="completions" 
                        stroke="#374151" 
                        strokeWidth={3}
                        dot={{ fill: '#374151', strokeWidth: 2, r: 5 }}
                        activeDot={{ r: 6, stroke: '#374151', strokeWidth: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}            {activeChart === 'weekly' && (
              <div>
                <h3 className="text-2xl font-bold mb-6 text-gray-800">
                  Conclusões Semanais
                </h3>
                <div className="bg-gray-50 p-6 rounded-lg">
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={chartData.weekly}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="week" tick={{ fill: '#6b7280' }} />
                      <YAxis tick={{ fill: '#6b7280' }} />
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: 'white',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                        }}
                      />
                      <Bar dataKey="completions" fill="#6b7280" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {activeChart === 'monthly' && (
              <div>
                <h3 className="text-2xl font-bold mb-6 text-gray-800">
                  Conclusões Mensais
                </h3>
                <div className="bg-gray-50 p-6 rounded-lg">
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={chartData.monthly}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="month" tick={{ fill: '#6b7280' }} />
                      <YAxis tick={{ fill: '#6b7280' }} />
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: 'white',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                        }}
                      />
                      <Bar dataKey="completions" fill="#374151" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}            {activeChart === 'completion' && (
              <div>
                <h3 className="text-2xl font-bold mb-6 text-gray-800">
                  Taxa de Conclusão do Mês
                </h3>
                <div className="bg-gray-50 p-6 rounded-lg">
                  <div className="flex justify-center">
                    <ResponsiveContainer width={500} height={500}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={100}
                          outerRadius={180}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} stroke="white" strokeWidth={2} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value) => `${value}%`}
                          contentStyle={{
                            backgroundColor: 'white',
                            border: '1px solid #d1d5db',
                            borderRadius: '8px',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex justify-center space-x-8 mt-6">
                    {pieData.map((entry, index) => (
                      <div key={index} className="flex items-center bg-white px-4 py-2 rounded-lg border border-gray-200">
                        <div 
                          className="w-4 h-4 rounded-full mr-3"
                          style={{ backgroundColor: entry.color }}
                        ></div>
                        <span className="text-sm font-medium text-gray-700">
                          {entry.name}: <span className="text-lg font-semibold">{entry.value}%</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
      </div>
      )}
      
      {/* Modal de Adicionar Entrada */}
      {showAddModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={cancelAddEntry}
        >
          <div 
            className="bg-white rounded-xl shadow-xl max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Adicionar Entrada</h3>
                  <p className="text-sm text-gray-500">Registre o cumprimento do seu hábito</p>
                </div>
              </div>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notas (opcional)
                </label>
                <textarea
                  value={newEntryNotes}
                  onChange={(e) => setNewEntryNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-200"
                  rows="3"
                  placeholder="Adicione observações sobre esta entrada..."
                />
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={cancelAddEntry}
                  className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-all duration-200"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmAddEntry}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-all duration-200"
                >
                  Adicionar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {showDeleteModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={cancelDeleteEntry}
        >
          <div 
            className="bg-white rounded-xl shadow-xl max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mr-4">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Confirmar Exclusão</h3>
                  <p className="text-sm text-gray-500">Esta ação não pode ser desfeita</p>
                </div>
              </div>
              
              <p className="text-gray-700 mb-6">
                Tem certeza que deseja excluir a entrada de <span className="font-semibold text-gray-900">{entryToDelete && formatDate(entryToDelete.date)}</span>? Esta ação não pode ser desfeita.
              </p>
              
              <div className="flex gap-3">
                <button
                  onClick={cancelDeleteEntry}
                  className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-all duration-200"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDeleteEntry}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-all duration-200"
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      </div>
    </div>
  );
};

export default HabitDetail;