/**
 * SheetConnector.gs
 * Módulo de acesso de baixo nível ao Google Sheets.
 * Fornece leitura, escrita, busca e manipulação de linhas com suporte a cache.
 */

var SC_CACHE_TTL = 300; // 5 min

/**
 * Retorna todos os dados de uma sheet como Array<Array>.
 * Usa CacheService para leituras repetidas dentro da mesma execução.
 * @param {string} sheetName
 * @return {Array<Array>}
 */
function getSheetData(sheetName) {
  var cache   = CacheService.getScriptCache();
  var cacheKey = 'SC_DATA_' + sheetName;
  var cached  = cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];

  var data = sheet.getDataRange().getValues();
  cache.put(cacheKey, JSON.stringify(data), SC_CACHE_TTL);
  return data;
}

/**
 * Retorna dados como array de objetos usando a primeira linha como cabeçalho.
 * @param {string} sheetName
 * @return {Array<Object>}
 */
function getSheetAsObjects(sheetName) {
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
}

/**
 * Sobrescreve completamente os dados de uma sheet.
 * @param {string} sheetName
 * @param {Array<Array>} data  (inclui cabeçalho na linha 0)
 * @return {boolean}
 */
function setSheetData(sheetName, data) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
  sheet.clearContents();
  if (data && data.length) {
    sheet.getRange(1, 1, data.length, data[0].length).setValues(data);
    _invalidateCache(sheetName);
    return true;
  }
  return false;
}

/**
 * Adiciona uma linha ao final de uma sheet.
 * @param {string} sheetName
 * @param {Array} row
 */
function appendSheetRow(sheetName, row) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
  sheet.appendRow(row);
  _invalidateCache(sheetName);
}

/**
 * Busca linhas que satisfaçam um predicado.
 * @param {string} sheetName
 * @param {Function} predicate  fn(row: Array) => boolean
 * @return {Array<Array>}
 */
function findSheetRows(sheetName, predicate) {
  var data = getSheetData(sheetName);
  if (data.length < 2) return [];
  return data.slice(1).filter(predicate);
}

/**
 * Retorna o índice (0-based) de uma coluna pelo nome no cabeçalho.
 * @param {string} sheetName
 * @param {string} colName
 * @return {number} -1 se não encontrado.
 */
function getColumnIndex(sheetName, colName) {
  var data = getSheetData(sheetName);
  if (!data.length) return -1;
  var headers = data[0].map(function(h) { return String(h).trim().toLowerCase(); });
  return headers.indexOf(colName.toLowerCase());
}

/**
 * Invalida o cache da sheet para forçar re-leitura.
 * @param {string} sheetName
 */
function _invalidateCache(sheetName) {
  var cache = CacheService.getScriptCache();
  cache.remove('SC_DATA_' + sheetName);
}
