import { File, Paths } from 'expo-file-system';

const writtenFiles = new Set<string>();

/**
 * Persists static map HTML into the app cache directory for @expo/dom-webview,
 * falling back to an inline data URI if cache storage is unavailable.
 */
export function getLeafletMapUri(filename: string, html: string): string {
  try {
    const file = new File(Paths.cache, filename);
    if (!writtenFiles.has(filename) || !file.exists) {
      file.create({ intermediates: true, overwrite: true });
      file.write(html);
      writtenFiles.add(filename);
    }
    return file.uri;
  } catch {
    return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
  }
}
