/**
 * 00_SpreadsheetResolver.gs — Up Oracular
 *
 * Resolvedor robusto de planilha para contexto WEBAPP/standalone.
 *
 * Em deployment de web app (nao container-bound), SpreadsheetApp
 * .getActiveSpreadsheet() retorna null, e qualquer null.getSheetByName(...)
 * derruba o fluxo — inclusive o login ("Erro ao processar login: Cannot read
 * properties of null (reading 'getSheetByName')").
 *
 * Este helper resolve o ID da planilha via Script Properties (SPREADSHEETS_ID
 * ou SPREADSHEET_ID) / CONFIG / getSpreadsheetId() antes de cair em
 * getActiveSpreadsheet(). O prefixo "00_" garante avaliacao antecipada.
 */
function getBoundSpreadsheet_() {
  try {
    if (typeof getSpreadsheetId === 'function') {
      var idFromFunction = getSpreadsheetId();
      if (idFromFunction) return SpreadsheetApp.openById(idFromFunction);
    }
    if (typeof CONFIG !== 'undefined' && CONFIG.SPREADSHEET_ID) {
      return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    }
    if (typeof Config !== 'undefined' && Config.SPREADSHEET_ID) {
      return SpreadsheetApp.openById(Config.SPREADSHEET_ID);
    }
    var props = PropertiesService.getScriptProperties();
    var idFromProperties = props.getProperty('SPREADSHEETS_ID') || props.getProperty('SPREADSHEET_ID');
    if (idFromProperties) return SpreadsheetApp.openById(idFromProperties);

    var active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
    throw new Error('Planilha indisponivel: defina a Script Property SPREADSHEETS_ID.');
  } catch (error) {
    Logger.log("Erro em getBoundSpreadsheet_: " + error.message);
    throw error;
  }
}
