/**
 * ReadingRecord.gs
 * CRUD completo de registros de leitura no Google Sheets.
 *
 * Esquema da Sheet 'Leituras':
 * [0] id | [1] userId | [2] book | [3] category | [4] date | [5] rating | [6] notes
 * [7] acervoId | [8] author | [9] location | [10] subjects
 */

var READING_RECORD_SHEET = 'Leituras';
var READING_COLS = {
  ID: 0,
  USER_ID: 1,
  BOOK: 2,
  CATEGORY: 3,
  DATE: 4,
  RATING: 5,
  NOTES: 6,
  ACERVO_ID: 7,
  AUTHOR: 8,
  LOCATION: 9,
  SUBJECTS: 10
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function _getSheet_() {
  try {
    var ss = getBoundSpreadsheet_();
    var sheet = ss.getSheetByName(READING_RECORD_SHEET) || ss.insertSheet(READING_RECORD_SHEET);
    _ensureReadingHeader_(sheet);
    return sheet;
  } catch (error) {
    Logger.log("Erro em _getSheet_: " + error.message);
    throw error;
  }
}

function _rowToRecord_(row) {
  return {
    id:       row[READING_COLS.ID],
    userId:   row[READING_COLS.USER_ID],
    book:     row[READING_COLS.BOOK],
    category: row[READING_COLS.CATEGORY],
    date:     row[READING_COLS.DATE],
    rating:   row[READING_COLS.RATING],
    notes:    row[READING_COLS.NOTES],
    acervoId: row[READING_COLS.ACERVO_ID] || '',
    author:   row[READING_COLS.AUTHOR] || '',
    location: row[READING_COLS.LOCATION] || '',
    subjects: row[READING_COLS.SUBJECTS] || ''
  };
}

function _generateId_() {
  return Utilities.getUuid();
}

function _ensureReadingHeader_(sheet) {
  try {
    try {
      if (sheet.getLastRow() > 0) return;
      sheet.appendRow(['id', 'userId', 'book', 'category', 'date', 'rating', 'notes', 'acervoId', 'author', 'location', 'subjects']);
    } catch (error) {
      Logger.log("Erro em _ensureReadingHeader_: " + error.message);
      throw error; // Re-lança para tratamento superior
    }
  } catch (error) {
    Logger.log("Erro em _ensureReadingHeader_: " + error.message);
    throw error;
  }
}

function _mergeAcervoIntoRecord_(record) {
  record = record || {};
  if (!record.acervoId || typeof getAcervoEntryById !== 'function') return record;
  var item = getAcervoEntryById(record.acervoId);
  if (!item) return record;
  record.book = record.book || item.obra || item.titulo || '';
  record.category = record.category || item.categoria || '';
  record.author = record.author || item.autor || '';
  record.location = record.location || item.localizacao || '';
  record.subjects = record.subjects || item.assuntos || '';
  return record;
}

// ─── CREATE ─────────────────────────────────────────────────────────────────

/**
 * Adiciona um novo registro de leitura.
 * @param {Object} record { userId, book, category, date, rating, notes }
 * @return {Object} O registro criado com o id gerado.
 */
function createReadingRecord_(record) {
  try {
    var sheet = _getSheet_();
    record = _mergeAcervoIntoRecord_(record);
    var id = _generateId_();
    sheet.appendRow([
      id,
      record.userId   || '',
      record.book     || '',
      record.category || '',
      record.date     || new Date().toISOString().slice(0, 10),
      record.rating   || '',
      record.notes    || '',
      record.acervoId || '',
      record.author   || '',
      record.location || '',
      record.subjects || ''
    ]);
    return Object.assign({ id: id }, record);
  } catch (error) {
    Logger.log("Erro em createReadingRecord: " + error.message);
    throw error; // Re-lança para tratamento superior
  }
}

// ─── READ ────────────────────────────────────────────────────────────────────

/**
 * Retorna todos os registros de leitura de um usuário.
 * @param {string} userId
 * @return {Array<Object>}
 */
function getReadingRecordsByUser_(userId) {
  try {
    try {
      var sheet = _getSheet_();
      var data = sheet.getDataRange().getValues();
      var records = [];
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][READING_COLS.USER_ID]) === String(userId)) {
          records.push(_rowToRecord_(data[i]));
        }
      }
      return records;
    } catch (error) {
      Logger.log("Erro em getReadingRecordsByUser: " + error.message);
      throw error;
    }
  } catch (error) {
    Logger.log("Erro em getReadingRecordsByUser: " + error.message);
    throw error;
  }
}

/**
 * Retorna um registro pelo seu ID.
 * @param {string} id
 * @return {Object|null}
 */
function getReadingRecordById_(id) {
  try {
    var sheet = _getSheet_();
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][READING_COLS.ID]) === String(id)) {
        return _rowToRecord_(data[i]);
      }
    }
    return null;
  } catch (error) {
    Logger.log("Erro em getReadingRecordById: " + error.message);
    throw error;
  }
}

// ─── UPDATE ──────────────────────────────────────────────────────────────────

/**
 * Atualiza um registro existente pelo ID.
 * @param {string} id
 * @param {Object} updates { book?, category?, date?, rating?, notes? }
 * @return {boolean} true se encontrou e atualizou.
 */
function updateReadingRecord_(id, updates) {
  try {
    try {
      var sheet = _getSheet_();
      updates = _mergeAcervoIntoRecord_(updates || {});
      var data = sheet.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][READING_COLS.ID]) === String(id)) {
          var row = i + 1; // 1-indexed
          if (updates.book     !== undefined) sheet.getRange(row, READING_COLS.BOOK + 1).setValue(updates.book);
          if (updates.category !== undefined) sheet.getRange(row, READING_COLS.CATEGORY + 1).setValue(updates.category);
          if (updates.date     !== undefined) sheet.getRange(row, READING_COLS.DATE + 1).setValue(updates.date);
          if (updates.rating   !== undefined) sheet.getRange(row, READING_COLS.RATING + 1).setValue(updates.rating);
          if (updates.notes    !== undefined) sheet.getRange(row, READING_COLS.NOTES + 1).setValue(updates.notes);
          if (updates.acervoId !== undefined) sheet.getRange(row, READING_COLS.ACERVO_ID + 1).setValue(updates.acervoId);
          if (updates.author   !== undefined) sheet.getRange(row, READING_COLS.AUTHOR + 1).setValue(updates.author);
          if (updates.location !== undefined) sheet.getRange(row, READING_COLS.LOCATION + 1).setValue(updates.location);
          if (updates.subjects !== undefined) sheet.getRange(row, READING_COLS.SUBJECTS + 1).setValue(updates.subjects);
          return true;
        }
      }
      return false;
    } catch (error) {
      Logger.log("Erro em updateReadingRecord: " + error.message);
      throw error; // Re-lança para tratamento superior
    }
  } catch (error) {
    Logger.log("Erro em updateReadingRecord: " + error.message);
    throw error;
  }
}

// ─── DELETE ──────────────────────────────────────────────────────────────────

/**
 * Remove um registro pelo ID.
 * @param {string} id
 * @return {boolean} true se encontrou e deletou.
 */
function deleteReadingRecord_(id) {
  try {
    try {
      try {
        var sheet = _getSheet_();
        var data = sheet.getDataRange().getValues();
        for (var i = 1; i < data.length; i++) {
          if (String(data[i][READING_COLS.ID]) === String(id)) {
            sheet.deleteRow(i + 1);
            return true;
          }
        }
        return false;
      } catch (error) {
        Logger.log("Erro em deleteReadingRecord: " + error.message);
        throw error; // Re-lança para tratamento superior
      }
    } catch (error) {
      Logger.log("Erro em deleteReadingRecord: " + error.message);
      throw error;
    }
  } catch (error) {
    Logger.log("Erro em deleteReadingRecord: " + error.message);
    throw error;
  }
}

// ─── Web App Entry Point ─────────────────────────────────────────────────────

/**
 * Roteador central para chamadas da UI via google.script.run.
 * Retorna JSON serializado para o frontend.
 */
function serveReadingRecordPage(e) {
  try {
    if (e && e.parameter && e.parameter.page === 'features') {
      return HtmlService.createTemplateFromFile('AdminFeatures').evaluate()
        .setTitle('Funcionalidades')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
        .addMetaTag('viewport', 'width=device-width, initial-scale=1');
    }
    return HtmlService.createTemplateFromFile('ReadingRecordHtml').evaluate()
      .setTitle('UpOracular | Registros')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  } catch (error) {
    Logger.log("Erro em serveReadingRecordPage: " + error.message);
    throw error;
  }
}
