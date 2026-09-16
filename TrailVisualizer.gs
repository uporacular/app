/**
 * TrailVisualizer.gs
 * Geração de estruturas de dados para visualização de trilhas de leitura.
 * Produz grafos de categorias, sequências temporais e mapas de transição.
 */

/**
 * Retorna a sequência de categorias únicas lidas por um usuário (trilha simplificada).
 * Deduplication: categorias consecutivas iguais são colapsadas.
 * @param {string} userId
 * @return {Array<string>}
 */
function getUserTrailCategories(userId) {
  try {
    var ss    = getBoundSpreadsheet_();
    var sheet = ss.getSheetByName('Leituras');
    if (!sheet) return [];

    var data  = sheet.getDataRange().getValues();
    var trail = [];
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][1]) !== String(userId)) continue;
      var cat = data[i][3];
      if (cat && trail[trail.length - 1] !== cat) {
        trail.push(String(cat));
      }
    }
    return trail;
  } catch (error) {
    Logger.log("Erro em getUserTrailCategories: " + error.message);
    throw error;
  }
}

/**
 * Constrói um grafo de nós de trilha para renderização visual.
 * Cada nó representa uma leitura; as arestas representam sequência temporal.
 * @param {string} userId
 * @return {Object} {nodes: [], edges: []}
 */
function buildUserTrailGraph(userId) {
  try {
    try {
      var ss    = getBoundSpreadsheet_();
      var sheet = ss.getSheetByName('Leituras');
      if (!sheet) return { nodes: [], edges: [] };

      var data  = sheet.getDataRange().getValues();
      var nodes = [];
      var edges = [];

      var userRows = data.slice(1).filter(function(row) {
        return String(row[1]) === String(userId);
      });

      userRows.forEach(function(row, idx) {
        nodes.push({
          id:       idx,
          title:    String(row[2]),
          category: String(row[3]),
          date:     String(row[4])
        });
        if (idx > 0) {
          edges.push({ from: idx - 1, to: idx });
        }
      });

      return { nodes: nodes, edges: edges };
    } catch (error) {
      Logger.log("Erro em buildUserTrailGraph: " + error.message);
      throw error;
    }
  } catch (error) {
    Logger.log("Erro em buildUserTrailGraph: " + error.message);
    throw error;
  }
}

/**
 * Calcula frequência de leitura por categoria para gráfico de barras.
 * @param {string} userId
 * @return {Array<Object>} [{categoria, count}] ordenado por count desc.
 */
function getCategoryFrequency(userId) {
  try {
    try {
      var ss    = getBoundSpreadsheet_();
      var sheet = ss.getSheetByName('Leituras');
      if (!sheet) return [];

      var data  = sheet.getDataRange().getValues();
      var freq  = {};

      for (var i = 1; i < data.length; i++) {
        if (String(data[i][1]) !== String(userId)) continue;
        var cat = String(data[i][3] || 'Sem categoria');
        freq[cat] = (freq[cat] || 0) + 1;
      }

      var result = [];
      for (var k in freq) {
        result.push({ categoria: k, count: freq[k] });
      }
      return result.sort(function(a, b) { return b.count - a.count; });
    } catch (error) {
      Logger.log("Erro em getCategoryFrequency: " + error.message);
      throw error;
    }
  } catch (error) {
    Logger.log("Erro em getCategoryFrequency: " + error.message);
    throw error;
  }
}

/**
 * Gera matriz de transição entre categorias (heatmap input).
 * Ex: quantas vezes o usuário passou de 'Ficção' para 'Ciências Humanas'.
 * @param {string} userId
 * @return {Object} {from: string, to: string, count: number}[]
 */
function getCategoryTransitionMatrix(userId) {
  try {
    var categories = getUserTrailCategories(userId);
    var transitions = {};

    for (var i = 0; i < categories.length - 1; i++) {
      var key = categories[i] + ' → ' + categories[i + 1];
      transitions[key] = (transitions[key] || 0) + 1;
    }

    return Object.keys(transitions).map(function(k) {
      var parts = k.split(' → ');
      return { from: parts[0], to: parts[1], count: transitions[k] };
    }).sort(function(a, b) { return b.count - a.count; });
  } catch (error) {
    Logger.log("Erro em getCategoryTransitionMatrix: " + error.message);
    throw error;
  }
}

/**
 * Serve a sidebar de visualização de trilha via HtmlService.
 * @return {HtmlOutput}
 */
function serveTrailVisualizerUI() {
  try {
    return HtmlService
      .createTemplateFromFile('TrailVisualizerHtml').evaluate()
      .setTitle('UpOracular | Mapa de Trilha');
  } catch (error) {
    Logger.log("Erro em serveTrailVisualizerUI: " + error.message);
    throw error;
  }
}

/**
 * Interface de maturidade — constrói dados brutos de visualização.
 */
function buildVisualizationData(userId) {
  return getUserTrailCategories(userId);
}

/**
 * Interface de maturidade — constrói estrutura de nós do grafo.
 */
function buildGraphNodes(userId) {
  return buildUserTrailGraph(userId);
}

/**
 * Interface de maturidade — gera a matriz de categorias do usuário.
 */
function buildCategoryMatrix(userId) {
  return getCategoryTransitionMatrix(userId);
}

