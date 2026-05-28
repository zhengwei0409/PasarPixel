import "@google/model-viewer";
import { useEffect, useRef, useState } from "react";

declare global {
    namespace JSX {
        interface IntrinsicElements {
            "model-viewer": React.DetailedHTMLProps<
                React.HTMLAttributes<HTMLElement> & {
                    src: string;
                    alt?: string;
                    "camera-controls"?: boolean;
                    "auto-rotate"?: boolean;
                    "shadow-intensity"?: string | number;
                    "environment-image"?: string;
                    exposure?: string | number;
                    poster?: string;
                },
                HTMLElement
            >;
        }
    }
}

interface Props {
    src: string;
    alt: string;
    poster?: string;
}

export default function ModelViewer({ src, alt, poster }: Props) {
    const ref = useRef<HTMLElement>(null);
    const [progress, setProgress] = useState(0);
    const [loaded, setLoaded] = useState(false);
    const [showHint, setShowHint] = useState(true);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        const onProgress = (e: Event) => {
            const detail = (e as CustomEvent<{ totalProgress: number }>).detail;
            if (detail) setProgress(detail.totalProgress);
        };
        const onLoad = () => setLoaded(true);

        el.addEventListener("progress", onProgress);
        el.addEventListener("load", onLoad);
        return () => {
            el.removeEventListener("progress", onProgress);
            el.removeEventListener("load", onLoad);
        };
    }, []);

    const dismissHint = () => setShowHint(false);

    return (
        <div className="relative h-full w-full">
            <model-viewer
                ref={ref}
                src={src}
                alt={alt}
                poster={poster}
                camera-controls
                auto-rotate
                shadow-intensity="1"
                exposure="1"
                style={{ width: "100%", height: "100%", backgroundColor: "#f3f4f6" }}
            />

            {!loaded && (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 px-4 pb-3">
                    <div className="h-1 w-full overflow-hidden rounded-full bg-black/10">
                        <div
                            className="h-full bg-blue-500 transition-[width] duration-150"
                            style={{ width: `${Math.round(progress * 100)}%` }}
                        />
                    </div>
                    <p className="mt-1 text-center text-xs text-muted-foreground">
                        Loading 3D model… {Math.round(progress * 100)}%
                    </p>
                </div>
            )}

            {loaded && showHint && (
                <button
                    type="button"
                    onClick={dismissHint}
                    onPointerDown={dismissHint}
                    className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-white shadow-sm transition-opacity hover:opacity-80"
                >
                    Drag to rotate · scroll to zoom
                </button>
            )}
        </div>
    );
}
