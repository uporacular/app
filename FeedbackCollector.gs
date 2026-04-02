/**
 * FeedbackCollector.gs
 * Módulo para coleta e gerenciamento de feedback e avaliações dos usuários.
 * Grava feedback em planilha específica, envia notificações e gera relatórios simples.
 */

var FEEDBACK_SHEET_NAME = 'Feedbacks';

/**
 * Registra um novo feedback do usuário e envia e-mail de alerta caso necessário.
 * @param {string} email
 * @param {string} feedbackText
 * @param {number} rating
 * @return {boolean}
 */
function submitFeedback(email, feedbackText, rating) {
  if (!email || !feedbackText) return false;
  
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(FEEDBACK_SHEET_NAME) || ss.insertSheet(FEEDBACK_SHEET_NAME);
  
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Timestamp', 'User', 'Feedback', 'Rating']);
  }
  
  sheet.appendRow([new Date().toISOString(), email, feedbackText, rating]);
  
  CacheService.getScriptCache().remove('FEEDBACKS_' + email);
  
  // Alerta em avaliações muito baixas (Mock notification)
  if (rating <= 2) {
    try {
      MailApp.sendEmail({
        to: Session.getEffectiveUser().getEmail(),
        subject: 'Alerta de Feedback Negativo',
        body: 'O usuário ' + email + ' deixou uma avaliação de ' + rating + ' estrelas.\n\nMensagem:\n' + feedbackText
      });
    } catch(e) {} // Permissão de email pode não existir
  }
  
  return true;
}

/**
 * Puxa os feedbacks de um usuário (com cache).
 * @param {string} email
 * @return {Array<Object>}
 */
function getUserFeedbacks(email) {
  var cache = CacheService.getScriptCache();
  var cached = cache.get('FEEDBACKS_' + email);
  if (cached) return JSON.parse(cached);
  
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(FEEDBACK_SHEET_NAME);
  if (!sheet) return [];
  
  var data = sheet.getDataRange().getValues();
  var results = [];
  
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]).toLowerCase() === email.toLowerCase()) {
      results.push({ date: data[i][0], feedback: data[i][2], rating: data[i][3] });
    }
  }
  
  if (results.length > 0) {
    cache.put('FEEDBACKS_' + email, JSON.stringify(results), 600);
  }
  
  return results;
}
