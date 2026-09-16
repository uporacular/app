/**
 * ConfigManager.gs
 * Gerencia configurações globais do sistema via PropertiesService e CacheService.
 * Implementa cache distribuído para acesso otimizado em alta frequência.
 */

var CONFIG_NS = 'UPOR_CFG_';
var CONFIG_CACHE_TTL = 3600;

/**
 * Salva uma configuração no PropertiesService e atualiza o CacheService.
 * @param {string} key
 * @param {string|Object} value
 */
function setConfig(key, value) {
  try {
    var props = PropertiesService.getScriptProperties();
    var cache = CacheService.getScriptCache();
    var strValue = (typeof value === 'object') ? JSON.stringify(value) : String(value);

    props.setProperty(key, strValue);
    cache.put(CONFIG_NS + key, strValue, CONFIG_CACHE_TTL);
  } catch (error) {
    Logger.log("Erro em setConfig: " + error.message);
    throw error;
  }
}

/**
 * Recupera configuração com fallback: CacheService -> PropertiesService.
 * @param {string} key
 * @return {string|null}
 */
function getConfig(key) {
  try {
    var cache = CacheService.getScriptCache();
    var cached = cache.get(CONFIG_NS + key);
  
    if (cached !== null) {
      return cached;
    }
  
    var props = PropertiesService.getScriptProperties();
    var propVal = props.getProperty(key);
  
    if (propVal !== null) {
      cache.put(CONFIG_NS + key, propVal, CONFIG_CACHE_TTL);
    }
  
    return propVal;
  } catch (error) {
    Logger.log("Erro em getConfig: " + error.message);
    throw error;
  }
}

/**
 * Remove uma configuração de todos os storages.
 * @param {string} key
 */
function removeConfig(key) {
  try {
    try {
      PropertiesService.getScriptProperties().deleteProperty(key);
      CacheService.getScriptCache().remove(CONFIG_NS + key);
    } catch (error) {
      Logger.log("Erro em removeConfig: " + error.message);
      throw error; // Re-lança para tratamento superior
    }
  } catch (error) {
    Logger.log("Erro em removeConfig: " + error.message);
    throw error;
  }
}

/**
 * Recupera múltiplas configurações simultaneamente de forma otimizada.
 * @param {Array<string>} keys
 * @return {Object}
 */
function getMultipleConfigs(keys) {
  try {
    var cache = CacheService.getScriptCache();
    var cacheKeys = keys.map(function(k) { return CONFIG_NS + k; });
    var cachedMap = cache.getAll(cacheKeys);
    var result = {};
    var missing = [];

    keys.forEach(function(k) {
      var cVal = cachedMap[CONFIG_NS + k];
      if (cVal !== undefined) {
        result[k] = cVal;
      } else {
        missing.push(k);
      }
    });

    if (missing.length > 0) {
      var props = PropertiesService.getScriptProperties().getProperties();
      var toCache = {};
      missing.forEach(function(k) {
        var pVal = props[k];
        if (pVal !== undefined) {
          result[k] = pVal;
          toCache[CONFIG_NS + k] = pVal;
        }
      });
      if (Object.keys(toCache).length > 0) {
        cache.putAll(toCache, CONFIG_CACHE_TTL);
      }
    }

    return result;
  } catch (error) {
    Logger.log("Erro em getMultipleConfigs: " + error.message);
    throw error;
  }
}
