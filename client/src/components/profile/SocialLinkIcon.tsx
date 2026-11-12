import { Link2 } from "lucide-react";
import brandIcons from "../../assets/social-brand-icons.svg?no-inline";

export function SocialLinkIcon({ icon, className }: { icon?: string; className?: string }) {
    if (!icon) return <Link2 className={className} aria-hidden="true" />;

    return (
        <svg
            aria-hidden="true"
            className={className}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <use href={`${brandIcons}#${icon}`} />
        </svg>
    );
}
