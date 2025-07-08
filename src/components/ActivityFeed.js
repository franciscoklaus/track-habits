// components/ActivityFeed.js
import React, { useState, useEffect } from 'react';
import { useApi } from '../services/apiService';
import ActivityCard from './ActivityCard';
import FriendsSidebar from './FriendsSidebar';

const ActivityFeed = () => {
  const { api } = useApi();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showFriends, setShowFriends] = useState(false);

  useEffect(() => {
    fetchFeed();
  }, []);

  const fetchFeed = async () => {
    try {
      setLoading(true);
      const activities = await api.getFeed();
      setActivities(activities);
    } catch (err) {
      setError('Erro ao carregar feed');
      console.error('Erro ao buscar feed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReaction = async (activityId, reactionType) => {
    try {
      await api.reactToActivity(activityId, reactionType);
      await fetchFeed(); // Recarregar para atualizar reações
    } catch (err) {
      console.error('Erro ao reagir:', err);
    }
  };

  const handleRemoveReaction = async (activityId) => {
    try {
      await api.removeReaction(activityId);
      await fetchFeed();
    } catch (err) {
      console.error('Erro ao remover reação:', err);
    }
  };

  const handleComment = async (activityId, comment) => {
    try {
      const newComment = await api.commentOnActivity(activityId, comment);
      await fetchFeed();
      return newComment;
    } catch (err) {
      console.error('Erro ao comentar:', err);
      throw err;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Feed de Atividades</h1>
            <p className="text-gray-600 mt-2">Veja o progresso dos seus amigos</p>
          </div>
          <button
            onClick={() => setShowFriends(true)}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
            </svg>
            Amigos
          </button>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex">
              <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <p className="ml-3 text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Feed Content */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Feed */}
          <div className="lg:col-span-3">
            {(activities || []).length === 0 ? (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
                <h3 className="mt-4 text-lg font-medium text-gray-900">Nenhuma atividade no feed</h3>
                <p className="mt-2 text-gray-500">Adicione amigos para ver suas conquistas aqui!</p>
              </div>
            ) : (
              <div className="space-y-6">
                {activities.map((activity) => (
                  <ActivityCard
                    key={activity.id}
                    activity={activity}
                    onReaction={handleReaction}
                    onRemoveReaction={handleRemoveReaction}
                    onComment={handleComment}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Sidebar - Quick Friends Info */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Conecte-se</h3>
              <p className="text-gray-600 text-sm mb-4">
                Adicione amigos para acompanhar suas jornadas de hábitos!
              </p>
              <button
                onClick={() => setShowFriends(true)}
                className="w-full bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Gerenciar Amigos
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Friends Sidebar Modal */}
      <FriendsSidebar 
        isOpen={showFriends} 
        onClose={() => setShowFriends(false)}
        onFriendUpdate={fetchFeed}
      />
    </div>
  );
};

export default ActivityFeed;
