package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/gorilla/mux"
)

// Funções para sistema de amigos e feed de atividades

// Enviar solicitação de amizade
func sendFriendRequest(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	if userID == 0 {
		http.Error(w, `{"error": "Invalid user ID"}`, http.StatusUnauthorized)
		return
	}
	
	var req FriendRequest
	
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error": "Dados inválidos"}`, http.StatusBadRequest)
		return
	}
	
	// Buscar o usuário pelo email
	var friendID int
	var err error
	err = db.QueryRow("SELECT id FROM users WHERE email = ?", req.Email).Scan(&friendID)
	if err != nil {
		http.Error(w, `{"error": "Usuário não encontrado"}`, http.StatusNotFound)
		return
	}
	
	if friendID == userID {
		http.Error(w, `{"error": "Não é possível adicionar a si mesmo como amigo"}`, http.StatusBadRequest)
		return
	}
	
	// Verificar se já existe uma amizade
	var existingID int
	err = db.QueryRow("SELECT id FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)", 
		userID, friendID, friendID, userID).Scan(&existingID)
	if err == nil {
		http.Error(w, `{"error": "Solicitação de amizade já existe"}`, http.StatusBadRequest)
		return
	}
	
	// Criar nova solicitação de amizade
	_, err = db.Exec("INSERT INTO friendships (user_id, friend_id, status) VALUES (?, ?, 'pending')", 
		userID, friendID)
	if err != nil {
		log.Printf("Erro ao criar solicitação de amizade: %v", err)
		http.Error(w, `{"error": "Erro interno do servidor"}`, http.StatusInternalServerError)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Solicitação de amizade enviada"})
}

// Buscar amigos
func getFriends(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	
	query := `
		SELECT f.id, f.user_id, f.friend_id, f.status, f.created_at, f.updated_at,
			   u.id, u.username, u.email
		FROM friendships f
		JOIN users u ON (CASE WHEN f.user_id = ? THEN u.id = f.friend_id ELSE u.id = f.user_id END)
		WHERE (f.user_id = ? OR f.friend_id = ?) AND f.status = 'accepted'
		ORDER BY u.username
	`
	
	rows, err := db.Query(query, userID, userID, userID)
	if err != nil {
		log.Printf("Erro ao buscar amigos: %v", err)
		http.Error(w, `{"error": "Erro interno do servidor"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	
	var friends []Friendship
	for rows.Next() {
		var f Friendship
		var u User
		err := rows.Scan(&f.ID, &f.UserID, &f.FriendID, &f.Status, &f.CreatedAt, &f.UpdatedAt,
						&u.ID, &u.Username, &u.Email)
		if err != nil {
			log.Printf("Erro ao escanear amigo: %v", err)
			continue
		}
		f.Friend = &u
		friends = append(friends, f)
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(friends)
}

// Buscar solicitações de amizade pendentes (recebidas e enviadas)
func getFriendRequests(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	
	// Buscar solicitações recebidas (que você pode aceitar)
	receivedQuery := `
		SELECT f.id, f.user_id, f.friend_id, f.status, f.created_at, f.updated_at,
			   u.id, u.username, u.email, 'received' as request_type
		FROM friendships f
		JOIN users u ON u.id = f.user_id
		WHERE f.friend_id = ? AND f.status = 'pending'
	`
	
	// Buscar solicitações enviadas (que estão aguardando aprovação)
	sentQuery := `
		SELECT f.id, f.user_id, f.friend_id, f.status, f.created_at, f.updated_at,
			   u.id, u.username, u.email, 'sent' as request_type
		FROM friendships f
		JOIN users u ON u.id = f.friend_id
		WHERE f.user_id = ? AND f.status = 'pending'
	`
	
	// Unir ambas as queries
	fullQuery := fmt.Sprintf("(%s) UNION (%s) ORDER BY created_at DESC", receivedQuery, sentQuery)
	
	rows, err := db.Query(fullQuery, userID, userID)
	if err != nil {
		log.Printf("Erro ao buscar solicitações: %v", err)
		http.Error(w, `{"error": "Erro interno do servidor"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	
	var requests []map[string]interface{}
	for rows.Next() {
		var f Friendship
		var u User
		var requestType string
		err := rows.Scan(&f.ID, &f.UserID, &f.FriendID, &f.Status, &f.CreatedAt, &f.UpdatedAt,
						&u.ID, &u.Username, &u.Email, &requestType)
		if err != nil {
			log.Printf("Erro ao escanear solicitação: %v", err)
			continue
		}
		
		request := map[string]interface{}{
			"id":          f.ID,
			"user_id":     f.UserID,
			"friend_id":   f.FriendID,
			"status":      f.Status,
			"created_at":  f.CreatedAt,
			"updated_at":  f.UpdatedAt,
			"type":        requestType,
			"friend": map[string]interface{}{
				"id":       u.ID,
				"username": u.Username,
				"email":    u.Email,
			},
		}
		
		requests = append(requests, request)
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(requests)
}

// Aceitar solicitação de amizade
func acceptFriendRequest(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	vars := mux.Vars(r)
	friendshipID := vars["id"]
	
	// Verificar se a solicitação existe e é para este usuário
	var existingUserID, existingFriendID int
	err := db.QueryRow("SELECT user_id, friend_id FROM friendships WHERE id = ? AND friend_id = ? AND status = 'pending'", 
		friendshipID, userID).Scan(&existingUserID, &existingFriendID)
	if err != nil {
		http.Error(w, `{"error": "Solicitação de amizade não encontrada"}`, http.StatusNotFound)
		return
	}
	
	// Atualizar status para aceito
	_, err = db.Exec("UPDATE friendships SET status = 'accepted', updated_at = CURRENT_TIMESTAMP WHERE id = ?", 
		friendshipID)
	if err != nil {
		log.Printf("Erro ao aceitar solicitação: %v", err)
		http.Error(w, `{"error": "Erro interno do servidor"}`, http.StatusInternalServerError)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Amizade aceita"})
}

// Remover amigo
func removeFriend(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	vars := mux.Vars(r)
	friendshipID := vars["id"]
	
	// Verificar se a amizade existe
	var existingUserID, existingFriendID int
	err := db.QueryRow("SELECT user_id, friend_id FROM friendships WHERE id = ? AND (user_id = ? OR friend_id = ?)", 
		friendshipID, userID, userID).Scan(&existingUserID, &existingFriendID)
	if err != nil {
		http.Error(w, `{"error": "Amizade não encontrada"}`, http.StatusNotFound)
		return
	}
	
	// Remover amizade
	_, err = db.Exec("DELETE FROM friendships WHERE id = ?", friendshipID)
	if err != nil {
		log.Printf("Erro ao remover amizade: %v", err)
		http.Error(w, `{"error": "Erro interno do servidor"}`, http.StatusInternalServerError)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Amizade removida"})
}

// Cancelar solicitação de amizade enviada
func cancelFriendRequest(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	vars := mux.Vars(r)
	friendshipID := vars["id"]
	
	// Verificar se a solicitação existe e foi enviada por este usuário
	var existingUserID, existingFriendID int
	err := db.QueryRow("SELECT user_id, friend_id FROM friendships WHERE id = ? AND user_id = ? AND status = 'pending'", 
		friendshipID, userID).Scan(&existingUserID, &existingFriendID)
	if err != nil {
		http.Error(w, `{"error": "Solicitação de amizade não encontrada"}`, http.StatusNotFound)
		return
	}
	
	// Deletar a solicitação
	_, err = db.Exec("DELETE FROM friendships WHERE id = ?", friendshipID)
	if err != nil {
		log.Printf("Erro ao cancelar solicitação: %v", err)
		http.Error(w, `{"error": "Erro interno do servidor"}`, http.StatusInternalServerError)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Solicitação cancelada"})
}

// Criar atividade no feed
func createFeedActivity(userID int, activityType string, habitID *int, goalCompletionID *int, metadata map[string]interface{}) error {
	metadataJSON, _ := json.Marshal(metadata)
	
	// Determinar visibilidade baseada no hábito (se fornecido)
	visibility := "friends" // padrão
	if habitID != nil {
		var habitVisibility sql.NullString
		err := db.QueryRow("SELECT visibility FROM habits WHERE id = ?", *habitID).Scan(&habitVisibility)
		if err == nil && habitVisibility.Valid {
			visibility = habitVisibility.String
		}
	}
	
	// Se o hábito for privado, não criar atividade no feed
	if visibility == "private" {
		return nil
	}
	
	_, err := db.Exec(`
		INSERT INTO activity_feeds (user_id, activity_type, habit_id, goal_completion_id, metadata, visibility) 
		VALUES (?, ?, ?, ?, ?, ?)
	`, userID, activityType, habitID, goalCompletionID, metadataJSON, visibility)
	
	return err
}

// Buscar feed de atividades
func getFeed(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	limit := 20
	offset := 0
	
	if l := r.URL.Query().Get("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 50 {
			limit = parsed
		}
	}
	
	if o := r.URL.Query().Get("offset"); o != "" {
		if parsed, err := strconv.Atoi(o); err == nil && parsed >= 0 {
			offset = parsed
		}
	}
	
	query := `
		SELECT DISTINCT af.id, af.user_id, af.activity_type, af.habit_id, af.goal_completion_id, 
			   af.metadata, af.visibility, af.created_at,
			   u.id, u.username, u.email,
			   h.id, h.name, h.icon
		FROM activity_feeds af
		JOIN users u ON u.id = af.user_id
		LEFT JOIN habits h ON h.id = af.habit_id
		WHERE af.user_id IN (
			SELECT CASE WHEN f.user_id = ? THEN f.friend_id ELSE f.user_id END
			FROM friendships f 
			WHERE (f.user_id = ? OR f.friend_id = ?) AND f.status = 'accepted'
		) AND af.visibility IN ('public', 'friends')
		AND (af.habit_id IS NULL OR h.visibility != 'private')
		ORDER BY af.created_at DESC
		LIMIT ? OFFSET ?
	`
	
	rows, err := db.Query(query, userID, userID, userID, limit, offset)
	if err != nil {
		log.Printf("Erro ao buscar feed: %v", err)
		http.Error(w, `{"error": "Erro interno do servidor"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	
	var activities []ActivityFeed
	for rows.Next() {
		var af ActivityFeed
		var u User
		var h Habit
		var metadataJSON []byte
		var habitID, habitName, habitIcon sql.NullString
		
		err := rows.Scan(&af.ID, &af.UserID, &af.ActivityType, &af.HabitID, &af.GoalCompletionID,
						&metadataJSON, &af.Visibility, &af.CreatedAt,
						&u.ID, &u.Username, &u.Email,
						&habitID, &habitName, &habitIcon)
		if err != nil {
			log.Printf("Erro ao escanear atividade: %v", err)
			continue
		}
		
		// Parse metadata
		if len(metadataJSON) > 0 {
			json.Unmarshal(metadataJSON, &af.Metadata)
		}
		
		af.User = &u
		
		// Adicionar hábito se existir
		if habitID.Valid {
			h.ID, _ = strconv.Atoi(habitID.String)
			h.Name = habitName.String
			h.Icon = habitIcon.String
			af.Habit = &h
		}
		
		// Buscar contagem de reações
		af.ReactionCount = make(map[string]int)
		reactionQuery := `
			SELECT reaction_type, COUNT(*) 
			FROM activity_reactions 
			WHERE activity_id = ? 
			GROUP BY reaction_type
		`
		reactionRows, err := db.Query(reactionQuery, af.ID)
		if err == nil {
			for reactionRows.Next() {
				var reactionType string
				var count int
				reactionRows.Scan(&reactionType, &count)
				af.ReactionCount[reactionType] = count
			}
			reactionRows.Close()
		}
		
		// Verificar reação do usuário atual
		var userReaction sql.NullString
		db.QueryRow("SELECT reaction_type FROM activity_reactions WHERE activity_id = ? AND user_id = ?", 
			af.ID, userID).Scan(&userReaction)
		if userReaction.Valid {
			af.UserReaction = &userReaction.String
		}
		
		// Contar comentários
		db.QueryRow("SELECT COUNT(*) FROM activity_comments WHERE activity_id = ?", af.ID).Scan(&af.CommentCount)
		
		activities = append(activities, af)
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(activities)
}

// Reagir a uma atividade
func reactToActivity(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	vars := mux.Vars(r)
	activityID := vars["id"]
	
	var req ReactionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error": "Dados inválidos"}`, http.StatusBadRequest)
		return
	}
	
	// Verificar se a atividade existe
	var existingID int
	err := db.QueryRow("SELECT id FROM activity_feeds WHERE id = ?", activityID).Scan(&existingID)
	if err != nil {
		http.Error(w, `{"error": "Atividade não encontrada"}`, http.StatusNotFound)
		return
	}
	
	// Inserir ou atualizar reação
	_, err = db.Exec(`
		INSERT INTO activity_reactions (activity_id, user_id, reaction_type) 
		VALUES (?, ?, ?) 
		ON DUPLICATE KEY UPDATE reaction_type = VALUES(reaction_type), created_at = CURRENT_TIMESTAMP
	`, activityID, userID, req.ReactionType)
	
	if err != nil {
		log.Printf("Erro ao reagir: %v", err)
		http.Error(w, `{"error": "Erro interno do servidor"}`, http.StatusInternalServerError)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Reação adicionada"})
}

// Remover reação
func removeReaction(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	vars := mux.Vars(r)
	activityID := vars["id"]
	
	_, err := db.Exec("DELETE FROM activity_reactions WHERE activity_id = ? AND user_id = ?", 
		activityID, userID)
	if err != nil {
		log.Printf("Erro ao remover reação: %v", err)
		http.Error(w, `{"error": "Erro interno do servidor"}`, http.StatusInternalServerError)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Reação removida"})
}

// Comentar em uma atividade
func commentOnActivity(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	vars := mux.Vars(r)
	activityID := vars["id"]
	
	var req CommentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error": "Dados inválidos"}`, http.StatusBadRequest)
		return
	}
	
	if len(strings.TrimSpace(req.Comment)) == 0 {
		http.Error(w, `{"error": "Comentário não pode estar vazio"}`, http.StatusBadRequest)
		return
	}
	
	// Verificar se a atividade existe
	var existingID int
	err := db.QueryRow("SELECT id FROM activity_feeds WHERE id = ?", activityID).Scan(&existingID)
	if err != nil {
		http.Error(w, `{"error": "Atividade não encontrada"}`, http.StatusNotFound)
		return
	}
	
	// Inserir comentário
	result, err := db.Exec("INSERT INTO activity_comments (activity_id, user_id, comment) VALUES (?, ?, ?)", 
		activityID, userID, req.Comment)
	if err != nil {
		log.Printf("Erro ao comentar: %v", err)
		http.Error(w, `{"error": "Erro interno do servidor"}`, http.StatusInternalServerError)
		return
	}
	
	commentID, _ := result.LastInsertId()
	
	// Buscar o comentário criado com dados do usuário
	var comment ActivityComment
	var user User
	err = db.QueryRow(`
		SELECT ac.id, ac.activity_id, ac.user_id, ac.comment, ac.created_at,
			   u.id, u.username, u.email
		FROM activity_comments ac
		JOIN users u ON u.id = ac.user_id
		WHERE ac.id = ?
	`, commentID).Scan(&comment.ID, &comment.ActivityID, &comment.UserID, &comment.Comment, &comment.CreatedAt,
		&user.ID, &user.Username, &user.Email)
	
	if err != nil {
		log.Printf("Erro ao buscar comentário criado: %v", err)
		http.Error(w, `{"error": "Erro interno do servidor"}`, http.StatusInternalServerError)
		return
	}
	
	comment.User = &user
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(comment)
}

// Buscar comentários de uma atividade
func getActivityComments(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	activityID := vars["id"]
	
	query := `
		SELECT ac.id, ac.activity_id, ac.user_id, ac.comment, ac.created_at,
			   u.id, u.username, u.email
		FROM activity_comments ac
		JOIN users u ON u.id = ac.user_id
		WHERE ac.activity_id = ?
		ORDER BY ac.created_at ASC
	`
	
	rows, err := db.Query(query, activityID)
	if err != nil {
		log.Printf("Erro ao buscar comentários: %v", err)
		http.Error(w, `{"error": "Erro interno do servidor"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	
	var comments []ActivityComment
	for rows.Next() {
		var comment ActivityComment
		var user User
		
		err := rows.Scan(&comment.ID, &comment.ActivityID, &comment.UserID, &comment.Comment, &comment.CreatedAt,
						&user.ID, &user.Username, &user.Email)
		if err != nil {
			log.Printf("Erro ao escanear comentário: %v", err)
			continue
		}
		
		comment.User = &user
		comments = append(comments, comment)
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(comments)
}

