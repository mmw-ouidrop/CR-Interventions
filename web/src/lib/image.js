// Prépare une photo avant stockage : correction d'orientation, réduction à
// `maxSide` px, conversion en JPEG. Indispensable car :
//  - Notion n'affiche pas le HEIC des iPhone ;
//  - une photo brute (5–10 Mo) pèserait lourd en stockage local et en 4G.
export async function prepareImage(file, { maxSide = 1600, quality = 0.82 } = {}) {
  let bitmap
  try {
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      bitmap = await createImageBitmap(file)
    }
  } catch {
    const err = new Error("Ce format de photo n'est pas pris en charge sur cet appareil.")
    err.code = 'IMAGE_UNSUPPORTED'
    throw err
  }

  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h })
  const ctx = canvas.getContext('2d')
  ctx.drawImage(bitmap, 0, 0, w, h)
  if (bitmap.close) bitmap.close()

  const blob = canvas.convertToBlob
    ? await canvas.convertToBlob({ type: 'image/jpeg', quality })
    : await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
  if (!blob) {
    const err = new Error('La photo n’a pas pu être traitée.')
    err.code = 'IMAGE_FAILED'
    throw err
  }
  return blob
}

export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1] || '')
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}
