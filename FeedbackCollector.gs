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
  try {
    if (!email || !feedbackText) return false;
  
    var ss = getBoundSpreadsheet_();
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
  } catch (error) {
    Logger.log("Erro em submitFeedback: " + error.message);
    throw error; // Re-lança para tratamento superior
  }
}

/**
 * Puxa os feedbacks de um usuário (com cache).
 * @param {string} email
 * @return {Array<Object>}
 */
function getUserFeedbacks(email) {
  try {
    try {
      var cache = CacheService.getScriptCache();
      var cached = cache.get('FEEDBACKS_' + email);
      if (cached) return JSON.parse(cached);
  
      var ss = getBoundSpreadsheet_();
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
    } catch (error) {
      Logger.log("Erro em getUserFeedbacks: " + error.message);
      throw error;
    }
  } catch (error) {
    Logger.log("Erro em getUserFeedbacks: " + error.message);
    throw error;
  }
}

/**
 * Lista todos os feedbacks em forma de linha [Timestamp, User, Feedback],
 * no shape que a tela FeedbackCollector (renderFeedbacks) espera.
 * @return {Array<Array>}
 */
function getAllFeedbacks() {
  try {
    try {
      var ss = getBoundSpreadsheet_();
      var sheet = ss.getSheetByName(FEEDBACK_SHEET_NAME);
      if (!sheet || sheet.getLastRow() < 2) return [];
      var data = sheet.getDataRange().getValues();
      var rows = [];
      for (var i = 1; i < data.length; i++) {
        rows.push([data[i][0], data[i][1], data[i][2]]);
      }
      return rows;
    } catch (error) {
      Logger.log("Erro em getAllFeedbacks: " + error.message);
      throw error;
    }
  } catch (error) {
    Logger.log("Erro em getAllFeedbacks: " + error.message);
    throw error;
  }
}

/**
 * Lista os feedbacks de um e-mail em forma de linha [Timestamp, User, Feedback],
 * compativel com renderFeedbacks. Complementa getUserFeedbacks (que devolve objetos).
 * @param {string} email
 * @return {Array<Array>}
 */
function getFeedbacksByEmail(email) {
  try {
    try {
      if (!email) return [];
      var ss = getBoundSpreadsheet_();
      var sheet = ss.getSheetByName(FEEDBACK_SHEET_NAME);
      if (!sheet || sheet.getLastRow() < 2) return [];
      var data = sheet.getDataRange().getValues();
      var alvo = String(email).toLowerCase();
      var rows = [];
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][1]).toLowerCase() === alvo) {
          rows.push([data[i][0], data[i][1], data[i][2]]);
        }
      }
      return rows;
    } catch (error) {
      Logger.log("Erro em getFeedbacksByEmail: " + error.message);
      throw error;
    }
  } catch (error) {
    Logger.log("Erro em getFeedbacksByEmail: " + error.message);
    throw error;
  }
}

function saveFeedback(email, feedbackText) {
  if (!email || !String(feedbackText || '').trim()) {
    throw new Error('Informe email e feedback.');
  }
  return submitFeedback(String(email), String(feedbackText).trim(), null);
}
