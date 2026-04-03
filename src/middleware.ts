import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: { signIn: "/login" },
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/clinics/:path*",
    "/api/leads/:path*",
    "/api/campaigns/:path*",
    "/api/procedures/:path*",
    "/api/metrics/:path*",
    "/api/sync/:path*",
  ],
};
