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

    // Random offset for swimming phase so they don't all wiggle in sync
    let swimPhase = Math.random() * Math.PI * 2;

    const animate = () => {
      if (!fishRef.current) return;

      const pos = positionRef.current;
      const bounds = boundsRef.current;
      const now = Date.now();

      // 1. Random Direction Changes (wandering behavior)
      const timeSinceLastChange = now - lastDirectionChangeRef.current;
      const changeInterval = 3000 + Math.random() * 5000;

      if (timeSinceLastChange > changeInterval) {
        const speed = 0.6 + Math.random() * 0.6; // Variable speed
        const angle = Math.random() * Math.PI * 2;

        targetDirectionRef.current = {
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
        };
        lastDirectionChangeRef.current = now;
      }

      // 2. Wall Avoidance (Soft Steering)
      // Keep them largely on screen. 
      // Margin is how close to the edge they get before turning.
      // We want them to use the WHOLE canvas but turn AROUND at the edges.
      const margin = 100;
      const turnStrength = 0.08; // Stronger turning to avoid sticking

      if (pos.x < bounds.left + margin) targetDirectionRef.current.vx += turnStrength;
      if (pos.x > bounds.right - margin) targetDirectionRef.current.vx -= turnStrength;
      if (pos.y < bounds.top + margin) targetDirectionRef.current.vy += turnStrength;
      if (pos.y > bounds.bottom - margin) targetDirectionRef.current.vy -= turnStrength;

      // Normalize target vector 
      const targetSpeed = Math.hypot(targetDirectionRef.current.vx, targetDirectionRef.current.vy);
      const maxSpeed = 1.5; // Slightly faster
      const minSpeed = 0.5; // Don't stop completely

      if (targetSpeed > maxSpeed) {
        targetDirectionRef.current.vx = (targetDirectionRef.current.vx / targetSpeed) * maxSpeed;
        targetDirectionRef.current.vy = (targetDirectionRef.current.vy / targetSpeed) * maxSpeed;
      } else if (targetSpeed < minSpeed && targetSpeed > 0.01) {
        // boost minimal speed
        targetDirectionRef.current.vx = (targetDirectionRef.current.vx / targetSpeed) * minSpeed;
        targetDirectionRef.current.vy = (targetDirectionRef.current.vy / targetSpeed) * minSpeed;
      }

      // 3. Smooth Physics Update
      const inertia = 0.03;
      pos.vx += (targetDirectionRef.current.vx - pos.vx) * inertia;
      pos.vy += (targetDirectionRef.current.vy - pos.vy) * inertia;

      pos.x += pos.vx;
      pos.y += pos.vy;

      // 4. Calculate Visual Rotation (Tilt + Wiggle)
      // Base tilt from velocity
      const velocityAngle = Math.atan2(pos.vy, Math.abs(pos.vx)) * (180 / Math.PI); // -90 to 90

      // Swimming wiggle (sine wave)
      // Frequency increases with speed
      const currentSpeed = Math.hypot(pos.vx, pos.vy);
      swimPhase += 0.1 + (currentSpeed * 0.1);
      const wiggle = Math.sin(swimPhase) * 5; // +/- 5 degrees wiggle

      // Combine
      const targetRotation = velocityAngle + wiggle;

      // Smooth rotation update
      pos.rotation += (targetRotation - pos.rotation) * 0.1;

      // 5. Apply Transforms
      const facingLeft = pos.vx < 0;

      const transformString = `translate3d(${pos.x}px, ${pos.y}px, 0) scale(${scaleRef.current})`;
      fishRef.current.style.transform = transformString;

      const innerFish = fishRef.current.firstElementChild as HTMLElement;
      if (innerFish) {
        const flip = facingLeft ? 'scaleX(-1)' : 'scaleX(1)';
        // Clamp to avoid extreme spins, but allow the wiggle
        let rot = facingLeft ? -pos.rotation : pos.rotation;
        // Soft clamp
        rot = Math.max(-45, Math.min(45, rot));

        innerFish.style.transform = `${flip} rotate(${rot}deg)`;

        // Counter-flip text so it is readable
        const textElement = innerFish.querySelector('.fish-text-container') as HTMLElement;
        if (textElement) {
          textElement.style.transform = facingLeft ? 'scaleX(-1)' : 'scaleX(1)';
        }
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
        <div className={`fish-text-container bg-white/90 border-2 ${idea.isDone ? 'border-[#4CAF50] ring-2 ring-[#4CAF50]/50' : 'border-black'} rounded-sm px-2 py-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] pointer-events-none`}>
          <p className="text-[10px] md:text-xs font-['Shimshon','Miriam_Libre',sans-serif] font-bold text-black leading-none whitespace-nowrap max-w-[120px] md:max-w-[180px] truncate text-center">
            {idea.name}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
