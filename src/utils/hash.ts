export async function computeBufferHash(buffer: ArrayBuffer | Uint8Array): Promise<string> {
  try {
    const data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data as any);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch (error) {
    // Fallback hash
    let hash = 0;
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    for (let i = 0; i < Math.min(bytes.length, 100000); i++) {
      hash = (hash << 5) - hash + bytes[i];
      hash |= 0;
    }
    return `fb_${Math.abs(hash)}_${bytes.length}`;
  }
}

export function arrayBufferToBase64(buffer: Uint8Array): string {
  let binary = '';
  const len = buffer.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary);
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}
