const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

export function bytesToBase64(bytes: Uint8Array): string {
  if (bytes.length === 0) return ''

  const parts = new Array<string>(Math.ceil(bytes.length / 3))
  let partIndex = 0

  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]
    const hasB = i + 1 < bytes.length
    const hasC = i + 2 < bytes.length
    const b = hasB ? bytes[i + 1] : 0
    const c = hasC ? bytes[i + 2] : 0

    parts[partIndex++] =
      BASE64_ALPHABET[a >> 2] +
      BASE64_ALPHABET[((a & 0x03) << 4) | (b >> 4)] +
      (hasB ? BASE64_ALPHABET[((b & 0x0f) << 2) | (c >> 6)] : '=') +
      (hasC ? BASE64_ALPHABET[c & 0x3f] : '=')
  }

  return parts.join('')
}

export function base64ToBytes(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
}

export function base64ToText(base64: string): string {
  return new TextDecoder().decode(base64ToBytes(base64))
}

export function toPlainArrayBuffer(view: ArrayBufferView): ArrayBuffer {
  return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength) as ArrayBuffer
}
