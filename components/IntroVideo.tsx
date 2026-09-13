"use client";

import { useRef, useState } from "react";

/** Weekly-stream intro: autoplays muted on loop, tap to turn the sound on. */
export function IntroVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);

  function toggleSound() {
    const v = ref.current;
    if (!v) return;
    const next = !v.muted;
    v.muted = next;
    if (!next) {
      v.currentTime = 0;
      void v.play();
    }
    setMuted(next);
  }

  return (
    <div className="kIntro">
      <video
        ref={ref}
        className="kIntroVideo"
        src="/video/kripto-intro.mp4"
        poster="/video/kripto-intro-poster.jpg"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-label="KRIPTO NR.1 iknedēļas tiešraides intro"
      />
      <button type="button" className="kIntroSound" onClick={toggleSound}>
        {muted ? "🔊 Ieslēgt skaņu" : "🔇 Izslēgt skaņu"}
      </button>
    </div>
  );
}
