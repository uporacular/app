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
  var raw = PropertiesService.getScriptProperties().getProperty(PROP_KEY_ADMINS);
  return raw ? JSON.parse(raw) : [];
}

/**
 * Define (sobrescreve) a lista de administradores.
 * @param {Array<string>} emails
 */
function setAdmins(emails) {
  if (!Array.isArray(emails)) return;
  PropertiesService.getScriptProperties().setProperty(
    PROP_KEY_ADMINS, JSON.stringify(emails.map(function(e) { return e.toLowerCase().trim(); }))
  );
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
  var email = Session.getActiveUser().getEmail();
  return isAdmin(email);
}

/**
 * Atribui um papel (role) a um e-mail e persiste.
 * @param {string} email
 * @param {string} role — ROLES.ADMIN | ROLES.PROFESSOR | ROLES.ALUNO
 */
function assignRole(email, role) {
  if (!email || !ROLES[role]) return;
  var props = PropertiesService.getScriptProperties();
  var rawRoles = props.getProperty(PROP_KEY_ROLES);
  var rolesMap = rawRoles ? JSON.parse(rawRoles) : {};
  rolesMap[email.toLowerCase().trim()] = role;
  props.setProperty(PROP_KEY_ROLES, JSON.stringify(rolesMap));
}

/**
 * Retorna o papel do usuário (padrão: ALUNO se não atribuído).
 * @param {string} email
 * @return {string}
 */
function getUserRole(email) {
  if (!email) return ROLES.ALUNO;
  if (isAdmin(email)) return ROLES.ADMIN;
  var raw = PropertiesService.getScriptProperties().getProperty(PROP_KEY_ROLES);
  var rolesMap = raw ? JSON.parse(raw) : {};
  return rolesMap[email.toLowerCase().trim()] || ROLES.ALUNO;
}

/**
 * Verifica se o usuário atual tem acesso a uma funcionalidade pelo nível mínimo exigido.
 * @param {string} requiredRole — nível mínimo requerido (ex: ROLES.PROFESSOR)
 * @return {boolean}
 */
function hasAccess(requiredRole) {
  var hierarchy = [ROLES.ALUNO, ROLES.PROFESSOR, ROLES.ADMIN];
  var email = Session.getActiveUser().getEmail();
  var userRole = getUserRole(email);
  return hierarchy.indexOf(userRole) >= hierarchy.indexOf(requiredRole);
}

