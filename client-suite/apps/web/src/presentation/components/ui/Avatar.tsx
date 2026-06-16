interface AvatarProps {
  letter: string;
  size?: number;
  gradient?: string;
  src?: string | null;
  className?: string;
}

export function Avatar({ letter, size = 40, gradient, src, className = '' }: AvatarProps) {
  const defaultBg = gradient ?? 'bg-primary';
  const sizeStyle = { width: size, height: size, minWidth: size };

  if (src) {
    return (
      <img
        src={src}
        alt={letter}
        className={`rounded-full object-cover ${className}`}
        style={sizeStyle}
      />
    );
  }

  return (
    <div
      className={`rounded-full flex items-center justify-center text-white font-bold text-xs ${defaultBg} ${className}`}
      style={sizeStyle}
    >
      {letter}
    </div>
  );
}
