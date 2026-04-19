import 'next-auth';
import 'next-auth/jwt';
import type { DefaultSession } from 'next-auth';
import type { PlatformRole } from '@/lib/roles';

declare module 'next-auth' {
  interface Session {
    user: {
      id?: string;
      role?: PlatformRole;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    role?: PlatformRole;
  }
}
