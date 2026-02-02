import { X } from "lucide-react";
import type { Idea } from "@/app/App";
import { FISH_ASSETS } from "@/app/utils/fishAssets";

interface IdeaDetailModalProps {
  idea: Idea | null;
  onClose: () => void;
  onEditIdea: (idea: Idea) => void;
}

export function IdeaDetailModal({ idea, onClose, onEditIdea }: IdeaDetailModalProps) {
  if (!idea) return null;

  // Determine fish asset
  const fishIndex = idea.fishType !== undefined 
    ? idea.fishType % FISH_ASSETS.length 
    : parseInt(idea.id || "0", 10) % FISH_ASSETS.length;
  
  const fishAsset = FISH_ASSETS[fishIndex];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-2xl">
        <div 
          className="bg-[#F5F5DC] border-[4px] md:border-[6px] border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 md:p-10"
          style={{ imageRendering: 'pixelated' }}
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 left-4 md:top-6 md:left-6 p-2 bg-white border-[2px] border-black hover:bg-gray-200 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all"
          >
            <X className="w-5 h-5 md:w-6 md:h-6 text-black" />
          </button>

          <div className="flex flex-col items-center gap-5 md:gap-6">
            {/* Fish Image */}
            <div className={`border-[3px] ${idea.isDone ? 'border-[#4CAF50]' : 'border-black'} bg-white p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]`}>
              <img
                src={fishAsset}
                alt={idea.name}
                className="w-[100px] h-[100px] md:w-[140px] md:h-[140px] object-contain"
                style={{
                  imageRendering: "pixelated",
                  filter: idea.isDone ? 'drop-shadow(0 0 8px #4CAF50)' : undefined
                }}
              />
            </div>

            {/* Title */}
            {idea.name && (
              <h2 className="text-2xl md:text-4xl font-['Shimshon','Miriam_Libre',sans-serif] text-black text-center">
                {idea.name}
              </h2>
            )}

            {/* Description */}
            {idea.description && (
              <div className="w-full bg-white border-[3px] border-black px-5 py-4 md:px-6 md:py-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <p className="text-base md:text-xl font-['Shimshon','Miriam_Libre',sans-serif] text-black text-right whitespace-pre-wrap break-words">
                  {idea.description}
                </p>
              </div>
            )}

            {/* Edit Button */}
            <button
              onClick={() => onEditIdea(idea)}
              className="bg-[#2196F3] border-[3px] md:border-[4px] border-black hover:bg-[#1976D2] active:bg-[#0D47A1] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-[4px] active:translate-y-[4px] px-6 py-3 md:px-8 md:py-4 transition-all"
              style={{ imageRendering: 'pixelated' }}
            >
              <span className="font-['Shimshon','Miriam_Libre',sans-serif] text-lg md:text-xl text-white leading-none whitespace-nowrap">
                עריכה
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
