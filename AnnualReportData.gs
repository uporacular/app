/** Fontes explícitas do fechamento anual. Leituras e escolhas nunca são alteradas. */
var ORACULAR_ANNUAL_SCHEMAS_ = {
  OracularAnoLetivo: ['ano', 'userId', 'nome', 'etapaAtual', 'proximaEtapa', 'curriculoId'],
  OracularCurriculos: ['id', 'ano', 'etapa', 'componente', 'objetivos', 'desafios', 'fonte'],
  OracularRelatoriosAnuais: ['id', 'ano', 'userId', 'status', 'tentativas', 'folderId', 'fileId', 'modelo', 'atualizadoEm', 'mensagem', 'lease']
};

function oracularAnnualError_(code, message) {
  var error = new Error(message);
  error.annualCode = code;
  return error;
}

function oracularAnnualYear_(value) {
  if (!/^20\d{2}$/.test(String(value))) throw oracularAnnualError_('YEAR', 'Informe um ano entre 2000 e 2099.');
  return Number(value);
}

function oracularAnnualText_(value, max) {
  var text = String(value == null ? '' : value).trim();
  if (text.length > max) throw oracularAnnualError_('DATA', 'Campo excede o limite de ' + max + ' caracteres; revise o cadastro.');
  return text;
}

// Cabeçalhos são resolvidos por nome, nunca por posição. Não migra dados existentes.
function oracularAnnualTable_(name, required, optional) {
  var sheet = getBoundSpreadsheet_().getSheetByName(name);
  if (!sheet || sheet.getLastRow() === 0) {
    if (optional) return [];
    throw oracularAnnualError_('SCHEMA', 'Prepare e preencha a aba ' + name + '.');
  }
  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function(h) { return String(h).trim().toLowerCase(); });
  if (headers.some(function(h, i) { return h && headers.indexOf(h) !== i; }) ||
      required.some(function(h) { return headers.indexOf(h.toLowerCase()) < 0; })) {
    throw oracularAnnualError_('SCHEMA', 'Cabeçalhos incompatíveis na aba ' + name + '. Consulte RELATORIOS_ANUAIS.md.');
  }
  return data.slice(1).map(function(row, i) {
    var item = { _row: i + 2 };
    headers.forEach(function(h, j) { if (h) item[h] = row[j]; });
    return item;
  }).filter(function(item) {
    return headers.some(function(h) { return item[h] !== '' && item[h] != null; });
  });
}

function oracularAnnualRoster_(year) {
  var seen = Object.create(null);
  var rows = oracularAnnualTable_('OracularAnoLetivo', ORACULAR_ANNUAL_SCHEMAS_.OracularAnoLetivo);
  var roster = rows.filter(function(r) { return oracularAnnualYear_(r.ano) === year; });
  if (!roster.length) throw oracularAnnualError_('ROSTER', 'Nenhum aluno cadastrado em OracularAnoLetivo para ' + year + '.');
  return roster.map(function(r) {
    var id = oracularAnnualText_(r.userid, 180);
    if (!id || seen[id]) throw oracularAnnualError_('ROSTER', 'userId vazio ou duplicado no cadastro anual.');
    seen[id] = true;
    return { userId: id, year: year, name: oracularAnnualText_(r.nome, 180),
      currentStage: oracularAnnualText_(r.etapaatual, 100), nextStage: oracularAnnualText_(r.proximaetapa, 100),
      curriculumId: oracularAnnualText_(r.curriculoid, 120) };
  });
}

function oracularAnnualCurriculum_(student) {
  if (!student.name || !student.currentStage || !student.nextStage || !student.curriculumId) {
    throw oracularAnnualError_('CURRICULUM', 'Preencha nome, etapa atual, próxima etapa e currículo do aluno.');
  }
  var rows = oracularAnnualTable_('OracularCurriculos', ORACULAR_ANNUAL_SCHEMAS_.OracularCurriculos)
    .filter(function(r) { return String(r.id).trim() === student.curriculumId && Number(r.ano) === student.year + 1; });
  if (!rows.length || rows.length > 50) throw oracularAnnualError_('CURRICULUM', 'Cadastre de 1 a 50 componentes do currículo do próximo ano letivo.');
  return rows.map(function(r, i) {
    if (String(r.etapa).trim() !== student.nextStage) throw oracularAnnualError_('CURRICULUM', 'A etapa do currículo difere da próxima etapa do aluno.');
    var item = { ref: 'C' + (i + 1), component: oracularAnnualText_(r.componente, 180),
      objectives: oracularAnnualText_(r.objetivos, 3000), challenges: oracularAnnualText_(r.desafios, 2000),
      source: oracularAnnualText_(r.fonte, 500) };
    if (!item.component || !item.objectives || !item.challenges || !item.source) {
      throw oracularAnnualError_('CURRICULUM', 'Cada componente precisa de objetivos, desafios e fonte curricular.');
    }
    return item;
  });
}

function oracularAnnualDate_(value) {
  var text;
  if (Object.prototype.toString.call(value) === '[object Date]') {
    if (isNaN(value.getTime())) throw oracularAnnualError_('DATE', 'Data inválida no histórico do aluno.');
    text = Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  } else {
    text = String(value || '').trim();
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(text)) {
      oracularAnnualDate_(text.slice(0, 10));
      var instant = new Date(text);
      if (isNaN(instant.getTime())) throw oracularAnnualError_('DATE', 'Data inválida no histórico do aluno.');
      text = Utilities.formatDate(instant, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(text)) {
      text = text.slice(6) + '-' + text.slice(3, 5) + '-' + text.slice(0, 2);
    }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || isNaN(Date.parse(text + 'T12:00:00Z')) ||
      new Date(text + 'T12:00:00Z').toISOString().slice(0, 10) !== text) {
    throw oracularAnnualError_('DATE', 'Corrija datas vazias ou inválidas no histórico do aluno antes de gerar o relatório.');
  }
  return text;
}

function oracularAnnualWorks_(student) {
  var readings = oracularAnnualTable_('Leituras', ['userId', 'book', 'date'], true);
  var choices = oracularAnnualTable_('TrilhaEscolhas', ['userId', 'acervoId', 'obra', 'status', 'chosenAt'], true);
  var catalog = oracularAnnualTable_('Acervo', ['Id', 'Obra', 'Autor', 'Assuntos'], true);
  var byId = Object.create(null), works = [], byWork = Object.create(null);
  catalog.forEach(function(item) { byId[String(item.id)] = item; });
  function add(row, kind) {
    if (String(row.userid).trim() !== student.userId) return;
    if (kind === 'escolha' && ['chosen', 'superseded'].indexOf(String(row.status)) < 0) return;
    var date = oracularAnnualDate_(kind === 'escolha' ? row.chosenat : row.date);
    if (Number(date.slice(0, 4)) !== student.year) return;
    var id = String(row.acervoid || '').trim(), item = byId[id] || {};
    var title = oracularAnnualText_(row.book || row.obra || item.titulo || item.obra, 500);
    if (!title) throw oracularAnnualError_('DATA', 'Obra sem título no histórico anual.');
    var author = oracularAnnualText_(row.author || item.autor, 300);
    var subjects = oracularAnnualText_(row.subjects || item.assuntos || row.category, 2000);
    var key = id ? 'id:' + id : JSON.stringify([title.toLowerCase(), author.toLowerCase()]);
    var work = byWork[key];
    if (!work) {
      work = { ref: 'L' + (works.length + 1), title: title, author: author, subjects: subjects,
        choices: 0, readingRecords: 0, firstDate: date, lastDate: date };
      works.push(work); byWork[key] = work;
    }
    if (!work.author && author) work.author = author;
    if (!work.subjects && subjects) work.subjects = subjects;
    work[kind === 'escolha' ? 'choices' : 'readingRecords']++;
    if (date < work.firstDate) work.firstDate = date;
    if (date > work.lastDate) work.lastDate = date;
  }
  choices.forEach(function(r) { add(r, 'escolha'); });
  readings.forEach(function(r) { add(r, 'registro'); });
  // O construtor de privacidade suporta até 100 itens; nunca cortar um ano silenciosamente.
  if (works.length > 100) throw oracularAnnualError_('SIZE', 'Mais de 100 obras distintas: o histórico exige tratamento ampliado antes da geração.');
  return works;
}

function oracularAnnualContext_(student) {
  var curriculum = oracularAnnualCurriculum_(student), works = oracularAnnualWorks_(student);
  var built = PromptContextBuilder.build('annual.reading', {
    year: student.year, nextYear: student.year + 1, currentStage: student.currentStage,
    nextStage: student.nextStage, works: works, curriculum: curriculum
  });
  // Nome e identificador nunca são campos do prompt. Também removê-los se repetidos em metadados.
  function redact(value) {
    if (typeof value === 'string') {
      if (student.name.length >= 3) value = value.split(student.name).join('[ESTUDANTE]');
      if (student.userId.length >= 4) value = value.split(student.userId).join('[IDENTIFICADOR]');
      return value;
    }
    if (Array.isArray(value)) return value.map(redact);
    if (value && typeof value === 'object') Object.keys(value).forEach(function(k) { value[k] = redact(value[k]); });
    return value;
  }
  var context = redact(built.context);
  if (JSON.stringify(context).length > 80000) throw oracularAnnualError_('SIZE', 'Contexto anual excede 80 mil caracteres; nada foi enviado ao Gemini.');
  return context;
}
