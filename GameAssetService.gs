/**
 * Catálogo de assets visuais do Up Oracular.
 *
 * Os arquivos são encontrados por nome exato dentro da pasta configurada em
 * FOLDER_ID. Nenhum ID individual ou caminho local é exposto ao cliente.
 */
const GAME_ASSET_PROJECT = 'up-oracular';
const GAME_ASSET_FILES = Object.freeze([
  'biblioteca_caminhos_hero.webp',
  'cartoes_antecipacao.webp',
  'conexoes_literarias.svg',
  'mapa_trilha_leitura.svg',
  'mascote_livro_bussola.png',
  'portais_generos.svg',
  'selo_leitor_explorador.svg'
]);

const GAME_ASSET_MIME_TYPES = Object.freeze({
  png: ['image/png'],
  svg: ['image/svg+xml'],
  webp: ['image/webp']
});

function getGameAssetManifest() {
  return GameAssetService_getManifest_();
}

function GameAssetService_getManifest_() {
  const manifest = {
    project: GAME_ASSET_PROJECT,
    ok: false,
    assets: {},
    assetItems: [],
    missing: [],
    duplicates: [],
    invalidMimeTypes: [],
    error: ''
  };

  try {
    const folder = GameAssetService_resolveFolder_();
    GAME_ASSET_FILES.forEach(function(name) {
      const matches = folder.getFilesByName(name);
      const files = [];
      while (matches.hasNext()) files.push(matches.next());

      if (!files.length) {
        manifest.missing.push(name);
        return;
      }
      if (files.length > 1) {
        manifest.duplicates.push(name);
        return;
      }

      const file = files[0];
      if (!GameAssetService_hasExpectedMimeType_(name, file.getMimeType())) {
        manifest.invalidMimeTypes.push({ name: name, mimeType: file.getMimeType() });
        return;
      }

      const item = {
        name: name,
        mimeType: file.getMimeType(),
        url: 'https://drive.google.com/uc?export=view&id=' + encodeURIComponent(file.getId())
      };
      manifest.assets[name] = item.url;
      manifest.assetItems.push(item);
    });

    manifest.ok = !manifest.missing.length &&
      !manifest.duplicates.length &&
      !manifest.invalidMimeTypes.length;

    if (!manifest.ok) {
      manifest.assets = {};
      manifest.assetItems = [];
      manifest.error = GameAssetService_buildError_(manifest);
    }
  } catch (error) {
    manifest.assets = {};
    manifest.assetItems = [];
    manifest.error = error && error.message ? error.message : String(error);
  }

  return manifest;
}

function GameAssetService_resolveFolder_() {
  const folderId = String(PropertiesService.getScriptProperties().getProperty('FOLDER_ID') || '').trim();
  if (!folderId) {
    throw new Error('Configure FOLDER_ID nas propriedades do script para carregar os assets do Up Oracular.');
  }
  return DriveApp.getFolderById(folderId);
}

function GameAssetService_hasExpectedMimeType_(name, mimeType) {
  const extension = name.split('.').pop().toLowerCase();
  return (GAME_ASSET_MIME_TYPES[extension] || []).indexOf(mimeType) !== -1;
}

function GameAssetService_buildError_(manifest) {
  const parts = [];
  if (manifest.missing.length) parts.push('ausentes: ' + manifest.missing.join(', '));
  if (manifest.duplicates.length) parts.push('duplicados: ' + manifest.duplicates.join(', '));
  if (manifest.invalidMimeTypes.length) {
    parts.push('tipos inválidos: ' + manifest.invalidMimeTypes.map(function(item) {
      return item.name + ' (' + item.mimeType + ')';
    }).join(', '));
  }
  return 'Catálogo visual indisponível — ' + parts.join('; ') + '.';
}
