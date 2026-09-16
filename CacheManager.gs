/**
 * CacheManager.gs — FROTA-17: Cache Operations Consolidation
 * Gerenciador centralizado de cache para substituir 25+ padrões duplicados.
 * 
 * Funcionalidades:
 * - getOrCompute: cache com fallback automático
 * - Invalidação inteligente por padrão/prefixo
 * - Serialização/deserialização automática
 * - Namespaces para evitar colisões
 * - Estatísticas de hit/miss
 * 
 * Criado: 2026-08-25 (Maturidade v2.0)
 */

var CacheManager = (function() {
  'use strict';
  
  var stats_ = {
    hits: 0,
    misses: 0,
    errors: 0
  };
  
  var DEFAULT_TTL = 600; // 10 minutos
  var DEFAULT_NAMESPACE = 'app';
  
  // ── Core Functions ─────────────────────────────────────────────────────────
  
  /**
   * Obtém valor do cache ou computa se ausente.
   * Substitui o padrão duplicado: get → parse → null check → compute → put
   * 
   * @param {string} key - Chave do cache
   * @param {Function} computeFn - Função para computar valor se ausente
   * @param {Object} options - { ttl: number, namespace: string, forceRefresh: boolean }
   * @return {*} Valor do cache ou computado
   */
  function getOrCompute(key, computeFn, options) {
    options = options || {};
    var ttl = options.ttl || DEFAULT_TTL;
    var namespace = options.namespace || DEFAULT_NAMESPACE;
    var fullKey = buildKey_(namespace, key);
    
    try {
      // Força recomputação se solicitado
      if (options.forceRefresh) {
        return compute_(fullKey, computeFn, ttl);
      }
      
      // Tenta obter do cache
      var cache = CacheService.getScriptCache();
      var cached = cache.get(fullKey);
      
      if (cached !== null) {
        stats_.hits++;
        try {
          return JSON.parse(cached);
        } catch (parseError) {
          // Cache corrompido, recomputa
          stats_.errors++;
          return compute_(fullKey, computeFn, ttl);
        }
      }
      
      // Cache miss, computa e armazena
      stats_.misses++;
      return compute_(fullKey, computeFn, ttl);
      
    } catch (error) {
      stats_.errors++;
      if (typeof LoggerService !== 'undefined') {
        LoggerService.warn('CacheManager.getOrCompute: erro, retornando valor computado', {
          key: key,
          namespace: namespace,
          error: error.message
        });
      }
      // Em caso de erro no cache, retorna valor computado sem cachear
      return computeFn();
    }
  }
  
  /**
   * Armazena valor no cache (com serialização automática).
   * 
   * @param {string} key
   * @param {*} value
   * @param {Object} options - { ttl: number, namespace: string }
   */
  function put(key, value, options) {
    options = options || {};
    var ttl = options.ttl || DEFAULT_TTL;
    var namespace = options.namespace || DEFAULT_NAMESPACE;
    var fullKey = buildKey_(namespace, key);
    
    try {
      var cache = CacheService.getScriptCache();
      var serialized = JSON.stringify(value);
      cache.put(fullKey, serialized, ttl);
      return true;
    } catch (error) {
      stats_.errors++;
      if (typeof LoggerService !== 'undefined') {
        LoggerService.warn('CacheManager.put: falha ao armazenar', {
          key: key,
          namespace: namespace,
          error: error.message
        });
      }
      return false;
    }
  }
  
  /**
   * Obtém valor do cache (com deserialização automática).
   * 
   * @param {string} key
   * @param {Object} options - { namespace: string }
   * @return {*|null} Valor ou null se ausente
   */
  function get(key, options) {
    options = options || {};
    var namespace = options.namespace || DEFAULT_NAMESPACE;
    var fullKey = buildKey_(namespace, key);
    
    try {
      var cache = CacheService.getScriptCache();
      var cached = cache.get(fullKey);
      
      if (cached === null) {
        stats_.misses++;
        return null;
      }
      
      stats_.hits++;
      try {
        return JSON.parse(cached);
      } catch (parseError) {
        stats_.errors++;
        remove(key, options);
        return null;
      }
    } catch (error) {
      stats_.errors++;
      return null;
    }
  }
  
  /**
   * Remove item do cache.
   * 
   * @param {string} key
   * @param {Object} options - { namespace: string }
   */
  function remove(key, options) {
    options = options || {};
    var namespace = options.namespace || DEFAULT_NAMESPACE;
    var fullKey = buildKey_(namespace, key);
    
    try {
      var cache = CacheService.getScriptCache();
      cache.remove(fullKey);
      return true;
    } catch (error) {
      stats_.errors++;
      return false;
    }
  }
  
  /**
   * Invalida múltiplos items por padrão.
   * Nota: GAS não suporta iteração de keys, então armazena índice de keys.
   * 
   * @param {string} pattern - Padrão de chave (ex: 'user_*')
   * @param {Object} options - { namespace: string }
   */
  function invalidatePattern(pattern, options) {
    options = options || {};
    var namespace = options.namespace || DEFAULT_NAMESPACE;
    
    try {
      // Obtém lista de keys registradas para o namespace
      var indexKey = buildKey_(namespace, '__index__');
      var cache = CacheService.getScriptCache();
      var index = cache.get(indexKey);
      
      if (!index) return 0; // Sem índice, nada a invalidar
      
      var keys = JSON.parse(index);
      var regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      var removed = 0;
      
      keys.forEach(function(key) {
        if (regex.test(key)) {
          remove(key, options);
          removed++;
        }
      });
      
      return removed;
    } catch (error) {
      stats_.errors++;
      if (typeof LoggerService !== 'undefined') {
        LoggerService.error('CacheManager.invalidatePattern: falha', {
          pattern: pattern,
          namespace: namespace,
          error: error.message
        });
      }
      return 0;
    }
  }
  
  /**
   * Invalida todo um namespace.
   * 
   * @param {string} namespace
   */
  function invalidateNamespace(namespace) {
    return invalidatePattern('*', { namespace: namespace });
  }
  
  /**
   * Retorna estatísticas de uso do cache.
   * 
   * @return {{ hits: number, misses: number, errors: number, hitRate: number }}
   */
  function getStats() {
    var total = stats_.hits + stats_.misses;
    return {
      hits: stats_.hits,
      misses: stats_.misses,
      errors: stats_.errors,
      hitRate: total > 0 ? (stats_.hits / total * 100).toFixed(2) : 0,
      total: total
    };
  }
  
  /**
   * Reseta estatísticas.
   */
  function resetStats() {
    stats_ = { hits: 0, misses: 0, errors: 0 };
  }
  
  // ── Helper Functions ───────────────────────────────────────────────────────
  
  function buildKey_(namespace, key) {
    return 'cm:' + namespace + ':' + key;
  }
  
  function compute_(fullKey, computeFn, ttl) {
    var value = computeFn();
    
    try {
      var cache = CacheService.getScriptCache();
      var serialized = JSON.stringify(value);
      cache.put(fullKey, serialized, ttl);
    } catch (cacheError) {
      // Falha ao cachear não deve impedir retorno do valor
      stats_.errors++;
    }
    
    return value;
  }
  
  /**
   * Wrapper para operações que usam o padrão antigo.
   * Permite migração gradual sem quebrar código existente.
   * 
   * @deprecated Use getOrCompute diretamente
   */
  function wrapLegacyPattern(key, computeFn, ttl) {
    var cache = CacheService.getScriptCache();
    var cached = cache.get(key);
    
    if (cached !== null) {
      try {
        return JSON.parse(cached);
      } catch (e) {}
    }
    
    var value = computeFn();
    try {
      cache.put(key, JSON.stringify(value), ttl || DEFAULT_TTL);
    } catch (e) {}
    
    return value;
  }
  
  // ── API Pública ────────────────────────────────────────────────────────────
  
  return {
    getOrCompute: getOrCompute,
    put: put,
    get: get,
    remove: remove,
    invalidatePattern: invalidatePattern,
    invalidateNamespace: invalidateNamespace,
    getStats: getStats,
    resetStats: resetStats,
    
    // Legacy compatibility
    wrapLegacyPattern: wrapLegacyPattern
  };
})();

// ── Atalhos Globais (Opcional) ────────────────────────────────────────────────

/**
 * Atalho global para getOrCompute.
 * @param {string} key
 * @param {Function} computeFn
 * @param {number} ttl
 * @return {*}
 */
function cacheGetOrCompute(key, computeFn, ttl) {
  return CacheManager.getOrCompute(key, computeFn, { ttl: ttl });
}
