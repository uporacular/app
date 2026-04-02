/**
 * ProfileUpdater.gs
 * Atualização contínua das Properties de usuário e cache de perfis persistentes.
 * Integra de volta com SpreadsheetApp e PropertiesService simultaneamente.
 */

/**
 * Atualiza propriedades parciais do perfil no Google Sheet e nos Caches.
 * @param {string} email E-mail único de index.
 * @param {Object} propsToUpdate Dicionário de campos = novo valor.
 * @return {boolean}
 */
function updateUserProfileValues(email, propsToUpdate) {
  if (!email || !propsToUpdate) return false;
  
  // 1. Limpar caches vinculados ao usuário
  var cache = CacheService.getScriptCache();
  cache.remove('MERGE_PROFILE_' + email);
  cache.remove('SC_DATA_Perfis'); // do SheetConnector
  
  // 2. Acha a row no Spreadsheet
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Perfis');
  if (!sheet) return false;
  
  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function(h) { return String(h).toUpperCase(); });
  var emailIdx = headers.indexOf('EMAIL');
  if (emailIdx === -1) return false;
  
  var updated = false;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][emailIdx]).toLowerCase() === email.toLowerCase()) {
      var keys = Object.keys(propsToUpdate);
      keys.forEach(function(k) {
        var hIdx = headers.indexOf(k.toUpperCase());
        if (hIdx !== -1) {
          data[i][hIdx] = propsToUpdate[k];
          sheet.getRange(i + 1, hIdx + 1).setValue(propsToUpdate[k]);
          updated = true;
        }
      });
      break; 
    }
  }
  
  return updated;
}

/**
 * Cria ou revalida o Profile com inserção atômica no Properties.
 */
function touchUserProfile(email) {
  var props = PropertiesService.getUserProperties();
  props.setProperty('LAST_LOGIN_TOUCH_' + email, new Date().toISOString());
  return true;
}
