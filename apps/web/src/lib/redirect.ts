/** Only same-origin paths, so a crafted sign-in link cannot send the user elsewhere. */
export function safeRedirect(target: string | undefined): string {
  if (!target || !target.startsWith("/") || target.startsWith("//") || target.startsWith("/\\")) {
    return "/";
  }
  return target;
}
