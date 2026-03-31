import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';

/**
 * Utility to handle ICO files in React Native
 * Since RN doesn't support ICO natively, this attempts to load ICO as image source
 */
export class IcoHandler {
  static async getIcoSource(icoPath) {
    try {
      // First try to use the ICO directly (some image libraries can handle ICO)
      return icoPath;
    } catch (error) {
      console.warn('ICO direct loading failed, trying alternative method:', error);
      // Fallback: try to load as asset and convert to base64
      try {
        const asset = Asset.fromModule(icoPath);
        await asset.downloadAsync();

        const base64 = await FileSystem.readAsStringAsync(asset.localUri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        // Return as data URI (assuming ICO contains compatible image data)
        return { uri: `data:image/png;base64,${base64}` };
      } catch (fallbackError) {
        console.warn('ICO fallback loading failed:', fallbackError);
        // Final fallback: return original ICO path
        return icoPath;
      }
    }
  }
}