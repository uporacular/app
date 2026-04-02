/**
 * ReportGenerator.gs
 * Geração automática de relatórios de leituras, recomendações e uso do sistema.
 * Persiste relatórios no Drive e registra em ReportLog para rastreabilidade.
 */

var REPORT_FOLDER_NAME = 'UpOracular - Relatórios';

/**
 * Gera uma nova Spreadsheet com o histórico de leituras do usuário.
 * @param {string} userId  E-mail do usuário.
 * @return {string} URL da planilha gerada.
 */
function generateUserReadingReport(userId) {
  var records = getReadingRecordsByUser(userId);
  if (!records || !records.length) return 'Nenhum registro encontrado para: ' + userId;

  var header = [['ID', 'Usuário', 'Livro', 'Categoria', 'Data', 'Nota']];
  var rows   = records.map(function(r) {
    return [r.id || '', r.userId || userId, r.book || '', r.category || '', r.date || '', r.nota || ''];
  });
  var data = header.concat(rows);

  var ss    = SpreadsheetApp.create('Relatório de Leituras — ' + userId + ' — ' + _today());
  var sheet = ss.getSheets()[0];
  sheet.setName('Leituras');
  sheet.getRange(1, 1, data.length, data[0].length).setValues(data);
  _formatHeaderRow(sheet, data[0].length);

  var url = ss.getUrl();
  _moveReportToDrive(ss.getId());
  _logReport(userId, 'LEITURAS_USUARIO', url);
  return url;
}

/**
 * Gera relatório consolidado de leituras por turma.
 * @param {string} turma  Ex: '4A'
 * @return {string} URL da planilha.
 */
function generateClassReport(turma) {
  var ss        = SpreadsheetApp.getActiveSpreadsheet();
  var perfis    = ss.getSheetByName('Perfis');
  var leituras  = ss.getSheetByName('Leituras');
  if (!perfis || !leituras) return 'Sheets não encontradas.';

  var perfisData   = perfis.getDataRange().getValues();
  var leiturasData = leituras.getDataRange().getValues();

  // Coleta e-mails da turma
  var emails = {};
  for (var i = 1; i < perfisData.length; i++) {
    if (String(perfisData[i][0]).toUpperCase() === turma.toUpperCase()) {
      emails[String(perfisData[i][2]).toLowerCase()] = String(perfisData[i][1]);
    }
  }

  // Filtra leituras da turma
  var rows = [['Nome', 'Email', 'Livro', 'Categoria', 'Data']];
  for (var j = 1; j < leiturasData.length; j++) {
    var email = String(leiturasData[j][1]).toLowerCase();
    if (emails[email]) {
      rows.push([emails[email], email, leiturasData[j][2], leiturasData[j][3], leiturasData[j][4]]);
    }
  }

  var report  = SpreadsheetApp.create('Relatório Turma ' + turma + ' — ' + _today());
  var rSheet  = report.getSheets()[0];
  rSheet.setName('Turma ' + turma);
  rSheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  _formatHeaderRow(rSheet, rows[0].length);

  var url = report.getUrl();
  _moveReportToDrive(report.getId());
  _logReport('turma:' + turma, 'TURMA', url);
  return url;
}

/**
 * Registra a geração de um relatório na sheet ReportLog.
 * @param {string} userId
 * @param {string} tipo
 * @param {string} url
 */
function _logReport(userId, tipo, url) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('ReportLog') || ss.insertSheet('ReportLog');
  sheet.appendRow([new Date(), userId, tipo, url]);
}

/**
 * Move o arquivo para a pasta de relatórios no Drive.
 * Cria a pasta se não existir.
 * @param {string} fileId
 */
function _moveReportToDrive(fileId) {
  var folders = DriveApp.getFoldersByName(REPORT_FOLDER_NAME);
  var folder  = folders.hasNext() ? folders.next() : DriveApp.createFolder(REPORT_FOLDER_NAME);
  var file    = DriveApp.getFileById(fileId);
  folder.addFile(file);
  DriveApp.getRootFolder().removeFile(file);
}

/**
 * Aplica formatação negrito à primeira linha (cabeçalho).
 * @param {Sheet} sheet
 * @param {number} numCols
 */
function _formatHeaderRow(sheet, numCols) {
  sheet.getRange(1, 1, 1, numCols).setFontWeight('bold').setBackground('#E8F0FE');
}

/**
 * @return {string} Data no formato YYYY-MM-DD.
 */
function _today() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}
