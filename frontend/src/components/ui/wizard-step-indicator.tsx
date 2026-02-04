'use client';

import { Check } from 'lucide-react';
import { motion } from 'framer-motion';

export interface WizardStep {
    id: number;
    title: string;
    description?: string;
}

interface WizardStepIndicatorProps {
    steps: WizardStep[];
    currentStep: number;
    onStepClick?: (stepIndex: number) => void;
    allowClickNavigation?: boolean;
}

export function WizardStepIndicator({
    steps,
    currentStep,
    onStepClick,
    allowClickNavigation = false,
}: WizardStepIndicatorProps) {
    const handleStepClick = (index: number) => {
        if (allowClickNavigation && onStepClick && index <= currentStep) {
            onStepClick(index);
        }
    };

    return (
        <div className="w-full py-6">
            <div className="flex items-center justify-between relative">
                {steps.map((step, index) => {
                    const isCompleted = index < currentStep;
                    const isActive = index === currentStep;
                    const isPending = index > currentStep;

                    return (
                        <div key={step.id} className="flex items-center flex-1">
                            <div className="flex flex-col items-center flex-1 relative z-10">
                                {/* Step Circle */}
                                <motion.button
                                    onClick={() => handleStepClick(index)}
                                    disabled={!allowClickNavigation || index > currentStep}
                                    className={`
                    w-12 h-12 rounded-full flex items-center justify-center font-semibold 
                    transition-all duration-300 mb-3 relative
                    ${isCompleted
                                            ? 'bg-emerald-500 text-white hover:bg-emerald-600 cursor-pointer'
                                            : isActive
                                                ? 'bg-blue-500 text-white ring-4 ring-blue-200'
                                                : 'bg-slate-200 text-slate-500'
                                        }
                    ${allowClickNavigation && index <= currentStep ? 'cursor-pointer' : 'cursor-default'}
                  `}
                                    whileHover={allowClickNavigation && index <= currentStep ? { scale: 1.05 } : {}}
                                    whileTap={allowClickNavigation && index <= currentStep ? { scale: 0.95 } : {}}
                                >
                                    {isCompleted ? (
                                        <motion.div
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                                        >
                                            <Check className="w-6 h-6" />
                                        </motion.div>
                                    ) : (
                                        <span className="text-base">{step.id}</span>
                                    )}
                                </motion.button>

                                {/* Step Label */}
                                <div className="text-center max-w-[120px]">
                                    <div
                                        className={`
                      font-medium text-sm transition-colors duration-300
                      ${isActive
                                                ? 'text-blue-600'
                                                : isCompleted
                                                    ? 'text-emerald-600'
                                                    : 'text-slate-500'
                                            }
                    `}
                                    >
                                        {step.title}
                                    </div>
                                    {step.description && (
                                        <div className="text-xs text-slate-400 mt-1 hidden sm:block">
                                            {step.description}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Connector Line */}
                            {index < steps.length - 1 && (
                                <div className="flex-1 h-1 mx-2 -mt-12 relative">
                                    {/* Background line */}
                                    <div className="absolute inset-0 bg-slate-200 rounded-full" />

                                    {/* Progress line */}
                                    <motion.div
                                        className="absolute inset-0 bg-emerald-500 rounded-full origin-left"
                                        initial={{ scaleX: 0 }}
                                        animate={{
                                            scaleX: index < currentStep ? 1 : 0
                                        }}
                                        transition={{
                                            duration: 0.5,
                                            ease: 'easeInOut',
                                            delay: index < currentStep ? index * 0.1 : 0
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Progress Percentage */}
            <div className="mt-6 text-center">
                <p className="text-sm text-slate-600 mb-2">
                    Step {currentStep + 1} of {steps.length}
                </p>
                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <motion.div
                        className="bg-blue-500 h-2 rounded-full"
                        initial={{ width: 0 }}
                        animate={{
                            width: `${((currentStep + 1) / steps.length) * 100}%`
                        }}
                        transition={{ duration: 0.5, ease: 'easeInOut' }}
                    />
                </div>
            </div>
        </div>
    );
}
