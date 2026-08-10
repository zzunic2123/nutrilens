const MAX_DIMENSION = 1280
const JPEG_QUALITY = 0.78

export async function compressMealImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.')
  if (file.size > 12 * 1024 * 1024) throw new Error('That photo is too large. Please choose one under 12 MB.')

  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Your browser could not prepare the image.')
  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  return canvas.toDataURL('image/jpeg', JPEG_QUALITY)
}

export function dataUrlSizeInBytes(dataUrl: string): number {
  const base64 = dataUrl.split(',')[1] ?? ''
  const padding = base64.match(/=+$/)?.[0].length ?? 0
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding)
}
