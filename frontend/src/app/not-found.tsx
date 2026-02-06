"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { Home, AlertCircle, ChevronLeft } from "lucide-react"

export default function NotFound() {
    return (
        <div className="min-h-screen bg-[#f8f9fa] flex flex-col items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-md bg-white rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)] overflow-hidden border border-gray-100"
            >
                <div className="p-8 text-center">
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                        className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6"
                    >
                        <AlertCircle className="w-10 h-10 text-red-500" />
                    </motion.div>

                    <h1 className="text-3xl font-bold text-gray-900 mb-2">404</h1>
                    <h2 className="text-xl font-semibold text-gray-700 mb-4">Page Not Found</h2>
                    <p className="text-gray-500 mb-8 leading-relaxed">
                        Oops! It seems the page you're looking for has wandered off or doesn't exist.
                    </p>

                    <div className="space-y-3">
                        <Link
                            href="/terminal"
                            className="group flex items-center justify-center gap-2 w-full py-4 bg-[#007AFF] hover:bg-[#0063CC] text-white rounded-2xl font-semibold transition-all shadow-lg hover:shadow-xl active:scale-95"
                        >
                            <Home className="w-5 h-5" />
                            Back to Welcome Screen
                        </Link>

                        <button
                            onClick={() => window.history.back()}
                            className="flex items-center justify-center gap-2 w-full py-4 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-2xl font-semibold transition-all active:scale-95"
                        >
                            <ChevronLeft className="w-5 h-5" />
                            Go Back
                        </button>
                    </div>
                </div>
            </motion.div>

            <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="mt-8 text-sm text-gray-400"
            >
                Famous Gates Hotels Management System
            </motion.p>
        </div>
    )
}
