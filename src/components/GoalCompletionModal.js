import React, { useState } from 'react';

const GoalCompletionModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  goalStatus, 
  habitName 
}) => {
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState('completion'); // 'completion' or 'reset_decision'

  if (!isOpen || !goalStatus) return null;

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      const completionData = {
        goal_type: goalStatus.goal_type,
        goal_value: goalStatus.target_count,
        period_start: goalStatus.period_start,
        period_end: goalStatus.period_end,
        actual_count: goalStatus.actual_count,
        notes: notes
      };
      
      await onConfirm(completionData);
      setStep('reset_decision');
    } catch (error) {
      console.error('Error recording goal completion:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetDecision = (shouldReset) => {
    // Reset all states
    setNotes('');
    setStep('completion');
    
    // Pass the decision to parent component
    onClose(shouldReset);
  };

  const getGoalTypeLabel = (goalType) => {
    switch (goalType) {
      case 'count': return 'diária';
      case 'weekly': return 'semanal';
      case 'monthly': return 'mensal';
      case 'streak': return 'de sequência';
      default: return goalType;
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (step === 'completion') {
          onClose(false);
        }
      }}
    >
      <div 
        className="bg-white rounded-xl shadow-xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          {step === 'completion' ? (
            // Primeira etapa: Registrar a conquista
            <>
              {/* Header com ícone de sucesso */}
              <div className="flex items-center mb-6">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mr-4">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">🎉 Meta Completada!</h3>
                  <p className="text-sm text-gray-500">Parabéns pelo seu progresso!</p>
                </div>
              </div>

              {/* Informações da meta */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-semibold text-gray-900 mb-2">{habitName}</h4>
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span>Meta {getGoalTypeLabel(goalStatus.goal_type)}:</span>
                    <span className="font-medium">{goalStatus.target_count}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Completado:</span>
                    <span className="font-medium text-green-600">{goalStatus.actual_count}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Período:</span>
                    <span className="font-medium">
                      {formatDate(goalStatus.period_start)} - {formatDate(goalStatus.period_end)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Progresso:</span>
                    <span className="font-medium text-green-600">
                      {Math.round((goalStatus.actual_count / goalStatus.target_count) * 100)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Campo de notas */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Observações (opcional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-gray-500 focus:ring-1 focus:ring-gray-500 transition-all duration-200"
                  rows="3"
                  placeholder="Como você se sente com essa conquista? O que funcionou bem?"
                />
              </div>

              {/* Botões */}
              <div className="flex gap-3">
                <button
                  onClick={() => onClose(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-all duration-200"
                  disabled={isSubmitting}
                >
                  Agora Não
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Salvando...
                    </>
                  ) : (
                    'Registrar Conquista'
                  )}
                </button>
              </div>

              {/* Texto informativo */}
              <p className="text-xs text-gray-500 mt-4 text-center">
                Esta conquista será salva no seu histórico de metas.
              </p>
            </>
          ) : (
            // Segunda etapa: Pergunta sobre reset
            <>
              {/* Header de confirmação */}
              <div className="flex items-center mb-6">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">✅ Conquista Registrada!</h3>
                  <p className="text-sm text-gray-500">Que tal começar uma nova meta?</p>
                </div>
              </div>

              {/* Pergunta principal */}
              <div className="mb-6 text-center">
                <h4 className="text-lg font-semibold text-gray-900 mb-3">
                  Deseja zerar e recomeçar a meta para registrar novas atividades?
                </h4>
                <p className="text-sm text-gray-600 mb-4">
                  Se você escolher "Sim", uma nova meta do mesmo tipo será iniciada automaticamente.
                  Se escolher "Não", esta meta permanecerá como completada.
                </p>
                
                {/* Informação sobre a meta atual */}
                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-sm text-green-800">
                    <strong>{habitName}</strong> - Meta {getGoalTypeLabel(goalStatus.goal_type)} de {goalStatus.target_count}
                  </p>
                </div>
              </div>

              {/* Botões de decisão */}
              <div className="flex gap-3">
                <button
                  onClick={() => handleResetDecision(false)}
                  className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-all duration-200 text-center"
                >
                  <div className="text-sm font-semibold">Não</div>
                  <div className="text-xs text-gray-500">Manter como completada</div>
                </button>
                <button
                  onClick={() => handleResetDecision(true)}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-all duration-200 text-center"
                >
                  <div className="text-sm font-semibold">Sim</div>
                  <div className="text-xs text-blue-100">Iniciar nova meta</div>
                </button>
              </div>

              {/* Texto informativo */}
              <p className="text-xs text-gray-500 mt-4 text-center">
                Você pode alterar esta decisão posteriormente nas configurações do hábito.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default GoalCompletionModal;
