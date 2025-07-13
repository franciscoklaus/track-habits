// components/FriendsSidebar.js
import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '../services/apiService';
import ConfirmModal from './ConfirmModal';

const FriendsSidebar = ({ isOpen, onClose, onFriendUpdate }) => {
  const { api } = useApi();
  const [activeTab, setActiveTab] = useState('friends');
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [searchEmail, setSearchEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  
  // Estados para o modal de confirmação
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
    confirmText: 'Confirmar',
    icon: null
  });

  const fetchFriends = useCallback(async () => {
    try {
      const friends = await api.getFriends();
      setFriends(friends || []);
    } catch (err) {
      console.error('Erro ao buscar amigos:', err);
    }
  }, [api]);

  const fetchFriendRequests = useCallback(async () => {
    try {
      const requests = await api.getFriendRequests();
      setFriendRequests(requests || []);
    } catch (err) {
      console.error('Erro ao buscar solicitações:', err);
    }
  }, [api]);

  useEffect(() => {
    if (isOpen) {
      fetchFriends();
      fetchFriendRequests();
    }
  }, [isOpen, fetchFriends, fetchFriendRequests]);

  const handleSendFriendRequest = async (e) => {
    e.preventDefault();
    if (!searchEmail.trim()) return;

    try {
      setLoading(true);
      await api.sendFriendRequest(searchEmail.trim());
      setMessage('Solicitação de amizade enviada com sucesso!');
      setSearchEmail('');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage(err.message || 'Erro ao enviar solicitação');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptRequest = async (requestId) => {
    try {
      await api.acceptFriendRequest(requestId);
      await fetchFriends();
      await fetchFriendRequests();
      onFriendUpdate?.();
      setMessage('Solicitação aceita com sucesso!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error('Erro ao aceitar solicitação:', err);
      setMessage('Erro ao aceitar solicitação');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleRemoveFriend = (friendshipId) => {
    setConfirmModal({
      isOpen: true,
      title: 'Remover Amigo',
      message: 'Tem certeza que deseja remover este amigo? Esta ação não pode ser desfeita.',
      confirmText: 'Remover',
      icon: (
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
          <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      ),
      onConfirm: async () => {
        try {
          await api.removeFriend(friendshipId);
          await fetchFriends();
          onFriendUpdate?.();
          setMessage('Amigo removido com sucesso!');
          setTimeout(() => setMessage(''), 3000);
        } catch (err) {
          console.error('Erro ao remover amigo:', err);
          setMessage('Erro ao remover amigo');
          setTimeout(() => setMessage(''), 3000);
        }
      }
    });
  };

  const handleCancelRequest = (requestId) => {
    setConfirmModal({
      isOpen: true,
      title: 'Cancelar Solicitação',
      message: 'Tem certeza que deseja cancelar esta solicitação de amizade?',
      confirmText: 'Cancelar Solicitação',
      icon: (
        <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
          <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      ),
      onConfirm: async () => {
        try {
          await api.cancelFriendRequest(requestId);
          await fetchFriendRequests();
          setMessage('Solicitação cancelada com sucesso!');
          setTimeout(() => setMessage(''), 3000);
        } catch (err) {
          console.error('Erro ao cancelar solicitação:', err);
          setMessage('Erro ao cancelar solicitação');
          setTimeout(() => setMessage(''), 3000);
        }
      }
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose}></div>
      
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-xl">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Amigos</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Message */}
          {message && (
            <div className={`mx-6 mt-4 p-3 rounded-lg text-sm ${
              message.includes('Erro') 
                ? 'bg-red-50 text-red-700 border border-red-200'
                : 'bg-green-50 text-green-700 border border-green-200'
            }`}>
              {message}
            </div>
          )}

          {/* Tabs */}
          <div className="flex border-b border-gray-200 px-6">
            <button
              onClick={() => setActiveTab('friends')}
              className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'friends'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Amigos ({friends.length})
            </button>
            <button
              onClick={() => setActiveTab('requests')}
              className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'requests'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Solicitações ({friendRequests.length})
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'friends' && (
              <div>
                {/* Add Friend Form */}
                <div className="mb-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-3">Adicionar Amigo</h3>
                  <form onSubmit={handleSendFriendRequest} className="space-y-3">
                    <input
                      type="email"
                      value={searchEmail}
                      onChange={(e) => setSearchEmail(e.target.value)}
                      placeholder="Email do amigo"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                      type="submit"
                      disabled={loading || !searchEmail.trim()}
                      className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                    >
                      {loading ? 'Enviando...' : 'Enviar Solicitação'}
                    </button>
                  </form>
                </div>

                {/* Friends List */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-3">Seus Amigos</h3>
                  {friends.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">
                      Você ainda não tem amigos adicionados.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {friends.map((friendship) => (
                        <div key={friendship.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                              <span className="text-blue-600 font-medium">
                                {friendship.friend?.username?.[0]?.toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{friendship.friend?.username}</p>
                              <p className="text-sm text-gray-500">{friendship.friend?.email}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleRemoveFriend(friendship.id)}
                            className="text-red-600 hover:text-red-800 transition-colors"
                            title="Remover amigo"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'requests' && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-3">Solicitações</h3>
                {friendRequests.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    Nenhuma solicitação pendente.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {friendRequests.map((request) => (
                      <div key={request.id} className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3 mb-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            request.type === 'received' ? 'bg-green-100' : 'bg-yellow-100'
                          }`}>
                            <span className={`font-medium ${
                              request.type === 'received' ? 'text-green-600' : 'text-yellow-600'
                            }`}>
                              {request.friend?.username?.[0]?.toUpperCase()}
                            </span>
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{request.friend?.username}</p>
                            <p className="text-sm text-gray-500">
                              {request.type === 'received' 
                                ? 'Quer ser seu amigo' 
                                : 'Aguardando aprovação'
                              }
                            </p>
                            <span className={`inline-block px-2 py-1 text-xs rounded-full mt-1 ${
                              request.type === 'received' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {request.type === 'received' ? 'Recebida' : 'Enviada'}
                            </span>
                          </div>
                        </div>
                        
                        {request.type === 'received' ? (
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleAcceptRequest(request.id)}
                              className="flex-1 bg-green-600 text-white py-2 px-3 rounded-lg hover:bg-green-700 transition-colors text-sm"
                            >
                              Aceitar
                            </button>
                            <button
                              onClick={() => handleCancelRequest(request.id)}
                              className="flex-1 bg-red-600 text-white py-2 px-3 rounded-lg hover:bg-red-700 transition-colors text-sm"
                            >
                              Recusar
                            </button>
                          </div>
                        ) : (
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleCancelRequest(request.id)}
                              className="w-full bg-gray-600 text-white py-2 px-3 rounded-lg hover:bg-gray-700 transition-colors text-sm"
                            >
                              Cancelar Solicitação
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Confirmação */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        confirmButtonClass="bg-red-600 hover:bg-red-700"
        icon={confirmModal.icon}
      />
    </div>
  );
};

export default FriendsSidebar;
