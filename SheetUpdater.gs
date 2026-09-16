/**
 * SheetUpdater.gs
 * Operações atômicas e em lote de escrita no Google Sheets.
 * Responsável por toda mutação de dados: células, linhas, upsert e deleção.
 * Invalida entradas de CacheService após cada escrita para manter consistência.
 */

/**
 * Atualiza o valor de uma célula específica numa planilha.
 * @param {string} sheetName
 * @param {number} row   — 1-indexed
 * @param {number} col   — 1-indexed
 * @param {*}      value
 * @return {boolean} Sucesso
 */
function updateCell(sheetName, row, col, value) {
  try {
    var ss = getBoundSpreadsheet_();
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      LoggerService.info('SheetUpdater.updateCell: aba "' + sheetName + '" não encontrada.');
      return false;
    }
    sheet.getRange(row, col).setValue(value);
    _invalidateCacheForSheet_(sheetName);
    return true;
  } catch (error) {
    Logger.log("Erro em updateCell: " + error.message);
    throw error; // Re-lança para tratamento superior
  }
}

/**
 * Atualiza um bloco de células de uma vez (batch) minimizando chamadas à API.
 * @param {string}          sheetName
 * @param {number}          startRow   — 1-indexed
 * @param {number}          startCol   — 1-indexed
 * @param {Array<Array<*>>} values     — matriz de valores
 * @return {boolean} Sucesso
 */
function batchUpdate(sheetName, startRow, startCol, values) {
  try {
    try {
      try {
        if (!values || values.length === 0) return false;
        var ss = getBoundSpreadsheet_();
        var sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
        sheet.getRange(startRow, startCol, values.length, values[0].length).setValues(values);
        _invalidateCacheForSheet_(sheetName);
        return true;
      } catch (error) {
        Logger.log("Erro em batchUpdate: " + error.message);
        throw error; // Re-lança para tratamento superior
      }
    } catch (error) {
      Logger.log("Erro em batchUpdate: " + error.message);
      throw error;
    }
  } catch (error) {
    Logger.log("Erro em batchUpdate: " + error.message);
    throw error;
  }
}

/**
 * Insere ou atualiza uma linha onde o valor na coluna-chave corresponde a keyValue.
 * Se não encontrar, acrescenta uma nova linha no final.
 * @param {string}        sheetName
 * @param {number}        keyCol    — coluna da chave (1-indexed)
 * @param {*}             keyValue  — valor a localizar
 * @param {Array<*>}      rowData   — linha completa de dados
 * @return {{ action: 'updated'|'inserted', row: number }}
 */
function upsertRow(sheetName, keyCol, keyValue, rowData) {
  try {
    try {
      try {
        var ss = getBoundSpreadsheet_();
        var sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
        var data = sheet.getDataRange().getValues();

        for (var i = 1; i < data.length; i++) {
          if (String(data[i][keyCol - 1]) === String(keyValue)) {
            sheet.getRange(i + 1, 1, 1, rowData.length).setValues([rowData]);
            _invalidateCacheForSheet_(sheetName);
            return { action: 'updated', row: i + 1 };
          }
        }

        sheet.appendRow(rowData);
        _invalidateCacheForSheet_(sheetName);
        return { action: 'inserted', row: sheet.getLastRow() };
      } catch (error) {
        Logger.log("Erro em upsertRow: " + error.message);
        throw error; // Re-lança para tratamento superior
      }
    } catch (error) {
      Logger.log("Erro em upsertRow: " + error.message);
      throw error;
    }
  } catch (error) {
    Logger.log("Erro em upsertRow: " + error.message);
    throw error;
  }
}

/**
 * Remove uma linha onde o valor na coluna-chave corresponde a keyValue.
 * @param {string} sheetName
 * @param {number} keyCol    — coluna da chave (1-indexed)
 * @param {*}      keyValue
 * @return {boolean} true se encontrou e removeu
 */
function deleteRowByKey(sheetName, keyCol, keyValue) {
  try {
    try {
      try {
        var ss = getBoundSpreadsheet_();
        var sheet = ss.getSheetByName(sheetName);
        if (!sheet) return false;

        var data = sheet.getDataRange().getValues();
        for (var i = data.length - 1; i >= 1; i--) {
          if (String(data[i][keyCol - 1]) === String(keyValue)) {
            sheet.deleteRow(i + 1);
            _invalidateCacheForSheet_(sheetName);
            return true;
          }
        }
        return false;
      } catch (error) {
        Logger.log("Erro em deleteRowByKey: " + error.message);
        throw error; // Re-lança para tratamento superior
      }
    } catch (error) {
      Logger.log("Erro em deleteRowByKey: " + error.message);
      throw error;
    }
  } catch (error) {
    Logger.log("Erro em deleteRowByKey: " + error.message);
    throw error;
  }
}

/**
 * Acrescenta múltiplas linhas de uma vez no final da planilha (bulk insert).
 * @param {string}          sheetName
 * @param {Array<Array<*>>} rows
 * @return {number} Número de linhas inseridas
 */
function appendRows(sheetName, rows) {
  try {
    try {
      try {
        if (!rows || rows.length === 0) return 0;
        var ss = getBoundSpreadsheet_();
        var sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
        var lastRow = sheet.getLastRow();
        sheet.getRange(lastRow + 1, 1, rows.length, rows[0].length).setValues(rows);
        _invalidateCacheForSheet_(sheetName);
        return rows.length;
      } catch (error) {
        Logger.log("Erro em appendRows: " + error.message);
        throw error; // Re-lança para tratamento superior
      }
    } catch (error) {
      Logger.log("Erro em appendRows: " + error.message);
      throw error;
    }
  } catch (error) {
    Logger.log("Erro em appendRows: " + error.message);
    throw error;
  }
}

/**
 * Invalida entradas de cache relacionadas a uma planilha específica.
 * @param {string} sheetName
 */
function _invalidateCacheForSheet_(sheetName) {
  try {
    var cache = CacheService.getScriptCache();
    var keysToRemove = [
      'GLOBAL_TRENDS',
      'PATTERNS_*',
      sheetName + '_DATA'
    ];
    // CacheService não suporta wildcard — remove as chaves conhecidas
    cache.removeAll(keysToRemove.filter(function(k) { return k.indexOf('*') === -1; }));
  } catch (error) {
    Logger.log("Erro em _invalidateCacheForSheet_: " + error.message);
    throw error;
  }
}
