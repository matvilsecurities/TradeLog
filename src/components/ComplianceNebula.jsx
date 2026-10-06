import React, { useEffect, useMemo, useRef, useState } from "react";
import "../styles/complianceNebula.css";

const COLORS = {
  bg: "#05070c",
  text: "#eef5ff",
  muted: "#68778d",
  violet: "#9578ff",
  cyan: "#4ce8d1",
  blue: "#55a9ff",
  orange: "#ffb45e",
};

export default function ComplianceNebula({ compliance = [] }) {
  const starCanvasRef = useRef(null);
  const fxCanvasRef = useRef(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  // Overall score from your existing EdgeAnalysis data.
  const overall = useMemo(() => {
    if (!compliance.length) return 0;

    return Math.round(
      compliance.reduce((sum, item) => sum + (Number(item.pct) || 0), 0) /
        compliance.length
    );
  }, [compliance]);

  // Keep the constellation positions stable.
  const nodes = useMemo(() => {
    const angles = [-112, -72, -35, 5, 42, 78, 118, 157, 196, 232];
    const radii = [39, 30, 40, 32, 42, 31, 40, 33, 41, 29];

    return compliance.map((item, i) => {
      const angle = angles[i % angles.length] * (Math.PI / 180);
      const radius = radii[i % radii.length];

      const x = 50 + Math.cos(angle) * radius;
      const y = 51 + Math.sin(angle) * radius * 0.72;
      const score = Number(item.pct) || 0;

      return {
        ...item,
        x,
        y,
        score,
        strength:
          score >= 75 ? "strong" : score >= 55 ? "medium" : "low",
      };
    });
  }, [compliance]);

  // Animated starfield + subtle orbital FX.
  useEffect(() => {
    const starCanvas = starCanvasRef.current;
    const fxCanvas = fxCanvasRef.current;

    if (!starCanvas || !fxCanvas) return;

    const sctx = starCanvas.getContext("2d");
    const fctx = fxCanvas.getContext("2d");

    let width = 0;
    let height = 0;
    let dpr = 1;
    let stars = [];
    let animationFrame = 0;

    const resize = () => {
      const rect = starCanvas.getBoundingClientRect();

      width = rect.width;
      height = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);

      [starCanvas, fxCanvas].forEach((canvas) => {
        canvas.width = Math.max(1, Math.floor(width * dpr));
        canvas.height = Math.max(1, Math.floor(height * dpr));
      });

      sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      fctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      stars = Array.from({ length: 170 }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: Math.random() * 1.35 + 0.2,
        a: Math.random() * 0.62 + 0.13,
        v: Math.random() * 0.33 + 0.06,
        p: Math.random() * Math.PI * 2,
      }));
    };

        const animate = (time) => {
      if (document.hidden) {
        animationFrame = requestAnimationFrame(animate);
        return;
      }
      sctx.clearRect(0, 0, width, height);

      // Stars.

      // Stars.
      for (const star of stars) {
        star.y -= star.v * 0.35;

        if (star.y < 0) {
          star.y = height;
          star.x = Math.random() * width;
        }

        const twinkle =
          star.a * (0.55 + 0.45 * Math.sin(time * 0.0018 + star.p));

        sctx.beginPath();
        sctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        sctx.fillStyle = `rgba(190,215,255,${twinkle})`;
        sctx.fill();
      }

      // Subtle rotating orbital arcs.
      fctx.clearRect(0, 0, width, height);

      const centerX = width * 0.5;
      const centerY = height * 0.51;

      for (let i = 0; i < 8; i++) {
        const radius = 115 + i * 40;
        const rotation =
          time * 0.00015 * (i % 2 === 0 ? 1 : -1) + i * 0.74;

        fctx.save();
        fctx.translate(centerX, centerY);
        fctx.rotate(rotation);

        fctx.beginPath();
        fctx.arc(0, 0, radius, -0.66, 0.66);

        fctx.strokeStyle = `rgba(76,232,209,${0.025 + i * 0.006})`;
        fctx.lineWidth = 1;
        fctx.stroke();

        fctx.restore();
      }

      animationFrame = requestAnimationFrame(animate);
    };

    resize();
    window.addEventListener("resize", resize);
    animationFrame = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationFrame);
    };
  }, []);

  const svgWidth = 1000;
  const svgHeight = 650;

  const sx = (value) => value * 10;
  const sy = (value) => value * (svgHeight / 100);

    return (
    <div className={`compliance-nebula${expanded ? " nebula-expanded" : ""}`}>
      <div className="nebula-backdrop" onClick={() => setExpanded(false)} />
      <button
        className="nebula-close"
        onClick={() => setExpanded(false)}
        aria-label="Close"
        type="button"
      >
        ✕
      </button>

      <div className="nebula-header">
        <div>
          <h3 className="nebula-title">Compliance Nebula</h3>
          <div className="nebula-subtitle">
            A living constellation of your trading-rule adherence
          </div>
        </div>

        <div className="nebula-status">
          <span className="nebula-status-dot" />
          LIVE CONSTELLATION
        </div>
      </div>

      <div className="nebula-scene">
        <canvas
          ref={starCanvasRef}
          className="nebula-canvas"
        />

        <canvas
          ref={fxCanvasRef}
          className="nebula-fx"
        />

        <div className="nebula-cloud" />

        <div className="nebula-ring nebula-r1" />
        <div className="nebula-ring nebula-r2" />
        <div className="nebula-ring nebula-r3" />
        <div className="nebula-ring nebula-r4" />

                <div className="nebula-core" onClick={() => setExpanded(true)}>
          <div>
            <div className="nebula-score">
              {overall}
              <span>%</span>
            </div>

            <div className="nebula-core-label">
              Overall Compliance
            </div>

            <div className="nebula-core-bar" />
          </div>
        </div>

        <svg
          className="nebula-connections"
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          preserveAspectRatio="none"
        >
          {/* Center → every rule */}
          {nodes.map((node, index) => (
            <line
              key={`center-${node.key || index}`}
              x1={sx(50)}
              y1={sy(51)}
              x2={sx(node.x)}
              y2={sy(node.y)}
              className={`nebula-line ${
                node.score >= 75
                  ? "nebula-line-strong"
                  : "nebula-line-center"
              }`}
            />
          ))}

          {/* Rule → neighboring rule */}
          {nodes.map((node, index) => {
            const next = nodes[(index + 1) % nodes.length];

            if (!next) return null;

            return (
              <line
                key={`outer-${index}`}
                x1={sx(node.x)}
                y1={sy(node.y)}
                x2={sx(next.x)}
                y2={sy(next.y)}
                className="nebula-line nebula-line-soft"
              />
            );
          })}

          {/* Extra constellation cross-links */}
          {[
            [0, 4],
            [0, 7],
            [1, 5],
            [2, 6],
            [2, 8],
            [3, 7],
            [4, 9],
            [6, 9],
          ].map(([a, b]) => {
            const first = nodes[a];
            const second = nodes[b];

            if (!first || !second) return null;

            return (
              <line
                key={`cross-${a}-${b}`}
                x1={sx(first.x)}
                y1={sy(first.y)}
                x2={sx(second.x)}
                y2={sy(second.y)}
                className="nebula-line nebula-line-soft"
              />
            );
          })}

          {/* Moving particles */}
          {nodes.map((node, index) => {
            if (index % 2 !== 0) return null;

            return (
              <circle
                key={`flow-${node.key || index}`}
                r="2.1"
                className="nebula-flow-dot"
              >
                <animateMotion
                  dur={`${(2.8 + (index % 4) * 0.45).toFixed(2)}s`}
                  repeatCount="indefinite"
                  begin={`${(index * 0.35).toFixed(2)}s`}
                  path={`M ${sx(50)} ${sy(51)} L ${sx(node.x)} ${sy(node.y)}`}
                />
              </circle>
            );
          })}
        </svg>

        {/* Nodes */}
        <div className="nebula-node-layer">
          {nodes.map((node, index) => {
            const label = node.label || node.key || `Rule ${index + 1}`;

            return (
              <div
                key={node.key || label || index}
                className={`nebula-node ${node.strength} ${
                  node.x < 50 ? "left" : ""
                }`}
                style={{
                  "--x": `${node.x}%`,
                  "--y": `${node.y}%`,
                  "--size": `${
                    node.score >= 85
                      ? 22
                      : node.score >= 70
                        ? 18
                        : node.score >= 55
                          ? 15
                          : 13
                  }px`,
                  "--delay": `${index * 110}ms`,
                  "--pulse": `${(index * 0.18).toFixed(2)}s`,
                }}
              >
                <div className="nebula-orb" />
                <div className="nebula-halo" />

                <div className="nebula-node-label">
                  <b>{label}</b>
                  <span>{node.score}% compliance</span>

                  <div className="nebula-badge">
                    {node.score >= 75
                      ? "STRONG"
                      : node.score >= 55
                        ? "MODERATE"
                        : "ATTENTION"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Moving orbital light points */}
        <div
          className="nebula-traveler"
          style={{
            position: "absolute",
            left: "50%",
            top: "51%",
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: "#fff",
            boxShadow: `0 0 10px #fff, 0 0 23px ${COLORS.cyan}`,
            zIndex: 8,
            animation: "nebulaOrbit1 7s linear infinite",
          }}
        />

        <div
          className="nebula-traveler"
          style={{
            position: "absolute",
            left: "50%",
            top: "51%",
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "#fff",
            boxShadow: `0 0 8px #fff, 0 0 20px ${COLORS.violet}`,
            zIndex: 8,
            animation: "nebulaOrbit2 9s linear infinite",
          }}
        />

      </div>

      <div className="nebula-footer">
        <div className="nebula-legend">
          <span className="nebula-legend-item">
            <i className="nebula-legend-dot nebula-legend-strong" />
            Strong
          </span>

          <span className="nebula-legend-item">
            <i className="nebula-legend-dot nebula-legend-medium" />
            Moderate
          </span>

          <span className="nebula-legend-item">
            <i className="nebula-legend-dot nebula-legend-low" />
            Attention
          </span>
        </div>

        <span>{nodes.length} rules tracked</span>
      </div>
    </div>
  );
}