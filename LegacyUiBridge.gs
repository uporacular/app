/**
 * Pontes para telas legadas do Up Oracular.
 *
 * As telas usam `google.script.run`; estas funções convertem suas chamadas para
 * o fluxo canônico de token em `SessoesAuth`, sem criar uma segunda sessão e
 * sem alterar a credencial em texto plano.
 */

function authenticateUser(username, password) {
  var result = processLoginRequest(String(username || '').trim(), String(password || ''));
  if (result && result.success) {
    return {
      success: true,
      redirectUrl: result.redirectUrl || '',
      message: result.message || 'Login efetuado com sucesso.'
    };
  }
  var message = result && (result.message || result.error) || 'Credenciais inválidas.';
  return { success: false, error: message, message: message };
}

function getSessionStatus(token) {
  var session = upOracularResolveWebSession_(token);
  return session ? upOracularSessionView_(session) : { active: false };
}

function upOracularRefreshSession(token) {
  var session = getSessionStatus(token);
  if (!session.active) {
    return { success: false, error: 'Sessão inválida. Faça login novamente.' };
  }
  return { success: true, session: session };
}

function upOracularEndSession(token) {
  if (!token) return { success: false, error: 'Sessão inválida. Faça login novamente.' };
  if (typeof logoutWithToken === 'function') {
    logoutWithToken(token);
  } else if (typeof deleteUpOracularWebSession_ === 'function') {
    deleteUpOracularWebSession_(token);
  }
  return { success: true };
}

function upOracularResolveWebSession_(token) {
  if (!token || typeof getUpOracularWebSession_ !== 'function') return null;
  return getUpOracularWebSession_(token);
}

function upOracularSessionView_(session) {
  var user = session.user || {};
  var expiresAt = Number(session.expiresAt || 0);
  var startedAt = session.startedAt || session.issuedAt ||
    (expiresAt && typeof UP_ORACULAR_TOK_TTL_MS_ !== 'undefined'
      ? expiresAt - UP_ORACULAR_TOK_TTL_MS_
      : new Date().getTime());
  return {
    active: true,
    email: user.email || user.username || user.name || 'Usuário autenticado',
    startedAt: startedAt,
    lastActivity: session.lastActivity || startedAt,
    expiresAt: expiresAt || null
  };
}
