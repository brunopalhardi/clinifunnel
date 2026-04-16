import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
      clinicId: string;
      clinicName: string;
    };
  }

  interface User {
    role: string;
    clinicId: string;
    clinicName: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: string;
    clinicId: string;
    clinicName: string;
  }
}
