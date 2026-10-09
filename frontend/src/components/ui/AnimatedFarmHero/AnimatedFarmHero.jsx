import React from "react";
import styles from "./AnimatedFarmHero.module.css";

export function AnimatedFarmHero({
  onGetStarted,
}) {
  return (
    <main className={styles.hero}>
      {/* Background video */}
      <video
        className={styles.backgroundVideo}
        src="/farm-video.mp4"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        aria-hidden="true"
      />

      {/* Soft overlay so text remains readable */}
      <div className={styles.videoOverlay} />

      {/* KrishiLoop logo - top left */}
      <header className={styles.navbar}>
        <button
          type="button"
          className={styles.logo}
          onClick={onGetStarted}
        >
          <span className={styles.logoIcon}>
            <span />
            <span />
            <span />
          </span>

          <span>KrishiLoop</span>
        </button>
      </header>

      {/* Hero content */}
      <section className={styles.heroContent}>
        <div className={styles.heroCard}>
          <div className={styles.badge}>
            AI-POWERED PRECISION AGRICULTURE
          </div>

          <h1>
            Smarter decisions.
            <br />
            Better harvest.
          </h1>

          <p>
            Predict crop yields. Optimize irrigation & fertilizer. Monitor
            real-time soil telemetry with AI-powered agricultural intelligence.
          </p>

          {/* Only landing-page button */}
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={onGetStarted}
            >
              Get Started
              <span>→</span>
            </button>
          </div>
        </div>
      </section>

      {/* Bottom highlights */}
      <div className={styles.bottomInfo}>
        <span>
          <i /> AI Yield & Harvest
        </span>

        <span>
          <i /> Precision Irrigation
        </span>

        <span>
          <i /> Smart Soil Telemetry
        </span>
      </div>
    </main>
  );
}

export default AnimatedFarmHero;