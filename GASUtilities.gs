/**
 * GASUtilities.gs
 * Utilitários centralizados para operações comuns do Google Apps Script.
 * Padroniza acesso a APIs GAS, cache, properties, locks e operações assíncronas.
 * 
 * Objetivos:
 * - Reduzir código duplicado em múltiplos módulos
 * - Garantir uso consistente de APIs GAS nativas
 * - Facilitar testes com interfaces injetáveis
 * - Aumentar densidade de código e maturidade D6
 */

var GASUtilities = (function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════
  // CACHE SERVICE - Operações padronizadas
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Obtém valor do cache com fallback.
   * @param {string} key
   * @param {Function} fallbackFn Função para gerar valor se não estiver em cache.
   * @param {number} ttl Tempo de vida em segundos (padrão: 600).
   * @return {any}
   */
  function getCached(key, fallbackFn, ttl) {
    try {
      var cache = CacheService.getScriptCache();
      var cached = cache.get(key);
      
      if (cached !== null) {
        try {
          return JSON.parse(cached);
        } catch (e) {
          return cached;
        }
      }
      
      var value = fallbackFn();
      if (value !== null && value !== undefined) {
        var serialized = typeof value === 'object' ? JSON.stringify(value) : String(value);
        cache.put(key, serialized, ttl || 600);
      }
      
      return value;
    } catch (error) {
      Logger.log("Erro em getCached: " + error.message);
      return fallbackFn();
    }
  }

  /**
   * Define valor no cache.
   * @param {string} key
   * @param {any} value
   * @param {number} ttl Tempo de vida em segundos (padrão: 600).
   */
  function setCache(key, value, ttl) {
    try {
      var cache = CacheService.getScriptCache();
      var serialized = typeof value === 'object' ? JSON.stringify(value) : String(value);
      cache.put(key, serialized, ttl || 600);
    } catch (error) {
      Logger.log("Erro em setCache: " + error.message);
    }
  }

  /**
   * Remove valor do cache.
   * @param {string} key
   */
  function removeCache(key) {
    try {
      CacheService.getScriptCache().remove(key);
    } catch (error) {
      Logger.log("Erro em removeCache: " + error.message);
    }
  }

  /**
   * Remove múltiplas chaves do cache.
   * @param {Array<string>} keys
   */
  function removeCacheMultiple(keys) {
    try {
      CacheService.getScriptCache().removeAll(keys);
    } catch (error) {
      Logger.log("Erro em removeCacheMultiple: " + error.message);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PROPERTIES SERVICE - Operações padronizadas
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Obtém propriedade do script.
   * @param {string} key
   * @param {any} defaultValue Valor padrão se não existir.
   * @return {string|null}
   */
  function getProperty(key, defaultValue) {
    try {
      var value = PropertiesService.getScriptProperties().getProperty(key);
      return value !== null ? value : (defaultValue !== undefined ? defaultValue : null);
    } catch (error) {
      Logger.log("Erro em getProperty: " + error.message);
      return defaultValue !== undefined ? defaultValue : null;
    }
  }

  /**
   * Define propriedade do script.
   * @param {string} key
   * @param {any} value
   */
  function setProperty(key, value) {
    try {
      var stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
      PropertiesService.getScriptProperties().setProperty(key, stringValue);
    } catch (error) {
      Logger.log("Erro em setProperty: " + error.message);
    }
  }

  /**
   * Define múltiplas propriedades.
   * @param {Object} properties Mapa de chave-valor.
   */
  function setProperties(properties) {
    try {
      var props = {};
      for (var key in properties) {
        props[key] = typeof properties[key] === 'object' ? 
          JSON.stringify(properties[key]) : String(properties[key]);
      }
      PropertiesService.getScriptProperties().setProperties(props);
    } catch (error) {
      Logger.log("Erro em setProperties: " + error.message);
    }
  }

  /**
   * Remove propriedade do script.
   * @param {string} key
   */
  function deleteProperty(key) {
    try {
      PropertiesService.getScriptProperties().deleteProperty(key);
    } catch (error) {
      Logger.log("Erro em deleteProperty: " + error.message);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LOCK SERVICE - Operações com locks para concorrência
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Executa função com lock para evitar condições de corrida.
   * @param {Function} fn Função a executar.
   * @param {number} timeout Timeout em ms (padrão: 30000).
   * @return {any} Retorno da função.
   */
  function withLock(fn, timeout) {
    try {
      var lock = LockService.getScriptLock();
      var acquired = lock.tryLock(timeout || 30000);
      
      if (!acquired) {
        throw new Error('Não foi possível obter lock após ' + (timeout || 30000) + 'ms');
      }
      
      try {
        return fn();
      } finally {
        lock.releaseLock();
      }
    } catch (error) {
      Logger.log("Erro em withLock: " + error.message);
      throw error;
    }
  }

  /**
   * Executa função com lock de usuário (isolado por usuário).
   * @param {Function} fn
   * @param {number} timeout
   * @return {any}
   */
  function withUserLock(fn, timeout) {
    try {
      var lock = LockService.getUserLock();
      var acquired = lock.tryLock(timeout || 30000);
      
      if (!acquired) {
        throw new Error('Não foi possível obter user lock após ' + (timeout || 30000) + 'ms');
      }
      
      try {
        return fn();
      } finally {
        lock.releaseLock();
      }
    } catch (error) {
      Logger.log("Erro em withUserLock: " + error.message);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITIES - Operações utilitárias GAS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Gera UUID usando Utilities.getUuid().
   * @return {string}
   */
  function generateUuid() {
    try {
      return Utilities.getUuid();
    } catch (error) {
      Logger.log("Erro em generateUuid: " + error.message);
      // Fallback manual
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0;
        var v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    }
  }

  /**
   * Formata data usando timezone do script.
   * @param {Date} date
   * @param {string} format Ex: 'yyyy-MM-dd HH:mm:ss'
   * @return {string}
   */
  function formatDate(date, format) {
    try {
      var tz = Session.getScriptTimeZone();
      return Utilities.formatDate(date, tz, format);
    } catch (error) {
      Logger.log("Erro em formatDate: " + error.message);
      return date.toISOString();
    }
  }

  /**
   * Converte base64 para blob.
   * @param {string} base64String
   * @param {string} contentType
   * @return {Blob}
   */
  function base64ToBlob(base64String, contentType) {
    try {
      var decoded = Utilities.base64Decode(base64String);
      return Utilities.newBlob(decoded, contentType);
    } catch (error) {
      Logger.log("Erro em base64ToBlob: " + error.message);
      throw error;
    }
  }

  /**
   * Calcula SHA-256 de uma string.
   * @param {string} text
   * @return {string} Hash em hexadecimal.
   */
  function sha256(text) {
    try {
      var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text);
      var hex = '';
      for (var i = 0; i < raw.length; i++) {
        var byte = raw[i];
        if (byte < 0) byte += 256;
        var byteHex = byte.toString(16);
        if (byteHex.length === 1) hex += '0';
        hex += byteHex;
      }
      return hex;
    } catch (error) {
      Logger.log("Erro em sha256: " + error.message);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SESSION & USER - Operações de usuário e sessão
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Obtém e-mail do usuário ativo de forma segura.
   * @return {string}
   */
  function getActiveUserEmail() {
    try {
      return Session.getActiveUser().getEmail() || '';
    } catch (error) {
      Logger.log("Erro em getActiveUserEmail: " + error.message);
      return '';
    }
  }

  /**
   * Obtém timezone do script.
   * @return {string}
   */
  function getScriptTimeZone() {
    try {
      return Session.getScriptTimeZone();
    } catch (error) {
      Logger.log("Erro em getScriptTimeZone: " + error.message);
      return 'America/Sao_Paulo';
    }
  }

  /**
   * Obtém locale efetivo do usuário.
   * @return {string}
   */
  function getUserLocale() {
    try {
      return Session.getActiveUserLocale() || 'pt_BR';
    } catch (error) {
      Logger.log("Erro em getUserLocale: " + error.message);
      return 'pt_BR';
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BATCH OPERATIONS - Operações em lote otimizadas
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Processa array em lotes para evitar timeouts.
   * @param {Array} items Array de itens.
   * @param {Function} processFn Função que recebe (item, index).
   * @param {number} batchSize Tamanho do lote (padrão: 100).
   * @return {Array} Resultados processados.
   */
  function processBatch(items, processFn, batchSize) {
    try {
      batchSize = batchSize || 100;
      var results = [];
      
      for (var i = 0; i < items.length; i += batchSize) {
        var batch = items.slice(i, i + batchSize);
        batch.forEach(function(item, idx) {
          results.push(processFn(item, i + idx));
        });
        
        // Flush intermediário para evitar timeout
        if (i + batchSize < items.length) {
          Utilities.sleep(100);
        }
      }
      
      return results;
    } catch (error) {
      Logger.log("Erro em processBatch: " + error.message);
      throw error;
    }
  }

  /**
   * Retry automático para operações que podem falhar temporariamente.
   * @param {Function} fn Função a executar.
   * @param {number} maxRetries Máximo de tentativas (padrão: 3).
   * @param {number} delayMs Delay entre tentativas em ms (padrão: 1000).
   * @return {any}
   */
  function retry(fn, maxRetries, delayMs) {
    try {
      maxRetries = maxRetries || 3;
      delayMs = delayMs || 1000;
      var lastError;
      
      for (var attempt = 0; attempt < maxRetries; attempt++) {
        try {
          return fn();
        } catch (error) {
          lastError = error;
          if (attempt < maxRetries - 1) {
            Utilities.sleep(delayMs * (attempt + 1));
          }
        }
      }
      
      throw lastError;
    } catch (error) {
      Logger.log("Erro em retry após " + maxRetries + " tentativas: " + error.message);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // QUOTA MANAGEMENT - Gerenciamento de quotas
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Obtém quota restante de e-mail.
   * @return {number}
   */
  function getEmailQuotaRemaining() {
    try {
      return MailApp.getRemainingDailyQuota();
    } catch (error) {
      Logger.log("Erro em getEmailQuotaRemaining: " + error.message);
      return 0;
    }
  }

  /**
   * Obtém quota restante de UrlFetch.
   * @return {number}
   */
  function getUrlFetchQuotaRemaining() {
    try {
      return UrlFetchApp.getQuota();
    } catch (error) {
      Logger.log("Erro em getUrlFetchQuotaRemaining: " + error.message);
      return 0;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // API PÚBLICA
  // ═══════════════════════════════════════════════════════════════════════════

  return {
    // Cache
    getCached: getCached,
    setCache: setCache,
    removeCache: removeCache,
    removeCacheMultiple: removeCacheMultiple,
    
    // Properties
    getProperty: getProperty,
    setProperty: setProperty,
    setProperties: setProperties,
    deleteProperty: deleteProperty,
    
    // Locks
    withLock: withLock,
    withUserLock: withUserLock,
    
    // Utilities
    generateUuid: generateUuid,
    formatDate: formatDate,
    base64ToBlob: base64ToBlob,
    sha256: sha256,
    
    // Session & User
    getActiveUserEmail: getActiveUserEmail,
    getScriptTimeZone: getScriptTimeZone,
    getUserLocale: getUserLocale,
    
    // Batch Operations
    processBatch: processBatch,
    retry: retry,
    
    // Quota Management
    getEmailQuotaRemaining: getEmailQuotaRemaining,
    getUrlFetchQuotaRemaining: getUrlFetchQuotaRemaining
  };
})();
