/**
 * AnalyticsEngine.gs
 * Processamento pesado de relatórios analíticos, agregando dados de Sheets e CacheService.
 * Faz caches otimizados para cálculos complexos.
 */

var ANALYTICS_CACHE_TTL = 3600;

/**
 * Cachea e retorna estatísticas completas processadas em dataset complexo.
 * @param {Array<number>} data
 * @param {string} cacheKey Opcional
 * @return {Object}
 */
function cachedBasicStats(data, cacheKey) {
  var cache = CacheService.getScriptCache();
  if (cacheKey) {
    var cached = cache.get('STATS_' + cacheKey);
    if (cached) return JSON.parse(cached);
  }

  var sum = 0, min = Number.MAX_VALUE, max = -Number.MAX_VALUE;
  
  if (!data || data.length === 0) return {};
  
  for (var i = 0; i < data.length; i++) {
    var val = data[i];
    sum += val;
    if (val < min) min = val;
    if (val > max) max = val;
  }
  
  var result = {
    sum: sum,
    avg: sum / data.length,
    min: min,
    max: max,
    processedAt: new Date().toISOString()
  };

  if (cacheKey) {
    cache.put('STATS_' + cacheKey, JSON.stringify(result), ANALYTICS_CACHE_TTL);
  }
  
  return result;
}

/**
 * Agregação profunda simulando Map-Reduce native em sheets grandes.
 * @param {Array<Object>} dataset
 * @param {string} groupKey
 * @param {string} aggKey
 * @return {Object}
 */
function mapReduceGroupStats(dataset, groupKey, aggKey) {
  if (!dataset || dataset.length === 0) return {};
  
  var grouped = {};
  
  dataset.forEach(function(row) {
    var key = row[groupKey];
    var val = row[aggKey] || 0;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(val);
  });
  
  var output = {};
  var keys = Object.keys(grouped);
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    output[k] = cachedBasicStats(grouped[k]);
  }
  
  return output;
}

/**
 * Reporta tendências em séries temporais.
 * @param {Array<number>} data
 * @return {string}
 */
function trendReport(data) {
  if (!data || data.length < 2) return 'Insuficiente';
  var diff = data[data.length - 1] - data[0];
  if (diff > 0) return 'Crescimento';
  if (diff < 0) return 'Queda';
  return 'Estável';
}
