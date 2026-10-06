/** A VAPID public key (unpadded base64url, as the server hands it out) as the bytes
 * PushManager.subscribe wants for applicationServerKey. */
export function decodeServerKey(key: string): Uint8Array<ArrayBuffer> {
  // No padding added back: atob's forgiving decode accepts base64 without it.
  const binary = atob(key.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}
