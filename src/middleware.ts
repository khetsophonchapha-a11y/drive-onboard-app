import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const AUTH_SECRET = process.env.NEXTAUTH_SECRET || "dev-nextauth-secret";

export async function middleware(request: NextRequest) {
    const token = await getToken({ req: request, secret: AUTH_SECRET });
    const { pathname } = request.nextUrl;

    if (pathname === "/login") {
        if (!token) return NextResponse.next();

        const homePath = token.role === "employee" ? "/employee/daily-report" : "/dashboard";
        return NextResponse.redirect(new URL(homePath, request.url));
    }

    if (!token) {
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("callbackUrl", pathname);
        return NextResponse.redirect(loginUrl);
    }

    if (pathname.startsWith("/dashboard") && token.role !== "admin") {
        return NextResponse.redirect(new URL("/employee/daily-report", request.url));
    }

    if (pathname.startsWith("/employee") && token.role !== "employee") {
        return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/dashboard/:path*", "/employee/:path*", "/login"],
};
