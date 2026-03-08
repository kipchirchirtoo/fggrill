import Head from 'next/head';
import { useState, useEffect } from 'react';
import { Header, Footer } from '@/components/layout';
import { bookingService } from '@/services/booking.service';
import { hotelsService } from '@/services/hotels.service';
import { ImageGallery } from '@/components/gallery/ImageGallery';
import { GALLERY_IMAGES } from '@/config/galleryImages';
import toast, { Toaster } from 'react-hot-toast';

interface Room {
  id: string;
  room_number: string;
  status: string;
  type_id: string;
  branch_id: number;
  type?: {
    id: string;
    name: string;
    description?: string;
    base_price: number;
    max_occupancy?: number;
  };
}

interface Branch {
  id: number;
  name: string;
  location?: string;
}

export default function ReservationsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showGallery, setShowGallery] = useState(false);

  // Load branches on mount
  useEffect(() => {
    loadBranches();
  }, []);

  // Load rooms when dates are selected
  useEffect(() => {
    if (checkIn && checkOut) {
      searchRooms();
    } else {
      loadAllRooms();
    }
  }, [checkIn, checkOut, selectedBranch]);

  const loadBranches = async () => {
    try {
      const branchesData = await hotelsService.fetchBranches();
      setBranches(branchesData);
    } catch (error) {
      console.error('Error loading branches:', error);
      toast.error('Failed to load hotel branches');
    }
  };

  const loadAllRooms = async () => {
    try {
      setLoading(true);
      // Get default dates (today + 7 days)
      const today = new Date();
      const nextWeek = new Date(today);
      nextWeek.setDate(nextWeek.getDate() + 7);
      
      const defaultCheckIn = today.toISOString().split('T')[0];
      const defaultCheckOut = nextWeek.toISOString().split('T')[0];

      const availableRooms = await bookingService.searchAvailableRooms({
        checkIn: defaultCheckIn,
        checkOut: defaultCheckOut,
        branch_id: selectedBranch || undefined
      });
      
      setRooms(availableRooms);
    } catch (error) {
      console.error('Error loading rooms:', error);
      toast.error('Failed to load rooms');
    } finally {
      setLoading(false);
    }
  };

  const searchRooms = async () => {
    try {
      setLoading(true);
      const availableRooms = await bookingService.searchAvailableRooms({
        checkIn,
        checkOut,
        branch_id: selectedBranch || undefined
      });
      
      setRooms(availableRooms);
      
      if (availableRooms.length === 0) {
        toast.error('No rooms available for selected dates');
      }
    } catch (error) {
      console.error('Error searching rooms:', error);
      toast.error('Failed to search rooms');
    } finally {
      setLoading(false);
    }
  };

  const handleViewRoom = (room: Room) => {
    setSelectedRoom(room);
    setShowGallery(true);
  };

  const handleReserveRoom = (room: Room) => {
    if (!checkIn || !checkOut) {
      toast.error('Please select check-in and check-out dates first');
      return;
    }
    setSelectedRoom(room);
    setShowBookingModal(true);
  };

  return (
    <>
      <Head>
        <title>Room Reservations - FamousGate Hotels</title>
        <meta name="description" content="Browse and reserve luxury rooms at FamousGate Hotels" />
      </Head>

      <Toaster position="top-right" />
      <Header />

      <main className="lp-main">
        {/* Hero Section */}
        <section className="lp-hero" style={{ minHeight: '40vh', background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)' }}>
          <div className="lp-hero-content" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
            <h1 style={{ fontSize: '3rem', fontWeight: 'bold', color: '#fff', marginBottom: '1rem' }}>
              Reserve Your Perfect Room
            </h1>
            <p style={{ fontSize: '1.25rem', color: '#d4af37', maxWidth: '600px', margin: '0 auto' }}>
              Discover luxury accommodations tailored to your needs
            </p>
          </div>
        </section>

        {/* Search Section */}
        <section style={{ padding: '3rem 2rem', background: '#f8f8f8' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ background: 'white', padding: '2rem', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
              <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', color: '#1a1a1a' }}>Search Available Rooms</h2>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Check-in Date</label>
                  <input
                    type="date"
                    value={checkIn}
                    onChange={(e) => setCheckIn(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    style={{ width: '100%', padding: '0.75rem', border: '1px solid #ddd', borderRadius: '6px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Check-out Date</label>
                  <input
                    type="date"
                    value={checkOut}
                    onChange={(e) => setCheckOut(e.target.value)}
                    min={checkIn || new Date().toISOString().split('T')[0]}
                    style={{ width: '100%', padding: '0.75rem', border: '1px solid #ddd', borderRadius: '6px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Hotel Branch</label>
                  <select
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value)}
                    style={{ width: '100%', padding: '0.75rem', border: '1px solid #ddd', borderRadius: '6px' }}
                  >
                    <option value="">All Branches</option>
                    {branches.map(branch => (
                      <option key={branch.id} value={branch.id}>{branch.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Rooms Grid */}
        <section style={{ padding: '3rem 2rem' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '2rem', marginBottom: '2rem', textAlign: 'center' }}>
              {loading ? 'Loading Rooms...' : `Available Rooms (${rooms.length})`}
            </h2>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '3rem' }}>
                <div style={{ display: 'inline-block', width: '50px', height: '50px', border: '4px solid #f3f3f3', borderTop: '4px solid #d4af37', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              </div>
            ) : rooms.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', background: '#f8f8f8', borderRadius: '12px' }}>
                <p style={{ fontSize: '1.25rem', color: '#666' }}>No rooms available for selected criteria</p>
                <p style={{ marginTop: '1rem', color: '#999' }}>Try different dates or branch</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '2rem' }}>
                {rooms.map(room => (
                  <div
                    key={room.id}
                    style={{
                      background: 'white',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                      transition: 'transform 0.3s ease, box-shadow 0.3s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-4px)';
                      e.currentTarget.style.boxShadow = '0 8px 12px rgba(0,0,0,0.15)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
                    }}
                  >
                    {/* Room Image Placeholder */}
                    <div style={{ height: '200px', background: 'linear-gradient(135deg, #2d2d2d 0%, #1a1a1a 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: '3rem', color: '#d4af37' }}>🏨</span>
                    </div>

                    {/* Room Details */}
                    <div style={{ padding: '1.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                        <div>
                          <p style={{ fontSize: '0.875rem', color: '#d4af37', fontWeight: '600', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                            {room.type?.name || 'DELUXE'}
                          </p>
                          <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1a1a1a' }}>
                            Room {room.room_number}
                          </h3>
                        </div>
                        <span style={{ 
                          padding: '0.25rem 0.75rem', 
                          background: room.status === 'available' ? '#d4f4dd' : '#fff3cd',
                          color: room.status === 'available' ? '#0f5132' : '#856404',
                          borderRadius: '20px',
                          fontSize: '0.75rem',
                          fontWeight: '600'
                        }}>
                          {room.status}
                        </span>
                      </div>

                      <div style={{ marginBottom: '1.5rem' }}>
                        <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1a1a1a' }}>
                          KES {room.type?.base_price?.toLocaleString() || '8,000'}
                          <span style={{ fontSize: '0.875rem', fontWeight: 'normal', color: '#666' }}> / night</span>
                        </p>
                      </div>

                      {/* Amenities */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.5rem' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.875rem', color: '#666' }}>
                          ✦ King Bed
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.875rem', color: '#666' }}>
                          ✦ Free Wifi
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.875rem', color: '#666' }}>
                          ✦ Smart TV
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.875rem', color: '#666' }}>
                          ✦ Minibar
                        </span>
                      </div>

                      {/* Action Buttons */}
                      <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button
                          onClick={() => handleViewRoom(room)}
                          style={{
                            flex: 1,
                            padding: '0.75rem 1.5rem',
                            background: 'white',
                            color: '#d4af37',
                            border: '2px solid #d4af37',
                            borderRadius: '6px',
                            fontSize: '1rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#d4af37';
                            e.currentTarget.style.color = 'white';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'white';
                            e.currentTarget.style.color = '#d4af37';
                          }}
                        >
                          View Room
                        </button>
                        <button
                          onClick={() => handleReserveRoom(room)}
                          style={{
                            flex: 1,
                            padding: '0.75rem 1.5rem',
                            background: '#d4af37',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '1rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#c49d2f';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = '#d4af37';
                          }}
                        >
                          Reserve Now
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Image Gallery Modal */}
        <ImageGallery
          images={GALLERY_IMAGES}
          isOpen={showGallery}
          onClose={() => setShowGallery(false)}
          initialIndex={0}
        />

        {/* Room Details Modal */}
        {showBookingModal && selectedRoom && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '2rem'
            }}
            onClick={() => setShowBookingModal(false)}
          >
            <div
              style={{
                background: 'white',
                borderRadius: '12px',
                maxWidth: '600px',
                width: '100%',
                maxHeight: '90vh',
                overflow: 'auto',
                padding: '2rem'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.75rem', fontWeight: 'bold' }}>Room {selectedRoom.room_number}</h2>
                <button
                  onClick={() => setShowBookingModal(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '1.5rem',
                    cursor: 'pointer',
                    color: '#666'
                  }}
                >
                  ×
                </button>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <p style={{ fontSize: '1.125rem', color: '#d4af37', fontWeight: '600', marginBottom: '0.5rem' }}>
                  {selectedRoom.type?.name || 'DELUXE ROOM'}
                </p>
                <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1a1a1a' }}>
                  KES {selectedRoom.type?.base_price?.toLocaleString() || '8,000'}
                  <span style={{ fontSize: '1rem', fontWeight: 'normal', color: '#666' }}> / night</span>
                </p>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '0.75rem' }}>Room Features</h3>
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  <li style={{ padding: '0.5rem 0', borderBottom: '1px solid #eee' }}>✦ King Size Bed</li>
                  <li style={{ padding: '0.5rem 0', borderBottom: '1px solid #eee' }}>✦ Free High-Speed WiFi</li>
                  <li style={{ padding: '0.5rem 0', borderBottom: '1px solid #eee' }}>✦ Smart TV with Streaming</li>
                  <li style={{ padding: '0.5rem 0', borderBottom: '1px solid #eee' }}>✦ Minibar</li>
                  <li style={{ padding: '0.5rem 0', borderBottom: '1px solid #eee' }}>✦ En-suite Bathroom</li>
                  <li style={{ padding: '0.5rem 0', borderBottom: '1px solid #eee' }}>✦ Air Conditioning</li>
                  <li style={{ padding: '0.5rem 0' }}>✦ 24/7 Room Service</li>
                </ul>
              </div>

              {checkIn && checkOut && (
                <div style={{ background: '#f8f8f8', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
                  <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>Selected Dates:</p>
                  <p style={{ fontWeight: '600' }}>
                    {new Date(checkIn).toLocaleDateString()} - {new Date(checkOut).toLocaleDateString()}
                  </p>
                </div>
              )}

              <button
                onClick={() => handleReserveRoom(selectedRoom)}
                style={{
                  width: '100%',
                  padding: '1rem',
                  background: '#d4af37',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '1.125rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'background 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#c49d2f';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#d4af37';
                }}
              >
                Proceed to Booking
              </button>
            </div>
          </div>
        )}
      </main>

      <Footer />

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
