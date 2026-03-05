import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, useMotionValue, useSpring, useScroll, useTransform } from 'motion/react';
import { ArrowUpRight, Linkedin, BookOpen, Briefcase, HardHat, Hammer, Terminal } from 'lucide-react';

const CustomCursor = () => {
  const [isHovering, setIsHovering] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  useEffect(() => {
    // Detect touch/mobile devices and hide cursor
    setIsMobile(
      window.matchMedia('(pointer: coarse)').matches ||
      'ontouchstart' in window
    );
  }, []);

  useEffect(() => {
    if (isMobile) return;

    const updateMousePosition = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    };

    const handleMouseOver = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('a') || (e.target as HTMLElement).closest('button')) {
        setIsHovering(true);
      } else {
        setIsHovering(false);
      }
    };

    window.addEventListener('mousemove', updateMousePosition);
    window.addEventListener('mouseover', handleMouseOver);

    return () => {
      window.removeEventListener('mousemove', updateMousePosition);
      window.removeEventListener('mouseover', handleMouseOver);
    };
  }, [isMobile]);

  const cursorX = useSpring(mouseX, { stiffness: 500, damping: 28 });
  const cursorY = useSpring(mouseY, { stiffness: 500, damping: 28 });

  // Don't render anything on mobile
  if (isMobile) return null;

  return (
    <>
      <motion.div
        className="fixed top-0 left-0 pointer-events-none z-[100] mix-blend-difference"
        style={{
          x: cursorX,
          y: cursorY,
          scale: isHovering ? 1.4 : 1,
        }}
      >
        <svg
          width="36"
          height="42"
          viewBox="0 0 24 28"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M2 1.5 L2 22 L7.5 16.5 L12.5 25 L16 23 L11 14.5 L18.5 14.5 Z"
            fill="white"
            stroke="white"
            strokeWidth="1.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      </motion.div>
    </>
  );
};

/* ─── Gyroscope-driven hero text (mobile only) ─── */
type GyroState = 'idle' | 'scattered';

interface WordDef {
  text: string;
  special?: boolean; // The outline-stroked "domain" word
}

const HERO_LINES: { words: WordDef[]; br: boolean }[] = [
  { words: [{ text: 'I' }, { text: 'bought' }, { text: 'this' }], br: true },
  { words: [{ text: 'domain', special: true }, { text: 'because' }], br: true },
  { words: [{ text: "it's" }, { text: 'my' }, { text: 'surname.' }], br: false },
];

const ALL_WORDS = HERO_LINES.flatMap((l) => l.words);

const randomScatter = () =>
  ALL_WORDS.map(() => ({
    x: (Math.random() - 0.5) * 160,
    y: (Math.random() - 0.5) * 80,
    rotate: (Math.random() - 0.5) * 45,
  }));

const GyroText = () => {
  const [gyroState, setGyroState] = useState<GyroState>('idle');
  const [hasGyro, setHasGyro] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [orientation, setOrientation] = useState({ beta: 0, gamma: 0 });
  const [scattered, setScattered] = useState(() => randomScatter());

  const lastRef = useRef({ beta: 0, gamma: 0 });
  const bufferRef = useRef<number[]>([]);
  const shakeStartRef = useRef<number | null>(null);
  const stateRef = useRef<GyroState>('idle');

  // Keep ref in sync with state so the event handler always sees the latest
  useEffect(() => { stateRef.current = gyroState; }, [gyroState]);

  /* ── Detect gyroscope support ── */
  useEffect(() => {
    const supported = 'DeviceOrientationEvent' in window;
    setHasGyro(supported);
    // Auto-grant on Android (no permission API)
    if (supported && typeof (DeviceOrientationEvent as any).requestPermission !== 'function') {
      setPermissionGranted(true);
    }
  }, []);

  /* ── iOS permission on tap ── */
  const requestPermission = useCallback(async () => {
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      try {
        const perm = await (DeviceOrientationEvent as any).requestPermission();
        if (perm === 'granted') setPermissionGranted(true);
      } catch { /* user denied */ }
    }
  }, []);

  /* ── Listen to gyroscope ── */
  useEffect(() => {
    if (!hasGyro || !permissionGranted) return;

    const onOrientation = (e: DeviceOrientationEvent) => {
      const beta = e.beta || 0;
      const gamma = e.gamma || 0;

      // Dampened orientation for gentle parallax
      setOrientation({ beta: beta * 0.4, gamma: gamma * 0.4 });

      // Calculate instantaneous shake intensity
      const dB = Math.abs(beta - lastRef.current.beta);
      const dG = Math.abs(gamma - lastRef.current.gamma);
      lastRef.current = { beta, gamma };

      const intensity = dB + dG;
      const buf = bufferRef.current;
      buf.push(intensity);
      if (buf.length > 40) buf.shift(); // ~0.6-0.8s rolling window
      const avg = buf.reduce((a, b) => a + b, 0) / buf.length;

      const SHAKE_THRESHOLD = 12;

      if (avg > SHAKE_THRESHOLD) {
        if (stateRef.current === 'scattered') {
          // Any shake in scattered → snap back to idle
          setGyroState('idle');
          shakeStartRef.current = null;
          bufferRef.current = [];
        } else {
          // In idle, accumulate shake time
          if (!shakeStartRef.current) {
            shakeStartRef.current = Date.now();
          } else if (Date.now() - shakeStartRef.current > 4000) {
            // 4 seconds of aggressive shaking → scatter!
            setScattered(randomScatter());
            setGyroState('scattered');
            shakeStartRef.current = null;
            bufferRef.current = [];
          }
        }
      } else {
        // Not shaking aggressively — reset timer
        if (stateRef.current === 'idle') {
          shakeStartRef.current = null;
        }
      }
    };

    window.addEventListener('deviceorientation', onOrientation);
    return () => window.removeEventListener('deviceorientation', onOrientation);
  }, [hasGyro, permissionGranted]);

  /* ── Render words ── */
  let wordIdx = 0;

  return (
    <h3
      className="font-display text-5xl md:text-7xl lg:text-[7rem] font-black leading-[0.9] tracking-tighter mb-8 uppercase"
      onClick={!permissionGranted ? requestPermission : undefined}
    >
      {HERO_LINES.map((line, li) => (
        <React.Fragment key={li}>
          {line.words.map((w) => {
            const idx = wordIdx++;
            const isScattered = gyroState === 'scattered';

            // Per-word parallax factor (increases with index for depth)
            const factor = (idx + 1) * 0.6;
            const idleX = hasGyro && permissionGranted ? orientation.gamma * factor : 0;
            const idleY = hasGyro && permissionGranted ? orientation.beta * factor * 0.3 : 0;

            return (
              <motion.span
                key={idx}
                className={`inline-block ${w.special
                    ? 'text-transparent [-webkit-text-stroke:1px_#f0f0f0] hover:[-webkit-text-stroke:2px_#CCFF00] transition-all duration-300'
                    : ''
                  }`}
                style={{ marginRight: '0.25em' }}
                animate={{
                  x: isScattered ? scattered[idx].x : idleX,
                  y: isScattered ? scattered[idx].y : idleY,
                  rotate: isScattered ? scattered[idx].rotate : 0,
                }}
                transition={
                  isScattered
                    ? { type: 'spring', stiffness: 120, damping: 14 }
                    : { type: 'tween', duration: 0.12, ease: 'easeOut' }
                }
              >
                {w.text}
              </motion.span>
            );
          })}
          {line.br && <br />}
        </React.Fragment>
      ))}
    </h3>
  );
};

const MagneticElement = ({ children, strength = 0.2 }: { children: React.ReactNode, strength?: number }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleMouse = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const { clientX, clientY } = e;
    const { height, width, left, top } = ref.current.getBoundingClientRect();
    const middleX = clientX - (left + width / 2);
    const middleY = clientY - (top + height / 2);
    setPosition({ x: middleX * strength, y: middleY * strength });
  };

  const reset = () => {
    setPosition({ x: 0, y: 0 });
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouse}
      onMouseLeave={reset}
      animate={{ x: position.x, y: position.y }}
      transition={{ type: "spring", stiffness: 150, damping: 15, mass: 0.1 }}
      className="inline-block"
    >
      {children}
    </motion.div>
  );
};

const LinkItem = ({ href, icon: Icon, label, index }: { href: string, icon: any, label: string, index: number }) => {
  return (
    <motion.a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative flex items-center justify-between p-6 md:p-8 border-b border-white/10 hover:bg-[#CCFF00] transition-colors duration-500 overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.8 + index * 0.1 }}
    >
      <div className="flex items-center gap-6 z-10">
        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-black group-hover:text-[#CCFF00] transition-colors duration-500">
          <Icon size={24} />
        </div>
        <span className="font-display text-3xl md:text-5xl font-bold text-white/50 group-hover:text-black transition-colors duration-500 tracking-tight">
          {label}
        </span>
      </div>

      <div className="z-10 overflow-hidden">
        <motion.div
          className="w-12 h-12 rounded-full bg-transparent border border-white/20 flex items-center justify-center group-hover:bg-black group-hover:border-black transition-all duration-500"
        >
          <ArrowUpRight size={24} className="text-white group-hover:text-[#CCFF00] transition-colors duration-500" />
        </motion.div>
      </div>
    </motion.a>
  );
};

const Marquee = () => {
  return (
    <div className="relative w-full overflow-hidden bg-[#CCFF00] text-[#050505] py-4 -rotate-2 scale-110 z-30 border-y-4 border-black shadow-[0_0_30px_rgba(204,255,0,0.3)]">
      <motion.div
        className="flex whitespace-nowrap font-display font-black text-3xl uppercase tracking-widest"
        animate={{ x: [0, -1000] }}
        transition={{ repeat: Infinity, duration: 15, ease: "linear" }}
      >
        {[...Array(10)].map((_, i) => (
          <span key={i} className="mx-6 flex items-center gap-6">
            <span>SITE UNDER CONSTRUCTION</span>
            <HardHat size={32} />
            <span>DO NOT ENTER</span>
            <Hammer size={32} />
          </span>
        ))}
      </motion.div>
    </div>
  );
};

export default function App() {
  const { scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, [0, 1], [0, 200]);

  return (
    <div className="min-h-screen bg-[#050505] text-[#f0f0f0] selection:bg-[#CCFF00] selection:text-black overflow-x-hidden">
      <div className="noise"></div>
      <CustomCursor />

      <main className="relative min-h-screen flex flex-col justify-between p-6 md:p-12 lg:p-16 max-w-[1600px] mx-auto">

        {/* Header */}
        <header className="flex justify-between items-start z-20">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-2 h-2 bg-[#CCFF00] rounded-full animate-ping" />
              <h2 className="font-mono text-xs text-[#CCFF00] tracking-[0.2em] uppercase">Status: Building</h2>
            </div>
            <h1 className="font-display text-3xl md:text-5xl font-black tracking-tighter leading-none">
              AVIRAL<br />KAINTURA
            </h1>
          </motion.div>

          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.5 }}
          >
            <MagneticElement strength={0.4}>
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-full border border-white/20 bg-white/5 backdrop-blur-sm flex items-center justify-center text-3xl shadow-[0_0_20px_rgba(255,255,255,0.05)] cursor-pointer">
                👨‍💻
              </div>
            </MagneticElement>
          </motion.div>
        </header>

        {/* Center Content */}
        <div className="flex-1 flex flex-col justify-center my-16 md:my-24 z-20">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="max-w-4xl"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-md mb-8 font-mono text-xs text-white/70">
              <Terminal size={14} className="text-[#CCFF00]" />
              <span>~/kaintura.com/init.sh</span>
            </div>

            <GyroText />

            <div className="font-mono text-sm md:text-base text-white/60 max-w-xl leading-relaxed space-y-4 border-l-2 border-[#CCFF00] pl-6">
              <p>
                <span className="text-[#CCFF00]">&gt;</span> Currently engineering the actual landing page.
              </p>
              <p>
                <span className="text-[#CCFF00]">&gt;</span> This is <span className="line-through decoration-[#CCFF00] decoration-2">not</span> the right time to visit. But since you're here, you can check out my other stuff while I finish manipulating the DOM.
              </p>
            </div>
          </motion.div>
        </div>

        {/* Links Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-end z-20 pb-24 md:pb-0">
          <motion.div
            className="lg:col-span-4 font-mono text-xs text-white/40 uppercase tracking-widest leading-loose"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
          >
            <div className="mb-4">
              <span className="text-[#CCFF00]">Location:</span> Internet<br />
              <span className="text-[#CCFF00]">Role:</span> Frontend Wizard<br />
              <span className="text-[#CCFF00]">Vibe:</span> Greedy for good design
            </div>
            © {new Date().getFullYear()} Kaintura.com<br />
            All rights reserved (mostly)
          </motion.div>

          <div className="lg:col-span-8 flex flex-col border-t border-white/10">
            <LinkItem href="https://aviralkportfolio.vercel.app/" icon={Briefcase} label="Portfolio" index={0} />
            <LinkItem href="https://linkedin.com/in/codeavi" icon={Linkedin} label="LinkedIn" index={1} />
            <LinkItem href="https://avijourney.vercel.app/" icon={BookOpen} label="Blogs" index={2} />
          </div>
        </div>

        {/* Background massive text */}
        <motion.div
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full text-center pointer-events-none z-0 opacity-[0.02] mix-blend-overlay"
          style={{ y }}
        >
          <h1 className="font-display text-[25vw] font-black tracking-tighter leading-none whitespace-nowrap">
            KAINTURA
          </h1>
        </motion.div>
      </main>

      {/* Marquee overlay */}
      <div className="fixed bottom-8 md:bottom-12 left-0 w-full z-30 pointer-events-none">
        <Marquee />
      </div>
    </div>
  );
}
