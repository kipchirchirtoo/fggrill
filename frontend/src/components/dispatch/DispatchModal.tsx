'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { IOSButton } from '../ui/ios-button';
import { centralOperationsAPI } from '@/lib/branch-api';
import { toast } from 'sonner';

interface DispatchModalProps {
    isOpen: boolean;
    onClose: () => void;
    requestId: string;
    requestNumber: string;
    onSuccess: () => void;
}

interface Vehicle {
    id: string;
    registration_number: string;
    type: string;
}

interface Driver {
    id: string;
    name: string;
    phone: string;
}

export function DispatchModal({ isOpen, onClose, requestId, requestNumber, onSuccess }: DispatchModalProps) {
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [drivers, setDrivers] = useState<Driver[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isManualVehicle, setIsManualVehicle] = useState(false);
    const [isManualDriver, setIsManualDriver] = useState(false);
    const [formData, setFormData] = useState({
        vehicle_number: '',
        driver_name: '',
        driver_phone: '',
        estimated_delivery: '',
        dispatch_notes: ''
    });

    useEffect(() => {
        if (isOpen) {
            fetchVehiclesAndDrivers();
        }
    }, [isOpen]);

    const fetchVehiclesAndDrivers = async () => {
        try {
            // Fetch vehicles and drivers from API
            const [vehiclesRes, driversRes] = await Promise.all([
                centralOperationsAPI.getVehicles(),
                centralOperationsAPI.getDrivers()
            ]);

            if (vehiclesRes.success) {
                setVehicles(vehiclesRes.data || []);
            }
            if (driversRes.success) {
                setDrivers(driversRes.data || []);
            }
        } catch (error) {
            console.error('Error fetching vehicles/drivers:', error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const response = await centralOperationsAPI.createDispatch({
                request_id: requestId,
                ...formData
            });

            if (response.success) {
                toast.success('Dispatch created successfully');
                onSuccess();
                onClose();
            } else {
                toast.error(response.message || 'Failed to create dispatch');
            }
        } catch (error) {
            console.error('Error creating dispatch:', error);
            toast.error('Failed to create dispatch');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900">Create Dispatch</h2>
                        <p className="text-sm text-gray-500 mt-1">Request: {requestNumber}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Vehicle Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Vehicle <span className="text-red-500">*</span>
                        </label>
                        <select
                            required
                            value={isManualVehicle ? 'manual' : formData.vehicle_number}
                            onChange={(e) => {
                                if (e.target.value === 'manual') {
                                    setIsManualVehicle(true);
                                    setFormData({ ...formData, vehicle_number: '' });
                                } else {
                                    setIsManualVehicle(false);
                                    setFormData({ ...formData, vehicle_number: e.target.value });
                                }
                            }}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="">Select a vehicle</option>
                            {vehicles.map((vehicle) => (
                                <option key={vehicle.id} value={vehicle.registration_number}>
                                    {vehicle.registration_number} - {vehicle.type}
                                </option>
                            ))}
                            <option value="manual">Enter manually</option>
                        </select>
                        {isManualVehicle && (
                            <input
                                type="text"
                                required
                                placeholder="Enter vehicle registration number"
                                value={formData.vehicle_number}
                                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent mt-2"
                                onChange={(e) => setFormData({ ...formData, vehicle_number: e.target.value })}
                            />
                        )}
                    </div>

                    {/* Driver Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Driver <span className="text-red-500">*</span>
                        </label>
                        <select
                            required
                            value={isManualDriver ? 'manual' : formData.driver_name}
                            onChange={(e) => {
                                if (e.target.value === 'manual') {
                                    setIsManualDriver(true);
                                    setFormData({ ...formData, driver_name: '', driver_phone: '' });
                                } else {
                                    setIsManualDriver(false);
                                    const driver = drivers.find(d => d.name === e.target.value);
                                    setFormData({
                                        ...formData,
                                        driver_name: e.target.value,
                                        driver_phone: driver?.phone || ''
                                    });
                                }
                            }}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="">Select a driver</option>
                            {drivers.map((driver) => (
                                <option key={driver.id} value={driver.name}>
                                    {driver.name} - {driver.phone}
                                </option>
                            ))}
                            <option value="manual">Enter manually</option>
                        </select>
                    </div>

                    {/* Manual Driver Entry */}
                    {isManualDriver && (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Driver Name
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.driver_name}
                                    placeholder="Enter driver name"
                                    onChange={(e) => setFormData({ ...formData, driver_name: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Driver Phone
                                </label>
                                <input
                                    type="tel"
                                    required
                                    value={formData.driver_phone}
                                    placeholder="Enter phone number"
                                    onChange={(e) => setFormData({ ...formData, driver_phone: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                        </div>
                    )}

                    {/* Estimated Delivery */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Estimated Delivery Date
                        </label>
                        <input
                            type="datetime-local"
                            value={formData.estimated_delivery}
                            onChange={(e) => setFormData({ ...formData, estimated_delivery: e.target.value })}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Dispatch Notes
                        </label>
                        <textarea
                            rows={3}
                            value={formData.dispatch_notes}
                            onChange={(e) => setFormData({ ...formData, dispatch_notes: e.target.value })}
                            placeholder="Add any special instructions or notes..."
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end space-x-3 pt-4">
                        <IOSButton
                            type="button"
                            variant="ghost"
                            onClick={onClose}
                            disabled={isLoading}
                        >
                            Cancel
                        </IOSButton>
                        <IOSButton
                            type="submit"
                            variant="primary"
                            disabled={isLoading}
                        >
                            {isLoading ? 'Creating...' : 'Create Dispatch'}
                        </IOSButton>
                    </div>
                </form>
            </div>
        </div>
    );
}
