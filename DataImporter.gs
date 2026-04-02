/**
 * DataImporter.gs
 * Importação e ingestão de dados de fontes externas para o UpOracular.
 * Suporta CSV do Drive, Google Sheets externas e JSON via URL.
 */

var IMPORT_LOG_SHEET = 'ImportLog';

/**
 * Importa dados de um arquivo CSV no Drive e retorna como Array<Array>.
 * Aplica limpeza básica (remove linhas vazias, trim).
 * @param {string} fileId
 * @return {Array<Array>}
 */
function importFromCSV(fileId) {
  var file    = DriveApp.getFileById(fileId);
  var content = file.getBlob().getDataAsString('UTF-8');
  var parsed  = Utilities.parseCsv(content);
  var cleaned = parsed.filter(function(row) {
    return row.some(function(cell) { return cell && cell.trim() !== ''; });
  });
  _logImport(fileId, 'CSV', cleaned.length);
  return cleaned;
}

/**
 * Importa dados de uma Google Sheet externa (primeira aba).
 * @param {string} sheetId
 * @param {string} sheetName  Opcional — usa a primeira aba se omitido.
 * @return {Array<Array>}
 */
function importFromSheet(sheetId, sheetName) {
  var ss    = SpreadsheetApp.openById(sheetId);
  var sheet = sheetName ? ss.getSheetByName(sheetName) : ss.getSheets()[0];
  if (!sheet) return [];
  var data  = sheet.getDataRange().getValues();
  _logImport(sheetId, 'SHEETS', data.length);
  return data;
}

/**
 * Importa JSON via HTTP (UrlFetchApp) e retorna objeto parseado.
 * @param {string} url
 * @param {Object} options  Parâmetros opcionais para UrlFetchApp.fetch.
 * @return {Object|Array|null}
 */
function importFromJson(url, options) {
  try {
    var response = UrlFetchApp.fetch(url, options || { muteHttpExceptions: true });
    var code     = response.getResponseCode();
    if (code !== 200) {
      _logImport(url, 'JSON_ERROR', 0);
      return null;
    }
    var data = JSON.parse(response.getContentText());
    _logImport(url, 'JSON', Array.isArray(data) ? data.length : 1);
    return data;
  } catch (e) {
    _logImport(url, 'JSON_EXCEPTION', 0);
    return null;
  }
}

/**
 * Importa CSV e aplica os dados em uma sheet de destino.
 * Limpa o conteúdo anterior antes de escrever.
 * @param {string} fileId    ID do arquivo CSV no Drive.
 * @param {string} sheetName Nome da sheet de destino.
 * @return {number} Linhas escritas.
 */
function importCsvToSheet(fileId, sheetName) {
  var data  = importFromCSV(fileId);
  if (!data || !data.length) return 0;

  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
  sheet.clearContents();
  sheet.getRange(1, 1, data.length, data[0].length).setValues(data);
  CacheService.getScriptCache().remove('SC_DATA_' + sheetName);
  return data.length;
}

/**
 * Registra operação de importação no ImportLog.
 * @param {string} source
 * @param {string} type
 * @param {number} rowCount
 */
function _logImport(source, type, rowCount) {
  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(IMPORT_LOG_SHEET) || ss.insertSheet(IMPORT_LOG_SHEET);
    sheet.appendRow([new Date(), type, source, rowCount, Session.getActiveUser().getEmail()]);
  } catch (e) { /* falha silenciosa */ }
}
