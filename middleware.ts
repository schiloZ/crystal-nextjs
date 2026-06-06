import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
export default auth((req) => {
  const logged = !!req.auth;
  const path = req.nextUrl.pathname;
  const role = (req.auth?.user as any)?.role;
  if (!logged && path !== "/login") return NextResponse.redirect(new URL("/login", req.nextUrl));
  if (logged && path === "/login") return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  if (path.startsWith("/administration") && role !== "super_admin") return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  if (path.startsWith("/organisation") && !["super_admin", "admin_compagnie"].includes(role)) return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  if (path.startsWith("/exercices") && !["super_admin", "admin_compagnie"].includes(role)) return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  if (path.startsWith("/gestionnaires") && !["super_admin", "admin_compagnie"].includes(role)) return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  return NextResponse.next();
});
export const config = { matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"] };
