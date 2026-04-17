export async function encryptText(text: string, password: string): Promise<string> {
  try {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits', 'deriveKey']
    );
    const key = await window.crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: enc.encode('chat-salt-e2ee'), iterations: 100000, hash: 'SHA-256' },
      keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
    );
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const cipherText = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv }, key, enc.encode(text)
    );
    
    // Combine IV and cipherText
    const combined = new Uint8Array(iv.length + cipherText.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(cipherText), iv.length);
    
    // Convert to base64 safely
    const binary = Array.from(combined).map(x => String.fromCharCode(x)).join('');
    return btoa(binary);
  } catch (error) {
    console.error("Encryption failed", error);
    return text; // fallback or error handling
  }
}

export async function decryptText(encryptedText: string, password: string): Promise<string> {
  try {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits', 'deriveKey']
    );
    const key = await window.crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: enc.encode('chat-salt-e2ee'), iterations: 100000, hash: 'SHA-256' },
      keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
    );
    
    const binaryStr = atob(encryptedText);
    const combined = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      combined[i] = binaryStr.charCodeAt(i);
    }
    
    const iv = combined.slice(0, 12);
    const cipherText = combined.slice(12);
    
    const plainText = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv }, key, cipherText
    );
    return new TextDecoder().decode(plainText);
  } catch (error) {
    throw new Error('Decryption Failed');
  }
}
