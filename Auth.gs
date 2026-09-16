/**
 * Auth.gs — Adaptador de autenticacao do Up Oracular (FROTA-15: Hardened Auth)
 *
 * Localiza usuarios na aba "Usuarios" e delega sessao e expiracao para o
 * contrato comum AuthStandardService.
 * 
 * Convenção da frota (2026-08-26):
 * - Mantém a senha em texto plano na aba de usuários para suporte supervisionado
 * - Rate limiting contra força bruta (5 tentativas/min por usuário)
 * - Auditoria de tentativas de login (sucesso/falha)
 * - Consolidado em sistema único de sessão (AuthStandardService)
 * - Limpeza automática de sessões expiradas
 */

// ── Rate Limiting ─────────────────────────────────────────────────────────────

var AUTH_RATE_LIMIT_MAX_ATTEMPTS = 5;
var AUTH_RATE_LIMIT_WINDOW_MS = 60000; // 1 minuto
var AUTH_RATE_LIMIT_PROPERTY_PREFIX_ = 'UP_ORACULAR_AUTH_RATE:';
var AUTH_RATE_LIMIT_CACHE_PREFIX_ = 'up_auth_rl:';

/** Resolve a planilha principal via getPlanilhaId() (fallback planilha ativa). */
function Auth_getSpreadsheet_() {
  try {
    if (typeof getPlanilhaId === 'function') {
      var id = getPlanilhaId();
      if (id) return SpreadsheetApp.openById(id);
    }
  } catch (e) {}
  return getBoundSpreadsheet_();
}

/** Le a aba de usuarios e devolve cabecalhos + linhas. */
function Auth_getUsersData_() {
  try {
    var possibleNames = ['Usuarios', 'Users', 'Usuários'];
    var sheet = null;
  
    var ss = Auth_getSpreadsheet_();
    if (!ss) return null;

    for (var i = 0; i < possibleNames.length; i++) {
      sheet = ss.getSheetByName(possibleNames[i]);
      if (sheet) break;
    }
  
    if (!sheet || sheet.getLastRow() < 2) return null;

    var values = sheet.getDataRange().getValues();
    var headers = values[0].map(function (h) { return String(h || '').trim().toLowerCase(); });
    return { sheet: sheet, values: values, headers: headers };
  } catch (error) {
    Logger.log("Erro em Auth_getUsersData_: " + error.message);
    throw error;
  }
}

/** Normaliza a credencial em texto plano sem transformá-la. */
function Auth_normalizarSenha_(valor) {
  return String(valor == null ? '' : valor);
}

/** Localiza um usuario para o AuthStandardService. */
function Auth_findUser_(username) {
  return safeCall(function() {
    var data = Auth_getUsersData_();
    if (!data) return null;

    var u = String(username || '').trim().toLowerCase();
    var headers = data.headers;
    var iUser = headers.indexOf('username');
    var iPass = headers.indexOf('password');
    if (iPass < 0) iPass = headers.indexOf('senha');
    var iRole = headers.indexOf('role');
    var iNome = headers.indexOf('nome');
    var iEmail = headers.indexOf('email');
    var iId = headers.indexOf('id');
    var iStatus = headers.indexOf('status');
    if (iUser < 0 || iPass < 0) return null;

    for (var r = 1; r < data.values.length; r++) {
      var row = data.values[r];
      var rowUser = String(row[iUser] || '').trim().toLowerCase();
      var rowEmail = iEmail >= 0 ? String(row[iEmail] || '').trim().toLowerCase() : '';
      if (rowUser !== u && rowEmail !== u) continue;

      var status = iStatus >= 0 ? String(row[iStatus] || '').trim().toLowerCase() : '';
      var inactiveStatuses = ['inativo', 'inactive', 'desativado', 'disabled', 'false', '0'];
      
      return {
        id: iId >= 0 && row[iId] ? row[iId] : rowUser,
        username: row[iUser],
        name: iNome >= 0 ? row[iNome] : row[iUser],
        email: iEmail >= 0 ? row[iEmail] : '',
        role: iRole >= 0 && row[iRole] ? row[iRole] : 'USER',
        active: iStatus < 0 || inactiveStatuses.indexOf(status) === -1,
        password: Auth_normalizarSenha_(row[iPass])
      };
    }
    return null;
  }, 'Auth_findUser_', { useStandardReturn: false });
}

/** Configura o contrato comum para este projeto. */
function Auth_service_() {
  return AuthStandardService.configure({
    sessionKey: 'UP_ORACULAR_AUTH_SESSION',
    sessionTtlSeconds: 21600,
    adapters: {
      findUser: Auth_findUser_
    }
  });
}

/**
 * Valida credenciais com rate limiting e auditoria.
 * @param {string} username Usuario ou e-mail.
 * @param {string} password Senha.
 * @return {{success:boolean, user?:Object, message?:string}}
 */
function loginWithPassword(username, password) {
  var usernameKey = String(username || '').trim().toLowerCase();
  
  // Validação básica
  if (!usernameKey || !String(password || '')) {
    Auth_auditLogin_(usernameKey, false, 'EMPTY_CREDENTIALS');
    return { success: false, message: 'Informe usuario e senha.' };
  }
  
  // Rate limiting
  if (Auth_isRateLimited_(usernameKey)) {
    Auth_auditLogin_(usernameKey, false, 'RATE_LIMITED');
    return { 
      success: false, 
      message: 'Muitas tentativas de login. Aguarde 1 minuto e tente novamente.' 
    };
  }
  
  // Tenta autenticar
  var result = Auth_service_().login(username, password);
  
  if (result.ok) {
    Auth_resetRateLimit_(usernameKey);
    Auth_auditLogin_(usernameKey, true, 'SUCCESS');
    return { success: true, user: result.user, token: result.token };
  } else {
    Auth_incrementRateLimit_(usernameKey);
    Auth_auditLogin_(usernameKey, false, 'INVALID_CREDENTIALS');
    return { success: false, message: 'Credenciais invalidas.' };
  }
}

// ── Rate Limiting Helpers ─────────────────────────────────────────────────────

function Auth_isRateLimited_(username) {
  var now = Date.now();
  var record = Auth_readRateLimit_(username);
  
  if (!record) return false;
  
  // Reseta janela se expirou
  if (now - record.windowStart >= AUTH_RATE_LIMIT_WINDOW_MS) {
    Auth_deleteRateLimit_(username);
    return false;
  }
  
  return record.count >= AUTH_RATE_LIMIT_MAX_ATTEMPTS;
}

function Auth_incrementRateLimit_(username) {
  var now = Date.now();
  var record = Auth_readRateLimit_(username);
  var lock = null;
  var lockAcquired = false;
  try {
    lock = LockService.getScriptLock();
    lockAcquired = lock.tryLock(1000);
    if (lockAcquired) {
      // Releia dentro do lock para evitar perder incrementos concorrentes.
      record = Auth_readRateLimit_(username);
    }
  } catch (ignored) {}
  
  if (!record || (now - record.windowStart >= AUTH_RATE_LIMIT_WINDOW_MS)) {
    Auth_writeRateLimit_(username, { count: 1, windowStart: now });
  } else {
    record.count++;
    Auth_writeRateLimit_(username, record);
  }
  try { if (lock && lockAcquired) lock.releaseLock(); } catch (ignoredRelease) {}
}

function Auth_resetRateLimit_(username) {
  Auth_deleteRateLimit_(username);
}

function Auth_rateLimitKey_(username) {
  return AUTH_RATE_LIMIT_CACHE_PREFIX_ + Auth_rateLimitIdentity_(username);
}

function Auth_rateLimitPropertyKey_(username) {
  return AUTH_RATE_LIMIT_PROPERTY_PREFIX_ + Auth_rateLimitIdentity_(username);
}

function Auth_rateLimitIdentity_(username) {
  return encodeURIComponent(String(username || '').trim().toLowerCase()).replace(/%/g, '_');
}

function Auth_readRateLimit_(username) {
  var key = Auth_rateLimitKey_(username);
  var cache = null;
  try {
    cache = CacheService.getScriptCache();
    var cached = cache.get(key);
    if (cached) return JSON.parse(cached);
  } catch (ignoredCache) {}

  try {
    var props = PropertiesService.getScriptProperties();
    var record = JSON.parse(props.getProperty(Auth_rateLimitPropertyKey_(username)) || 'null');
    if (record && cache) cache.put(key, JSON.stringify(record), AUTH_RATE_LIMIT_WINDOW_MS / 1000);
    return record;
  } catch (ignoredProperties) {
    return null;
  }
}

function Auth_writeRateLimit_(username, record) {
  var key = Auth_rateLimitKey_(username);
  try { CacheService.getScriptCache().put(key, JSON.stringify(record), AUTH_RATE_LIMIT_WINDOW_MS / 1000); } catch (ignoredCache) {}
  try {
    var props = PropertiesService.getScriptProperties();
    props.setProperty(Auth_rateLimitPropertyKey_(username), JSON.stringify(record));
  } catch (ignoredProperties) {}
}

function Auth_deleteRateLimit_(username) {
  var key = Auth_rateLimitKey_(username);
  try { CacheService.getScriptCache().remove(key); } catch (ignoredCache) {}
  try {
    PropertiesService.getScriptProperties().deleteProperty(Auth_rateLimitPropertyKey_(username));
  } catch (ignoredProperties) {}
}

// ── Auditoria de Login ────────────────────────────────────────────────────────

function Auth_auditLogin_(username, success, reason) {
  try {
    var payload = {
      username: username,
      success: success,
      reason: reason,
      timestamp: new Date().toISOString(),
      userAgent: Session.getActiveUser().getEmail() || 'anonymous'
    };
    
    if (typeof LoggerService !== 'undefined') {
      var level = success ? 'info' : 'warn';
      LoggerService[level]('Auth: ' + (success ? 'Login bem-sucedido' : 'Falha de login'), payload);
    }
    
    // Persiste também na planilha para análise de segurança
    Auth_persistAuditLog_(payload);
  } catch (ignored) {
    // Falha silenciosa em auditoria não deve bloquear login
  }
}

function Auth_persistAuditLog_(payload) {
  try {
    var ss = Auth_getSpreadsheet_();
    if (!ss) return;
    
    var sheet = ss.getSheetByName('AuthAuditLog');
    if (!sheet) {
      sheet = ss.insertSheet('AuthAuditLog');
      sheet.getRange(1, 1, 1, 5).setValues([
        ['Timestamp', 'Username', 'Success', 'Reason', 'UserAgent']
      ]);
      sheet.setFrozenRows(1);
    }
    
    sheet.appendRow([
      payload.timestamp,
      payload.username,
      payload.success ? 'SIM' : 'NÃO',
      payload.reason,
      payload.userAgent
    ]);
    
    // Limita a 1000 registros (mantém últimos 6 meses aprox)
    if (sheet.getLastRow() > 1000) {
      sheet.deleteRow(2);
    }
  } catch (ignored) {}
}

// ---------------------------------------------------------------------------

var AUTH_TOK_TTL_MS_ = 21600 * 1000; // 6 horas

/** Obtem ou cria a aba SessoesAuth para armazenar sessoes. */
function getSessoesAuthSheet_() {
  return safeCall(function() {
    var ss = Auth_getSpreadsheet_();
    if (!ss) return null;
    var sheet = ss.getSheetByName('SessoesAuth');
    if (!sheet) {
      sheet = ss.insertSheet('SessoesAuth');
      sheet.getRange(1, 1, 1, 8).setValues([[
        'token', 'userId', 'username', 'role', 'expiresAt',
        'issuedAt', 'permissions', 'source'
      ]]);
    }
    return sheet;
  }, 'getSessoesAuthSheet_', { useStandardReturn: false });
}

/**
 * Valida credenciais e devolve um token unico para o cliente.
 * Inclui rate limiting e auditoria.
 * @return {{success:boolean, token?:string, redirectUrl?:string, message?:string}}
 */
function loginWithToken(username, password) {
  var usernameKey = String(username || '').trim().toLowerCase();
  
  // Validação básica
  if (!usernameKey || !String(password || '')) {
    Auth_auditLogin_(usernameKey, false, 'EMPTY_CREDENTIALS');
    return { success: false, message: 'Informe usuario e senha.' };
  }
  
  // Rate limiting
  if (Auth_isRateLimited_(usernameKey)) {
    Auth_auditLogin_(usernameKey, false, 'RATE_LIMITED');
    return { 
      success: false, 
      message: 'Muitas tentativas de login. Aguarde 1 minuto e tente novamente.' 
    };
  }
  
  // Tenta autenticar
  var result = Auth_service_().login(username, password);
  
  if (!result.ok) {
    Auth_incrementRateLimit_(usernameKey);
    Auth_auditLogin_(usernameKey, false, 'INVALID_CREDENTIALS');
    return { success: false, message: 'Credenciais invalidas.' };
  }
  
  Auth_resetRateLimit_(usernameKey);
  Auth_auditLogin_(usernameKey, true, 'SUCCESS_TOKEN');

  // O AuthStandardService já persistiu o token em SessoesAuth. Reutilizá-lo
  // evita duas sessões para o mesmo login e mantém um único ciclo de logout.
  var token = result.token;
  if (!token) return { success: false, message: 'Não foi possível criar a sessão.' };

  var baseUrl = '';
  try {
    baseUrl = ScriptApp.getService().getUrl();
  } catch (e) {
    baseUrl = '';
  }

  return {
    success: true,
    token: token,
    redirectUrl: baseUrl ? baseUrl + '?page=app#tok=' + token : ''
  };
}

/**
 * Verifica se o token (parametro 'tok' da URL) corresponde a uma sessao valida.
 * Remove automaticamente sessões expiradas.
 */
function isAuthenticatedByToken(tok) {
  return safeCall(function() {
    if (!tok) return false;
    var sheet = getSessoesAuthSheet_();
    if (!sheet) return false;

    var data = sheet.getDataRange().getValues();
    var now = new Date().getTime();
    
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(tok)) {
        var expiresAt = Number(data[i][4]);
        if (!isFinite(expiresAt) || expiresAt <= now) {
          sheet.deleteRow(i + 1);
          return false;
        }
        return true;
      }
    }
    return false;
  }, 'isAuthenticatedByToken', { useStandardReturn: false });
}

/**
 * Retorna o usuario logado a partir do token.
 * Remove automaticamente sessões expiradas.
 * @param {string} tok
 * @return {{ username: string, role: string }|null}
 */
function getSessionUser(tok) {
  return safeCall(function() {
    if (!tok) return null;
    var sheet = getSessoesAuthSheet_();
    if (!sheet) return null;

    var data = sheet.getDataRange().getValues();
    var now = new Date().getTime();
    
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(tok)) {
        var expiresAt = Number(data[i][4]);
        if (!isFinite(expiresAt) || expiresAt <= now) {
          sheet.deleteRow(i + 1);
          return null;
        }
        return {
          id: data[i][1], userId: data[i][1], username: data[i][2],
          role: data[i][3] || 'USER', expiresAt: expiresAt
        };
      }
    }
    return null;
  }, 'getSessionUser', { useStandardReturn: false });
}

/** Encerra a sessao identificada pelo token. */
function logoutWithToken(tok) {
  return safeCall(function() {
    if (typeof tok !== 'string' || tok.length === 0 || tok.length > 200) return { ok: true };
    var sheet = getSessoesAuthSheet_();
    if (!sheet) return { ok: true };

    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(tok)) {
        sheet.deleteRow(i + 1);
        return { ok: true };
      }
    }
    return { ok: true };
  }, 'logoutWithToken', { useStandardReturn: false });
}

/** Estado de sessao (legado). Mantido para retrocompatibilidade. */
function isUpOracularAuthenticated() {
  return Auth_service_().isAuthenticated();
}

/** Encerra a sessao (legado). */
function logoutUpOracular() {
  return Auth_service_().logout();
}

// ── Manutenção de Sessões ─────────────────────────────────────────────────────

/**
 * Remove todas as sessões expiradas da planilha.
 * Pode ser executado periodicamente via trigger (recomendado: diário).
 * @return {{ removed: number, remaining: number }}
 */
function Auth_cleanupExpiredSessions() {
  return safeCall(function() {
    var sheet = getSessoesAuthSheet_();
    if (!sheet) return { removed: 0, remaining: 0 };
    
    var data = sheet.getDataRange().getValues();
    var now = new Date().getTime();
    var removed = 0;
    
    // Itera de trás para frente para não afetar índices ao deletar
    for (var i = data.length - 1; i >= 1; i--) {
      var expiresAt = Number(data[i][4]);
      if (!isFinite(expiresAt) || expiresAt <= now) {
        sheet.deleteRow(i + 1);
        removed++;
      }
    }
    
    var remaining = sheet.getLastRow() - 1; // -1 para header
    
    if (typeof LoggerService !== 'undefined') {
      LoggerService.info('Auth: limpeza de sessões expiradas', {
        removed: removed,
        remaining: remaining
      });
    }
    
    return { removed: removed, remaining: remaining };
  }, 'Auth_cleanupExpiredSessions', { useStandardReturn: false });
}

/**
 * Compatibilidade para automações antigas: não migra nem remove credenciais.
 * A frota mantém a coluna Password em texto plano por decisão operacional.
 */
function Auth_migrateLegacyPasswords_() {
  return { migrated: 0, message: 'Nenhuma migração executada; a frota preserva Password em texto plano.' };
}
