import { auth } from "@/lib/auth-server";

export async function getSession(request) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return null;
    return session;
  } catch {
    return null;
  }
}

export async function requireUser(request) {
  const session = await getSession(request);
  if (!session?.user?.id) {
    return { ok: false, error: "Unauthorized" };
  }
  return { ok: true, session };
}

export async function requireAdmin(request) {
  const session = await getSession(request);
  const role = (session?.user?.role || "").toString();
  const isAdmin = role.toLowerCase() === "admin";
  if (!session?.user?.id || !isAdmin) {
    return { ok: false, error: "Forbidden" };
  }
  return { ok: true, session };
}


