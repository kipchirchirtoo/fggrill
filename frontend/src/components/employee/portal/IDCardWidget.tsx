
'use client';

import { useState } from 'react';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { idCardsAPI } from '@/lib/api';
import { ShieldCheck, Download, Eye, Loader2, Camera, User } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';

interface IDCardWidgetProps {
    user: any;
}

export function IDCardWidget({ user }: IDCardWidgetProps) {
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [profilePhoto, setProfilePhoto] = useState<string | null>(user.profilePhoto || null);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type and size (max 5MB)
        if (!file.type.startsWith('image/')) {
            toast.error('Please upload an image file');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            toast.error('File size must be less than 5MB');
            return;
        }

        setIsUploading(true);
        const toastId = toast.loading('Uploading photo...');

        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${user.id}-${Date.now()}.${fileExt}`;
            const filePath = `${fileName}`;

            // Upload to Supabase 'profile' bucket
            const { error: uploadError } = await supabase.storage
                .from('profile')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('profile')
                .getPublicUrl(filePath);

            setProfilePhoto(publicUrl);
            toast.success('Profile photo updated', { id: toastId });
        } catch (error) {
            console.error('Upload error:', error);
            toast.error('Failed to upload photo', { id: toastId });
        } finally {
            setIsUploading(false);
        }
    };

    const handlePreview = async () => {
        setIsPreviewOpen(true);
        setIsLoading(true);
        setPreviewUrl(null);

        try {
            const data = {
                name: `${user.firstName} ${user.lastName}`,
                role: user.role?.replace('_', ' ').toUpperCase() || 'EMPLOYEE',
                id_no: user.employeeId || user.id.substring(0, 8).toUpperCase(),
                email: user.email,
                phone: user.phoneNumber || 'N/A',
                join_date: user.startDate ? new Date(user.startDate).toLocaleDateString() : 'N/A',
                expire_date: '31/12/2026',
                photo_url: profilePhoto
            };

            const blob = await idCardsAPI.preview(data);
            const url = URL.createObjectURL(blob);
            setPreviewUrl(url);
        } catch (error) {
            toast.error('Failed to generate preview');
            setIsPreviewOpen(false);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDownload = async () => {
        const loadingToast = toast.loading('Generating ID Card...');
        try {
            const data = {
                name: `${user.firstName} ${user.lastName}`,
                role: user.role?.replace('_', ' ').toUpperCase() || 'EMPLOYEE',
                id_no: user.employeeId || user.id.substring(0, 8).toUpperCase(),
                email: user.email,
                phone: user.phoneNumber || 'N/A',
                join_date: user.startDate ? new Date(user.startDate).toLocaleDateString() : 'N/A',
                expire_date: '31/12/2026',
                photo_url: profilePhoto
            };

            const blob = await idCardsAPI.generate(data);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ID_${user.firstName}_${user.lastName}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast.success('ID Card downloaded', { id: loadingToast });
        } catch (error) {
            toast.error('Failed to download', { id: loadingToast });
        }
    };

    return (
        <>
            <IOSCard className="border-none shadow-sm bg-stone-900 text-white p-6 relative overflow-hidden">
                <div className="relative z-10 space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-600 rounded-lg">
                            <ShieldCheck className="w-5 h-5 text-white" />
                        </div>
                        <h3 className="font-bold text-lg">My Identity Card</h3>
                    </div>

                    {/* Profile Photo Area */}
                    <div className="flex items-center gap-4 bg-stone-800/50 p-3 rounded-xl border border-stone-700/50">
                        <div className="relative w-12 h-12 rounded-full overflow-hidden bg-stone-700 flex-shrink-0 border border-stone-600">
                            {profilePhoto ? (
                                <img src={profilePhoto} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-stone-400">
                                    <User className="w-6 h-6" />
                                </div>
                            )}
                            {isUploading && (
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                    <Loader2 className="w-4 h-4 text-white animate-spin" />
                                </div>
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{user.firstName} {user.lastName}</p>
                            <label className="text-xs text-blue-400 hover:text-blue-300 cursor-pointer flex items-center gap-1 transition-colors">
                                <Camera className="w-3 h-3" />
                                {isUploading ? 'Uploading...' : 'Change Photo'}
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleFileUpload}
                                    disabled={isUploading}
                                />
                            </label>
                        </div>
                    </div>

                    <p className="text-sm text-stone-400">
                        Access your official digital ID card for check-ins and verification.
                    </p>

                    <div className="flex items-center gap-3 pt-2">
                        <IOSButton
                            onClick={handlePreview}
                            variant="secondary"
                            className="bg-stone-800 border-none text-white hover:bg-stone-700 flex-1 gap-2"
                        >
                            <Eye className="w-4 h-4" />
                            Preview
                        </IOSButton>
                        <IOSButton
                            onClick={handleDownload}
                            variant="primary"
                            className="bg-blue-600 hover:bg-blue-700 flex-1 gap-2"
                        >
                            <Download className="w-4 h-4" />
                            Download
                        </IOSButton>
                    </div>
                </div>

                {/* Elegant Background Design */}
                <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-stone-800/50 rounded-full blur-3xl" />
                <div className="absolute -left-10 -top-10 w-32 h-32 bg-red-900/20 rounded-full blur-2xl" />
            </IOSCard>

            <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>ID Card Preview</DialogTitle>
                        <DialogDescription>Official Famous Gate Hotel Identification.</DialogDescription>
                    </DialogHeader>
                    <div className="flex items-center justify-center p-4 bg-stone-100 rounded-2xl min-h-[400px]">
                        {isLoading ? (
                            <div className="flex flex-col items-center gap-4">
                                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                                <p className="text-xs font-bold text-stone-500 uppercase">Generating...</p>
                            </div>
                        ) : previewUrl ? (
                            <iframe
                                src={`${previewUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                                className="w-full h-[500px] border-none rounded-xl"
                            />
                        ) : null}
                    </div>
                    <DialogFooter>
                        <IOSButton onClick={() => setIsPreviewOpen(false)} variant="secondary">Close</IOSButton>
                        <IOSButton className="bg-blue-600 text-white" onClick={handleDownload}>Download PDF</IOSButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
