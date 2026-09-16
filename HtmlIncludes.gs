/**
 * codex-html-include-helper
 * Helper padrao da frota para scriptlets <?!= include('Arquivo') ?>.
 * Necessario porque as paginas (AdminFeatures, ReadingRecordHtml, etc.)
 * referenciam include('ClientCall') e este projeto nao definia a funcao.
 *
 * Usa createTemplateFromFile().evaluate() para que partials com scriptlets
 * aninhados tambem sejam avaliados (mesmo contrato do PCA pos-correcao).
 * Tolerante a arquivo ausente: devolve comentario HTML em vez de quebrar a pagina.
 */
function include(filename) {
  if (!filename) {
    return '<!-- include: nome de arquivo indefinido -->';
  }
  try {
    return HtmlService.createTemplateFromFile(filename).evaluate().getContent();
  } catch (e) {
    return '<!-- include: arquivo "' + filename + '" nao encontrado -->';
  }
}

/**
 * Compacta dados estáticos para uso em data URLs (como logos base64)
 * Remove todos os espaços em branco para otimizar o tamanho
 */
function includeInlineData(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent().replace(/\s+/g, '');
}
