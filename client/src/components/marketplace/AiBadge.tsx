interface AiBadgeProps {
    className?: string;
}

export function AiBadge({ className = "" }: AiBadgeProps) {
    return (
        <span
            className={`inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 ${className}`}
        >
            AI-generated
        </span>
    );
}
