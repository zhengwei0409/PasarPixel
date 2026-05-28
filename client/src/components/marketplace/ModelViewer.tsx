import "@google/model-viewer";

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
    return (
        <model-viewer
            src={src}
            alt={alt}
            poster={poster}
            camera-controls
            auto-rotate
            shadow-intensity="1"
            exposure="1"
            style={{ width: "100%", height: "100%", backgroundColor: "#f3f4f6" }}
        />
    );
}
