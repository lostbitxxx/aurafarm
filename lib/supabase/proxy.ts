import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { applyCrossOriginIsolation } from "@/lib/cross-origin-isolation";
import { isSupabaseConfigured, getSupabasePublishableKey, getSupabaseUrl } from "./env";

function finish(response: NextResponse) {
  applyCrossOriginIsolation(response);
  return response;
}

function redirectWithSession(
  request: NextRequest,
  sessionResponse: NextResponse,
  pathname: string,
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  const redirectResponse = NextResponse.redirect(url);
  sessionResponse.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie);
  });
  for (const header of ["cache-control", "expires", "pragma"]) {
    const value = sessionResponse.headers.get(header);
    if (value) redirectResponse.headers.set(header, value);
  }
  return finish(redirectResponse);
}

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isSupabaseConfigured()) {
    if (pathname.startsWith("/dashboard")) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return finish(NextResponse.redirect(url));
    }
    return finish(NextResponse.next({ request }));
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(getSupabaseUrl(), getSupabasePublishableKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
        Object.entries(headers).forEach(([key, value]) => {
          supabaseResponse.headers.set(key, value);
        });
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;

  const isAuthPage = pathname === "/login" || pathname === "/register";
  if (!userId && pathname.startsWith("/dashboard")) {
    return redirectWithSession(request, supabaseResponse, "/login");
  }
  if (userId && isAuthPage) {
    return redirectWithSession(request, supabaseResponse, "/dashboard");
  }

  return finish(supabaseResponse);
}
