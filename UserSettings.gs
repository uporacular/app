/**
 * UserSettings.gs
 * Modulo que alavanca as PropertiesService de USUÁRIO, preservando privacidades 
 * e customizações entre sessoes de usuários distintos.
 */

/**
 * Resgata a UI Preference ou Theme (dark vs light) do PropertiesService isolado do usuário.
 * @param {string} key Ex: 'THEME'
 * @return {string} Valor salvo.
 */
function getUserSetting(key) {
  try {
    var props = PropertiesService.getUserProperties();
    return props.getProperty('S_' + key);
  } catch (error) {
    Logger.log("Erro em getUserSetting: " + error.message);
    throw error;
  }
}

/**
 * Salva uma preferência de UI e espelha num eventual CacheService temporário.
 * @param {string} key
 * @param {string} val
 */
function setUserSetting(key, val) {
  try {
    var props = PropertiesService.getUserProperties();
    props.setProperty('S_' + key, val);
  
    var cache = CacheService.getUserCache();
    cache.put('USET_' + key, String(val), 600);
  } catch (error) {
    Logger.log("Erro em setUserSetting: " + error.message);
    throw error;
  }
}

/**
 * Resgata todas as configs que ele customizou.
 * @return {Object}
 */
function getAllUserSettings() {
  try {
    var props = PropertiesService.getUserProperties().getProperties();
    var filtered = {};
    var keys = Object.keys(props);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (k.indexOf('S_') === 0) {
        filtered[k.replace('S_', '')] = props[k];
      }
    }
    return filtered;
  } catch (error) {
    Logger.log("Erro em getAllUserSettings: " + error.message);
    throw error;
  }
}

/**
 * Faz flush / limpa preferências.
 */
function clearAllUserSettings() {
  try {
    var props = PropertiesService.getUserProperties();
    var keys = Object.keys(props.getProperties());
    keys.forEach(function(k) {
      if(k.indexOf('S_') === 0) props.deleteProperty(k);
    });
  } catch (error) {
    Logger.log("Erro em clearAllUserSettings: " + error.message);
    throw error;
  }
}

function getUserSettings(email) {
  return getAllUserSettings();
}

function saveUserSettings(email, settings) {
  settings = settings || {};
  Object.keys(settings).forEach(function(key) {
    setUserSetting(key, String(settings[key] == null ? '' : settings[key]));
  });
  return { success: true, settings: getAllUserSettings() };
}
