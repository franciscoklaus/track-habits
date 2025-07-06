// Serviço para gerenciar notificações do navegador
class NotificationService {
  constructor() {
    this.permission = null;
    this.scheduledNotifications = new Map();
    this.checkNotificationSupport();
  }

  // Verificar se o navegador suporta notificações
  checkNotificationSupport() {
    if (!('Notification' in window)) {
      console.warn('Este navegador não suporta notificações');
      return false;
    }
    this.permission = Notification.permission;
    return true;
  }

  // Solicitar permissão para enviar notificações
  async requestPermission() {
    if (!this.checkNotificationSupport()) {
      return false;
    }

    if (this.permission === 'granted') {
      return true;
    }

    if (this.permission === 'denied') {
      console.warn('Permissão para notificações foi negada');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      this.permission = permission;
      return permission === 'granted';
    } catch (error) {
      console.error('Erro ao solicitar permissão para notificações:', error);
      return false;
    }
  }

  // Enviar notificação imediata
  async sendNotification(title, options = {}) {
    if (!(await this.requestPermission())) {
      return false;
    }

    const defaultOptions = {
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      vibrate: [200, 100, 200],
      requireInteraction: true,
      tag: 'habit-reminder'
    };

    const notification = new Notification(title, { ...defaultOptions, ...options });

    // Auto-fechar após 10 segundos se não for interativa
    if (!options.requireInteraction) {
      setTimeout(() => notification.close(), 10000);
    }

    return notification;
  }

  // Agendar notificação para um horário específico
  scheduleNotification(habitId, habitName, time) {
    // Cancelar notificação anterior se existir
    this.cancelNotification(habitId, time);

    const now = new Date();
    const [hours, minutes] = time.split(':').map(Number);
    
    const notificationTime = new Date();
    notificationTime.setHours(hours, minutes, 0, 0);

    // Se o horário já passou hoje, agendar para amanhã
    if (notificationTime <= now) {
      notificationTime.setDate(notificationTime.getDate() + 1);
    }

    const delay = notificationTime.getTime() - now.getTime();
    const notificationKey = `${habitId}-${time}`;

    const timeoutId = setTimeout(() => {
      this.sendNotification(
        `Lembrete: ${habitName}`,
        {
          body: `Hora de ${habitName.toLowerCase()}! Não se esqueça de completar seu hábito.`,
          icon: '/favicon.ico',
          tag: `habit-${habitId}-${time}`,
          data: { habitId, habitName, time }
        }
      );

      // Reagendar para o próximo dia
      this.scheduleNotification(habitId, habitName, time);
    }, delay);

    this.scheduledNotifications.set(notificationKey, timeoutId);

    console.log(`Lembrete agendado para ${habitName} às ${time}`);
    return timeoutId;
  }

  // Agendar múltiplos horários para um hábito
  scheduleMultipleNotifications(habitId, habitName, times) {
    // Cancelar todas as notificações do hábito primeiro
    this.cancelHabitNotifications(habitId);
    
    // Agendar cada horário
    times.forEach(time => {
      this.scheduleNotification(habitId, habitName, time);
    });
  }

  // Cancelar notificação agendada específica
  cancelNotification(habitId, time = null) {
    if (time) {
      const notificationKey = `${habitId}-${time}`;
      const timeoutId = this.scheduledNotifications.get(notificationKey);
      if (timeoutId) {
        clearTimeout(timeoutId);
        this.scheduledNotifications.delete(notificationKey);
        console.log(`Lembrete cancelado para hábito ${habitId} às ${time}`);
      }
    } else {
      // Cancelar todas as notificações do hábito (compatibilidade com versão anterior)
      this.cancelHabitNotifications(habitId);
    }
  }

  // Cancelar todas as notificações de um hábito
  cancelHabitNotifications(habitId) {
    const keysToDelete = [];
    this.scheduledNotifications.forEach((timeoutId, key) => {
      if (key.startsWith(`${habitId}-`)) {
        clearTimeout(timeoutId);
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => {
      this.scheduledNotifications.delete(key);
    });
    
    if (keysToDelete.length > 0) {
      console.log(`${keysToDelete.length} lembretes cancelados para hábito ${habitId}`);
    }
  }

  // Agendar todos os lembretes ativos
  scheduleAllReminders(habits) {
    habits.forEach(habit => {
      if (habit.reminder_enabled) {
        if (habit.reminder_times && habit.reminder_times.length > 0) {
          // Usar múltiplos horários se disponível
          this.scheduleMultipleNotifications(habit.id, habit.name, habit.reminder_times);
        } else if (habit.reminder_time) {
          // Fallback para horário único
          this.scheduleNotification(habit.id, habit.name, habit.reminder_time);
        }
      }
    });
  }

  // Cancelar todos os lembretes
  cancelAllReminders() {
    this.scheduledNotifications.forEach((timeoutId, habitId) => {
      clearTimeout(timeoutId);
    });
    this.scheduledNotifications.clear();
    console.log('Todos os lembretes foram cancelados');
  }

  // Verificar status da permissão
  getPermissionStatus() {
    return this.permission;
  }

  // Testar notificação
  async testNotification() {
    return await this.sendNotification(
      'Teste de Notificação',
      {
        body: 'As notificações estão funcionando corretamente!',
        requireInteraction: false
      }
    );
  }
}

// Instância singleton
const notificationService = new NotificationService();

export default notificationService;
