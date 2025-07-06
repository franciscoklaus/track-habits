#!/bin/bash

# Script para atualizar a tabela habits com a nova coluna reminder_times

echo "Atualizando estrutura do banco de dados..."

# Conectar ao MySQL e adicionar a coluna reminder_times
mysql -u root -prootpass123 -h localhost -P 3306 habit_tracker << EOF

-- Adicionar nova coluna reminder_times se não existir
ALTER TABLE habits 
ADD COLUMN IF NOT EXISTS reminder_times TEXT AFTER reminder_time;

-- Mostrar estrutura da tabela atualizada
DESCRIBE habits;

-- Migrar dados existentes de reminder_time para reminder_times
UPDATE habits 
SET reminder_times = CONCAT('["', reminder_time, '"]') 
WHERE reminder_enabled = 1 AND reminder_time IS NOT NULL AND reminder_times IS NULL;

-- Verificar dados migrados
SELECT id, name, reminder_enabled, reminder_time, reminder_times 
FROM habits 
WHERE reminder_enabled = 1 
LIMIT 5;

EOF

echo "Estrutura do banco de dados atualizada com sucesso!"
