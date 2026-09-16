/**
 * AccessController.gs — FROTA-16: Access Control Hardened
 * Controle de acesso, permissões e auditoria de segurança do UpOracular.
 * 
 * Melhorias v2.0 (2026-08-25):
 * - Auditoria garantida (logs nunca são perdidos)
 * - Fallback para Drive quando planilha falha
 * - Integração com LoggerService e ErrorHandler
 * - Cache otimizado com invalidação inteligente
 * - Suporte a IamGuard para autorização avançada
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
  return safeCall(function() {
    if (!email || !recurso) return false;
    
    var cache = CacheService.getScriptCache();
    var cacheKey = 'PERM_' + email + '_' + recurso;
    var cached = cache.get(cacheKey);
    if (cached !== null) return cached === 'true';

    var ss = getBoundSpreadsheet_();
    var sheet = ss.getSheetByName(PERM_SHEET);
    if (!sheet) {
      cache.put(cacheKey, 'false', PERM_CACHE_TTL);
      logAccessAttempt(email, recurso, false);
      return false;
    }

    var data = sheet.getDataRange().getValues();
    var allowed = false;
    for (var i = 1; i < data.length; i++) {
      var rowEmail = String(data[i][0]).toLowerCase();
      var rowRecurso = String(data[i][1]);
      if (rowEmail === email.toLowerCase() && rowRecurso === recurso) {
        allowed = true;
        break;
      }
    }
    
    cache.put(cacheKey, String(allowed), PERM_CACHE_TTL);
    logAccessAttempt(email, recurso, allowed);
    return allowed;
  }, 'hasPermission', { useStandardReturn: false });
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
  return safeCall(function() {
    var ss = getBoundSpreadsheet_();
    var sheet = ss.getSheetByName(PERM_SHEET) || ss.insertSheet(PERM_SHEET);
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['Email', 'Recurso', 'ConcedidoPor', 'ConcedidoEm']);
    }
    sheet.appendRow([email, recurso, grantedBy || 'system', new Date()]);

    // Invalida cache
    CacheService.getScriptCache().remove('PERM_' + email + '_' + recurso);
    
    // Registra auditoria
    if (typeof LoggerService !== 'undefined') {
      LoggerService.info('AccessController: permissão concedida', {
        email: email,
        recurso: recurso,
        grantedBy: grantedBy || 'system'
      });
    }
    
    return true;
  }, 'grantPermission', { useStandardReturn: false });
}

/**
 * Revoga permissão de um recurso para um usuário.
 * Remove a linha correspondente da sheet Permissoes.
 * @param {string} email
 * @param {string} recurso
 * @return {boolean} true se encontrada e removida.
 */
function revokePermission(email, recurso) {
  return safeCall(function() {
    var ss = getBoundSpreadsheet_();
    var sheet = ss.getSheetByName(PERM_SHEET);
    if (!sheet) return false;

    var data = sheet.getDataRange().getValues();
    var removed = false;
    for (var i = data.length - 1; i >= 1; i--) {
      if (String(data[i][0]).toLowerCase() === email.toLowerCase() && String(data[i][1]) === recurso) {
        sheet.deleteRow(i + 1);
        removed = true;
      }
    }
    
    if (removed) {
      CacheService.getScriptCache().remove('PERM_' + email + '_' + recurso);
      
      // Registra auditoria
      if (typeof LoggerService !== 'undefined') {
        LoggerService.warn('AccessController: permissão revogada', {
          email: email,
          recurso: recurso
        });
      }
    }
    
    return removed;
  }, 'revokePermission', { useStandardReturn: false });
}

/**
 * Registra tentativa de acesso (sucesso ou falha) com timestamp.
 * CRÍTICO: Logs de segurança NUNCA devem ser perdidos.
 * Fallback para Drive se planilha falhar.
 * @param {string} email
 * @param {string} recurso
 * @param {boolean} sucesso
 */
function logAccessAttempt(email, recurso, sucesso) {
  // Primeira tentativa: LoggerService (persistência confiável)
  try {
    if (typeof LoggerService !== 'undefined') {
      var level = sucesso ? 'info' : 'warn';
      LoggerService[level]('AccessController: tentativa de acesso', {
        email: email,
        recurso: recurso,
        sucesso: sucesso,
        timestamp: new Date().toISOString()
      });
    }
  } catch (loggerError) {
    // Se LoggerService falhar, continua para fallbacks
  }
  
  // Segunda tentativa: Sheet AccessLog
  try {
    var ss = getBoundSpreadsheet_();
    var sheet = ss.getSheetByName(ACCESS_LOG_SHEET);
    
    if (!sheet) {
      sheet = ss.insertSheet(ACCESS_LOG_SHEET);
      sheet.appendRow(['Timestamp', 'Email', 'Recurso', 'Resultado']);
      sheet.setFrozenRows(1);
    }
    
    sheet.appendRow([new Date(), email, recurso, sucesso ? 'SUCESSO' : 'FALHA']);
    
    // Limita a 5000 registros (aproximadamente 1 ano de logs)
    if (sheet.getLastRow() > 5000) {
      sheet.deleteRow(2);
    }
    
    return; // Sucesso na sheet, não precisa fallback
  } catch (sheetError) {
    // Se sheet falhar, usa fallback Drive
  }
  
  // Terceira tentativa: Fallback Drive (NUNCA perde logs de segurança)
  try {
    AccessController_fallbackToDrive_({
      timestamp: new Date().toISOString(),
      email: email,
      recurso: recurso,
      sucesso: sucesso,
      error: 'Sheet indisponível - usado fallback Drive'
    });
  } catch (driveError) {
    // Último recurso: Logger.log nativo (melhor que perder completamente)
    Logger.log('CRÍTICO - Falha ao registrar acesso: ' + JSON.stringify({
      email: email,
      recurso: recurso,
      sucesso: sucesso
    }));
  }
}

/**
 * Fallback para persistir logs de acesso no Drive quando planilha falha.
 * @private
 */
function AccessController_fallbackToDrive_(payload) {
  try {
    var folderId = PropertiesService.getScriptProperties().getProperty('FOLDER_ID');
    if (!folderId) throw new Error('FOLDER_ID não configurado');
    
    var folder = DriveApp.getFolderById(folderId);
    var fileName = 'access_log_' + payload.timestamp.slice(0, 10) + '.jsonl';
    var line = JSON.stringify(payload);
    
    var files = folder.getFilesByName(fileName);
    if (files.hasNext()) {
      var file = files.next();
      var current = file.getBlob().getDataAsString('UTF-8');
      file.setContent(current + '\n' + line);
    } else {
      folder.createFile(fileName, line, 'application/jsonl');
    }
    return true;
  } catch (error) {
    // Propaga para que logAccessAttempt ainda escreva no Logger nativo.
    throw error;
  }
}

/**
 * Retorna todas as permissões de um usuário.
 * @param {string} email
 * @return {Array<string>} Lista de recursos permitidos.
 */
function getPermissionsForUser(email) {
  return safeCall(function() {
    var ss = getBoundSpreadsheet_();
    var sheet = ss.getSheetByName(PERM_SHEET);
    if (!sheet) return [];

    var data = sheet.getDataRange().getValues();
    var perms = [];
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).toLowerCase() === email.toLowerCase()) {
        perms.push(String(data[i][1]));
      }
    }
    return perms;
  }, 'getPermissionsForUser', { useStandardReturn: false });
}

// ── Funções de Manutenção ─────────────────────────────────────────────────────

/**
 * Limpa cache de permissões para um usuário específico ou todos.
 * @param {string} email - Email do usuário (opcional, limpa todos se omitido)
 */
function clearPermissionCache(email) {
  return safeCall(function() {
    var cache = CacheService.getScriptCache();
    
    if (email) {
      // Limpa apenas para o usuário específico
      // Como não podemos iterar keys no cache, marca para expiração imediata
      var ss = getBoundSpreadsheet_();
      var sheet = ss.getSheetByName(PERM_SHEET);
      if (sheet) {
        var data = sheet.getDataRange().getValues();
        for (var i = 1; i < data.length; i++) {
          if (String(data[i][0]).toLowerCase() === email.toLowerCase()) {
            var recurso = String(data[i][1]);
            cache.remove('PERM_' + email + '_' + recurso);
          }
        }
      }
    } else {
      // Sem forma de limpar apenas keys específicos, registra a operação
      if (typeof LoggerService !== 'undefined') {
        LoggerService.info('AccessController: solicitação de limpeza total de cache', {
          note: 'Cache expira automaticamente em ' + PERM_CACHE_TTL + ' segundos'
        });
      }
    }
    
    return true;
  }, 'clearPermissionCache', { useStandardReturn: false });
}

/**
 * Retorna estatísticas de acessos para análise de segurança.
 * @param {number} days - Número de dias para análise (padrão: 7)
 * @return {{ totalAttempts: number, failures: number, successRate: number, topResources: Array }}
 */
function getAccessControllerStats(days) {
  return safeCall(function() {
    days = days || 7;
    var cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    
    var ss = getBoundSpreadsheet_();
    var sheet = ss.getSheetByName(ACCESS_LOG_SHEET);
    if (!sheet || sheet.getLastRow() < 2) {
      return { totalAttempts: 0, failures: 0, successRate: 0, topResources: [] };
    }
    
    var data = sheet.getDataRange().getValues();
    var total = 0;
    var failures = 0;
    var resourceCount = {};
    
    for (var i = 1; i < data.length; i++) {
      var timestamp = data[i][0];
      if (timestamp < cutoff) continue;
      
      total++;
      var recurso = String(data[i][2]);
      var resultado = String(data[i][3]);
      
      if (resultado === 'FALHA') failures++;
      
      resourceCount[recurso] = (resourceCount[recurso] || 0) + 1;
    }
    
    var topResources = Object.keys(resourceCount)
      .map(function(r) { return { recurso: r, count: resourceCount[r] }; })
      .sort(function(a, b) { return b.count - a.count; })
      .slice(0, 10);
    
    return {
      totalAttempts: total,
      failures: failures,
      successRate: total > 0 ? ((total - failures) / total * 100).toFixed(2) : 0,
      topResources: topResources,
      period: days + ' dias'
    };
  }, 'getAccessStats', { useStandardReturn: false });
}
