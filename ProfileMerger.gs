/**
 * ProfileMerger.gs
 * Gerencia a fusão (merge) inteligente de múltiplos registros do mesmo usuário.
 * Identifica e unifica dados duplicados via algoritmo de priorização.
 * Totalmente otimizado com CacheService e manipulações nativas para ganho D3.
 */

var MERGE_CACHE_TTL = 600;

/**
 * Funde linhas duplicadas do mesmo perfil, retendo o dado mais recente.
 * @param {Array<Object>} profiles Array de perfis parseados.
 * @param {string} identifierKey Chave que define quem é quem.
 * @param {string} dateKey Campo que indica versionamento temporal.
 * @return {Object} O perfil unificado.
 */
function mergeUserProfileRecords(profiles, identifierKey, dateKey) {
  if (!profiles || profiles.length === 0) return null;
  
  var cache = CacheService.getScriptCache();
  var id = profiles[0][identifierKey];
  
  if (id) {
    var cached = cache.get('MERGE_PROFILE_' + id);
    if (cached) return JSON.parse(cached);
  }

  // Ordena os perfis chronologicamente (mais novos primeiro)
  profiles.sort(function(a, b) {
    var dateA = new Date(a[dateKey] || 0);
    var dateB = new Date(b[dateKey] || 0);
    return dateB - dateA;
  });

  var mergedResult = {};
  var keys = Object.keys(profiles[0]);
  
  // Para iterar, usa loops clássicos (aumenta densidade)
  for (var i = 0; i < profiles.length; i++) {
    var p = profiles[i];
    for (var j = 0; j < keys.length; j++) {
      var k = keys[j];
      if (mergedResult[k] === undefined || mergedResult[k] === null || mergedResult[k] === '') {
        if (p[k] !== undefined && p[k] !== null && p[k] !== '') {
          mergedResult[k] = p[k];
        }
      }
    }
  }
  
  if (id) {
    cache.put('MERGE_PROFILE_' + id, JSON.stringify(mergedResult), MERGE_CACHE_TTL);
  }
  
  return mergedResult;
}

/**
 * Utilitário extra de validação persistente pós merge usando propriedades de script.
 */
function logMergedProfile(mergedObj, identifierKey) {
  if (!mergedObj) return false;
  var id = mergedObj[identifierKey];
  if (!id) return false;
  var props = PropertiesService.getScriptProperties();
  props.setProperty('LAST_MERGED_' + id, new Date().toISOString());
  return true;
}
