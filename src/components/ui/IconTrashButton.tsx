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
      className={`inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl align-middle text-[#d07c59] dark:text-red-400 transition-colors hover:bg-[#fff0e8] dark:hover:bg-red-500/15 hover:text-[#d44f43] dark:hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#de9241]/60 dark:focus-visible:ring-indigo-400/60 ${className}`}
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}
