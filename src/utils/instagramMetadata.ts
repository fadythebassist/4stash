export function isGenericInstagramDescription(value?: string): boolean {
  if (!value) return true;
  const text = value.trim().toLowerCase();
  if (!text) return true;

  return (
    text.includes("url source:") && text.includes("markdown content:") ||
    text.includes("this content isn't available to everyone") ||
    text.includes("it can't be seen by certain audiences") ||
    text.includes("log in to continue") ||
    text.includes("/accounts/login/") ||
    text.includes("[log in]") && text.includes("[sign up]") ||
    text.includes("instagram lite") && text.includes("meta verified")
  );
}

export function cleanInstagramDescription(value?: string): string | undefined {
  if (isGenericInstagramDescription(value)) return undefined;
  const cleaned = value
    ?.replace(/^\d+\s+Likes,\s+\d+\s+Comments\s+-\s+/i, "")
    .trim();

  return cleaned || undefined;
}
