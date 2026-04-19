export type PlatformRole = 'EMPLOYEE' | 'WORKSPACE_ADMIN' | 'ADMIN' | 'Admin' | 'OWNER';

const PLATFORM_ROLES = new Set<PlatformRole>(['EMPLOYEE', 'WORKSPACE_ADMIN', 'ADMIN', 'Admin', 'OWNER']);

export function normalizePlatformRole(value?: string | null): PlatformRole {
  const normalized = String(value || 'EMPLOYEE')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');

  if (normalized === 'ADMINISTRATOR') return 'Admin';
  if (PLATFORM_ROLES.has(normalized as PlatformRole)) {
    return normalized as PlatformRole;
  }

  return 'EMPLOYEE';
}
