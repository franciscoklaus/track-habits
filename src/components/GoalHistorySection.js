import React, { useState } from 'react';

const GoalHistorySection = ({ habitId, goalCompletions, isExpanded, onToggle }) => {
  const [showAll, setShowAll] = useState(false);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getGoalTypeLabel = (goalType) => {
    switch (goalType) {
      case 'count': return 'Diária';
      case 'weekly': return 'Semanal';
      case 'monthly': return 'Mensal';
      case 'streak': return 'Sequência';
      default: return goalType;
    }
  };

  const getSuccessRate = (actual, target) => {
    return Math.round((actual / target) * 100);
  };

  const displayedCompletions = showAll ? goalCompletions : goalCompletions.slice(0, 5);

  if (!goalCompletions || goalCompletions.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
        <div 
          className="p-6 cursor-pointer hover:bg-gray-50 transition-colors duration-200"
          onClick={onToggle}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Histórico de Metas</h3>
                <p className="text-sm text-gray-500">Suas conquistas e metas completadas</p>
              </div>
            </div>
            <svg 
              className={`w-5 h-5 text-gray-400 transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {isExpanded && (
          <div className="px-6 pb-6">
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h4 className="text-lg font-medium text-gray-900 mb-2">Nenhuma meta completada ainda</h4>
              <p className="text-gray-500 mb-4">
                Complete suas primeiras metas para ver seu histórico de conquistas aqui.
              </p>
              <p className="text-sm text-gray-400">
                💡 Dica: Defina metas realistas e consistentes para manter a motivação!
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
      <div 
        className="p-6 cursor-pointer hover:bg-gray-50 transition-colors duration-200"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Histórico de Metas</h3>
              <p className="text-sm text-gray-500">
                {goalCompletions.length} meta{goalCompletions.length !== 1 ? 's' : ''} completada{goalCompletions.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-2xl">🏆</span>
            <svg 
              className={`w-5 h-5 text-gray-400 transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="px-6 pb-6">
          <div className="space-y-4">
            {displayedCompletions.map((completion, index) => (
              <div 
                key={completion.id} 
                className="p-4 bg-gray-50 rounded-lg border border-gray-200"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                      <span className="text-green-600 font-bold text-sm">#{goalCompletions.length - index}</span>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">
                        Meta {getGoalTypeLabel(completion.goal_type)}
                      </h4>
                      <p className="text-sm text-gray-500">
                        {formatDate(completion.period_start)} - {formatDate(completion.period_end)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-green-600">
                      {completion.actual_count}/{completion.goal_value}
                    </div>
                    <div className="text-sm text-gray-500">
                      {getSuccessRate(completion.actual_count, completion.goal_value)}%
                    </div>
                  </div>
                </div>

                {/* Barra de progresso */}
                <div className="mb-3">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full transition-all duration-300" 
                      style={{ width: `${Math.min(getSuccessRate(completion.actual_count, completion.goal_value), 100)}%` }}
                    ></div>
                  </div>
                </div>

                {completion.notes && (
                  <div className="mt-3 p-3 bg-white rounded-md border border-gray-200">
                    <p className="text-sm text-gray-700 italic">"{completion.notes}"</p>
                  </div>
                )}

                <div className="mt-3 text-xs text-gray-400">
                  Completado em {formatDate(completion.completed_at)}
                </div>
              </div>
            ))}

            {goalCompletions.length > 5 && (
              <div className="text-center pt-4">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAll(!showAll);
                  }}
                  className="text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors duration-200"
                >
                  {showAll ? 'Mostrar menos' : `Ver todas (${goalCompletions.length})`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GoalHistorySection;
