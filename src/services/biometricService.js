import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
class BiometricService {
  async isAvailable() {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
      
      return {
        hasHardware,
        isEnrolled,
        supportedTypes,
        isSupported: hasHardware && isEnrolled
      };
    } catch (error) {
      console.error('Error checking biometric availability:', error);
      return {
        hasHardware: false,
        isEnrolled: false,
        supportedTypes: [],
        isSupported: false
      };
    }
  }
  async authenticate(reason = 'Please verify your identity') {
    try {
      const biometricAuth = await LocalAuthentication.authenticateAsync({
        promptMessage: reason,
        cancelLabel: 'Cancel',
        fallbackLabel: 'Use password instead',
        disableDeviceFallback: false,
      });

      return {
        success: biometricAuth.success,
        error: biometricAuth.error,
        warning: biometricAuth.warning
      };
    } catch (error) {
      console.error('Biometric authentication error:', error);
      return {
        success: false,
        error: 'Authentication failed'
      };
    }
  }

  // Register/Enable biometric authentication for user
  async enableBiometric(userId) {
    try {
      const isSupported = await this.isAvailable();
      
      if (!isSupported.isSupported) {
        return {
          success: false,
          error: 'Biometric authentication is not available on this device'
        };
      }

      // Test biometric authentication
      const authResult = await this.authenticate('Enable fingerprint login for SaveAdvice');
      
      if (authResult.success) {
        // Store biometric preference for this user
        await AsyncStorage.setItem(`biometric_enabled_${userId}`, 'true');
        return {
          success: true,
          message: 'Fingerprint authentication enabled successfully'
        };
      } else {
        return {
          success: false,
          error: authResult.error || 'Failed to verify fingerprint'
        };
      }
    } catch (error) {
      console.error('Error enabling biometric:', error);
      return {
        success: false,
        error: 'Failed to enable fingerprint authentication'
      };
    }
  }

  // Check if biometric is enabled for user
  async isBiometricEnabled(userId) {
    try {
      const enabled = await AsyncStorage.getItem(`biometric_enabled_${userId}`);
      return enabled === 'true';
    } catch (error) {
      console.error('Error checking biometric status:', error);
      return false;
    }
  }

  // Disable biometric authentication for user
  async disableBiometric(userId) {
    try {
      await AsyncStorage.removeItem(`biometric_enabled_${userId}`);
      return {
        success: true,
        message: 'Fingerprint authentication disabled'
      };
    } catch (error) {
      console.error('Error disabling biometric:', error);
      return {
        success: false,
        error: 'Failed to disable fingerprint authentication'
      };
    }
  }

  // Login using biometric authentication
  async biometricLogin(userId) {
    try {
      const isEnabled = await this.isBiometricEnabled(userId);
      
      if (!isEnabled) {
        return {
          success: false,
          error: 'Fingerprint authentication is not enabled for this account'
        };
      }

      const authResult = await this.authenticate('Login with your fingerprint');
      
      if (authResult.success) {
        return {
          success: true,
          message: 'Fingerprint authentication successful'
        };
      } else {
        return {
          success: false,
          error: authResult.error || 'Fingerprint authentication failed'
        };
      }
    } catch (error) {
      console.error('Biometric login error:', error);
      return {
        success: false,
        error: 'Fingerprint login failed'
      };
    }
  }

  // Get supported biometric types as readable strings
  async getSupportedBiometrics() {
    try {
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      const typeNames = types.map(type => {
        switch (type) {
          case LocalAuthentication.AuthenticationType.FINGERPRINT:
            return 'Fingerprint';
          case LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION:
            return 'Face Recognition';
          case LocalAuthentication.AuthenticationType.IRIS:
            return 'Iris';
          default:
            return 'Biometric';
        }
      });
      return typeNames;
    } catch (error) {
      console.error('Error getting supported biometrics:', error);
      return [];
    }
  }
}

export default new BiometricService();
