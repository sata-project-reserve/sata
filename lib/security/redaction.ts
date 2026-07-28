const SECRET_PATTERNS = [
  /(api[_-]?key=)[^&\s]+/gi,
  /(token=)[^&\s]+/gi,
  /(signature=)[^&\s]+/gi,
  /(x-api-key:\s*)[^\s]+/gi
];

export function redactSecretText(value: string): string {
  return SECRET_PATTERNS.reduce((acc, pattern) => acc.replace(pattern, '$1[REDACTED]'), value);
}

export function redactRpcUrl(value: string): string {
  try {
    const url = new URL(value);
    url.username = '';
    url.password = '';
    for (const key of Array.from(url.searchParams.keys())) {
      url.searchParams.set(key, '[REDACTED]');
    }
    return `${url.protocol}//${url.host}${url.pathname}${url.search}`;
  } catch {
    return redactSecretText(value);
  }
}
