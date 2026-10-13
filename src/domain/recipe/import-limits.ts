// The pages of one recipe that an import reads in one call.
export const maxImportScans = 6;

// Claude through Bedrock or Vertex refuses an image over 5 MB of base64, which grows a file by a
// third, so the browser encodes scans within this and imports refuse larger ones.
export const maxImportScanSizeInBytes = 3_750_000;
