'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { ServiceFormModal } from '@/components/kyogong/ServiceFormModal';
import { toast } from 'sonner';
import { API_URL } from '@/lib/config';
import {
    Plus, Search, Filter, RefreshCw,
    Edit2, Trash2, Power, PowerOff,
    LayoutGrid, List, SlidersHorizontal
} from 'lucide-react';

interface DynamicService {
    id: number;
    service_type: string;
    name: string;
    pricing_model: string;
    base_price: number;
    price_per_hour: number;
    is_active: boolean;
    created_at: string;
}

export default function DynamicServicesPage() {
    const [services, setServices] = useState<DynamicService[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [showModal, setShowModal] = useState(false);
    const [editingService, setEditingService] = useState<any>(null);

    const fetchServices = useCallback(async () => {
        setIsLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/api/kyogong/dynamic-services`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setServices(data.data || []);
            }
        } catch (error) {
            console.error('Error fetching services:', error);
            toast.error('Failed to load services');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchServices();
    }, [fetchServices]);

    const handleToggleStatus = async (service: DynamicService) => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/api/kyogong/dynamic-services/${service.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ is_active: !service.is_active })
            });

            const data = await res.json();
            if (data.success) {
                toast.success(`Service ${service.is_active ? 'disabled' : 'enabled'}`);
                fetchServices();
            }
        } catch (error) {
            toast.error('Failed to update status');
        }
    };

    const filteredServices = services.filter(s => {
        const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = typeFilter === 'all' || s.service_type === typeFilter;
        return matchesSearch && matchesType;
    });

    return (
        <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
            <DashboardLayout>
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Kyogong Services</h1>
                            <p className="text-gray-500 font-medium">Manage available services for all sales points</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <IOSButton
                                variant="secondary"
                                onClick={fetchServices}
                                disabled={isLoading}
                                className="bg-white"
                            >
                                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                            </IOSButton>
                            <IOSButton onClick={() => { setEditingService(null); setShowModal(true); }} leftIcon={<Plus />}>
                                Add Service
                            </IOSButton>
                        </div>
                    </div>

                    {/* Filters Bar */}
                    <IOSCard className="p-4 bg-white/80 backdrop-blur-sm">
                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="flex-1 relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search services..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 h-10 rounded-xl border-gray-100 bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-blue-500 transition-all text-sm"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <Filter className="w-4 h-4 text-gray-400" />
                                <select
                                    value={typeFilter}
                                    onChange={e => setTypeFilter(e.target.value)}
                                    className="h-10 rounded-xl border-gray-100 bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-blue-500 transition-all text-sm"
                                >
                                    <option value="all">All Types</option>
                                    <option value="spa">Spa</option>
                                    <option value="executive-bar">Executive Bar</option>
                                    <option value="sports-bar">Sports Bar</option>
                                    <option value="reception">Reception</option>
                                </select>
                            </div>
                        </div>
                    </IOSCard>

                    {/* Services Grid/Table */}
                    <div className="space-y-3">
                        {isLoading ? (
                            <div className="py-20 flex flex-col items-center justify-center text-gray-400 gap-3">
                                <RefreshCw className="w-8 h-8 animate-spin" />
                                <p className="font-medium">Loading services...</p>
                            </div>
                        ) : filteredServices.length === 0 ? (
                            <div className="py-20 text-center bg-white rounded-3xl border border-dashed border-gray-200">
                                <SlidersHorizontal className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                                <h3 className="text-gray-900 font-bold text-lg">No services found</h3>
                                <p className="text-gray-500">Try adjusting your filters or search term</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {filteredServices.map(service => (
                                    <IOSCard key={service.id} className="group p-5 hover:border-blue-200 transition-all">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="p-2.5 rounded-2xl bg-blue-50 text-blue-600">
                                                <LayoutGrid className="w-5 h-5" />
                                            </div>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => { setEditingService(service); setShowModal(true); }}
                                                    className="p-2 hover:bg-gray-100 rounded-xl text-gray-600 hover:text-blue-600 transition-colors"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleToggleStatus(service)}
                                                    className={`p-2 hover:bg-gray-100 rounded-xl transition-colors ${service.is_active ? 'text-green-600' : 'text-gray-400'}`}
                                                >
                                                    {service.is_active ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
                                                </button>
                                            </div>
                                        </div>

                                        <div>
                                            <h3 className="font-bold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors line-clamp-1">{service.name}</h3>
                                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">{service.service_type.replace('-', ' ')}</p>

                                            <div className="flex items-end justify-between">
                                                <div>
                                                    <p className="text-[10px] font-bold text-gray-400 uppercase">Price</p>
                                                    <p className="text-lg font-black text-gray-900">
                                                        KES {service.base_price.toLocaleString()}
                                                        {service.pricing_model === 'hourly' && <span className="text-sm font-normal text-gray-500"> / hr</span>}
                                                    </p>
                                                </div>
                                                <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${service.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-400'}`}>
                                                    {service.is_active ? 'Active' : 'Inactive'}
                                                </div>
                                            </div>
                                        </div>
                                    </IOSCard>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {showModal && (
                    <ServiceFormModal
                        service={editingService}
                        onClose={() => setShowModal(false)}
                        onSaved={fetchServices}
                    />
                )}
            </DashboardLayout>
        </ProtectedRoute>
    );
}
