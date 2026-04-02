/**
 * AccessController.gs
 * Controle de acesso, permissões e auditoria de segurança do UpOracular.
 * Integra com UserValidator e SessionManager para autorização em múltiplas camadas.
 */

var ACCESS_LOG_SHEET = 'AccessLog';
var PERM_SHEET       = 'Permissoes';
var PERM_CACHE_TTL   = 600; // 10 min

/**
 * Verifica se o usuário tem permissão para um recurso.
 * Primeira consulta no cache, depois na sheet 'Permissoes'.
 * @param {string} email
 * @param {string} recurso   Ex: 'LEITURA_ADMIN', 'RELATORIO_TURMA'
 * @return {boolean}
 */
function hasPermission(email, recurso) {
  if (!email || !recurso) return false;
  var cache    = CacheService.getScriptCache();
  var cacheKey = 'PERM_' + email + '_' + recurso;
  var cached   = cache.get(cacheKey);
  if (cached !== null) return cached === 'true';

  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(PERM_SHEET);
  if (!sheet) {
    cache.put(cacheKey, 'false', PERM_CACHE_TTL);
    return false;
  }

  var data    = sheet.getDataRange().getValues();
  var allowed = false;
  for (var i = 1; i < data.length; i++) {
    var rowEmail   = String(data[i][0]).toLowerCase();
    var rowRecurso = String(data[i][1]);
    if (rowEmail === email.toLowerCase() && rowRecurso === recurso) {
      allowed = true;
      break;
    }
  }
  cache.put(cacheKey, String(allowed), PERM_CACHE_TTL);
  logAccessAttempt(email, recurso, allowed);
  return allowed;
}

/**
 * Verifica permissão por role: admins têm acesso total, demais por sheet.
 * @param {string} email
 * @param {string} recurso
 * @return {boolean}
 */
function hasPermissionByRole(email, recurso) {
  var role = getUserRole(email);
  if (role === 'admin' || role === 'bibliotecario') return true;
  return hasPermission(email, recurso);
}

/**
 * Concede permissão de um recurso a um usuário na sheet Permissoes.
 * @param {string} email
 * @param {string} recurso
 * @param {string} grantedBy  E-mail de quem concedeu.
 */
function grantPermission(email, recurso, grantedBy) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(PERM_SHEET) || ss.insertSheet(PERM_SHEET);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Email', 'Recurso', 'ConcedidoPor', 'ConcedidoEm']);
  }
  sheet.appendRow([email, recurso, grantedBy || 'system', new Date()]);

  // Invalida cache
  CacheService.getScriptCache().remove('PERM_' + email + '_' + recurso);
}

/**
 * Revoga permissão de um recurso para um usuário.
 * Remove a linha correspondente da sheet Permissoes.
 * @param {string} email
 * @param {string} recurso
 * @return {boolean} true se encontrada e removida.
 */
function revokePermission(email, recurso) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(PERM_SHEET);
  if (!sheet) return false;

  var data   = sheet.getDataRange().getValues();
  var removed = false;
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]).toLowerCase() === email.toLowerCase() && String(data[i][1]) === recurso) {
      sheet.deleteRow(i + 1);
      removed = true;
    }
  }
  if (removed) CacheService.getScriptCache().remove('PERM_' + email + '_' + recurso);
  return removed;
}

/**
 * Registra tentativa de acesso (sucesso ou falha) com timestamp.
 * @param {string} email
 * @param {string} recurso
 * @param {boolean} sucesso
 */
function logAccessAttempt(email, recurso, sucesso) {
  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(ACCESS_LOG_SHEET) || ss.insertSheet(ACCESS_LOG_SHEET);
    sheet.appendRow([new Date(), email, recurso, sucesso ? 'SUCESSO' : 'FALHA']);
  } catch (e) { /* falha silenciosa */ }
}

/**
 * Retorna todas as permissões de um usuário.
 * @param {string} email
 * @return {Array<string>} Lista de recursos permitidos.
 */
function getPermissionsForUser(email) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(PERM_SHEET);
  if (!sheet) return [];

  var data  = sheet.getDataRange().getValues();
  var perms = [];
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).toLowerCase() === email.toLowerCase()) {
      perms.push(String(data[i][1]));
    }
  }
  return perms;
}
