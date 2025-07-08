// components/ActivityCard.js
import React, { useState, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useApi } from '../services/apiService';

const ActivityCard = ({ activity, onReaction, onRemoveReaction, onComment }) => {
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const { api } = useApi();

  const getActivityMessage = useCallback(() => {
    const { activity_type, user, habit, metadata } = activity;
    const userName = user?.username || 'Usuário';
    const habitName = habit?.name || 'hábito';

    switch (activity_type) {
      case 'habit_completed':
        return `${userName} completou o hábito "${habitName}"`;
      case 'goal_achieved':
        return `${userName} alcançou a meta do hábito "${habitName}"`;
      case 'streak_milestone':
        const days = metadata?.streak_count || 0;
        return `${userName} mantém uma sequência de ${days} dias em "${habitName}"`;
      case 'habit_created':
        return `${userName} criou um novo hábito: "${habitName}"`;
      case 'level_up':
        const level = metadata?.level || 0;
        return `${userName} subiu para o nível ${level}!`;
      default:
        return `${userName} teve uma atividade em "${habitName}"`;
    }
  }, [activity]);

  const getActivityIcon = useCallback(() => {
    const { activity_type } = activity;
    
    switch (activity_type) {
      case 'habit_completed':
        return '✅';
      case 'goal_achieved':
        return '🎯';
      case 'streak_milestone':
        return '🔥';
      case 'habit_created':
        return '🆕';
      case 'level_up':
        return '⬆️';
      default:
        return '📋';
    }
  }, [activity]);

  const getActivityColor = useCallback(() => {
    const { activity_type } = activity;
    
    switch (activity_type) {
      case 'habit_completed':
        return 'bg-green-50 border-green-200';
      case 'goal_achieved':
        return 'bg-yellow-50 border-yellow-200';
      case 'streak_milestone':
        return 'bg-orange-50 border-orange-200';
      case 'habit_created':
        return 'bg-blue-50 border-blue-200';
      case 'level_up':
        return 'bg-purple-50 border-purple-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  }, [activity]);

  const handleReactionClick = (reactionType) => {
    if (activity.user_reaction === reactionType) {
      onRemoveReaction(activity.id);
    } else {
      onReaction(activity.id, reactionType);
    }
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (newComment.trim()) {
      try {
        const newCommentObj = await onComment(activity.id, newComment.trim());
        if (newCommentObj) {
          setComments(prev => [...prev, newCommentObj]);
        }
        setNewComment('');
      } catch (err) {
        console.error('Erro ao enviar comentário:', err);
      }
    }
  };

  const loadComments = async () => {
    setLoadingComments(true);
    try {
      const response = await api.getActivityComments(activity.id);
      setComments(response || []);
    } catch (err) {
      console.error('Erro ao carregar comentários:', err);
    } finally {
      setLoadingComments(false);
    }
  };

  const toggleComments = () => {
    if (!showComments && comments.length === 0) {
      loadComments();
    }
    setShowComments(!showComments);
  };

  const timeAgo = formatDistanceToNow(new Date(activity.created_at), { 
    addSuffix: true,
    locale: ptBR 
  });

  return (
    <div className={`bg-white rounded-lg shadow-sm border p-6 ${getActivityColor()}`}>
      {/* Header */}
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
            <span className="text-lg">{getActivityIcon()}</span>
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-900 font-medium">{getActivityMessage()}</p>
              <p className="text-gray-500 text-sm">{timeAgo}</p>
            </div>
            
            {activity.habit && (
              <div className="flex items-center text-gray-500">
                <span className="text-lg mr-2">{activity.habit.icon || '🎯'}</span>
              </div>
            )}
          </div>

          {/* Metadata adicional */}
          {activity.metadata && Object.keys(activity.metadata).length > 0 && (
            <div className="mt-3 text-sm text-gray-600">
              {activity.metadata.streak_count && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-800 mr-2">
                  🔥 {activity.metadata.streak_count} dias
                </span>
              )}
              {activity.metadata.level && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-purple-100 text-purple-800">
                  ⭐ Nível {activity.metadata.level}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Reactions */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1">
            {['like', 'celebrate', 'support', 'wow'].map((reactionType) => (
              <button
                key={reactionType}
                onClick={() => handleReactionClick(reactionType)}
                className={`p-2 rounded-lg transition-colors ${
                  activity.user_reaction === reactionType
                    ? 'bg-blue-100 text-blue-600'
                    : 'hover:bg-gray-100 text-gray-600'
                }`}
                title={reactionType}
              >
                <span className="text-lg">
                  {reactionType === 'like' && '👍'}
                  {reactionType === 'celebrate' && '🎉'}
                  {reactionType === 'support' && '💪'}
                  {reactionType === 'wow' && '😲'}
                </span>
                <span className="text-xs ml-1">
                  {activity.reaction_count?.[reactionType] || 0}
                </span>
              </button>
            ))}
          </div>

          <button
            onClick={toggleComments}
            className="text-gray-500 hover:text-gray-700 text-sm flex items-center"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {activity.comment_count || 0} comentários
          </button>
        </div>

        {/* Comments Section */}
        {showComments && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            {/* Comment Form */}
            <form onSubmit={handleCommentSubmit} className="mb-4">
              <div className="flex space-x-3">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Escreva um comentário..."
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  type="submit"
                  disabled={!newComment.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  Enviar
                </button>
              </div>
            </form>

            {/* Comments List */}
            {loadingComments ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            ) : (
              <div className="space-y-3">
                {comments.map((comment) => (
                  <div key={comment.id} className="flex space-x-3">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                        <span className="text-sm">👤</span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="bg-gray-100 rounded-lg px-3 py-2">
                        <p className="font-medium text-sm">{comment.user?.username}</p>
                        <p className="text-gray-700">{comment.comment}</p>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatDistanceToNow(new Date(comment.created_at), { 
                          addSuffix: true,
                          locale: ptBR 
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityCard;
