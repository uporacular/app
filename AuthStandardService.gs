/**
 * AuthStandardService — contrato comum de autenticacao por token.
 *
 * Fase 2: tokens de sessao ficam na aba SessoesAuth da planilha principal,
 * nao em ScriptProperties. Configuracoes e IDs continuam podendo usar
 * ScriptProperties fora deste modulo.
 */
var AuthStandardService = (function () {
  'use strict';

  var adapters_ = {};
  var config_ = {
    tokenPrefix: 'FLEET_AUTH_TOK_',
    sessionTtlSeconds: 21600
  };

  function configure(options) {
    options = options || {};
    adapters_ = options.adapters || adapters_;
    if (options.sessionKey)        config_.tokenPrefix = options.sessionKey + '_TOK_';
    if (options.tokenPrefix)       config_.tokenPrefix = options.tokenPrefix;
    if (options.sessionTtlSeconds) config_.sessionTtlSeconds = options.sessionTtlSeconds;
    return api;
  }

  function login(username, password) {
    try {
      if (!username || !password || typeof adapters_.findUser !== 'function') {
        return { ok: false, message: 'Credenciais Invalidas' };
      }

      var user = adapters_.findUser(String(username));
      if (!user || user.active === false || !verify_(password, user)) {
        return { ok: false, message: 'Credenciais Invalidas' };
      }

      var token = uuid_();
      var session = {
        userId:      String(user.id || user.username || username),
        username:    String(user.username || username),
        role:        String(user.role || 'USER'),
        permissions: user.permissions || [],
        issuedAt:    now_(),
        expiresAt:   now_() + config_.sessionTtlSeconds * 1000
      };

      saveSession_(token, session);

      return {
        ok:    true,
        token: token,
        user:  { id: session.userId, username: session.username, role: session.role }
      };
    } catch (error) {
      Logger.log("Erro em login: " + error.message);
      throw error;
    }
  }

  function isAuthenticatedByToken(token) {
    if (typeof token !== 'string' || token.length === 0 || token.length > 200) return false;
    return getSessionByToken_(token) !== null;
  }

  function isAuthenticated() {
    return false;
  }

  function getUserRole(token) {
    var session = getSessionByToken_(token);
    return session ? session.role : null;
  }

  function checkPermission(required, token) {
    try {
      var session = getSessionByToken_(token);
      if (!session) return denied_();
      if (!required) return { ok: true, principal: session };

      var requiredList = Array.isArray(required) ? required : [required];
      var permissions = session.permissions || [];
      var allowed = requiredList.indexOf(session.role) >= 0 ||
        permissions.indexOf('*') >= 0 ||
        requiredList.some(function (permission) {
          return permissions.indexOf(permission) >= 0;
        });
      return allowed ? { ok: true, principal: session } : denied_();
    } catch (error) {
      Logger.log("Erro em checkPermission: " + error.message);
      throw error;
    }
  }

  function logout(token) {
    deleteSession_(token);
    return { ok: true };
  }

  function saveSession_(token, session) {
    try {
      try {
        var sheet = sessionSheet_();
        var headers = sessionHeaders_(sheet);
        var values = {
          token: token,
          userid: session.userId,
          username: session.username,
          role: session.role,
          expiresat: session.expiresAt,
          issuedat: session.issuedAt,
          permissions: JSON.stringify(session.permissions || []),
          source: config_.tokenPrefix
        };
        sheet.appendRow(headers.map(function(header) {
          return values[header] === undefined ? '' : values[header];
        }));
      } catch (error) {
        Logger.log("Erro em saveSession_: " + error.message);
        throw error; // Re-lança para tratamento superior
      }
    } catch (error) {
      Logger.log("Erro em saveSession_: " + error.message);
      throw error;
    }
  }

  function getSessionByToken_(token) {
    try {
      try {
        try {
          if (typeof token !== 'string' || token.length === 0 || token.length > 200) return null;
          var sheet = sessionSheet_();
          var lastRow = sheet.getLastRow();
          if (lastRow < 2) return null;

          var headers = sessionHeaders_(sheet);
          var tokenIndex = headers.indexOf('token');
          var userIndex = headers.indexOf('userid');
          var usernameIndex = headers.indexOf('username');
          var roleIndex = headers.indexOf('role');
          var expiresIndex = headers.indexOf('expiresat');
          var issuedIndex = headers.indexOf('issuedat');
          var permissionsIndex = headers.indexOf('permissions');
          if (tokenIndex < 0 || expiresIndex < 0) return null;
          var values = sheet.getRange(2, 1, lastRow - 1, Math.max(sheet.getLastColumn(), headers.length)).getValues();
          for (var i = 0; i < values.length; i++) {
            var row = values[i];
            if (String(row[tokenIndex]) !== token) continue;

            var expiresAt = Number(row[expiresIndex]);
            if (!isFinite(expiresAt) || expiresAt <= now_()) {
              sheet.deleteRow(i + 2);
              return null;
            }

            return {
              userId: String(userIndex >= 0 ? row[userIndex] || '' : ''),
              username: String(usernameIndex >= 0 ? row[usernameIndex] || '' : ''),
              role: String(roleIndex >= 0 ? row[roleIndex] || 'USER' : 'USER'),
              expiresAt: expiresAt,
              issuedAt: issuedIndex >= 0 && isFinite(Number(row[issuedIndex])) ? Number(row[issuedIndex]) : null,
              permissions: parsePermissions_(permissionsIndex >= 0 ? row[permissionsIndex] : '')
            };
          }
          return null;
        } catch (error) {
          Logger.log("Erro em getSessionByToken_: " + error.message);
          throw error; // Re-lança para tratamento superior
        }
      } catch (error) {
        Logger.log("Erro em getSessionByToken_: " + error.message);
        throw error;
      }
    } catch (error) {
      Logger.log("Erro em getSessionByToken_: " + error.message);
      throw error;
    }
  }

  function deleteSession_(token) {
    try {
      try {
        try {
          if (typeof token !== 'string' || token.length === 0 || token.length > 200) return;
          var sheet = sessionSheet_();
          var lastRow = sheet.getLastRow();
          if (lastRow < 2) return;

          var tokenIndex = sessionHeaders_(sheet).indexOf('token');
          if (tokenIndex < 0) return;
          var values = sheet.getRange(2, 1, lastRow - 1, Math.max(sheet.getLastColumn(), tokenIndex + 1)).getValues();
          for (var i = values.length - 1; i >= 0; i--) {
            if (String(values[i][tokenIndex]) === token) sheet.deleteRow(i + 2);
          }
        } catch (error) {
          Logger.log("Erro em deleteSession_: " + error.message);
          throw error; // Re-lança para tratamento superior
        }
      } catch (error) {
        Logger.log("Erro em deleteSession_: " + error.message);
        throw error;
      }
    } catch (error) {
      Logger.log("Erro em deleteSession_: " + error.message);
      throw error;
    }
  }

  function sessionSheet_() {
    try {
      try {
        try {
          if (adapters_.sessionSheet) return adapters_.sessionSheet;
          if (typeof getSessoesAuthSheet_ === 'function') {
            var existing = getSessoesAuthSheet_();
            if (existing) return ensureSessionHeaders_(existing);
          }

          var ss = resolveSpreadsheet_();
          var sheet = ss.getSheetByName('SessoesAuth');
          if (!sheet) {
            sheet = ss.insertSheet('SessoesAuth');
            sheet.getRange(1, 1, 1, 8).setValues([[
              'token', 'userId', 'username', 'role', 'expiresAt', 'issuedAt', 'permissions', 'source'
            ]]);
          }
          return ensureSessionHeaders_(sheet);
        } catch (error) {
          Logger.log("Erro em sessionSheet_: " + error.message);
          throw error; // Re-lança para tratamento superior
        }
      } catch (error) {
        Logger.log("Erro em sessionSheet_: " + error.message);
        throw error;
      }
    } catch (error) {
      Logger.log("Erro em sessionSheet_: " + error.message);
      throw error;
    }
  }

  function resolveSpreadsheet_() {
    try {
      if (adapters_.spreadsheet) return adapters_.spreadsheet;
      if (typeof AuthStd_getSpreadsheet_ === 'function') return AuthStd_getSpreadsheet_();
      if (typeof Auth_getSpreadsheet_ === 'function') return Auth_getSpreadsheet_();
      if (typeof getBoundSpreadsheet_ === 'function') return getBoundSpreadsheet_();
      var active = SpreadsheetApp.getActiveSpreadsheet();
      if (active) return active;
      return SpreadsheetApp.getActive();
    } catch (error) {
      Logger.log("Erro em resolveSpreadsheet_: " + error.message);
      throw error;
    }
  }

  function parsePermissions_(raw) {
    try {
      try {
        if (!raw) return [];
        try {
          var parsed = JSON.parse(String(raw));
          return Array.isArray(parsed) ? parsed : [];
        } catch (ignored) {
          return [];
        }
      } catch (error) {
        Logger.log("Erro em parsePermissions_: " + error.message);
        throw error;
      }
    } catch (error) {
      Logger.log("Erro em parsePermissions_: " + error.message);
      throw error;
    }
  }

  function verify_(password, user) {
    var stored = user && user.password;
    if (stored === undefined || stored === null || stored === '') return false;
    return constantTimeEqual_(String(password), String(stored));
  }

  function sessionHeaders_(sheet) {
    var lastColumn = sheet.getLastColumn();
    if (!lastColumn) return [];
    return sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(function(header) {
      return String(header || '').trim().toLowerCase();
    });
  }

  function ensureSessionHeaders_(sheet) {
    var expected = ['token', 'userId', 'username', 'role', 'expiresAt', 'issuedAt', 'permissions', 'source'];
    var current = sessionHeaders_(sheet);
    if (!current.length) {
      sheet.getRange(1, 1, 1, expected.length).setValues([expected]);
      return expected.map(function(header) { return header.toLowerCase(); });
    }
    var missing = expected.filter(function(header) { return current.indexOf(header.toLowerCase()) === -1; });
    if (missing.length) {
      sheet.getRange(1, current.length + 1, 1, missing.length).setValues([missing]);
      current = current.concat(missing.map(function(header) { return header.toLowerCase(); }));
    }
    return current;
  }

  function constantTimeEqual_(left, right) {
    if (left.length !== right.length) return false;
    var difference = 0;
    for (var i = 0; i < left.length; i++) {
      difference |= left.charCodeAt(i) ^ right.charCodeAt(i);
    }
    return difference === 0;
  }

  function denied_() {
    return { ok: false, message: 'Acesso Negado' };
  }

  function uuid_() {
    try {
      if (adapters_.uuid) return adapters_.uuid();
      return typeof Utilities !== 'undefined'
        ? Utilities.getUuid().replace(/-/g, '')
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
    } catch (error) {
      Logger.log("Erro em uuid_: " + error.message);
      throw error;
    }
  }

  function now_() {
    return adapters_.now ? adapters_.now() : new Date().getTime();
  }

  var api = {
    configure:              configure,
    login:                  login,
    isAuthenticated:        isAuthenticated,
    isAuthenticatedByToken: isAuthenticatedByToken,
    getUserRole:            getUserRole,
    checkPermission:        checkPermission,
    logout:                 logout
  };
  return api;
}());

var getScriptUrl = (typeof getScriptUrl === 'function') ? getScriptUrl : function () {
  try {
    return ScriptApp.getService().getUrl();
  } catch (e) {
    return '';
  }
};

