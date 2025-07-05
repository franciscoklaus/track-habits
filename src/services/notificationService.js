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
    this.cancelNotification(habitId);

    const now = new Date();
    const [hours, minutes] = time.split(':').map(Number);
    
    const notificationTime = new Date();
    notificationTime.setHours(hours, minutes, 0, 0);

    // Se o horário já passou hoje, agendar para amanhã
    if (notificationTime <= now) {
      notificationTime.setDate(notificationTime.getDate() + 1);
    }

    const delay = notificationTime.getTime() - now.getTime();

    const timeoutId = setTimeout(() => {
      this.sendNotification(
        `Lembrete: ${habitName}`,
        {
          body: 'Não se esqueça de completar seu hábito hoje!',
          icon: '/favicon.ico',
          tag: `habit-${habitId}`,
          data: { habitId, habitName }
        }
      );

      // Reagendar para o próximo dia
      this.scheduleNotification(habitId, habitName, time);
    }, delay);

    this.scheduledNotifications.set(habitId, timeoutId);

    console.log(`Lembrete agendado para ${habitName} às ${time}`);
    return timeoutId;
  }

  // Cancelar notificação agendada
  cancelNotification(habitId) {
    const timeoutId = this.scheduledNotifications.get(habitId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.scheduledNotifications.delete(habitId);
      console.log(`Lembrete cancelado para hábito ${habitId}`);
    }
  }

  // Agendar todos os lembretes ativos
  scheduleAllReminders(habits) {
    habits.forEach(habit => {
      if (habit.reminder_enabled && habit.reminder_time) {
        this.scheduleNotification(habit.id, habit.name, habit.reminder_time);
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
