import { ReactNode } from 'react';

interface ButtonProps {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  onClick?: () => void;
}

export default function Button({ 
  children, 
  variant = 'secondary', 
  size = 'md', 
  disabled = false,
  onClick 
}: ButtonProps) {
  const baseClasses = "inline-flex items-center justify-center font-medium transition-all";
  
  const variantClasses = {
    primary: "bg-white border-2 border-black text-black hover:bg-gray-50 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]",
    secondary: "bg-gray-100 border border-gray-300 text-gray-800 hover:bg-gray-200 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)]",
    outline: "bg-white border-2 border-black text-black hover:bg-gray-50 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
  };
  
  const sizeClasses = {
    sm: "text-xs px-3 py-1 rounded",
    md: "text-sm px-4 py-2 rounded",
    lg: "text-base px-5 py-2.5 rounded"
  };

  const disabledClasses = disabled ? "opacity-50 cursor-not-allowed" : "hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] active:translate-x-0 active:translate-y-0 active:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]";
  
  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${disabledClasses}`}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
} 