"use client";

import React from "react";

interface DebugSliderProps {
  intensity: number;
  onIntensityChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  lightSpread: number;
  onLightSpreadChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  rayLength: number;
  onRayLengthChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  fadeDistance: number;
  onFadeDistanceChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  saturation: number;
  onSaturationChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export const DebugSlider: React.FC<DebugSliderProps> = ({
  intensity,
  onIntensityChange,
  lightSpread,
  onLightSpreadChange,
  rayLength,
  onRayLengthChange,
  fadeDistance,
  onFadeDistanceChange,
  saturation,
  onSaturationChange,
}) => {
  return (
    <div className="fixed bottom-4 right-4 z-50 bg-gray-800 bg-opacity-50 p-4 rounded-lg">
      <div className="mb-4">
        <div className="flex justify-between">
          <label htmlFor="intensity" className="block text-white text-sm font-bold mb-2">
            Particle Intensity
          </label>
          <span className="text-white text-sm">{intensity.toFixed(1)}</span>
        </div>
        <input
          type="range"
          id="intensity"
          name="intensity"
          min="0"
          max="1.5"
          step="0.1"
          value={intensity}
          onChange={onIntensityChange}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
        />
      </div>
      <div className="mb-4">
        <div className="flex justify-between">
          <label htmlFor="lightSpread" className="block text-white text-sm font-bold mb-2">
            Light Spread
          </label>
          <span className="text-white text-sm">{lightSpread.toFixed(1)}</span>
        </div>
        <input
          type="range"
          id="lightSpread"
          name="lightSpread"
          min="0"
          max="2"
          step="0.1"
          value={lightSpread}
          onChange={onLightSpreadChange}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
        />
      </div>
      <div className="mb-4">
        <div className="flex justify-between">
          <label htmlFor="rayLength" className="block text-white text-sm font-bold mb-2">
            Ray Length
          </label>
          <span className="text-white text-sm">{rayLength.toFixed(1)}</span>
        </div>
        <input
          type="range"
          id="rayLength"
          name="rayLength"
          min="0"
          max="4"
          step="0.1"
          value={rayLength}
          onChange={onRayLengthChange}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
        />
      </div>
      <div className="mb-4">
        <div className="flex justify-between">
          <label htmlFor="fadeDistance" className="block text-white text-sm font-bold mb-2">
            Fade Distance
          </label>
          <span className="text-white text-sm">{fadeDistance.toFixed(1)}</span>
        </div>
        <input
          type="range"
          id="fadeDistance"
          name="fadeDistance"
          min="0"
          max="2"
          step="0.1"
          value={fadeDistance}
          onChange={onFadeDistanceChange}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
        />
      </div>
      <div>
        <div className="flex justify-between">
          <label htmlFor="saturation" className="block text-white text-sm font-bold mb-2">
            Saturation
          </label>
          <span className="text-white text-sm">{saturation.toFixed(1)}</span>
        </div>
        <input
          type="range"
          id="saturation"
          name="saturation"
          min="0"
          max="2"
          step="0.1"
          value={saturation}
          onChange={onSaturationChange}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
        />
      </div>
    </div>
  );
};