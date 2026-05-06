import "next-auth";
import type { Permissions } from "@/lib/permissions";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
      clinicId: string;
      clinicName: string;
      mustChangePassword: boolean;
      permissions: Permissions | null;
    };
  }

  interface User {
    role: string;
    clinicId: string;
    clinicName: string;
    mustChangePassword: boolean;
    permissions: Permissions | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: string;
    clinicId: string;
    clinicName: string;
    mustChangePassword: boolean;
    permissions: Permissions | null;
  }
}
