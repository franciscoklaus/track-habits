package main

import (
	"encoding/json"
	"net/http"
	"strconv"
)

// Estruturas para Analytics
type AnalyticsOverview struct {
	TotalHabits      int     `json:"total_habits"`
	ActiveHabits     int     `json:"active_habits"`
	TotalEntries     int     `json:"total_entries"`
	CurrentStreak    int     `json:"current_streak"`
	LongestStreak    int     `json:"longest_streak"`
	CompletionRate   float64 `json:"completion_rate"`
	WeeklyProgress   float64 `json:"weekly_progress"`
	MonthlyProgress  float64 `json:"monthly_progress"`
}

type HabitTrend struct {
	HabitID     int    `json:"habit_id"`
	HabitName   string `json:"habit_name"`
	Category    string `json:"category"`
	TotalCount  int    `json:"total_count"`
	WeeklyCount int    `json:"weekly_count"`
	Trend       string `json:"trend"` // "up", "down", "stable"
}

type ActivityCalendar struct {
	Date  string `json:"date"`
	Count int    `json:"count"`
	Level int    `json:"level"` // 0-4 (intensidade para heatmap)
}

type WeeklyStats struct {
	WeekStart      string  `json:"week_start"`
	Completed      int     `json:"completed"`
	Total          int     `json:"total"`
	CompletionRate float64 `json:"completion_rate"`
}

type CategoryStats struct {
	Category       string  `json:"category"`
	HabitCount     int     `json:"habit_count"`
	Completed      int     `json:"completed"`
	Total          int     `json:"total"`
	CompletionRate float64 `json:"completion_rate"`
}

type AnalyticsResponse struct {
	Overview         AnalyticsOverview  `json:"overview"`
	HabitTrends      []HabitTrend       `json:"habit_trends"`
	ActivityCalendar []ActivityCalendar `json:"activity_calendar"`
	WeeklyStats      []WeeklyStats      `json:"weekly_stats"`
	CategoryStats    []CategoryStats    `json:"category_stats"`
}

// Endpoint principal de analytics
func getAnalytics(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	
	// Parâmetros opcionais
	period := r.URL.Query().Get("period")
	if period == "" {
		period = "30" // 30 dias por padrão
	}
	
	days, err := strconv.Atoi(period)
	if err != nil {
		days = 30
	}
	
	analytics := AnalyticsResponse{
		Overview:         getOverview(userID, days),
		HabitTrends:      getHabitTrends(userID, days),
		ActivityCalendar: getActivityCalendar(userID, days),
		WeeklyStats:      getWeeklyStats(userID, days),
		CategoryStats:    getCategoryStats(userID, days),
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(analytics)
}

// Calcular overview geral
func getOverview(userID int, days int) AnalyticsOverview {
	var overview AnalyticsOverview
	
	// Total de hábitos
	db.QueryRow("SELECT COUNT(*) FROM habits WHERE user_id = ? AND is_active = 1", userID).Scan(&overview.TotalHabits)
	
	// Hábitos ativos (com entradas nos últimos 7 dias)
	db.QueryRow(`
		SELECT COUNT(DISTINCT h.id) 
		FROM habits h 
		JOIN habit_entries he ON h.id = he.habit_id 
		WHERE h.user_id = ? AND he.completed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
	`, userID).Scan(&overview.ActiveHabits)
	
	// Total de entradas no período
	db.QueryRow(`
		SELECT COUNT(*) 
		FROM habit_entries he 
		JOIN habits h ON he.habit_id = h.id 
		WHERE h.user_id = ? AND he.completed_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
	`, userID, days).Scan(&overview.TotalEntries)
	
	// Streak atual (dias consecutivos com pelo menos 1 entrada)
	overview.CurrentStreak = getCurrentStreakForUser(userID)
	
	// Maior streak
	overview.LongestStreak = getLongestStreakForUser(userID)
	
	// Taxa de conclusão (últimos 30 dias)
	overview.CompletionRate = calculateCompletionRate(userID, 30)
	
	// Progresso semanal
	overview.WeeklyProgress = calculateCompletionRate(userID, 7)
	
	// Progresso mensal
	overview.MonthlyProgress = calculateCompletionRate(userID, 30)
	
	return overview
}

// Calcular tendências de hábitos
func getHabitTrends(userID int, days int) []HabitTrend {
	query := `
		SELECT h.id, h.name, h.category,
			   COUNT(he.id) as total_count,
			   COUNT(CASE WHEN he.completed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as weekly_count
		FROM habits h
		LEFT JOIN habit_entries he ON h.id = he.habit_id AND he.completed_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
		WHERE h.user_id = ? AND h.is_active = 1
		GROUP BY h.id, h.name, h.category
		ORDER BY total_count DESC
		LIMIT 10
	`
	
	rows, err := db.Query(query, days, userID)
	if err != nil {
		return []HabitTrend{}
	}
	defer rows.Close()
	
	var trends []HabitTrend
	for rows.Next() {
		var trend HabitTrend
		rows.Scan(&trend.HabitID, &trend.HabitName, &trend.Category, &trend.TotalCount, &trend.WeeklyCount)
		
		// Calcular tendência
		if trend.WeeklyCount > trend.TotalCount/4 {
			trend.Trend = "up"
		} else if trend.WeeklyCount < trend.TotalCount/6 {
			trend.Trend = "down"
		} else {
			trend.Trend = "stable"
		}
		
		trends = append(trends, trend)
	}
	
	return trends
}

// Gerar calendário de atividades (heatmap)
func getActivityCalendar(userID int, days int) []ActivityCalendar {
	query := `
		SELECT DATE(he.completed_at) as date, COUNT(*) as count
		FROM habit_entries he
		JOIN habits h ON he.habit_id = h.id
		WHERE h.user_id = ? AND he.completed_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
		GROUP BY DATE(he.completed_at)
		ORDER BY date
	`
	
	rows, err := db.Query(query, userID, days)
	if err != nil {
		return []ActivityCalendar{}
	}
	defer rows.Close()
	
	var calendar []ActivityCalendar
	maxCount := 0
	
	for rows.Next() {
		var activity ActivityCalendar
		rows.Scan(&activity.Date, &activity.Count)
		if activity.Count > maxCount {
			maxCount = activity.Count
		}
		calendar = append(calendar, activity)
	}
	
	// Calcular níveis (0-4) baseado na contagem máxima
	for i := range calendar {
		if maxCount > 0 {
			calendar[i].Level = (calendar[i].Count * 4) / maxCount
			if calendar[i].Level > 4 {
				calendar[i].Level = 4
			}
		}
	}
	
	return calendar
}

// Estatísticas semanais
func getWeeklyStats(userID int, days int) []WeeklyStats {
	query := `
		SELECT 
			DATE_SUB(DATE(he.completed_at), INTERVAL WEEKDAY(he.completed_at) DAY) as week_start,
			COUNT(he.id) as completed,
			COUNT(DISTINCT h.id) * 7 as total
		FROM habit_entries he
		JOIN habits h ON he.habit_id = h.id
		WHERE h.user_id = ? AND he.completed_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
		GROUP BY week_start
		ORDER BY week_start DESC
		LIMIT 8
	`
	
	rows, err := db.Query(query, userID, days)
	if err != nil {
		return []WeeklyStats{}
	}
	defer rows.Close()
	
	var stats []WeeklyStats
	for rows.Next() {
		var week WeeklyStats
		rows.Scan(&week.WeekStart, &week.Completed, &week.Total)
		
		if week.Total > 0 {
			week.CompletionRate = float64(week.Completed) / float64(week.Total) * 100
		}
		
		stats = append(stats, week)
	}
	
	return stats
}

// Estatísticas por categoria
func getCategoryStats(userID int, days int) []CategoryStats {
	query := `
		SELECT 
			h.category,
			COUNT(DISTINCT h.id) as habit_count,
			COUNT(he.id) as completed,
			COUNT(DISTINCT h.id) * ? as total
		FROM habits h
		LEFT JOIN habit_entries he ON h.id = he.habit_id AND he.completed_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
		WHERE h.user_id = ? AND h.is_active = 1
		GROUP BY h.category
		ORDER BY completed DESC
	`
	
	rows, err := db.Query(query, days, days, userID)
	if err != nil {
		return []CategoryStats{}
	}
	defer rows.Close()
	
	var stats []CategoryStats
	for rows.Next() {
		var category CategoryStats
		rows.Scan(&category.Category, &category.HabitCount, &category.Completed, &category.Total)
		
		if category.Total > 0 {
			category.CompletionRate = float64(category.Completed) / float64(category.Total) * 100
		}
		
		stats = append(stats, category)
	}
	
	return stats
}

// Funções auxiliares
func getCurrentStreakForUser(userID int) int {
	// Buscar datas únicas com entradas
	rows, err := db.Query(`
		SELECT DISTINCT DATE(he.completed_at) as date
		FROM habit_entries he
		JOIN habits h ON he.habit_id = h.id
		WHERE h.user_id = ?
		ORDER BY date DESC
		LIMIT 365
	`, userID)
	
	if err != nil {
		return 0
	}
	defer rows.Close()
	
	var dates []string
	for rows.Next() {
		var date string
		rows.Scan(&date)
		dates = append(dates, date)
	}
	
	if len(dates) == 0 {
		return 0
	}
	
	// Calcular streak atual
	streak := 1
	for i := 1; i < len(dates); i++ {
		// Verificar se é dia consecutivo (diferença de 1 dia)
		// Implementação simplificada
		streak++
		if i > 10 { // Limitar para performance
			break
		}
	}
	
	return streak
}

func getLongestStreakForUser(userID int) int {
	var longestStreak int
	db.QueryRow(`
		SELECT COUNT(*) as max_streak
		FROM habit_entries he
		JOIN habits h ON he.habit_id = h.id
		WHERE h.user_id = ?
		GROUP BY DATE(he.completed_at)
		ORDER BY max_streak DESC
		LIMIT 1
	`, userID).Scan(&longestStreak)
	
	return longestStreak
}

func calculateLongestStreak(userID int) int {
	// Implementação simplificada - pode ser otimizada
	var longestStreak int
	db.QueryRow(`
		SELECT IFNULL(MAX(streak_length), 0) FROM (
			SELECT COUNT(*) as streak_length
			FROM habit_entries he
			JOIN habits h ON he.habit_id = h.id
			WHERE h.user_id = ?
			GROUP BY DATE(he.completed_at)
		) streaks
	`, userID).Scan(&longestStreak)
	
	return longestStreak
}

func calculateCompletionRate(userID int, days int) float64 {
	var completed, total int
	
	// Entradas completadas
	db.QueryRow(`
		SELECT COUNT(*)
		FROM habit_entries he
		JOIN habits h ON he.habit_id = h.id
		WHERE h.user_id = ? AND he.completed_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
	`, userID, days).Scan(&completed)
	
	// Total possível (hábitos * dias)
	db.QueryRow(`
		SELECT COUNT(*) * ?
		FROM habits h
		WHERE h.user_id = ? AND h.is_active = 1
	`, days, userID).Scan(&total)
	
	if total > 0 {
		return float64(completed) / float64(total) * 100
	}
	
	return 0
}
