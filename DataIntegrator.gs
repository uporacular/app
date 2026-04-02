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
}

/**
 * Harmoniza e resolve conflitos de datasets de diferentes proveniências usando CacheService.
 */
function harmonizeAndResolve(data, fieldMap, key, dateField) {
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
}
