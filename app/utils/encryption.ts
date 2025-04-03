// Simple encryption/decryption for client-side use
// Note: This is not highly secure, but provides basic obfuscation
// For production, use server-side encryption or a secure vault service

export function encryptApiKey(apiKey: string): string {
  // Simple XOR encryption with a fixed key
  // In production, use a more secure method
  const key = process.env.NEXT_PUBLIC_ENCRYPTION_KEY || 'default-encryption-key';
  let result = '';
  
  for (let i = 0; i < apiKey.length; i++) {
    const charCode = apiKey.charCodeAt(i) ^ key.charCodeAt(i % key.length);
    result += String.fromCharCode(charCode);
  }
  
  return btoa(result); // Base64 encode
}

export function decryptApiKey(encryptedKey: string): string {
  try {
    const key = process.env.NEXT_PUBLIC_ENCRYPTION_KEY || 'default-encryption-key';
    const decoded = atob(encryptedKey); // Base64 decode
    let result = '';
    
    for (let i = 0; i < decoded.length; i++) {
      const charCode = decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length);
      result += String.fromCharCode(charCode);
    }
    
    return result;
  } catch (error) {
    console.error('Failed to decrypt API key:', error);
    return '';
  }
} 