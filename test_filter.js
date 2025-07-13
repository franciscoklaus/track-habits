// Teste da lógica de filtro de desafios ativos

const challenges = [
  {
    id: 1,
    name: "Desafio Upcoming mas já começou",
    status: "upcoming",
    start_date: "2025-01-10T00:00:00Z", // Data passada
    end_date: "2025-01-20T00:00:00Z",   // Data futura
    is_participating: true
  },
  {
    id: 2,
    name: "Desafio Active",
    status: "active",
    start_date: "2025-01-05T00:00:00Z", // Data passada
    end_date: "2025-01-25T00:00:00Z",   // Data futura
    is_participating: true
  },
  {
    id: 3,
    name: "Desafio Upcoming futuro",
    status: "upcoming",
    start_date: "2025-01-15T00:00:00Z", // Data futura
    end_date: "2025-01-25T00:00:00Z",   // Data futura
    is_participating: true
  },
  {
    id: 4,
    name: "Desafio Terminado",
    status: "active",
    start_date: "2025-01-01T00:00:00Z", // Data passada
    end_date: "2025-01-10T00:00:00Z",   // Data passada
    is_participating: true
  },
  {
    id: 5,
    name: "Desafio não participando",
    status: "active",
    start_date: "2025-01-05T00:00:00Z", // Data passada
    end_date: "2025-01-25T00:00:00Z",   // Data futura
    is_participating: false
  }
];

// Simular data atual
const now = new Date("2025-01-11T12:00:00Z");

console.log("Data atual simulada:", now.toISOString());
console.log("\n=== Teste do filtro de desafios ativos ===");

const filteredChallenges = challenges.filter(challenge => {
  const startDate = new Date(challenge.start_date);
  const endDate = new Date(challenge.end_date);
  
  const isParticipating = challenge.is_participating;
  const isActive = challenge.status === 'active' || (challenge.status === 'upcoming' && startDate <= now);
  const isNotExpired = endDate > now;
  
  console.log(`\nDesafio: ${challenge.name}`);
  console.log(`  Status: ${challenge.status}`);
  console.log(`  Start: ${startDate.toISOString()}`);
  console.log(`  End: ${endDate.toISOString()}`);
  console.log(`  Participating: ${isParticipating}`);
  console.log(`  IsActive: ${isActive}`);
  console.log(`  NotExpired: ${isNotExpired}`);
  console.log(`  INCLUÍDO: ${isParticipating && isActive && isNotExpired}`);
  
  return isParticipating && isActive && isNotExpired;
});

console.log("\n=== Resultado final ===");
console.log("Desafios ativos filtrados:");
filteredChallenges.forEach(challenge => {
  console.log(`- ${challenge.name} (${challenge.status})`);
});
