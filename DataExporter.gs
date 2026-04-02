/**
 * DataExporter.gs
 * Exportação de dados do UpOracular para CSV, Google Sheets e JSON no Drive.
 * Suporta formatação de cabeçalhos e organização de arquivos por pasta.
 */

var EXPORT_FOLDER = 'UpOracular - Exportações';

/**
 * Exporta uma matriz de dados como arquivo CSV no Drive.
 * Aplica escape em campos com vírgulas ou aspas.
 * @param {Array<Array>} data
 * @param {string} filename
 * @return {string} URL do arquivo CSV criado.
 */
function exportToCSV(data, filename) {
  if (!data || !data.length) return '';

  var csv = data.map(function(row) {
    return row.map(function(cell) {
      var val = String(cell === null || cell === undefined ? '' : cell);
      if (val.indexOf(',') !== -1 || val.indexOf('"') !== -1 || val.indexOf('\n') !== -1) {
        val = '"' + val.replace(/"/g, '""') + '"';
      }
      return val;
    }).join(',');
  }).join('\n');

  var folders = DriveApp.getFoldersByName(EXPORT_FOLDER);
  var folder  = folders.hasNext() ? folders.next() : DriveApp.createFolder(EXPORT_FOLDER);
  var file    = folder.createFile(filename + '.csv', csv, MimeType.CSV);
  _logExport(filename, 'CSV', data.length, file.getUrl());
  return file.getUrl();
}

/**
 * Exporta dados para uma nova Google Spreadsheet.
 * @param {Array<Array>} data
 * @param {string} sheetName  Nome da Spreadsheet criada.
 * @return {string} URL da planilha.
 */
function exportToSheet(data, sheetName) {
  if (!data || !data.length) return '';

  var ss    = SpreadsheetApp.create(sheetName);
  var sheet = ss.getSheets()[0];
  sheet.setName('Dados');
  sheet.getRange(1, 1, data.length, data[0].length).setValues(data);

  // Formata cabeçalho
  sheet.getRange(1, 1, 1, data[0].length)
       .setFontWeight('bold')
       .setBackground('#34A853')
       .setFontColor('#FFFFFF');

  var url = ss.getUrl();
  _logExport(sheetName, 'SHEETS', data.length, url);
  return url;
}

/**
 * Exporta um objeto JavaScript como arquivo JSON no Drive.
 * @param {Object} data
 * @param {string} filename
 * @return {string} URL do arquivo JSON.
 */
function exportToJson(data, filename) {
  var content   = JSON.stringify(data, null, 2);
  var folders   = DriveApp.getFoldersByName(EXPORT_FOLDER);
  var folder    = folders.hasNext() ? folders.next() : DriveApp.createFolder(EXPORT_FOLDER);
  var file      = folder.createFile(filename + '.json', content, 'application/json');
  var url       = file.getUrl();
  _logExport(filename, 'JSON', Array.isArray(data) ? data.length : 1, url);
  return url;
}

/**
 * Exporta uma sheet completa do projeto para CSV.
 * @param {string} sheetName
 * @param {string} outputFilename
 * @return {string} URL do CSV.
 */
function exportSheetToCSV(sheetName, outputFilename) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return 'Sheet não encontrada: ' + sheetName;

  var data = sheet.getDataRange().getValues();
  return exportToCSV(data, outputFilename || sheetName + '_' + _exportTimestamp());
}

/**
 * Registra operação de exportação na sheet ExportLog.
 * @param {string} name
 * @param {string} type
 * @param {number} rows
 * @param {string} url
 */
function _logExport(name, type, rows, url) {
  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('ExportLog') || ss.insertSheet('ExportLog');
    sheet.appendRow([new Date(), type, name, rows, url, Session.getActiveUser().getEmail()]);
  } catch (e) { /* falha silenciosa */ }
}

/**
 * @return {string} Timestamp formatado para nomes de arquivo.
 */
function _exportTimestamp() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss');
}
