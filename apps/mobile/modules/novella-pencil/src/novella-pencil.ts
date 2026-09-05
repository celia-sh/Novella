import { requireNativeModule } from 'expo-modules-core';

interface NovellaPencilNativeModule {
  activate(): void;
  addListener(eventName: 'onPencilTap', listener: () => void): { remove(): void };
  removeAllListeners(eventName: 'onPencilTap'): void;
}

export const NovellaPencil = requireNativeModule<NovellaPencilNativeModule>('NovellaPencil');
