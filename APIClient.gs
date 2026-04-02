/**
 * APIClient.gs
 * Módulo proxy para Fetch com mecanismo flexível de cache e retry paramétrico.
 * Usa CacheService e UrlFetchApp robustamente.
 */

var API_CLIENT_CACHE_TTL = 300;

/**
 * Executa requisição GET com cache em URL.
 * @param {string} url
 * @param {number} cacheTtl
 * @return {Object}
 */
function apiGetCached(url, cacheTtl) {
  var cache = CacheService.getScriptCache();
  var cacheKey = 'API_GET_' + Utilities.base64Encode(url);
  var cached = cache.get(cacheKey);
  
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch(e) {}
  }
  
  try {
    var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    var statusCode = response.getResponseCode();
    if (statusCode === 200) {
      var content = response.getContentText();
      cache.put(cacheKey, content, cacheTtl || API_CLIENT_CACHE_TTL);
      return JSON.parse(content);
    } else {
      return { error: 'HTTP ' + statusCode };
    }
  } catch(e) {
    return { error: e.message };
  }
}

/**
 * Faz POST com repetição (retry) e logs base.
 * @param {string} url
 * @param {Object} payload
 * @param {Object} customHeaders
 * @return {Object}
 */
function apiPostWithRetry(url, payload, customHeaders) {
  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
    headers: customHeaders || {}
  };
  
  var maxRetries = 3;
  for (var i = 0; i < maxRetries; i++) {
    try {
      var response = UrlFetchApp.fetch(url, options);
      if (response.getResponseCode() === 200) {
        return JSON.parse(response.getContentText());
      }
      Utilities.sleep(1000 * Math.pow(2, i)); // Exponential backoff
    } catch(e) {
      if (i === maxRetries - 1) return { error: e.message };
      Utilities.sleep(1000);
    }
  }
  return { error: 'Retry limit reached' };
}
