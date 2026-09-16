/**
 * SheetFormatter.gs
 * Controle programático da aparência visual do Spreadsheet via SpreadsheetApp APIs.
 */

/**
 * Formata condicionalmente o dashboard baseado no modelo do UpOracular de calor de leitura.
 * Utiliza o CacheService apenas para meta dados da formatação, se necessário.
 * @param {string} sheetName Opcional. Usa ativa se não enviado.
 */
function applyStandardFormatting(sheetName) {
  try {
    var ss = getBoundSpreadsheet_();
    var sheet = sheetName ? ss.getSheetByName(sheetName) : ss.getActiveSheet();
    if (!sheet) return;

    var lastCol = sheet.getLastColumn();
    if (lastCol === 0) return;
  
    // Cabeçalho - Tema UpOracular
    var headerRange = sheet.getRange(1, 1, 1, lastCol);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#2E7D32'); // Verde escolar
    headerRange.setFontColor('#FFFFFF');
  
    // Limpar formatações anteriores via clearFormats, sem deletar data.
    var numRows = sheet.getLastRow();
    if(numRows > 1) {
        var bodyRange = sheet.getRange(2, 1, numRows - 1, lastCol);
        bodyRange.setVerticalAlignment('middle');
        bodyRange.setWrap(true);
    }
  } catch (error) {
    Logger.log("Erro em applyStandardFormatting: " + error.message);
    throw error;
  }
}

/**
 * Pinta de vermelho células vazias em uma coluna obrigatoria (ex: Email ou Titulo).
 * Salva a última data de execução nas Script Properties para não rodar muitas vezes.
 * @param {string} sheetName
 * @param {number} colIdx Index 1-based da coluna a checar.
 */
function highlightEmptyCells(sheetName, colIdx) {
  try {
    try {
      var ss = getBoundSpreadsheet_();
      var sheet = ss.getSheetByName(sheetName);
      if (!sheet) return;
  
      var numRows = sheet.getLastRow();
      if (numRows < 2) return;
  
      var range = sheet.getRange(2, colIdx, numRows - 1, 1);
      var values = range.getValues();
  
      for (var i = 0; i < values.length; i++) {
        if (values[i][0] === '' || values[i][0] === null) {
          sheet.getRange(i + 2, colIdx).setBackground('#FFCDD2'); // Light Red
        }
      }

      var props = PropertiesService.getScriptProperties();
      props.setProperty('LAST_HIGHLIGHT_' + sheetName, new Date().toISOString());
  
      var cache = CacheService.getScriptCache();
      cache.put('FMT_' + sheetName, 'OK', 3600);
    } catch (error) {
      Logger.log("Erro em highlightEmptyCells: " + error.message);
      throw error;
    }
  } catch (error) {
    Logger.log("Erro em highlightEmptyCells: " + error.message);
    throw error;
  }
}
