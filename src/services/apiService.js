import { useState, useEffect, useContext, createContext } from 'react';

// apiService.js
class ApiService {
  constructor() {
    this.baseURL = 'http://192.168.0.89:8080/api';
    this.token = localStorage.getItem('authToken');
  }

  // Método auxiliar para fazer requisições
  async request(url, options = {}) {
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
      console.error('API Request Error:', error);
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
    return !!this.token;
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
    console.log(response)
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
    return await this.request('/habits');
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
    return await this.request(`/habits/${habitId}/entries`);
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

  // MÉTODOS DE ESTATÍSTICAS
  async getHabitStats(habitId) {
    return await this.request(`/habits/${habitId}/stats`);
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

  useEffect(() => {
    const currentUser = api.getCurrentUser();
    setUser(currentUser);
    setLoading(false);
  }, [api]);

  const login = async (credentials) => {
    try {
      const response = await api.login(credentials);
      setUser(response.user);
      return response;
    } catch (error) {
      throw error;
    }
  };

  const register = async (userData) => {
    try {
      const response = await api.register(userData);
      setUser(response.user);
      return response;
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    api.logout();
    setUser(null);
  };

  const value = {
    api,
    user,
    login,
    register,
    logout,
    isAuthenticated: api.isAuthenticated(),
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
      setError(err.message);
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
      setError(err.message);
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
      setError(err.message);
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
      setError(err.message);
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

// Exportar a instância do serviço para uso direto se necessário
export const apiService = new ApiService();

export default ApiService;