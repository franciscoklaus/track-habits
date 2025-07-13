import { useState, useEffect, useContext, createContext, useCallback } from 'react';

// apiService.js
class ApiService {
  constructor() {
    this.baseURL = 'http://localhost:8080/api';
    this.token = localStorage.getItem('authToken');
  }

  // Método auxiliar para fazer requisições
  async request(url, options = {}) {
    // Garantir que temos o token mais atual do localStorage
    this.token = localStorage.getItem('authToken');
    
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    // Adicionar token de autenticação se disponível
    if (this.token) {
      config.headers.Authorization = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(`${this.baseURL}${url}`, config);
      
      // Se o token expirou, limpar e redirecionar
      if (response.status === 401) {
        this.clearAuth();
        window.location.href = '/login';
        throw new Error('Token expirado');
      }

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(errorData || `HTTP error! status: ${response.status}`);
      }

      // Verificar se há conteúdo para parsear
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }
      
      return null; // Para respostas 204 No Content
    } catch (error) {
      throw error;
    }
  }

  // Método para definir o token
  setToken(token) {
    this.token = token;
    localStorage.setItem('authToken', token);
  }

  // Método para limpar autenticação
  clearAuth() {
    this.token = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
  }

  // Verificar se está autenticado
  isAuthenticated() {
    // Sempre verificar o localStorage para ter o valor mais atual
    this.token = localStorage.getItem('authToken');
    const isAuth = !!this.token;
    return isAuth;
  }

  // MÉTODOS DE AUTENTICAÇÃO
  async register(userData) {
    const response = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
    
    if (response.token) {
      this.setToken(response.token);
      localStorage.setItem('user', JSON.stringify(response.user));
    }
    
    return response;
  }

  async login(credentials) {
    const response = await this.request('/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    
    if (response.token) {
      this.setToken(response.token);
      localStorage.setItem('user', JSON.stringify(response.user));
    }
    return response;
  }

  logout() {
    this.clearAuth();
  }

  getCurrentUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  }

  // MÉTODOS DE HÁBITOS
  async getHabits() {
    const data = await this.request('/habits');
    return Array.isArray(data) ? data : [];
  }

  async createHabit(habitData) {
    return await this.request('/habits', {
      method: 'POST',
      body: JSON.stringify(habitData),
    });
  }

  async getHabit(habitId) {
    return await this.request(`/habits/${habitId}`);
  }

  async updateHabit(habitId, habitData) {
    return await this.request(`/habits/${habitId}`, {
      method: 'PUT',
      body: JSON.stringify(habitData),
    });
  }

  async deleteHabit(habitId) {
    return await this.request(`/habits/${habitId}`, {
      method: 'DELETE',
    });
  }

  // MÉTODOS DE ENTRADAS DE HÁBITOS
  async getHabitEntries(habitId) {
    const result = await this.request(`/habits/${habitId}/entries`);
    return Array.isArray(result) ? result : [];
  }

  async createHabitEntry(habitId, entryData = {}) {
    return await this.request(`/habits/${habitId}/entries`, {
      method: 'POST',
      body: JSON.stringify({
        notes: '',
        completed_at: new Date().toISOString(),
        ...entryData,
      }),
    });
  }

  async deleteHabitEntry(habitId, entryId) {
    return await this.request(`/habits/${habitId}/entries/${entryId}`, {
      method: 'DELETE',
    });
  }

  // MÉTODOS DE ESTATÍSTICAS
  async getHabitStats(habitId) {
    return await this.request(`/habits/${habitId}/stats`);
  }

  // MÉTODOS DE HISTÓRICO DE METAS
  async getGoalCompletions(habitId) {
    const result = await this.request(`/habits/${habitId}/goal-completions`);
    return Array.isArray(result) ? result : [];
  }

  async createGoalCompletion(habitId, completionData) {
    return await this.request(`/habits/${habitId}/goal-completions`, {
      method: 'POST',
      body: JSON.stringify(completionData),
    });
  }

  async checkGoalCompletion(habitId) {
    return await this.request(`/habits/${habitId}/check-goal`);
  }

  async resetGoal(habitId) {
    return await this.request(`/habits/${habitId}/reset-goal`, {
      method: 'POST',
    });
  }

  // === SOCIAL FEATURES ===
  
  // Friends management
  async sendFriendRequest(email) {
    return this.request('/friends/request', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async getFriends() {
    const result = await this.request('/friends');
    return Array.isArray(result) ? result : [];
  }

  async getFriendRequests() {
    const result = await this.request('/friends/requests');
    return Array.isArray(result) ? result : [];
  }

  async acceptFriendRequest(requestId) {
    return this.request(`/friends/${requestId}/accept`, {
      method: 'PUT',
    });
  }

  async removeFriend(friendshipId) {
    return this.request(`/friends/${friendshipId}`, {
      method: 'DELETE',
    });
  }

  async cancelFriendRequest(requestId) {
    return this.request(`/friends/${requestId}/cancel`, {
      method: 'DELETE',
    });
  }

  // Activity feed
  async getFeed(limit = 20, offset = 0) {
    const result = await this.request(`/feed?limit=${limit}&offset=${offset}`);
    return Array.isArray(result) ? result : [];
  }

  async reactToActivity(activityId, reactionType) {
    return this.request(`/activities/${activityId}/react`, {
      method: 'POST',
      body: JSON.stringify({ reaction_type: reactionType }),
    });
  }

  async removeReaction(activityId) {
    return this.request(`/activities/${activityId}/react`, {
      method: 'DELETE',
    });
  }

  async commentOnActivity(activityId, comment) {
    return this.request(`/activities/${activityId}/comment`, {
      method: 'POST',
      body: JSON.stringify({ comment }),
    });
  }

  async getActivityComments(activityId) {
    const result = await this.request(`/activities/${activityId}/comments`);
    return Array.isArray(result) ? result : [];
  }

  // Create feed activity (internal method)
  async createFeedActivity(activityType, habitId = null, metadata = {}) {
    return this.request('/feed/create', {
      method: 'POST',
      body: JSON.stringify({
        activity_type: activityType,
        habit_id: habitId,
        metadata,
      }),
    });
  }

  // ============= GRUPOS =============
  
  // Listar grupos
  async getGroups() {
    return await this.request('/groups');
  }

  // Buscar grupo específico
  async getGroup(id) {
    return await this.request(`/groups/${id}`);
  }

  // Criar grupo
  async createGroup(groupData) {
    return await this.request('/groups', {
      method: 'POST',
      body: JSON.stringify(groupData),
    });
  }

  // Atualizar grupo
  async updateGroup(id, groupData) {
    return await this.request(`/groups/${id}`, {
      method: 'PUT',
      body: JSON.stringify(groupData),
    });
  }

  // Deletar grupo
  async deleteGroup(id) {
    return await this.request(`/groups/${id}`, {
      method: 'DELETE',
    });
  }

  // Entrar no grupo
  async joinGroup(id) {
    return await this.request(`/groups/${id}/join`, {
      method: 'POST',
    });
  }

  // Sair do grupo
  async leaveGroup(id) {
    return await this.request(`/groups/${id}/leave`, {
      method: 'DELETE',
    });
  }

  // Listar membros do grupo
  async getGroupMembers(id) {
    return await this.request(`/groups/${id}/members`);
  }

  // ============= DESAFIOS =============
  
  // Listar todos os desafios
  async getChallenges() {
    return await this.request('/challenges');
  }

  // Listar desafios ativos do usuário (filtrar apenas os que está participando e estão ativos)
  async getActiveChallenges() {
    const challenges = await this.request('/challenges');
    // Filtrar apenas desafios que o usuário está participando e que ainda estão dentro do período
    const now = new Date();
    return challenges.filter(challenge => {
      const startDate = new Date(challenge.start_date);
      const endDate = new Date(challenge.end_date);
      
      return challenge.is_participating && 
             (challenge.status === 'active' || 
              (challenge.status === 'upcoming' && startDate <= now)) && 
             endDate > now; // Ainda dentro do período, independente se foi completado ou não
    });
  }

  // Buscar desafio específico
  async getChallenge(id) {
    return await this.request(`/challenges/${id}`);
  }

  // Criar desafio
  async createChallenge(groupId, challengeData) {
    return await this.request(`/groups/${groupId}/challenges`, {
      method: 'POST',
      body: JSON.stringify(challengeData),
    });
  }

  // Atualizar desafio
  async updateChallenge(id, challengeData) {
    return await this.request(`/challenges/${id}`, {
      method: 'PUT',
      body: JSON.stringify(challengeData),
    });
  }

  // Deletar desafio
  async deleteChallenge(id) {
    return await this.request(`/challenges/${id}`, {
      method: 'DELETE',
    });
  }

  // Participar do desafio
  async joinChallenge(id) {
    return await this.request(`/challenges/${id}/join`, {
      method: 'POST',
    });
  }

  // Sair do desafio
  async leaveChallenge(id) {
    return await this.request(`/challenges/${id}/leave`, {
      method: 'DELETE',
    });
  }

  // Atualizar progresso no desafio
  async updateChallengeProgress(id, progressData) {
    return await this.request(`/challenges/${id}/progress`, {
      method: 'PUT',
      body: JSON.stringify(progressData),
    });
  }

  // Listar participantes do desafio
  async getChallengeParticipants(id) {
    return await this.request(`/challenges/${id}/participants`);
  }

  // ============= HISTÓRICO DE METAS =============

  // ============= ANALYTICS =============
  
  // Obter dados de analytics
  async getAnalytics(period = 30) {
    return await this.request(`/analytics?period=${period}`);
  }
}

// Hook personalizado para usar o serviço


// Contexto da API
const ApiContext = createContext();

// Provider do contexto
export const ApiProvider = ({ children }) => {
  const [api] = useState(() => new ApiService());
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const currentUser = api.getCurrentUser();
    const authStatus = api.isAuthenticated();
    setUser(currentUser);
    setIsAuthenticated(authStatus);
    setLoading(false);
  }, [api]);

  const login = async (credentials) => {
    try {
      const response = await api.login(credentials);
      setUser(response.user);
      setIsAuthenticated(true);
      return response;
    } catch (error) {
      throw error;
    }
  };

  const register = async (userData) => {
    try {
      const response = await api.register(userData);
      setUser(response.user);
      setIsAuthenticated(true);
      return response;
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    api.logout();
    setUser(null);
    setIsAuthenticated(false);
  };

  const value = {
    api,
    user,
    login,
    register,
    logout,
    isAuthenticated,
    loading,
  };

  return (
    <ApiContext.Provider value={value}>
      {children}
    </ApiContext.Provider>
  );
};

// Hook para usar a API
export const useApi = () => {
  const context = useContext(ApiContext);
  if (!context) {
    throw new Error('useApi deve ser usado dentro de um ApiProvider');
  }
  return context;
};

// Hooks customizados para funcionalidades específicas

// Hook para gerenciar hábitos
export const useHabits = () => {
  const { api } = useApi();
  const [habits, setHabits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchHabits = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getHabits();
      setHabits(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const createHabit = async (habitData) => {
    try {
      const newHabit = await api.createHabit(habitData);
      setHabits(prev => [newHabit, ...prev]);
      return newHabit;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const updateHabit = async (habitId, habitData) => {
    try {
      const updatedHabit = await api.updateHabit(habitId, habitData);
      setHabits(prev => prev.map(h => h.id === habitId ? updatedHabit : h));
      return updatedHabit;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const deleteHabit = async (habitId) => {
    try {
      await api.deleteHabit(habitId);
      setHabits(prev => prev.filter(h => h.id !== habitId));
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const completeHabit = async (habitId, notes = '') => {
    try {
      const entry = await api.createHabitEntry(habitId, { notes });
      return entry;
    } catch (err) {
      //setError(err.message);
      throw err;
    }
  };

  useEffect(() => {
    fetchHabits();
  }, []);

  return {
    habits,
    loading,
    error,
    fetchHabits,
    createHabit,
    updateHabit,
    deleteHabit,
    completeHabit,
  };
};

// Hook para gerenciar entradas de um hábito específico
export const useHabitEntries = (habitId) => {
  const { api } = useApi();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchEntries = async () => {
    if (!habitId) return;
    
    try {
      setLoading(true);
      setError(null);
      const data = await api.getHabitEntries(habitId);
      setEntries(data || []);
    } catch (err) {
      //setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addEntry = async (entryData) => {
    try {
      const newEntry = await api.createHabitEntry(habitId, entryData);
      setEntries(prev => [newEntry, ...prev]);
      return newEntry;
    } catch (err) {
      //setError(err.message);
      throw err;
    }
  };

  const deleteEntry = async (entryId) => {
    try {
      await api.deleteHabitEntry(habitId, entryId);
      setEntries(prev => prev.filter(entry => entry.id !== entryId));
    } catch (err) {
      //setError(err.message);
      throw err;
    }
  };

  useEffect(() => {
    fetchEntries();
  }, [habitId]);

  return {
    entries,
    loading,
    error,
    fetchEntries,
    addEntry,
    deleteEntry,
  };
};

// Hook para estatísticas de um hábito
export const useHabitStats = (habitId) => {
  const { api } = useApi();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchStats = async () => {
    if (!habitId) return;
    
    try {
      setLoading(true);
      setError(null);
      const data = await api.getHabitStats(habitId);
      setStats(data);
    } catch (err) {
      //setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [habitId]);

  return {
    stats,
    loading,
    error,
    fetchStats,
  };
};

// Hook para verificação e histórico de metas
export const useGoalManagement = (habitId) => {
  const { api } = useApi();
  const [goalStatus, setGoalStatus] = useState(null);
  const [completions, setCompletions] = useState([]);
  const [loading, setLoading] = useState(false);

  const checkGoalCompletion = async () => {
    if (!habitId) return;
    
    try {
      setLoading(true);
      const status = await api.checkGoalCompletion(habitId);
      setGoalStatus(status);
      return status;
    } catch (err) {
      console.error('Error checking goal completion:', err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const fetchCompletions = async () => {
    if (!habitId) return;
    
    try {
      const data = await api.getGoalCompletions(habitId);
      setCompletions(data || []);
    } catch (err) {
      console.error('Error fetching goal completions:', err);
    }
  };

  const recordGoalCompletion = async (completionData) => {
    try {
      const newCompletion = await api.createGoalCompletion(habitId, completionData);
      setCompletions(prev => [newCompletion, ...prev]);
      // Atualizar status após gravar
      await checkGoalCompletion();
      return newCompletion;
    } catch (err) {
      console.error('Error recording goal completion:', err);
      throw err;
    }
  };

  const resetGoal = async () => {
    try {
      await api.resetGoal(habitId);
      // Após resetar, buscar o status da meta novamente
      await checkGoalCompletion();
    } catch (err) {
      console.error('Error resetting goal:', err);
      throw err;
    }
  };

  useEffect(() => {
    if (habitId) {
      checkGoalCompletion();
      fetchCompletions();
    }
  }, [habitId]);

  return {
    goalStatus,
    completions,
    loading,
    checkGoalCompletion,
    fetchCompletions,
    recordGoalCompletion,
    resetGoal,
  };
};

// Hook para gerenciar desafios ativos
export const useActiveChallenges = () => {
  const { api } = useApi();
  const [activeChallenges, setActiveChallenges] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchActiveChallenges = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const challenges = await api.getActiveChallenges();
      setActiveChallenges(challenges || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [api]);

  const updateChallengeProgress = useCallback(async (challengeId, progressData) => {
    try {
      await api.updateChallengeProgress(challengeId, progressData);
      // Atualizar lista após progresso
      await fetchActiveChallenges();
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [api, fetchActiveChallenges]);

  useEffect(() => {
    fetchActiveChallenges();
  }, [fetchActiveChallenges]);

  return {
    activeChallenges,
    loading,
    error,
    fetchActiveChallenges,
    updateChallengeProgress,
  };
};

// Exportar a instância do serviço para uso direto se necessário
export const apiService = new ApiService();

export default ApiService;