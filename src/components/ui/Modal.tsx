import React, { ReactNode } from 'react';
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: ReactNode;
    className?: string; // For custom width etc.
}

export function Modal({ isOpen, onClose, title, children, className }: ModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/20 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Content */}
            <div
                className={cn(
                    "relative z-50 w-full max-w-md bg-white border-4 border-black p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]",
                    "animate-in fade-in zoom-in-95 duration-200",
                    className
                )}
            >
                {title && (
                    <h2 className="text-2xl font-bold font-pixel mb-6 text-center">{title}</h2>
                )}

                {children}
            </div>
        </div>
    );
}
