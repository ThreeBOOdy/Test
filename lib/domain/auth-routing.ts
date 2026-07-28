import type { AccessCapability, AppRole } from "@/lib/domain/student-access";

export type AuthRole = AppRole;

export function getRoleForPath(path: string): AuthRole | null {
  if (path === "/student" || path.startsWith("/student/")) return "STUDENT";
  if (path === "/teacher" || path.startsWith("/teacher/")) return "TEACHER";
  if (path === "/admin" || path.startsWith("/admin/")) return "ADMIN";
  return null;
}

export function getLoginRedirectForRole(role: AuthRole) {
  const path = role === "ADMIN" ? "/admin" : role === "TEACHER" ? "/teacher" : "/student";
  return `/login?next=${encodeURIComponent(path)}&error=role-mismatch`;
}

export function getLoginRedirectForPath(path: string) {
  const role = getRoleForPath(path);
  return role ? getLoginRedirectForRole(role) : "/login";
}

export function canUseNextPath(path: string, role: AuthRole) {
  const targetRole = getRoleForPath(path);
  return targetRole === null || targetRole === role || (role === "ADMIN" && targetRole === "TEACHER");
}

export function canUseLoginNextPath(path: string, role: AuthRole) {
  const targetRole = getRoleForPath(path);
  return targetRole === null || targetRole === role;
}

export function getEntryHrefForRole(entry: AuthRole, currentRole: AuthRole | null) {
  const path = entry === "ADMIN" ? "/admin" : entry === "TEACHER" ? "/teacher" : "/student";
  if (currentRole && canUseNextPath(path, currentRole)) return path;
  return `/login?next=${encodeURIComponent(path)}${currentRole ? "&error=role-mismatch" : ""}`;
}

export function getDefaultPathForCapability(capability: AccessCapability) {
  if (capability === "FULL_ADMIN") return "/admin";
  if (capability === "FULL_TEACHER") return "/teacher";
  if (capability === "REGISTRATION_ONLY") return "/registration/status";
  return "/student";
}
