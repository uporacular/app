/**
 * Contrato do workflow basico do Up Oracular.
 * A identidade sempre vem da sessao; a IA e opcional; somente a escolha
 * explicita do leitor produz um registro definitivo de trilha.
 */
var ORACULAR_CHOICE_SHEET_ = 'TrilhaEscolhas';

function getOracularWorkflowContract() {
  return {
    version: 1,
    stages: ['session', 'record', 'triage', 'optional_ai', 'review', 'chosen', 'continuity'],
    identityAuthority: 'server_session',
    aiPolicy: 'explicit_consent_with_local_fallback',
    definitiveAction: 'reader_choice'
  };
}

function oracularSessionContext_(authToken) {
  var user = getUpOracularWebSessionUser_(authToken);
  if (!user) throw new Error('Sessao invalida ou expirada.');
  var userId = String(user.id || user.userId || user.email || user.username || '').trim();
  if (!userId) throw new Error('Sessao sem identidade de usuario.');
  return { user: user, userId: userId };
}

function oracularChoiceSheet_() {
  var ss = getBoundSpreadsheet_();
  var sheet = ss.getSheetByName(ORACULAR_CHOICE_SHEET_) || ss.insertSheet(ORACULAR_CHOICE_SHEET_);
  var headers = ['id', 'userId', 'acervoId', 'obra', 'status', 'chosenAt', 'historySize', 'expectation', 'inquiry'];
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  } else {
    var current = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
    headers.forEach(function(header) {
      if (current.indexOf(header) === -1) {
        sheet.getRange(1, sheet.getLastColumn() + 1).setValue(header);
        current.push(header);
      }
    });
  }
  return sheet;
}

function oracularCurrentChoice_(userId) {
  var data = oracularChoiceSheet_().getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][1]) === String(userId) && String(data[i][4]) === 'chosen') {
      return {
        id: String(data[i][0]), acervoId: String(data[i][2]), obra: String(data[i][3]),
        status: String(data[i][4]), chosenAt: data[i][5],
        expectation: String(data[i][7] || ''), inquiry: String(data[i][8] || '')
      };
    }
  }
  return null;
}

function getOracularWorkflowState(authToken) {
  var context = oracularSessionContext_(authToken);
  var recommendation = getRecommendationsForCurrentUser(authToken);
  var records = getReadingRecordsByUser_(context.userId) || [];
  var choice = oracularCurrentChoice_(context.userId);
  return {
    stage: choice ? 'chosen' : (recommendation.recomendacoes.length ? 'review' : 'record'),
    readingCount: records.length,
    consentimentoIA: recommendation.consentimentoIA,
    geminiAtivo: recommendation.geminiAtivo,
    recomendacoes: recommendation.recomendacoes,
    acervoDisponivel: recommendation.acervoDisponivel,
    escolha: choice,
    geradoEm: recommendation.geradoEm
  };
}

function grantOracularAiConsent(authToken) {
  var context = oracularSessionContext_(authToken);
  var responsible = String(context.user.username || context.user.email || context.userId).slice(0, 120);
  ConsentService.grant(context.userId, 'generative', { responsible: responsible, validDays: 180 });
  return getOracularWorkflowState(authToken);
}

function revokeOracularAiConsent(authToken) {
  var context = oracularSessionContext_(authToken);
  ConsentService.revoke(context.userId, 'generative', { reason: 'Revogado pelo leitor' });
  return getOracularWorkflowState(authToken);
}

function getMyReadingAnticipationGuide(authToken, acervoId) {
  var context = oracularSessionContext_(authToken);
  var consent = ConsentService.getStatus(context.userId, 'generative').status === 'active';
  return getReadingAnticipationGuide_({ acervoId: String(acervoId || '') }, { allowAI: consent });
}

function chooseOracularRecommendation(authToken, acervoId, intentInput) {
  var context = oracularSessionContext_(authToken);
  acervoId = String(acervoId || '').trim();
  if (!acervoId) throw new Error('Escolha uma obra do acervo.');
  var intent = OracularChoiceIntentService.normalize(intentInput);
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var records = getReadingRecordsByUser_(context.userId) || [];
    var candidates = generateRecommendations_({ userId: context.userId, interests: [] }, records, { allowAI: false });
    var selected = null;
    candidates.forEach(function(candidate) {
      if (String(candidate.acervoId) === acervoId) selected = candidate;
    });
    if (!selected) throw new Error('A obra nao pertence a trilha elegivel atual. Atualize as recomendacoes.');
    var existing = oracularCurrentChoice_(context.userId);
    if (existing && existing.acervoId === acervoId) return existing;
    var sheet = oracularChoiceSheet_();
    var values = sheet.getDataRange().getValues();
    for (var i = values.length - 1; i >= 1; i--) {
      if (String(values[i][1]) === context.userId && String(values[i][4]) === 'chosen') {
        sheet.getRange(i + 1, 5).setValue('superseded');
      }
    }
    var choice = {
      id: Utilities.getUuid(), acervoId: acervoId,
      obra: String(selected.obra || selected.titulo || '').slice(0, 160),
      status: 'chosen', chosenAt: new Date().toISOString(),
      expectation: intent.expectation, inquiry: intent.inquiry
    };
    sheet.appendRow([choice.id, context.userId, choice.acervoId, choice.obra, choice.status, choice.chosenAt, records.length, choice.expectation, choice.inquiry]);
    return choice;
  } finally {
    lock.releaseLock();
  }
}

// CRUD seguro usado pela pagina de registros.
function getMyReadingRecords(authToken) {
  return getReadingRecordsByUser_(oracularSessionContext_(authToken).userId);
}

function createMyReadingRecord(authToken, record) {
  var context = oracularSessionContext_(authToken);
  record = record || {};
  record.userId = context.userId;
  return createReadingRecord_(record);
}

function updateMyReadingRecord(authToken, id, updates) {
  var context = oracularSessionContext_(authToken);
  var record = getReadingRecordById_(id);
  if (!record || String(record.userId) !== context.userId) throw new Error('Registro nao encontrado.');
  return updateReadingRecord_(id, updates || {});
}

function deleteMyReadingRecord(authToken, id) {
  var context = oracularSessionContext_(authToken);
  var record = getReadingRecordById_(id);
  if (!record || String(record.userId) !== context.userId) throw new Error('Registro nao encontrado.');
  return deleteReadingRecord_(id);
}
