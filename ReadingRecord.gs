/**
 * ReadingRecord.gs
 * CRUD completo de registros de leitura no Google Sheets.
 *
 * Esquema da Sheet 'Leituras':
 * [0] id | [1] userId | [2] book | [3] category | [4] date | [5] rating | [6] notes
 */

var READING_RECORD_SHEET = 'Leituras';
var READING_COLS = { ID: 0, USER_ID: 1, BOOK: 2, CATEGORY: 3, DATE: 4, RATING: 5, NOTES: 6 };

// ─── Helpers ────────────────────────────────────────────────────────────────

function _getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(READING_RECORD_SHEET) || ss.insertSheet(READING_RECORD_SHEET);
}

function _rowToRecord_(row) {
  return {
    id:       row[READING_COLS.ID],
    userId:   row[READING_COLS.USER_ID],
    book:     row[READING_COLS.BOOK],
    category: row[READING_COLS.CATEGORY],
    date:     row[READING_COLS.DATE],
    rating:   row[READING_COLS.RATING],
    notes:    row[READING_COLS.NOTES]
  };
}

function _generateId_() {
  return Utilities.getUuid();
}

// ─── CREATE ─────────────────────────────────────────────────────────────────

/**
 * Adiciona um novo registro de leitura.
 * @param {Object} record { userId, book, category, date, rating, notes }
 * @return {Object} O registro criado com o id gerado.
 */
function createReadingRecord(record) {
  var sheet = _getSheet_();
  var id = _generateId_();
  sheet.appendRow([
    id,
    record.userId   || '',
    record.book     || '',
    record.category || '',
    record.date     || new Date().toISOString().slice(0, 10),
    record.rating   || '',
    record.notes    || ''
  ]);
  return Object.assign({ id: id }, record);
}

// ─── READ ────────────────────────────────────────────────────────────────────

/**
 * Retorna todos os registros de leitura de um usuário.
 * @param {string} userId
 * @return {Array<Object>}
 */
function getReadingRecordsByUser(userId) {
  var sheet = _getSheet_();
  var data = sheet.getDataRange().getValues();
  var records = [];
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][READING_COLS.USER_ID]) === String(userId)) {
      records.push(_rowToRecord_(data[i]));
    }
  }
  return records;
}

/**
 * Retorna um registro pelo seu ID.
 * @param {string} id
 * @return {Object|null}
 */
function getReadingRecordById(id) {
  var sheet = _getSheet_();
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][READING_COLS.ID]) === String(id)) {
      return _rowToRecord_(data[i]);
    }
  }
  return null;
}

// ─── UPDATE ──────────────────────────────────────────────────────────────────

/**
 * Atualiza um registro existente pelo ID.
 * @param {string} id
 * @param {Object} updates { book?, category?, date?, rating?, notes? }
 * @return {boolean} true se encontrou e atualizou.
 */
function updateReadingRecord(id, updates) {
  var sheet = _getSheet_();
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][READING_COLS.ID]) === String(id)) {
      var row = i + 1; // 1-indexed
      if (updates.book     !== undefined) sheet.getRange(row, READING_COLS.BOOK + 1).setValue(updates.book);
      if (updates.category !== undefined) sheet.getRange(row, READING_COLS.CATEGORY + 1).setValue(updates.category);
      if (updates.date     !== undefined) sheet.getRange(row, READING_COLS.DATE + 1).setValue(updates.date);
      if (updates.rating   !== undefined) sheet.getRange(row, READING_COLS.RATING + 1).setValue(updates.rating);
      if (updates.notes    !== undefined) sheet.getRange(row, READING_COLS.NOTES + 1).setValue(updates.notes);
      return true;
    }
  }
  return false;
}

// ─── DELETE ──────────────────────────────────────────────────────────────────

/**
 * Remove um registro pelo ID.
 * @param {string} id
 * @return {boolean} true se encontrou e deletou.
 */
function deleteReadingRecord(id) {
  var sheet = _getSheet_();
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][READING_COLS.ID]) === String(id)) {
      sheet.deleteRow(i + 1);
      return true;
    }
  }
  return false;
}

// ─── Web App Entry Point ─────────────────────────────────────────────────────

/**
 * Roteador central para chamadas da UI via google.script.run.
 * Retorna JSON serializado para o frontend.
 */
function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('ReadingRecord').setTitle('UpOracular | Registros');
}
