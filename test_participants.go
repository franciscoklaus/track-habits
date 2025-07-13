package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"

	_ "github.com/go-sql-driver/mysql"
)

type User struct {
	ID       int    `json:"id"`
	Username string `json:"username"`
	Email    string `json:"email"`
}

type ChallengeParticipant struct {
	ID          int    `json:"id"`
	ChallengeID int    `json:"challenge_id"`
	UserID      int    `json:"user_id"`
	Progress    int    `json:"progress"`
	Notes       *string `json:"notes"`
	JoinedAt    string `json:"joined_at"`
	User        *User  `json:"user"`
}

func main() {
	db, err := sql.Open("mysql", "devuser:devpass123@tcp(localhost:3306)/habit_tracker?charset=utf8mb4&parseTime=True&loc=Local")
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	challengeID := 3
	
	query := `
		SELECT cp.id, cp.challenge_id, cp.user_id, cp.progress, cp.notes, cp.joined_at,
			   u.id, u.username, u.email
		FROM challenge_participants cp
		JOIN users u ON u.id = cp.user_id
		WHERE cp.challenge_id = ?
		ORDER BY cp.progress DESC, cp.joined_at ASC
	`

	rows, err := db.Query(query, challengeID)
	if err != nil {
		log.Fatal("Erro ao buscar participantes:", err)
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
		participants = append(participants, cp)
		fmt.Printf("Participante: %d - %s (Progress: %d)\n", cp.UserID, u.Username, cp.Progress)
	}

	if err := rows.Err(); err != nil {
		log.Fatal("Erro ao iterar rows:", err)
	}

	fmt.Printf("Total de participantes: %d\n", len(participants))
	
	jsonData, _ := json.MarshalIndent(participants, "", "  ")
	fmt.Println(string(jsonData))
}
