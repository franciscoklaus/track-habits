import React, { useState, useEffect } from 'react';
import { apiService, useApi } from '../services/apiService';
import './Groups.css';

const Groups = () => {
  const { user } = useApi();
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showGroupDetail, setShowGroupDetail] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState(null);
  const [newGroup, setNewGroup] = useState({
    name: '',
    description: '',
    privacy: 'public'
  });

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const data = await apiService.getGroups();
      setGroups(Array.isArray(data) ? data : []);
    } catch (err) {
      setError('Erro ao carregar grupos');
      console.error('Erro ao buscar grupos:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    try {
      const group = await apiService.createGroup(newGroup);
      setGroups([group, ...groups]);
      setNewGroup({ name: '', description: '', privacy: 'public' });
      setShowCreateModal(false);
    } catch (err) {
      setError('Erro ao criar grupo');
      console.error('Erro ao criar grupo:', err);
    }
  };

  const handleJoinGroup = async (groupId) => {
    try {
      await apiService.joinGroup(groupId);
      // Atualizar a lista para refletir a mudança
      await fetchGroups();
    } catch (err) {
      setError('Erro ao entrar no grupo');
      console.error('Erro ao entrar no grupo:', err);
    }
  };

  const handleLeaveGroup = async (groupId) => {
    try {
      await apiService.leaveGroup(groupId);
      // Atualizar a lista para refletir a mudança
      await fetchGroups();
    } catch (err) {
      setError('Erro ao sair do grupo');
      console.error('Erro ao sair do grupo:', err);
    }
  };

  const handleDeleteGroup = async (groupId) => {
    setGroupToDelete(groupId);
    setShowDeleteModal(true);
  };

  const confirmDeleteGroup = async () => {
    if (!groupToDelete) return;
    
    try {
      await apiService.deleteGroup(groupToDelete);
      // Atualizar a lista para refletir a mudança
      await fetchGroups();
    } catch (err) {
      setError('Erro ao deletar grupo');
      console.error('Erro ao deletar grupo:', err);
    } finally {
      setShowDeleteModal(false);
      setGroupToDelete(null);
    }
  };

  const cancelDeleteGroup = () => {
    setShowDeleteModal(false);
    setGroupToDelete(null);
  };

  const handleGroupClick = async (group) => {
    try {
      const groupDetail = await apiService.getGroup(group.id);
      setSelectedGroup(groupDetail);
      setShowGroupDetail(true);
    } catch (err) {
      setError('Erro ao carregar detalhes do grupo');
      console.error('Erro ao carregar grupo:', err);
    }
  };

  if (loading) {
    return (
      <div className="groups-container">
        <div className="loading">Carregando grupos...</div>
      </div>
    );
  }

  return (
    <div className="groups-container">
      <div className="groups-header">
        <h2>Grupos</h2>
        <button 
          className="btn btn-primary"
          onClick={() => setShowCreateModal(true)}
        >
          Criar Grupo
        </button>
      </div>

      {error && (
        <div className="error-message">{error}</div>
      )}

      <div className="groups-grid">
        {groups.map(group => (
          <div key={group.id} className="group-card">
            <div className="group-header">
              <h3 onClick={() => handleGroupClick(group)}>
                {group.name}
              </h3>
              <span className={`privacy-badge ${group.privacy}`}>
                {group.privacy === 'public' ? 'Público' : 'Privado'}
              </span>
            </div>
            
            <p className="group-description">{group.description}</p>
            
            <div className="group-stats">
              <span>{group.member_count} membros</span>
              <span>Criado por {group.creator?.username}</span>
            </div>
            
            <div className="group-actions">
              {group.is_joined ? (
                // Se é o criador do grupo, sempre mostrar botão de deletar
                group.creator_id === user?.id ? (
                  <button 
                    className="btn btn-danger"
                    onClick={() => handleDeleteGroup(group.id)}
                  >
                    Deletar Grupo
                  </button>
                ) : (
                  <button 
                    className="btn btn-secondary"
                    onClick={() => handleLeaveGroup(group.id)}
                  >
                    Sair do Grupo
                  </button>
                )
              ) : (
                <button 
                  className="btn btn-primary"
                  onClick={() => handleJoinGroup(group.id)}
                  disabled={group.privacy === 'private'}
                >
                  Entrar no Grupo
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {groups.length === 0 && !loading && (
        <div className="empty-state">
          <p>Nenhum grupo encontrado.</p>
          <button 
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            Criar Primeiro Grupo
          </button>
        </div>
      )}

      {/* Modal Criar Grupo */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Criar Novo Grupo</h3>
              <button 
                className="close-btn"
                onClick={() => setShowCreateModal(false)}
              >
                ×
              </button>
            </div>
            
            <form onSubmit={handleCreateGroup}>
              <div className="form-group">
                <label htmlFor="name">Nome do Grupo *</label>
                <input
                  type="text"
                  id="name"
                  value={newGroup.name}
                  onChange={(e) => setNewGroup({...newGroup, name: e.target.value})}
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="description">Descrição</label>
                <textarea
                  id="description"
                  value={newGroup.description}
                  onChange={(e) => setNewGroup({...newGroup, description: e.target.value})}
                  rows="3"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="privacy">Privacidade</label>
                <select
                  id="privacy"
                  value={newGroup.privacy}
                  onChange={(e) => setNewGroup({...newGroup, privacy: e.target.value})}
                >
                  <option value="public">Público</option>
                  <option value="private">Privado</option>
                </select>
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
                  Criar Grupo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirmar Exclusão */}
      {showDeleteModal && (
        <div className="modal-overlay">
          <div className="modal confirm-modal">
            <div className="modal-header">
              <h3>Confirmar Exclusão</h3>
              <button 
                className="close-btn"
                onClick={cancelDeleteGroup}
              >
                ×
              </button>
            </div>
            
            <div className="modal-body">
              <div className="warning-icon">⚠️</div>
              <p className="warning-text">
                Tem certeza que deseja deletar este grupo?
              </p>
              <p className="warning-subtext">
                Esta ação não pode ser desfeita. Todos os dados do grupo, incluindo desafios e histórico, serão perdidos permanentemente.
              </p>
            </div>
            
            <div className="form-actions">
              <button 
                type="button" 
                className="btn btn-secondary"
                onClick={cancelDeleteGroup}
              >
                Cancelar
              </button>
              <button 
                type="button" 
                className="btn btn-danger"
                onClick={confirmDeleteGroup}
              >
                Deletar Grupo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Group Detail Modal */}
      {showGroupDetail && selectedGroup && (
        <GroupDetail 
          group={selectedGroup}
          onClose={() => setShowGroupDetail(false)}
          onUpdate={fetchGroups}
        />
      )}
    </div>
  );
};

// Componente de detalhes do grupo
const GroupDetail = ({ group, onClose, onUpdate }) => {
  const [members, setMembers] = useState([]);
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('members');

  useEffect(() => {
    const fetchGroupData = async () => {
      try {
        setLoading(true);
        const [membersData, challengesData] = await Promise.all([
          apiService.getGroupMembers(group.id),
          apiService.getGroupChallenges(group.id)
        ]);
        setMembers(Array.isArray(membersData) ? membersData : []);
        setChallenges(Array.isArray(challengesData) ? challengesData : []);
      } catch (err) {
        console.error('Erro ao carregar dados do grupo:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchGroupData();
  }, [group.id]);

  return (
    <div className="modal-overlay">
      <div className="modal large">
        <div className="modal-header">
          <h3>{group.name}</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="group-detail-content">
          <div className="group-info">
            <p>{group.description}</p>
            <div className="group-meta">
              <span>{group.member_count} membros</span>
              <span>Criado por {group.creator?.username}</span>
              <span className={`privacy-badge ${group.privacy}`}>
                {group.privacy === 'public' ? 'Público' : 'Privado'}
              </span>
            </div>
          </div>
          
          <div className="tabs">
            <button 
              className={`tab ${activeTab === 'members' ? 'active' : ''}`}
              onClick={() => setActiveTab('members')}
            >
              Membros ({members.length})
            </button>
            <button 
              className={`tab ${activeTab === 'challenges' ? 'active' : ''}`}
              onClick={() => setActiveTab('challenges')}
            >
              Desafios ({challenges.length})
            </button>
          </div>
          
          <div className="tab-content">
            {activeTab === 'members' && (
              <div className="members-list">
                {loading ? (
                  <div className="loading">Carregando membros...</div>
                ) : (
                  members.map(member => (
                    <div key={member.id} className="member-item">
                      <div className="member-info">
                        <strong>{member.user?.username}</strong>
                        <span className={`role-badge ${member.role}`}>
                          {member.role === 'admin' ? 'Admin' : 'Membro'}
                        </span>
                      </div>
                      <div className="member-meta">
                        Entrou em {new Date(member.joined_at).toLocaleDateString('pt-BR')}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
            
            {activeTab === 'challenges' && (
              <div className="challenges-list">
                {loading ? (
                  <div className="loading">Carregando desafios...</div>
                ) : challenges.length > 0 ? (
                  challenges.map(challenge => (
                    <div key={challenge.id} className="challenge-item">
                      <h4>{challenge.name}</h4>
                      <p>{challenge.description}</p>
                      <div className="challenge-meta">
                        <span>Meta: {challenge.goal_value} {challenge.goal_type}</span>
                        <span>{challenge.participant_count} participantes</span>
                        <span className={`status-badge ${challenge.status}`}>
                          {challenge.status}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">
                    <p>Nenhum desafio criado ainda.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Groups;
