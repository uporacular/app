/**
 * TrailMapper.gs
 * Mapeia registros dispersos de leitura do usuário em grafos lógicos
 * ou sequências (trilhas formativas) indicando conexões interdisciplinares.
 */

/**
 * Analisa o histórico de um usuário e cria conexões sequenciais lógicas
 * entre os temas.
 * 
 * @param {string} userId
 * @return {Array<Object>} Lista de grafos/nós mapeados (A trilha conectada do usuário)
 */
function mapUserReadingTrail(userId) {
  var records = getReadingRecordsByUser(userId); 
  if (!records || records.length < 2) return []; // Requer pelo menos 2 registros para mapear conexão

  // Ordenar por data cronológica para formar uma linha do tempo (trilha)
  records.sort(function(a, b) {
    return new Date(a.date) - new Date(b.date);
  });

  var mappedNodes = [];
  
  // Constrói O Mapeamento Interdisciplinar passo-a-passo
  for (var i = 0; i < records.length; i++) {
    var currentNode = {
      step: i + 1,
      bookId: records[i].id,
      bookTitle: records[i].book,
      category: records[i].category,
      connectionType: 'INICIAL',
      insight: ''
    };

    if (i > 0) {
      var prevNode = mappedNodes[i - 1];
      if (currentNode.category === prevNode.category) {
        currentNode.connectionType = 'APROFUNDAMENTO';
        currentNode.insight = 'O usuário se aprofundou no tema de ' + currentNode.category + '.';
      } else {
        currentNode.connectionType = 'INTERDISCIPLINAR';
        currentNode.insight = 'Ponte criada entre ' + prevNode.category + ' e ' + currentNode.category + '.';
      }
    }

    mappedNodes.push(currentNode);
  }

  // Gera o relatório consolidado na UI ou Log
  return mappedNodes;
}

/**
 * Mapeia trilhas globais da biblioteca baseada na contagem de categorias.
 * @return {Object} Mapa global de frequência.
 */
function mapGlobalLibraryNodes() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Leituras');
  if (!sheet) return {};

  var data = sheet.getDataRange().getValues();
  var categoryMatrix = {};

  for (var i = 1; i < data.length; i++) {
    var cat = data[i][3]; // CATEGORY is column 3
    if (cat) {
      categoryMatrix[cat] = (categoryMatrix[cat] || 0) + 1;
    }
  }
  
  return categoryMatrix;
}
