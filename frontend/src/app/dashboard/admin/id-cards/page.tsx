
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { userAPI, idCardsAPI } from '@/lib/api';
import { toast } from 'sonner';
import {
    User as UserIcon, Loader2, Download, Eye,
    Upload, Search, Filter, Printer, RefreshCw,
    UserCircle, ShieldCheck, Mail, Phone, Calendar
} from 'lucide-react';
import { IOSButton } from '@/components/ui/ios-button';
import { Input } from '@/components/ui/input';
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import Image from 'next/image';
import { cn } from '@/lib/utils';

export default function IDCardsManagementPage() {
    const { user: currentUser } = useAuth();
    const [employees, setEmployees] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedBranch, setSelectedBranch] = useState('all');

    // Preview modal
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [previewEmployee, setPreviewEmployee] = useState<any>(null);
    const [isPreviewLoading, setIsPreviewLoading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    // Photo Upload
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [uploadEmployee, setUploadEmployee] = useState<any>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    useEffect(() => {
        fetchEmployees();
    }, []);

    const fetchEmployees = async () => {
        setIsLoading(true);
        try {
            const res = await userAPI.getUsers();
            if (res.success) {
                // Filter only staff/employees for this view usually, 
                // but for Super Admin we might show all except maybe other super admins?
                // Request says "all employees and staff"
                setEmployees(res.data || []);
            }
        } catch (error) {
            toast.error('Failed to load employees');
        } finally {
            setIsLoading(true); // wait, should be false
            setIsLoading(false);
        }
    };

    const handlePreview = async (emp: any) => {
        setPreviewEmployee(emp);
        setIsPreviewOpen(true);
        setIsPreviewLoading(true);
        setPreviewUrl(null);

        try {
            const data = {
                name: `${emp.first_name} ${emp.last_name}`,
                role: emp.role?.replace('_', ' ').toUpperCase() || 'EMPLOYEE',
                id_no: emp.employee_id || emp.id.substring(0, 8).toUpperCase(),
                email: emp.email,
                phone: emp.phone_number || 'N/A',
                join_date: emp.join_date ? new Date(emp.join_date).toLocaleDateString() : 'N/A',
                expire_date: '31/12/2026', // Placeholder expiry
                photo_url: emp.profile_photo // Assuming backend serves this
            };

            const blob = await idCardsAPI.preview(data);
            const url = URL.createObjectURL(blob);
            setPreviewUrl(url);
        } catch (error) {
            toast.error('Failed to generate preview');
            setIsPreviewOpen(false);
        } finally {
            setIsPreviewLoading(false);
        }
    };

    const handleDownload = async (emp: any) => {
        const loadingToast = toast.loading(`Generating ID for ${emp.first_name}...`);
        try {
            const data = {
                name: `${emp.first_name} ${emp.last_name}`,
                role: emp.role?.replace('_', ' ').toUpperCase() || 'EMPLOYEE',
                id_no: emp.employee_id || emp.id.substring(0, 8).toUpperCase(),
                email: emp.email,
                phone: emp.phone_number || 'N/A',
                join_date: emp.join_date ? new Date(emp.join_date).toLocaleDateString() : 'N/A',
                expire_date: '31/12/2026',
                photo_url: emp.profile_photo
            };

            const blob = await idCardsAPI.generate(data);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ID_${emp.first_name}_${emp.last_name}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast.success('ID Card downloaded successfully', { id: loadingToast });
        } catch (error) {
            toast.error('Generation failed', { id: loadingToast });
        }
    };

    const handlePhotoUpload = async () => {
        if (!selectedFile || !uploadEmployee) return;

        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append('photo', selectedFile);

            // Note: need to ensure userAPI.uploadProfilePhoto supports ID param if not 'me'
            // I'll update the API call to support passing ID
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/users/${uploadEmployee.id}/photo`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                body: formData
            }).then(r => r.json());

            if (res.success) {
                toast.success('Photo updated!');
                setIsUploadOpen(false);
                fetchEmployees();
            } else {
                throw new Error(res.message);
            }
        } catch (error: any) {
            toast.error(error.message || 'Upload failed');
        } finally {
            setIsUploading(false);
        }
    };

    const filteredEmployees = employees.filter(emp => {
        const name = `${emp.first_name} ${emp.last_name}`.toLowerCase();
        const matchesSearch = name.includes(searchQuery.toLowerCase()) ||
            emp.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            emp.employee_id?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesBranch = selectedBranch === 'all' || emp.branch_id === Number(selectedBranch);
        return matchesSearch && matchesBranch;
    });

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-stone-900 flex items-center gap-3">
                        <ShieldCheck className="w-10 h-10 text-blue-600" />
                        ID Card Management
                    </h1>
                    <p className="text-stone-500 font-medium mt-1">Generate and manage official employee identification</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchEmployees}
                        className="p-2.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 transition-all text-stone-500"
                    >
                        <RefreshCw className={cn("w-5 h-5", isLoading && "animate-spin")} />
                    </button>
                    <IOSButton variant="primary" className="gap-2">
                        <Printer className="w-4 h-4" />
                        Batch Print
                    </IOSButton>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-stone-100 flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                    <Input
                        placeholder="Search by name, ID or email..."
                        className="pl-10 h-11 bg-stone-50/50 border-none rounded-xl"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-3">
                    <Filter className="w-4 h-4 text-stone-400" />
                    <select
                        className="bg-stone-50/50 border-none rounded-xl h-11 px-4 text-sm font-bold text-stone-600 focus:ring-0"
                        value={selectedBranch}
                        onChange={(e) => setSelectedBranch(e.target.value)}
                    >
                        <option value="all">All Branches</option>
                        {/* Branches would be fetched here */}
                    </select>
                </div>
            </div>

            {/* Employee Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {isLoading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="h-64 bg-white rounded-3xl border border-stone-100 animate-pulse" />
                    ))
                ) : filteredEmployees.length === 0 ? (
                    <div className="col-span-full py-20 text-center">
                        <UserCircle className="w-16 h-16 text-stone-100 mx-auto mb-4" />
                        <p className="text-stone-400 font-bold">No employees found</p>
                    </div>
                ) : (
                    filteredEmployees.map((emp) => (
                        <div
                            key={emp.id}
                            className="bg-white rounded-3xl border border-stone-200 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all group"
                        >
                            <div className="p-5 flex flex-col items-center text-center space-y-4">
                                <div className="relative">
                                    <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-stone-50 shadow-inner bg-stone-100">
                                        {emp.profile_photo ? (
                                            <img src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/profile-photos/${emp.profile_photo}`} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-stone-300">
                                                <UserIcon className="w-10 h-10" />
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => { setUploadEmployee(emp); setIsUploadOpen(true); }}
                                        className="absolute bottom-0 right-0 p-2 bg-blue-600 text-white rounded-full shadow-lg hover:scale-110 transition-all opacity-0 group-hover:opacity-100"
                                    >
                                        <Upload className="w-3.5 h-3.5" />
                                    </button>
                                </div>

                                <div>
                                    <h3 className="font-extrabold text-stone-900 text-lg leading-tight uppercase">
                                        {emp.first_name} {emp.last_name}
                                    </h3>
                                    <p className="text-blue-600 text-xs font-black uppercase tracking-widest mt-1">
                                        {emp.role?.replace('_', ' ')}
                                    </p>
                                </div>

                                <div className="w-full bg-stone-50 rounded-2xl p-3 space-y-2 text-left">
                                    <div className="flex items-center gap-2 text-[10px] font-bold text-stone-500 uppercase">
                                        <ShieldCheck className="w-3 h-3" />
                                        ID: {emp.employee_id || 'NOT SET'}
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] font-bold text-stone-500 uppercase">
                                        <Mail className="w-3 h-3 text-stone-300" />
                                        {emp.email}
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] font-bold text-stone-500 uppercase">
                                        <Calendar className="w-3 h-3 text-stone-300" />
                                        Joined: {emp.join_date ? new Date(emp.join_date).toLocaleDateString() : 'N/A'}
                                    </div>
                                </div>
                            </div>

                            <div className="p-3 bg-stone-50/50 border-t border-stone-100 grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => handlePreview(emp)}
                                    className="flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-white border border-stone-200 text-xs font-black text-stone-600 hover:bg-stone-100 transition-all"
                                >
                                    <Eye className="w-3.5 h-3.5" />
                                    Preview
                                </button>
                                <button
                                    onClick={() => handleDownload(emp)}
                                    className="flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-blue-600 text-white text-xs font-black hover:bg-blue-700 transition-all shadow-md shadow-blue-200"
                                >
                                    <Download className="w-3.5 h-3.5" />
                                    Generate
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Preview Modal */}
            <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>ID Card Preview</DialogTitle>
                        <DialogDescription>
                            Review the ID card before downloading or printing.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex items-center justify-center p-8 bg-stone-100 rounded-3xl min-h-[400px]">
                        {isPreviewLoading ? (
                            <div className="flex flex-col items-center gap-4">
                                <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
                                <p className="text-sm font-black text-stone-400 uppercase tracking-widest">Generating Card...</p>
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
                        <IOSButton
                            className="bg-blue-600 text-white"
                            onClick={() => previewEmployee && handleDownload(previewEmployee)}
                        >
                            Download PDF
                        </IOSButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Photo Upload Modal */}
            <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Update Employee Photo</DialogTitle>
                        <DialogDescription>
                            Upload a high-quality portrait for {uploadEmployee?.first_name}'s ID card.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-6 space-y-4">
                        <div
                            className="border-2 border-dashed border-stone-200 rounded-3xl p-10 text-center hover:border-blue-400 transition-all cursor-pointer bg-stone-50"
                            onClick={() => document.getElementById('photo-input')?.click()}
                        >
                            {selectedFile ? (
                                <div className="space-y-2">
                                    <Eye className="w-10 h-10 text-blue-500 mx-auto" />
                                    <p className="text-sm font-bold text-stone-900">{selectedFile.name}</p>
                                    <p className="text-xs text-stone-400">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <Upload className="w-10 h-10 text-stone-200 mx-auto" />
                                    <p className="text-sm font-bold text-stone-400">Click to select or drag photo</p>
                                    <p className="text-xs text-stone-300">JPG, PNG up to 5MB</p>
                                </div>
                            )}
                        </div>
                        <input
                            id="photo-input"
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                        />
                    </div>
                    <DialogFooter>
                        <IOSButton onClick={() => { setIsUploadOpen(false); setSelectedFile(null); }} variant="secondary">Cancel</IOSButton>
                        <IOSButton
                            className="bg-blue-600 text-white"
                            onClick={handlePhotoUpload}
                            disabled={!selectedFile || isUploading}
                        >
                            {isUploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            {isUploading ? 'Uploading...' : 'Save Photo'}
                        </IOSButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

