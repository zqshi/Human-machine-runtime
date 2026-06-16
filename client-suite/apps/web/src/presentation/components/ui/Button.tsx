import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
}

const variants = {
  primary: 'bg-primary text-white hover:bg-primary-dark shadow-btn-primary',
  secondary: 'bg-bg-white-var text-text-primary border border-border hover:bg-bg-hover',
  ghost: 'bg-transparent text-text-secondary hover:bg-bg-hover',
};

const sizes = {
  sm: 'h-7 px-3 text-xs rounded',
  md: 'h-8 px-4 text-sm rounded-lg',
  lg: 'h-10 px-5 text-base rounded-lg',
};

export function Button({
  variant = 'primary',
  size = 'md',
  children,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center font-medium transition-colors ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
