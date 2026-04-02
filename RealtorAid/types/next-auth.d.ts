import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: "owner" | "agent" | "admin";
      organizationId: string;
      organizationSlug: string;
      organizationName: string;
    };
  }

  interface User {
    role: "owner" | "agent" | "admin";
    organizationId: string;
    organizationSlug: string;
    organizationName: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: "owner" | "agent" | "admin";
    organizationId?: string;
    organizationSlug?: string;
    organizationName?: string;
  }
}
