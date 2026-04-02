"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import InfiniteGallery from "@/components/ui/3d-gallery-photography";
import { Button } from "@/components/ui/button";
import { Bug, X, PlugZap } from "lucide-react";
import { useEffect } from "react";

const LightRays = dynamic(() => import("@/components/ui/light-rays"), {
  ssr: false,
});

const Particles = dynamic(() => import("@/components/ui/particles"), {
  ssr: false,
});

const CHARACTER_NAMES = [
  "Aria", "Zephyr", "Luna", "Kai", "Nova", "Orion", "Sage", "Raven",
  "Phoenix", "Lyra", "Jasper", "Celeste", "Finn", "Aurora", "Silas",
  "Elara", "Ronin", "Maya", "Dante", "Iris", "Kael", "Freya"
];

const CREATOR_NAMES = [
  "@firekuma", "@shadowweaver", "@starlight", "@neon_ninja", "@pixel_pioneer",
  "@cyber_samurai", "@dream_weaver", "@cosmic_creator", "@digital_druid", "@art_artisan",
  "@mystic_maker", "@tech_titan", "@void_voyager", "@quantum_quill", "@nebula_nomad"
];

const attachmentFiles = [
  "/attachments/127eb9ef4ca626e8584ac611f6b95c9b.jpg",
  "/attachments/13315546fdc6006265b42a3bb6ccd2e4.jpg",
  "/attachments/136640740_p0.jpg",
  "/attachments/1aed29a72b8afd8efcfa920b3a509033.jpg",
  "/attachments/1bdd40277f7c0dbb0b2bfa2b6f7c8f89.jpg",
  "/attachments/20260129_231655.jpg",
  "/attachments/20260129_231933.jpg",
  "/attachments/22ef7f62d1c974a9731a5804602226de.jpg",
  "/attachments/2833d5e0c78aabe1acb53217737df8cf9d96210360abff3c3cdfea834248625b.jpeg",
  "/attachments/28da902f9daf6eec130157e4ce656112.jpg",
  "/attachments/3ad30d33adffe413a3d3f95581033a78.jpg",
  "/attachments/4c692f461f1a08f9c271177ed6923d5f.jpg",
  "/attachments/6004eb792407b5b92f2a10a59bb7d5d9.jpg",
  "/attachments/9k=_1772082096487.jpg",
  "/attachments/Fix_hands_hold_202604020316.jpeg",
  "/attachments/IMG_20260402_030816.jpg",
  "/attachments/IMG_20260402_031702.jpg",
  "/attachments/Z(1)_1772082096845.jpg",
  "/attachments/c084a819078b2c14bb1701238ef0b5ab.jpg",
  "/attachments/cbe163be8f39837cff59edda59d696b4.webp",
  "/attachments/ced279c604303a9b3989352c5cf0178b.jpg",
  "/attachments/hRdyOoZgA9a4JVpukBCif.webp"
];

export default function SignInPage() {
  const [showSettings, setShowSettings] = useState(false);
  const [galleryImages, setGalleryImages] = useState<{ src: string; alt?: string; characterName?: string; creatorName?: string }[]>([]);

  useEffect(() => {
    const generateRandomizedImages = () => {
      const generated = attachmentFiles.map(src => {
        const charName = CHARACTER_NAMES[Math.floor(Math.random() * CHARACTER_NAMES.length)];
        const creatorName = CREATOR_NAMES[Math.floor(Math.random() * CREATOR_NAMES.length)];
        return {
          src,
          alt: `Character ${charName}`,
          characterName: charName,
          creatorName: creatorName
        };
      });

      // Shuffle the array
      for (let i = generated.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [generated[i], generated[j]] = [generated[j], generated[i]];
      }

      setGalleryImages(generated);
    };

    generateRandomizedImages();
  }, []);


  // Effect settings
  const [lightSpread, setLightSpread] = useState(1.2);
  const [rayLength, setRayLength] = useState(2.5);
  const [fadeDistance, setFadeDistance] = useState(1.2);
  const [saturation, setSaturation] = useState(1.0);
  const [lightOpacity, setLightOpacity] = useState(0.3);
  const [particleCount, setParticleCount] = useState(150);
  const [particleSize, setParticleSize] = useState(80);
  const [particleOpacity, setParticleOpacity] = useState(0.3);

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-black text-white">
      {/* Light Rays Effect - Background */}
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{ opacity: lightOpacity }}
      >
        <LightRays
          lightSpread={lightSpread}
          rayLength={rayLength}
          fadeDistance={fadeDistance}
          saturation={saturation}
        />
      </div>

      {/* Particles Effect - Background */}
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{ opacity: particleOpacity }}
      >
        <Particles
          particleCount={particleCount}
          particleBaseSize={particleSize}
        />
      </div>

      <InfiniteGallery
        images={galleryImages}
        speed={1.2}
        zSpacing={3}
        visibleCount={12}
        falloff={{ near: 0.8, far: 14 }}
        className="h-screen w-full relative z-10"
      />

      <div className="fixed inset-0 z-20 flex h-screen items-center justify-center px-3 text-center text-white mix-blend-exclusion pointer-events-none">
        <div className="pointer-events-auto space-y-6">
          <h1 className="font-serif text-4xl tracking-tight sm:text-6xl md:text-7xl">
            <span className="italic">I create;</span> therefore I am
          </h1>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button
              size="lg"
              className="h-14 min-w-[220px] gap-2 rounded-full bg-white text-black hover:bg-white/90"
            >
              Join Now
            </Button>
            <Button
              size="lg"
              variant="secondary"
              className="h-14 min-w-[220px] gap-2 rounded-full border border-white/30 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20"
            >
              <PlugZap className="size-5" />
              Use Local Account
            </Button>
          </div>
        </div>
      </div>

      <div className="fixed bottom-10 left-0 right-0 z-20 text-center font-mono text-[11px] font-semibold uppercase">
        <p>Use mouse wheel, arrow keys, or touch to navigate</p>
        <p className="opacity-60">
          Auto-play resumes after 3 seconds of inactivity
        </p>
      </div>

      {/* Debug Toggle Button */}
      <button
        onClick={() => setShowSettings(!showSettings)}
        className="fixed top-4 right-4 z-50 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white hover:bg-white/20 transition-all flex items-center gap-2 text-sm font-medium"
      >
        {showSettings ? <X className="size-4" /> : <Bug className="size-4" />}
        {showSettings ? "Close" : "Debug"}
      </button>

      {/* Settings Panel */}
      {showSettings && (
        <div className="fixed top-14 right-4 z-50 w-72 rounded-2xl bg-black/60 backdrop-blur-xl border border-white/10 p-5 text-white shadow-2xl">
          <h3 className="text-sm font-semibold mb-4 text-white/80 uppercase tracking-wider">
            Light Rays
          </h3>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-white/60">Opacity</span>
                <span className="text-white/80 font-mono">
                  {(lightOpacity * 100).toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={lightOpacity}
                onChange={(e) => setLightOpacity(parseFloat(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-white/20 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-white/60">Light Spread</span>
                <span className="text-white/80 font-mono">
                  {lightSpread.toFixed(1)}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="3"
                step="0.1"
                value={lightSpread}
                onChange={(e) => setLightSpread(parseFloat(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-white/20 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-white/60">Ray Length</span>
                <span className="text-white/80 font-mono">
                  {rayLength.toFixed(1)}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="5"
                step="0.1"
                value={rayLength}
                onChange={(e) => setRayLength(parseFloat(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-white/20 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-white/60">Fade Distance</span>
                <span className="text-white/80 font-mono">
                  {fadeDistance.toFixed(1)}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="3"
                step="0.1"
                value={fadeDistance}
                onChange={(e) => setFadeDistance(parseFloat(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-white/20 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-white/60">Saturation</span>
                <span className="text-white/80 font-mono">
                  {saturation.toFixed(1)}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={saturation}
                onChange={(e) => setSaturation(parseFloat(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-white/20 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
              />
            </div>

            <div className="border-t border-white/10 pt-4 mt-4">
              <h4 className="text-xs font-semibold mb-3 text-white/60 uppercase tracking-wider">
                Particles
              </h4>

              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-white/60">Opacity</span>
                    <span className="text-white/80 font-mono">
                      {(particleOpacity * 100).toFixed(0)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={particleOpacity}
                    onChange={(e) =>
                      setParticleOpacity(parseFloat(e.target.value))
                    }
                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-white/20 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-white/60">Count</span>
                    <span className="text-white/80 font-mono">
                      {particleCount}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="400"
                    step="10"
                    value={particleCount}
                    onChange={(e) => setParticleCount(parseInt(e.target.value))}
                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-white/20 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-white/60">Size</span>
                    <span className="text-white/80 font-mono">
                      {particleSize}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="20"
                    max="200"
                    step="5"
                    value={particleSize}
                    onChange={(e) => setParticleSize(parseInt(e.target.value))}
                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-white/20 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
