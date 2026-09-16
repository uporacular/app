/**
 * GeminiConnector.gs — FROTA-20: Gemini API with Validation
 * Faz a conexão primária do ecossistema Google Apps Script para a API Gemini.
 * 
 * Melhorias v2.0 (2026-08-25):
 * - Validação de tamanho de prompt (limites da API)
 * - Validação estrutural de resposta JSON
 * - Circuit breaker integrado
 * - Retry logic consolidado com ErrorHandler
 * - Métricas de uso e latência
 */

var GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models/';

// Limites da API Gemini (tokens aproximados: 1 token ≈ 4 chars)
var GEMINI_LIMITS = {
  'gemini-1.5-flash': { maxInputChars: 1000000, maxOutputTokens: 8192 },
  'gemini-1.5-pro': { maxInputChars: 2000000, maxOutputTokens: 8192 },
  'gemini-pro': { maxInputChars: 30000, maxOutputTokens: 2048 }
};

var GEMINI_SERVICE_NAME = 'gemini-api';

// FROTA-07: modelo lido da property do script, nunca hardcoded; cai no padrão local.
function oracularModel_() {
  return safeCall(function() {
    return PropertiesService.getScriptProperties().getProperty('GEMINI_MODEL') || 'gemini-1.5-flash';
  }, 'oracularModel_', { 
    useStandardReturn: false,
    logLevel: 'info'
  }) || 'gemini-1.5-flash';
}

/**
 * Chamada para a API Gemini com validação completa.
 * @param {string} promptText
 * @return {string|null} Resposta de texto natural gerada pela IA, ou null se falhar.
 */
function fetchGeminiRecommendation(promptText) {
  return safeCallWithRetry(function() {
    // Validação de configuração
    var apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
    if (!apiKey) {
      throw new ConfigurationError('GEMINI_API_KEY não configurada', 'GEMINI_API_KEY');
    }
    
    var model = oracularModel_();
    
    // Validação de tamanho do prompt
    var limits = GEMINI_LIMITS[model] || GEMINI_LIMITS['gemini-1.5-flash'];
    if (promptText.length > limits.maxInputChars) {
      throw new ValidationError(
        'Prompt excede limite de ' + limits.maxInputChars + ' caracteres para modelo ' + model,
        'promptText',
        promptText.length + ' chars'
      );
    }
    
    // FROTA-05: bloqueio de rate limit / quota antes de atingir o provedor
    if (typeof AiRateLimitService !== 'undefined') {
      var _rl = AiRateLimitService.check('oracularRecommendation', promptText);
      if (_rl && _rl.dedupHit && _rl.cached) return _rl.cached;
    }
    
    var startTime = Date.now();
    
    // Prepara payload validado
    var payload = {
      contents: [{ parts: [{ text: promptText }] }],
      generationConfig: {
        temperature: 0.75,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: limits.maxOutputTokens
      }
    };
    
    var options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
    // Usa circuit breaker para proteger contra falhas cascata
    var generated = withCircuitBreaker(GEMINI_SERVICE_NAME, function() {
      var url = GEMINI_API_BASE_URL + model + ':generateContent?key=' + apiKey;
      var response = UrlFetchApp.fetch(url, options);
      var json = JSON.parse(response.getContentText());
      var duration = Date.now() - startTime;

      // Erros HTTP precisam ser lançados dentro do breaker; com
      // muteHttpExceptions o UrlFetchApp devolve a resposta normalmente.
      if (json.error) {
        _oracularAudit_(model, startTime, 'fail', String(json.error.message).slice(0, 60));
        if (json.error.code === 429) {
          throw new RateLimitError('Rate limit do Gemini atingido', 60000);
        } else if (json.error.code >= 500) {
          throw new NetworkError('Erro no servidor Gemini: ' + json.error.message, GEMINI_API_BASE_URL, json.error.code);
        }
        throw new Error('Erro GEMINI: ' + json.error.message);
      }

      if (!GeminiConnector_validateResponse_(json)) {
        _oracularAudit_(model, startTime, 'fail', 'INVALID_RESPONSE_STRUCTURE');
        throw new Error('Resposta do Gemini com estrutura invalida');
      }

      return {
        text: json.candidates[0].content.parts[0].text,
        duration: duration
      };
    }, {
      failureThreshold: 5,
      resetTimeoutMs: 120000 // 2 minutos
    });
    
    // FROTA-06: auditoria com métricas
    _oracularAudit_(model, startTime, 'ok', '', {
      duration: generated.duration,
      promptLength: promptText.length,
      responseLength: generated.text.length
    });
    
    return generated.text;
    
  }, 'fetchGeminiRecommendation', {
    maxRetries: 3,
    initialDelayMs: 1000,
    useStandardReturn: false
  });
}

/**
 * Valida estrutura da resposta do Gemini.
 * @private
 */
function GeminiConnector_validateResponse_(json) {
  if (!json || typeof json !== 'object') return false;
  if (!Array.isArray(json.candidates)) return false;
  if (json.candidates.length === 0) return false;
  
  var candidate = json.candidates[0];
  if (!candidate.content || typeof candidate.content !== 'object') return false;
  if (!Array.isArray(candidate.content.parts)) return false;
  if (candidate.content.parts.length === 0) return false;
  if (!candidate.content.parts[0].text) return false;
  
  return true;
}

/**
 * FROTA-06: registra metadados técnicos da geração no log de auditoria da frota.
 * @private
 */
function _oracularAudit_(model, startMs, status, errorCode, metrics) {
  try {
    var payload = {
      useCase: 'oracularRecommendation',
      model: model,
      durationMs: Date.now() - startMs,
      status: status,
      fallback: status === 'fallback',
      errorCode: errorCode || ''
    };
    
    // Adiciona métricas se fornecidas
    if (metrics) {
      payload.metrics = metrics;
    }
    
    if (typeof AiAuditLogService !== 'undefined') {
      AiAuditLogService.record(payload);
    } else if (typeof LoggerService !== 'undefined') {
      LoggerService.info('GeminiConnector: auditoria', payload);
    }
  } catch (ignored) {
    // Falha em auditoria não deve bloquear operação
  }
}

/**
 * Retorna estatísticas de uso do Gemini via circuit breaker.
 * @return {{ state: string, failures: number, lastFailure: number|null }}
 */
function getGeminiServiceStatus() {
  return getCircuitBreakerStatus(GEMINI_SERVICE_NAME);
}

/**
 * Reseta manualmente o circuit breaker do Gemini.
 * Útil para recuperação após manutenção planejada.
 */
function resetGeminiCircuitBreaker() {
  resetCircuitBreaker(GEMINI_SERVICE_NAME);
  if (typeof LoggerService !== 'undefined') {
    LoggerService.info('GeminiConnector: circuit breaker resetado manualmente');
  }
}

/**
 * Abstração amigável de integração: formata o prompt de curadoria.
 * Utilizado por TrailRecommender.gs ou AIAnalyzer.gs.
 * 
 * @param {string} summary Resumo do histórico do usuário.
 * @param {string} directive O tom curatorial do projeto UpOracular escolhido.
 * @return {string} A análise de trilha interdisciplinar retornada.
 */
function askOracularGemini(summary, directive, works) {
  try {
    try {
      var built = PromptContextBuilder.build('recommendation', {
        summary: summary,
        directive: directive,
        works: (works || []).map(function(item) {
          return {
            title: String(item.obra || item.titulo || '').trim().slice(0, 180),
            author: String(item.autor || item.author || '').trim().slice(0, 120),
            subjects: String(item.assuntos || item.subjects || item.categoria || '').trim().slice(0, 300)
          };
        }),
        authors: (works || []).map(function(item) {
          return String(item.autor || item.author || '').trim().slice(0, 120);
        }).filter(Boolean)
      });
      PromptContextBuilder.logAudit('recommendation', built.droppedKeys);

      var sysPrompt = "Você é o Oráculo Literário (UpOracular) focado em educação interdisciplinar criativa.\n";
      sysPrompt += "Use título E AUTOR para desambiguar cada obra ao pesquisar relações literárias na internet.\n";
      sysPrompt += "Não atribua trama, gênero ou autoria sem confirmação; sinalize homônimos e incertezas.\n";
      sysPrompt += "CONTEXTO BIBLIOGRÁFICO: " + JSON.stringify(built.context) + "\n\n";
      sysPrompt += "Forneça 2 conexões com tramas semelhantes ou transposições interdisciplinares. ";
      sysPrompt += "Para cada conexão, cite obra, autor, disciplina relacionada e justificativa pedagógica breve.";
  
      return fetchGeminiRecommendation(sysPrompt);
    } catch (error) {
      Logger.log("Erro em askOracularGemini: " + error.message);
      throw error;
    }
  } catch (error) {
    Logger.log("Erro em askOracularGemini: " + error.message);
    throw error;
  }
}
