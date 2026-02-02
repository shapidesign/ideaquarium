import { ButtonHTMLAttributes, forwardRef } from 'react';


import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger' | 'warning' | 'ghost';
    size?: 'sm' | 'md' | 'lg' | 'icon';
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
        return (
            <button
                ref={ref}
                className={cn(
                    // Base
                    'inline-flex items-center justify-center font-bold transition-all focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none',
                    // Border & Shadow (Neo-Brutalist)
                    'border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-[4px] active:translate-x-[4px] active:shadow-none',
                    // Fonts
                    'font-hebrew',
                    {
                        // Variants
                        'bg-brand-blue text-black': variant === 'primary',
                        'bg-brand-yellow text-black': variant === 'warning', // Exit/Close usually yellow
                        'bg-brand-red text-white': variant === 'danger', // Delete
                        'bg-brand-orange text-black': variant === 'secondary', // Auth
                        'bg-white text-black': variant === 'ghost',

                        // Sizes
                        'h-10 px-4 py-2 text-sm': size === 'sm',
                        'h-12 px-6 py-3 text-base': size === 'md',
                        'h-16 px-8 py-4 text-lg': size === 'lg',
                        'h-12 w-12 p-0': size === 'icon',
                    },
                    className
                )}
                {...props}
            />
        );
    }
);

Button.displayName = 'Button';

export { Button };
