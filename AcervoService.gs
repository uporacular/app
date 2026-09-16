/**
 * AcervoService.gs
 * Normaliza, consulta e inter-referencia o acervo escolar importado de CSV.
 *
 * O Arcevo.csv analisado tem 5 colunas sem cabecalho efetivo:
 * [0] assuntos | [1] titulo opcional | [2] autor/editora | [3] livre | [4] cor/codigo.
 */

var ACERVO_SHEET_NAME = 'Acervo';
var ACERVO_HEADERS = [
  'Id',
  'Obra',
  'Titulo',
  'Autor',
  'Assuntos',
  'Categoria',
  'Cor',
  'Codigo',
  'Localizacao',
  'Termos',
  'Busca',
  'FonteLinha',
  'AtualizadoEm'
];
var ACERVO_MAX_TERMS_PER_ROW = 8;
var ACERVO_DEFAULT_LIMIT = 30;

function normalizeAcervoRows(rawRows) {
  try {
    if (!rawRows || !rawRows.length) return [];

    var now = new Date().toISOString();
    var out = [];

    for (var i = 0; i < rawRows.length; i++) {
      var row = rawRows[i] || [];
      if (!_acervoRowHasContent_(row)) continue;
      if (_looksLikeAcervoHeader_(row)) continue;

      var assuntos = _cleanText_(row[0]);
      var titulo = _cleanText_(row[1]);
      var autor = _cleanText_(row[2]);
      var localizacao = _cleanText_(row[4]);
      var loc = _parseAcervoLocation_(localizacao);
      var termos = _extractAcervoTerms_(assuntos);
      var categoria = _inferAcervoCategory_(assuntos, titulo, autor);
      var obra = _composeAcervoWorkLabel_(titulo, autor, assuntos, loc);
      var id = 'ACV-' + _leftPad_(out.length + 1, 5);
      var busca = [
        id,
        obra,
        titulo,
        autor,
        assuntos,
        categoria,
        loc.cor,
        loc.codigo,
        termos.join(' ')
      ].join(' ');

      out.push({
        id: id,
        obra: obra,
        titulo: titulo,
        autor: autor,
        assuntos: assuntos,
        categoria: categoria,
        cor: loc.cor,
        codigo: loc.codigo,
        localizacao: localizacao,
        termos: termos,
        busca: _normalizeSearchText_(busca),
        fonteLinha: i + 1,
        atualizadoEm: now
      });
    }

    return out;
  } catch (error) {
    Logger.log("Erro em normalizeAcervoRows: " + error.message);
    throw error;
  }
}

function writeAcervoToSheet(records, sheetName) {
  try {
    try {
      try {
        var ss = getBoundSpreadsheet_();
        var target = sheetName || ACERVO_SHEET_NAME;
        var sheet = ss.getSheetByName(target) || ss.insertSheet(target);
        var rows = [ACERVO_HEADERS];

        (records || []).forEach(function(item) {
          rows.push(_acervoObjectToRow_(item));
        });

        sheet.clearContents();
        if (rows.length) {
          sheet.getRange(1, 1, rows.length, ACERVO_HEADERS.length).setValues(rows);
          sheet.setFrozenRows(1);
          sheet.autoResizeColumns(1, Math.min(ACERVO_HEADERS.length, 8));
        }
        _invalidateAcervoCaches_();
        return records ? records.length : 0;
      } catch (error) {
        Logger.log("Erro em writeAcervoToSheet: " + error.message);
        throw error; // Re-lança para tratamento superior
      }
    } catch (error) {
      Logger.log("Erro em writeAcervoToSheet: " + error.message);
      throw error;
    }
  } catch (error) {
    Logger.log("Erro em writeAcervoToSheet: " + error.message);
    throw error;
  }
}

function importAcervoCsvToSheet(fileId, sheetName) {
  var raw = importFromCSV(fileId);
  var records = normalizeAcervoRows(raw);
  var written = writeAcervoToSheet(records, sheetName || ACERVO_SHEET_NAME);
  return {
    sheetName: sheetName || ACERVO_SHEET_NAME,
    rowsRead: raw.length,
    rowsWritten: written,
    stats: getAcervoStats(sheetName || ACERVO_SHEET_NAME)
  };
}

function importArcevoCsvToSheet(fileId, sheetName) {
  return importAcervoCsvToSheet(fileId, sheetName);
}

function getAcervoStats(sheetName) {
  try {
    var entries = _readAcervoEntries_(sheetName || ACERVO_SHEET_NAME);
    var byCategoria = {};
    var byCor = {};
    var termFreq = {};
    var missingTitles = 0;

    entries.forEach(function(entry) {
      byCategoria[entry.categoria] = (byCategoria[entry.categoria] || 0) + 1;
      byCor[entry.cor || 'Sem cor'] = (byCor[entry.cor || 'Sem cor'] || 0) + 1;
      if (!entry.titulo) missingTitles++;
      entry.termos.forEach(function(term) {
        termFreq[term] = (termFreq[term] || 0) + 1;
      });
    });

    return {
      sheetName: sheetName || ACERVO_SHEET_NAME,
      total: entries.length,
      titulosAusentes: missingTitles,
      categorias: _sortCountObject_(byCategoria),
      cores: _sortCountObject_(byCor),
      termos: _sortCountObject_(termFreq).slice(0, 25),
      geradoEm: new Date().toISOString()
    };
  } catch (error) {
    Logger.log("Erro em getAcervoStats: " + error.message);
    throw error;
  }
}

function getAcervoFacetValues(sheetName) {
  try {
    var entries = _readAcervoEntries_(sheetName || ACERVO_SHEET_NAME);
    var cats = {};
    var colors = {};
    entries.forEach(function(entry) {
      if (entry.categoria) cats[entry.categoria] = true;
      if (entry.cor) colors[entry.cor] = true;
    });
    return {
      categorias: Object.keys(cats).sort(),
      cores: Object.keys(colors).sort()
    };
  } catch (error) {
    Logger.log("Erro em getAcervoFacetValues: " + error.message);
    throw error;
  }
}

function searchAcervo(query, filters, limit) {
  try {
    var entries = _readAcervoEntries_(ACERVO_SHEET_NAME);
    filters = filters || {};
    limit = Math.max(1, Math.min(Number(limit || ACERVO_DEFAULT_LIMIT), 100));

    var q = _normalizeSearchText_(query || '');
    var tokens = _tokenizeSearch_(q);
    var hasQuery = tokens.length > 0;
    var categoria = _normalizeSearchText_(filters.categoria || '');
    var cor = _normalizeSearchText_(filters.cor || '');

    var scored = [];
    entries.forEach(function(entry) {
      if (categoria && _normalizeSearchText_(entry.categoria) !== categoria) return;
      if (cor && _normalizeSearchText_(entry.cor) !== cor) return;

      var score = hasQuery ? _scoreAcervoEntry_(entry, q, tokens) : 1;
      if (score <= 0) return;

      var copy = _publicAcervoEntry_(entry);
      copy.score = score;
      scored.push(copy);
    });

    scored.sort(function(a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return String(a.obra).localeCompare(String(b.obra));
    });

    return scored.slice(0, limit);
  } catch (error) {
    Logger.log("Erro em searchAcervo: " + error.message);
    throw error;
  }
}

function getAcervoEntryById(id) {
  try {
    var wanted = String(id || '').trim();
    if (!wanted) return null;
    var entries = _readAcervoEntries_(ACERVO_SHEET_NAME);
    for (var i = 0; i < entries.length; i++) {
      if (String(entries[i].id) === wanted) return _publicAcervoEntry_(entries[i]);
    }
    return null;
  } catch (error) {
    Logger.log("Erro em getAcervoEntryById: " + error.message);
    throw error;
  }
}

function getAcervoInterreferences(seed, limit) {
  try {
    limit = Math.max(1, Math.min(Number(limit || 12), 40));
    var query = _cleanText_(seed);
    if (!query) return { consulta: '', base: [], termos: [], relacionados: [] };

    var base = searchAcervo(query, {}, 10);
    var entries = _readAcervoEntries_(ACERVO_SHEET_NAME);
    var seedTerms = {};

    base.forEach(function(item) {
      (item.termos || []).slice(0, 5).forEach(function(term) {
        seedTerms[_normalizeSearchText_(term)] = term;
      });
      seedTerms[_normalizeSearchText_(item.categoria)] = item.categoria;
    });

    _tokenizeSearch_(_normalizeSearchText_(query)).forEach(function(token) {
      seedTerms[token] = token;
    });

    var seedKeys = Object.keys(seedTerms).filter(Boolean);
    var baseIds = {};
    base.forEach(function(item) { baseIds[item.id] = true; });

    var related = [];
    entries.forEach(function(entry) {
      if (baseIds[entry.id]) return;

      var pontes = [];
      var score = 0;
      var normalizedTerms = entry.termos.map(_normalizeSearchText_);
      seedKeys.forEach(function(key) {
        if (!key) return;
        if (normalizedTerms.indexOf(key) !== -1) {
          pontes.push(seedTerms[key]);
          score += 12;
        } else if (entry.busca.indexOf(key) !== -1) {
          score += 4;
        }
      });

      if (base.length && entry.categoria === base[0].categoria) score += 8;
      if (base.length && entry.cor && entry.cor === base[0].cor) score += 2;
      if (score <= 0) return;

      var copy = _publicAcervoEntry_(entry);
      copy.score = score;
      copy.pontes = _uniqueList_(pontes).slice(0, 5);
      copy.referencia = copy.pontes.length
        ? 'Conecta por: ' + copy.pontes.join(', ')
        : 'Conecta por proximidade tematica.';
      related.push(copy);
    });

    related.sort(function(a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return String(a.obra).localeCompare(String(b.obra));
    });

    return {
      consulta: query,
      base: base.slice(0, 5),
      termos: seedKeys.map(function(key) { return seedTerms[key]; }).slice(0, 12),
      relacionados: related.slice(0, limit),
      geradoEm: new Date().toISOString()
    };
  } catch (error) {
    Logger.log("Erro em getAcervoInterreferences: " + error.message);
    throw error;
  }
}

function rebuildLinkMapFromAcervo(limit) {
  try {
    try {
      try {
        var entries = _readAcervoEntries_(ACERVO_SHEET_NAME);
        var maxLinks = Math.max(20, Math.min(Number(limit || 400), 1000));
        var pairMap = {};

        entries.forEach(function(entry) {
          var terms = _uniqueList_(entry.termos).slice(0, ACERVO_MAX_TERMS_PER_ROW);
          for (var i = 0; i < terms.length; i++) {
            for (var j = i + 1; j < terms.length; j++) {
              var a = terms[i];
              var b = terms[j];
              var key = _pairKey_(a, b);
              if (!pairMap[key]) pairMap[key] = { a: a, b: b, count: 0 };
              pairMap[key].count++;
            }
          }
        });

        var pairs = Object.keys(pairMap).map(function(key) {
          return pairMap[key];
        }).filter(function(pair) {
          return pair.count > 1;
        }).sort(function(a, b) {
          return b.count - a.count;
        }).slice(0, maxLinks);

        var rows = [['AssuntoA', 'AssuntoB', 'Descricao', 'Peso', 'CriadoEm', 'Fonte']];
        var now = new Date();
        pairs.forEach(function(pair) {
          rows.push([
            pair.a,
            pair.b,
            'Coocorrencia no acervo escolar em ' + pair.count + ' registro(s).',
            pair.count,
            now,
            ACERVO_SHEET_NAME
          ]);
        });

        var ss = getBoundSpreadsheet_();
        var sheet = ss.getSheetByName(LINK_SHEET_NAME) || ss.insertSheet(LINK_SHEET_NAME);
        sheet.clearContents();
        sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
        sheet.setFrozenRows(1);
        _invalidateAcervoCaches_();

        return { links: pairs.length, sheetName: LINK_SHEET_NAME, geradoEm: new Date().toISOString() };
      } catch (error) {
        Logger.log("Erro em rebuildLinkMapFromAcervo: " + error.message);
        throw error; // Re-lança para tratamento superior
      }
    } catch (error) {
      Logger.log("Erro em rebuildLinkMapFromAcervo: " + error.message);
      throw error;
    }
  } catch (error) {
    Logger.log("Erro em rebuildLinkMapFromAcervo: " + error.message);
    throw error;
  }
}

function getAcervoRecommendationCandidates(readCategories, limit) {
  try {
    var entries = _readAcervoEntries_(ACERVO_SHEET_NAME);
    var readMap = {};
    (readCategories || []).forEach(function(cat) {
      var key = _normalizeSearchText_(cat);
      if (key) readMap[key] = (readMap[key] || 0) + 1;
    });

    var candidates = entries.map(function(entry) {
      var catKey = _normalizeSearchText_(entry.categoria);
      var score = 10;
      if (!readMap[catKey]) score += 20;
      if (entry.titulo) score += 4;
      if (entry.autor) score += 3;
      if (entry.termos.length >= 3) score += 3;

      return {
        acervoId: entry.id,
        titulo: entry.obra,
        obra: entry.obra,
        tituloCatalogado: entry.titulo,
        autor: entry.autor,
        categoria: entry.categoria,
        assuntos: entry.assuntos,
        localizacao: entry.localizacao,
        cor: entry.cor,
        codigo: entry.codigo,
        justificativa: _buildAcervoJustification_(entry),
        catalogScore: score
      };
    });

    candidates.sort(function(a, b) {
      if (b.catalogScore !== a.catalogScore) return b.catalogScore - a.catalogScore;
      return String(a.obra).localeCompare(String(b.obra));
    });

    return candidates.slice(0, Math.max(1, Math.min(Number(limit || 80), 200)));
  } catch (error) {
    Logger.log("Erro em getAcervoRecommendationCandidates: " + error.message);
    throw error;
  }
}

function serveAcervoEscolarUI() {
  try {
    return HtmlService
      .createTemplateFromFile('AcervoEscolar').evaluate()
      .setTitle('UpOracular | Acervo Escolar');
  } catch (error) {
    Logger.log("Erro em serveAcervoEscolarUI: " + error.message);
    throw error;
  }
}

function _readAcervoEntries_(sheetName) {
  try {
    try {
      var ss = getBoundSpreadsheet_();
      var sheet = ss.getSheetByName(sheetName || ACERVO_SHEET_NAME);
      if (!sheet) return [];

      var data = sheet.getDataRange().getValues();
      if (data.length < 2) return [];

      var headers = data[0].map(function(h) { return String(h || '').trim(); });
      var headerMap = {};
      headers.forEach(function(header, index) {
        headerMap[_normalizeSearchText_(header)] = index;
      });

      return data.slice(1).filter(function(row) {
        return row.some(function(cell) { return cell !== '' && cell !== null; });
      }).map(function(row, index) {
        return _acervoRowToObject_(row, headerMap, index + 2);
      });
    } catch (error) {
      Logger.log("Erro em _readAcervoEntries_: " + error.message);
      throw error;
    }
  } catch (error) {
    Logger.log("Erro em _readAcervoEntries_: " + error.message);
    throw error;
  }
}

function _acervoRowToObject_(row, headerMap, sourceRow) {
  var get = function(name, fallbackIndex) {
    try {
      var key = _normalizeSearchText_(name);
      var idx = headerMap[key];
      if (idx === undefined || idx === null) idx = fallbackIndex;
      return _cleanText_(row[idx]);
    } catch (error) {
      Logger.log("Erro em get: " + error.message);
      throw error;
    }
  };

  var rawTerms = get('Termos', 9);
  var termos = rawTerms ? rawTerms.split(';').map(_cleanText_).filter(Boolean) : [];
  var assuntos = get('Assuntos', 4);
  if (!termos.length) termos = _extractAcervoTerms_(assuntos);

  var localizacao = get('Localizacao', 8);
  var loc = _parseAcervoLocation_(localizacao);
  var titulo = get('Titulo', 2);
  var autor = get('Autor', 3);
  var categoria = get('Categoria', 5) || _inferAcervoCategory_(assuntos, titulo, autor);
  var obra = get('Obra', 1) || _composeAcervoWorkLabel_(titulo, autor, assuntos, loc);
  var id = get('Id', 0) || 'ACV-' + _leftPad_(sourceRow - 1, 5);
  var busca = get('Busca', 10) || _normalizeSearchText_([
    id,
    obra,
    titulo,
    autor,
    assuntos,
    categoria,
    loc.cor,
    loc.codigo,
    termos.join(' ')
  ].join(' '));

  return {
    id: id,
    obra: obra,
    titulo: titulo,
    autor: autor,
    assuntos: assuntos,
    categoria: categoria,
    cor: get('Cor', 6) || loc.cor,
    codigo: get('Codigo', 7) || loc.codigo,
    localizacao: localizacao,
    termos: termos,
    busca: busca,
    fonteLinha: get('FonteLinha', 11) || sourceRow,
    atualizadoEm: get('AtualizadoEm', 12)
  };
}

function _acervoObjectToRow_(item) {
  try {
    return [
      item.id,
      item.obra,
      item.titulo,
      item.autor,
      item.assuntos,
      item.categoria,
      item.cor,
      item.codigo,
      item.localizacao,
      (item.termos || []).join('; '),
      item.busca,
      item.fonteLinha,
      item.atualizadoEm
    ];
  } catch (error) {
    Logger.log("Erro em _acervoObjectToRow_: " + error.message);
    throw error;
  }
}

function _publicAcervoEntry_(entry) {
  return {
    id: entry.id,
    obra: entry.obra,
    titulo: entry.titulo,
    autor: entry.autor,
    categoria: entry.categoria,
    assuntos: entry.assuntos,
    cor: entry.cor,
    codigo: entry.codigo,
    localizacao: entry.localizacao,
    termos: entry.termos,
    fonteLinha: entry.fonteLinha
  };
}

function _scoreAcervoEntry_(entry, query, tokens) {
  try {
    var score = 0;
    if (!query) return 1;

    if (entry.busca.indexOf(query) !== -1) score += 18;
    tokens.forEach(function(token) {
      if (entry.busca.indexOf(token) !== -1) score += 5;
      if (_normalizeSearchText_(entry.obra).indexOf(token) !== -1) score += 4;
      if (_normalizeSearchText_(entry.autor).indexOf(token) !== -1) score += 4;
      if (_normalizeSearchText_(entry.assuntos).indexOf(token) !== -1) score += 3;
      if (_normalizeSearchText_(entry.codigo) === token) score += 8;
    });
    return score;
  } catch (error) {
    Logger.log("Erro em _scoreAcervoEntry_: " + error.message);
    throw error;
  }
}

function _buildAcervoJustification_(entry) {
  try {
    var parts = [];
    if (entry.termos.length) parts.push('assuntos: ' + entry.termos.slice(0, 3).join(', '));
    if (entry.localizacao) parts.push('localizacao: ' + entry.localizacao);
    return parts.length ? 'Entrada do acervo escolar com ' + parts.join('; ') + '.' : 'Entrada do acervo escolar.';
  } catch (error) {
    Logger.log("Erro em _buildAcervoJustification_: " + error.message);
    throw error;
  }
}

function _composeAcervoWorkLabel_(titulo, autor, assuntos, loc) {
  try {
    if (titulo) return titulo;
    if (autor) return autor;
    var terms = _extractAcervoTerms_(assuntos);
    if (terms.length) return terms.slice(0, 2).join(' / ');
    if (loc && loc.localizacao) return loc.localizacao;
    return 'Entrada do acervo';
  } catch (error) {
    Logger.log("Erro em _composeAcervoWorkLabel_: " + error.message);
    throw error;
  }
}

function _parseAcervoLocation_(value) {
  try {
    var raw = _cleanText_(value);
    var first = raw.split(/\s+/)[0] || '';
    var cor = _canonicalAcervoColor_(first);
    var codigo = raw;
    if (first) {
      codigo = raw.replace(new RegExp('^' + _escapeRegExp_(first) + '\\s*', 'i'), '').trim();
    }
    return { cor: cor, codigo: codigo, localizacao: raw };
  } catch (error) {
    Logger.log("Erro em _parseAcervoLocation_: " + error.message);
    throw error;
  }
}

function _canonicalAcervoColor_(value) {
  try {
    var v = _normalizeSearchText_(value).toUpperCase();
    if (!v) return '';
    if (v.indexOf('AZUL') === 0) return 'AZUL';
    if (v.indexOf('AMAREL') === 0 || v.indexOf('AMAR') === 0) return 'AMARELO';
    if (v.indexOf('VERM') === 0) return 'VERMELHO';
    if (v.indexOf('VERD') === 0 || v === 'VER') return 'VERDE';
    return String(value || '').toUpperCase();
  } catch (error) {
    Logger.log("Erro em _canonicalAcervoColor_: " + error.message);
    throw error;
  }
}

function _inferAcervoCategory_(assuntos, titulo, autor) {
  try {
    var text = _normalizeSearchText_([assuntos, titulo, autor].join(' '));
    var rules = [
      { name: 'Literatura infantil e juvenil', words: ['literatura infantil', 'literatura infantojuvenil', 'infancia e juventude'] },
      { name: 'Narrativas e poesia', words: ['conto', 'poesia', 'fabula', 'conto de fadas', 'cronica', 'lenda'] },
      { name: 'Arte e cultura', words: ['arte', 'pintura', 'teatro', 'musica', 'cinema', 'danca', 'folclore'] },
      { name: 'Ciencias e natureza', words: ['ciencia', 'natureza', 'animais', 'animal', 'plantas', 'corpo humano', 'meio ambiente'] },
      { name: 'Ciencias humanas', words: ['historia', 'geografia', 'sociedade', 'cultura', 'brasil', 'escravidao', 'indigena', 'afro'] },
      { name: 'Formacao humana', words: ['amizade', 'familia', 'medo', 'respeito', 'diferencas', 'comportamento', 'sentimentos'] },
      { name: 'Matematica', words: ['matematica', 'numeros', 'geometria'] }
    ];

    for (var i = 0; i < rules.length; i++) {
      if (rules[i].words.some(function(word) { return text.indexOf(word) !== -1; })) {
        return rules[i].name;
      }
    }
    return 'Geral';
  } catch (error) {
    Logger.log("Erro em _inferAcervoCategory_: " + error.message);
    throw error;
  }
}

function _extractAcervoTerms_(assuntos) {
  try {
    var seen = {};
    var terms = [];
    _cleanText_(assuntos).split(/[,;/]/).forEach(function(part) {
      var term = _cleanText_(part);
      if (!term || term.length < 3) return;
      if (/^\d{3,4}(-\d{0,4})?$/.test(term)) return;
      var key = _normalizeSearchText_(term);
      if (!key || seen[key]) return;
      seen[key] = true;
      terms.push(term);
    });
    return terms.slice(0, ACERVO_MAX_TERMS_PER_ROW);
  } catch (error) {
    Logger.log("Erro em _extractAcervoTerms_: " + error.message);
    throw error;
  }
}

function _tokenizeSearch_(text) {
  try {
    var stop = {
      a: true, o: true, os: true, as: true, de: true, do: true, da: true, dos: true, das: true,
      e: true, em: true, para: true, por: true, com: true, um: true, uma: true
    };
    return _normalizeSearchText_(text).split(/\s+/).filter(function(token) {
      return token.length > 2 && !stop[token];
    });
  } catch (error) {
    Logger.log("Erro em _tokenizeSearch_: " + error.message);
    throw error;
  }
}

function _normalizeSearchText_(value) {
  try {
    return _cleanText_(value)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  } catch (error) {
    Logger.log("Erro em _normalizeSearchText_: " + error.message);
    throw error;
  }
}

function _cleanText_(value) {
  try {
    return String(value === null || value === undefined ? '' : value)
      .replace(/\s+/g, ' ')
      .trim();
  } catch (error) {
    Logger.log("Erro em _cleanText_: " + error.message);
    throw error;
  }
}

function _looksLikeAcervoHeader_(row) {
  try {
    var joined = _normalizeSearchText_(row.join(' '));
    return joined.indexOf('assunto') !== -1 && joined.indexOf('autor') !== -1;
  } catch (error) {
    Logger.log("Erro em _looksLikeAcervoHeader_: " + error.message);
    throw error;
  }
}

function _acervoRowHasContent_(row) {
  try {
    return (row || []).some(function(cell) { return _cleanText_(cell) !== ''; });
  } catch (error) {
    Logger.log("Erro em _acervoRowHasContent_: " + error.message);
    throw error;
  }
}

function _sortCountObject_(obj) {
  try {
    return Object.keys(obj).map(function(key) {
      return { nome: key, total: obj[key] };
    }).sort(function(a, b) {
      if (b.total !== a.total) return b.total - a.total;
      return a.nome.localeCompare(b.nome);
    });
  } catch (error) {
    Logger.log("Erro em _sortCountObject_: " + error.message);
    throw error;
  }
}

function _pairKey_(a, b) {
  try {
    var pair = [a, b].sort();
    return _normalizeSearchText_(pair[0]) + '::' + _normalizeSearchText_(pair[1]);
  } catch (error) {
    Logger.log("Erro em _pairKey_: " + error.message);
    throw error;
  }
}

function _uniqueList_(items) {
  try {
    var seen = {};
    var out = [];
    (items || []).forEach(function(item) {
      var key = _normalizeSearchText_(item);
      if (!key || seen[key]) return;
      seen[key] = true;
      out.push(item);
    });
    return out;
  } catch (error) {
    Logger.log("Erro em _uniqueList_: " + error.message);
    throw error;
  }
}

function _leftPad_(value, size) {
  try {
    var text = String(value);
    while (text.length < size) text = '0' + text;
    return text;
  } catch (error) {
    Logger.log("Erro em _leftPad_: " + error.message);
    throw error;
  }
}

function _escapeRegExp_(value) {
  try {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  } catch (error) {
    Logger.log("Erro em _escapeRegExp_: " + error.message);
    throw error;
  }
}

function _invalidateAcervoCaches_() {
  try {
    try {
      CacheService.getScriptCache().remove('GLOBAL_TRENDS');
    } catch (e) {
      LoggerService.info('AcervoService cache: ' + e.message);
    }
  } catch (error) {
    Logger.log("Erro em _invalidateAcervoCaches_: " + error.message);
    throw error;
  }
}
