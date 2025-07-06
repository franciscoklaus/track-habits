package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	_ "github.com/go-sql-driver/mysql"
	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/mux"
	"github.com/rs/cors"
	"golang.org/x/crypto/bcrypt"
)

type User struct {
	ID        int       `json:"id"`
	Username  string    `json:"username"`
	Email     string    `json:"email"`
	Password  string    `json:"password,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

type Habit struct {
	ID          int       `json:"id"`
	UserID      int       `json:"user_id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"created_at"`
	IsActive    bool      `json:"is_active"`
	MultipleUpdate bool  `json:"multipleUpdate"`
	Category    string    `json:"category"`
	Icon        string    `json:"icon"`
	Goal        int       `json:"goal"`
	GoalType    string    `json:"goal_type"` // "streak", "count", "weekly", "monthly"
	ReminderEnabled bool  `json:"reminder_enabled"`
	ReminderTime string   `json:"reminder_time"` // HH:MM format (legacy)
	ReminderTimes []string `json:"reminder_times"` // Array de horários HH:MM
}

type HabitEntry struct {
	ID          int       `json:"id"`
	HabitID     int       `json:"habit_id"`
	CompletedAt time.Time `json:"completed_at"`
	Notes       string    `json:"notes,omitempty"`
}

type HabitStats struct {
	HabitID       int `json:"habit_id"`
	TotalCount    int `json:"total_count"`
	CurrentStreak int `json:"current_streak"`
	LongestStreak int `json:"longest_streak"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type RegisterRequest struct {
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

type AuthResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}

var db *sql.DB
var jwtSecret = []byte("your-secret-key-change-in-production")

func main() {
	// Initialize database
	var err error
	dsn := "root:rootpass123@tcp(localhost:3306)/habit_tracker?parseTime=true"
	db, err = sql.Open("mysql", dsn)
	if err != nil {
		log.Fatal("Error connecting to database:", err)
	}
	defer db.Close()

	// Test database connection
	if err = db.Ping(); err != nil {
		log.Fatal("Error pinging database:", err)
	}

	// Initialize database tables
	initDB()

	r := mux.NewRouter()
	
	// API routes
	api := r.PathPrefix("/api").Subrouter()
	
	// Auth routes
	api.HandleFunc("/auth/register", register).Methods("POST")
	api.HandleFunc("/login", login).Methods("POST")
	
	// Protected routes
	protected := api.PathPrefix("").Subrouter()
	protected.Use(authMiddleware)
	
	// Habit routes
	protected.HandleFunc("/habits", getHabits).Methods("GET")
	protected.HandleFunc("/habits", createHabit).Methods("POST")
	protected.HandleFunc("/habits/{id}", getHabit).Methods("GET")
	protected.HandleFunc("/habits/{id}", updateHabit).Methods("PUT")
	protected.HandleFunc("/habits/{id}", deleteHabit).Methods("DELETE")
	
	// Habit entry routes
	protected.HandleFunc("/habits/{id}/entries", getHabitEntries).Methods("GET")
	protected.HandleFunc("/habits/{id}/entries", createHabitEntry).Methods("POST")
	protected.HandleFunc("/habits/{id}/entries/{entryId}", deleteHabitEntry).Methods("DELETE")
	protected.HandleFunc("/habits/{id}/stats", getHabitStats).Methods("GET")

	// Configure CORS
	c := cors.New(cors.Options{
	AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
	AllowedHeaders:   []string{"*"},
	AllowCredentials: true,
	AllowOriginFunc: func(origin string) bool {
		return strings.HasPrefix(origin, "http://192.168.0.") || origin == "http://localhost:3000" || origin == "http://localhost:3001"
	},
})

	handler := c.Handler(r)

	fmt.Println("Server starting on :8080")
	log.Fatal(http.ListenAndServe(":8080", handler))
}

func initDB() {
	// Create users table
	createUsersTable := `
	CREATE TABLE IF NOT EXISTS users (
		id INT AUTO_INCREMENT PRIMARY KEY,
		username VARCHAR(50) UNIQUE NOT NULL,
		email VARCHAR(100) UNIQUE NOT NULL,
		password VARCHAR(255) NOT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	)`

	// Create habits table
	createHabitsTable := `
	CREATE TABLE IF NOT EXISTS habits (
		id INT AUTO_INCREMENT PRIMARY KEY,
		user_id INT NOT NULL,
		name VARCHAR(100) NOT NULL,
		description TEXT,
		is_active BOOLEAN DEFAULT TRUE,
		multipleUpdate BOOLEAN DEFAULT FALSE,
		category VARCHAR(50) DEFAULT 'geral',
		icon VARCHAR(50) DEFAULT 'target',
		goal INT DEFAULT 0,
		goal_type VARCHAR(20) DEFAULT 'streak',
		reminder_enabled BOOLEAN DEFAULT FALSE,
		reminder_time VARCHAR(5) DEFAULT '09:00',
		reminder_times TEXT,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
	)`

	// Create habit_entries table
	createEntriesTable := `
	CREATE TABLE IF NOT EXISTS habit_entries (
		id INT AUTO_INCREMENT PRIMARY KEY,
		habit_id INT NOT NULL,
		completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		notes TEXT,
		FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE
	)`

	tables := []string{createUsersTable, createHabitsTable, createEntriesTable}
	
	for _, table := range tables {
		if _, err := db.Exec(table); err != nil {
			log.Fatal("Error creating table:", err)
		}
	}

	fmt.Println("Database tables initialized successfully")
}

func hashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), 14)
	return string(bytes), err
}

func checkPasswordHash(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

// Funções auxiliares para múltiplos horários de lembrete
func reminderTimesToString(times []string) string {
	if len(times) == 0 {
		return ""
	}
	timesJSON, _ := json.Marshal(times)
	return string(timesJSON)
}

func stringToReminderTimes(str string) []string {
	if str == "" {
		return []string{}
	}
	var times []string
	json.Unmarshal([]byte(str), &times)
	return times
}

func generateJWT(userID int) (string, error) {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id": userID,
		"exp":     time.Now().Add(time.Hour * 24 * 7).Unix(), // 7 days
	})

	return token.SignedString(jwtSecret)
}

func authMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, "Authorization header required", http.StatusUnauthorized)
			return
		}

		bearerToken := strings.Split(authHeader, " ")
		if len(bearerToken) != 2 || bearerToken[0] != "Bearer" {
			http.Error(w, "Invalid authorization header format", http.StatusUnauthorized)
			return
		}

		token, err := jwt.Parse(bearerToken[1], func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return jwtSecret, nil
		})

		if err != nil {
			http.Error(w, "Invalid token", http.StatusUnauthorized)
			return
		}

		if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
			userID := int(claims["user_id"].(float64))
			r.Header.Set("user_id", strconv.Itoa(userID))
			next.ServeHTTP(w, r)
		} else {
			http.Error(w, "Invalid token", http.StatusUnauthorized)
		}
	})
}

func register(w http.ResponseWriter, r *http.Request) {
	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	// Validate input
	if req.Username == "" || req.Email == "" || req.Password == "" {
		http.Error(w, "Username, email, and password are required", http.StatusBadRequest)
		return
	}

	// Hash password
	hashedPassword, err := hashPassword(req.Password)
	if err != nil {
		http.Error(w, "Error hashing password", http.StatusInternalServerError)
		return
	}

	// Insert user into database
	query := "INSERT INTO users (username, email, password) VALUES (?, ?, ?)"
	result, err := db.Exec(query, req.Username, req.Email, hashedPassword)
	if err != nil {
		if strings.Contains(err.Error(), "Duplicate entry") {
			http.Error(w, "Username or email already exists", http.StatusConflict)
			return
		}
		http.Error(w, "Error creating user", http.StatusInternalServerError)
		return
	}

	userID, _ := result.LastInsertId()

	// Generate JWT token
	token, err := generateJWT(int(userID))
	if err != nil {
		http.Error(w, "Error generating token", http.StatusInternalServerError)
		return
	}

	user := User{
		ID:       int(userID),
		Username: req.Username,
		Email:    req.Email,
	}

	response := AuthResponse{
		Token: token,
		User:  user,
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(response)
}

func login(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	// Get user from database
	var user User
	var hashedPassword string
	query := "SELECT id, username, email, password FROM users WHERE email = ?"
	err := db.QueryRow(query, req.Email).Scan(&user.ID, &user.Username, &user.Email, &hashedPassword)
	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "Invalid credentials", http.StatusUnauthorized)
			return
		}
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	// Check password
	if !checkPasswordHash(req.Password, hashedPassword) {
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	// Generate JWT token
	token, err := generateJWT(user.ID)
	if err != nil {
		http.Error(w, "Error generating token", http.StatusInternalServerError)
		return
	}

	response := AuthResponse{
		Token: token,
		User:  user,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func getUserID(r *http.Request) int {
	userIDStr := r.Header.Get("user_id")
	userID, _ := strconv.Atoi(userIDStr)
	return userID
}

func getHabits(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	
	query := "SELECT id, user_id, name, description, is_active, multipleUpdate, category, icon, goal, goal_type, reminder_enabled, reminder_time, reminder_times, created_at FROM habits WHERE user_id = ? ORDER BY created_at DESC"
	rows, err := db.Query(query, userID)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var habits []Habit
	for rows.Next() {
		var habit Habit
		var reminderTimesStr sql.NullString
		err := rows.Scan(&habit.ID, &habit.UserID, &habit.Name, &habit.Description, &habit.IsActive, &habit.MultipleUpdate, &habit.Category, &habit.Icon, &habit.Goal, &habit.GoalType, &habit.ReminderEnabled, &habit.ReminderTime, &reminderTimesStr, &habit.CreatedAt)
		if err != nil {
			http.Error(w, "Error scanning habits", http.StatusInternalServerError)
			return
		}
		
		// Converter reminder_times do banco para array
		if reminderTimesStr.Valid && reminderTimesStr.String != "" {
			habit.ReminderTimes = stringToReminderTimes(reminderTimesStr.String)
		} else {
			// Se não tem reminder_times, usar reminder_time como fallback
			if habit.ReminderTime != "" {
				habit.ReminderTimes = []string{habit.ReminderTime}
			} else {
				habit.ReminderTimes = []string{}
			}
		}
		
		fmt.Printf("Habit %d: reminder_time='%s', reminder_times_str='%s', final_reminder_times=%v\n", 
			habit.ID, habit.ReminderTime, reminderTimesStr.String, habit.ReminderTimes)
		
		habits = append(habits, habit)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(habits)
}

func calculateStreaks(db *sql.DB, habitID int) (int, int, error) {
    // Buscar todas as datas de conclusão ordenadas
    query := `
        SELECT DATE(completed_at) as completion_date 
        FROM habit_entries 
        WHERE habit_id = ? 
        ORDER BY completion_date DESC
    `
    
    rows, err := db.Query(query, habitID)
    if err != nil {
        return 0, 0, err
    }
    defer rows.Close()
    
    var dates []time.Time
    for rows.Next() {
        var dateStr string
        if err := rows.Scan(&dateStr); err != nil {
            return 0, 0, err
        }
        date, _ := time.Parse("2006-01-02", dateStr)
        dates = append(dates, date)
    }
    
    if len(dates) == 0 {
        return 0, 0, nil
    }
    
    // Calcular current streak
    currentStreak := calculateCurrentStreak(dates)
    
    // Calcular longest streak
    longestStreak := calculateLongestStreak(dates)
    
    return currentStreak, longestStreak, nil
}

func calculateCurrentStreak(dates []time.Time) int {
    if len(dates) == 0 {
        return 0
    }
    
    today := time.Now().Truncate(24 * time.Hour)
    yesterday := today.AddDate(0, 0, -1)
    
    // Se não foi feito hoje nem ontem, streak = 0
    if !dates[0].Equal(today) && !dates[0].Equal(yesterday) {
        return 0
    }
    
    streak := 0
    expectedDate := today
    
    // Se não foi feito hoje, começar de ontem
    if !dates[0].Equal(today) {
        expectedDate = yesterday
    }
    
    for _, date := range dates {
        if date.Equal(expectedDate) {
            streak++
            expectedDate = expectedDate.AddDate(0, 0, -1)
        } else {
            break
        }
    }
    
    return streak
}

func calculateLongestStreak(dates []time.Time) int {
    if len(dates) == 0 {
        return 0
    }
    
    maxStreak := 1
    currentStreak := 1
    
    for i := 1; i < len(dates); i++ {
        // Verificar se a data atual é consecutiva à anterior
        expectedDate := dates[i-1].AddDate(0, 0, -1)
        
        if dates[i].Equal(expectedDate) {
            currentStreak++
            if currentStreak > maxStreak {
                maxStreak = currentStreak
            }
        } else {
            currentStreak = 1
        }
    }
    
    return maxStreak
}

func createHabit(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	
	var habit Habit
	if err := json.NewDecoder(r.Body).Decode(&habit); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	// Set default values if not provided
	if habit.Category == "" {
		habit.Category = "geral"
	}
	if habit.Icon == "" {
		habit.Icon = "target"
	}
	if habit.GoalType == "" {
		habit.GoalType = "streak"
	}
	if habit.ReminderTime == "" {
		habit.ReminderTime = "09:00"
	}
	
	// Processar reminder_times
	var reminderTimesStr string
	if len(habit.ReminderTimes) > 0 {
		reminderTimesStr = reminderTimesToString(habit.ReminderTimes)
	} else if habit.ReminderTime != "" {
		// Fallback para reminder_time se reminder_times estiver vazio
		habit.ReminderTimes = []string{habit.ReminderTime}
		reminderTimesStr = reminderTimesToString(habit.ReminderTimes)
	}

	query := "INSERT INTO habits (user_id, name, description, is_active, multipleUpdate, category, icon, goal, goal_type, reminder_enabled, reminder_time, reminder_times) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
	result, err := db.Exec(query, userID, habit.Name, habit.Description, true, habit.MultipleUpdate, habit.Category, habit.Icon, habit.Goal, habit.GoalType, habit.ReminderEnabled, habit.ReminderTime, reminderTimesStr)
	if err != nil {
		log.Printf("Error creating habit: %v", err)
		log.Printf("Query: %s", query)
		log.Printf("Values: userID=%d, name=%s, description=%s, multipleUpdate=%v, category=%s, icon=%s, goal=%d, goal_type=%s, reminder_enabled=%v, reminder_time=%s, reminder_times=%s", 
			userID, habit.Name, habit.Description, habit.MultipleUpdate, habit.Category, habit.Icon, habit.Goal, habit.GoalType, habit.ReminderEnabled, habit.ReminderTime, reminderTimesStr)
		http.Error(w, "Error creating habit", http.StatusInternalServerError)
		return
	}

	habitID, _ := result.LastInsertId()
	habit.ID = int(habitID)
	habit.UserID = userID
	habit.IsActive = true
	habit.CreatedAt = time.Now()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(habit)
}

func getHabit(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	vars := mux.Vars(r)
	habitID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid habit ID", http.StatusBadRequest)
		return
	}

	var habit Habit
	query := "SELECT id, user_id, name, description, is_active, multipleUpdate, category, icon, goal, goal_type, reminder_enabled, reminder_time, reminder_times, created_at FROM habits WHERE id = ? AND user_id = ?"
	var reminderTimesStr sql.NullString
	err = db.QueryRow(query, habitID, userID).Scan(&habit.ID, &habit.UserID, &habit.Name, &habit.Description, &habit.IsActive, &habit.MultipleUpdate, &habit.Category, &habit.Icon, &habit.Goal, &habit.GoalType, &habit.ReminderEnabled, &habit.ReminderTime, &reminderTimesStr, &habit.CreatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "Habit not found", http.StatusNotFound)
			return
		}
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	
	// Converter reminder_times do banco para array
	if reminderTimesStr.Valid && reminderTimesStr.String != "" {
		habit.ReminderTimes = stringToReminderTimes(reminderTimesStr.String)
	} else {
		// Se não tem reminder_times, usar reminder_time como fallback
		if habit.ReminderTime != "" {
			habit.ReminderTimes = []string{habit.ReminderTime}
		} else {
			habit.ReminderTimes = []string{}
		}
	}
	
	fmt.Printf("Single habit %d: reminder_time='%s', reminder_times_str='%s', final_reminder_times=%v\n", 
		habit.ID, habit.ReminderTime, reminderTimesStr.String, habit.ReminderTimes)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(habit)
}

func updateHabit(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	vars := mux.Vars(r)
	habitID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid habit ID", http.StatusBadRequest)
		return
	}

	var habit Habit
	if err := json.NewDecoder(r.Body).Decode(&habit); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	// Processar reminder_times
	var reminderTimesStr string
	if len(habit.ReminderTimes) > 0 {
		reminderTimesStr = reminderTimesToString(habit.ReminderTimes)
	} else if habit.ReminderTime != "" {
		// Fallback para reminder_time se reminder_times estiver vazio
		habit.ReminderTimes = []string{habit.ReminderTime}
		reminderTimesStr = reminderTimesToString(habit.ReminderTimes)
	}

	query := "UPDATE habits SET name = ?, description = ?, is_active = ?, multipleUpdate = ?, category = ?, icon = ?, goal = ?, goal_type = ?, reminder_enabled = ?, reminder_time = ?, reminder_times = ? WHERE id = ? AND user_id = ?"
	result, err := db.Exec(query, habit.Name, habit.Description, habit.IsActive, habit.MultipleUpdate, habit.Category, habit.Icon, habit.Goal, habit.GoalType, habit.ReminderEnabled, habit.ReminderTime, reminderTimesStr, habitID, userID)
	if err != nil {
		http.Error(w, "Error updating habit", http.StatusInternalServerError)
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		http.Error(w, "Habit not found", http.StatusNotFound)
		return
	}

	habit.ID = habitID
	habit.UserID = userID

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(habit)
}

func deleteHabit(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	vars := mux.Vars(r)
	habitID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid habit ID", http.StatusBadRequest)
		return
	}

	query := "DELETE FROM habits WHERE id = ? AND user_id = ?"
	result, err := db.Exec(query, habitID, userID)
	if err != nil {
		http.Error(w, "Error deleting habit", http.StatusInternalServerError)
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		http.Error(w, "Habit not found", http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func getHabitEntries(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	vars := mux.Vars(r)
	habitID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid habit ID", http.StatusBadRequest)
		return
	}

	// Verify habit belongs to user
	var count int
	err = db.QueryRow("SELECT COUNT(*) FROM habits WHERE id = ? AND user_id = ?", habitID, userID).Scan(&count)
	if err != nil || count == 0 {
		http.Error(w, "Habit not found", http.StatusNotFound)
		return
	}

	query := "SELECT id, habit_id, completed_at, notes FROM habit_entries WHERE habit_id = ? ORDER BY completed_at DESC"
	rows, err := db.Query(query, habitID)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var entries []HabitEntry
	for rows.Next() {
		var entry HabitEntry
		var notes sql.NullString
		err := rows.Scan(&entry.ID, &entry.HabitID, &entry.CompletedAt, &notes)
		if err != nil {
			http.Error(w, "Error scanning entries", http.StatusInternalServerError)
			return
		}
		if notes.Valid {
			entry.Notes = notes.String
		}
		entries = append(entries, entry)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(entries)
}

func createHabitEntry(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	vars := mux.Vars(r)
	habitID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid habit ID", http.StatusBadRequest)
		return
	}

	// Verify habit belongs to user
	var count int
	err = db.QueryRow("SELECT COUNT(*) FROM habits WHERE id = ? AND user_id = ?", habitID, userID).Scan(&count)
	if err != nil || count == 0 {
		http.Error(w, "Habit not found", http.StatusNotFound)
		return
	}

	var habit Habit
	query := "SELECT id, user_id, name, description, is_active, multipleUpdate, created_at FROM habits WHERE id = ? AND user_id = ?"
	err = db.QueryRow(query, habitID, userID).Scan(&habit.ID, &habit.UserID, &habit.Name, &habit.Description, &habit.IsActive, &habit.MultipleUpdate, &habit.CreatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "Habit not found", http.StatusNotFound)
			return
		}
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	var entry HabitEntry
	if err := json.NewDecoder(r.Body).Decode(&entry); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	// Check if already completed today
	if !habit.MultipleUpdate {
		today := time.Now().Format("2006-01-02")
		err = db.QueryRow("SELECT COUNT(*) FROM habit_entries WHERE habit_id = ? AND DATE(completed_at) = ?", habitID, today).Scan(&count)
		if err == nil && count > 0 {
			http.Error(w, "Habit already completed today", http.StatusConflict)
			return
		}
	}
	if entry.CompletedAt.IsZero() {
		entry.CompletedAt = time.Now()
	}
	
	query = "INSERT INTO habit_entries (habit_id, completed_at, notes) VALUES (?, ?, ?)"
	result, err := db.Exec(query, habitID, entry.CompletedAt, entry.Notes)
	if err != nil {
		http.Error(w, "Error creating entry", http.StatusInternalServerError)
		return
	}

	entryID, _ := result.LastInsertId()
	entry.ID = int(entryID)
	entry.HabitID = habitID

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(entry)
}

func getHabitStats(w http.ResponseWriter, r *http.Request) {
    userID := getUserID(r)
    vars := mux.Vars(r)
    habitID, err := strconv.Atoi(vars["id"])
    if err != nil {
        http.Error(w, "Invalid habit ID", http.StatusBadRequest)
        return
    }

    // Verificar se o hábito pertence ao usuário
    var count int
    err = db.QueryRow("SELECT COUNT(*) FROM habits WHERE id = ? AND user_id = ?", habitID, userID).Scan(&count)
    if err != nil || count == 0 {
        http.Error(w, "Habit not found", http.StatusNotFound)
        return
    }

    // Contar total de entradas
    var totalCount int
    err = db.QueryRow("SELECT COUNT(*) FROM habit_entries WHERE habit_id = ?", habitID).Scan(&totalCount)
    if err != nil {
        http.Error(w, "Database error", http.StatusInternalServerError)
        return
    }

    // Calcular streaks
    currentStreak, longestStreak, err := calculateStreaks(db, habitID)
    if err != nil {
        http.Error(w, "Error calculating streaks", http.StatusInternalServerError)
        return
    }

    stats := HabitStats{
        HabitID:       habitID,
        TotalCount:    totalCount,
        CurrentStreak: currentStreak,
        LongestStreak: longestStreak,
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(stats)
}

func deleteHabitEntry(w http.ResponseWriter, r *http.Request) {
    userID := getUserID(r)
    vars := mux.Vars(r)
    habitID, err := strconv.Atoi(vars["id"])
    if err != nil {
        http.Error(w, "Invalid habit ID", http.StatusBadRequest)
        return
    }
    
    entryID, err := strconv.Atoi(vars["entryId"])
    if err != nil {
        http.Error(w, "Invalid entry ID", http.StatusBadRequest)
        return
    }

    // Verificar se o hábito pertence ao usuário
    var count int
    err = db.QueryRow("SELECT COUNT(*) FROM habits WHERE id = ? AND user_id = ?", habitID, userID).Scan(&count)
    if err != nil || count == 0 {
        http.Error(w, "Habit not found", http.StatusNotFound)
        return
    }

    // Verificar se a entrada pertence ao hábito
    err = db.QueryRow("SELECT COUNT(*) FROM habit_entries WHERE id = ? AND habit_id = ?", entryID, habitID).Scan(&count)
    if err != nil || count == 0 {
        http.Error(w, "Entry not found", http.StatusNotFound)
        return
    }

    // Deletar a entrada
    query := "DELETE FROM habit_entries WHERE id = ? AND habit_id = ?"
    result, err := db.Exec(query, entryID, habitID)
    if err != nil {
        http.Error(w, "Error deleting entry", http.StatusInternalServerError)
        return
    }

    rowsAffected, _ := result.RowsAffected()
    if rowsAffected == 0 {
        http.Error(w, "Entry not found", http.StatusNotFound)
        return
    }

    w.WriteHeader(http.StatusNoContent)
}
