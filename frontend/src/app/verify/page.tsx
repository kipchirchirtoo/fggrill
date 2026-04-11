'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { staffAPI } from '@/lib/api';
import {
  CheckCircle, XCircle, Loader2, ShieldCheck,
  User, Mail, Phone, Calendar, Building2, CreditCard, AlertTriangle
} from 'lucide-react';
import Image from 'next/image';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

function formatRole(raw: string): string {
  if (!raw) return 'Employee';
  return raw
    .replace(/kyogong_/gi, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
}

function VerifyContent() {
  const searchParams = useSearchParams();
  const idParam = searchParams.get('id');

  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (idParam) verify(idParam);
    else { setError('No ID provided'); setLoading(false); }
  }, [idParam]);

  const verify = async (id: string) => {
    try {
      setLoading(true);
      const res = await staffAPI.getStaffMember(id);
      if (res.success && res.data) {
        const s = res.data;
        setStaff({
          ...s,
          first_name:    s.first_name    || s.user?.first_name    || '',
          last_name:     s.last_name     || s.user?.last_name     || '',
          email:         s.email         || s.user?.email         || '',
          phone:         s.phone         || s.user?.phone_number  || '',
          position:      s.position      || s.role                || '',
          profile_photo: s.profile_photo || s.user?.avatar        || null,
          id_number:     s.id_number     || s.employee_id         || '',
          national_id:   s.national_id   || '',
          department:    s.department    || '',
          status:        s.status        || 'active',
          start_date:    s.start_date    || null,
        });
      } else {
        setError('Staff member not found');
      }
    } catch (e: any) {
      setError(e.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-start py-10 px-4">

      {/* ── Brand Header ── */}
      <div className="flex flex-col items-center gap-3 mb-8">
        <div className="w-16 h-16 rounded-2xl bg-stone-900 flex items-center justify-center shadow-lg overflow-hidden">
          <Image src="/fglogo.png" alt="FamousGate Hotels" width={44} height={44}
            className="object-cover scale-150" style={{ objectPosition: 'center 30%' }} />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-black text-stone-900">FamousGate Hotels</h1>
          <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mt-0.5">
            Employee ID Verification
          </p>
        </div>
      </div>

      {/* ── Card ── */}
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-sm border border-stone-200 overflow-hidden">

        {/* Loading */}
        {loading && (
          <div className="py-16 flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-stone-400" />
            <p className="text-sm font-bold text-stone-400 uppercase tracking-widest">Verifying...</p>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <>
            <div className="bg-red-600 px-6 py-8 flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
                <XCircle className="w-9 h-9 text-white" />
              </div>
              <h2 className="text-xl font-black text-white">Invalid ID</h2>
              <p className="text-red-100 text-sm text-center">
                This identification card could not be verified in our system.
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div className="border-l-4 border-amber-400 bg-amber-50 rounded-r-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <p className="text-xs font-black text-amber-800 uppercase tracking-wide">Lost & Found Protocol</p>
                </div>
                <p className="text-sm text-amber-900">
                  If this card is found, please return it to the nearest police station or contact our emergency hotline.
                </p>
              </div>

              <div className="bg-stone-50 rounded-2xl p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <Phone className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Emergency Hotline</p>
                  <p className="text-lg font-black text-stone-900">0706 782 828</p>
                </div>
              </div>
            </div>

            <div className="border-t border-stone-100 px-6 py-5 space-y-1.5">
              <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest text-center mb-3">Terms of Use</p>
              {['Property of FamousGate Hotels. Not transferable.',
                'Visible wear mandatory while on duty.',
                'Unauthorized use is a punishable offense.'].map(t => (
                <p key={t} className="text-xs text-stone-500 text-center">{t}</p>
              ))}
            </div>
          </>
        )}

        {/* Success */}
        {!loading && !error && staff && (
          <>
            {/* Green header */}
            <div className="bg-gradient-to-br from-emerald-500 to-green-600 px-6 py-8 flex flex-col items-center gap-4">
              {/* Photo */}
              <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white/40 shadow-lg bg-white/20">
                {staff.profile_photo ? (
                  <img
                    src={`${SUPABASE_URL}/storage/v1/object/public/profile/${staff.profile_photo}`}
                    alt={`${staff.first_name} ${staff.last_name}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User className="w-12 h-12 text-white/60" />
                  </div>
                )}
              </div>

              <div className="text-center">
                <h2 className="text-2xl font-black text-white uppercase">
                  {staff.first_name} {staff.last_name}
                </h2>
                <p className="text-green-100 text-xs font-black uppercase tracking-widest mt-1">
                  {formatRole(staff.position)}
                </p>
              </div>

              <div className="flex items-center gap-2 bg-white/20 rounded-full px-4 py-1.5">
                <CheckCircle className="w-4 h-4 text-white" />
                <span className="text-white text-xs font-black uppercase tracking-wide">Verified Employee</span>
              </div>
            </div>

            {/* Details */}
            <div className="p-6 space-y-4">

              {/* ID Info */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: ShieldCheck, label: 'Staff ID',    value: staff.id_number || '—' },
                  { icon: CreditCard,  label: 'National ID', value: staff.national_id || '—' },
                  { icon: Building2,   label: 'Department',  value: staff.department?.replace(/_/g, ' ') || '—' },
                  { icon: Calendar,    label: 'Joined',      value: staff.start_date ? new Date(staff.start_date).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—' },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="bg-stone-50 rounded-2xl p-3.5">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Icon className="w-3 h-3 text-stone-400" />
                      <p className="text-[9px] font-black text-stone-400 uppercase tracking-widest">{label}</p>
                    </div>
                    <p className="text-sm font-black text-stone-900 capitalize">{value}</p>
                  </div>
                ))}
              </div>

              {/* Status badge */}
              <div className={`rounded-2xl px-4 py-3 flex items-center gap-3 ${
                staff.status === 'active' ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'
              }`}>
                <div className={`w-2.5 h-2.5 rounded-full ${staff.status === 'active' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                <p className={`text-sm font-black uppercase ${staff.status === 'active' ? 'text-emerald-700' : 'text-red-700'}`}>
                  {staff.status === 'active' ? 'Active Employee' : staff.status}
                </p>
              </div>

              {/* Contact */}
              <div className="space-y-2">
                {staff.email && (
                  <div className="flex items-center gap-3 bg-stone-50 rounded-2xl px-4 py-3">
                    <Mail className="w-4 h-4 text-stone-400 flex-shrink-0" />
                    <p className="text-sm font-bold text-stone-700 truncate">{staff.email}</p>
                  </div>
                )}
                {staff.phone && (
                  <div className="flex items-center gap-3 bg-stone-50 rounded-2xl px-4 py-3">
                    <Phone className="w-4 h-4 text-stone-400 flex-shrink-0" />
                    <p className="text-sm font-bold text-stone-700">{staff.phone}</p>
                  </div>
                )}
              </div>

              {/* Timestamp */}
              <p className="text-center text-[10px] text-stone-400 font-bold uppercase tracking-widest pt-1">
                Verified · {new Date().toLocaleDateString('en-KE', { dateStyle: 'medium' })} · {new Date().toLocaleTimeString()}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <p className="mt-8 text-[10px] text-stone-400 font-bold uppercase tracking-widest text-center">
        © {new Date().getFullYear()} FamousGate Hotels · Security & Verification System
      </p>
    </div>
  );
}

export default function VerifyIDPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-stone-400" />
      </div>
    }>
      <VerifyContent />
    </Suspense>
  );
}
