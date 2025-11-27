'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  X, Calendar, Clock, Users, MapPin,
  FileText, Save
} from 'lucide-react';
import { toast } from 'sonner';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface EventData {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  attendees: number;
  notes: string;
  type: 'meeting' | 'event' | 'reservation';
}

export function EventModal({ isOpen, onClose }: EventModalProps): JSX.Element | null {
  const [eventData, setEventData] = useState<EventData>({
    title: '',
    date: '',
    startTime: '',
    endTime: '',
    location: '',
    attendees: 0,
    notes: '',
    type: 'event'
  });

  const handleInputChange = (field: keyof EventData, value: string | number) => {
    setEventData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    try {
      // Validate required fields
      if (!eventData.title || !eventData.date || !eventData.startTime || !eventData.endTime) {
        toast.error('Please fill in all required fields');
        return;
      }

      // TODO: Implement API call
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData)
      });

      if (!response.ok) throw new Error('Failed to create event');
      
      toast.success('Event created successfully!');
      onClose();
    } catch (error) {
      toast.error('Failed to create event');
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="bg-white rounded-xl p-6 max-w-lg w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Add New Event</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Event Type */}
          <div>
            <label className="block text-sm text-gray-700 mb-1">
              Event Type*
            </label>
            <select
              value={eventData.type}
              onChange={(e) => handleInputChange('type', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="meeting">Meeting</option>
              <option value="event">Event</option>
              <option value="reservation">Reservation</option>
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm text-gray-700 mb-1">
              Title*
            </label>
            <input
              type="text"
              value={eventData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              placeholder="Enter event title"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-700 mb-1">
                Date*
              </label>
              <input
                type="date"
                value={eventData.date}
                onChange={(e) => handleInputChange('date', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">
                Start Time*
              </label>
              <input
                type="time"
                value={eventData.startTime}
                onChange={(e) => handleInputChange('startTime', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">
                End Time*
              </label>
              <input
                type="time"
                value={eventData.endTime}
                onChange={(e) => handleInputChange('endTime', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>

          {/* Location and Attendees */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-700 mb-1">
                Location
              </label>
              <input
                type="text"
                value={eventData.location}
                onChange={(e) => handleInputChange('location', e.target.value)}
                placeholder="Enter location"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">
                Number of Attendees
              </label>
              <input
                type="number"
                value={eventData.attendees}
                onChange={(e) => handleInputChange('attendees', parseInt(e.target.value) || 0)}
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={eventData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder="Add any additional notes or details"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end pt-4 border-t">
            <button
              onClick={handleSubmit}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              Save Event
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
