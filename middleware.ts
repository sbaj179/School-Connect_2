import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicPaths = ["/login", "/claim"];
const protectedPrefixes = ["/inbox", "/groups", "/events", "/reports"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/") {
    return NextResponse.next();
  }

  if (publicPaths.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  if (protectedPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    const access = request.cookies.get("sb-access-token")?.value;
    const refresh = request.cookies.get("sb-refresh-token")?.value;

    if (!access && !refresh) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
