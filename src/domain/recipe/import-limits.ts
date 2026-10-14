// Claude through Bedrock or Vertex refuses an image over 5 MB of base64, which grows a file by a
// third, so the browser encodes scans within this and imports refuse larger ones. The settings
// schema's bound on settings.photos.maxScansPerImport assumes it.
export const maxImportScanSizeInBytes = 3_750_000;
