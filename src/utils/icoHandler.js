import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';

/**
 * Utility to handle ICO files in React Native
 * Metro bundler now supports ICO files via config
 */
export class IcoHandler {
  static async getIcoSource(icoAsset) {
    try {
      if (!icoAsset) return null;
      // ICO asset is now handled by Metro, return it directly
      return icoAsset;
    } catch (error) {
      console.warn('ICO loading failed:', error);
      return icoAsset; // fallback to original asset
    }
  }

  static async getIcoUri(icoAsset) {
    try {
      if (!icoAsset) return null;
      const asset = Asset.fromModule(icoAsset);
      await asset.downloadAsync();
      return asset.localUri;
    } catch (error) {
      console.warn('ICO URI loading failed:', error);
      return null;
    }
  }
}