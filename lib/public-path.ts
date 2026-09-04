const configuredBasePath = process.env.NEXT_PUBLIC_SITE_BASE_PATH ?? '';

export function publicPath(path: string): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(path)) return path;
  if (!path.startsWith('/')) return path;
  if (configuredBasePath === '') return path;
  if (path === '/') return configuredBasePath;
  return `${configuredBasePath}${path}`;
}
