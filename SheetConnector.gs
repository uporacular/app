/**
 * SheetConnector.gs
 * Módulo de acesso de baixo nível ao Google Sheets.
 * Fornece leitura, escrita, busca e manipulação de linhas com suporte a cache.
 */

var SC_CACHE_TTL = 300; // 5 min

function withSheetWriteLock_(operationName, callback) {
  try {
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) throw new Error('Nao foi possivel obter lock para ' + operationName + '.');
    try {
      return callback();
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    Logger.log("Erro em withSheetWriteLock_: " + error.message);
    throw error;
  }
}

/**
 * Retorna todos os dados de uma sheet como Array<Array>.
 * Usa CacheService para leituras repetidas dentro da mesma execução.
 * @param {string} sheetName
 * @return {Array<Array>}
 */
function getSheetData(sheetName, options) {
  try {
    try {
      options = options || {};
      var cache   = CacheService.getScriptCache();
      var cacheKey = 'SC_DATA_' + sheetName + ':' + JSON.stringify({ limit: options.limit || null });
      if (!options.noCache) {
        var cached  = cache.get(cacheKey);
        if (cached) return JSON.parse(cached);
      }

      var ss    = getBoundSpreadsheet_();
      var sheet = ss.getSheetByName(sheetName);
      if (!sheet) return [];

      var lastRow = sheet.getLastRow();
      var lastColumn = sheet.getLastColumn();
      if (lastRow < 1 || lastColumn < 1) return [];
      var data;
      if (options.limit && lastRow > 1) {
        var limit = Math.max(1, Math.min(Number(options.limit), 1000));
        var dataRows = Math.min(limit, lastRow - 1);
        var startRow = Math.max(2, lastRow - dataRows + 1);
        data = [sheet.getRange(1, 1, 1, lastColumn).getValues()[0]]
          .concat(sheet.getRange(startRow, 1, dataRows, lastColumn).getValues());
      } else {
        data = sheet.getRange(1, 1, lastRow, lastColumn).getValues();
      }
      if (!options.noCache) cache.put(cacheKey, JSON.stringify(data), SC_CACHE_TTL);
      return data;
    } catch (error) {
      Logger.log("Erro em getSheetData: " + error.message);
      throw error;
    }
  } catch (error) {
    Logger.log("Erro em getSheetData: " + error.message);
    throw error;
  }
}

/**
 * Retorna dados como array de objetos usando a primeira linha como cabeçalho.
 * @param {string} sheetName
 * @return {Array<Object>}
 */
function getSheetAsObjects(sheetName) {
  try {
    var data = getSheetData(sheetName);
    if (data.length < 2) return [];

    var headers = data[0].map(function(h) { return String(h).trim(); });
    return data.slice(1).filter(function(row) {
      return row.some(function(cell) { return cell !== '' && cell !== null; });
    }).map(function(row) {
      var obj = {};
      headers.forEach(function(h, i) { obj[h] = row[i]; });
      return obj;
    });
  } catch (error) {
    Logger.log("Erro em getSheetAsObjects: " + error.message);
    throw error;
  }
}

/**
 * Sobrescreve completamente os dados de uma sheet.
 * @param {string} sheetName
 * @param {Array<Array>} data  (inclui cabeçalho na linha 0)
 * @return {boolean}
 */
function setSheetData(sheetName, data) {
  try {
    return withSheetWriteLock_('setSheetData:' + sheetName, function() {
      var ss    = getBoundSpreadsheet_();
      var sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
      sheet.clearContents();
      if (data && data.length) {
        sheet.getRange(1, 1, data.length, data[0].length).setValues(data);
        _invalidateCache(sheetName);
        return true;
      }
      _invalidateCache(sheetName);
      return false;
    });
  } catch (error) {
    Logger.log("Erro em setSheetData: " + error.message);
    throw error; // Re-lança para tratamento superior
  }
}

/**
 * Adiciona uma linha ao final de uma sheet.
 * @param {string} sheetName
 * @param {Array} row
 */
function appendSheetRow(sheetName, row) {
  try {
    try {
      return withSheetWriteLock_('appendSheetRow:' + sheetName, function() {
        var ss    = getBoundSpreadsheet_();
        var sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
        sheet.appendRow(row);
        _invalidateCache(sheetName);
        return row;
      });
    } catch (error) {
      Logger.log("Erro em appendSheetRow: " + error.message);
      throw error; // Re-lança para tratamento superior
    }
  } catch (error) {
    Logger.log("Erro em appendSheetRow: " + error.message);
    throw error;
  }
}

/**
 * Busca linhas que satisfaçam um predicado.
 * @param {string} sheetName
 * @param {Function} predicate  fn(row: Array) => boolean
 * @return {Array<Array>}
 */
function findSheetRows(sheetName, predicate) {
  try {
    var data = getSheetData(sheetName);
    if (data.length < 2) return [];
    return data.slice(1).filter(predicate);
  } catch (error) {
    Logger.log("Erro em findSheetRows: " + error.message);
    throw error;
  }
}

/**
 * Retorna o índice (0-based) de uma coluna pelo nome no cabeçalho.
 * @param {string} sheetName
 * @param {string} colName
 * @return {number} -1 se não encontrado.
 */
function getColumnIndex(sheetName, colName) {
  try {
    var data = getSheetData(sheetName);
    if (!data.length) return -1;
    var headers = data[0].map(function(h) { return String(h).trim().toLowerCase(); });
    return headers.indexOf(colName.toLowerCase());
  } catch (error) {
    Logger.log("Erro em getColumnIndex: " + error.message);
    throw error;
  }
}

/**
 * Invalida o cache da sheet para forçar re-leitura.
 * @param {string} sheetName
 */
function _invalidateCache(sheetName) {
  try {
    var cache = CacheService.getScriptCache();
    cache.remove('SC_DATA_' + sheetName);
    cache.remove('SC_DATA_' + sheetName + ':' + JSON.stringify({ limit: null }));
  } catch (error) {
    Logger.log("Erro em _invalidateCache: " + error.message);
    throw error;
  }
}
