import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import catLottie from "../../assets/Cat playing animation.lottie?url";

interface CatLoaderProps {
  message?: string;
  size?: "sm" | "md" | "lg";
}

const sizeMap = {
  sm: { outer: "h-24 w-24", inner: "h-18 w-18", border: "border-[3px]", innerInset: "inset-1.5" },
  md: { outer: "h-28 w-28", inner: "h-20 w-20", border: "border-[4px]", innerInset: "inset-2" },
  lg: { outer: "h-32 w-32", inner: "h-24 w-24", border: "border-[4px]", innerInset: "inset-2" },
} as const;

export function CatLoader({ message, size = "md" }: CatLoaderProps) {
  const s = sizeMap[size];

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-6">
      <div
        className={`relative flex ${s.outer} items-center justify-center rounded-full border border-[#f2d6bf] bg-[#fff8f2] shadow-inner`}
      >
        <div
          className={`absolute inset-0 animate-spin rounded-full ${s.border} border-[#de9241] border-t-transparent`}
        />
        <div
          className={`absolute ${s.innerInset} animate-spin rounded-full ${s.border} border-[#ca782a] border-b-transparent`}
          style={{ animationDirection: "reverse" }}
        />
        <div className={`absolute ${s.inner} overflow-hidden rounded-full`}>
          <DotLottieReact src={catLottie} loop autoplay />
        </div>
      </div>
      {message && (
        <p className="animate-pulse text-sm font-bold text-[#8a7262]">{message}</p>
      )}
    </div>
  );
}
