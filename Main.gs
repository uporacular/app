/**
 * Ponto de entrada unico do Web App.
 * A abertura sem token sempre exibe a tela de login do Up Oracular.
 */
function doGet(e) {
  // FLEET_FRAGMENT_BOOTSTRAP: o token fica no fragmento (#tok=), que não é
  // enviado ao servidor. O shell valida o token antes de chamar qualquer API.
  var fleetPageName = e && e.parameter ? String(e.parameter.page || '') : '';
  var fleetBootstrapPage = fleetPageName === 'app' || fleetPageName === 'reading';
  var fleetBootstrapToken = e && e.parameter && e.parameter.tok;
  if (fleetBootstrapPage && !fleetBootstrapToken) {
    var fleetTemplates = fleetPageName === 'reading'
      ? ['ReadingRecordHtml']
      : ['Index', 'index', 'Dashboard'];
    for (var fleetI = 0; fleetI < fleetTemplates.length; fleetI++) {
      try {
        var fleetTemplate = HtmlService.createTemplateFromFile(fleetTemplates[fleetI]);
        fleetTemplate.authToken = '';
        fleetTemplate.tok = '';
        fleetTemplate.sessionUser = {};
        fleetTemplate.data = { scriptUrl: ScriptApp.getService().getUrl() };
        return fleetTemplate.evaluate()
          .setTitle(fleetPageName === 'reading' ? 'UpOracular | Registros de leitura' : 'Up Oracular')
          .addMetaTag('viewport', 'width=device-width, initial-scale=1');
      } catch (fleetTemplateError) {
        // Template alternativo não disponível - fallback para mensagem genérica
      }
    }
    return HtmlService.createHtmlOutput('Aplicação indisponível.');
  }
  try {
    var params = e && e.parameter ? e.parameter : {};

    if (params.page === 'features') {
      return HtmlService.createTemplateFromFile('AdminFeatures').evaluate()
        .setTitle('Funcionalidades')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
        .addMetaTag('viewport', 'width=device-width, initial-scale=1');
    }

    // Aceita ?token= (legacy) ou ?page=app#tok= (padrao atual da frota).
    var tok = params.token || params.tok || '';
    if (!isUpOracularWebSessionValid_(tok)) {
      return HtmlService.createTemplateFromFile('Login').evaluate()
        .setTitle('Up Oracular')
        .addMetaTag('viewport', 'width=device-width, initial-scale=1');
    }

    if (params.page === 'reading') {
      var readingTemplate = HtmlService.createTemplateFromFile('ReadingRecordHtml');
      readingTemplate.authToken = tok;
      return readingTemplate.evaluate()
        .setTitle('UpOracular | Registros de leitura')
        .addMetaTag('viewport', 'width=device-width, initial-scale=1');
    }

    var template = HtmlService.createTemplateFromFile('index');
    template.authToken = tok;
    return template.evaluate()
      .setTitle('UpOracular | Dashboard')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  } catch (error) {
    Logger.log("Erro em doGet: " + error.message);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Sessoes por token na aba SessoesAuth.
// ---------------------------------------------------------------------------

var UP_ORACULAR_TOK_TTL_MS_ = 21600 * 1000; // 6 h em milissegundos

/**
 * Cria uma nova sessao e devolve o token.
 * Grava em SessoesAuth para que isUpOracularWebSessionValid_ possa
 * verificar sem depender do usuario Google logado.
 *
 * @param  {Object} user  Dados do usuario autenticado.
 * @return {string}       Token UUID.
 */
function createUpOracularWebSession_(user) {
  try {
    var token = Utilities.getUuid().replace(/-/g, '');
    var session = {
      user:      user || {},
      expiresAt: new Date().getTime() + UP_ORACULAR_TOK_TTL_MS_
    };
    saveUpOracularWebSession_(token, session);
    return token;
  } catch (error) {
    Logger.log("Erro em createUpOracularWebSession_: " + error.message);
    throw error;
  }
}

/**
 * Verifica se o token e valido e nao expirou.
 * Le SessoesAuth — nunca UserProperties nem CacheService.getUserCache.
 *
 * @param  {string}  token
 * @return {boolean}
 */
function isUpOracularWebSessionValid_(token) {
  return getUpOracularWebSession_(token) !== null;
}

/**
 * Retorna os dados do usuario associados ao token, ou null se invalido.
 *
 * @param  {string} token
 * @return {Object|null}
 */
function getUpOracularWebSessionUser_(token) {
  var session = getUpOracularWebSession_(token);
  return session ? session.user || null : null;
}

function getUpOracularWebAppUrl_() {
  try {
    return ScriptApp.getService().getUrl() || '';
  } catch (error) {
    Logger.log("Erro em getUpOracularWebAppUrl_: " + error.message);
    throw error;
  }
}

function getUpOracularSessoesAuthSheet_() {
  try {
    if (typeof getSessoesAuthSheet_ === 'function') return getSessoesAuthSheet_();
    var ss = (typeof Auth_getSpreadsheet_ === 'function') ? Auth_getSpreadsheet_() : getBoundSpreadsheet_();
    var sheet = ss.getSheetByName('SessoesAuth');
    if (!sheet) {
      sheet = ss.insertSheet('SessoesAuth');
      sheet.getRange(1, 1, 1, 6).setValues([['token', 'userId', 'username', 'role', 'expiresAt', 'sessionJson']]);
    }
    return sheet;
  } catch (error) {
    Logger.log("Erro em getUpOracularSessoesAuthSheet_: " + error.message);
    throw error; // Re-lança para tratamento superior
  }
}

function saveUpOracularWebSession_(token, session) {
  try {
    try {
      var user = session.user || {};
      getUpOracularSessoesAuthSheet_().appendRow([
        token,
        String(user.id || user.userId || user.username || ''),
        String(user.username || user.email || ''),
        String(user.role || 'USER'),
        session.expiresAt,
        JSON.stringify(session)
      ]);
    } catch (error) {
      Logger.log("Erro em saveUpOracularWebSession_: " + error.message);
      throw error; // Re-lança para tratamento superior
    }
  } catch (error) {
    Logger.log("Erro em saveUpOracularWebSession_: " + error.message);
    throw error;
  }
}

function getUpOracularWebSession_(token) {
  try {
    try {
      try {
        if (typeof token !== 'string' || token.length === 0 || token.length > 200) return null;
        var sheet = getUpOracularSessoesAuthSheet_();
        var lastRow = sheet.getLastRow();
        if (lastRow < 2) return null;
        var values = sheet.getRange(2, 1, lastRow - 1, Math.max(sheet.getLastColumn(), 6)).getValues();
        for (var i = 0; i < values.length; i++) {
          if (String(values[i][0]) !== String(token)) continue;
          var expiresAt = Number(values[i][4]);
          if (!isFinite(expiresAt) || expiresAt <= new Date().getTime()) {
            sheet.deleteRow(i + 2);
            return null;
          }
          var raw = values[i][5];
          // Sessões antigas gravam JSON na coluna 6; o AuthStandardService
          // grava issuedAt nessa posição. Em ambos os casos, reconstrua uma
          // identidade mínima e válida a partir das colunas canônicas.
          if (raw && typeof raw === 'string' && /^\s*\{/.test(raw)) {
            try {
              var parsed = JSON.parse(raw);
              if (parsed && parsed.user) return parsed;
            } catch (e) {}
          }
          return {
            user: {
              id: values[i][1], userId: values[i][1],
              username: values[i][2], role: values[i][3] || 'USER'
            },
            expiresAt: expiresAt,
            issuedAt: isFinite(Number(values[i][5])) ? Number(values[i][5]) : null
          };
        }
        return null;
      } catch (error) {
        Logger.log("Erro em getUpOracularWebSession_: " + error.message);
        throw error; // Re-lança para tratamento superior
      }
    } catch (error) {
      Logger.log("Erro em getUpOracularWebSession_: " + error.message);
      throw error;
    }
  } catch (error) {
    Logger.log("Erro em getUpOracularWebSession_: " + error.message);
    throw error;
  }
}

function deleteUpOracularWebSession_(token) {
  try {
    try {
      try {
        if (!token) return;
        var sheet = getUpOracularSessoesAuthSheet_();
        var lastRow = sheet.getLastRow();
        if (lastRow < 2) return;
        var values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
        for (var i = values.length - 1; i >= 0; i--) {
          if (String(values[i][0]) === String(token)) sheet.deleteRow(i + 2);
        }
      } catch (e) {
        // logout/limpeza devem ser idempotentes.
      }
    } catch (error) {
      Logger.log("Erro em deleteUpOracularWebSession_: " + error.message);
      throw error;
    }
  } catch (error) {
    Logger.log("Erro em deleteUpOracularWebSession_: " + error.message);
    throw error;
  }
}
