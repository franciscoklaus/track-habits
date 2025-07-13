// components/ActivityCard.js
import React, { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';

const ActivityCard = ({ activity, onReaction, onRemoveReaction, onComment }) => {
  const [showComments, setShowComments] = useState(false);
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return 'agora';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
    return `${Math.floor(diffInSeconds / 86400)}d`;
  };

  const getActivityIcon = (activityType) => {
    switch (activityType) {
      case 'challenge_progress':
        return (
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
      case 'challenge_joined':
        return (
          <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
        );
      case 'goal_achieved':
        return (
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
        );
      case 'habit_completed':
        return (
          <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        );
      default:
        return (
          <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
    }
  };

  const getActivityDescription = () => {
    const metadata = activity.metadata || {};
    
    switch (activity.activity_type) {
      case 'challenge_progress':
        if (activity.challenge) {
          const progressPercent = Math.round((metadata.new_progress / metadata.goal_value) * 100);
          return (
            <div>
              <p>
                <strong>Progresso no desafio "{activity.challenge.name}"</strong>
              </p>
              <p className="text-gray-600 text-sm">
                {metadata.habit_name}: {metadata.new_progress}/{metadata.goal_value} ({progressPercent}%)
              </p>
              {metadata.notes && (
                <p className="text-gray-500 text-sm italic mt-1">"{metadata.notes}"</p>
              )}
            </div>
          );
        }
        break;
      case 'challenge_joined':
        if (activity.challenge) {
          return (
            <div>
              <p>
                <strong>Participou do desafio "{activity.challenge.name}"</strong>
              </p>
              <p className="text-gray-600 text-sm">
                Hábito: {metadata.habit_name}
              </p>
            </div>
          );
        }
        break;
      case 'goal_achieved':
        if (activity.habit) {
          return (
            <div>
              <p>
                <strong>Meta alcançada em "{activity.habit.name}"!</strong>
              </p>
              <p className="text-gray-600 text-sm">
                {metadata.streak_days} dias consecutivos
              </p>
            </div>
          );
        }
        break;
      case 'habit_completed':
        if (activity.habit) {
          return (
            <p>
              <strong>Completou o hábito "{activity.habit.name}"</strong>
            </p>
          );
        }
        break;
      default:
        return <p>Atividade realizada</p>;
    }
    
    return <p>Atividade realizada</p>;
  };

  const handleReaction = (type) => {
    if (activity.user_reaction === type) {
      onRemoveReaction(activity.id);
    } else {
      onReaction(activity.id, type);
    }
  };

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;
    
    try {
      await onComment(activity.id, comment.trim());
      setComment('');
      // Recarregar comentários após adicionar um novo
      if (showComments) {
        await fetchComments();
      }
    } catch (err) {
      console.error('Erro ao comentar:', err);
    }
  };

  const fetchComments = async () => {
    if (!activity.id) return;
    
    try {
      setLoadingComments(true);
      const commentsData = await apiService.getActivityComments(activity.id);
      setComments(Array.isArray(commentsData) ? commentsData : []);
    } catch (err) {
      console.error('Erro ao carregar comentários:', err);
      setComments([]);
    } finally {
      setLoadingComments(false);
    }
  };

  const toggleComments = async () => {
    const newShowComments = !showComments;
    setShowComments(newShowComments);
    
    if (newShowComments && comments.length === 0) {
      await fetchComments();
    }
  };

  const formatCommentTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'agora';
    if (diffInHours < 24) return `${diffInHours}h`;
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d`;
    return date.toLocaleDateString('pt-BR');
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-4">
      {/* Header da atividade */}
      <div className="flex items-start space-x-3">
        {/* Avatar do usuário */}
        <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
          <span className="text-white font-semibold text-sm">
            {activity.user?.username?.charAt(0).toUpperCase() || 'U'}
          </span>
        </div>
        
        <div className="flex-1 min-w-0">
          {/* Nome do usuário e tempo */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <p className="text-sm font-medium text-gray-900">
                {activity.user?.username || 'Usuário'}
              </p>
              {getActivityIcon(activity.activity_type)}
            </div>
            <p className="text-xs text-gray-500">
              {formatTimeAgo(activity.created_at)}
            </p>
          </div>
          
          {/* Descrição da atividade */}
          <div className="mt-2">
            {getActivityDescription()}
          </div>
        </div>
      </div>

      {/* Botões de interação */}
      <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
        <div className="flex items-center space-x-4">
          {/* Curtir */}
          <button
            onClick={() => handleReaction('like')}
            className={`flex items-center space-x-1 px-3 py-1 rounded-full text-sm transition-colors ${
              activity.user_reaction === 'like'
                ? 'bg-blue-100 text-blue-600'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            <svg className="w-4 h-4" fill={activity.user_reaction === 'like' ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            <span>{activity.reaction_count?.like || 0}</span>
          </button>

          {/* Aplaudir */}
          <button
            onClick={() => handleReaction('clap')}
            className={`flex items-center space-x-1 px-3 py-1 rounded-full text-sm transition-colors ${
              activity.user_reaction === 'clap'
                ? 'bg-yellow-100 text-yellow-600'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            <span>👏</span>
            <span>{activity.reaction_count?.clap || 0}</span>
          </button>

          {/* Comentários */}
          <button
            onClick={toggleComments}
            className="flex items-center space-x-1 px-3 py-1 rounded-full text-sm text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.418 8-8 8a9.862 9.862 0 01-4.129-.9L3 20l1.9-5.871A9.862 9.862 0 013 12c0-4.418 4.418-8 8-8s8 3.582 8 8z" />
            </svg>
            <span>{activity.comment_count || 0}</span>
          </button>
        </div>
      </div>

      {/* Seção de comentários */}
      {showComments && (
        <div className="mt-4 border-t border-gray-100 pt-4">
          {/* Form para novo comentário */}
          <form onSubmit={handleSubmitComment} className="flex space-x-3">
            <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
              <span className="text-gray-600 font-semibold text-xs">Eu</span>
            </div>
            <div className="flex-1">
              <input
                type="text"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Escreva um comentário..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              type="submit"
              disabled={!comment.trim()}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Enviar
            </button>
          </form>
          
          {/* Lista de comentários */}
          <div className="mt-4 space-y-3">
            {loadingComments ? (
              <div className="text-center text-gray-500 text-sm py-4">
                Carregando comentários...
              </div>
            ) : comments.length > 0 ? (
              comments.map((commentItem) => (
                <div key={commentItem.id} className="flex space-x-3">
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-semibold text-xs">
                      {commentItem.user?.username?.charAt(0).toUpperCase() || 'U'}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="bg-gray-100 rounded-lg px-3 py-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-900">
                          {commentItem.user?.username || 'Usuário'}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatCommentTime(commentItem.created_at)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">{commentItem.comment}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-gray-500 text-sm py-4">
                Nenhum comentário ainda. Seja o primeiro a comentar!
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivityCard;
