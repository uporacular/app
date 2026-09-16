/**
 * SessionManager.gs
 * Gerenciamento de sessões de usuários via CacheService e PropertiesService.
 * Controla criação, validação, renovação e expiração de sessões.
 */

var SESSION_TTL     = 3600;  // 1 hora em segundos
var SESSION_PREFIX  = 'SID_';
var SESSION_LOG_SHEET = 'SessionLog';

/**
 * Cria uma sessão autenticada para o usuário.
 * Armazena no CacheService (curta duração) e registra em PropertiesService.
 * @param {string} email
 * @return {string} sessionId
 */
function createSession(email) {
  try {
    var sessionId = Utilities.getUuid();
    var cache     = CacheService.getUserCache();
    var payload   = JSON.stringify({ email: email, createdAt: new Date().toISOString() });

    cache.put(SESSION_PREFIX + sessionId, payload, SESSION_TTL);

    // Persistência resiliente via PropertiesService
    var props = PropertiesService.getScriptProperties();
    props.setProperty(SESSION_PREFIX + sessionId, payload);

    _logSessionEvent(email, 'CREATE', sessionId);
    return sessionId;
  } catch (error) {
    Logger.log("Erro em createSession: " + error.message);
    throw error;
  }
}

/**
 * Verifica se a sessão está ativa (cache-first, fallback em Properties).
 * @param {string} sessionId
 * @return {boolean}
 */
function isSessionActive(sessionId) {
  try {
    var cache   = CacheService.getUserCache();
    var payload = cache.get(SESSION_PREFIX + sessionId);
    if (payload) return true;

    // Fallback: verifica PropertiesService
    var props    = PropertiesService.getScriptProperties();
    var persisted = props.getProperty(SESSION_PREFIX + sessionId);
    if (persisted) {
      // Re-hidrata o cache
      cache.put(SESSION_PREFIX + sessionId, persisted, SESSION_TTL);
      return true;
    }
    return false;
  } catch (error) {
    Logger.log("Erro em isSessionActive: " + error.message);
    throw error;
  }
}

/**
 * Obtém o e-mail associado a uma sessão ativa.
 * @param {string} sessionId
 * @return {string|null}
 */
function getSessionEmail(sessionId) {
  try {
    var cache   = CacheService.getUserCache();
    var payload = cache.get(SESSION_PREFIX + sessionId);
    if (!payload) {
      var props = PropertiesService.getScriptProperties();
      payload   = props.getProperty(SESSION_PREFIX + sessionId);
    }
    if (!payload) return null;
    return JSON.parse(payload).email;
  } catch (error) {
    Logger.log("Erro em getSessionEmail: " + error.message);
    throw error;
  }
}

/**
 * Renova a TTL de uma sessão ativa.
 * @param {string} sessionId
 * @return {boolean} true se renovada com sucesso.
 */
function renewSession(sessionId) {
  try {
    try {
      var email = getSessionEmail(sessionId);
      if (!email) return false;

      var cache   = CacheService.getUserCache();
      var payload = JSON.stringify({ email: email, renewedAt: new Date().toISOString() });
      cache.put(SESSION_PREFIX + sessionId, payload, SESSION_TTL);

      var props = PropertiesService.getScriptProperties();
      props.setProperty(SESSION_PREFIX + sessionId, payload);
      return true;
    } catch (error) {
      Logger.log("Erro em renewSession: " + error.message);
      throw error;
    }
  } catch (error) {
    Logger.log("Erro em renewSession: " + error.message);
    throw error;
  }
}

/**
 * Encerra a sessão, removendo do cache e das propriedades.
 * @param {string} sessionId
 * @return {boolean}
 */
function endSession(sessionId) {
  try {
    var email = getSessionEmail(sessionId);

    var cache = CacheService.getUserCache();
    cache.remove(SESSION_PREFIX + sessionId);

    var props = PropertiesService.getScriptProperties();
    props.deleteProperty(SESSION_PREFIX + sessionId);

    if (email) _logSessionEvent(email, 'END', sessionId);
    return true;
  } catch (error) {
    Logger.log("Erro em endSession: " + error.message);
    throw error;
  }
}

/**
 * Registra evento de sessão na sheet SessionLog para auditoria.
 * @param {string} email
 * @param {string} action  'CREATE' | 'END' | 'RENEW'
 * @param {string} sessionId
 */
function _logSessionEvent(email, action, sessionId) {
  try {
    var ss    = getBoundSpreadsheet_();
    var sheet = ss.getSheetByName(SESSION_LOG_SHEET) || ss.insertSheet(SESSION_LOG_SHEET);
    sheet.appendRow([new Date(), email, action, sessionId]);
  } catch (e) {
    // Log silencioso — não interrompe o fluxo principal
  }
}
