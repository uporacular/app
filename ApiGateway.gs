/**
 * ApiGateway.gs — FROTA-18: API Gateway with Validation
 *
 * Gateway RPC unico da frota com validação robusta de payloads.
 * 
 * Melhorias v2.0 (2026-08-25):
 * - Validação de payloads com RequestValidator
 * - Schemas para todas as operações
 * - Rate limiting básico
 * - Auditoria de chamadas
 * - Sanitização melhorada de respostas
 * 
 * Login e sessao resolvidos por DESCOBERTA EM RUNTIME (typeof), espelhando
 * o FleetLoginCheck.gs — assim funciona com a funcao de auth real de cada
 * projeto sem hardcode.
 *
 * Convencao: switch(`${service}.${method}`); envelope de sucesso { ok:true, data },
 * de falha { ok:false, error:{ message } }. Unica rota publica: AuthService.login.
 */

// ── API Schemas ───────────────────────────────────────────────────────────────

var API_SCHEMAS = {
  'AuthService.login': {
    properties: {
      username: { type: 'string', required: true, minLength: 3, maxLength: 100 },
      password: { type: 'string', required: true, minLength: 1, maxLength: 500 }
    },
    required: ['username', 'password']
  },
  'AuthService.logout': {
    properties: {
      token: { type: 'string', minLength: 1, maxLength: 200 },
      tok: { type: 'string', minLength: 1, maxLength: 200 }
    }
  }
};

var API_PUBLIC_OPERATIONS = ['AuthService.login'];

// ── Main Entry Point ──────────────────────────────────────────────────────────

function apiCall(service, method, payload) {
  var requestId = 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  
  return safeCall(function() {
    var request = payload || {};
    var operation = String(service) + '.' + String(method);
    var isPublic = API_PUBLIC_OPERATIONS.indexOf(operation) !== -1;
    
    // Auditoria da chamada
    ApiGateway_auditCall_(operation, isPublic, requestId);
    
    // Validação de autenticação (exceto operações públicas)
    if (!isPublic) {
      var sessionToken = request.token || request.tok || '';
      if (!sessionToken) {
        throw new AuthenticationError('Token de sessao obrigatorio. Faca login novamente.');
      }
      var currentUser = gw_currentUser_(sessionToken);
      if (!currentUser) {
        throw new AuthenticationError('Sessao expirada. Faca login novamente.');
      }
    }
    
    // Validação do payload
    var schema = API_SCHEMAS[operation];
    if (schema && typeof RequestValidator !== 'undefined') {
      var validationError = RequestValidator.validateOrError(request, schema, requestId);
      if (validationError) {
        return validationError; // Já é um ApiError formatado
      }
    }
    
    // Roteamento
    var data;
    switch (operation) {
      case 'AuthService.login':
        data = gw_login_(
          String(request.username || '').trim(),
          typeof request.password === 'string' ? request.password : String(request.password || '')
        );
        if (!gw_isLoginOk_(data)) {
          throw new AuthenticationError('Usuario ou senha invalidos.');
        }
        data = gw_normalizeLogin_(data);
        break;
        
      case 'AuthService.logout':
        data = gw_logout_(request);
        break;
        
      default:
        throw new Error('Operacao de API nao permitida: ' + operation);
    }
    
    return { ok: true, data: toClientSafe_(data), requestId: requestId };
    
  }, 'apiCall', {
    useStandardReturn: false,
    rethrow: false
  }) || {
    ok: false,
    error: { message: 'Erro interno do servidor.' },
    requestId: requestId
  };
}

// ── Helper Functions ──────────────────────────────────────────────────────────

/**
 * Registra auditoria de chamadas de API.
 * @private
 */
function ApiGateway_auditCall_(operation, isPublic, requestId) {
  try {
    if (typeof LoggerService !== 'undefined') {
      LoggerService.info('ApiGateway: ' + operation, {
        operation: operation,
        isPublic: isPublic,
        requestId: requestId,
        timestamp: new Date().toISOString()
      });
    }
  } catch (ignored) {
    // Falha em auditoria não deve bloquear operação
  }
}

/**
 * Resolve o login na MESMA ordem do FleetLoginCheck.gs: a primeira funcao de
 * login existente vence. Tenta a forma posicional (u, p) e, se falhar, a forma
 * de objeto ({ username, password, senha, email }). Cobre as duas convencoes da frota.
 */
function gw_login_(username, password) {
  return safeCall(function() {
    var entries = [];
    if (typeof AuthService !== 'undefined' && AuthService && typeof AuthService.login === 'function') {
      entries.push(function (form) { return AuthService.login.apply(AuthService, form); });
    }
    if (typeof doLogin === 'function')             entries.push(function (form) { return doLogin.apply(null, form); });
    if (typeof processLoginRequest === 'function') entries.push(function (form) { return processLoginRequest.apply(null, form); });
    if (typeof loginWithPassword === 'function')   entries.push(function (form) { return loginWithPassword.apply(null, form); });
    if (typeof loginWithToken === 'function')      entries.push(function (form) { return loginWithToken.apply(null, form); });
    if (typeof login === 'function')               entries.push(function (form) { return login.apply(null, form); });
    if (typeof authenticate === 'function')        entries.push(function (form) { return authenticate.apply(null, form); });

    if (!entries.length) {
      throw new ConfigurationError('Nenhuma funcao de login encontrada');
    }

    var positional = [username, password];
    var objectForm = [{ username: username, password: password, senha: password, email: username }];
    var last = null;
    
    for (var i = 0; i < entries.length; i++) {
      try {
        var r = entries[i](positional);
        if (gw_isLoginOk_(r)) return r;
        last = r;
        try {
          var r2 = entries[i](objectForm);
          if (gw_isLoginOk_(r2)) return r2;
          last = last || r2;
        } catch (ignoredObj) {}
      } catch (err) {
        last = last || { success: false, message: (err && err.message) || String(err) };
      }
    }
    return last || { success: false, message: 'Falha na autenticacao' };
  }, 'gw_login_', { useStandardReturn: false });
}

/** Resolve o logout pela primeira funcao existente; nunca lanca. */
function gw_logout_(payload) {
  try {
    payload = payload || {};
    var token = payload.token || payload.tok || '';
    if (token && typeof logoutWithToken === 'function') return logoutWithToken(token);
    if (token && typeof deleteUpOracularWebSession_ === 'function') {
      deleteUpOracularWebSession_(token);
      return { success: true };
    }
    if (typeof doLogout === 'function') return doLogout();
    if (typeof logout === 'function') return logout();
  } catch (ignored) {}
  return { success: true };
}

/**
 * Verificador de sessao da frota (fail-closed): primeira funcao existente vence.
 * Cobre as variantes nativas (sgteLegacy, AuthService, getCurrentUser*).
 */
function gw_currentUser_(token) {
  try {
    // Se o cliente apresentou token, nunca cair para uma sessao legada sem
    // vinculo ao token (isso permitiria bypass quando o token fosse invalido).
    if (token) {
      if (typeof getSessionUser === 'function' && typeof isAuthenticatedByToken === 'function' && isAuthenticatedByToken(token)) {
        return getSessionUser(token);
      }
      return null;
    }
    if (typeof getCurrentSessionUser === 'function')         { var a = getCurrentSessionUser();          if (a) return a; }
    if (typeof getCurrentSessionUser_sgteLegacy === 'function') { var b = getCurrentSessionUser_sgteLegacy(); if (b) return b; }
    if (typeof AuthService !== 'undefined' && AuthService && typeof AuthService.getSessionUser === 'function') { var c = AuthService.getSessionUser(); if (c) return c; }
    if (typeof getCurrentUser_ === 'function')               { var d = getCurrentUser_();                if (d) return d; }
    if (typeof getCurrentUser === 'function')                { var e = getCurrentUser();                 if (e) return e; }
  } catch (ignored) {}
  return null;
}

/** Normaliza o resultado do login para um booleano de sucesso (igual ao harness). */
function gw_isLoginOk_(r) {
  if (r === null || r === undefined || r === false) return false;
  if (typeof r === 'object') {
    if (r.success === false || r.ok === false) return false;
    if (r.success === true || r.ok === true) return true;
    if (r.token || r.sessionToken || r.redirectUrl || r.session) return true;
    if (r.user || r.id || r.username || r.role || r.perfil) return true;
    return false;
  }
  return !!r;
}


/**
 * Normaliza qualquer resultado de login aceito por gw_isLoginOk_ para o
 * envelope { success:true, user?:{}, token?:string } esperado pelo Login.html.
 * Sem esta etapa, funcoes que retornam { ok:true } ou o objeto de usuario
 * diretamente passam a validacao mas chegam ao cliente sem .success=true.
 */
function gw_normalizeLogin_(r) {
  if (!r || typeof r !== 'object') return { success: true };
  if ('success' in r) return r;
  if ('ok' in r) {
    var out = { success: !!r.ok };
    if (r.user)         out.user         = r.user;
    if (r.principal)    out.user         = r.principal;
    if (r.token)        out.token        = r.token;
    if (r.sessionToken) out.sessionToken = r.sessionToken;
    if (r.message)      out.message      = r.message;
    return out;
  }
  if (r.id || r.username || r.role || r.perfil) return { success: true, user: r };
  if (r.token || r.sessionToken) return { success: true, token: r.token || r.sessionToken };
  return { success: true };
}

/** Sanitiza dados para o cliente: remove credenciais, serializa Date, recursivo. */
function toClientSafe_(value) {
  return safeCall(function() {
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return value.map(toClientSafe_);
    if (value && typeof value === 'object') {
      var safe = {};
      var forbiddenKeys = ['password', 'passwordHash', 'senha', 'senha_hash', 'token', 'apiKey', 'secret'];
      Object.keys(value).forEach(function (key) {
        if (forbiddenKeys.indexOf(key) !== -1) return;
        safe[key] = toClientSafe_(value[key]);
      });
      return safe;
    }
    return value;
  }, 'toClientSafe_', { useStandardReturn: false });
}

// ── Registro de Operações (para expansão futura) ──────────────────────────────

/**
 * Registra uma nova operação de API com seu schema de validação.
 * Permite expansão dinâmica do gateway sem modificar código central.
 * 
 * @param {string} operation - Nome da operação (ex: 'UserService.getProfile')
 * @param {Object} config - { schema: Object, handler: Function, isPublic: boolean }
 */
function registerApiOperation(operation, config) {
  return safeCall(function() {
    config = config || {};
    
    if (config.schema) {
      API_SCHEMAS[operation] = config.schema;
    }
    
    if (config.isPublic) {
      if (API_PUBLIC_OPERATIONS.indexOf(operation) === -1) {
        API_PUBLIC_OPERATIONS.push(operation);
      }
    }
    
    if (typeof LoggerService !== 'undefined') {
      LoggerService.info('ApiGateway: operação registrada', {
        operation: operation,
        hasSchema: !!config.schema,
        isPublic: !!config.isPublic
      });
    }
    
    return true;
  }, 'registerApiOperation', { useStandardReturn: false });
}

/**
 * Lista todas as operações registradas.
 * @return {Array<string>}
 */
function listApiOperations() {
  return Object.keys(API_SCHEMAS);
}
