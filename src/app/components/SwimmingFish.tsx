import { motion } from "motion/react";
import { useState, useEffect, useRef } from "react";
import type { Idea } from "@/app/App";
import { FISH_ASSETS } from "@/app/utils/fishAssets";

interface SwimmingFishProps {
  idea: Idea;
  onFishClick: (idea: Idea) => void;
}

export function SwimmingFish({ idea, onFishClick }: SwimmingFishProps) {
  const [isSpawning, setIsSpawning] = useState(true);
  const fishRef = useRef<HTMLDivElement>(null);

  // Physics state stored in refs to avoid re-renders during animation
  const positionRef = useRef({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    rotation: 0,
  });

  const boundsRef = useRef({
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  });

  const lastDirectionChangeRef = useRef(Date.now());
  const targetDirectionRef = useRef({ vx: 0, vy: 0 });
  const scaleRef = useRef(1);

  // Determine fish asset
  const fishIndex = idea.fishType !== undefined
    ? idea.fishType % FISH_ASSETS.length
    : parseInt(idea.id || "0", 10) % FISH_ASSETS.length;

  const fishAsset = FISH_ASSETS[fishIndex];

  // Initialize position and bounds
  useEffect(() => {
    const updateBounds = () => {
      const margin = 50; // Keep fish away from absolute edges
      const winWidth = window.innerWidth;
      const winHeight = window.innerHeight;

      boundsRef.current = {
        left: -margin, // Allow slightly off-screen for natural turns
        right: winWidth + margin,
        top: margin, // Keep below surface
        bottom: winHeight - margin, // Keep above bottom
      };
    };

    updateBounds();
    window.addEventListener('resize', updateBounds);

    // Initial Spawn Position
    const winWidth = window.innerWidth;
    const winHeight = window.innerHeight;

    // Random velocity
    const speed = 0.5 + Math.random() * 0.5;
    const angle = Math.random() * Math.PI * 2;

    positionRef.current = {
      x: Math.random() * winWidth,
      y: Math.random() * winHeight,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      rotation: 0,
    };

    targetDirectionRef.current = {
      vx: positionRef.current.vx,
      vy: positionRef.current.vy
    };

    const timer = setTimeout(() => setIsSpawning(false), 100);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateBounds);
    };
  }, []);

  // Main Animation Loop
  useEffect(() => {
    let animationFrameId: number;

    const animate = () => {
      if (!fishRef.current) return;

      const pos = positionRef.current;
      const bounds = boundsRef.current;
      const now = Date.now();

      // 1. Random Direction Changes (wandering behavior)
      const timeSinceLastChange = now - lastDirectionChangeRef.current;
      // Change direction every 3-8 seconds for more stability
      const changeInterval = 3000 + Math.random() * 5000;

      if (timeSinceLastChange > changeInterval) {
        // Pick a new random target velocity
        const speed = 0.6 + Math.random() * 0.6; // Variable speed
        const angle = Math.random() * Math.PI * 2;

        targetDirectionRef.current = {
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
        };
        lastDirectionChangeRef.current = now;
      }

      // 2. Wall Avoidance (Soft Steering)
      // "Look ahead" vector logic could be complex, simple bounding box steering is safer
      const margin = 150; // Start turning before hitting wall
      const turnStrength = 0.05;

      if (pos.x < bounds.left + margin) targetDirectionRef.current.vx += turnStrength;
      if (pos.x > bounds.right - margin) targetDirectionRef.current.vx -= turnStrength;
      if (pos.y < bounds.top + margin) targetDirectionRef.current.vy += turnStrength;
      if (pos.y > bounds.bottom - margin) targetDirectionRef.current.vy -= turnStrength;

      // Normalize target vector to maintain consistent max speed
      const targetSpeed = Math.hypot(targetDirectionRef.current.vx, targetDirectionRef.current.vy);
      const maxSpeed = 1.2; // Cap max speed
      if (targetSpeed > maxSpeed) {
        targetDirectionRef.current.vx = (targetDirectionRef.current.vx / targetSpeed) * maxSpeed;
        targetDirectionRef.current.vy = (targetDirectionRef.current.vy / targetSpeed) * maxSpeed;
      }

      // 3. Smooth Physics Update (Interpolation)
      // Lower factor = more inertia/weight (fish feel heavier)
      const inertia = 0.02;
      pos.vx += (targetDirectionRef.current.vx - pos.vx) * inertia;
      pos.vy += (targetDirectionRef.current.vy - pos.vy) * inertia;

      // Update position
      pos.x += pos.vx;
      pos.y += pos.vy;

      // 4. Calculate Visual Rotation (Tilt)
      // Fish tilt up/down based on vertical velocity
      const targetRotation = Math.atan2(pos.vy, Math.abs(pos.vx)) * (180 / Math.PI);
      // Smooth out rotation
      pos.rotation += (targetRotation - pos.rotation) * 0.1;

      // 5. Apply Transforms directly to DOM
      const facingLeft = pos.vx < 0;

      // We translate the container
      const transformString = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
      fishRef.current.style.transform = transformString;

      // We rotate the inner fish element (or apply it here if we want)
      // It's cleaner to apply flip and rotation to the inner image wrapper usually, 
      // but let's do it on the child div to separate movement from orientation.
      const innerFish = fishRef.current.firstElementChild as HTMLElement;
      if (innerFish) {
        // Flip if going left
        const flip = facingLeft ? 'scaleX(-1)' : 'scaleX(1)';
        // Clamp rotation to avoid looping weirdness (rare but possible)
        const clampedRot = Math.max(-25, Math.min(25, pos.rotation)); // Gentle tilt only
        innerFish.style.transform = `${flip} rotate(${facingLeft ? -clampedRot : clampedRot}deg)`;
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  return (
    <motion.div
      ref={fishRef}
      className="fixed z-20 cursor-pointer touch-none select-none will-change-transform"
      style={{
        left: 0,
        top: 0,
        // Centering logic handled by calculating from center of fish in visual space if needed,
        // but absolute positioning + translate is typical. 
        // We'll rely on translate3d for position.
      }}
      initial={{ opacity: 0, scale: 0 }}
      animate={{
        opacity: isSpawning ? 0 : 1,
        scale: isSpawning ? 0 : 1
      }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      onClick={(e) => {
        e.stopPropagation();
        onFishClick(idea);
      }}
    >
      {/* Inner wrapper for orientation (flip/rotate) */}
      <div className="transition-transform duration-75 flex flex-col items-center gap-2 -translate-x-1/2 -translate-y-1/2">
        <img
          src={fishAsset}
          alt={idea.name}
          className={`w-[60px] h-[60px] md:w-[90px] md:h-[90px] lg:w-[100px] lg:h-[100px] object-contain pointer-events-none ${!idea.isDone ? 'drop-shadow-[0_4px_8px_rgba(0,0,0,0.3)]' : ''
            }`}
          style={{
            imageRendering: "pixelated",
            filter: idea.isDone
              ? 'drop-shadow(0 0 8px #4CAF50) drop-shadow(0 0 15px #4CAF50) drop-shadow(0 0 5px #FFFFFF)'
              : undefined
          }}
        />
        <div className={`bg-white/90 border-2 ${idea.isDone ? 'border-[#4CAF50] ring-2 ring-[#4CAF50]/50' : 'border-black'} rounded-sm px-2 py-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] pointer-events-none`}>
          <p className="text-[10px] md:text-xs font-['Shimshon','Miriam_Libre',sans-serif] font-bold text-black leading-none whitespace-nowrap max-w-[120px] md:max-w-[180px] truncate text-center">
            {idea.name}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
