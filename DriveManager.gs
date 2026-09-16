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
  if (typeof getConfiguredOutputFolder === 'function') {
    try {
      return getConfiguredOutputFolder();
    } catch (ignored) {}
  }
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
  try {
    var folder = DriveApp.getFolderById(folderId);
    var files  = folder.getFiles();
    var result = [];
    var max = 200;
    while (files.hasNext()) {
      var file = files.next();
      result.push({
        id:       file.getId(),
        name:     file.getName(),
        mimeType: file.getMimeType(),
        url:      file.getUrl(),
        modified: file.getLastUpdated().toISOString()
      });
      if (result.length >= max) break;
    }
    return result.sort(function(a, b) { return b.modified.localeCompare(a.modified); });
  } catch (error) {
    Logger.log("Erro em listFilesInFolder: " + error.message);
    throw error;
  }
}

/**
 * Move um arquivo para uma pasta de destino.
 * @param {string} fileId
 * @param {string} targetFolderName  Nome da pasta dentro da raiz UpOracular.
 * @return {boolean}
 */
function moveFileToFolder(fileId, targetFolderName) {
  try {
    var file       = DriveApp.getFileById(fileId);
    var dest       = getOrCreateFolder(targetFolderName);
    var parents    = file.getParents();
    dest.addFile(file);
    while (parents.hasNext()) { parents.next().removeFile(file); }
    return true;
  } catch (error) {
    Logger.log("Erro em moveFileToFolder: " + error.message);
    throw error;
  }
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
  try {
    var content   = JSON.stringify(data, null, 2);
    GASUtilities.setCache('DRIVE_JSON_' + filename, content.substring(0, 100000), 300);
    return createTextFile(filename + '.json', content, 'application/json');
  } catch (error) {
    Logger.log("Erro em saveJsonToDrive: " + error.message);
    throw error;
  }
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

/**
 * Busca arquivos pelo nome em toda a estrutura do Drive do UpOracular.
 * @param {string} searchTerm Termo de busca.
 * @param {number} maxResults Máximo de resultados (padrão: 50).
 * @return {Array<Object>} [{id, name, mimeType, url, path}]
 */
function searchFiles(searchTerm, maxResults) {
  try {
    maxResults = maxResults || 50;
    var results = [];
    var files = DriveApp.searchFiles(
      'title contains "' + searchTerm + '" and trashed = false'
    );
    
    while (files.hasNext() && results.length < maxResults) {
      var file = files.next();
      var parents = file.getParents();
      var path = '';
      if (parents.hasNext()) {
        path = parents.next().getName();
      }
      
      results.push({
        id: file.getId(),
        name: file.getName(),
        mimeType: file.getMimeType(),
        url: file.getUrl(),
        path: path,
        size: file.getSize(),
        modified: file.getLastUpdated().toISOString()
      });
    }
    
    return results;
  } catch (error) {
    Logger.log("Erro em searchFiles: " + error.message);
    return [];
  }
}

/**
 * Faz backup de um arquivo criando uma cópia com timestamp.
 * @param {string} fileId
 * @return {string} ID da cópia criada.
 */
function backupFile(fileId) {
  try {
    var file = DriveApp.getFileById(fileId);
    var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss');
    var backupName = file.getName() + '_backup_' + timestamp;
    
    var backupFolder = getOrCreateFolder('Backups');
    var copy = file.makeCopy(backupName, backupFolder);
    
    return copy.getId();
  } catch (error) {
    Logger.log("Erro em backupFile: " + error.message);
    throw error;
  }
}

/**
 * Remove arquivos antigos da pasta de backups.
 * @param {number} daysOld Arquivos mais antigos que N dias serão deletados.
 * @return {number} Quantidade de arquivos removidos.
 */
function cleanOldBackups(daysOld) {
  try {
    daysOld = daysOld || 90;
    var backupFolder = getOrCreateFolder('Backups');
    var files = backupFolder.getFiles();
    var cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysOld);
    
    var deleted = 0;
    while (files.hasNext()) {
      var file = files.next();
      if (file.getLastUpdated() < cutoff) {
        file.setTrashed(true);
        deleted++;
      }
    }
    
    return deleted;
  } catch (error) {
    Logger.log("Erro em cleanOldBackups: " + error.message);
    return 0;
  }
}

/**
 * Obtém estatísticas de uso do Drive.
 * @return {Object} {totalFiles, totalSize, byMimeType, oldestFile, newestFile}
 */
function getDriveStats() {
  try {
    var root = getRootFolder();
    var files = root.getFiles();
    
    var totalFiles = 0;
    var totalSize = 0;
    var byMimeType = {};
    var oldest = null;
    var newest = null;
    
    while (files.hasNext()) {
      var file = files.next();
      totalFiles++;
      totalSize += file.getSize();
      
      var mime = file.getMimeType();
      byMimeType[mime] = (byMimeType[mime] || 0) + 1;
      
      var modified = file.getLastUpdated();
      if (!oldest || modified < oldest.date) {
        oldest = {name: file.getName(), date: modified};
      }
      if (!newest || modified > newest.date) {
        newest = {name: file.getName(), date: modified};
      }
    }
    
    return {
      totalFiles: totalFiles,
      totalSize: totalSize,
      totalSizeMB: Math.round(totalSize / 1024 / 1024 * 100) / 100,
      byMimeType: byMimeType,
      oldestFile: oldest,
      newestFile: newest
    };
  } catch (error) {
    Logger.log("Erro em getDriveStats: " + error.message);
    return {totalFiles: 0, totalSize: 0};
  }
}

/**
 * Cria uma estrutura de pastas padrão para o projeto.
 * @return {Object} IDs das pastas criadas.
 */
function initializeFolderStructure() {
  try {
    var folders = ['Exports', 'Backups', 'Reports', 'Imports', 'Temp'];
    var created = {};
    
    folders.forEach(function(folderName) {
      var folder = getOrCreateFolder(folderName);
      created[folderName] = folder.getId();
    });
    
    return created;
  } catch (error) {
    Logger.log("Erro em initializeFolderStructure: " + error.message);
    return {};
  }
}
