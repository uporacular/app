/**
 * ErrorHandler.gs — FROTA-14: Error Handling Maturo
 * Módulo expandido para tratamento, captura e registro de erros do sistema.
 * 
 * Funcionalidades:
 * - Categorização de erros (Validation, Auth, Network, Internal, etc)
 * - Wrapper safeCall para substituir try-catch duplicados
 * - Retry logic com backoff exponencial
 * - Circuit breaker para serviços externos
 * - Sanitização automática de segredos em logs
 * - Integração com StandardReturn e ApiError
 *
 * Autor: Oracular
 * Data de criação: 2026-04-02
 * Última atualização: 2026-08-25 (Maturidade v2.0)
 */

// ── Categorias de Erro ────────────────────────────────────────────────────────

var ErrorCategory = {
  VALIDATION: 'VALIDATION',
  AUTHENTICATION: 'AUTHENTICATION',
  AUTHORIZATION: 'AUTHORIZATION',
  NOT_FOUND: 'NOT_FOUND',
  NETWORK: 'NETWORK',
  RATE_LIMIT: 'RATE_LIMIT',
  EXTERNAL_SERVICE: 'EXTERNAL_SERVICE',
  INTERNAL: 'INTERNAL',
  CONFIGURATION: 'CONFIGURATION'
};

var TRANSIENT_CATEGORIES = [
  ErrorCategory.NETWORK,
  ErrorCategory.RATE_LIMIT,
  ErrorCategory.EXTERNAL_SERVICE
];

// ── Circuit Breaker State ─────────────────────────────────────────────────────

var CircuitState = {
  CLOSED: 'CLOSED',       // Normal operation
  OPEN: 'OPEN',           // Failures exceeded, blocking calls
  HALF_OPEN: 'HALF_OPEN'  // Testing if service recovered
};

var circuitBreakers_ = {}; // cache local; estado oficial fica em ScriptProperties
var CIRCUIT_BREAKER_PROPERTY_PREFIX_ = 'UP_ORACULAR_CB_';

// ── Typed Errors ──────────────────────────────────────────────────────────────

function ValidationError(message, field, value) {
  this.name = 'ValidationError';
  this.message = message || 'Erro de validação';
  this.category = ErrorCategory.VALIDATION;
  this.field = field;
  this.value = value;
  this.isValidationError = true;
  if (Error.captureStackTrace) Error.captureStackTrace(this, ValidationError);
}
ValidationError.prototype = Object.create(Error.prototype);

function AuthenticationError(message) {
  this.name = 'AuthenticationError';
  this.message = message || 'Falha de autenticação';
  this.category = ErrorCategory.AUTHENTICATION;
  this.isAuthError = true;
  if (Error.captureStackTrace) Error.captureStackTrace(this, AuthenticationError);
}
AuthenticationError.prototype = Object.create(Error.prototype);

function AuthorizationError(message, requiredPermission) {
  this.name = 'AuthorizationError';
  this.message = message || 'Permissão insuficiente';
  this.category = ErrorCategory.AUTHORIZATION;
  this.requiredPermission = requiredPermission;
  this.isAuthError = true;
  if (Error.captureStackTrace) Error.captureStackTrace(this, AuthorizationError);
}
AuthorizationError.prototype = Object.create(Error.prototype);

function NetworkError(message, url, statusCode) {
  this.name = 'NetworkError';
  this.message = message || 'Erro de rede';
  this.category = ErrorCategory.NETWORK;
  this.url = url;
  this.statusCode = statusCode;
  this.isNetworkError = true;
  if (Error.captureStackTrace) Error.captureStackTrace(this, NetworkError);
}
NetworkError.prototype = Object.create(Error.prototype);

function RateLimitError(message, retryAfterMs) {
  this.name = 'RateLimitError';
  this.message = message || 'Limite de requisições excedido';
  this.category = ErrorCategory.RATE_LIMIT;
  this.retryAfterMs = retryAfterMs;
  this.isRateLimitError = true;
  if (Error.captureStackTrace) Error.captureStackTrace(this, RateLimitError);
}
RateLimitError.prototype = Object.create(Error.prototype);

function ConfigurationError(message, missingKey) {
  this.name = 'ConfigurationError';
  this.message = message || 'Configuração inválida ou ausente';
  this.category = ErrorCategory.CONFIGURATION;
  this.missingKey = missingKey;
  this.isConfigError = true;
  if (Error.captureStackTrace) Error.captureStackTrace(this, ConfigurationError);
}
ConfigurationError.prototype = Object.create(Error.prototype);

// ── Error Categorization ──────────────────────────────────────────────────────

function categorizeError(error) {
  if (!error) return ErrorCategory.INTERNAL;
  if (error.category) return error.category;
  if (error.isValidationError) return ErrorCategory.VALIDATION;
  if (error.isAuthError) return error.category || ErrorCategory.AUTHENTICATION;
  if (error.isNetworkError) return ErrorCategory.NETWORK;
  if (error.isRateLimitError) return ErrorCategory.RATE_LIMIT;
  if (error.isConfigError) return ErrorCategory.CONFIGURATION;
  
  var msg = String(error.message || error).toLowerCase();
  if (msg.indexOf('auth') !== -1 || msg.indexOf('login') !== -1 || msg.indexOf('token') !== -1) {
    return ErrorCategory.AUTHENTICATION;
  }
  if (msg.indexOf('permis') !== -1 || msg.indexOf('forbid') !== -1 || msg.indexOf('acesso') !== -1) {
    return ErrorCategory.AUTHORIZATION;
  }
  if (msg.indexOf('not found') !== -1 || msg.indexOf('não encontrad') !== -1) {
    return ErrorCategory.NOT_FOUND;
  }
  if (msg.indexOf('network') !== -1 || msg.indexOf('timeout') !== -1 || msg.indexOf('rede') !== -1) {
    return ErrorCategory.NETWORK;
  }
  if (msg.indexOf('rate limit') !== -1 || msg.indexOf('too many') !== -1 || msg.indexOf('limite') !== -1) {
    return ErrorCategory.RATE_LIMIT;
  }
  if (msg.indexOf('config') !== -1 || msg.indexOf('property') !== -1) {
    return ErrorCategory.CONFIGURATION;
  }
  
  return ErrorCategory.INTERNAL;
}

function isTransientError(error) {
  var category = categorizeError(error);
  return TRANSIENT_CATEGORIES.indexOf(category) !== -1;
}

// ── Safe Call (Substituí try-catch duplicados) ────────────────────────────────

/**
 * Wrapper seguro que substitui blocos try-catch duplicados.
 * Loga erros com LoggerService, sanitiza segredos e retorna StandardReturn.
 * 
 * @param {Function} fn - Função a executar
 * @param {string} context - Nome da função/contexto para logs
 * @param {Object} options - { rethrow: boolean, useStandardReturn: boolean, logLevel: string }
 * @return {*} Resultado de fn() ou StandardReturn envelope
 */
function safeCall(fn, context, options) {
  options = options || {};
  try {
    var result = fn();
    return options.useStandardReturn !== false ? StandardReturn.ok(result) : result;
  } catch (error) {
    var category = categorizeError(error);
    var sanitized = sanitizeError_(error);
    
    // Log com nível apropriado
    var logLevel = options.logLevel || (category === ErrorCategory.INTERNAL ? 'error' : 'warn');
    var logPayload = {
      context: context,
      category: category,
      message: sanitized.message,
      originalError: sanitized.name
    };
    
    if (sanitized.stack && category === ErrorCategory.INTERNAL) {
      logPayload.stack = sanitized.stack.split('\n').slice(0, 5).join('\n');
    }
    
    if (typeof LoggerService !== 'undefined') {
      LoggerService[logLevel](context + ': ' + sanitized.message, logPayload);
    } else {
      Logger.log('[' + logLevel.toUpperCase() + '] ' + context + ': ' + sanitized.message);
    }
    
    // Re-lança se solicitado
    if (options.rethrow) throw error;
    
    // Retorna envelope padronizado
    if (options.useStandardReturn !== false) {
      return StandardReturn.fail(sanitized.message, null, {
        category: category,
        context: context
      });
    }
    
    // Retorna null para compatibilidade legada
    return null;
  }
}

/**
 * Wrapper assíncrono com retry para operações transientes.
 * 
 * @param {Function} fn - Função a executar
 * @param {string} context - Nome da função/contexto
 * @param {Object} options - { maxRetries: number, initialDelayMs: number, rethrow: boolean }
 * @return {*} Resultado de fn() ou StandardReturn
 */
function safeCallWithRetry(fn, context, options) {
  options = options || {};
  var maxRetries = options.maxRetries || 3;
  var delayMs = options.initialDelayMs || 500;
  var lastError;
  
  for (var attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      var result = fn();
      if (attempt > 1 && typeof LoggerService !== 'undefined') {
        LoggerService.info(context + ': sucesso após ' + attempt + ' tentativas');
      }
      return options.useStandardReturn !== false ? StandardReturn.ok(result) : result;
    } catch (error) {
      lastError = error;
      var category = categorizeError(error);
      
      if (!isTransientError(error) || attempt >= maxRetries) {
        // Erro não-transiente ou esgotou tentativas
        return safeCall(function() { throw error; }, context, options);
      }
      
      // Aguarda com backoff exponencial
      if (typeof LoggerService !== 'undefined') {
        LoggerService.warn(context + ': tentativa ' + attempt + ' falhou, aguardando ' + delayMs + 'ms', {
          category: category,
          error: sanitizeError_(error).message
        });
      }
      
      Utilities.sleep(delayMs);
      delayMs *= 2; // Backoff exponencial
    }
  }
  
  // Nunca deveria chegar aqui, mas por segurança
  return safeCall(function() { throw lastError; }, context, options);
}

// ── Circuit Breaker ───────────────────────────────────────────────────────────

/**
 * Executa função com circuit breaker para proteger contra falhas cascata.
 * 
 * @param {string} serviceName - Nome do serviço externo
 * @param {Function} fn - Função a executar
 * @param {Object} options - { failureThreshold: number, resetTimeoutMs: number }
 * @return {*} Resultado de fn()
 */
function withCircuitBreaker(serviceName, fn, options) {
  options = options || {};
  var failureThreshold = options.failureThreshold || 5;
  var resetTimeoutMs = options.resetTimeoutMs || 60000; // 1 minuto
  
  var breaker = loadCircuitBreaker_(serviceName) || {
    state: CircuitState.CLOSED,
    failures: 0,
    lastFailure: null,
    lastCheck: null
  };
  
  var now = Date.now();
  
  // Verifica se circuito deve ser testado (HALF_OPEN)
  if (breaker.state === CircuitState.OPEN) {
    if (breaker.lastFailure && (now - breaker.lastFailure) >= resetTimeoutMs) {
      breaker.state = CircuitState.HALF_OPEN;
      breaker.lastCheck = now;
      if (typeof LoggerService !== 'undefined') {
        LoggerService.info('Circuit breaker ' + serviceName + ': HALF_OPEN (testando recuperação)');
      }
    } else {
      throw new Error('Circuit breaker aberto para ' + serviceName + '. Serviço temporariamente indisponível.');
    }
  }
  
  try {
    var result = fn();
    
    // Sucesso: reseta contador ou fecha circuito
    if (breaker.state === CircuitState.HALF_OPEN) {
      breaker.state = CircuitState.CLOSED;
      breaker.failures = 0;
      if (typeof LoggerService !== 'undefined') {
        LoggerService.info('Circuit breaker ' + serviceName + ': CLOSED (serviço recuperado)');
      }
    } else if (breaker.failures > 0) {
      breaker.failures = 0;
    }
    
    saveCircuitBreaker_(serviceName, breaker);
    return result;
  } catch (error) {
    breaker.failures++;
    breaker.lastFailure = now;
    
    if (breaker.failures >= failureThreshold || breaker.state === CircuitState.HALF_OPEN) {
      breaker.state = CircuitState.OPEN;
      if (typeof LoggerService !== 'undefined') {
        LoggerService.error('Circuit breaker ' + serviceName + ': OPEN (limite de falhas atingido)', {
          failures: breaker.failures,
          threshold: failureThreshold
        });
      }
    }
    
    saveCircuitBreaker_(serviceName, breaker);
    throw error;
  }
}

/**
 * Retorna estado atual do circuit breaker.
 * @param {string} serviceName
 * @return {{ state: string, failures: number, lastFailure: number|null }}
 */
function getCircuitBreakerStatus(serviceName) {
  return loadCircuitBreaker_(serviceName) || {
    state: CircuitState.CLOSED,
    failures: 0,
    lastFailure: null
  };
}

/**
 * Reseta manualmente um circuit breaker.
 * @param {string} serviceName
 */
function resetCircuitBreaker(serviceName) {
  var breaker = {
    state: CircuitState.CLOSED,
    failures: 0,
    lastFailure: null,
    lastCheck: null
  };
  circuitBreakers_[serviceName] = breaker;
  saveCircuitBreaker_(serviceName, breaker);
  if (typeof LoggerService !== 'undefined') {
    LoggerService.info('Circuit breaker ' + serviceName + ': resetado manualmente');
  }
}

function circuitBreakerPropertyKey_(serviceName) {
  return CIRCUIT_BREAKER_PROPERTY_PREFIX_ + String(serviceName || 'default').replace(/[^A-Za-z0-9_]/g, '_');
}

function loadCircuitBreaker_(serviceName) {
  try {
    var raw = PropertiesService.getScriptProperties().getProperty(circuitBreakerPropertyKey_(serviceName));
    if (raw) {
      var parsed = JSON.parse(raw);
      circuitBreakers_[serviceName] = parsed;
      return parsed;
    }
  } catch (ignored) {}
  return circuitBreakers_[serviceName] || null;
}

function saveCircuitBreaker_(serviceName, breaker) {
  circuitBreakers_[serviceName] = breaker;
  try {
    PropertiesService.getScriptProperties().setProperty(
      circuitBreakerPropertyKey_(serviceName),
      JSON.stringify(breaker)
    );
  } catch (ignored) {}
}

// ── Error Sanitization ────────────────────────────────────────────────────────

var SECRET_PATTERNS = [
  /api[_-]?key[:\s=]+[\w-]+/gi,
  /authorization[:\s]+bearer\s+[\w.-]+/gi,
  /password[:\s=]+\S+/gi,
  /senha[:\s=]+\S+/gi,
  /token[:\s=]+[\w.-]+/gi,
  /secret[:\s=]+\S+/gi,
  /[a-z0-9]{32,}/gi  // Hashes longos que podem ser tokens
];

function sanitizeError_(error) {
  var sanitized = {
    name: error.name || 'Error',
    message: String(error.message || error),
    stack: error.stack || null
  };
  
  // Remove segredos da mensagem
  SECRET_PATTERNS.forEach(function(pattern) {
    sanitized.message = sanitized.message.replace(pattern, '[REDACTED]');
  });
  
  // Remove detalhes internos do GAS
  sanitized.message = sanitized.message.replace(
    /\bat\s+\S+\s*\([^)]*\)/g,
    '[internal]'
  );
  
  return sanitized;
}

// ── Legacy Compatibility ──────────────────────────────────────────────────────

/**
 * Registra um erro no log do projeto e no cache (mantido para compatibilidade).
 * @deprecated Use safeCall() em vez disso
 * @param {string} message
 * @param {Object} context
 */
function logError(message, context) {
  context = context || {};
  var errorDetails = {
    timestamp: new Date().toISOString(),
    message: message,
    context: context
  };
  
  if (typeof LoggerService !== 'undefined') {
    LoggerService.error('ERRO [' + errorDetails.timestamp + ']: ' + errorDetails.message, context);
  } else {
    Logger.log('ERRO [' + errorDetails.timestamp + ']: ' + errorDetails.message);
  }
  
  // Mantém cache de erros recentes
  try {
    var cache = CacheService.getScriptCache();
    if (cache) {
      var recentErrors = [];
      try {
        recentErrors = JSON.parse(cache.get('RECENT_ERRORS') || '[]');
      } catch(e) {}
      recentErrors.push(errorDetails);
      if (recentErrors.length > 50) recentErrors.shift();
      cache.put('RECENT_ERRORS', JSON.stringify(recentErrors), 21600);
    }
  } catch (ignored) {}
}

/**
 * Tenta executar uma função e captura erros (mantido para compatibilidade).
 * @deprecated Use safeCall() em vez disso
 * @param {Function} fn
 * @param {Object} context
 * @return {Object} { success: boolean, result: any, error: string }
 */
function tryCatch(fn, context) {
  try {
    return { success: true, result: fn(), error: null };
  } catch (e) {
    logError(e.message, context);
    return { success: false, result: null, error: e.message };
  }
}

/**
 * Retorna erros recentes do cache.
 * @return {Array<Object>}
 */
function getRecentErrors() {
  try {
    var cache = CacheService.getScriptCache();
    if (!cache) return [];
    var errors = cache.get('RECENT_ERRORS');
    return errors ? JSON.parse(errors) : [];
  } catch (e) {
    return [];
  }
}
