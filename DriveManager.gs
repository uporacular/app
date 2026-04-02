/**
 * DriveManager.gs
 * Gerenciamento de arquivos e pastas no Google Drive para o UpOracular.
 * Operações de criação, listagem, movimentação, cópia e organização de arquivos.
 */

var DRIVE_ROOT_FOLDER = 'UpOracular';

/**
 * Cria ou retorna a pasta raiz do UpOracular no Drive.
 * @return {Folder}
 */
function getRootFolder() {
  var folders = DriveApp.getFoldersByName(DRIVE_ROOT_FOLDER);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(DRIVE_ROOT_FOLDER);
}

/**
 * Cria uma subpasta dentro da pasta raiz UpOracular.
 * @param {string} name
 * @return {string} ID da pasta criada.
 */
function createFolder(name) {
  var root   = getRootFolder();
  var folder = root.createFolder(name);
  return folder.getId();
}

/**
 * Obtém ou cria uma subpasta pelo nome dentro da raiz UpOracular.
 * @param {string} name
 * @return {Folder}
 */
function getOrCreateFolder(name) {
  var root    = getRootFolder();
  var folders = root.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : root.createFolder(name);
}

/**
 * Lista todos os arquivos em uma pasta do Drive.
 * @param {string} folderId
 * @return {Array<Object>} [{id, name, mimeType, url, modified}]
 */
function listFilesInFolder(folderId) {
  var folder = DriveApp.getFolderById(folderId);
  var files  = folder.getFiles();
  var result = [];
  while (files.hasNext()) {
    var file = files.next();
    result.push({
      id:       file.getId(),
      name:     file.getName(),
      mimeType: file.getMimeType(),
      url:      file.getUrl(),
      modified: file.getLastUpdated().toISOString()
    });
  }
  return result.sort(function(a, b) { return b.modified.localeCompare(a.modified); });
}

/**
 * Move um arquivo para uma pasta de destino.
 * @param {string} fileId
 * @param {string} targetFolderName  Nome da pasta dentro da raiz UpOracular.
 * @return {boolean}
 */
function moveFileToFolder(fileId, targetFolderName) {
  var file       = DriveApp.getFileById(fileId);
  var dest       = getOrCreateFolder(targetFolderName);
  var parents    = file.getParents();
  dest.addFile(file);
  while (parents.hasNext()) { parents.next().removeFile(file); }
  return true;
}

/**
 * Cria um arquivo de texto/JSON no Drive dentro da pasta UpOracular.
 * @param {string} filename
 * @param {string} content
 * @param {string} mimeType  Ex: MimeType.PLAIN_TEXT ou 'application/json'
 * @return {string} URL do arquivo criado.
 */
function createTextFile(filename, content, mimeType) {
  var root = getRootFolder();
  var file = root.createFile(filename, content, mimeType || MimeType.PLAIN_TEXT);
  return file.getUrl();
}

/**
 * Exporta um JSON como arquivo no Drive.
 * @param {Object} data
 * @param {string} filename
 * @return {string} URL do arquivo.
 */
function saveJsonToDrive(data, filename) {
  var content   = JSON.stringify(data, null, 2);
  var cache     = CacheService.getScriptCache();
  var cacheKey  = 'DRIVE_JSON_' + filename;
  cache.put(cacheKey, content.substring(0, 100000), 300);
  return createTextFile(filename + '.json', content, 'application/json');
}

/**
 * Retorna o URL de um arquivo existente pelo nome na pasta raiz.
 * @param {string} filename
 * @return {string|null}
 */
function getFileUrlByName(filename) {
  var root  = getRootFolder();
  var files = root.getFilesByName(filename);
  return files.hasNext() ? files.next().getUrl() : null;
}
