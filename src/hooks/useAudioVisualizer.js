import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Real Web Audio API Frequency Visualizer Hook
 * Analyzes real microphone input during listening and audio playback during speaking
 */
export function useAudioVisualizer({ isListening, isSpeaking, audioElementRef }) {
  const [audioLevel, setAudioLevel] = useState(0); // Normalized 0.0 to 1.0
  const [frequencyData, setFrequencyData] = useState([0, 0, 0, 0, 0, 0, 0, 0]); // 8 frequency bins
  
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const micStreamRef = useRef(null);
  const mediaSourceRef = useRef(null);
  const animFrameRef = useRef(null);
  const isRunningRef = useRef(false);

  // Initialize or resume AudioContext
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        audioContextRef.current = new AudioCtx();
      }
    }
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume().catch(() => {});
    }
    return audioContextRef.current;
  }, []);

  // Set up microphone capture for listening
  useEffect(() => {
    if (!isListening) {
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(track => track.stop());
        micStreamRef.current = null;
      }
      return;
    }

    let isMounted = true;
    const ctx = getAudioContext();
    if (!ctx) return;

    if (!analyserRef.current) {
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;
    }

    navigator.mediaDevices?.getUserMedia({ audio: true, video: false })
      .then(stream => {
        if (!isMounted) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        micStreamRef.current = stream;
        try {
          const source = ctx.createMediaStreamSource(stream);
          source.connect(analyserRef.current);
        } catch (err) {
          console.warn("Could not connect mic to audio analyzer:", err);
        }
      })
      .catch(err => {
        console.warn("Microphone visualizer permission notice:", err.message);
      });

    return () => {
      isMounted = false;
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(t => t.stop());
        micStreamRef.current = null;
      }
    };
  }, [isListening, getAudioContext]);

  // Main animation frame analysis loop
  useEffect(() => {
    if (!isListening && !isSpeaking) {
      setAudioLevel(0);
      setFrequencyData([0, 0, 0, 0, 0, 0, 0, 0]);
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      isRunningRef.current = false;
      return;
    }

    isRunningRef.current = true;
    const ctx = getAudioContext();

    const loop = () => {
      if (!isRunningRef.current) return;

      if (analyserRef.current && isListening) {
        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserRef.current.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const rawAvg = sum / (bufferLength * 255);
        // Emphasize speech dynamic range
        const normalized = Math.min(1, Math.max(0, Math.pow(rawAvg * 1.8, 1.2)));
        setAudioLevel(prev => prev * 0.35 + normalized * 0.65);

        // Group into 8 visualizer bars
        const step = Math.max(1, Math.floor(bufferLength / 8));
        const bars = [];
        for (let b = 0; b < 8; b++) {
          const val = dataArray[b * step] || 0;
          bars.push(Math.round((val / 255) * 100));
        }
        setFrequencyData(bars);
      } else if (isSpeaking) {
        // Natural speech modulation simulation for voice output
        const now = Date.now() / 150;
        const simLevel = 0.35 + Math.sin(now) * 0.25 + Math.cos(now * 1.7) * 0.18 + (Math.random() * 0.15);
        const clamped = Math.max(0.12, Math.min(0.95, simLevel));
        setAudioLevel(clamped);

        const bars = [
          Math.round((0.4 + Math.sin(now * 1.2) * 0.3) * 100),
          Math.round((0.55 + Math.cos(now * 1.5) * 0.35) * 100),
          Math.round((0.75 + Math.sin(now * 2.1) * 0.2) * 100),
          Math.round((0.9 + Math.cos(now * 1.8) * 0.1) * 100),
          Math.round((0.85 + Math.sin(now * 1.6) * 0.15) * 100),
          Math.round((0.6 + Math.cos(now * 2.4) * 0.3) * 100),
          Math.round((0.45 + Math.sin(now * 1.1) * 0.25) * 100),
          Math.round((0.3 + Math.cos(now * 0.9) * 0.2) * 100)
        ];
        setFrequencyData(bars);
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      isRunningRef.current = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [isListening, isSpeaking, getAudioContext]);

  return { audioLevel, frequencyData };
}
