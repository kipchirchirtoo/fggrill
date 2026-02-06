"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

const TooltipProvider = ({ children }: { children: React.ReactNode }) => <>{children}</>;

const TooltipContext = React.createContext<{
    isVisible: boolean;
    setIsVisible: (v: boolean) => void;
} | null>(null);

const Tooltip = ({
    children,
    delayDuration = 0,
}: {
    children: React.ReactNode;
    delayDuration?: number;
}) => {
    const [isVisible, setIsVisible] = React.useState(false);
    const [timer, setTimer] = React.useState<NodeJS.Timeout | null>(null);

    const show = () => {
        const t = setTimeout(() => setIsVisible(true), delayDuration);
        setTimer(t);
    };

    const hide = () => {
        if (timer) clearTimeout(timer);
        setIsVisible(false);
    };

    return (
        <TooltipContext.Provider value={{ isVisible, setIsVisible }}>
            <div
                className="relative inline-block"
                onMouseEnter={show}
                onMouseLeave={hide}
                onFocus={show}
                onBlur={hide}
            >
                {children}
            </div>
        </TooltipContext.Provider>
    );
};

const TooltipTrigger = ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
);

const TooltipContent = ({
    children,
    className,
    sideOffset = 4,
}: {
    children: React.ReactNode;
    className?: string;
    sideOffset?: number;
}) => {
    const context = React.useContext(TooltipContext);
    if (!context) throw new Error("TooltipContent must be used within a Tooltip");

    return (
        <AnimatePresence>
            {context.isVisible && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 5 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 5 }}
                    transition={{ duration: 0.1 }}
                    style={{ bottom: `calc(100% + ${sideOffset}px)` }}
                    className={cn(
                        "absolute left-1/2 -translate-x-1/2 z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md max-w-xs",
                        className
                    )}
                >
                    {children}
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
