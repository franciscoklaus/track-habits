import React, { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';
import './Challenges.css';

const Challenges = () => {
  const [challenges, setChallenges] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedChallenge, setSelectedChallenge] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showChallengeDetail, setShowChallengeDetail] = useState(false);
  const [newChallenge, setNewChallenge] = useState({
    name: '',
    description: '',
    habit_name: '',
    goal_value: 7,
    goal_type: 'streak',
    start_date: '',
    end_date: '',
    group_id: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [challengesData, groupsData] = await Promise.all([
        apiService.getChallenges(),
        apiService.getGroups()
      ]);
      setChallenges(Array.isArray(challengesData) ? challengesData : []);
      setGroups(Array.isArray(groupsData) ? groupsData.filter(g => g.is_joined) : []);
    } catch (err) {
      setError('Erro ao carregar dados');
      console.error('Erro ao buscar dados:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateChallenge = async (e) => {
    e.preventDefault();
    try {
      const challenge = await apiService.createChallenge(newChallenge.group_id, {
        name: newChallenge.name,
        description: newChallenge.description,
        habit_name: newChallenge.habit_name,
        goal_value: parseInt(newChallenge.goal_value),
        goal_type: newChallenge.goal_type,
        start_date: newChallenge.start_date,
        end_date: newChallenge.end_date
      });
      setChallenges([challenge, ...challenges]);
      setNewChallenge({
        name: '',
        description: '',
        habit_name: '',
        goal_value: 7,
        goal_type: 'streak',
        start_date: '',
        end_date: '',
        group_id: ''
      });
      setShowCreateModal(false);
    } catch (err) {
      setError('Erro ao criar desafio');
      console.error('Erro ao criar desafio:', err);
    }
  };

  const handleJoinChallenge = async (challengeId) => {
    try {
      await apiService.joinChallenge(challengeId);
      await fetchData(); // Atualizar a lista
    } catch (err) {
      setError('Erro ao participar do desafio');
      console.error('Erro ao participar do desafio:', err);
    }
  };

  const handleLeaveChallenge = async (challengeId) => {
    try {
      await apiService.leaveChallenge(challengeId);
      await fetchData(); // Atualizar a lista
    } catch (err) {
      setError('Erro ao sair do desafio');
      console.error('Erro ao sair do desafio:', err);
    }
  };

  const handleChallengeClick = async (challenge) => {
    try {
      const challengeDetail = await apiService.getChallenge(challenge.id);
      setSelectedChallenge(challengeDetail);
      setShowChallengeDetail(true);
    } catch (err) {
      setError('Erro ao carregar detalhes do desafio');
      console.error('Erro ao carregar desafio:', err);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'upcoming': return '#f39c12';
      case 'active': return '#27ae60';
      case 'completed': return '#3498db';
      case 'cancelled': return '#e74c3c';
      default: return '#95a5a6';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'upcoming': return 'Próximo';
      case 'active': return 'Ativo';
      case 'completed': return 'Concluído';
      case 'cancelled': return 'Cancelado';
      default: return status;
    }
  };

  if (loading) {
    return (
      <div className="challenges-container">
        <div className="loading">Carregando desafios...</div>
      </div>
    );
  }

  return (
    <div className="challenges-container">
      <div className="challenges-header">
        <h2>Desafios</h2>
        <button 
          className="btn btn-primary"
          onClick={() => setShowCreateModal(true)}
          disabled={groups.length === 0}
        >
          Criar Desafio
        </button>
      </div>

      {error && (
        <div className="error-message">{error}</div>
      )}

      {groups.length === 0 && (
        <div className="info-message">
          Você precisa fazer parte de um grupo para criar desafios.
        </div>
      )}

      <div className="challenges-grid">
        {challenges.map(challenge => (
          <div key={challenge.id} className="challenge-card">
            <div className="challenge-header">
              <h3 onClick={() => handleChallengeClick(challenge)}>
                {challenge.name}
              </h3>
              <span 
                className="status-badge"
                style={{ backgroundColor: getStatusColor(challenge.status) }}
              >
                {getStatusText(challenge.status)}
              </span>
            </div>
            
            <p className="challenge-description">{challenge.description}</p>
            
            <div className="challenge-goal">
              <strong>Meta:</strong> {challenge.goal_value} {challenge.goal_type} 
              {challenge.habit_name && ` - ${challenge.habit_name}`}
            </div>
            
            <div className="challenge-dates">
              <div>
                <strong>Início:</strong> {new Date(challenge.start_date).toLocaleDateString('pt-BR')}
              </div>
              <div>
                <strong>Fim:</strong> {new Date(challenge.end_date).toLocaleDateString('pt-BR')}
              </div>
            </div>
            
            <div className="challenge-stats">
              <span>{challenge.participant_count} participantes</span>
              <span>Grupo: {challenge.group?.name}</span>
            </div>
            
            <div className="challenge-actions">
              {challenge.is_participating ? (
                <button 
                  className="btn btn-secondary"
                  onClick={() => handleLeaveChallenge(challenge.id)}
                >
                  Sair do Desafio
                </button>
              ) : (
                <button 
                  className="btn btn-primary"
                  onClick={() => handleJoinChallenge(challenge.id)}
                >
                  Participar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {challenges.length === 0 && !loading && (
        <div className="empty-state">
          <p>Nenhum desafio encontrado.</p>
          {groups.length > 0 && (
            <button 
              className="btn btn-primary"
              onClick={() => setShowCreateModal(true)}
            >
              Criar Primeiro Desafio
            </button>
          )}
        </div>
      )}

      {/* Modal Criar Desafio */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Criar Novo Desafio</h3>
              <button 
                className="close-btn"
                onClick={() => setShowCreateModal(false)}
              >
                ×
              </button>
            </div>
            
            <form onSubmit={handleCreateChallenge}>
              <div className="modal-content">
                <div className="form-group">
                  <label htmlFor="group_id">Grupo *</label>
                  <select
                    id="group_id"
                    value={newChallenge.group_id}
                    onChange={(e) => setNewChallenge({...newChallenge, group_id: e.target.value})}
                    required
                  >
                    <option value="">Selecione um grupo</option>
                    {groups.map(group => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="form-group">
                  <label htmlFor="name">Nome do Desafio *</label>
                  <input
                    type="text"
                    id="name"
                    value={newChallenge.name}
                    onChange={(e) => setNewChallenge({...newChallenge, name: e.target.value})}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="description">Descrição</label>
                  <textarea
                    id="description"
                    value={newChallenge.description}
                    onChange={(e) => setNewChallenge({...newChallenge, description: e.target.value})}
                    rows="3"
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="habit_name">Nome do Hábito</label>
                  <input
                    type="text"
                    id="habit_name"
                    value={newChallenge.habit_name}
                    onChange={(e) => setNewChallenge({...newChallenge, habit_name: e.target.value})}
                    placeholder="Ex: Exercitar-se, Ler, Meditar..."
                  />
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="goal_type">Tipo de Meta</label>
                    <select
                      id="goal_type"
                      value={newChallenge.goal_type}
                      onChange={(e) => setNewChallenge({...newChallenge, goal_type: e.target.value})}
                    >
                      <option value="streak">Sequência (dias seguidos)</option>
                      <option value="count">Contagem total</option>
                      <option value="weekly">Meta semanal</option>
                      <option value="monthly">Meta mensal</option>
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="goal_value">Valor da Meta *</label>
                    <input
                      type="number"
                      id="goal_value"
                      value={newChallenge.goal_value}
                      onChange={(e) => setNewChallenge({...newChallenge, goal_value: e.target.value})}
                      min="1"
                      required
                    />
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="start_date">Data de Início *</label>
                    <input
                      type="date"
                      id="start_date"
                      value={newChallenge.start_date}
                      onChange={(e) => setNewChallenge({...newChallenge, start_date: e.target.value})}
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="end_date">Data de Fim *</label>
                    <input
                      type="date"
                      id="end_date"
                      value={newChallenge.end_date}
                      onChange={(e) => setNewChallenge({...newChallenge, end_date: e.target.value})}
                      required
                    />
                  </div>
                </div>
              </div>
              
              <div className="form-actions">
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Criar Desafio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Challenge Detail Modal */}
      {showChallengeDetail && selectedChallenge && (
        <ChallengeDetail 
          challenge={selectedChallenge}
          onClose={() => setShowChallengeDetail(false)}
          onUpdate={fetchData}
        />
      )}
    </div>
  );
};

// Componente de detalhes do desafio
const ChallengeDetail = ({ challenge, onClose, onUpdate }) => {
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [notes, setNotes] = useState('');
  const [showProgressModal, setShowProgressModal] = useState(false);

  useEffect(() => {
    fetchParticipants();
  }, [challenge.id]);

  const fetchParticipants = async () => {
    try {
      setLoading(true);
      const data = await apiService.getChallengeParticipants(challenge.id);
      setParticipants(Array.isArray(data) ? data : []);
      
      // Encontrar o progresso atual do usuário
      const userParticipant = data.find(p => p.user_id === getCurrentUserId());
      if (userParticipant) {
        setProgress(userParticipant.progress);
        setNotes(userParticipant.notes || '');
      }
    } catch (err) {
      console.error('Erro ao carregar participantes:', err);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentUserId = () => {
    // Esta função deveria obter o ID do usuário atual
    // Por simplicidade, vamos usar localStorage ou context
    return parseInt(localStorage.getItem('userId')) || 0;
  };

  const handleUpdateProgress = async (e) => {
    e.preventDefault();
    try {
      await apiService.updateChallengeProgress(challenge.id, {
        progress: parseInt(progress),
        notes: notes
      });
      setShowProgressModal(false);
      await fetchParticipants();
    } catch (err) {
      console.error('Erro ao atualizar progresso:', err);
    }
  };

  const getProgressPercentage = (current, target) => {
    return Math.min((current / target) * 100, 100);
  };

  return (
    <div className="modal-overlay">
      <div className="modal large">
        <div className="modal-header">
          <h3>{challenge.name}</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="challenge-detail-content">
          <div className="challenge-info">
            <p>{challenge.description}</p>
            
            <div className="challenge-meta">
              <div className="meta-item">
                <strong>Meta:</strong> {challenge.goal_value} {challenge.goal_type}
                {challenge.habit_name && ` - ${challenge.habit_name}`}
              </div>
              <div className="meta-item">
                <strong>Período:</strong> {new Date(challenge.start_date).toLocaleDateString('pt-BR')} até {new Date(challenge.end_date).toLocaleDateString('pt-BR')}
              </div>
              <div className="meta-item">
                <strong>Grupo:</strong> {challenge.group?.name}
              </div>
              <div className="meta-item">
                <strong>Criado por:</strong> {challenge.creator?.username}
              </div>
            </div>
          </div>
          
          {challenge.is_participating && (
            <div className="progress-section">
              <div className="section-header">
                <h4>Meu Progresso</h4>
                <button 
                  className="btn btn-primary btn-sm"
                  onClick={() => setShowProgressModal(true)}
                >
                  Atualizar Progresso
                </button>
              </div>
              
              <div className="progress-bar">
                <div 
                  className="progress-fill"
                  style={{ width: `${getProgressPercentage(progress, challenge.goal_value)}%` }}
                />
                <span className="progress-text">
                  {progress} / {challenge.goal_value}
                </span>
              </div>
            </div>
          )}
          
          <div className="participants-section">
            <h4>Participantes ({participants.length})</h4>
            
            {loading ? (
              <div className="loading">Carregando participantes...</div>
            ) : (
              <div className="participants-list">
                {participants
                  .sort((a, b) => b.progress - a.progress)
                  .map((participant, index) => (
                    <div key={participant.id} className="participant-item">
                      <div className="participant-rank">
                        #{index + 1}
                      </div>
                      <div className="participant-info">
                        <strong>{participant.user?.username}</strong>
                        <div className="participant-progress">
                          <div className="progress-bar-sm">
                            <div 
                              className="progress-fill"
                              style={{ width: `${getProgressPercentage(participant.progress, challenge.goal_value)}%` }}
                            />
                          </div>
                          <span>{participant.progress} / {challenge.goal_value}</span>
                        </div>
                        {participant.notes && (
                          <div className="participant-notes">{participant.notes}</div>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
        
        {/* Progress Update Modal */}
        {showProgressModal && (
          <div className="modal-overlay">
            <div className="modal">
              <div className="modal-header">
                <h3>Atualizar Progresso</h3>
                <button 
                  className="close-btn"
                  onClick={() => setShowProgressModal(false)}
                >
                  ×
                </button>
              </div>
              
              <form onSubmit={handleUpdateProgress}>
                <div className="modal-content">
                  <div className="form-group">
                    <label htmlFor="progress">Progresso Atual</label>
                    <input
                      type="number"
                      id="progress"
                      value={progress}
                      onChange={(e) => setProgress(e.target.value)}
                      min="0"
                      max={challenge.goal_value}
                    />
                    <small>Meta: {challenge.goal_value} {challenge.goal_type}</small>
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="notes">Notas (opcional)</label>
                    <textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows="3"
                      placeholder="Adicione comentários sobre seu progresso..."
                    />
                  </div>
                </div>
                
                <div className="form-actions">
                  <button 
                    type="button" 
                    className="btn btn-secondary"
                    onClick={() => setShowProgressModal(false)}
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Atualizar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Challenges;
