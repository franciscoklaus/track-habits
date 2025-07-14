import React, { useState, useEffect } from 'react';
import { useApi } from '../services/apiService';
import './AnalyticsDashboard.css';

const AnalyticsDashboard = () => {
  const { api } = useApi();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState(30);

  useEffect(() => {
    fetchAnalytics();
  }, [period]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getAnalytics(period);
      setAnalytics(data);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatPercentage = (value) => {
    return `${Math.round(value)}%`;
  };

  const getActivityLevel = (count, maxCount) => {
    if (!maxCount) return 0;
    const percentage = (count / maxCount) * 100;
    if (percentage >= 80) return 4;
    if (percentage >= 60) return 3;
    if (percentage >= 40) return 2;
    if (percentage >= 20) return 1;
    return 0;
  };

  const renderActivityCalendar = () => {
    if (!analytics || !analytics.activity_calendar || analytics.activity_calendar.length === 0) {
      return (
        <div className="activity-calendar">
          <h3>Calendário de Atividades</h3>
          <div className="text-center py-8 text-gray-500">
            <p>Nenhuma atividade registrada no período</p>
          </div>
        </div>
      );
    }

    const calendar = analytics.activity_calendar;

    return (
      <div className="activity-calendar">
        <h3>Calendário de Atividades</h3>
        <div className="calendar-grid">
          {calendar.map((day, index) => (
            <div
              key={`${day.date}-${index}`}
              className={`calendar-day level-${day.level}`}
              title={`${new Date(day.date).toLocaleDateString('pt-BR')}: ${day.count} atividades`}
              role="gridcell"
              tabIndex={0}
            >
              <span className="day-count">{day.count || 0}</span>
            </div>
          ))}
        </div>
        <div className="calendar-legend">
          <span>Menos</span>
          <div className="legend-squares">
            {[0, 1, 2, 3, 4].map(level => (
              <div key={level} className={`legend-square level-${level}`} aria-label={`Nível ${level}`}></div>
            ))}
          </div>
          <span>Mais</span>
        </div>
      </div>
    );
  };

  const renderHabitTrends = () => {
    if (!analytics || !analytics.habit_trends || analytics.habit_trends.length === 0) {
      return (
        <div className="habit-trends">
          <h3>Tendências de Hábitos</h3>
          <div className="text-center py-8 text-gray-500">
            <p>Nenhum hábito encontrado no período</p>
          </div>
        </div>
      );
    }

    return (
      <div className="habit-trends">
        <h3>Tendências de Hábitos</h3>
        <div className="trends-list">
          {analytics.habit_trends.slice(0, 10).map((trend, index) => (
            <div key={`${trend.habit_id}-${index}`} className="trend-item">
              <div className="trend-info">
                <h4>{trend.habit_name || 'Hábito sem nome'}</h4>
                <span className="category">{trend.category || 'Geral'}</span>
              </div>
              <div className="trend-stats">
                <span className="total-count">{trend.total_count || 0} total</span>
                <span className="weekly-count">{trend.weekly_count || 0} esta semana</span>
                <span className={`trend-indicator ${trend.trend || 'stable'}`} role="img" aria-label={`Tendência ${trend.trend}`}>
                  {trend.trend === 'up' && '↗️'}
                  {trend.trend === 'down' && '↘️'}
                  {(trend.trend === 'stable' || !trend.trend) && '➡️'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderWeeklyStats = () => {
    if (!analytics || !analytics.weekly_stats) return null;

    return (
      <div className="weekly-stats">
        <h3>Progresso Semanal</h3>
        <div className="weeks-chart">
          {analytics.weekly_stats.map((week, index) => (
            <div key={index} className="week-bar">
              <div 
                className="week-progress"
                style={{ height: `${Math.max(week.completion_rate, 5)}%` }}
              ></div>
              <span className="week-label">
                {new Date(week.week_start).toLocaleDateString('pt-BR', { 
                  day: '2-digit', 
                  month: '2-digit' 
                })}
              </span>
              <span className="week-percentage">
                {formatPercentage(week.completion_rate)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderCategoryStats = () => {
    if (!analytics || !analytics.category_stats) return null;

    return (
      <div className="category-stats">
        <h3>Estatísticas por Categoria</h3>
        <div className="categories-list">
          {analytics.category_stats.map((category, index) => (
            <div key={index} className="category-item">
              <div className="category-header">
                <h4>{category.category}</h4>
                <span className="habit-count">{category.habit_count} hábitos</span>
              </div>
              <div className="category-progress">
                <div className="progress-bar">
                  <div 
                    className="progress-fill"
                    style={{ width: `${category.completion_rate}%` }}
                  ></div>
                </div>
                <span className="progress-text">
                  {category.completed}/{category.total} ({formatPercentage(category.completion_rate)})
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="analytics-dashboard">
        <div className="loading">
          <div className="loading-spinner"></div>
          <p>Carregando analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="analytics-dashboard">
        <div className="error">
          <h3>Erro ao carregar analytics</h3>
          <p>{error}</p>
          <button onClick={fetchAnalytics} className="retry-button">
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="analytics-dashboard">
        <div className="no-data">
          <h3>Sem dados de analytics</h3>
          <p>Comece a usar o app para ver suas estatísticas aqui!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="analytics-dashboard">
      <div className="dashboard-header">
        <h2>📊 Dashboard de Analytics</h2>
        <div className="period-selector">
          <label>Período:</label>
          <select 
            value={period} 
            onChange={(e) => setPeriod(parseInt(e.target.value))}
          >
            <option value={7}>Últimos 7 dias</option>
            <option value={30}>Últimos 30 dias</option>
            <option value={90}>Últimos 90 dias</option>
            <option value={365}>Último ano</option>
          </select>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="overview-cards">
        <div className="stat-card">
          <div className="stat-icon">📋</div>
          <div className="stat-content">
            <h3>{analytics.overview.total_habits}</h3>
            <p>Total de Hábitos</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🔥</div>
          <div className="stat-content">
            <h3>{analytics.overview.current_streak}</h3>
            <p>Streak Atual</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🏆</div>
          <div className="stat-content">
            <h3>{analytics.overview.longest_streak}</h3>
            <p>Maior Streak</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-content">
            <h3>{analytics.overview.total_entries}</h3>
            <p>Total Concluído</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📈</div>
          <div className="stat-content">
            <h3>{formatPercentage(analytics.overview.completion_rate)}</h3>
            <p>Taxa de Conclusão</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📅</div>
          <div className="stat-content">
            <h3>{formatPercentage(analytics.overview.weekly_progress)}</h3>
            <p>Progresso Semanal</p>
          </div>
        </div>
      </div>

      {/* Charts and Details */}
      <div className="analytics-content">
        <div className="analytics-row">
          <div className="analytics-card">
            {renderActivityCalendar()}
          </div>
        </div>

        <div className="analytics-row">
          <div className="analytics-card">
            {renderHabitTrends()}
          </div>
          <div className="analytics-card">
            {renderWeeklyStats()}
          </div>
        </div>

        <div className="analytics-row">
          <div className="analytics-card">
            {renderCategoryStats()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
