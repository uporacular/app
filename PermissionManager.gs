/**
 * PermissionManager.gs
 * Gerenciamento de permissões de acesso com persistência via PropertiesService.
 * Suporta múltiplos papéis (roles): ADMIN, PROFESSOR, ALUNO.
 * Usa Session para verificar o usuário ativo sem hardcode.
 */

var ROLES = { ADMIN: 'ADMIN', PROFESSOR: 'PROFESSOR', ALUNO: 'ALUNO' };
var PROP_KEY_ADMINS = 'PERMISSION_ADMINS';
var PROP_KEY_ROLES  = 'PERMISSION_ROLES';

/**
 * Retorna a lista persistida de administradores.
 * @return {Array<string>}
 */
function getAdmins() {
  try {
    var raw = PropertiesService.getScriptProperties().getProperty(PROP_KEY_ADMINS);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    Logger.log("Erro em getAdmins: " + error.message);
    throw error;
  }
}

/**
 * Define (sobrescreve) a lista de administradores.
 * @param {Array<string>} emails
 */
function setAdmins(emails) {
  try {
    if (!Array.isArray(emails)) return;
    PropertiesService.getScriptProperties().setProperty(
      PROP_KEY_ADMINS, JSON.stringify(emails.map(function(e) { return e.toLowerCase().trim(); }))
    );
  } catch (error) {
    Logger.log("Erro em setAdmins: " + error.message);
    throw error; // Re-lança para tratamento superior
  }
}

/**
 * Verifica se um e-mail tem permissão de administrador.
 * @param {string} email
 * @return {boolean}
 */
function isAdmin(email) {
  if (!email) return false;
  return getAdmins().indexOf(email.toLowerCase().trim()) !== -1;
}

/**
 * Verifica se o usuário atualmente autenticado é administrador.
 * @return {boolean}
 */
function currentUserIsAdmin() {
  try {
    var email = Session.getActiveUser().getEmail();
    return isAdmin(email);
  } catch (error) {
    Logger.log("Erro em currentUserIsAdmin: " + error.message);
    throw error;
  }
}

/**
 * Atribui um papel (role) a um e-mail e persiste.
 * @param {string} email
 * @param {string} role — ROLES.ADMIN | ROLES.PROFESSOR | ROLES.ALUNO
 */
function assignRole(email, role) {
  try {
    if (!email || !ROLES[role]) return;
    var props = PropertiesService.getScriptProperties();
    var rawRoles = props.getProperty(PROP_KEY_ROLES);
    var rolesMap = rawRoles ? JSON.parse(rawRoles) : {};
    rolesMap[email.toLowerCase().trim()] = role;
    props.setProperty(PROP_KEY_ROLES, JSON.stringify(rolesMap));
  } catch (error) {
    Logger.log("Erro em assignRole: " + error.message);
    throw error;
  }
}

/**
 * Retorna o papel do usuário (padrão: ALUNO se não atribuído).
 * @param {string} email
 * @return {string}
 */
function getRole(email) {
  try {
    if (!email) return ROLES.ALUNO;
    if (isAdmin(email)) return ROLES.ADMIN;
    var raw = PropertiesService.getScriptProperties().getProperty(PROP_KEY_ROLES);
    var rolesMap = raw ? JSON.parse(raw) : {};
    return rolesMap[email.toLowerCase().trim()] || ROLES.ALUNO;
  } catch (error) {
    Logger.log("Erro em getRole: " + error.message);
    throw error;
  }
}

/**
 * Verifica se o usuário atual tem acesso a uma funcionalidade pelo nível mínimo exigido.
 * @param {string} requiredRole — nível mínimo requerido (ex: ROLES.PROFESSOR)
 * @return {boolean}
 */
function hasAccess(requiredRole) {
  var hierarchy = [ROLES.ALUNO, ROLES.PROFESSOR, ROLES.ADMIN];
  var email = Session.getActiveUser().getEmail();
  var userRole = getRole(email);
  return hierarchy.indexOf(userRole) >= hierarchy.indexOf(requiredRole);
}

/**
 * Lista todos os usuários com um papel específico.
 * @param {string} role Ex: ROLES.PROFESSOR
 * @return {Array<string>} Array de e-mails.
 */
function getUsersByRole(role) {
  try {
    var raw = PropertiesService.getScriptProperties().getProperty(PROP_KEY_ROLES);
    var rolesMap = raw ? JSON.parse(raw) : {};
    var users = [];
    
    for (var email in rolesMap) {
      if (rolesMap[email] === role) {
        users.push(email);
      }
    }
    
    // Adiciona admins se procurando por ADMIN
    if (role === ROLES.ADMIN) {
      var admins = getAdmins();
      admins.forEach(function(admin) {
        if (users.indexOf(admin) < 0) users.push(admin);
      });
    }
    
    return users;
  } catch (error) {
    Logger.log("Erro em getUsersByRole: " + error.message);
    return [];
  }
}

/**
 * Registra tentativa de acesso negado para auditoria.
 * @param {string} email
 * @param {string} resource Recurso que tentou acessar.
 * @param {string} requiredRole Papel necessário.
 */
function logAccessDenied(email, resource, requiredRole) {
  try {
    var ss = getBoundSpreadsheet_();
    var sheet = ss.getSheetByName('AccessLog') || ss.insertSheet('AccessLog');
    
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['Timestamp', 'Email', 'Resource', 'RequiredRole', 'UserRole', 'Status']);
    }
    
    sheet.appendRow([
      new Date(),
      email,
      resource,
      requiredRole,
      getRole(email),
      'DENIED'
    ]);
  } catch (e) {
    Logger.log("Erro em logAccessDenied: " + e.message);
  }
}

/**
 * Registra acesso bem-sucedido para auditoria.
 * @param {string} email
 * @param {string} resource
 */
function logAccessGranted(email, resource) {
  try {
    var ss = getBoundSpreadsheet_();
    var sheet = ss.getSheetByName('AccessLog') || ss.insertSheet('AccessLog');
    
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['Timestamp', 'Email', 'Resource', 'RequiredRole', 'UserRole', 'Status']);
    }
    
    sheet.appendRow([
      new Date(),
      email,
      resource,
      '',
      getRole(email),
      'GRANTED'
    ]);
  } catch (e) {
    Logger.log("Erro em logAccessGranted: " + e.message);
  }
}

/**
 * Verifica se usuário tem permissão e registra auditoria.
 * @param {string} resource Nome do recurso/funcionalidade.
 * @param {string} requiredRole Papel mínimo necessário.
 * @return {boolean}
 */
function checkAndLogAccess(resource, requiredRole) {
  try {
    var email = Session.getActiveUser().getEmail();
    var hasPermission = hasAccess(requiredRole);
    
    if (hasPermission) {
      logAccessGranted(email, resource);
    } else {
      logAccessDenied(email, resource, requiredRole);
    }
    
    return hasPermission;
  } catch (error) {
    Logger.log("Erro em checkAndLogAccess: " + error.message);
    return false;
  }
}

/**
 * Obtém estatísticas de acesso dos últimos N dias.
 * @param {number} days Padrão: 30
 * @return {Object} {totalAccess, denied, granted, topUsers, topResources}
 */
function getAccessStats(days) {
  try {
    days = days || 30;
    var ss = getBoundSpreadsheet_();
    var sheet = ss.getSheetByName('AccessLog');
    if (!sheet || sheet.getLastRow() <= 1) return {totalAccess: 0, denied: 0, granted: 0};
    
    var data = sheet.getDataRange().getValues();
    var cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    
    var totalAccess = 0;
    var denied = 0;
    var granted = 0;
    var userCounts = {};
    var resourceCounts = {};
    
    for (var i = 1; i < data.length; i++) {
      var date = new Date(data[i][0]);
      if (date < cutoff) continue;
      
      totalAccess++;
      var status = String(data[i][5]);
      if (status === 'DENIED') denied++;
      else if (status === 'GRANTED') granted++;
      
      var user = String(data[i][1]);
      var resource = String(data[i][2]);
      
      userCounts[user] = (userCounts[user] || 0) + 1;
      resourceCounts[resource] = (resourceCounts[resource] || 0) + 1;
    }
    
    // Top 5 usuários
    var topUsers = [];
    for (var u in userCounts) {
      topUsers.push({email: u, count: userCounts[u]});
    }
    topUsers.sort(function(a, b) { return b.count - a.count; });
    topUsers = topUsers.slice(0, 5);
    
    // Top 5 recursos
    var topResources = [];
    for (var r in resourceCounts) {
      topResources.push({resource: r, count: resourceCounts[r]});
    }
    topResources.sort(function(a, b) { return b.count - a.count; });
    topResources = topResources.slice(0, 5);
    
    return {
      totalAccess: totalAccess,
      denied: denied,
      granted: granted,
      denialRate: totalAccess > 0 ? Math.round((denied / totalAccess) * 100) : 0,
      topUsers: topUsers,
      topResources: topResources
    };
  } catch (error) {
    Logger.log("Erro em getAccessStats: " + error.message);
    return {totalAccess: 0, denied: 0, granted: 0, denialRate: 0};
  }
}

/**
 * Remove papel de um usuário (volta para ALUNO padrão).
 * @param {string} email
 */
function removeRole(email) {
  try {
    if (!email) return;
    var props = PropertiesService.getScriptProperties();
    var raw = props.getProperty(PROP_KEY_ROLES);
    var rolesMap = raw ? JSON.parse(raw) : {};
    delete rolesMap[email.toLowerCase().trim()];
    props.setProperty(PROP_KEY_ROLES, JSON.stringify(rolesMap));
  } catch (error) {
    Logger.log("Erro em removeRole: " + error.message);
  }
}

