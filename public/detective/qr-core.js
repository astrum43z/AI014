/** Only bounded local pixel buffers, no network and no navigation. */
export function qrRasterSize(width, height) {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 || width * height > 40000000) throw new Error('图片像素过大或尺寸无效，请先在相册裁切二维码后重试。');
  const ratio = Math.min(1, 1600 / Math.max(width, height));
  return {width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio))};
}
export function decodeQrPixels({data, width, height}, decoder) {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 || width > 1600 || height > 1600 || !(data instanceof Uint8ClampedArray) || data.length !== width * height * 4) throw new Error('二维码像素格式无效，请重选图片。');
  if (typeof decoder !== 'function') throw new Error('二维码组件未能加载，请刷新重试。');
  const result = decoder(data, width, height, {inversionAttempts:'attemptBoth'});
  if (!result || typeof result.data !== 'string' || !result.data.length) throw new Error('没有识别出普通二维码。请裁切为一个清晰二维码并保留白边；小程序码和条形码不支持。');
  if (result.data.length > 12000) throw new Error('二维码内容过长，暂不支持在本页展示。');
  return result.data;
}
