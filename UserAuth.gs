/**
 * UserAuth.gs
 * Módulo de controle de sessão avançada no Apps Script e integração de login.
 * Validations utilizam CacheService para tokenization temporário.
 */

var AUTH_CACHE_TTL = 1800; // 30 min
var AUTH_NS = 'AUTH_TOKEN_';

/**
 * Verifica rapidamente se a automação ocorre sob uma sessão de usuário real.
 * @return {boolean}
 */
function isUserAuthenticated() {
  var email = getAuthenticatedUserEmail();
  return !!email;
}

/**
 * Retorna o email com segurança, fallback do Session.
 * @return {string}
 */
function getAuthenticatedUserEmail() {
  var user = Session.getActiveUser();
  var email = user ? user.getEmail() : null;
  if (!email) {
    var sessionEmail = Session.getEffectiveUser().getEmail();
    return sessionEmail || null;
  }
  return email;
}

/**
 * Gera um token de autorização de curta duração e guarda em cache.
 * @param {string} email
 * @return {string} JWT ou token único.
 */
function generateAuthToken(email) {
  var token = Utilities.getUuid();
  var cache = CacheService.getUserCache();
  cache.put(AUTH_NS + email, token, AUTH_CACHE_TTL);
  return token;
}

/**
 * Valida um token temporário.
 * @param {string} email
 * @param {string} token
 * @return {boolean}
 */
function validateAuthToken(email, token) {
  if (!email || !token) return false;
  var cache = CacheService.getUserCache();
  var cachedToken = cache.get(AUTH_NS + email);
  return cachedToken === token;
}

/**
 * Encerra auth cache explicitamente.
 * @param {string} email
 */
function invalidateAuthToken(email) {
  var cache = CacheService.getUserCache();
  cache.remove(AUTH_NS + email);
}

/**
 * Verifica se um request é executado pelo admin nativo.
 * @return {boolean}
 */
function isAppAdmin() {
  return Session.getEffectiveUser().getEmail() === Session.getActiveUser().getEmail();
}
