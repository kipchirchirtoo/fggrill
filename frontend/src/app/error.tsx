"use client"

import { useEffect } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Home, RefreshCcw, AlertTriangle } from "lucide-react"

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error(error)
    }, [error])

    return (
        <div className="min-h-screen bg-[#fef2f2] flex flex-col items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-md bg-white rounded-[2rem] shadow-[0_20px_50px_rgba(239,68,68,0.1)] overflow-hidden border border-red-50"
            >
                <div className="p-8 text-center">
                    <motion.div
                        animate={{
                            rotate: [0, -10, 10, -10, 10, 0],
                        }}
                        transition={{
                            duration: 2,
                            repeat: Infinity,
                            repeatDelay: 3
                        }}
                        className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-6"
                    >
                        <AlertTriangle className="w-10 h-10 text-orange-500" />
                    </motion.div>

                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Something Went Wrong</h1>
                    <p className="text-gray-500 mb-8 leading-relaxed">
                        Appologies for the interruption. We encountered an unexpected error while processing your request.
                    </p>

                    <div className="space-y-3">
                        <button
                            onClick={() => reset()}
                            className="group flex items-center justify-center gap-2 w-full py-4 bg-[#007AFF] hover:bg-[#0063CC] text-white rounded-2xl font-semibold transition-all shadow-lg hover:shadow-xl active:scale-95"
                        >
                            <RefreshCcw className="w-5 h-5 transition-transform group-hover:rotate-180 duration-500" />
                            Try Again
                        </button>

                        <Link
                            href="/terminal"
                            className="flex items-center justify-center gap-2 w-full py-4 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-2xl font-semibold transition-all active:scale-95"
                        >
                            <Home className="w-5 h-5" />
                            Back to Welcome Screen
                        </Link>
                    </div>
                </div>
            </motion.div>

            <div className="mt-8 flex gap-4">
                <p className="text-xs text-gray-400 font-mono">
                    ID: {error.digest || 'Internal Runtime Error'}
                </p>
            </div>
        </div>
    )
}
