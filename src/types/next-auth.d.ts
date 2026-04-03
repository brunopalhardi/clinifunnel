import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      clinicId: string;
      clinicName: string;
    };
  }

  interface User {
    clinicId: string;
    clinicName: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    clinicId: string;
    clinicName: string;
  }
}
