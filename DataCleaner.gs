/**
 * DataCleaner.gs
 * Limpeza, normalização e deduplicação de dados nas sheets do UpOracular.
 * Garante integridade dos dados antes de análise e recomendação.
 */

/**
 * Remove linhas completamente vazias de uma matriz de dados.
 * @param {Array<Array>} data
 * @return {Array<Array>}
 */
function removeEmptyRows(data) {
  try {
    return data.filter(function(row) {
      return row.some(function(cell) {
        return cell !== '' && cell !== null && cell !== undefined;
      });
    });
  } catch (error) {
    Logger.log("Erro em removeEmptyRows: " + error.message);
    throw error;
  }
}

/**
 * Remove colunas completamente vazias de uma matriz de dados.
 * @param {Array<Array>} data
 * @return {Array<Array>}
 */
function removeEmptyColumns(data) {
  try {
    if (!data.length) return data;
    var colsToKeep = data[0].map(function(_, colIdx) {
      return data.some(function(row) {
        return row[colIdx] !== '' && row[colIdx] !== null && row[colIdx] !== undefined;
      });
    });
    return data.map(function(row) {
      return row.filter(function(_, colIdx) { return colsToKeep[colIdx]; });
    });
  } catch (error) {
    Logger.log("Erro em removeEmptyColumns: " + error.message);
    throw error;
  }
}

/**
 * Normaliza uma string: trim, lowercase, remove acentos.
 * @param {string} str
 * @return {string}
 */
function normalizeString(str) {
  try {
    if (!str) return '';
    return String(str).trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  } catch (error) {
    Logger.log("Erro em normalizeString: " + error.message);
    throw error;
  }
}

/**
 * Remove linhas duplicadas de uma sheet, preservando a primeira ocorrência.
 * Usa a coluna `keyColumnIndex` como chave de dedup.
 * @param {string} sheetName
 * @param {number} keyColumnIndex  0-based.
 * @return {number} Quantidade de duplicatas removidas.
 */
function deduplicateSheet(sheetName, keyColumnIndex) {
  try {
    var ss    = getBoundSpreadsheet_();
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return 0;

    var data   = sheet.getDataRange().getValues();
    var header = data[0];
    var rows   = data.slice(1);
    var seen   = {};
    var unique = [];

    rows.forEach(function(row) {
      var key = normalizeString(String(row[keyColumnIndex] || ''));
      if (!seen[key]) {
        seen[key] = true;
        unique.push(row);
      }
    });

    var removed = rows.length - unique.length;
    if (removed > 0) {
      sheet.clearContents();
      var final = [header].concat(unique);
      sheet.getRange(1, 1, final.length, final[0].length).setValues(final);
      CacheService.getScriptCache().remove('SC_DATA_' + sheetName);
    }
    return removed;
  } catch (error) {
    Logger.log("Erro em deduplicateSheet: " + error.message);
    throw error;
  }
}

/**
 * Normaliza os e-mails na sheet 'Perfis' para lowercase+trim.
 * @return {number} Quantidade de células corrigidas.
 */
function normalizeProfileEmails() {
  try {
    var ss     = getBoundSpreadsheet_();
    var sheet  = ss.getSheetByName('Perfis');
    if (!sheet) return 0;

    var data    = sheet.getDataRange().getValues();
    var fixed   = 0;
    var EMAIL_COL = 2; // coluna C

    for (var i = 1; i < data.length; i++) {
      var raw       = String(data[i][EMAIL_COL] || '').trim().toLowerCase();
      var original  = String(data[i][EMAIL_COL]);
      if (raw !== original && raw !== '') {
        sheet.getRange(i + 1, EMAIL_COL + 1).setValue(raw);
        fixed++;
      }
    }
    if (fixed > 0) CacheService.getScriptCache().remove('SC_DATA_Perfis');
    return fixed;
  } catch (error) {
    Logger.log("Erro em normalizeProfileEmails: " + error.message);
    throw error;
  }
}

/**
 * Executa todas as rotinas de limpeza de forma consolidada.
 * @return {Object} Resumo das operações realizadas.
 */
function runFullCleanup() {
  try {
    var dupLeituras = deduplicateSheet('Leituras', 0);
    var dupPerfis   = deduplicateSheet('Perfis', 2);
    var emailsFixed = normalizeProfileEmails();

    return {
      duplicatasLeituras: dupLeituras,
      duplicatasPerfis:   dupPerfis,
      emailsCorrigidos:   emailsFixed,
      executadoEm:        new Date().toISOString()
    };
  } catch (error) {
    Logger.log("Erro em runFullCleanup: " + error.message);
    throw error;
  }
}
