import type { CSSProperties } from "react";
import "./FloatingShapes.css";

const SHAPES = [
    { left: "4%", size: 140, duration: 38, delay: -12, drift: 45, rotation: -18, kind: "square" },
    { left: "17%", size: 90, duration: 32, delay: -26, drift: -30, rotation: 12, kind: "ring" },
    { left: "32%", size: 22, duration: 29, delay: -8, drift: 25, rotation: 0, kind: "dot" },
    { left: "49%", size: 110, duration: 44, delay: -32, drift: -45, rotation: 20, kind: "square" },
    { left: "64%", size: 60, duration: 35, delay: -18, drift: 35, rotation: 0, kind: "ring" },
    { left: "78%", size: 170, duration: 46, delay: -7, drift: -40, rotation: -12, kind: "square" },
    { left: "91%", size: 100, duration: 40, delay: -29, drift: -25, rotation: 0, kind: "ring" },
    { left: "86%", size: 18, duration: 31, delay: -17, drift: 15, rotation: 0, kind: "dot" },
];

export default function FloatingShapes() {
    return (
        <div className="home-floating-shapes motion-reduce:hidden" aria-hidden="true">
            {SHAPES.map((shape, index) => (
                <span
                    key={index}
                    className={`home-floating-shape home-floating-shape--${shape.kind}`}
                    style={{
                        left: shape.left,
                        "--shape-size": `${shape.size}px`,
                        "--shape-duration": `${shape.duration}s`,
                        "--shape-delay": `${shape.delay}s`,
                        "--shape-drift": `${shape.drift}px`,
                        "--shape-rotation": `${shape.rotation}deg`,
                    } as CSSProperties}
                />
            ))}
        </div>
    );
}
