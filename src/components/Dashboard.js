import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useApi, useHabits } from '../services/apiService';
import notificationService from '../services/notificationService';
import GoalCompletionModal from './GoalCompletionModal';
import ActivityFeed from './ActivityFeed';
import FriendsSidebar from './FriendsSidebar';

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

const VISIBILITY_OPTIONS = [
  { value: 'public', label: '🌍 Público' },
  { value: 'friends', label: '👥 Apenas amigos' },
  { value: 'private', label: '🔒 Privado' }
];

const Dashboard = () => {
  const { user, logout } = useApi();
  const { habits, loading, error, createHabit, deleteHabit, completeHabit, updateHabit, fetchHabits } = useHabits();
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
    reminder_times: ['09:00'], // Array para múltiplos horários
    visibility: 'public' // 'public', 'private', 'friends'
  });
  const [messages, setMessages] = useState([]);
  const [habitEntries, setHabitEntries] = useState({});
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [habitToDelete, setHabitToDelete] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingHabit, setEditingHabit] = useState(null);
  const [editHabitData, setEditHabitData] = useState({
    name: '',
    description: '',
    multipleUpdate: false,
    category: 'geral',
    icon: 'target',
    goal: 0,
    goal_type: 'streak',
    reminder_enabled: false,
    reminder_times: ['09:00'], // Array para múltiplos horários
    visibility: 'public' // 'public', 'private', 'friends'
  });
  const { api } = useApi();
  const [notificationPermission, setNotificationPermission] = useState('default');
  
  // Estados para gerenciamento de metas
  const [goalCompletionModal, setGoalCompletionModal] = useState({
    isOpen: false,
    habitId: null,
    habitName: '',
    goalStatus: null
  });
  const [checkedHabits, setCheckedHabits] = useState(new Set());
  const [goalStatuses, setGoalStatuses] = useState({}); // Armazenar status das metas do backend
  
  // Estados para feed de atividades e amigos
  const [showActivityFeed, setShowActivityFeed] = useState(false);
  const [showFriendsSidebar, setShowFriendsSidebar] = useState(false);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

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
    if (!habit.goal || habit.goal === 0) return null;

    // Verificar se temos dados do backend para este hábito
    const backendStatus = goalStatuses[habit.id];
    if (backendStatus && backendStatus.has_goal) {
      // Usar dados do backend (mais precisos, considerando resets)
      const current = backendStatus.actual_count || 0;
      const target = backendStatus.target_count || habit.goal;
      const percentage = Math.min((current / target) * 100, 100);
      
      return { 
        current, 
        target, 
        percentage,
        isResetState: current === 0 && backendStatus.goal_type !== 'streak', // Meta zerada após reset
        backendData: true // Flag para indicar que usa dados do backend
      };
    }

    // Fallback para cálculo local (manter compatibilidade)
    const entries = habitEntries[habit.id] || [];
    const today = new Date();

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
        reminder_times: ['09:00'],
        visibility: 'public'
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
      
      // Atualizar o status da meta para refletir as mudanças no frontend
      await fetchGoalStatus(habitId);
      
      // Buscar o hábito para verificar se tem meta
      const habit = habits.find(h => h.id === habitId);
      if (habit && habit.goal && habit.goal > 0) {
        // Verificar se a meta foi completada após esta atividade (para todos os tipos de meta)
        setTimeout(async () => {
          console.log(`Checking goal completion for habit ${habitId} after completing`);
          await checkGoalCompletion(habitId, habit.name, true); // forceCheck = true para sempre verificar após completar
        }, 500); // Pequeno delay para garantir que os dados foram atualizados
      }
      
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

  // Funções para gerenciar múltiplos lembretes
  const addReminderTime = (isEdit = false) => {
    const currentData = isEdit ? editHabitData : newHabit;
    const maxReminders = currentData.goal_type === 'count' ? Math.max(1, currentData.goal || 1) : 10; // Limite baseado na meta ou 10 para outros tipos
    
    if (currentData.reminder_times.length >= maxReminders) {
      setMessages(prev => [...prev, { 
        type: 'error', 
        text: `Você pode adicionar no máximo ${maxReminders} lembrete${maxReminders > 1 ? 's' : ''} para esta meta.` 
      }]);
      setTimeout(() => {
        setMessages(prev => prev.filter(msg => !msg.text.includes('pode adicionar no máximo')));
      }, 3000);
      return;
    }

    if (isEdit) {
      setEditHabitData(prev => ({
        ...prev,
        reminder_times: [...prev.reminder_times, '09:00']
      }));
    } else {
      setNewHabit(prev => ({
        ...prev,
        reminder_times: [...prev.reminder_times, '09:00']
      }));
    }
  };

  const removeReminderTime = (index, isEdit = false) => {
    if (isEdit) {
      setEditHabitData(prev => ({
        ...prev,
        reminder_times: prev.reminder_times.filter((_, i) => i !== index)
      }));
    } else {
      setNewHabit(prev => ({
        ...prev,
        reminder_times: prev.reminder_times.filter((_, i) => i !== index)
      }));
    }
  };

  const updateReminderTime = (index, time, isEdit = false) => {
    if (isEdit) {
      setEditHabitData(prev => ({
        ...prev,
        reminder_times: prev.reminder_times.map((t, i) => i === index ? time : t)
      }));
    } else {
      setNewHabit(prev => ({
        ...prev,
        reminder_times: prev.reminder_times.map((t, i) => i === index ? time : t)
      }));
    }
  };

  // Função para ajustar lembretes quando a meta muda
  const adjustRemindersForGoal = (goalValue, goalType, isEdit = false) => {
    if (goalType === 'count') {
      const maxReminders = Math.max(1, goalValue || 1);
      const currentData = isEdit ? editHabitData : newHabit;
      
      // Se temos mais lembretes do que a meta permite, reduzir
      if (currentData.reminder_times.length > maxReminders) {
        const adjustedTimes = currentData.reminder_times.slice(0, maxReminders);
        
        if (isEdit) {
          setEditHabitData(prev => ({
            ...prev,
            reminder_times: adjustedTimes
          }));
        } else {
          setNewHabit(prev => ({
            ...prev,
            reminder_times: adjustedTimes
          }));
        }
        
        setMessages(prev => [...prev, { 
          type: 'success', 
          text: `Lembretes ajustados para ${maxReminders} (limite da meta).` 
        }]);
        setTimeout(() => {
          setMessages(prev => prev.filter(msg => !msg.text.includes('Lembretes ajustados')));
        }, 3000);
      }
    }
  };

  // Funções para editar hábito
  const handleEditHabit = (habit) => {
    //console.log('=== DEBUGGING EDIT HABIT ===');
    //console.log('Original habit object:', habit);
    //console.log('habit.reminder_times:', habit.reminder_times);
    //console.log('habit.reminder_time:', habit.reminder_time);
    //console.log('typeof habit.reminder_times:', typeof habit.reminder_times);
    //console.log('Array.isArray(habit.reminder_times):', Array.isArray(habit.reminder_times));
    
    setEditingHabit(habit);
    
    let reminderTimes;
    if (habit.reminder_times && Array.isArray(habit.reminder_times) && habit.reminder_times.length > 0) {
      reminderTimes = habit.reminder_times;
    } else if (habit.reminder_time) {
      reminderTimes = [habit.reminder_time];
    } else {
      reminderTimes = ['09:00'];
    }
    
    console.log('Final reminderTimes to set:', reminderTimes);
    
    const editData = {
      name: habit.name,
      description: habit.description || '',
      multipleUpdate: habit.multipleUpdate,
      category: habit.category || 'geral',
      icon: habit.icon || 'target',
      goal: habit.goal || 0,
      goal_type: habit.goal_type || 'streak',
      reminder_enabled: habit.reminder_enabled || false,
      reminder_times: reminderTimes,
      visibility: habit.visibility || 'public'
    };
    
    console.log('Setting editHabitData to:', editData);
    setEditHabitData(editData);
    setShowEditModal(true);
  };

  const handleUpdateHabit = async (e) => {
    e.preventDefault();
    if (!editingHabit) return;

    try {
      await updateHabit(editingHabit.id, editHabitData);
      setMessages(prev => [...prev, { type: 'success', text: 'Hábito atualizado com sucesso!' }]);
      setTimeout(() => {
        setMessages(prev => prev.filter(msg => msg.text !== 'Hábito atualizado com sucesso!'));
      }, 3000);
      setShowEditModal(false);
      setEditingHabit(null);
    } catch (err) {
      setMessages(prev => [...prev, { type: 'error', text: 'Erro ao atualizar hábito: ' + err.message }]);
      setTimeout(() => {
        setMessages(prev => prev.filter(msg => msg.text.includes('Erro ao atualizar hábito')));
      }, 3000);
      console.error('Erro ao atualizar hábito:', err);
    }
  };

  const cancelEditHabit = () => {
    setShowEditModal(false);
    setEditingHabit(null);
    setEditHabitData({
      name: '',
      description: '',
      multipleUpdate: false,
      category: 'geral',
      icon: 'target',
      goal: 0,
      goal_type: 'streak',
      reminder_enabled: false,
      reminder_times: ['09:00'],
      visibility: 'public'
    });
  };

  // Fechar modals com Escape
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        if (showDeleteModal) {
          cancelDeleteHabit();
        }
        if (showEditModal) {
          cancelEditHabit();
        }
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showDeleteModal, showEditModal]);

  // Função para buscar entradas de um hábito
  const fetchHabitEntries = async (habitId) => {
    try {
      const entries = await api.getHabitEntries(habitId);
      setHabitEntries(prev => ({ ...prev, [habitId]: entries }));
    } catch (err) {
      console.error('Erro ao buscar entradas:', err);
    }
  };

  // Função para buscar status da meta do backend
  const fetchGoalStatus = useCallback(async (habitId) => {
    try {
      const goalStatus = await api.checkGoalCompletion(habitId);
      setGoalStatuses(prev => ({ ...prev, [habitId]: goalStatus }));
      return goalStatus;
    } catch (err) {
      console.error('Erro ao buscar status da meta:', err);
      return null;
    }
  }, [api]);

  // Função para buscar o número de solicitações de amizade pendentes
  const fetchPendingRequestsCount = useCallback(async () => {
    try {
      const requests = await api.getFriendRequests();
      // Verificar se requests é um array válido antes de filtrar
      if (Array.isArray(requests)) {
        // Contar apenas as solicitações recebidas (não enviadas)
        const receivedRequests = requests.filter(request => request.type === 'received');
        setPendingRequestsCount(receivedRequests.length);
      } else {
        setPendingRequestsCount(0);
      }
    } catch (err) {
      console.error('Erro ao buscar solicitações de amizade:', err);
      setPendingRequestsCount(0);
    }
  }, [api]);

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

  // Função para verificar metas completadas
  const checkGoalCompletion = useCallback(async (habitId, habitName, forceCheck = false) => {
    if (!forceCheck && checkedHabits.has(habitId)) {
      console.log(`Skipping goal check for habit ${habitId} - already checked this session`);
      return; // Já verificado nesta sessão
    }
    
    console.log(`=== CHECKING GOAL COMPLETION ===`);
    console.log(`Habit ID: ${habitId}, Name: ${habitName}, Force Check: ${forceCheck}`);
    
    try {
      const response = await api.checkGoalCompletion(habitId);
      console.log('Goal completion response:', response);
      
      if (response && response.needs_renewal) {
        console.log('Goal needs renewal - showing modal');
        setGoalCompletionModal({
          isOpen: true,
          habitId,
          habitName,
          goalStatus: response
        });
      } else {
        console.log('Goal does not need renewal:', {
          has_goal: response?.has_goal,
          goal_completed: response?.goal_completed,
          already_recorded: response?.already_recorded
        });
      }
      
      // Marcar como verificado para evitar verificações repetidas (apenas se não foi forçado)
      if (!forceCheck) {
        setCheckedHabits(prev => {
          const newSet = new Set([...prev, habitId]);
          console.log('Added habitId to checkedHabits:', habitId);
          console.log('Updated checkedHabits:', Array.from(newSet));
          return newSet;
        });
      }
    } catch (error) {
      console.error('Error checking goal completion:', error);
    }
  }, [checkedHabits, api, setGoalCompletionModal, setCheckedHabits]);

  // Função para registrar meta completada
  const handleGoalCompletion = async (completionData) => {
    try {
      await api.createGoalCompletion(goalCompletionModal.habitId, completionData);
      
      // Mostrar notificação de sucesso
      setMessages(prev => [...prev, { 
        type: 'success', 
        text: `🎉 Meta registrada! Parabéns pela conquista em "${goalCompletionModal.habitName}"!` 
      }]);
      setTimeout(() => {
        setMessages(prev => prev.filter(msg => !msg.text.includes('Meta registrada')));
      }, 5000);
      
    } catch (error) {
      setMessages(prev => [...prev, { 
        type: 'error', 
        text: 'Erro ao registrar meta completada: ' + error.message 
      }]);
      setTimeout(() => {
        setMessages(prev => prev.filter(msg => !msg.text.includes('Erro ao registrar meta')));
      }, 3000);
    }
  };

  // Função para lidar com o fechamento do modal e decisão de reset
  const handleGoalModalClose = async (shouldReset) => {
    console.log('=== HANDLE GOAL MODAL CLOSE ===');
    console.log('shouldReset:', shouldReset);
    console.log('goalCompletionModal:', goalCompletionModal);
    
    try {
      if (shouldReset) {
        // Resetar a meta no backend
        const habitId = goalCompletionModal.habitId;
        console.log('Calling resetGoal for habitId:', habitId);
        
        const resetResult = await api.resetGoal(habitId);
        console.log('Reset result:', resetResult);
        
        // Atualizar o status da meta após o reset
        const updatedGoalStatus = await fetchGoalStatus(habitId);
        console.log('Updated goal status after reset:', updatedGoalStatus);
        
        // Recarregar os dados dos hábitos para atualizar o status
        console.log('Fetching habits after reset...');
        await fetchHabits();
        console.log('Habits fetched successfully');
        
        setMessages(prev => [...prev, { 
          type: 'success', 
          text: `🔄 Meta resetada para "${goalCompletionModal.habitName}"! Continue registrando suas atividades.` 
        }]);
        setTimeout(() => {
          setMessages(prev => prev.filter(msg => !msg.text.includes('Meta resetada')));
        }, 5000);
      } else {
        // Meta mantida como completada - nenhuma ação adicional necessária
        console.log('User chose NOT to reset the goal');
        setMessages(prev => [...prev, { 
          type: 'info', 
          text: `✅ Meta de "${goalCompletionModal.habitName}" mantida como completada. Você pode reiniciar quando quiser.` 
        }]);
        setTimeout(() => {
          setMessages(prev => prev.filter(msg => !msg.text.includes('mantida como completada')));
        }, 5000);
      }
    } catch (error) {
      console.error('Error handling goal reset decision:', error);
      setMessages(prev => [...prev, { 
        type: 'error', 
        text: 'Erro ao processar decisão de reset: ' + error.message 
      }]);
      setTimeout(() => {
        setMessages(prev => prev.filter(msg => !msg.text.includes('Erro ao processar')));
      }, 3000);
    } finally {
      // Fechar o modal e limpar o estado de verificação para permitir nova verificação
      console.log('Closing modal and clearing checked habits for habitId:', goalCompletionModal.habitId);
      setGoalCompletionModal(prev => ({ ...prev, isOpen: false }));
      setCheckedHabits(prev => {
        const newSet = new Set(prev);
        newSet.delete(goalCompletionModal.habitId);
        console.log('Cleared habitId from checkedHabits:', goalCompletionModal.habitId);
        console.log('New checkedHabits:', Array.from(newSet));
        return newSet;
      });
    }
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
      habits.forEach(async (habit) => {
        // Buscar entradas do hábito
        fetchHabitEntries(habit.id);
        
        // Buscar status da meta do backend se o hábito tem meta
        if (habit.goal && habit.goal > 0) {
          try {
            const goalStatus = await fetchGoalStatus(habit.id);
            
            // Verificar metas completadas (apenas para hábitos com meta definida que não seja streak)
            if (goalStatus && goalStatus.needs_renewal && habit.goal_type !== 'streak') {
              // Aguardar um pouco para garantir que as entradas foram carregadas
              setTimeout(() => {
                checkGoalCompletion(habit.id, habit.name);
              }, 1000);
            }
          } catch (error) {
            console.error('Error fetching goal status for habit', habit.id, error);
          }
        }
      });

      // Agendar notificações para hábitos com lembretes ativos
      const habitsWithReminders = habits.filter(habit => 
        habit.reminder_enabled && (habit.reminder_times?.length > 0 || habit.reminder_time)
      );
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
  }, [habits, api, checkGoalCompletion, fetchGoalStatus]);

  // Buscar número de solicitações de amizade pendentes
  useEffect(() => {
    fetchPendingRequestsCount();
  }, [fetchPendingRequestsCount]);

  // Atualizar contagem quando o sidebar de amigos é fechado
  useEffect(() => {
    if (!showFriendsSidebar) {
      // Pequeno delay para garantir que as mudanças foram processadas
      const timer = setTimeout(() => {
        fetchPendingRequestsCount();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [showFriendsSidebar, fetchPendingRequestsCount]);

  if (loading) {
    return <div className="flex justify-center items-center h-screen">Carregando...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        {/* Mobile optimized header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-8 sm:mb-10 space-y-4 sm:space-y-0">
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-4xl font-bold text-gray-800">
              Meus Hábitos
            </h1>
            <p className="text-base sm:text-lg text-gray-600">
              Olá, <span className="font-semibold text-gray-800">{user?.username}</span>
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
            {/* Botões de navegação social */}
            <div className="flex gap-2">
              <button
                onClick={() => setShowActivityFeed(true)}
                className="px-3 sm:px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 border border-blue-200 rounded-lg transition-all duration-200 flex items-center gap-2"
                title="Feed de Atividades"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                </svg>
                <span className="hidden sm:inline">Feed</span>
              </button>
              
              <button
                onClick={() => setShowFriendsSidebar(true)}
                className="px-3 sm:px-4 py-2 text-sm font-medium text-green-600 hover:text-green-800 hover:bg-green-50 border border-green-200 rounded-lg transition-all duration-200 flex items-center gap-2 relative"
                title="Amigos"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
                <span className="hidden sm:inline">Amigos</span>
                {pendingRequestsCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                    {pendingRequestsCount > 9 ? '9+' : pendingRequestsCount}
                  </span>
                )}
              </button>
            </div>
            
            {/* Status das Notificações - more compact on mobile */}
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${
                notificationPermission === 'granted' ? 'bg-green-500' : 
                notificationPermission === 'denied' ? 'bg-red-500' : 'bg-yellow-500'
              }`}></div>
              <span className="text-xs sm:text-sm text-gray-600">
                {notificationPermission === 'granted' ? 'Notificações ativas' : 
                 notificationPermission === 'denied' ? 'Notificações bloqueadas' : 'Notificações pendentes'}
              </span>
            </div>
            
            <button
              onClick={logout}
              className="px-4 sm:px-6 py-2 sm:py-3 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-300 rounded-lg transition-all duration-200 w-full sm:w-auto text-center"
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
        )}        {/* Mobile optimized new habit button */}
        <div className="mb-6 sm:mb-8">
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="w-full sm:w-auto bg-gray-800 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-lg hover:bg-gray-700 transition-all duration-200 shadow-sm font-medium text-base sm:text-lg flex items-center justify-center space-x-2"
          >
            <span className="text-lg sm:text-xl">{showCreateForm ? '×' : '+'}</span>
            <span>{showCreateForm ? 'Cancelar' : 'Novo Hábito'}</span>
          </button>
        </div>
        
        {/* Mobile optimized create form */}
        {showCreateForm && (
          <div className="bg-white p-4 sm:p-8 rounded-lg shadow-sm mb-6 sm:mb-8 border border-gray-200">
            <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-gray-800">
              Criar Novo Hábito
            </h2>
            <form onSubmit={handleCreateHabit} className="space-y-4 sm:space-y-6">
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

              {/* Visibilidade */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Visibilidade</label>
                <select
                  value={newHabit.visibility}
                  onChange={(e) => setNewHabit(prev => ({ ...prev, visibility: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-gray-500 focus:ring-1 focus:ring-gray-500 transition-all duration-200"
                >
                  {VISIBILITY_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <p className="text-sm text-gray-500 mt-2">
                  {newHabit.visibility === 'public' && 'Seus progressos serão visíveis para todos'}
                  {newHabit.visibility === 'friends' && 'Seus progressos serão visíveis apenas para seus amigos'}
                  {newHabit.visibility === 'private' && 'Seus progressos não aparecerão no feed de atividades'}
                </p>
              </div>

              {/* Meta */}
              <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                <h3 className="text-lg font-medium text-gray-800 mb-4">Meta (Opcional)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Meta</label>
                    <select
                      value={newHabit.goal_type}
                      onChange={(e) => {
                        const newGoalType = e.target.value;
                        setNewHabit(prev => ({ ...prev, goal_type: newGoalType }));
                        adjustRemindersForGoal(newHabit.goal, newGoalType, false);
                      }}
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
                      onChange={(e) => {
                        const newGoal = parseInt(e.target.value) || 0;
                        setNewHabit(prev => ({ ...prev, goal: newGoal }));
                        adjustRemindersForGoal(newGoal, newHabit.goal_type, false);
                      }}
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
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-sm font-medium text-gray-700">
                        {newHabit.goal_type === 'count' ? 'Horários dos Lembretes' : 'Horário do Lembrete'}
                      </label>
                      {newHabit.goal_type === 'count' && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">
                            {newHabit.reminder_times.length}/{Math.max(1, newHabit.goal || 1)}
                          </span>
                          <button
                            type="button"
                            onClick={() => addReminderTime(false)}
                            disabled={newHabit.reminder_times.length >= Math.max(1, newHabit.goal || 1)}
                            className={`text-sm px-3 py-1 rounded-md transition-colors flex items-center gap-1 ${
                              newHabit.reminder_times.length >= Math.max(1, newHabit.goal || 1)
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                          >
                            <span>+</span> Adicionar Horário
                          </button>
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-3">
                      {newHabit.reminder_times.map((time, index) => (
                        <div key={index} className="flex items-center gap-3">
                          <input
                            type="time"
                            value={time}
                            onChange={(e) => updateReminderTime(index, e.target.value, false)}
                            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:border-gray-500 focus:ring-1 focus:ring-gray-500 transition-all duration-200"
                          />
                          {newHabit.goal_type === 'count' && newHabit.reminder_times.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeReminderTime(index, false)}
                              className="text-red-600 hover:text-red-800 p-2 hover:bg-red-50 rounded-md transition-colors"
                              title="Remover horário"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    
                    <p className="text-xs text-gray-500 mt-3">
                      {newHabit.goal_type === 'count' 
                        ? `Para metas de "número de vezes por dia", você pode adicionar até ${Math.max(1, newHabit.goal || 1)} lembrete${Math.max(1, newHabit.goal || 1) > 1 ? 's' : ''} (um para cada vez que deseja realizar o hábito). ${newHabit.goal === 0 ? 'Defina um valor maior que 0 na meta para adicionar mais lembretes.' : ''}`
                        : 'A notificação será exibida todos os dias neste horário.'
                      }
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

        {/* Mobile optimized habits grid */}
        <div className="grid gap-4 sm:gap-6 md:gap-8 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {habits.map(habit => {
            const goalProgress = calculateGoalProgress(habit);
            const categoryLabel = CATEGORIES.find(cat => cat.value === habit.category)?.label || 'Geral';
            
            return (
            <div key={habit.id} className="group bg-white rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100 overflow-hidden">
              {/* Mobile optimized card header */}
              <div className="p-4 sm:p-6 pb-3 sm:pb-4">
                <div className="flex items-start justify-between mb-3 sm:mb-4">
                  <div className="flex-1 pr-2 sm:pr-4">
                    <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                      <span className="text-xl sm:text-2xl">{getIconEmoji(habit.icon)}</span>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base sm:text-lg font-bold text-gray-900 leading-tight truncate">
                          {habit.name}
                        </h3>
                        <span className="text-xs text-gray-500 font-medium">{categoryLabel}</span>
                      </div>
                    </div>
                    {habit.description && (
                      <p className="text-gray-600 text-xs sm:text-sm leading-relaxed line-clamp-2 sm:line-clamp-3">
                        {habit.description}
                      </p>
                    )}
                  </div>
                  
                  {/* Mobile optimized status badges */}
                  <div className='flex flex-col gap-1 sm:gap-2 flex-shrink-0'>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full text-center ${
                      habit.is_active 
                        ? 'bg-green-100 text-green-700 border border-green-200' 
                        : 'bg-gray-100 text-gray-600 border border-gray-200'
                    }`}>
                      {habit.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-center">
                      {habit.multipleUpdate ? 'Múltiplo' : 'Diário'}
                    </span>
                    {habit.reminder_enabled && (
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-50 text-purple-700 border border-purple-200 text-center flex items-center justify-center gap-1">
                        <span className="hidden sm:inline">🔔</span>
                        <span className="text-xs">
                          {habit.reminder_times ? habit.reminder_times.join(', ') : (habit.reminder_time || '09:00')}
                        </span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Mobile optimized goal progress */}
                {goalProgress && (
                  <div className="mt-3 sm:mt-4 p-2 sm:p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm font-medium text-gray-700">Meta: {goalProgress.current}/{goalProgress.target}</span>
                      </div>
                      <span className="text-xs text-gray-500">{Math.round(goalProgress.percentage)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-300 ${
                          goalProgress.isResetState ? 'bg-blue-500' : 'bg-gray-800'
                        }`}
                        style={{ width: `${goalProgress.percentage}%` }}
                      ></div>
                    </div>
                    
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="border-t border-gray-100"></div>

              {/* Mobile optimized actions */}
              <div className="p-3 sm:p-4 bg-gray-50/50">
                <div className="flex flex-col sm:flex-row gap-2">
                  {/* Primary action button - full width on mobile */}
                  <button
                    onClick={() => handleCompleteHabit(habit.id)}
                    disabled={!canCompleteHabit(habit)}
                    className={`w-full sm:flex-1 px-3 sm:px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                      canCompleteHabit(habit)
                        ? 'bg-gray-900 text-white hover:bg-gray-800 shadow-sm hover:shadow-md transform hover:-translate-y-0.5'
                        : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {canCompleteHabit(habit) ? 'Completar' : 'Completado'}
                  </button>
                  
                  {/* Secondary buttons - responsive layout */}
                  <div className="flex gap-2">
                    <Link
                      to={`/habit/${habit.id}`}
                      className="flex-1 sm:flex-none px-3 sm:px-4 py-2.5 bg-white text-gray-700 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 hover:shadow-sm flex items-center justify-center"
                      title="Ver detalhes"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </Link>

                    <button
                      onClick={() => handleEditHabit(habit)}
                      className="flex-1 sm:flex-none px-3 sm:px-4 py-2.5 bg-white text-blue-600 border border-blue-200 rounded-lg text-sm font-medium hover:bg-blue-50 hover:border-blue-300 transition-all duration-200 hover:shadow-sm flex items-center justify-center"
                      title="Editar hábito"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    
                    <button
                      onClick={() => handleDeleteHabit(habit.id)}
                      className="flex-1 sm:flex-none px-3 sm:px-4 py-2.5 bg-white text-red-600 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-50 hover:border-red-300 transition-all duration-200 hover:shadow-sm flex items-center justify-center"
                      title="Excluir hábito"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
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
      
      {/* Mobile optimized edit modal */}
      {showEditModal && editingHabit && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4"
          onClick={cancelEditHabit}
        >
          <div 
            className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Editar Hábito</h2>
                <button
                  onClick={cancelEditHabit}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                >
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleUpdateHabit} className="space-y-4 sm:space-y-6">
                {/* Mobile optimized form fields */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nome do Hábito</label>
                  <input
                    type="text"
                    required
                    value={editHabitData.name}
                    onChange={(e) => setEditHabitData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 rounded-lg focus:border-gray-500 focus:ring-1 focus:ring-gray-500 transition-all duration-200 text-base"
                    placeholder="Ex: Beber água, Exercitar-se, Ler..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Descrição (Opcional)</label>
                  <textarea
                    value={editHabitData.description}
                    onChange={(e) => setEditHabitData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-gray-500 focus:ring-1 focus:ring-gray-500 transition-all duration-200"
                    rows="4"
                    placeholder="Descreva seu hábito e seus objetivos..."
                  />
                </div>

                {/* Múltiplas atualizações */}
                <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                  <div className="flex items-start">
                    <label className="flex items-start cursor-pointer relative" htmlFor="edit-check-multiple">
                      <input type="checkbox"
                        checked={editHabitData.multipleUpdate}
                        onChange={(e) => setEditHabitData(prev => ({ ...prev, multipleUpdate: e.target.checked }))}
                        className="peer h-5 w-5 cursor-pointer transition-all appearance-none rounded border-2 border-gray-300 checked:bg-gray-800 checked:border-gray-800"
                        id="edit-check-multiple" />
                      <span className="absolute text-white opacity-0 peer-checked:opacity-100 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"
                          stroke="currentColor" strokeWidth="1">
                          <path fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"></path>
                        </svg>
                      </span>
                    </label>
                    <label className="cursor-pointer ml-4 text-gray-700" htmlFor="edit-check-multiple">
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
                      value={editHabitData.category}
                      onChange={(e) => setEditHabitData(prev => ({ ...prev, category: e.target.value }))}
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
                      value={editHabitData.icon}
                      onChange={(e) => setEditHabitData(prev => ({ ...prev, icon: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-gray-500 focus:ring-1 focus:ring-gray-500 transition-all duration-200"
                    >
                      {ICONS.map(icon => (
                        <option key={icon.value} value={icon.value}>{icon.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Visibilidade */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Visibilidade</label>
                  <select
                    value={editHabitData.visibility}
                    onChange={(e) => setEditHabitData(prev => ({ ...prev, visibility: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-gray-500 focus:ring-1 focus:ring-gray-500 transition-all duration-200"
                  >
                    {VISIBILITY_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <p className="text-sm text-gray-500 mt-2">
                    {editHabitData.visibility === 'public' && 'Seus progressos serão visíveis para todos'}
                    {editHabitData.visibility === 'friends' && 'Seus progressos serão visíveis apenas para seus amigos'}
                    {editHabitData.visibility === 'private' && 'Seus progressos não aparecerão no feed de atividades'}
                  </p>
                </div>

                {/* Meta */}
                <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                  <h3 className="text-lg font-medium text-gray-800 mb-4">Meta (Opcional)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Meta</label>
                      <select
                        value={editHabitData.goal_type}
                        onChange={(e) => {
                          const newGoalType = e.target.value;
                          setEditHabitData(prev => ({ ...prev, goal_type: newGoalType }));
                          adjustRemindersForGoal(editHabitData.goal, newGoalType, true);
                        }}
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
                        value={editHabitData.goal}
                        onChange={(e) => {
                          const newGoal = parseInt(e.target.value) || 0;
                          setEditHabitData(prev => ({ ...prev, goal: newGoal }));
                          adjustRemindersForGoal(newGoal, editHabitData.goal_type, true);
                        }}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-gray-500 focus:ring-1 focus:ring-gray-500 transition-all duration-200"
                        placeholder="Ex: 7 (dias), 3 (vezes)"
                      />
                    </div>
                  </div>
                </div>

                {/* Lembrete */}
                <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                  <div className="flex items-start mb-4">
                    <label className="flex items-start cursor-pointer relative" htmlFor="edit-reminder-enabled">
                      <input 
                        type="checkbox"
                        checked={editHabitData.reminder_enabled}
                        onChange={(e) => setEditHabitData(prev => ({ ...prev, reminder_enabled: e.target.checked }))}
                        className="peer h-5 w-5 cursor-pointer transition-all appearance-none rounded border-2 border-gray-300 checked:bg-gray-800 checked:border-gray-800"
                        id="edit-reminder-enabled" 
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
                    <label className="cursor-pointer ml-4 text-gray-700" htmlFor="edit-reminder-enabled">
                      <div>
                        <p className="font-medium text-lg text-gray-800">
                          Ativar Lembrete
                        </p>
                        <p className="text-gray-600 mt-1">
                          Receba uma notificação diária para lembrar do hábito.
                        </p>
                      </div>
                    </label>
                  </div>
                  
                  {editHabitData.reminder_enabled && (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <label className="block text-sm font-medium text-gray-700">
                          {editHabitData.goal_type === 'count' ? 'Horários dos Lembretes' : 'Horário do Lembrete'}
                        </label>
                        {editHabitData.goal_type === 'count' && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">
                              {editHabitData.reminder_times.length}/{Math.max(1, editHabitData.goal || 1)}
                            </span>
                            <button
                              type="button"
                              onClick={() => addReminderTime(true)}
                              disabled={editHabitData.reminder_times.length >= Math.max(1, editHabitData.goal || 1)}
                              className={`text-sm px-3 py-1 rounded-md transition-colors flex items-center gap-1 ${
                                editHabitData.reminder_times.length >= Math.max(1, editHabitData.goal || 1)
                                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                              }`}
                            >
                              <span>+</span> Adicionar Horário
                            </button>
                          </div>
                        )}
                      </div>
                      
                      <div className="space-y-3">
                        {editHabitData.reminder_times.map((time, index) => (
                          <div key={index} className="flex items-center gap-3">
                            <input
                              type="time"
                              value={time}
                              onChange={(e) => updateReminderTime(index, e.target.value, true)}
                              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:border-gray-500 focus:ring-1 focus:ring-gray-500 transition-all duration-200"
                            />
                            {editHabitData.goal_type === 'count' && editHabitData.reminder_times.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeReminderTime(index, true)}
                                className="text-red-600 hover:text-red-800 p-2 hover:bg-red-50 rounded-md transition-colors"
                                title="Remover horário"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      
                      <p className="text-xs text-gray-500 mt-3">
                        {editHabitData.goal_type === 'count' 
                          ? `Para metas de "número de vezes por dia", você pode adicionar até ${Math.max(1, editHabitData.goal || 1)} lembrete${Math.max(1, editHabitData.goal || 1) > 1 ? 's' : ''} (um para cada vez que deseja realizar o hábito). ${editHabitData.goal === 0 ? 'Defina um valor maior que 0 na meta para adicionar mais lembretes.' : ''}`
                          : 'A notificação será exibida todos os dias neste horário.'
                        }
                      </p>
                    </div>
                  )}
                </div>

                {/* Botões */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={cancelEditHabit}
                    className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-all duration-200"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-all duration-200"
                  >
                    Salvar Alterações
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      
      {/* Mobile optimized delete confirmation modal */}
      {showDeleteModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4"
          onClick={cancelDeleteHabit}
        >
          <div 
            className="bg-white rounded-xl shadow-xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 sm:p-6">
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-100 rounded-full flex items-center justify-center mr-3 sm:mr-4 flex-shrink-0">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900">Confirmar Exclusão</h3>
                  <p className="text-xs sm:text-sm text-gray-500">Esta ação não pode ser desfeita</p>
                </div>
              </div>
              
              <p className="text-sm sm:text-base text-gray-700 mb-4 sm:mb-6 leading-relaxed">
                Tem certeza que deseja excluir o hábito <span className="font-semibold text-gray-900">"{habits.find(h => h.id === habitToDelete)?.name}"</span>? Todos os dados relacionados a ele serão perdidos permanentemente.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <button
                  onClick={cancelDeleteHabit}
                  className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-all duration-200 text-center"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDeleteHabit}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-all duration-200 text-center"
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal de Meta Completada */}
      <GoalCompletionModal
        isOpen={goalCompletionModal.isOpen}
        onClose={handleGoalModalClose}
        onConfirm={handleGoalCompletion}
        goalStatus={goalCompletionModal.goalStatus}
        habitName={goalCompletionModal.habitName}
      />
      
      {/* Modal do Feed de Atividades */}
      {showActivityFeed && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl max-h-[95vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Feed de Atividades</h2>
              <button
                onClick={() => setShowActivityFeed(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1"
              >
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto max-h-[calc(95vh-80px)]">
              <ActivityFeed />
            </div>
          </div>
        </div>
      )}
      
      {/* Sidebar de Amigos */}
      <FriendsSidebar 
        isOpen={showFriendsSidebar} 
        onClose={() => setShowFriendsSidebar(false)}
        onFriendUpdate={() => {
          // Recarregar dados se necessário
          fetchHabits();
        }}
      />
    </div>
  );
};

export default Dashboard;