/**
 * UserValidator.gs
 * Validação de usuários, integridade de dados cadastrais e controle de papéis.
 * Responsável por garantir que apenas usuários válidos e autorizados acessem o sistema.
 */

var USER_ROLES = ['aluno', 'professor', 'bibliotecario', 'admin'];
var CACHE_TTL  = 600; // 10 min

/**
 * Verifica se o e-mail pertence a um usuário cadastrado na sheet 'Perfis'.
 * Usa CacheService para evitar leituras repetidas de Sheets.
 * @param {string} email
 * @return {boolean}
 */
function isValidUser(email) {
  try {
    if (!email) return false;
    
    return GASUtilities.getCached('VALID_USER_' + email, function() {
      var ss    = getBoundSpreadsheet_();
      var sheet = ss.getSheetByName('Perfis');
      if (!sheet) return false;

      var data  = sheet.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][2]).toLowerCase() === String(email).toLowerCase()) {
          return true;
        }
      }
      return false;
    }, CACHE_TTL);
  } catch (error) {
    Logger.log("Erro em isValidUser: " + error.message);
    throw error;
  }
}

/**
 * Retorna o papel (role) do usuário na planilha 'Perfis'.
 * Coluna de referência: [0]=turma [1]=nome [2]=email [3]=role
 * @param {string} email
 * @return {string|null} Role ou null se não encontrado.
 */
function getUserRole(email) {
  try {
    if (!email) return null;
    
    return GASUtilities.getCached('ROLE_' + email, function() {
      var ss    = getBoundSpreadsheet_();
      var sheet = ss.getSheetByName('Perfis');
      if (!sheet) return null;

      var data = sheet.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][2]).toLowerCase() === String(email).toLowerCase()) {
          return String(data[i][3] || 'aluno').toLowerCase();
        }
      }
      return null;
    }, CACHE_TTL);
  } catch (error) {
    Logger.log("Erro em getUserRole: " + error.message);
    throw error;
  }
}

/**
 * Verifica se o usuário possui um papel específico.
 * @param {string} email
 * @param {string} requiredRole  Ex: 'bibliotecario'
 * @return {boolean}
 */
function userHasRole(email, requiredRole) {
  var role = getUserRole(email);
  return role === requiredRole || role === 'admin';
}

/**
 * Valida formato de e-mail simples.
 * @param {string} email
 * @return {boolean}
 */
function isValidEmailFormat(email) {
  try {
    if (!email) return false;
    var re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).trim());
  } catch (error) {
    Logger.log("Erro em isValidEmailFormat: " + error.message);
    throw error;
  }
}

/**
 * Invalida o cache de validação para forçar re-leitura.
 * @param {string} email
 */
function invalidateUserCache(email) {
  try {
    GASUtilities.removeCacheMultiple(['VALID_USER_' + email, 'ROLE_' + email]);
  } catch (error) {
    Logger.log("Erro em invalidateUserCache: " + error.message);
    throw error;
  }
}

/**
 * Lista todos os usuários cadastrados na sheet 'Perfis'.
 * @return {Array<Object>} Array de {nome, email, role}
 */
function listAllUsers() {
  try {
    var ss    = getBoundSpreadsheet_();
    var sheet = ss.getSheetByName('Perfis');
    if (!sheet) return [];

    var data  = sheet.getDataRange().getValues();
    var users = [];
    for (var i = 1; i < data.length; i++) {
      if (!data[i][2]) continue;
      users.push({
        nome:  String(data[i][1]),
        email: String(data[i][2]),
        role:  String(data[i][3] || 'aluno')
      });
    }
    return users.filter(function(u) { return isValidEmailFormat(u.email); });
  } catch (error) {
    Logger.log("Erro em listAllUsers: " + error.message);
    throw error;
  }
}
