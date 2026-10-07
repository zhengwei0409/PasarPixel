import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

// Shared across marketplace result sections so only one preview plays at a time.
let activePreview: HTMLAudioElement | null = null;

async function decodeWaveform(src: string, signal: AbortSignal) {
    const response = await fetch(src, { signal });
    if (!response.ok) throw new Error("Could not load waveform");
    const bytes = await response.arrayBuffer();
    signal.throwIfAborted();
    const context = new AudioContext();
    try {
        const buffer = await context.decodeAudioData(bytes);
        signal.throwIfAborted();
        const bins = Math.min(360, buffer.length);
        const peaks = new Array<number>(bins).fill(0);
        for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
            const samples = buffer.getChannelData(channel);
            for (let bin = 0; bin < bins; bin++) {
                const start = Math.floor(bin * samples.length / bins);
                const end = Math.floor((bin + 1) * samples.length / bins);
                for (let sample = start; sample < end; sample++) {
                    peaks[bin] = Math.max(peaks[bin], Math.abs(samples[sample]));
                }
            }
        }
        const maximum = Math.max(...peaks, 0.01);
        return peaks.map((peak) => peak / maximum);
    } finally {
        await context.close();
    }
}

export function useAudioPreview(src: string | null) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [playing, setPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [playbackError, setPlaybackError] = useState<string | null>(null);
    const waveform = useQuery({
        queryKey: ["audio-waveform", src],
        queryFn: ({ signal }) => decodeWaveform(src!, signal),
        enabled: Boolean(src),
        staleTime: Infinity,
        retry: false,
    });

    useEffect(() => {
        const audio = audioRef.current;
        return () => {
            audio?.pause();
            if (activePreview === audio) activePreview = null;
        };
    }, [src]);

    useEffect(() => {
        if (!playing) return;
        let frame: number;
        const update = () => {
            setCurrentTime(audioRef.current?.currentTime ?? 0);
            frame = requestAnimationFrame(update);
        };
        frame = requestAnimationFrame(update);
        return () => cancelAnimationFrame(frame);
    }, [playing]);

    const claimPlayback = () => {
        const audio = audioRef.current;
        if (!audio) return;
        if (activePreview && activePreview !== audio) activePreview.pause();
        activePreview = audio;
        setPlaying(true);
        setPlaybackError(null);
    };

    const togglePlayback = async () => {
        const audio = audioRef.current;
        if (!audio || !src) return;
        if (!audio.paused) {
            audio.pause();
            return;
        }
        // Pause the previous track before waiting for this one's play promise.
        if (activePreview && activePreview !== audio) activePreview.pause();
        activePreview = audio;
        try {
            await audio.play();
        } catch {
            setPlaybackError("Preview unavailable. Please try again.");
            setPlaying(false);
        }
    };

    const seek = (time: number) => {
        const audio = audioRef.current;
        if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
        audio.currentTime = Math.max(0, Math.min(time, audio.duration));
        setCurrentTime(audio.currentTime);
    };

    return {
        audioRef, playing, currentTime, duration, playbackError, waveform,
        togglePlayback, seek, claimPlayback, setPlaying, setCurrentTime, setDuration,
        onPlaybackError: () => {
            setPlaying(false);
            setPlaybackError("Preview unavailable. Please try again.");
        },
    };
}
