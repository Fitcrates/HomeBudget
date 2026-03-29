import * as LucideIcons from "lucide-react";

interface Props {
  name: string;
  className?: string;
}

// Regex to roughly match a single/multiple emoji string vs a plain text name
const emojiRegex = /(\p{Emoji_Presentation}|\p{Extended_Pictographic})/u;

export function DynamicIcon({ name, className }: Props) {
  if (!name) return null;

  // Fallback if the database still has an emoji instead of a lucide icon name
  if (emojiRegex.test(name)) {
    return <span className={className}>{name}</span>;
  }

  // Find the exact export in LucideIcons
  const IconComponent = (LucideIcons as any)[name];

  if (!IconComponent) {
    // Unknown string
    const fallbackClass = className || "w-5 h-5";
    return <LucideIcons.HelpCircle className={fallbackClass} />;
  }

  return <IconComponent className={className || "w-5 h-5"} />;
}
