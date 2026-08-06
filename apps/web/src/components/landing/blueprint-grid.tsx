"use client";

import { motion, useMotionValue, useSpring } from "framer-motion";
import { useEffect } from "react";

export function BlueprintGrid() {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Smooth out the mouse movement
  const springX = useSpring(mouseX, { stiffness: 50, damping: 20 });
  const springY = useSpring(mouseY, { stiffness: 50, damping: 20 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [mouseX, mouseY]);

  return (
    <div className="fixed inset-0 z-[-1] overflow-hidden bg-background">
      {/* Mesh Gradient Layer - Dynamic Ambient Light */}
      <motion.div 
        className="absolute inset-0 z-0 opacity-40 mix-blend-screen"
        style={{
          background: `radial-gradient(circle at 50% 50%, var(--blueprint-ambient) 0%, transparent 100%)`,
          x: springX,
          y: springY,
          translateX: "-50%",
          translateY: "-50%",
          width: "1000px",
          height: "1000px",
        }}
      />

      {/* Blueprint Grid Lines */}
      <div 
        className="absolute inset-0 opacity-[0.4] dark:opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(var(--blueprint-line) 1px, transparent 1px), 
                            linear-gradient(90deg, var(--blueprint-line) 1px, transparent 1px)`,
          backgroundSize: '40px 40px'
        }}
      />

      {/* Fine Detail Dotted Grid */}
      <div 
        className="absolute inset-0 opacity-[0.6] dark:opacity-[0.05]"
        style={{
          backgroundImage: `radial-gradient(var(--blueprint-dots) 0.5px, transparent 0.5px)`,
          backgroundSize: '8px 8px'
        }}
      />

      {/* Base Tint Layer */}
      <div className="absolute inset-0 bg-background/20" />
    </div>
  );
}
