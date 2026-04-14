import { MouseEventHandler } from "react";
import { Trash2 } from "lucide-react";

interface IconTrashButtonProps {
  onClick: MouseEventHandler<HTMLButtonElement>;
  className?: string;
  title?: string;
  stopPropagation?: boolean;
}

export function IconTrashButton({
  onClick,
  className = "",
  title = "Usun",
  stopPropagation = true,
}: IconTrashButtonProps) {
  const handleClick: MouseEventHandler<HTMLButtonElement> = (event) => {
    if (stopPropagation) {
      event.stopPropagation();
    }
    onClick(event);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      title={title}
      aria-label={title}
      className={`inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl text-[#d07c59] transition-colors hover:bg-[#fff0e8] hover:text-[#d44f43] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#de9241]/60 ${className}`}
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}
