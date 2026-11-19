"use client";

import React, { createContext, useContext, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

export interface ShakeState {
  active: boolean;
  start: number;
  duration: number;
  /** 0..1 — skala visual, dipetakan dari PGA */
  intensity: number;
  /** frekuensi dominan guncangan (Hz) */
  freq: number;
}

type ShakeRef = React.MutableRefObject<ShakeState>;

const ShakeContext = createContext<ShakeRef | null>(null);

export function ShakeProvider({ value, children }: { value: ShakeRef; children: React.ReactNode }) {
  return <ShakeContext.Provider value={value}>{children}</ShakeContext.Provider>;
}

export function useShake(): ShakeRef {
  const ctx = useContext(ShakeContext);
  const fallback = useRef<ShakeState>({ active: false, start: 0, duration: 0, intensity: 0, freq: 2 });
  return ctx ?? fallback;
}

/** Menggeser seluruh tapak (tanah) mengikuti gerak tanah horizontal */
export function GroundMotion({ children, onEnd }: { children: React.ReactNode; onEnd: () => void }) {
  const ref = useRef<THREE.Group>(null);
  const shake = useShake();
  const startedRef = useRef<number | null>(null);
  useFrame(({ clock }) => {
    const g = ref.current;
    const st = shake.current;
    if (!g) return;
    if (st.active && st.start < 0) {
      st.start = clock.getElapsedTime();
      startedRef.current = st.start;
    }
    if (!st.active) {
      g.position.x *= 0.85;
      g.position.z *= 0.85;
      return;
    }
    const t = clock.getElapsedTime() - st.start;
    if (t > st.duration) {
      st.active = false;
      onEnd();
      return;
    }
    const env = Math.min(1, t / 1.5) * Math.max(0, Math.min(1, (st.duration - t) / 2));
    const A = 0.18 * st.intensity;
    g.position.x = A * env * Math.sin(2 * Math.PI * st.freq * t);
    g.position.z = 0.4 * A * env * Math.sin(2 * Math.PI * st.freq * 0.83 * t + 1.1);
  });
  return <group ref={ref}>{children}</group>;
}
