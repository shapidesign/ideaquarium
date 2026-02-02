import { useState, useEffect } from "react";
import { Check } from "lucide-react";
import type { Idea } from "@/app/App";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";

interface IdeaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddIdea: (name: string, description: string, isDone: boolean) => void;
  editIdea?: Idea | null;
}

export function IdeaModal({ isOpen, onClose, onAddIdea, editIdea }: IdeaModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (editIdea) {
        setName(editIdea.name);
        setDescription(editIdea.description);
        setIsDone(editIdea.isDone || false);
      } else {
        setName("");
        setDescription("");
        setIsDone(false);
      }
    }
  }, [isOpen, editIdea]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onAddIdea(name.trim(), description.trim(), isDone);
      onClose();
    }
  };

  const handleDelete = () => {
    setName("");
    setDescription("");
    setIsDone(false);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-2xl bg-[#F5F5DC]">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col items-stretch gap-4 md:gap-5"
        dir="rtl"
      >
        {/* Title Input */}
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="כותרת (אופציונלי)"
          autoFocus
          className="text-right text-base md:text-lg"
        />

        {/* Description Textarea */}
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="כתוב את הרעיון שלך כאן..."
          rows={6}
          className="text-right text-base md:text-lg"
        />

        {/* Is Done Checkbox - Keeping as custom styled div for now to match specific look or simpler checkbox */}
        <div
          className="flex items-center gap-3 cursor-pointer bg-white border-4 border-black p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-[4px] active:translate-y-[4px] transition-all"
          onClick={() => setIsDone(!isDone)}
        >
          <div className={`w-6 h-6 border-2 border-black flex items-center justify-center transition-colors ${isDone ? 'bg-[#4CAF50]' : 'bg-white'}`}>
            {isDone && <Check className="w-4 h-4 text-white" strokeWidth={4} />}
          </div>
          <span className="font-hebrew text-lg select-none">סמן כבוצע</span>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 md:gap-4 justify-center mt-4">
          {/* Save Button */}
          <Button
            type="submit"
            disabled={!name.trim()}
            variant="primary" // Changed to match brand blue or custom green? Figma had Blue for New Idea, but Save was Green.
            // The previous code had Save as Green (#67F04C or #4CAF50). 
            // My Button component has 'primary' as Blue. I should add 'success' or just override class.
            className="bg-[#4CAF50] text-white hover:bg-[#45a049] active:bg-[#3d8b40]"
            size="md"
          >
            שמור
          </Button>

          {/* Delete Button */}
          <Button
            type="button"
            onClick={handleDelete}
            variant="danger"
            size="md"
          >
            מחק
          </Button>

          {/* Exit Button */}
          <Button
            type="button"
            onClick={onClose}
            variant="warning"
            size="md"
          >
            יציאה
          </Button>
        </div>
      </form>
    </Modal>
  );
}
