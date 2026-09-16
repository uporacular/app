/**
 * UserAuth.gs — Up Oracular
 *
 * Modulo de autenticacao por token armazenado em SessoesAuth.
 *
 * Historico: versoes anteriores usavam CacheService.getUserCache() e
 * CacheService.getScriptCache(). Em deployments "Execute as: Me" o
 * getUserCache() pertence ao dono do script, nao ao visitante — quando
 * o desenvolvedor logava durante testes todos os usuarios entravam direto.
 * O ScriptCache expira silenciosamente apos 6 h sem aviso.
 * SessoesAuth e o store persistente e auditavel por instancia.
 *
 * Fluxo correto:
 *   processLoginRequest(user, pass)
 *     -> valida credenciais
 *     -> grava token em SessoesAuth
 *     -> devolve { success, redirectUrl }
 *   doGet(e)
 *     -> isUpOracularWebSessionValid_(e.parameter.token)
 *     -> le SessoesAuth — nao CacheService
 */

// ---------------------------------------------------------------------------
// Helpers sem estado (sem UserCache, sem ScriptCache para sessoes)
// ---------------------------------------------------------------------------

/**
 * Verifica se o script roda sob um usuario autenticado via OAuth
 * (util para triggers e automacoes, NAO para sessao do visitante do webapp).
 * @return {boolean}
 */
function isUserAuthenticated() {
  return !!getAuthenticatedUserEmail();
}

/**
 * Retorna o e-mail do usuario OAuth ativo (owner do script em "Execute as: Me").
 * @return {string|null}
 */
function getAuthenticatedUserEmail() {
  try {
    var email = Session.getActiveUser().getEmail();
    return email || Session.getEffectiveUser().getEmail() || null;
  } catch (e) {
    return null;
  }
}

/**
 * Verifica se o script roda como o proprio dono (usado em guards de admin).
 * @return {boolean}
 */
function isAppAdmin() {
  try {
    return Session.getEffectiveUser().getEmail() === Session.getActiveUser().getEmail();
  } catch (e) {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Login por usuario/senha contra a aba 'Usuarios'
// ---------------------------------------------------------------------------

/**
 * Adaptador para o autenticador canônico da frota.
 * A credencial é lida e comparada em texto plano conforme a convenção local.
 *
 * @param {string} username
 * @param {string} password
 * @return {{ success: boolean, user?: Object, message?: string }}
 */
function loginUpOracularUser_(username, password) {
  try {
    var result = loginWithPassword(username, password);
    return result && result.success
      ? { success: true, user: result.user }
      : { success: false, message: result && result.message || 'Credenciais invalidas.' };
  } catch (error) {
    Logger.log("Erro em loginUpOracularUser_: " + error.message);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Endpoint chamado pelo Login.html via google.script.run
// ---------------------------------------------------------------------------

/**
 * Valida credenciais, cria sessao em SessoesAuth e devolve a redirectUrl.
 * Este e o unico ponto de entrada de login do Up Oracular.
 *
 * @param {string} username
 * @param {string} password
 * @return {{ success: boolean, redirectUrl?: string, message?: string }}
 */
function processLoginRequest(username, password) {
  try {
    var auth = loginUpOracularUser_(username, password);
    if (!auth || !auth.success || !auth.user) {
      return { success: false, message: auth && auth.message ? auth.message : 'Credenciais invalidas.' };
    }
    // loginWithPassword já persistiu o token canônico em SessoesAuth.
    var token = auth.token;
    if (!token) return { success: false, message: 'Não foi possível criar a sessão.' };
    return {
      success:     true,
      message:     'Login efetuado com sucesso.',
      redirectUrl: getUpOracularWebAppUrl_() + '?page=dashboard&token=' + encodeURIComponent(token)
    };
  } catch (error) {
    return { success: false, message: 'Erro ao processar login: ' + (error && error.message || error) };
  }
}
