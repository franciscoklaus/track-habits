import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useApi, useHabits } from '../services/apiService';
import notificationService from '../services/notificationService';

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

const Dashboard = () => {
  const { user, logout } = useApi();
  const { habits, loading, error, createHabit, deleteHabit, completeHabit } = useHabits();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newHabit, setNewHabit] = useState({ 
    name: '', 
    description: '', 
    multipleUpdate: true,
    category: 'geral',
    icon: 'target',
    goal: 0,
    goal_type: 'streak',
    reminder_enabled: false,
    reminder_time: '09:00'
  });
  const [messages, setMessages] = useState([]);
  const [habitEntries, setHabitEntries] = useState({});
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [habitToDelete, setHabitToDelete] = useState(null);
  const { api } = useApi();
  const [notificationPermission, setNotificationPermission] = useState('default');

  // Função para testar notificações
  const testNotification = async () => {
    const success = await notificationService.testNotification();
    if (success) {
      setMessages(prev => [...prev, { type: 'success', text: 'Notificação de teste enviada!' }]);
    } else {
      setMessages(prev => [...prev, { type: 'error', text: 'Erro ao enviar notificação. Verifique as permissões.' }]);
    }
    setTimeout(() => {
      setMessages(prev => prev.filter(msg => !msg.text.includes('Notificação de teste') && !msg.text.includes('Erro ao enviar notificação')));
    }, 3000);
  };

  // Verificar status da permissão de notificação
  useEffect(() => {
    const checkPermission = () => {
      setNotificationPermission(notificationService.getPermissionStatus());
    };
    
    checkPermission();
    // Verificar a cada 5 segundos se houve mudança
    const interval = setInterval(checkPermission, 5000);
    
    return () => clearInterval(interval);
  }, []);

  // Função para obter emoji do ícone
  const getIconEmoji = (iconValue) => {
    const icon = ICONS.find(i => i.value === iconValue);
    return icon ? icon.label.split(' ')[0] : '🎯';
  };

  // Função para calcular progresso da meta
  const calculateGoalProgress = (habit) => {
    const entries = habitEntries[habit.id] || [];
    const today = new Date();
    
    if (!habit.goal || habit.goal === 0) return null;

    switch (habit.goal_type) {
      case 'count': {
        // Contar entradas de hoje
        const todayEntries = entries.filter(entry => {
          const entryDate = new Date(entry.completed_at).toDateString();
          return entryDate === today.toDateString();
        }).length;
        return { current: todayEntries, target: habit.goal, percentage: Math.min((todayEntries / habit.goal) * 100, 100) };
      }
      case 'weekly': {
        // Contar entradas desta semana
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        const weekEntries = entries.filter(entry => {
          const entryDate = new Date(entry.completed_at);
          return entryDate >= startOfWeek;
        }).length;
        return { current: weekEntries, target: habit.goal, percentage: Math.min((weekEntries / habit.goal) * 100, 100) };
      }
      case 'monthly': {
        // Contar entradas deste mês
        const monthEntries = entries.filter(entry => {
          const entryDate = new Date(entry.completed_at);
          return entryDate.getMonth() === today.getMonth() && entryDate.getFullYear() === today.getFullYear();
        }).length;
        return { current: monthEntries, target: habit.goal, percentage: Math.min((monthEntries / habit.goal) * 100, 100) };
      }
      case 'streak':
      default: {
        // Calcular sequência atual
        const sortedDates = entries
          .map(entry => new Date(entry.completed_at).toDateString())
          .filter((date, index, arr) => arr.indexOf(date) === index)
          .sort((a, b) => new Date(b) - new Date(a));
        
        let currentStreak = 0;
        let checkDate = new Date();
        
        for (let i = 0; i < sortedDates.length; i++) {
          const entryDate = new Date(sortedDates[i]);
          const diffDays = Math.floor((checkDate - entryDate) / (1000 * 60 * 60 * 24));
          
          if (diffDays === i) {
            currentStreak++;
          } else {
            break;
          }
        }
        
        return { current: currentStreak, target: habit.goal, percentage: Math.min((currentStreak / habit.goal) * 100, 100) };
      }
    }
  };
  const handleCreateHabit = async (e) => {
    e.preventDefault();
    try {
      await createHabit(newHabit);
      setNewHabit({ 
        name: '', 
        description: '',
        multipleUpdate: false,
        category: 'geral',
        icon: 'target',
        goal: 0,
        goal_type: 'streak',
        reminder_enabled: false,
        reminder_time: '09:00'
      });
      setShowCreateForm(false);
      setMessages(prev => [...prev, { type: 'success', text: 'Hábito criado com sucesso!' }]);
      setTimeout(() => {
        setMessages(prev => prev.filter(msg => msg.text !== 'Hábito criado com sucesso!'));
      }, 3000);
    } catch (err) {
      setMessages(prev => [...prev, { type: 'error', text: 'Erro ao criar hábito: ' + err.message }]);
      setTimeout(() => {
        setMessages(prev => prev.filter(msg => msg.text.includes('Erro ao criar hábito')));
      }, 3000);
      console.error('Erro ao criar hábito:', err);
    }
  };

  const handleCompleteHabit = async (habitId) => {
    try {
      await completeHabit(habitId);
      // Atualizar as entradas do hábito após completar
      await fetchHabitEntries(habitId);
      setMessages(prev => [...prev, { type: 'success', text: 'Hábito completado com sucesso!' }]);
      setTimeout(() => {
        setMessages(prev => prev.filter(msg => msg.text !== 'Hábito completado com sucesso!'));
      }, 1500);

    } catch (err) {
      setMessages(prev => [...prev, { type: 'error', text: 'Erro ao completar hábito: ' + err.message }]);
      setTimeout(() => {
        setMessages(prev => prev.filter(msg => msg.text !== 'Erro ao completar hábito: ' + err.message));
      }, 1500);
      //console.error('Erro ao completar hábito:', err);
      //alert('Erro ao completar hábito: ' + err.message);
    }
  };

  const handleDeleteHabit = async (habitId) => {
    setHabitToDelete(habitId);
    setShowDeleteModal(true);
  };

  const confirmDeleteHabit = async () => {
    if (!habitToDelete) return;
    
    try {
      await deleteHabit(habitToDelete);
      setMessages(prev => [...prev, { type: 'success', text: 'Hábito excluído com sucesso!' }]);
      setTimeout(() => {
        setMessages(prev => prev.filter(msg => msg.text !== 'Hábito excluído com sucesso!'));
      }, 3000);
    } catch (err) {
      setMessages(prev => [...prev, { type: 'error', text: 'Erro ao excluir hábito: ' + err.message }]);
      setTimeout(() => {
        setMessages(prev => prev.filter(msg => msg.text.includes('Erro ao excluir hábito')));
      }, 3000);
    } finally {
      setShowDeleteModal(false);
      setHabitToDelete(null);
    }
  };

  const cancelDeleteHabit = () => {
    setShowDeleteModal(false);
    setHabitToDelete(null);
  };

  // Fechar modal com Escape
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape' && showDeleteModal) {
        cancelDeleteHabit();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showDeleteModal]);

  // Função para buscar entradas de um hábito
  const fetchHabitEntries = async (habitId) => {
    try {
      const entries = await api.getHabitEntries(habitId);
      setHabitEntries(prev => ({ ...prev, [habitId]: entries }));
    } catch (err) {
      console.error('Erro ao buscar entradas:', err);
    }
  };

  // Função para verificar se um hábito foi completado hoje
  const isHabitCompletedToday = (habitId) => {
    const entries = habitEntries[habitId] || [];
    const today = new Date().toISOString().split('T')[0];
    
    return entries.some(entry => {
      const entryDate = new Date(entry.completed_at).toISOString().split('T')[0];
      return entryDate === today;
    });
  };

  // Função para verificar se um hábito pode ser completado
  const canCompleteHabit = (habit) => {
    // Se permite múltiplas atualizações, sempre pode ser completado
    if (habit.multipleUpdate) {
      return true;
    }
    // Se não permite múltiplas atualizações, só pode ser completado se não foi completado hoje
    return !isHabitCompletedToday(habit.id);
  };

  // Buscar entradas quando os hábitos carregarem
  useEffect(() => {
    const fetchHabitEntries = async (habitId) => {
      try {
        const entries = await api.getHabitEntries(habitId);
        setHabitEntries(prev => ({ ...prev, [habitId]: entries }));
      } catch (err) {
        console.error('Erro ao buscar entradas:', err);
      }
    };

    if (habits && habits.length > 0) {
      habits.forEach(habit => {
        fetchHabitEntries(habit.id);
      });

      // Agendar notificações para hábitos com lembretes ativos
      const habitsWithReminders = habits.filter(habit => habit.reminder_enabled && habit.reminder_time);
      if (habitsWithReminders.length > 0) {
        // Solicitar permissão na primeira vez
        notificationService.requestPermission().then(granted => {
          if (granted) {
            notificationService.scheduleAllReminders(habitsWithReminders);
            console.log(`${habitsWithReminders.length} lembretes agendados`);
          } else {
            console.warn('Permissão para notificações não concedida');
          }
        });
      }
    }

    // Cleanup: cancelar notificações quando o componente for desmontado
    return () => {
      notificationService.cancelAllReminders();
    };
  }, [habits, api]);

  if (loading) {
    return <div className="flex justify-center items-center h-screen">Carregando...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-10">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold text-gray-800">
              Meus Hábitos
            </h1>
            <p className="text-lg text-gray-600">
              Olá, <span className="font-semibold text-gray-800">{user?.username}</span>
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Status das Notificações */}
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${
                notificationPermission === 'granted' ? 'bg-green-500' : 
                notificationPermission === 'denied' ? 'bg-red-500' : 'bg-yellow-500'
              }`}></div>
              <span className="text-sm text-gray-600">
                {notificationPermission === 'granted' ? 'Notificações ativas' : 
                 notificationPermission === 'denied' ? 'Notificações bloqueadas' : 'Notificações pendentes'}
              </span>
              
            </div>
            
            <button
              onClick={logout}
              className="px-6 py-3 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-300 rounded-lg transition-all duration-200"
            >
              Sair
            </button>
          </div>
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
        )}        {/* Botão criar hábito */}
        <div className="mb-8">
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="bg-gray-800 text-white px-8 py-4 rounded-lg hover:bg-gray-700 transition-all duration-200 shadow-sm font-medium text-lg flex items-center space-x-2"
          >
            <span className="text-xl">{showCreateForm ? '×' : '+'}</span>
            <span>{showCreateForm ? 'Cancelar' : 'Novo Hábito'}</span>
          </button>
        </div>
        
        {/* Formulário criar hábito */}
        {showCreateForm && (
          <div className="bg-white p-8 rounded-lg shadow-sm mb-8 border border-gray-200">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">
              Criar Novo Hábito
            </h2>
            <form onSubmit={handleCreateHabit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nome do Hábito</label>
                <input
                  type="text"
                  required
                  value={newHabit.name}
                  onChange={(e) => setNewHabit(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-gray-500 focus:ring-1 focus:ring-gray-500 transition-all duration-200"
                  placeholder="Ex: Beber 2L de água"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Descrição</label>
                <textarea
                  value={newHabit.description}
                  onChange={(e) => setNewHabit(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-gray-500 focus:ring-1 focus:ring-gray-500 transition-all duration-200"
                  rows="4"
                  placeholder="Descreva seu hábito e seus objetivos..."
                />
              </div>
              <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                <div className="flex items-start">
                  <label className="flex items-start cursor-pointer relative" htmlFor="check-with-description">
                    <input type="checkbox"
                      checked={newHabit.multipleUpdate}
                      onChange={(e) => setNewHabit(prev => ({ ...prev, multipleUpdate: e.target.checked }))}
                      className="peer h-5 w-5 cursor-pointer transition-all appearance-none rounded border-2 border-gray-300 checked:bg-gray-800 checked:border-gray-800"
                      id="check-with-description" />
                    <span className="absolute text-white opacity-0 peer-checked:opacity-100 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"
                        stroke="currentColor" strokeWidth="1">
                        <path fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"></path>
                      </svg>
                    </span>
                  </label>
                  <label className="cursor-pointer ml-4 text-gray-700" htmlFor="check-with-description">
                    <div>
                      <p className="font-medium text-lg text-gray-800">
                        Múltiplas atualizações diárias
                      </p>
                      <p className="text-gray-600 mt-1">
                        Permite completar este hábito mais de uma vez por dia.
                      </p>
                    </div>
                  </label>
                </div>
              </div>
              
              {/* Categoria e Ícone */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Categoria</label>
                  <select
                    value={newHabit.category}
                    onChange={(e) => setNewHabit(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-gray-500 focus:ring-1 focus:ring-gray-500 transition-all duration-200"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Ícone</label>
                  <select
                    value={newHabit.icon}
                    onChange={(e) => setNewHabit(prev => ({ ...prev, icon: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-gray-500 focus:ring-1 focus:ring-gray-500 transition-all duration-200"
                  >
                    {ICONS.map(icon => (
                      <option key={icon.value} value={icon.value}>{icon.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Meta */}
              <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                <h3 className="text-lg font-medium text-gray-800 mb-4">Meta (Opcional)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Meta</label>
                    <select
                      value={newHabit.goal_type}
                      onChange={(e) => setNewHabit(prev => ({ ...prev, goal_type: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-gray-500 focus:ring-1 focus:ring-gray-500 transition-all duration-200"
                    >
                      {GOAL_TYPES.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Valor da Meta</label>
                    <input
                      type="number"
                      min="0"
                      value={newHabit.goal}
                      onChange={(e) => setNewHabit(prev => ({ ...prev, goal: parseInt(e.target.value) || 0 }))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-gray-500 focus:ring-1 focus:ring-gray-500 transition-all duration-200"
                      placeholder="Ex: 7 (dias), 3 (vezes)"
                    />
                  </div>
                </div>
              </div>

              {/* Lembrete */}
              <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                <div className="flex items-start mb-4">
                  <label className="flex items-start cursor-pointer relative" htmlFor="reminder-enabled">
                    <input 
                      type="checkbox"
                      checked={newHabit.reminder_enabled}
                      onChange={(e) => setNewHabit(prev => ({ ...prev, reminder_enabled: e.target.checked }))}
                      className="peer h-5 w-5 cursor-pointer transition-all appearance-none rounded border-2 border-gray-300 checked:bg-gray-800 checked:border-gray-800"
                      id="reminder-enabled" 
                    />
                    <span className="absolute text-white opacity-0 peer-checked:opacity-100 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"
                        stroke="currentColor" strokeWidth="1">
                        <path fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"></path>
                      </svg>
                    </span>
                  </label>
                  <label className="cursor-pointer ml-4 text-gray-700" htmlFor="reminder-enabled">
                    <div>
                      <p className="font-medium text-lg text-gray-800">
                        Ativar Lembrete
                      </p>
                      <p className="text-gray-600 mt-1">
                        Receber notificação do navegador no horário definido diariamente.
                      </p>
                      <p className="text-xs text-gray-500 mt-2">
                        💡 As notificações funcionam quando o navegador está aberto e requerem sua permissão.
                      </p>
                    </div>
                  </label>
                </div>
                {newHabit.reminder_enabled && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Horário do Lembrete</label>
                    <input
                      type="time"
                      value={newHabit.reminder_time}
                      onChange={(e) => setNewHabit(prev => ({ ...prev, reminder_time: e.target.value }))}
                      className="w-full md:w-auto px-4 py-3 border border-gray-300 rounded-lg focus:border-gray-500 focus:ring-1 focus:ring-gray-500 transition-all duration-200"
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      A notificação será exibida todos os dias neste horário.
                    </p>
                  </div>
                )}
              </div>
              <div className="flex space-x-4 pt-4">
                <button
                  type="submit"
                  className="bg-gray-800 text-white px-8 py-3 rounded-lg hover:bg-gray-700 transition-all duration-200 font-medium"
                >
                  Criar Hábito
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="bg-gray-200 text-gray-700 px-8 py-3 rounded-lg hover:bg-gray-300 transition-all duration-200 font-medium"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Lista de hábitos */}
        {error && (
          <div className="bg-red-50 border-l-4 border-l-red-500 text-red-700 px-6 py-4 rounded-lg mb-8 shadow-sm">
            <div className="flex items-center">
              <span className="font-medium">{error}</span>
            </div>
          </div>
        )}

        <div className="grid gap-8 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {habits.map(habit => {
            const goalProgress = calculateGoalProgress(habit);
            const categoryLabel = CATEGORIES.find(cat => cat.value === habit.category)?.label || 'Geral';
            
            return (
            <div key={habit.id} className="group bg-white rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100 overflow-hidden">
              {/* Header do Card */}
              <div className="p-6 pb-4">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 pr-4">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-2xl">{getIconEmoji(habit.icon)}</span>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 leading-tight">
                          {habit.name}
                        </h3>
                        <span className="text-xs text-gray-500 font-medium">{categoryLabel}</span>
                      </div>
                    </div>
                    {habit.description && (
                      <p className="text-gray-600 text-sm leading-relaxed line-clamp-3">
                        {habit.description}
                      </p>
                    )}
                  </div>
                  
                  {/* Status e Type Badges */}
                  <div className='flex flex-col gap-2 flex-shrink-0'>
                    <span className={`px-2.5 py-1 text-xs font-medium rounded-full text-center ${
                      habit.is_active 
                        ? 'bg-green-100 text-green-700 border border-green-200' 
                        : 'bg-gray-100 text-gray-600 border border-gray-200'
                    }`}>
                      {habit.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                    <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-center">
                      {habit.multipleUpdate ? 'Múltiplo' : 'Diário'}
                    </span>
                    {habit.reminder_enabled && (
                      <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-purple-50 text-purple-700 border border-purple-200 text-center flex items-center gap-1">
                        🔔 {habit.reminder_time}
                      </span>
                    )}
                  </div>
                </div>

                {/* Barra de Progresso da Meta */}
                {goalProgress && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-700">Meta: {goalProgress.current}/{goalProgress.target}</span>
                      <span className="text-xs text-gray-500">{Math.round(goalProgress.percentage)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-gray-800 h-2 rounded-full transition-all duration-300" 
                        style={{ width: `${goalProgress.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="border-t border-gray-100"></div>

              {/* Actions */}
              <div className="p-4 bg-gray-50/50">
                <div className="flex gap-2">
                  {/* Botão Principal - Completar */}
                  <button
                    onClick={() => handleCompleteHabit(habit.id)}
                    disabled={!canCompleteHabit(habit)}
                    className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                      canCompleteHabit(habit)
                        ? 'bg-gray-900 text-white hover:bg-gray-800 shadow-sm hover:shadow-md transform hover:-translate-y-0.5'
                        : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {canCompleteHabit(habit) ? 'Completar' : 'Completado'}
                  </button>
                  
                  {/* Botões Secundários */}
                  <Link
                    to={`/habit/${habit.id}`}
                    className="px-4 py-2.5 bg-white text-gray-700 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 hover:shadow-sm"
                    title="Ver detalhes"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </Link>
                  
                  <button
                    onClick={() => handleDeleteHabit(habit.id)}
                    className="px-4 py-2.5 bg-white text-red-600 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-50 hover:border-red-300 transition-all duration-200 hover:shadow-sm"
                    title="Excluir hábito"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
            );
          })}
        </div>

      {habits.length === 0 && (
        <div className="flex justify-center items-center py-16">
          <div className="bg-white rounded-xl shadow-sm p-12 border border-gray-200 text-center max-w-md">
            <div className="mb-6">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Nenhum hábito encontrado</h3>
              <p className="text-gray-500 leading-relaxed">
                Comece sua jornada de crescimento pessoal criando seu primeiro hábito
              </p>
            </div>
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-gray-900 text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-all duration-200 font-medium"
            >
              Criar Primeiro Hábito
            </button>
          </div>
        </div>
      )}
      </div>
      
      {/* Modal de Confirmação de Exclusão */}
      {showDeleteModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={cancelDeleteHabit}
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
                Tem certeza que deseja excluir o hábito <span className="font-semibold text-gray-900">"{habits.find(h => h.id === habitToDelete)?.name}"</span>? Todos os dados relacionados a ele serão perdidos permanentemente.
              </p>
              
              <div className="flex gap-3">
                <button
                  onClick={cancelDeleteHabit}
                  className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-all duration-200"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDeleteHabit}
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
  );
};

export default Dashboard;