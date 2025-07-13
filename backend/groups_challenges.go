package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/gorilla/mux"
)

// ============= GRUPOS =============

// Listar grupos (públicos e dos quais o usuário é membro)
func getGroups(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)

	query := `
		SELECT DISTINCT g.id, g.name, g.description, g.privacy, g.creator_id, g.created_at, g.updated_at,
			   u.id, u.username, u.email,
			   (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count,
			   (SELECT COUNT(*) FROM group_members WHERE group_id = g.id AND user_id = ?) as is_joined
		FROM ` + "`groups`" + ` g
		JOIN users u ON u.id = g.creator_id
		LEFT JOIN group_members gm ON gm.group_id = g.id
		WHERE g.privacy = 'public' OR gm.user_id = ?
		ORDER BY g.created_at DESC
	`

	rows, err := db.Query(query, userID, userID)
	if err != nil {
		log.Printf("Erro ao buscar grupos: %v", err)
		http.Error(w, "Erro interno do servidor", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var groups []Group
	for rows.Next() {
		var g Group
		var creator User
		var isJoinedInt int
		err := rows.Scan(&g.ID, &g.Name, &g.Description, &g.Privacy, &g.CreatorID, &g.CreatedAt, &g.UpdatedAt,
						&creator.ID, &creator.Username, &creator.Email, &g.MemberCount, &isJoinedInt)
		if err != nil {
			log.Printf("Erro ao escanear grupo: %v", err)
			continue
		}
		g.Creator = &creator
		g.IsJoined = isJoinedInt > 0
		groups = append(groups, g)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(groups)
}

// Criar novo grupo
func createGroup(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)

	var req CreateGroupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Dados inválidos", http.StatusBadRequest)
		return
	}

	// Validações
	if req.Name == "" {
		http.Error(w, "Nome do grupo é obrigatório", http.StatusBadRequest)
		return
	}

	if req.Privacy == "" {
		req.Privacy = "public"
	}

	// Criar o grupo
	query := "INSERT INTO `groups` (name, description, privacy, creator_id) VALUES (?, ?, ?, ?)"
	result, err := db.Exec(query, req.Name, req.Description, req.Privacy, userID)
	if err != nil {
		log.Printf("Erro ao criar grupo: %v", err)
		http.Error(w, "Erro interno do servidor", http.StatusInternalServerError)
		return
	}

	groupID, _ := result.LastInsertId()

	// Adicionar o criador como admin do grupo
	_, err = db.Exec("INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, 'admin')", groupID, userID)
	if err != nil {
		log.Printf("Erro ao adicionar criador ao grupo: %v", err)
		// Não falhar aqui, apenas logar
	}

	group := Group{
		ID:          int(groupID),
		Name:        req.Name,
		Description: req.Description,
		Privacy:     req.Privacy,
		CreatorID:   userID,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(group)
}

// Buscar grupo específico
func getGroup(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	vars := mux.Vars(r)
	groupID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "ID de grupo inválido", http.StatusBadRequest)
		return
	}

	query := "SELECT g.id, g.name, g.description, g.privacy, g.creator_id, g.created_at, g.updated_at, " +
			 "u.id, u.username, u.email, " +
			 "(SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count, " +
			 "(SELECT COUNT(*) FROM group_members WHERE group_id = g.id AND user_id = ?) as is_joined " +
			 "FROM " + "`groups`" + " g " +
			 "JOIN users u ON u.id = g.creator_id " +
			 "WHERE g.id = ?"

	var g Group
	var creator User
	var isJoinedInt int
	err = db.QueryRow(query, userID, groupID).Scan(&g.ID, &g.Name, &g.Description, &g.Privacy, &g.CreatorID, &g.CreatedAt, &g.UpdatedAt,
												  &creator.ID, &creator.Username, &creator.Email, &g.MemberCount, &isJoinedInt)
	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "Grupo não encontrado", http.StatusNotFound)
			return
		}
		log.Printf("Erro ao buscar grupo: %v", err)
		http.Error(w, "Erro interno do servidor", http.StatusInternalServerError)
		return
	}

	g.Creator = &creator
	g.IsJoined = isJoinedInt > 0

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(g)
}

// Atualizar grupo (apenas criador/admin)
func updateGroup(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	vars := mux.Vars(r)
	groupID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "ID de grupo inválido", http.StatusBadRequest)
		return
	}

	// Verificar se o usuário é o criador ou admin do grupo
	var role string
	err = db.QueryRow("SELECT role FROM group_members WHERE group_id = ? AND user_id = ?", groupID, userID).Scan(&role)
	if err != nil {
		http.Error(w, "Permissão negada", http.StatusForbidden)
		return
	}

	if role != "admin" {
		http.Error(w, "Apenas administradores podem atualizar o grupo", http.StatusForbidden)
		return
	}

	var req CreateGroupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Dados inválidos", http.StatusBadRequest)
		return
	}

	query := "UPDATE groups SET name = ?, description = ?, privacy = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
	result, err := db.Exec(query, req.Name, req.Description, req.Privacy, groupID)
	if err != nil {
		log.Printf("Erro ao atualizar grupo: %v", err)
		http.Error(w, "Erro interno do servidor", http.StatusInternalServerError)
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		http.Error(w, "Grupo não encontrado", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Grupo atualizado com sucesso"})
}

// Deletar grupo (apenas criador)
func deleteGroup(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	vars := mux.Vars(r)
	groupID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "ID de grupo inválido", http.StatusBadRequest)
		return
	}

	// Verificar se o usuário é o criador do grupo
	var creatorID int
	err = db.QueryRow("SELECT creator_id FROM `groups` WHERE id = ?", groupID).Scan(&creatorID)
	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "Grupo não encontrado", http.StatusNotFound)
			return
		}
		log.Printf("Erro ao verificar criador do grupo: %v", err)
		http.Error(w, "Erro interno do servidor", http.StatusInternalServerError)
		return
	}

	if creatorID != userID {
		http.Error(w, "Apenas o criador pode deletar o grupo", http.StatusForbidden)
		return
	}

	// Deletar grupo (cascade deletará membros e desafios)
	result, err := db.Exec("DELETE FROM `groups` WHERE id = ?", groupID)
	if err != nil {
		log.Printf("Erro ao deletar grupo: %v", err)
		http.Error(w, "Erro interno do servidor", http.StatusInternalServerError)
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		http.Error(w, "Grupo não encontrado", http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// Entrar no grupo
func joinGroup(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	vars := mux.Vars(r)
	groupID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "ID de grupo inválido", http.StatusBadRequest)
		return
	}

	// Verificar se o grupo existe e é público
	var privacy string
	err = db.QueryRow("SELECT privacy FROM `groups` WHERE id = ?", groupID).Scan(&privacy)
	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "Grupo não encontrado", http.StatusNotFound)
			return
		}
		log.Printf("Erro ao verificar grupo: %v", err)
		http.Error(w, "Erro interno do servidor", http.StatusInternalServerError)
		return
	}

	if privacy != "public" {
		http.Error(w, "Este grupo não permite entrada direta", http.StatusForbidden)
		return
	}

	// Verificar se já é membro
	var memberID int
	err = db.QueryRow("SELECT id FROM group_members WHERE group_id = ? AND user_id = ?", groupID, userID).Scan(&memberID)
	if err == nil {
		http.Error(w, "Você já é membro deste grupo", http.StatusConflict)
		return
	}

	// Adicionar como membro
	_, err = db.Exec("INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, 'member')", groupID, userID)
	if err != nil {
		log.Printf("Erro ao entrar no grupo: %v", err)
		http.Error(w, "Erro interno do servidor", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Entrada no grupo realizada com sucesso"})
}

// Sair do grupo
func leaveGroup(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	vars := mux.Vars(r)
	groupID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "ID de grupo inválido", http.StatusBadRequest)
		return
	}

	// Verificar se é o criador do grupo
	var creatorID int
	err = db.QueryRow("SELECT creator_id FROM `groups` WHERE id = ?", groupID).Scan(&creatorID)
	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "Grupo não encontrado", http.StatusNotFound)
			return
		}
		log.Printf("Erro ao verificar grupo: %v", err)
		http.Error(w, "Erro interno do servidor", http.StatusInternalServerError)
		return
	}

	if creatorID == userID {
		http.Error(w, "O criador do grupo não pode sair. Delete o grupo se necessário.", http.StatusForbidden)
		return
	}

	// Remover da lista de membros
	result, err := db.Exec("DELETE FROM group_members WHERE group_id = ? AND user_id = ?", groupID, userID)
	if err != nil {
		log.Printf("Erro ao sair do grupo: %v", err)
		http.Error(w, "Erro interno do servidor", http.StatusInternalServerError)
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		http.Error(w, "Você não é membro deste grupo", http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// Listar membros do grupo
func getGroupMembers(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	vars := mux.Vars(r)
	groupID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "ID de grupo inválido", http.StatusBadRequest)
		return
	}

	// Verificar se o usuário é membro do grupo ou se o grupo é público
	var privacy string
	var isMember int
	err = db.QueryRow("SELECT g.privacy, " +
		"(SELECT COUNT(*) FROM group_members WHERE group_id = g.id AND user_id = ?) as is_member " +
		"FROM " + "`groups`" + " g WHERE g.id = ?", userID, groupID).Scan(&privacy, &isMember)

	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "Grupo não encontrado", http.StatusNotFound)
			return
		}
		log.Printf("Erro ao verificar grupo: %v", err)
		http.Error(w, "Erro interno do servidor", http.StatusInternalServerError)
		return
	}

	if privacy != "public" && isMember == 0 {
		http.Error(w, "Permissão negada", http.StatusForbidden)
		return
	}

	query := `
		SELECT gm.id, gm.group_id, gm.user_id, gm.role, gm.joined_at,
			   u.id, u.username, u.email
		FROM group_members gm
		JOIN users u ON u.id = gm.user_id
		WHERE gm.group_id = ?
		ORDER BY gm.role DESC, gm.joined_at ASC
	`

	rows, err := db.Query(query, groupID)
	if err != nil {
		log.Printf("Erro ao buscar membros: %v", err)
		http.Error(w, "Erro interno do servidor", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var members []GroupMember
	for rows.Next() {
		var gm GroupMember
		var u User
		err := rows.Scan(&gm.ID, &gm.GroupID, &gm.UserID, &gm.Role, &gm.JoinedAt,
						&u.ID, &u.Username, &u.Email)
		if err != nil {
			log.Printf("Erro ao escanear membro: %v", err)
			continue
		}
		gm.User = &u
		members = append(members, gm)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(members)
}

// ============= DESAFIOS =============

// Listar desafios (públicos e dos grupos do usuário)
func getChallenges(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)

	query := `
		SELECT DISTINCT c.id, c.group_id, c.name, c.description, c.habit_name, c.goal_value, c.goal_type, 
			   c.start_date, c.end_date, c.status, c.creator_id, c.created_at, c.updated_at,
			   u.id, u.username, u.email,
			   g.id, g.name, g.privacy,
			   (SELECT COUNT(*) FROM challenge_participants WHERE challenge_id = c.id) as participant_count,
			   (SELECT COUNT(*) FROM challenge_participants WHERE challenge_id = c.id AND user_id = ?) as is_participating,
			   COALESCE((SELECT progress FROM challenge_participants WHERE challenge_id = c.id AND user_id = ?), 0) as user_progress
		FROM challenges c
		JOIN users u ON u.id = c.creator_id
		JOIN ` + "`groups`" + ` g ON g.id = c.group_id
		LEFT JOIN group_members gm ON gm.group_id = g.id
		WHERE g.privacy = 'public' OR gm.user_id = ?
		ORDER BY c.created_at DESC
	`

	rows, err := db.Query(query, userID, userID, userID)
	if err != nil {
		log.Printf("Erro ao buscar desafios: %v", err)
		http.Error(w, "Erro interno do servidor", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var challenges []Challenge
	for rows.Next() {
		var c Challenge
		var creator User
		var group Group
		var isParticipatingInt int
		var userProgress int
		err := rows.Scan(&c.ID, &c.GroupID, &c.Name, &c.Description, &c.HabitName, &c.GoalValue, &c.GoalType,
						&c.StartDate, &c.EndDate, &c.Status, &c.CreatorID, &c.CreatedAt, &c.UpdatedAt,
						&creator.ID, &creator.Username, &creator.Email,
						&group.ID, &group.Name, &group.Privacy,
						&c.ParticipantCount, &isParticipatingInt, &userProgress)
		if err != nil {
			log.Printf("Erro ao escanear desafio: %v", err)
			continue
		}
		c.Creator = &creator
		c.Group = &group
		c.IsParticipating = isParticipatingInt > 0
		c.UserProgress = userProgress
		challenges = append(challenges, c)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(challenges)
}

// Criar novo desafio
func createChallenge(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	vars := mux.Vars(r)
	groupID, err := strconv.Atoi(vars["groupId"])
	if err != nil {
		http.Error(w, "ID de grupo inválido", http.StatusBadRequest)
		return
	}

	var req CreateChallengeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Dados inválidos", http.StatusBadRequest)
		return
	}

	// Validações
	if req.Name == "" {
		http.Error(w, "Nome do desafio é obrigatório", http.StatusBadRequest)
		return
	}

	// Verificar se o usuário é membro do grupo
	var isMember int
	err = db.QueryRow("SELECT COUNT(*) FROM group_members WHERE group_id = ? AND user_id = ?", groupID, userID).Scan(&isMember)
	if err != nil || isMember == 0 {
		http.Error(w, "Você deve ser membro do grupo para criar desafios", http.StatusForbidden)
		return
	}

	// Definir valores padrão
	if req.GoalType == "" {
		req.GoalType = "streak"
	}
	if req.GoalValue == 0 {
		req.GoalValue = 7 // 7 dias por padrão
	}

	// Debug logs
	log.Printf("Creating challenge with goal_type: '%s', goal_value: %d", req.GoalType, req.GoalValue)
	log.Printf("Challenge data: %+v", req)

	// Criar o desafio
	query := `
		INSERT INTO challenges (group_id, name, description, habit_name, goal_value, goal_type, 
								start_date, end_date, status, creator_id) 
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'upcoming', ?)
	`
	result, err := db.Exec(query, groupID, req.Name, req.Description, req.HabitName, 
						  req.GoalValue, req.GoalType, req.StartDate, req.EndDate, userID)
	if err != nil {
		log.Printf("Erro ao criar desafio: %v", err)
		http.Error(w, "Erro interno do servidor", http.StatusInternalServerError)
		return
	}

	challengeID, _ := result.LastInsertId()

	// Participar automaticamente do próprio desafio
	_, err = db.Exec("INSERT INTO challenge_participants (challenge_id, user_id) VALUES (?, ?)", challengeID, userID)
	if err != nil {
		log.Printf("Erro ao adicionar criador ao desafio: %v", err)
	}

	challenge := Challenge{
		ID:          int(challengeID),
		GroupID:     groupID,
		Name:        req.Name,
		Description: req.Description,
		HabitName:   req.HabitName,
		GoalValue:   req.GoalValue,
		GoalType:    req.GoalType,
		StartDate:   req.StartDate,
		EndDate:     req.EndDate,
		Status:      "upcoming",
		CreatorID:   userID,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
		IsParticipating: true,
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(challenge)
}

// Buscar desafio específico
func getChallenge(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	vars := mux.Vars(r)
	challengeID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "ID de desafio inválido", http.StatusBadRequest)
		return
	}

	query := `
		SELECT c.id, c.group_id, c.name, c.description, c.habit_name, c.goal_value, c.goal_type,
			   c.start_date, c.end_date, c.status, c.creator_id, c.created_at, c.updated_at,
			   u.id, u.username, u.email,
			   g.id, g.name, g.privacy,
			   (SELECT COUNT(*) FROM challenge_participants WHERE challenge_id = c.id) as participant_count,
			   (SELECT COUNT(*) FROM challenge_participants WHERE challenge_id = c.id AND user_id = ?) as is_participating
		FROM challenges c
		JOIN users u ON u.id = c.creator_id
		JOIN ` + "`groups`" + ` g ON g.id = c.group_id
		WHERE c.id = ?
	`

	var c Challenge
	var creator User
	var group Group
	var isParticipatingInt int
	err = db.QueryRow(query, userID, challengeID).Scan(
		&c.ID, &c.GroupID, &c.Name, &c.Description, &c.HabitName, &c.GoalValue, &c.GoalType,
		&c.StartDate, &c.EndDate, &c.Status, &c.CreatorID, &c.CreatedAt, &c.UpdatedAt,
		&creator.ID, &creator.Username, &creator.Email,
		&group.ID, &group.Name, &group.Privacy,
		&c.ParticipantCount, &isParticipatingInt)

	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "Desafio não encontrado", http.StatusNotFound)
			return
		}
		log.Printf("Erro ao buscar desafio: %v", err)
		http.Error(w, "Erro interno do servidor", http.StatusInternalServerError)
		return
	}

	c.Creator = &creator
	c.Group = &group
	c.IsParticipating = isParticipatingInt > 0

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(c)
}

// Atualizar desafio (apenas criador)
func updateChallenge(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	vars := mux.Vars(r)
	challengeID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "ID de desafio inválido", http.StatusBadRequest)
		return
	}

	// Verificar se o usuário é o criador do desafio
	var creatorID int
	err = db.QueryRow("SELECT creator_id FROM challenges WHERE id = ?", challengeID).Scan(&creatorID)
	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "Desafio não encontrado", http.StatusNotFound)
			return
		}
		log.Printf("Erro ao verificar criador do desafio: %v", err)
		http.Error(w, "Erro interno do servidor", http.StatusInternalServerError)
		return
	}

	if creatorID != userID {
		http.Error(w, "Apenas o criador pode atualizar o desafio", http.StatusForbidden)
		return
	}

	var req CreateChallengeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Dados inválidos", http.StatusBadRequest)
		return
	}

	query := `
		UPDATE challenges 
		SET name = ?, description = ?, habit_name = ?, goal_value = ?, goal_type = ?,
			start_date = ?, end_date = ?, updated_at = CURRENT_TIMESTAMP 
		WHERE id = ?
	`
	result, err := db.Exec(query, req.Name, req.Description, req.HabitName, req.GoalValue, req.GoalType,
						  req.StartDate, req.EndDate, challengeID)
	if err != nil {
		log.Printf("Erro ao atualizar desafio: %v", err)
		http.Error(w, "Erro interno do servidor", http.StatusInternalServerError)
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		http.Error(w, "Desafio não encontrado", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Desafio atualizado com sucesso"})
}

// Deletar desafio (apenas criador)
func deleteChallenge(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	vars := mux.Vars(r)
	challengeID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "ID de desafio inválido", http.StatusBadRequest)
		return
	}

	// Verificar se o usuário é o criador do desafio
	var creatorID int
	err = db.QueryRow("SELECT creator_id FROM challenges WHERE id = ?", challengeID).Scan(&creatorID)
	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "Desafio não encontrado", http.StatusNotFound)
			return
		}
		log.Printf("Erro ao verificar criador do desafio: %v", err)
		http.Error(w, "Erro interno do servidor", http.StatusInternalServerError)
		return
	}

	if creatorID != userID {
		http.Error(w, "Apenas o criador pode deletar o desafio", http.StatusForbidden)
		return
	}

	// Deletar desafio (cascade deletará participantes)
	result, err := db.Exec("DELETE FROM challenges WHERE id = ?", challengeID)
	if err != nil {
		log.Printf("Erro ao deletar desafio: %v", err)
		http.Error(w, "Erro interno do servidor", http.StatusInternalServerError)
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		http.Error(w, "Desafio não encontrado", http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// Participar do desafio
func joinChallenge(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	vars := mux.Vars(r)
	challengeID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "ID de desafio inválido", http.StatusBadRequest)
		return
	}

	// Verificar se o desafio existe e se o usuário é membro do grupo
	var groupID int
	err = db.QueryRow(`
		SELECT c.group_id FROM challenges c
		JOIN group_members gm ON gm.group_id = c.group_id
		WHERE c.id = ? AND gm.user_id = ?
	`, challengeID, userID).Scan(&groupID)

	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "Desafio não encontrado ou você não é membro do grupo", http.StatusNotFound)
			return
		}
		log.Printf("Erro ao verificar desafio: %v", err)
		http.Error(w, "Erro interno do servidor", http.StatusInternalServerError)
		return
	}

	// Verificar se já está participando
	var existingID int
	err = db.QueryRow("SELECT id FROM challenge_participants WHERE challenge_id = ? AND user_id = ?", challengeID, userID).Scan(&existingID)
	if err == nil {
		http.Error(w, "Você já está participando deste desafio", http.StatusConflict)
		return
	}

	// Adicionar como participante
	_, err = db.Exec("INSERT INTO challenge_participants (challenge_id, user_id) VALUES (?, ?)", challengeID, userID)
	if err != nil {
		log.Printf("Erro ao participar do desafio: %v", err)
		http.Error(w, "Erro interno do servidor", http.StatusInternalServerError)
		return
	}

	// Buscar informações do desafio para o feed
	var challengeName, challengeHabitName string
	err = db.QueryRow("SELECT name, habit_name FROM challenges WHERE id = ?", challengeID).Scan(&challengeName, &challengeHabitName)
	if err != nil {
		log.Printf("Erro ao buscar desafio para feed: %v", err)
	} else {
		// Criar atividade no feed
		challengeIDPtr := &challengeID
		metadata := map[string]interface{}{
			"challenge_name": challengeName,
			"habit_name": challengeHabitName,
		}
		createFeedActivity(userID, "challenge_joined", nil, nil, challengeIDPtr, metadata)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Participação no desafio realizada com sucesso"})
}

// Sair do desafio
func leaveChallenge(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	vars := mux.Vars(r)
	challengeID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "ID de desafio inválido", http.StatusBadRequest)
		return
	}

	// Verificar se é o criador do desafio
	var creatorID int
	err = db.QueryRow("SELECT creator_id FROM challenges WHERE id = ?", challengeID).Scan(&creatorID)
	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "Desafio não encontrado", http.StatusNotFound)
			return
		}
		log.Printf("Erro ao verificar desafio: %v", err)
		http.Error(w, "Erro interno do servidor", http.StatusInternalServerError)
		return
	}

	if creatorID == userID {
		http.Error(w, "O criador do desafio não pode sair. Delete o desafio se necessário.", http.StatusForbidden)
		return
	}

	// Remover da lista de participantes
	result, err := db.Exec("DELETE FROM challenge_participants WHERE challenge_id = ? AND user_id = ?", challengeID, userID)
	if err != nil {
		log.Printf("Erro ao sair do desafio: %v", err)
		http.Error(w, "Erro interno do servidor", http.StatusInternalServerError)
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		http.Error(w, "Você não está participando deste desafio", http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// Listar participantes do desafio
func getChallengeParticipants(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	vars := mux.Vars(r)
	challengeID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "ID de desafio inválido", http.StatusBadRequest)
		return
	}

	// Verificar se o usuário tem acesso ao desafio (membro do grupo)
	var groupID int
	err = db.QueryRow(`
		SELECT c.group_id FROM challenges c
		JOIN ` + "`groups`" + ` g ON g.id = c.group_id
		WHERE c.id = ? AND (
			g.privacy = 'public' OR 
			EXISTS (SELECT 1 FROM group_members WHERE group_id = g.id AND user_id = ?)
		)
	`, challengeID, userID).Scan(&groupID)

	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "Desafio não encontrado ou acesso negado", http.StatusNotFound)
			return
		}
		log.Printf("Erro ao verificar acesso ao desafio: %v", err)
		http.Error(w, "Erro interno do servidor", http.StatusInternalServerError)
		return
	}

	query := `
		SELECT cp.id, cp.challenge_id, cp.user_id, cp.progress, cp.notes, cp.joined_at,
			   u.id, u.username, u.email
		FROM challenge_participants cp
		JOIN users u ON u.id = cp.user_id
		WHERE cp.challenge_id = ?
		ORDER BY cp.progress DESC, cp.joined_at ASC
	`
	
	log.Printf("Buscando participantes para o desafio %d", challengeID)

	rows, err := db.Query(query, challengeID)
	if err != nil {
		log.Printf("Erro ao buscar participantes: %v", err)
		http.Error(w, "Erro interno do servidor", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var participants []ChallengeParticipant
	for rows.Next() {
		var cp ChallengeParticipant
		var u User
		err := rows.Scan(&cp.ID, &cp.ChallengeID, &cp.UserID, &cp.Progress, &cp.Notes, &cp.JoinedAt,
						&u.ID, &u.Username, &u.Email)
		if err != nil {
			log.Printf("Erro ao escanear participante: %v", err)
			continue
		}
		cp.User = &u
		log.Printf("Participante encontrado: ID=%d, UserID=%d, Username=%s", cp.ID, cp.UserID, u.Username)
		participants = append(participants, cp)
	}

	// Verificar se houve erro durante a iteração
	if err := rows.Err(); err != nil {
		log.Printf("Erro durante iteração dos participantes: %v", err)
		http.Error(w, "Erro interno do servidor", http.StatusInternalServerError)
		return
	}

	log.Printf("Total de participantes encontrados: %d", len(participants))
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(participants)
}

// Atualizar progresso no desafio
func updateChallengeProgress(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	vars := mux.Vars(r)
	challengeID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "ID de desafio inválido", http.StatusBadRequest)
		return
	}

	var req struct {
		Progress int    `json:"progress"`
		Notes    string `json:"notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Dados inválidos", http.StatusBadRequest)
		return
	}

	// Verificar se está participando do desafio
	var existingProgress int
	err = db.QueryRow("SELECT progress FROM challenge_participants WHERE challenge_id = ? AND user_id = ?", challengeID, userID).Scan(&existingProgress)
	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "Você não está participando deste desafio", http.StatusNotFound)
			return
		}
		log.Printf("Erro ao verificar participação: %v", err)
		http.Error(w, "Erro interno do servidor", http.StatusInternalServerError)
		return
	}

	// Atualizar progresso
	query := "UPDATE challenge_participants SET progress = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE challenge_id = ? AND user_id = ?"
	result, err := db.Exec(query, req.Progress, req.Notes, challengeID, userID)
	if err != nil {
		log.Printf("Erro ao atualizar progresso: %v", err)
		http.Error(w, "Erro interno do servidor", http.StatusInternalServerError)
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		http.Error(w, "Falha ao atualizar progresso", http.StatusInternalServerError)
		return
	}

	// Buscar informações do desafio para o feed
	var challengeName, challengeHabitName string
	var goalValue int
	err = db.QueryRow("SELECT name, habit_name, goal_value FROM challenges WHERE id = ?", challengeID).Scan(&challengeName, &challengeHabitName, &goalValue)
	if err != nil {
		log.Printf("Erro ao buscar desafio para feed: %v", err)
	} else {
		// Criar atividade no feed apenas se houve progresso significativo
		if req.Progress > existingProgress {
			challengeIDPtr := &challengeID
			metadata := map[string]interface{}{
				"challenge_name": challengeName,
				"habit_name": challengeHabitName,
				"old_progress": existingProgress,
				"new_progress": req.Progress,
				"goal_value": goalValue,
				"notes": req.Notes,
			}
			
			// Criar atividade no feed
			createFeedActivity(userID, "challenge_progress", nil, nil, challengeIDPtr, metadata)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Progresso atualizado com sucesso",
		"progress": req.Progress,
		"notes": req.Notes,
	})
}

// Listar desafios de um grupo específico
func getGroupChallenges(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	vars := mux.Vars(r)
	groupID, err := strconv.Atoi(vars["groupId"])
	if err != nil {
		http.Error(w, "ID de grupo inválido", http.StatusBadRequest)
		return
	}

	// Verificar se o usuário tem acesso ao grupo
	var privacy string
	var isMember int
	err = db.QueryRow("SELECT g.privacy, " +
		"(SELECT COUNT(*) FROM group_members WHERE group_id = g.id AND user_id = ?) as is_member " +
		"FROM " + "`groups`" + " g WHERE g.id = ?", userID, groupID).Scan(&privacy, &isMember)

	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "Grupo não encontrado", http.StatusNotFound)
			return
		}
		log.Printf("Erro ao verificar grupo: %v", err)
		http.Error(w, "Erro interno do servidor", http.StatusInternalServerError)
		return
	}

	if privacy != "public" && isMember == 0 {
		http.Error(w, "Permissão negada", http.StatusForbidden)
		return
	}

	query := `
		SELECT c.id, c.group_id, c.name, c.description, c.habit_name, c.goal_value, c.goal_type, 
			   c.start_date, c.end_date, c.status, c.creator_id, c.created_at, c.updated_at,
			   u.id, u.username, u.email,
			   g.id, g.name, g.privacy,
			   (SELECT COUNT(*) FROM challenge_participants WHERE challenge_id = c.id) as participant_count,
			   (SELECT COUNT(*) FROM challenge_participants WHERE challenge_id = c.id AND user_id = ?) as is_participating
		FROM challenges c
		JOIN users u ON u.id = c.creator_id
		JOIN ` + "`groups`" + ` g ON g.id = c.group_id
		WHERE c.group_id = ?
		ORDER BY c.created_at DESC
	`

	rows, err := db.Query(query, userID, groupID)
	if err != nil {
		log.Printf("Erro ao buscar desafios do grupo: %v", err)
		http.Error(w, "Erro interno do servidor", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var challenges []Challenge
	for rows.Next() {
		var c Challenge
		var creator User
		var group Group
		var isParticipatingInt int
		err := rows.Scan(&c.ID, &c.GroupID, &c.Name, &c.Description, &c.HabitName, &c.GoalValue, &c.GoalType,
						&c.StartDate, &c.EndDate, &c.Status, &c.CreatorID, &c.CreatedAt, &c.UpdatedAt,
						&creator.ID, &creator.Username, &creator.Email,
						&group.ID, &group.Name, &group.Privacy,
						&c.ParticipantCount, &isParticipatingInt)
		if err != nil {
			log.Printf("Erro ao escanear desafio do grupo: %v", err)
			continue
		}
		c.Creator = &creator
		c.Group = &group
		c.IsParticipating = isParticipatingInt > 0
		challenges = append(challenges, c)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(challenges)
}
