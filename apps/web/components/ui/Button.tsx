import type { ButtonHTMLAttributes } from "react";
import { clsx } from "clsx";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost";
type ButtonSize = "md" | "sm";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-lime-spark text-graphite hover:bg-lime-spark/90",
  secondary: "border border-border bg-surface text-ink hover:border-lime-spark",
  outline: "border border-lime-spark bg-surface text-ink hover:text-lime-spark",
  ghost: "bg-transparent text-ink hover:bg-surface"
};

const sizeClasses: Record<ButtonSize, string> = {
  md: "px-3.5 py-3",
  sm: "px-3 py-2.5"
};

export function Button({ className, variant = "primary", size = "md", ...props }: ButtonProps) {
  return <button className={clsx("cursor-pointer rounded-[10px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-60", variantClasses[variant], sizeClasses[size], className)} {...props} />;
}
