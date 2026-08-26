import { requireNativeModule } from 'expo';

interface ReaderImageRasterizerModule {
  rasterizeReaderImage(uri: string, maxPixelSize: number): Promise<string>;
}

const NativeReaderImageRasterizer = requireNativeModule<ReaderImageRasterizerModule>('NovellaUi');

export const readerImageRasterizerAvailable = true;

export function rasterizeReaderImage(uri: string, maxPixelSize: number): Promise<string> {
  return NativeReaderImageRasterizer.rasterizeReaderImage(uri, maxPixelSize);
}
