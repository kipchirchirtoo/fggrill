'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { X, Loader2, Save } from 'lucide-react';
import { IOSButton } from '@/components/ui/ios-button';

interface ServiceFormModalProps {
    service?: any;
    onClose: () => void;
    onSaved: () => void;
}

const SERVICE_TYPES = [
    { code: 'spa', name: 'Spa' },
    { code: 'executive-bar', name: 'Executive Bar' },
    { code: 'sports-bar', name: 'Sports Bar' },
    { code: 'reception', name: 'Reception' },
];

const PRICING_MODELS = [
    { code: 'fixed', name: 'Fixed Price' },
    { code: 'hourly', name: 'Hourly Rate' },
];

export function ServiceFormModal({ service, onClose, onSaved }: ServiceFormModalProps) {
    const [name, setName] = useState(service?.name || '');
    const [serviceType, setServiceType] = useState(service?.service_type || 'spa');
    const [pricingModel, setPricingModel] = useState(service?.pricing_model || 'fixed');
    const [basePrice, setBasePrice] = useState(service?.base_price?.toString() || '');
    const [pricePerHour, setPricePerHour] = useState(service?.price_per_hour?.toString() || '');
    const [isActive, setIsActive] = useState(service ? service.is_active : true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !basePrice) {
            toast.error('Name and base price are required');
            return;
        }

        setIsSubmitting(true);
        try {
            const token = localStorage.getItem('token');
            const url = service
                ? `${process.env.NEXT_PUBLIC_API_URL}/api/kyogong/dynamic-services/${service.id}`
                : `${process.env.NEXT_PUBLIC_API_URL}/api/kyogong/dynamic-services`;

            const method = service ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    name,
                    service_type: serviceType,
                    pricing_model: pricingModel,
                    base_price: parseFloat(basePrice),
                    price_per_hour: pricePerHour ? parseFloat(pricePerHour) : undefined,
                    is_active: isActive
                })
            });

            const data = await res.json();
            if (data.success) {
                toast.success(service ? 'Service updated' : 'Service created');
                onSaved();
                onClose();
            } else {
                toast.error(data.error || 'Failed to save service');
            }
        } catch (error) {
            console.error('Error saving service:', error);
            toast.error('Error saving service');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <h3 className="text-xl font-bold text-gray-900">
                        {service ? 'Edit Service' : 'Add New Service'}
                    </h3>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Service Name *</label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className="w-full rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500 transition-shadow"
                            placeholder="e.g. Full Body Massage"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Service Type *</label>
                            <select
                                value={serviceType}
                                onChange={e => setServiceType(e.target.value)}
                                className="w-full rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500 transition-shadow"
                            >
                                {SERVICE_TYPES.map(t => <option key={t.code} value={t.code}>{t.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Pricing Model *</label>
                            <select
                                value={pricingModel}
                                onChange={e => setPricingModel(e.target.value)}
                                className="w-full rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500 transition-shadow"
                            >
                                {PRICING_MODELS.map(m => <option key={m.code} value={m.code}>{m.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Base Price (KES) *</label>
                            <input
                                type="number"
                                value={basePrice}
                                onChange={e => setBasePrice(e.target.value)}
                                className="w-full rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500 transition-shadow"
                                placeholder="0.00"
                                required
                            />
                        </div>
                        {pricingModel === 'hourly' && (
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Price Per Hour</label>
                                <input
                                    type="number"
                                    value={pricePerHour}
                                    onChange={e => setPricePerHour(e.target.value)}
                                    className="w-full rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500 transition-shadow"
                                    placeholder="0.00"
                                />
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-3 py-2">
                        <input
                            type="checkbox"
                            id="isActive"
                            checked={isActive}
                            onChange={e => setIsActive(e.target.checked)}
                            className="w-5 h-5 text-blue-600 rounded-lg border-gray-300 focus:ring-blue-500"
                        />
                        <label htmlFor="isActive" className="text-sm font-medium text-gray-700 select-none cursor-pointer">
                            This service is currently active
                        </label>
                    </div>

                    <div className="pt-4">
                        <IOSButton
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full h-12 text-base shadow-lg shadow-blue-100"
                            leftIcon={isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                        >
                            {isSubmitting ? 'Saving Changes...' : (service ? 'Update Service' : 'Create Service')}
                        </IOSButton>
                    </div>
                </form>
            </div>
        </div>
    );
}
