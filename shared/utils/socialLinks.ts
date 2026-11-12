export function normalizeSocialLink(value: unknown): string | null {
    if (typeof value !== "string") return null;

    const link = value.trim();
    if (!link || /[\s\\]/.test(link)) return null;

    try {
        const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(link) ? link : `https://${link}`);
        if (
            (url.protocol !== "http:" && url.protocol !== "https:") ||
            !url.hostname.includes(".") ||
            url.username ||
            url.password
        ) {
            return null;
        }
        return url.href;
    } catch {
        return null;
    }
}

export function getSocialLinkUrls(value: unknown): string[] {
    // Older profiles stored URLs in an object keyed by platform.
    const links = Array.isArray(value) ? value : value && typeof value === "object" ? Object.values(value) : [];
    const urls = links.map(normalizeSocialLink).filter((url): url is string => url !== null);
    return [...new Set(urls)];
}
