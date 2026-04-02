/**
 * UserProfile.gs
 * Módulo para resgatar dados do perfil ativo via CacheService rápido, 
 * cruzado com Sheets de background.
 */

var PROFILE_CACHE_TTL = 3600;

/**
 * Resgata o perfil unificado do usuário.
 * @param {string} email
 * @return {Object|null}
 */
function getUserProfileData(email) {
  if (!email) return null;
  
  var cache = CacheService.getScriptCache();
  var cached = cache.get('USER_PROF_' + email);
  if (cached) return JSON.parse(cached);
  
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Perfis');
  if (!sheet) return null;
  
  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function(h){return h.toString().toLowerCase();});
  
  var emailIdx = headers.indexOf('email');
  if (emailIdx === -1) return null;
  
  var profile = null;
  
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][emailIdx]).toLowerCase() === email.toLowerCase()) {
      profile = {};
      for (var col = 0; col < headers.length; col++) {
        profile[headers[col]] = data[i][col];
      }
      break;
    }
  }
  
  if (profile) {
    cache.put('USER_PROF_' + email, JSON.stringify(profile), PROFILE_CACHE_TTL);
  }
  
  return profile;
}

/**
 * Limpa o cache para recarregamento hard.
 * @param {string} email
 */
function clearUserProfileCache(email) {
  var cache = CacheService.getScriptCache();
  cache.remove('USER_PROF_' + email);
}
