import { normalizeSocialLink } from "../../../../shared/utils/socialLinks";

type SocialPlatform = { name: string; icon: string; domains: string[] };

const socialPlatforms: SocialPlatform[] = [
    { name: "Instagram", icon: "instagram", domains: ["instagram.com"] },
    { name: "X", icon: "x", domains: ["x.com", "twitter.com"] },
    { name: "Facebook", icon: "facebook", domains: ["facebook.com", "fb.watch"] },
    { name: "TikTok", icon: "tiktok", domains: ["tiktok.com"] },
    { name: "YouTube", icon: "youtube", domains: ["youtube.com", "youtu.be"] },
    { name: "LinkedIn", icon: "linkedin", domains: ["linkedin.com"] },
    { name: "Threads", icon: "threads", domains: ["threads.com", "threads.net"] },
    { name: "Bluesky", icon: "bluesky", domains: ["bsky.app"] },
    { name: "Reddit", icon: "reddit", domains: ["reddit.com", "redd.it"] },
    { name: "Pinterest", icon: "pinterest", domains: ["pinterest.com", "pin.it"] },
    { name: "Snapchat", icon: "snapchat", domains: ["snapchat.com"] },
    { name: "Discord", icon: "discord", domains: ["discord.com", "discord.gg"] },
    { name: "Telegram", icon: "telegram", domains: ["telegram.me", "t.me"] },
    { name: "WhatsApp", icon: "whatsapp", domains: ["whatsapp.com", "wa.me"] },
    { name: "Twitch", icon: "twitch", domains: ["twitch.tv"] },
    { name: "GitHub", icon: "github", domains: ["github.com"] },
    { name: "Behance", icon: "behance", domains: ["behance.net"] },
    { name: "Dribbble", icon: "dribbble", domains: ["dribbble.com"] },
];

export function getSocialPlatform(value: string) {
    const url = normalizeSocialLink(value);
    if (!url) return undefined;

    const hostname = new URL(url).hostname.replace(/\.$/, "");
    return socialPlatforms.find(({ domains }) => (
        domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))
    ));
}
