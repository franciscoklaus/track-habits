package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
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
	Visibility  string    `json:"visibility"` // "public", "private", "friends"
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

type GoalCompletion struct {
	ID          int       `json:"id"`
	HabitID     int       `json:"habit_id"`
	GoalType    string    `json:"goal_type"`
	GoalValue   int       `json:"goal_value"`
	CompletedAt time.Time `json:"completed_at"`
	PeriodStart time.Time `json:"period_start"`
	PeriodEnd   time.Time `json:"period_end"`
	ActualCount int       `json:"actual_count"`
	Notes       string    `json:"notes,omitempty"`
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

// Estruturas para sistema de amigos e feed
type FriendRequest struct {
	Email string `json:"email"`
}

type Friendship struct {
	ID        int       `json:"id"`
	UserID    int       `json:"user_id"`
	FriendID  int       `json:"friend_id"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	// Dados do amigo
	Friend *User `json:"friend,omitempty"`
}

type ActivityFeed struct {
	ID               int                    `json:"id"`
	UserID           int                    `json:"user_id"`
	ActivityType     string                 `json:"activity_type"`
	HabitID          *int                   `json:"habit_id"`
	GoalCompletionID *int                   `json:"goal_completion_id"`
	ChallengeID      *int                   `json:"challenge_id"`
	Metadata         map[string]interface{} `json:"metadata"`
	Visibility       string                 `json:"visibility"`
	CreatedAt        time.Time              `json:"created_at"`
	// Dados relacionados
	User         *User         `json:"user,omitempty"`
	Habit        *Habit        `json:"habit,omitempty"`
	Challenge    *Challenge    `json:"challenge,omitempty"`
	ReactionCount map[string]int `json:"reaction_count,omitempty"`
	UserReaction *string        `json:"user_reaction,omitempty"`
	CommentCount int            `json:"comment_count,omitempty"`
}

type ActivityReaction struct {
	ID           int       `json:"id"`
	ActivityID   int       `json:"activity_id"`
	UserID       int       `json:"user_id"`
	ReactionType string    `json:"reaction_type"`
	CreatedAt    time.Time `json:"created_at"`
	User         *User     `json:"user,omitempty"`
}

type ActivityComment struct {
	ID         int       `json:"id"`
	ActivityID int       `json:"activity_id"`
	UserID     int       `json:"user_id"`
	Comment    string    `json:"comment"`
	CreatedAt  time.Time `json:"created_at"`
	User       *User     `json:"user,omitempty"`
}

type ReactionRequest struct {
	ReactionType string `json:"reaction_type"`
}

type CommentRequest struct {
	Comment string `json:"comment"`
}

// Estruturas para sistema de grupos e desafios
type Group struct {
	ID          int       `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Privacy     string    `json:"privacy"` // "public", "private", "invite_only"
	CreatorID   int       `json:"creator_id"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	// Dados relacionados
	Creator     *User `json:"creator,omitempty"`
	MemberCount int   `json:"member_count,omitempty"`
	IsJoined    bool  `json:"is_joined,omitempty"`
}

type GroupMember struct {
	ID       int       `json:"id"`
	GroupID  int       `json:"group_id"`
	UserID   int       `json:"user_id"`
	Role     string    `json:"role"` // "admin", "moderator", "member"
	JoinedAt time.Time `json:"joined_at"`
	// Dados relacionados
	User  *User  `json:"user,omitempty"`
	Group *Group `json:"group,omitempty"`
}

type Challenge struct {
	ID          int       `json:"id"`
	GroupID     int       `json:"group_id"`
	CreatorID   int       `json:"creator_id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	HabitName   string    `json:"habit_name"`
	GoalValue   int       `json:"goal_value"`
	GoalType    string    `json:"goal_type"` // "count", "streak", "weekly", "monthly"
	StartDate   time.Time `json:"start_date"`
	EndDate     time.Time `json:"end_date"`
	Status      string    `json:"status"` // "upcoming", "active", "completed", "cancelled"
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	// Dados relacionados
	Creator               *User `json:"creator,omitempty"`
	Group                 *Group `json:"group,omitempty"`
	ParticipantCount      int   `json:"participant_count,omitempty"`
	IsParticipating       bool  `json:"is_participating,omitempty"`
	UserProgress          int   `json:"user_progress,omitempty"`
	HasCompletedParticipant bool `json:"has_completed_participant,omitempty"`
}

type ChallengeParticipant struct {
	ID          int       `json:"id"`
	ChallengeID int       `json:"challenge_id"`
	UserID      int       `json:"user_id"`
	Progress    int       `json:"progress"`
	Notes       *string   `json:"notes,omitempty"`
	JoinedAt    time.Time `json:"joined_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	// Dados relacionados
	User      *User      `json:"user,omitempty"`
	Challenge *Challenge `json:"challenge,omitempty"`
}

type GroupJoinRequest struct {
	Name string `json:"name"`
}

type CreateGroupRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Privacy     string `json:"privacy"`
}

type CreateChallengeRequest struct {
	Name        string    `json:"name"`
	Description string    `json:"description"`
	HabitName   string    `json:"habit_name"`
	GoalValue   int       `json:"goal_value"`
	GoalType    string    `json:"goal_type"`
	StartDate   time.Time `json:"start_date"`
	EndDate     time.Time `json:"end_date"`
}

type UpdateProgressRequest struct {
	Progress int    `json:"progress"`
	Notes    string `json:"notes"`
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
	
	// Goal completion routes
	protected.HandleFunc("/habits/{id}/goal-completions", getGoalCompletions).Methods("GET")
	protected.HandleFunc("/habits/{id}/goal-completions", createGoalCompletion).Methods("POST")
	protected.HandleFunc("/habits/{id}/check-goal", checkGoalCompletion).Methods("GET")
	protected.HandleFunc("/habits/{id}/reset-goal", resetGoal).Methods("POST")
	
	// Friend system routes
	protected.HandleFunc("/friends/request", sendFriendRequest).Methods("POST")
	protected.HandleFunc("/friends", getFriends).Methods("GET")
	protected.HandleFunc("/friends/requests", getFriendRequests).Methods("GET")
	protected.HandleFunc("/friends/{id}/accept", acceptFriendRequest).Methods("PUT")
	protected.HandleFunc("/friends/{id}/cancel", cancelFriendRequest).Methods("DELETE")
	protected.HandleFunc("/friends/{id}", removeFriend).Methods("DELETE")
	
	// Activity feed routes
	protected.HandleFunc("/feed", getFeed).Methods("GET")
	protected.HandleFunc("/activities/{id}/react", reactToActivity).Methods("POST")
	protected.HandleFunc("/activities/{id}/react", removeReaction).Methods("DELETE")
	protected.HandleFunc("/activities/{id}/comment", commentOnActivity).Methods("POST")
	protected.HandleFunc("/activities/{id}/comments", getActivityComments).Methods("GET")

	// Group routes
	protected.HandleFunc("/groups", getGroups).Methods("GET")
	protected.HandleFunc("/groups", createGroup).Methods("POST")
	protected.HandleFunc("/groups/{id}", getGroup).Methods("GET")
	protected.HandleFunc("/groups/{id}", updateGroup).Methods("PUT")
	protected.HandleFunc("/groups/{id}", deleteGroup).Methods("DELETE")
	protected.HandleFunc("/groups/{id}/join", joinGroup).Methods("POST")
	protected.HandleFunc("/groups/{id}/leave", leaveGroup).Methods("DELETE")
	protected.HandleFunc("/groups/{id}/members", getGroupMembers).Methods("GET")
	
	// Challenge routes
	protected.HandleFunc("/challenges", getChallenges).Methods("GET")
	protected.HandleFunc("/groups/{groupId}/challenges", getGroupChallenges).Methods("GET")
	protected.HandleFunc("/groups/{groupId}/challenges", createChallenge).Methods("POST")
	protected.HandleFunc("/challenges/{id}", getChallenge).Methods("GET")
	protected.HandleFunc("/challenges/{id}", updateChallenge).Methods("PUT")
	protected.HandleFunc("/challenges/{id}", deleteChallenge).Methods("DELETE")
	protected.HandleFunc("/challenges/{id}/join", joinChallenge).Methods("POST")
	protected.HandleFunc("/challenges/{id}/leave", leaveChallenge).Methods("DELETE")
	protected.HandleFunc("/challenges/{id}/progress", updateChallengeProgress).Methods("PUT")
	protected.HandleFunc("/challenges/{id}/participants", getChallengeParticipants).Methods("GET")

	// Analytics routes
	protected.HandleFunc("/analytics", getAnalytics).Methods("GET")

	// Configure CORS
	c := cors.New(cors.Options{
	AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
	AllowedHeaders:   []string{"*"},
	AllowCredentials: true,
	AllowOriginFunc: func(origin string) bool {
		   return strings.HasPrefix(origin, "http://192.168.0.") || origin == "http://localhost:3000"
	},
})

	handler := c.Handler(r)

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	
	fmt.Printf("Server starting on :%s\n", port)
	log.Fatal(http.ListenAndServe(":"+port, handler))
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
		last_goal_reset TIMESTAMP NULL,
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

	// Create goal_completions table
	createGoalCompletionsTable := `
	CREATE TABLE IF NOT EXISTS goal_completions (
		id INT AUTO_INCREMENT PRIMARY KEY,
		habit_id INT NOT NULL,
		goal_type VARCHAR(20) NOT NULL,
		goal_value INT NOT NULL,
		completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		period_start DATE NOT NULL,
		period_end DATE NOT NULL,
		actual_count INT NOT NULL,
		notes TEXT,
		FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE
	)`

	// Create friendships table
	createFriendshipsTable := `
	CREATE TABLE IF NOT EXISTS friendships (
		id INT AUTO_INCREMENT PRIMARY KEY,
		user_id INT NOT NULL,
		friend_id INT NOT NULL,
		status ENUM('pending', 'accepted', 'declined') DEFAULT 'pending',
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
		FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
		FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE
	)`

	// Create activity_feeds table
	createActivityFeedsTable := `
	CREATE TABLE IF NOT EXISTS activity_feeds (
		id INT AUTO_INCREMENT PRIMARY KEY,
		user_id INT NOT NULL,
		activity_type VARCHAR(50) NOT NULL,
		habit_id INT,
		goal_completion_id INT,
		challenge_id INT,
		metadata JSON,
		visibility ENUM('public', 'private', 'friends') DEFAULT 'public',
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
		FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE,
		FOREIGN KEY (goal_completion_id) REFERENCES goal_completions(id) ON DELETE CASCADE,
		FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE
	)`

	createActivityReactionsTable := `
		CREATE TABLE IF NOT EXISTS activity_reactions (
		id INT AUTO_INCREMENT PRIMARY KEY,
		activity_id INT NOT NULL,
		user_id INT NOT NULL,
		reaction_type ENUM('like', 'celebrate', 'support', 'wow') DEFAULT 'like',
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (activity_id) REFERENCES activity_feeds(id) ON DELETE CASCADE,
		FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
		UNIQUE KEY unique_reaction (activity_id, user_id)
	)`

	createActivityCommentsTable := `
		CREATE TABLE IF NOT EXISTS activity_comments (
		id INT AUTO_INCREMENT PRIMARY KEY,
		activity_id INT NOT NULL,
		user_id INT NOT NULL,
		comment TEXT NOT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (activity_id) REFERENCES activity_feeds(id) ON DELETE CASCADE,
		FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
		INDEX idx_activity_created (activity_id, created_at)
	);`

	// Create groups table
	createGroupsTable := `
	CREATE TABLE IF NOT EXISTS ` + "`groups`" + ` (
		id INT AUTO_INCREMENT PRIMARY KEY,
		name VARCHAR(100) NOT NULL,
		description TEXT,
		privacy ENUM('public', 'private', 'invite_only') DEFAULT 'public',
		creator_id INT NOT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
		FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE
	)`

	// Create group_members table
	createGroupMembersTable := `
	CREATE TABLE IF NOT EXISTS group_members (
		id INT AUTO_INCREMENT PRIMARY KEY,
		group_id INT NOT NULL,
		user_id INT NOT NULL,
		role ENUM('admin', 'moderator', 'member') DEFAULT 'member',
		joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (group_id) REFERENCES ` + "`groups`" + `(id) ON DELETE CASCADE,
		FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
		UNIQUE KEY unique_membership (group_id, user_id)
	)`

	// Create challenges table
	createChallengesTable := `
	CREATE TABLE IF NOT EXISTS challenges (
		id INT AUTO_INCREMENT PRIMARY KEY,
		group_id INT NOT NULL,
		creator_id INT NOT NULL,
		name VARCHAR(100) NOT NULL,
		description TEXT,
		habit_name VARCHAR(100) NOT NULL,
		goal_value INT NOT NULL,
		goal_type ENUM('count', 'streak', 'weekly', 'monthly') DEFAULT 'count',
		start_date DATE NOT NULL,
		end_date DATE NOT NULL,
		status ENUM('upcoming', 'active', 'completed', 'cancelled') DEFAULT 'upcoming',
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
		FOREIGN KEY (group_id) REFERENCES ` + "`groups`" + `(id) ON DELETE CASCADE,
		FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE
	)`

	// Create challenge_participants table
	createChallengeParticipantsTable := `
	CREATE TABLE IF NOT EXISTS challenge_participants (
		id INT AUTO_INCREMENT PRIMARY KEY,
		challenge_id INT NOT NULL,
		user_id INT NOT NULL,
		progress INT DEFAULT 0,
		notes TEXT,
		joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
		FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE,
		FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
		UNIQUE KEY unique_participation (challenge_id, user_id)
	)`

	tables := []string{createUsersTable, createHabitsTable, createEntriesTable, createGoalCompletionsTable, createFriendshipsTable, createGroupsTable, createGroupMembersTable, createChallengesTable, createChallengeParticipantsTable, createActivityFeedsTable, createActivityReactionsTable, createActivityCommentsTable}
	
	for _, table := range tables {
		if _, err := db.Exec(table); err != nil {
			log.Fatal("Error creating table:", err)
		}
	}

	// Add last_goal_reset column if it doesn't exist (migration)
	_, err := db.Exec("ALTER TABLE habits ADD COLUMN last_goal_reset TIMESTAMP NULL")
	if err != nil && !strings.Contains(err.Error(), "Duplicate column name") {
		log.Printf("Warning: Could not add last_goal_reset column: %v", err)
	}

	// Add visibility column if it doesn't exist (migration)
	_, err = db.Exec("ALTER TABLE habits ADD COLUMN visibility ENUM('public', 'private', 'friends') DEFAULT 'public'")
	if err != nil && !strings.Contains(err.Error(), "Duplicate column name") {
		log.Printf("Warning: Could not add visibility column: %v", err)
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
	
	query := "SELECT id, user_id, name, description, is_active, multipleUpdate, category, icon, goal, goal_type, reminder_enabled, reminder_time, reminder_times, visibility, created_at FROM habits WHERE user_id = ? ORDER BY created_at DESC"
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
		var visibility sql.NullString
		err := rows.Scan(&habit.ID, &habit.UserID, &habit.Name, &habit.Description, &habit.IsActive, &habit.MultipleUpdate, &habit.Category, &habit.Icon, &habit.Goal, &habit.GoalType, &habit.ReminderEnabled, &habit.ReminderTime, &reminderTimesStr, &visibility, &habit.CreatedAt)
		if err != nil {
			http.Error(w, "Error scanning habits", http.StatusInternalServerError)
			return
		}
		
		// Definir visibilidade padrão se estiver vazio
		if visibility.Valid {
			habit.Visibility = visibility.String
		} else {
			habit.Visibility = "public"
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
    
    // Calcular longest streak - implementação simples local
    maxStreak := 1
    currentStreakLocal := 1
    
    for i := 1; i < len(dates); i++ {
        // Verificar se a data atual é consecutiva à anterior
        expectedDate := dates[i-1].AddDate(0, 0, -1)
        
        if dates[i].Equal(expectedDate) {
            currentStreakLocal++
            if currentStreakLocal > maxStreak {
                maxStreak = currentStreakLocal
            }
        } else {
            currentStreakLocal = 1
        }
    }
    
    longestStreak := maxStreak
    
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
	if habit.Visibility == "" {
		habit.Visibility = "public"
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

	query := "INSERT INTO habits (user_id, name, description, is_active, multipleUpdate, category, icon, goal, goal_type, reminder_enabled, reminder_time, reminder_times, visibility) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
	result, err := db.Exec(query, userID, habit.Name, habit.Description, true, habit.MultipleUpdate, habit.Category, habit.Icon, habit.Goal, habit.GoalType, habit.ReminderEnabled, habit.ReminderTime, reminderTimesStr, habit.Visibility)
	if err != nil {
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
	query := "SELECT id, user_id, name, description, is_active, multipleUpdate, category, icon, goal, goal_type, reminder_enabled, reminder_time, reminder_times, visibility, created_at FROM habits WHERE id = ? AND user_id = ?"
	var reminderTimesStr sql.NullString
	var visibility sql.NullString
	err = db.QueryRow(query, habitID, userID).Scan(&habit.ID, &habit.UserID, &habit.Name, &habit.Description, &habit.IsActive, &habit.MultipleUpdate, &habit.Category, &habit.Icon, &habit.Goal, &habit.GoalType, &habit.ReminderEnabled, &habit.ReminderTime, &reminderTimesStr, &visibility, &habit.CreatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "Habit not found", http.StatusNotFound)
			return
		}
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	
	// Definir visibilidade padrão se estiver vazio
	if visibility.Valid {
		habit.Visibility = visibility.String
	} else {
		habit.Visibility = "public"
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

	query := "UPDATE habits SET name = ?, description = ?, is_active = ?, multipleUpdate = ?, category = ?, icon = ?, goal = ?, goal_type = ?, reminder_enabled = ?, reminder_time = ?, reminder_times = ?, visibility = ? WHERE id = ? AND user_id = ?"
	result, err := db.Exec(query, habit.Name, habit.Description, habit.IsActive, habit.MultipleUpdate, habit.Category, habit.Icon, habit.Goal, habit.GoalType, habit.ReminderEnabled, habit.ReminderTime, reminderTimesStr, habit.Visibility, habitID, userID)
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

	// Criar atividade no feed quando hábito for completado
	metadata := map[string]interface{}{
		"habit_name": habit.Name,
		"notes": entry.Notes,
	}
	
	// Adicionar informação sobre sequência se necessário
	if habit.GoalType == "streak" {
		// Calcular sequência atual
		streakQuery := `
			SELECT COUNT(*) as streak FROM (
				SELECT DATE(completed_at) as date 
				FROM habit_entries 
				WHERE habit_id = ? 
				ORDER BY completed_at DESC
			) AS dates 
			WHERE date >= CURDATE() - INTERVAL (
				SELECT COUNT(DISTINCT DATE(completed_at)) - 1 
				FROM habit_entries 
				WHERE habit_id = ? 
				AND completed_at >= (
					SELECT MAX(completed_at) - INTERVAL 30 DAY 
					FROM habit_entries 
					WHERE habit_id = ?
				)
			) DAY
		`
		var streak int
		db.QueryRow(streakQuery, habitID, habitID, habitID).Scan(&streak)
		metadata["streak_count"] = streak
	}
	
	// Commented out feed activity creation - not implemented yet
	// err = createFeedActivity(userID, "habit_completed", &habitID, nil, nil, metadata)
	// if err != nil {
	//	log.Printf("Erro ao criar atividade no feed: %v", err)
	// 	// Não interromper o fluxo por erro no feed
	// }

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

// Funções para gerenciamento de histórico de metas

func getGoalCompletions(w http.ResponseWriter, r *http.Request) {
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

	query := `SELECT id, habit_id, goal_type, goal_value, completed_at, period_start, period_end, actual_count, notes 
			 FROM goal_completions WHERE habit_id = ? ORDER BY completed_at DESC`
	rows, err := db.Query(query, habitID)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var completions []GoalCompletion
	for rows.Next() {
		var completion GoalCompletion
		err := rows.Scan(&completion.ID, &completion.HabitID, &completion.GoalType, &completion.GoalValue, 
			&completion.CompletedAt, &completion.PeriodStart, &completion.PeriodEnd, &completion.ActualCount, &completion.Notes)
		if err != nil {
			http.Error(w, "Error scanning completions", http.StatusInternalServerError)
			return
		}
		completions = append(completions, completion)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(completions)
}

func createGoalCompletion(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	vars := mux.Vars(r)
	habitID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid habit ID", http.StatusBadRequest)
		return
	}

	var completion GoalCompletion
	if err := json.NewDecoder(r.Body).Decode(&completion); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	// Verificar se o hábito pertence ao usuário
	var count int
	err = db.QueryRow("SELECT COUNT(*) FROM habits WHERE id = ? AND user_id = ?", habitID, userID).Scan(&count)
	if err != nil || count == 0 {
		http.Error(w, "Habit not found", http.StatusNotFound)
		return
	}

	completion.HabitID = habitID
	
	query := `INSERT INTO goal_completions (habit_id, goal_type, goal_value, period_start, period_end, actual_count, notes) 
			 VALUES (?, ?, ?, ?, ?, ?, ?)`
	result, err := db.Exec(query, completion.HabitID, completion.GoalType, completion.GoalValue, 
		completion.PeriodStart, completion.PeriodEnd, completion.ActualCount, completion.Notes)
	if err != nil {
		http.Error(w, "Error creating goal completion", http.StatusInternalServerError)
		return
	}

	completionID, _ := result.LastInsertId()
	completion.ID = int(completionID)
	completion.CompletedAt = time.Now()

	// Buscar nome do hábito para o feed
	var habitName string
	db.QueryRow("SELECT name FROM habits WHERE id = ?", habitID).Scan(&habitName)

	// Criar atividade no feed quando meta for completada (commented out - not implemented yet)
	/*
	metadata := map[string]interface{}{
		"habit_name": habitName,
		"goal_type": completion.GoalType,
		"goal_value": completion.GoalValue,
		"actual_count": completion.ActualCount,
		"notes": completion.Notes,
	}
	
	err = createFeedActivity(userID, "goal_achieved", &habitID, &completion.ID, nil, metadata)
	if err != nil {
		log.Printf("Erro ao criar atividade no feed para meta completada: %v", err)
		// Não interromper o fluxo por erro no feed
	}
	*/

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(completion)
}

func checkGoalCompletion(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	vars := mux.Vars(r)
	habitID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid habit ID", http.StatusBadRequest)
		return
	}

	fmt.Printf("=== CHECK GOAL COMPLETION ===\n")
	fmt.Printf("User ID: %d, Habit ID: %d\n", userID, habitID)

	// Buscar informações do hábito
	var habit Habit
	var lastResetTime sql.NullTime
	query := "SELECT id, goal, goal_type, last_goal_reset FROM habits WHERE id = ? AND user_id = ?"
	err = db.QueryRow(query, habitID, userID).Scan(&habit.ID, &habit.Goal, &habit.GoalType, &lastResetTime)
	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "Habit not found", http.StatusNotFound)
			return
		}
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	fmt.Printf("Habit: Goal=%d, GoalType=%s, LastReset=%v\n", habit.Goal, habit.GoalType, lastResetTime)

	if habit.Goal == 0 {
		// Sem meta definida
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"has_goal": false,
			"goal_completed": false,
		})
		return
	}

	// Calcular período atual baseado no tipo de meta
	now := time.Now()
	var periodStart, periodEnd time.Time
	var actualCount int

	switch habit.GoalType {
	case "count":
		// Meta diária
		periodStart = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
		periodEnd = periodStart.Add(24 * time.Hour).Add(-time.Second)
	case "weekly":
		// Meta semanal (domingo a sábado)
		weekday := int(now.Weekday())
		periodStart = now.AddDate(0, 0, -weekday)
		periodStart = time.Date(periodStart.Year(), periodStart.Month(), periodStart.Day(), 0, 0, 0, 0, now.Location())
		periodEnd = periodStart.AddDate(0, 0, 7).Add(-time.Second)
	case "monthly":
		// Meta mensal
		periodStart = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		periodEnd = periodStart.AddDate(0, 1, 0).Add(-time.Second)
	default:
		// Meta de sequência não precisa de renovação
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"has_goal": true,
			"goal_completed": false,
			"needs_renewal": false,
		})
		return
	}

	fmt.Printf("Period: %s to %s\n", periodStart.Format("2006-01-02 15:04:05"), periodEnd.Format("2006-01-02 15:04:05"))

	// Contar entradas do período atual, mas apenas após o último reset (se houver)
	var countQuery string
	var queryArgs []interface{}
	
	if lastResetTime.Valid {
		// Se houve reset, contar apenas entradas após o reset
		countQuery = `SELECT COUNT(*) FROM habit_entries 
					 WHERE habit_id = ? AND completed_at >= ? AND completed_at <= ? AND completed_at > ?`
		queryArgs = []interface{}{habitID, periodStart, periodEnd, lastResetTime.Time}
		fmt.Printf("Counting entries after reset time: %s\n", lastResetTime.Time.Format("2006-01-02 15:04:05"))
	} else {
		// Se nunca houve reset, contar todas as entradas do período
		countQuery = `SELECT COUNT(*) FROM habit_entries 
					 WHERE habit_id = ? AND completed_at >= ? AND completed_at <= ?`
		queryArgs = []interface{}{habitID, periodStart, periodEnd}
		fmt.Printf("Counting all entries in period (no reset)\n")
	}
	
	err = db.QueryRow(countQuery, queryArgs...).Scan(&actualCount)
	if err != nil {
		fmt.Printf("ERROR: Error counting entries: %v\n", err)
		http.Error(w, "Error counting entries", http.StatusInternalServerError)
		return
	}

	fmt.Printf("Actual count in period: %d (target: %d)\n", actualCount, habit.Goal)

	// Verificar se já existe uma completion para este período
	var existingCount int
	existingQuery := `SELECT COUNT(*) FROM goal_completions 
					 WHERE habit_id = ? AND period_start = ? AND period_end = ?`
	err = db.QueryRow(existingQuery, habitID, periodStart, periodEnd).Scan(&existingCount)
	if err != nil {
		fmt.Printf("ERROR: Error checking existing completions: %v", err)
		http.Error(w, "Error checking existing completions", http.StatusInternalServerError)
		return
	}

	goalCompleted := actualCount >= habit.Goal
	alreadyRecorded := existingCount > 0

	fmt.Printf("Goal completed: %t, Already recorded: %t, Needs renewal: %t\n", goalCompleted, alreadyRecorded, goalCompleted && !alreadyRecorded)

	response := map[string]interface{}{
		"has_goal":        true,
		"goal_completed":  goalCompleted,
		"needs_renewal":   goalCompleted && !alreadyRecorded,
		"actual_count":    actualCount,
		"target_count":    habit.Goal,
		"goal_type":       habit.GoalType,
		"period_start":    periodStart,
		"period_end":      periodEnd,
		"already_recorded": alreadyRecorded,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func resetGoal(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	vars := mux.Vars(r)
	habitID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid habit ID", http.StatusBadRequest)
		return
	}

	fmt.Printf("=== RESET GOAL REQUEST ===\n")
	fmt.Printf("User ID: %d, Habit ID: %d\n", userID, habitID)

	// Buscar informações do hábito
	var habit Habit
	query := "SELECT id, goal, goal_type FROM habits WHERE id = ? AND user_id = ?"
	err = db.QueryRow(query, habitID, userID).Scan(&habit.ID, &habit.Goal, &habit.GoalType)
	if err != nil {
		if err == sql.ErrNoRows {
			fmt.Printf("ERROR: Habit not found for ID %d and user %d\n", habitID, userID)
			http.Error(w, "Habit not found", http.StatusNotFound)
			return
		}
		fmt.Printf("ERROR: Database error: %v\n", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	fmt.Printf("Habit found: ID=%d, Goal=%d, GoalType=%s\n", habit.ID, habit.Goal, habit.GoalType)

	if habit.Goal == 0 {
		fmt.Printf("ERROR: Habit has no goal set\n")
		http.Error(w, "Habit has no goal set", http.StatusBadRequest)
		return
	}

	// Calcular período atual baseado no tipo de meta
	now := time.Now()
	var periodStart, periodEnd time.Time

	switch habit.GoalType {
	case "count":
		// Meta diária
		periodStart = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
		periodEnd = periodStart.Add(24 * time.Hour).Add(-time.Second)
	case "weekly":
		// Meta semanal (domingo a sábado)
		weekday := int(now.Weekday())
		periodStart = now.AddDate(0, 0, -weekday)
		periodStart = time.Date(periodStart.Year(), periodStart.Month(), periodStart.Day(), 0, 0, 0, 0, now.Location())
		periodEnd = periodStart.AddDate(0, 0, 7).Add(-time.Second)
	case "monthly":
		// Meta mensal
		periodStart = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		periodEnd = periodStart.AddDate(0, 1, 0).Add(-time.Second)
	default:
		fmt.Printf("ERROR: Goal type '%s' does not support reset\n", habit.GoalType)
		http.Error(w, "Goal type does not support reset", http.StatusBadRequest)
		return
	}

	fmt.Printf("Period calculated: %s to %s\n", periodStart.Format("2006-01-02 15:04:05"), periodEnd.Format("2006-01-02 15:04:05"))

	// Verificar se existem completions para deletar
	var existingCount int
	countQuery := "SELECT COUNT(*) FROM goal_completions WHERE habit_id = ? AND period_start = ? AND period_end = ?"
	err = db.QueryRow(countQuery, habitID, periodStart, periodEnd).Scan(&existingCount)
	if err != nil {
		fmt.Printf("ERROR: Error counting existing completions: %v\n", err)
		http.Error(w, "Error checking existing completions", http.StatusInternalServerError)
		return
	}

	fmt.Printf("Found %d existing completions for this period\n", existingCount)

	// Deletar completions existentes para o período atual
	deleteQuery := "DELETE FROM goal_completions WHERE habit_id = ? AND period_start = ? AND period_end = ?"
	result, err := db.Exec(deleteQuery, habitID, periodStart, periodEnd)
	if err != nil {
		fmt.Printf("ERROR: Error deleting completions: %v\n", err)
		http.Error(w, "Error resetting goal", http.StatusInternalServerError)
		return
	}

	deletedRows, _ := result.RowsAffected()
	fmt.Printf("Deleted %d completion records\n", deletedRows)

	// Atualizar timestamp de reset do hábito
	updateQuery := "UPDATE habits SET last_goal_reset = NOW() WHERE id = ?"
	_, err = db.Exec(updateQuery, habitID)
	if err != nil {
		fmt.Printf("ERROR: Error updating reset timestamp: %v\n", err)
		http.Error(w, "Error updating reset timestamp", http.StatusInternalServerError)
		return
	}

	fmt.Printf("Updated reset timestamp for habit %d\n", habitID)
	fmt.Printf("Goal reset successfully for habit %d, period %s to %s\n", habitID, periodStart.Format("2006-01-02"), periodEnd.Format("2006-01-02"))

	response := map[string]interface{}{
		"message": "Goal reset successfully",
		"period_start": periodStart,
		"period_end": periodEnd,
		"deleted_records": deletedRows,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}
