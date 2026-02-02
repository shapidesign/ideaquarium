import { X } from "lucide-react";
import type { Idea } from "@/app/App";
import { FISH_ASSETS } from "@/app/utils/fishAssets";

interface IdeasListModalProps {
  ideas: Idea[];
  isOpen: boolean;
  onClose: () => void;
  onIdeaClick: (idea: Idea) => void;
}

export function IdeasListModal({ ideas, isOpen, onClose, onIdeaClick }: IdeasListModalProps) {
  if (!isOpen) return null;

  // Show newest first
  const reversedIdeas = [...ideas].reverse();

  const handleIdeaClick = (idea: Idea) => {
    onClose();
    onIdeaClick(idea);
  };

  const getFishAsset = (idea: Idea) => {
    if (idea.fishImage) return idea.fishImage;
    const index = idea.fishType !== undefined 
      ? idea.fishType % FISH_ASSETS.length 
      : parseInt(idea.id || "0", 10) % FISH_ASSETS.length;
    return FISH_ASSETS[index];
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-3xl max-h-[80vh]">
        <div 
          className="bg-[#F5F5DC] border-[4px] md:border-[6px] border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-5 md:p-8 flex flex-col max-h-[80vh]"
          style={{ imageRendering: 'pixelated' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-5 md:mb-6">
            <h2 className="text-2xl md:text-4xl font-['Shimshon','Miriam_Libre',sans-serif] text-black">
              כל הרעיונות
            </h2>
            <button
              onClick={onClose}
              className="p-2 bg-white border-[2px] border-black hover:bg-gray-200 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all"
            >
              <X className="w-5 h-5 md:w-6 md:h-6 text-black" />
            </button>
          </div>

          {/* Ideas List - Scrollable */}
          <div className="overflow-y-auto flex-1 space-y-3 md:space-y-4 pl-2">
            {reversedIdeas.map((idea) => (
              <button
                key={idea.id}
                onClick={() => handleIdeaClick(idea)}
                className={`w-full bg-white hover:bg-gray-100 border-[3px] ${idea.isDone ? 'border-[#4CAF50]' : 'border-black'} shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-x-[2px] hover:-translate-y-[2px] active:shadow-none active:translate-x-[4px] active:translate-y-[4px] p-4 md:p-5 transition-all text-right flex items-center gap-4 md:gap-5`}
                style={{ imageRendering: 'pixelated' }}
              >
                {/* Fish Thumbnail */}
                <img
                  src={getFishAsset(idea)}
                  alt={idea.name}
                  className="w-[50px] h-[50px] md:w-[70px] md:h-[70px] object-contain flex-shrink-0"
                  style={{
                    imageRendering: "pixelated",
                    filter: idea.isDone ? 'drop-shadow(0 0 5px #4CAF50)' : undefined
                  }}
                />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* Title */}
                  {idea.name && (
                    <h3 className="text-lg md:text-2xl font-['Shimshon','Miriam_Libre',sans-serif] text-black truncate mb-1">
                      {idea.name}
                    </h3>
                  )}

                  {/* Description */}
                  {idea.description && (
                    <p className="text-sm md:text-base font-['Shimshon','Miriam_Libre',sans-serif] text-gray-700 line-clamp-2">
                      {idea.description}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
