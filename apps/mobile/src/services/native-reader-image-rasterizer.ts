export const readerImageRasterizerAvailable = false;

export function rasterizeReaderImage(_uri: string, _maxPixelSize: number): Promise<string> {
  return Promise.reject(new Error('Reader image rasterization is only available on iOS'));
}
