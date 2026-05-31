import { useState } from "react";
import { Star } from "lucide-react";

interface StarRatingProps {
    /** Current rating value. For read-only, can be fractional (e.g. 4.3). */
    value: number;
    /** Pixel size of each star. */
    size?: number;
    /** When provided, the stars become interactive (click to pick 1–5). */
    onChange?: (rating: number) => void;
    className?: string;
}

const STARS = [1, 2, 3, 4, 5];

export default function StarRating({ value, size = 16, onChange, className = "" }: StarRatingProps) {
    const [hover, setHover] = useState<number | null>(null);
    const interactive = typeof onChange === "function";

    // While hovering an interactive widget, preview the hovered value instead.
    const shown = interactive && hover !== null ? hover : value;

    return (
        <div className={`inline-flex items-center gap-0.5 ${className}`}>
            {STARS.map((star) => {
                // Fraction of this star that should be filled (0–1).
                const fill = Math.max(0, Math.min(1, shown - (star - 1)));
                return (
                    <button
                        key={star}
                        type="button"
                        disabled={!interactive}
                        onClick={() => onChange?.(star)}
                        onMouseEnter={() => interactive && setHover(star)}
                        onMouseLeave={() => interactive && setHover(null)}
                        className={interactive ? "cursor-pointer" : "cursor-default"}
                        aria-label={interactive ? `Rate ${star} star${star > 1 ? "s" : ""}` : undefined}
                    >
                        <span className="relative inline-block" style={{ width: size, height: size }}>
                            <Star
                                size={size}
                                className="absolute inset-0 text-muted-foreground/40"
                            />
                            <span
                                className="absolute inset-0 overflow-hidden"
                                style={{ width: `${fill * 100}%` }}
                            >
                                <Star
                                    size={size}
                                    className="text-yellow-400 fill-yellow-400"
                                />
                            </span>
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
