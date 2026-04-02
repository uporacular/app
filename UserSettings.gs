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
  var props = PropertiesService.getUserProperties();
  return props.getProperty('S_' + key);
}

/**
 * Salva uma preferência de UI e espelha num eventual CacheService temporário.
 * @param {string} key
 * @param {string} val
 */
function setUserSetting(key, val) {
  var props = PropertiesService.getUserProperties();
  props.setProperty('S_' + key, val);
  
  var cache = CacheService.getUserCache();
  cache.put('USET_' + key, String(val), 600);
}

/**
 * Resgata todas as configs que ele customizou.
 * @return {Object}
 */
function getAllUserSettings() {
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
}

/**
 * Faz flush / limpa preferências.
 */
function clearAllUserSettings() {
  var props = PropertiesService.getUserProperties();
  var keys = Object.keys(props.getProperties());
  keys.forEach(function(k) {
    if(k.indexOf('S_') === 0) props.deleteProperty(k);
  });
}
