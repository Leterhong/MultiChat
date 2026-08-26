export function redactSecrets(value: unknown): string {
  return String(value ?? '')
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+\/-]{8,}={0,2}/gi, '$1 ***')
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, 'sk-***')
    .replace(/([?&](?:access_token|client_secret|api_?key|token|password)=)[^&#\s]+/gi, '$1***')
    .replace(/\b((?:api_?key|access_?token|client_?secret|authorization|password)\s*[:=]\s*)[^\s,;]+/gi, '$1***');
}
