import { NextResponse } from "next/server";
import { withAuth } from "next-auth/middleware";

const CHANGE_PW_PATH = "/dashboard/change-password";
const CHANGE_PW_API = "/api/auth/change-password";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    if (!token) return NextResponse.next();

    const path = req.nextUrl.pathname;

    // Se o user precisa trocar a senha, isolamos ele em /dashboard/change-password
    // ate que a flag seja limpada (pelo POST /api/auth/change-password).
    if (token.mustChangePassword) {
      const isOnChangePage = path === CHANGE_PW_PATH;
      const isCallingChangeApi = path === CHANGE_PW_API;
      // Permite logout pra escapar.
      const isLogout = path === "/api/auth/signout" || path === "/api/logout";
      if (!isOnChangePage && !isCallingChangeApi && !isLogout) {
        return NextResponse.redirect(new URL(CHANGE_PW_PATH, req.url));
      }
    }
    return NextResponse.next();
  },
  {
    pages: { signIn: "/login" },
  },
);

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
    "/api/patients/:path*",
    "/api/reminders/:path*",
    "/api/financeiro/:path*",
    "/api/admin/:path*",
    "/api/users/:path*",
    "/api/auth/change-password",
  ],
};
