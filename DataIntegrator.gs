/**
 * DataIntegrator.gs
 * Realiza fusões robustas em larga escala armazenadas no CacheService provisoriamente.
 */

/**
 * Merge com cache. Usa CacheService.
 * @param {Array<Object>} dataset1
 * @param {Array<Object>} dataset2
 * @param {string} key
 * @return {Array<Object>}
 */
function mergeDatasetsCached(dataset1, dataset2, key) {
  try {
    var cache = CacheService.getScriptCache();
    var inputHash = Utilities.base64Encode(JSON.stringify(dataset1[0]) + JSON.stringify(dataset2[0]));
    var cacheKey = 'DATAINT_MERGE_' + inputHash;

    var cached = cache.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch(e){}
    }

    var map = {};
    for(var i=0; i<dataset1.length; i++) {
      var item1 = dataset1[i];
      map[item1[key]] = Object.assign({}, item1);
    }
    for(var j=0; j<dataset2.length; j++) {
      var item2 = dataset2[j];
      if (map[item2[key]]) {
        map[item2[key]] = Object.assign(map[item2[key]], item2);
      } else {
        map[item2[key]] = Object.assign({}, item2);
      }
    }

    var res = Object.keys(map).map(function(k) { return map[k]; });
  
    if (res && res.length > 0) {
      var str = JSON.stringify(res);
      if(str.length < 100000) {
        cache.put(cacheKey, str, 600);
      }
    }
  
    return res;
  } catch (error) {
    Logger.log("Erro em mergeDatasetsCached: " + error.message);
    throw error;
  }
}

/**
 * Harmoniza e resolve conflitos de datasets de diferentes proveniências usando CacheService.
 */
function harmonizeAndResolve(data, fieldMap, key, dateField) {
  try {
    var mapped = data.map(function(item) {
      var newItem = {};
      Object.keys(fieldMap).forEach(function(oldKey) {
        newItem[fieldMap[oldKey]] = item[oldKey];
      });
      return newItem;
    });

    var map = {};
    for(var i=0; i<mapped.length; i++) {
      var item = mapped[i];
      var id = item[key];
      if (!map[id] || new Date(item[dateField]) > new Date(map[id][dateField])) {
        map[id] = item;
      }
    }
    return Object.keys(map).map(function(k) { return map[k]; });
  } catch (error) {
    Logger.log("Erro em harmonizeAndResolve: " + error.message);
    throw error;
  }
}

function mergeDatasets(dataset1, dataset2, key) {
  if (!Array.isArray(dataset1) || !Array.isArray(dataset2)) {
    throw new Error('Os dois datasets devem ser listas JSON.');
  }
  if (!dataset1.length && !dataset2.length) return [];
  if (!key) throw new Error('Informe a chave para o merge.');
  return mergeDatasetsCached(dataset1, dataset2, String(key));
}

function harmonizeRecords(data, fieldMap) {
  if (!Array.isArray(data) || !data.length) return [];
  if (!fieldMap || typeof fieldMap !== 'object') {
    throw new Error('Informe um mapeamento de campos válido.');
  }
  var targets = Object.keys(fieldMap).map(function(oldKey) { return fieldMap[oldKey]; });
  var key = targets.indexOf('id') >= 0 ? 'id' :
    (targets.indexOf('ID') >= 0 ? 'ID' : (targets[0] || Object.keys(data[0])[0]));
  var dateField = targets.filter(function(field) {
    return /updated|modified|created|date|data|timestamp/i.test(String(field));
  })[0] || key;
  return harmonizeAndResolve(data, fieldMap, key, dateField);
}
