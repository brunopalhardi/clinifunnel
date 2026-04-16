import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: { signIn: "/login" },
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/clinics",
    "/api/clinics/:path*",
    "/api/leads/:path*",
    "/api/campaigns/:path*",
    "/api/procedures/:path*",
    "/api/metrics/:path*",
    "/api/dashboard/:path*",
    "/api/sync/:path*",
    "/api/ads/:path*",
    "/api/webhook-logs/:path*",
  ],
};
