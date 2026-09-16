/** Fila anual: um aluno por execução, lease curto e arquivo recuperável por nome único. */
var ORACULAR_ANNUAL_QUEUE_ = 'OracularRelatoriosAnuais';
var ORACULAR_ANNUAL_TRIGGER_ = 'oracularAnnualReportTick_';
var ORACULAR_ANNUAL_LEASE_MS_ = 15 * 60 * 1000;

function oracularAnnualAdmin_(token) {
  var session = getUpOracularWebSessionUser_(token);
  if (!session) throw new Error('Sessão inválida ou expirada.');
  // Revalidar papel e desativação no cadastro, não apenas no snapshot da sessão.
  var user = Auth_findUser_(session.username || session.email);
  if (!user || user.active === false || String(user.id) !== String(session.id || session.userId) ||
      ['ADMIN', 'ADMINISTRADOR'].indexOf(String(user.role).trim().toUpperCase()) < 0) {
    throw new Error('Relatórios anuais disponíveis somente para administradores ativos.');
  }
  return user;
}

function oracularAnnualLocked_(action) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw new Error('Fila ocupada. Tente novamente em instantes.');
  try { return action(); } finally { lock.releaseLock(); }
}

function oracularAnnualQueue_() {
  return oracularAnnualTable_(ORACULAR_ANNUAL_QUEUE_, ORACULAR_ANNUAL_SCHEMAS_[ORACULAR_ANNUAL_QUEUE_]);
}

function oracularAnnualWriteJob_(job) {
  var sheet = getBoundSpreadsheet_().getSheetByName(ORACULAR_ANNUAL_QUEUE_);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var cells = headers.map(function(header) {
    var value = job[String(header).trim().toLowerCase()];
    if (value == null) return '';
    return typeof value === 'string' && value.charAt(0) === '=' ? "'" + value : value;
  });
  sheet.getRange(job._row, 1, 1, cells.length).setValues([cells]);
  SpreadsheetApp.flush();
}

function prepareOracularAnnualReports(token) {
  oracularAnnualAdmin_(token);
  return oracularAnnualLocked_(function() {
    var ss = getBoundSpreadsheet_();
    Object.keys(ORACULAR_ANNUAL_SCHEMAS_).forEach(function(name) {
      var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(ORACULAR_ANNUAL_SCHEMAS_[name]);
        sheet.setFrozenRows(1);
      }
      oracularAnnualTable_(name, ORACULAR_ANNUAL_SCHEMAS_[name]);
    });
    return { success: true, message: 'Abas preparadas sem substituir dados. Preencha alunos e currículos na planilha.' };
  });
}

function oracularAnnualEnqueue_(year) {
  year = oracularAnnualYear_(year);
  var config = oracularAnnualConfig_();
  var roster = oracularAnnualRoster_(year);
  return oracularAnnualLocked_(function() {
    var jobs = oracularAnnualQueue_(), added = 0;
    roster.forEach(function(student) {
      if (jobs.some(function(j) { return Number(j.ano) === year && String(j.userid) === student.userId; })) return;
      var job = { id: Utilities.getUuid(), ano: year, userid: student.userId, status: 'PENDENTE',
        tentativas: 0, folderid: config.folderId, fileid: '', modelo: '',
        atualizadoem: new Date().toISOString(), mensagem: '', lease: '',
        _row: getBoundSpreadsheet_().getSheetByName(ORACULAR_ANNUAL_QUEUE_).getLastRow() + 1 };
      oracularAnnualWriteJob_(job); jobs.push(job); added++;
    });
    return { success: true, added: added, total: roster.length };
  });
}

function startOracularAnnualReports(token, year) {
  oracularAnnualAdmin_(token);
  return oracularAnnualEnqueue_(year);
}

function getOracularAnnualReports(token, year) {
  oracularAnnualAdmin_(token);
  year = oracularAnnualYear_(year);
  var props = PropertiesService.getScriptProperties(), configError = '';
  try { oracularAnnualConfig_(); } catch (e) { configError = e.message; }
  var rows = oracularAnnualTable_(ORACULAR_ANNUAL_QUEUE_, ORACULAR_ANNUAL_SCHEMAS_[ORACULAR_ANNUAL_QUEUE_], true);
  var names = Object.create(null), rosterError = '', rosterCount = 0;
  try {
    var roster = oracularAnnualRoster_(year); rosterCount = roster.length;
    roster.forEach(function(student) { names[student.userId] = student.name; });
  } catch (e) { rosterError = e.message; }
  return { success: true, year: year, configError: configError, rosterError: rosterError, rosterCount: rosterCount,
    scheduleEnabled: props.getProperty('ORACULAR_REPORT_ENABLED') === 'true',
    closeDate: props.getProperty('ORACULAR_REPORT_CLOSE_MM_DD') || '12-31',
    jobs: rows.filter(function(j) { return Number(j.ano) === year; }).map(function(j) {
      return { id: String(j.id), name: names[String(j.userid)] || 'Cadastro anual ausente', status: String(j.status),
        attempts: Number(j.tentativas), message: String(j.mensagem || ''),
        url: j.status === 'PRONTO' && /^[\w-]+$/.test(String(j.fileid)) ? 'https://drive.google.com/file/d/' + j.fileid + '/view' : '' };
    }) };
}

function oracularAnnualClaim_(year) {
  return oracularAnnualLocked_(function() {
    var jobs = oracularAnnualQueue_(), now = Date.now();
    // Um worker por vez, mas sem manter lock durante HTTP/Drive: não bloqueia o uso do app.
    if (jobs.some(function(j) { return j.status === 'PROCESSANDO' && now - Date.parse(j.atualizadoem) < ORACULAR_ANNUAL_LEASE_MS_; })) return null;
    var chosen = null;
    jobs.some(function(j) {
      if (year != null && Number(j.ano) !== year) return false;
      if (j.status !== 'PENDENTE' && j.status !== 'PROCESSANDO') return false;
      if (Number(j.tentativas) >= 3) {
        j.status = 'ERRO'; j.mensagem = 'Três tentativas interrompidas. Confira a pasta e solicite nova tentativa manual.'; j.lease = '';
        oracularAnnualWriteJob_(j); return false;
      }
      j.status = 'PROCESSANDO'; j.tentativas = Number(j.tentativas || 0) + 1;
      j.atualizadoem = new Date(now).toISOString(); j.lease = Utilities.getUuid(); j.mensagem = '';
      oracularAnnualWriteJob_(j); chosen = j; return true;
    });
    return chosen;
  });
}

function oracularAnnualFinish_(job, status, message, fileId, model) {
  return oracularAnnualLocked_(function() {
    var current = oracularAnnualQueue_().filter(function(j) { return String(j.id) === String(job.id); })[0];
    if (!current || current.lease !== job.lease || current.status !== 'PROCESSANDO') throw new Error('A execução perdeu a reserva da fila. Atualize o painel.');
    current.status = status; current.mensagem = message; current.fileid = fileId || '';
    current.modelo = model || ''; current.atualizadoem = new Date().toISOString(); current.lease = '';
    oracularAnnualWriteJob_(current);
    return { success: true, id: String(job.id), status: status, message: message };
  });
}

function oracularAnnualConsent_(userId) {
  var consent = typeof ConsentService !== 'undefined' ? ConsentService.getStatus(userId, 'generative', { fresh: true }) : null;
  var expires = consent && consent.record && consent.record.validUntil;
  if (!consent || consent.status !== 'active' || !expires || isNaN(new Date(expires).getTime()) ||
      new Date(expires).getTime() <= Date.now() || consent.record.revokedAt) {
    throw oracularAnnualError_('CONSENT', 'Consentimento de IA ausente, expirado ou revogado. Geração interrompida; se a API já havia respondido, nenhum novo PDF será salvo.');
  }
}

function oracularAnnualProcess_(year) {
  var job = oracularAnnualClaim_(year);
  if (!job) return { success: true, status: 'OCIOSO', message: 'Nenhum item disponível ou outra execução em andamento.' };
  var config, file;
  try {
    config = oracularAnnualConfig_();
    if (config.folderId !== String(job.folderid)) throw oracularAnnualError_('FOLDER', 'FOLDER_ID mudou desde o início do lote. Restaure a pasta original antes de retomar.');
    var student = oracularAnnualRoster_(Number(job.ano)).filter(function(s) { return s.userId === String(job.userid); })[0];
    if (!student) throw oracularAnnualError_('ROSTER', 'Aluno ausente no cadastro anual.');
    oracularAnnualConsent_(student.userId);
    var filename = 'UpOracular-' + job.ano + '-' + job.id + '.pdf';
    // Recupera criação confirmada no Drive mesmo se houve timeout antes da confirmação na planilha.
    var existing = config.folder.getFilesByName(filename);
    if (existing.hasNext()) {
      file = existing.next();
      if (existing.hasNext() || file.isTrashed() || file.getMimeType() !== 'application/pdf') {
        throw oracularAnnualError_('FILE', 'Arquivo conflitante na pasta. Revisão manual necessária; nenhum arquivo foi sobrescrito.');
      }
      return oracularAnnualFinish_(job, 'PRONTO', 'PDF recuperado após interrupção; revisão pedagógica pendente.', file.getId(), job.modelo || 'recuperado — consulte PDF');
    }
    var context = oracularAnnualContext_(student);
    oracularAnnualConsent_(student.userId);
    var report = oracularAnnualGenerate_(context, config.model);
    // Consentimento e compartilhamento podem mudar enquanto a API responde.
    oracularAnnualConsent_(student.userId);
    var checked = oracularAnnualConfig_();
    if (checked.folderId !== config.folderId) throw oracularAnnualError_('FOLDER', 'FOLDER_ID mudou durante a geração; PDF não salvo.');
    var html = oracularAnnualHtml_(student, context, report, config.model, new Date().toISOString());
    file = config.folder.createFile(HtmlService.createHtmlOutput(html).getAs('application/pdf').setName(filename));
    return oracularAnnualFinish_(job, 'PRONTO', 'PDF salvo; revisão pedagógica pendente.', file.getId(), config.model);
  } catch (error) {
    var blocked = ['CONSENT', 'CURRICULUM', 'ROSTER', 'SCHEMA', 'DATE', 'DATA', 'SIZE', 'CONFIG', 'FOLDER', 'FILE'].indexOf(error.annualCode) >= 0;
    var message = error.annualCode ? error.message : 'Falha de processamento ou gravação. Verifique acesso/cotas e retome; um PDF já criado será recuperado sem duplicação.';
    return oracularAnnualFinish_(job, blocked ? 'BLOQUEADO' : 'ERRO', message, '', config && config.model);
  }
}

function processOracularAnnualReport(token, year) {
  oracularAnnualAdmin_(token);
  return oracularAnnualProcess_(oracularAnnualYear_(year));
}

function retryOracularAnnualReport(token, id) {
  oracularAnnualAdmin_(token);
  return oracularAnnualLocked_(function() {
    var job = oracularAnnualQueue_().filter(function(j) { return String(j.id) === String(id); })[0];
    if (!job || ['ERRO', 'BLOQUEADO'].indexOf(job.status) < 0) throw new Error('Somente itens com erro ou bloqueio podem ser retomados.');
    job.status = 'PENDENTE'; job.tentativas = 0; job.mensagem = ''; job.lease = ''; job.atualizadoem = new Date().toISOString();
    oracularAnnualWriteJob_(job);
    return { success: true };
  });
}

function oracularAnnualCloseDate_(value) {
  if (!/^\d{2}-\d{2}$/.test(String(value))) throw new Error('Use MM-DD para a data anual de fechamento.');
  oracularAnnualDate_('2001-' + value); // Data recorrente deve existir também em anos não bissextos.
  return String(value);
}

function configureOracularAnnualSchedule(token, enabled, closeDate) {
  oracularAnnualAdmin_(token);
  if (typeof enabled !== 'boolean') throw new Error('Informe ativação válida.');
  if (enabled) { oracularAnnualConfig_(); oracularAnnualQueue_(); oracularAnnualCloseDate_(closeDate); }
  return oracularAnnualLocked_(function() {
    var props = PropertiesService.getScriptProperties();
    // Desativar primeiro: qualquer falha na instalação mantém a automação inerte.
    props.setProperty('ORACULAR_REPORT_ENABLED', 'false');
    ScriptApp.getProjectTriggers().forEach(function(trigger) {
      if (trigger.getHandlerFunction() === ORACULAR_ANNUAL_TRIGGER_) ScriptApp.deleteTrigger(trigger);
    });
    if (enabled) {
      ScriptApp.newTrigger(ORACULAR_ANNUAL_TRIGGER_).timeBased().everyMinutes(10).create();
      props.setProperty('ORACULAR_REPORT_CLOSE_MM_DD', closeDate);
      props.setProperty('ORACULAR_REPORT_START_YEAR', Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy'));
      props.setProperty('ORACULAR_REPORT_ENABLED', 'true');
    }
    return { success: true, enabled: enabled };
  });
}

// Privado: não pode ser chamado pelo navegador para contornar o guard de administrador.
function oracularAnnualReportTick_() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('ORACULAR_REPORT_ENABLED') !== 'true') return;
  var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var closeDate = oracularAnnualCloseDate_(props.getProperty('ORACULAR_REPORT_CLOSE_MM_DD') || '12-31');
  // Último fechamento inteiramente encerrado, mesmo após dias de indisponibilidade em janeiro.
  var year = Number(today.slice(0, 4));
  if (today <= year + '-' + closeDate) year--;
  if (year >= Number(props.getProperty('ORACULAR_REPORT_START_YEAR') || today.slice(0, 4)) &&
      props.getProperty('ORACULAR_REPORT_ENQUEUED_YEAR') !== String(year)) {
    oracularAnnualEnqueue_(year);
    props.setProperty('ORACULAR_REPORT_ENQUEUED_YEAR', String(year));
  }
  // Lotes anteriores continuam após a virada do ano. Erros/bloqueios aguardam intervenção.
  return oracularAnnualProcess_(null);
}
