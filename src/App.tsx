/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, type FormEvent, type ChangeEvent } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc,
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';
import { 
  Wrench, 
  Truck, 
  Warehouse, 
  CheckCircle, 
  Clock, 
  Plus, 
  LogOut,
  ChevronRight,
  MapPin,
  Camera,
  History,
  LayoutDashboard,
  User as UserIcon,
  Settings,
  CircleDot,
  Upload,
  X,
  Search,
  Zap,
  Info,
  CreditCard,
  Bell,
  Moon,
  Globe,
  Shield,
  Headphones,
  ChevronLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { GoogleGenAI, Type } from "@google/genai";

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Types
type Role = 'customer' | 'technician' | 'admin';
type ServiceType = 'online' | 'offline';
type PartPreference = 'brand' | 'third-party';
type Status = 'pending' | 'transporting' | 'warehouse' | 'repairing' | 'ready' | 'completed';

interface RepairRequest {
  id: string;
  userId: string;
  customerName?: string;
  customerPhone?: string;
  vehicleName: string;
  rcNumber: string;
  vehiclePlate: string;
  make?: string;
  model?: string;
  year?: string;
  fuelType?: string;
  engineCapacity?: string;
  registrationDate?: string;
  description: string;
  status: Status;
  serviceType: ServiceType;
  partPreference: PartPreference;
  price?: number;
  servicePrice?: number;
  repairPrice?: number;
  oemPrice?: number;
  thirdPartyPrice?: number;
  parts?: { name: string, price?: number, sourcing: PartPreference }[];
  repairComplexity?: 'light' | 'heavy';
  photoUrl?: string;
  repairStartTime?: any;
  estimatedTiming?: string;
  rating?: number;
  createdAt: any;
  updatedAt: any;
}

interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: Role;
  phoneNumber?: string;
  rank?: string;
  headline?: string;
  aboutMe?: string;
  expertise?: string[];
  certifications?: string[];
  bioStatus?: string;
  serviceGuarantee?: string;
  isVerified?: boolean;
  isInsured?: boolean;
  liabilityAmount?: string;
  licenseNumber?: string;
  serviceNotes?: string;
}

type AppView = 'home' | 'slots' | 'repairs' | 'services' | 'profile' | 'details' | 'booking' | 
              'personal-info' | 'earnings' | 'payout' | 'shifts' | 'attendance' | 'documents' | 
              'app-settings' | 'terms' | 'permissions' | 'review-slots';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<AppView>('home');
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [selectedSlots, setSelectedSlots] = useState<any[]>([]);
  const [isShiftStarted, setIsShiftStarted] = useState(false);
  const [isMockAuthenticated, setIsMockAuthenticated] = useState(false);
  const [mockPhone, setMockPhone] = useState('');

  const [bookedSlots, setBookedSlots] = useState<any[]>([]);
  const [viewingDoc, setViewingDoc] = useState<string | null>(null);

  const [requests, setRequests] = useState<RepairRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<RepairRequest | null>(null);
  
  // Seed initial mock data for analysis
  useEffect(() => {
    if (requests.length === 0 && (profile?.role === 'technician' || isMockAuthenticated)) {
      const mockRequests: RepairRequest[] = [
        {
          id: 'REQ-DEMO-001',
          userId: 'demo-user',
          customerName: 'Rahul Sharma',
          customerPhone: '9876543210',
          vehicleName: 'Mahindra XUV700',
          rcNumber: 'TS07HE1234',
          vehiclePlate: 'TS 07 HE 1234',
          make: 'Mahindra',
          model: 'XUV700',
          year: '2023',
          fuelType: 'Diesel',
          description: 'Engine making rattling noise and brake pads feel soft.',
          status: 'repairing',
          serviceType: 'offline',
          partPreference: 'brand',
          price: 4500,
          repairPrice: 1500,
          servicePrice: 500,
          parts: [
            { name: 'Brake Pads (Front)', price: 2500, sourcing: 'brand' }
          ],
          repairStartTime: new Date(Date.now() - 3600000), // Started 1 hour ago
          createdAt: new Date(Date.now() - 86400000), // Created yesterday
          updatedAt: new Date()
        },
        {
          id: 'REQ-DEMO-002',
          userId: 'demo-user',
          customerName: 'Priya Reddy',
          customerPhone: '9123456789',
          vehicleName: 'Tata Nexon EV',
          rcNumber: 'TS08JK5678',
          vehiclePlate: 'TS 08 JK 5678',
          make: 'Tata',
          model: 'Nexon EV',
          year: '2022',
          fuelType: 'Electric',
          description: 'Software update required and minor scratch on left door.',
          status: 'pending',
          serviceType: 'online',
          partPreference: 'third-party',
          createdAt: new Date(Date.now() - 172800000), // Created 2 days ago
          updatedAt: new Date()
        }
      ];
      setRequests(mockRequests);
    }
  }, [profile, requests.length]);

  const [slots, setSlots] = useState<any[]>([]); // To be populated
  const [earnings, setEarnings] = useState<any[]>([]); // To be populated

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        // Sync profile
        const userDoc = doc(db, 'users', user.uid);
        try {
          const snap = await getDoc(userDoc);
          if (snap.exists()) {
            setProfile(snap.data() as UserProfile);
          } else {
            const newProfile: UserProfile = {
              uid: user.uid,
              email: user.email!,
              displayName: user.displayName || 'User',
              role: 'customer' // Default
            };
            await setDoc(userDoc, newProfile);
            setProfile(newProfile);
          }
        } catch (e) {
          console.error("Error fetching profile", e);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Fetch Requests
  useEffect(() => {
    if (!profile) return;

    let q;
    if (profile.role === 'customer') {
      q = query(
        collection(db, 'repair_requests'),
        user ? where('userId', '==', user.uid) : where('userId', '==', 'guest')
      );
    } else {
      q = query(
        collection(db, 'repair_requests')
      );
    }

    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as RepairRequest));
      // Sort client-side to avoid mandatory composite indexes which can crash the app if missing
      const sorted = [...data].sort((a, b) => {
        const timeA = a.createdAt?.toDate?.()?.getTime() || new Date(a.createdAt).getTime() || 0;
        const timeB = b.createdAt?.toDate?.()?.getTime() || new Date(b.createdAt).getTime() || 0;
        return timeB - timeA;
      });
      setRequests(sorted);
    }, (err) => {
      console.error("Firestore listen error", err);
      // Don't throw here to avoid blanking out the whole app
    });

    return unsub;
  }, [user, profile]);

  const login = async () => {
    await signInWithPopup(auth, new GoogleAuthProvider());
  };

  const logout = () => signOut(auth);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-fugo-zinc">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
        >
          <Wrench className="w-12 h-12 text-fugo" />
        </motion.div>
      </div>
    );
  }

  const activeProfile = profile || (isMockAuthenticated ? { 
    uid: 'mock-' + mockPhone, 
    email: mockPhone + '@fugo.internal', 
    displayName: 'Fugo Tech ' + mockPhone.slice(-4), 
    role: 'technician' as Role,
    phoneNumber: mockPhone 
  } : { uid: 'guest', email: '', displayName: 'Guest User', role: 'customer' as Role });

  if (!user && !isMockAuthenticated) {
    return (
      <LoginView 
        onLogin={(phone) => {
          setMockPhone(phone);
          setIsMockAuthenticated(true);
        }} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-fugo-zinc flex flex-col md:flex-row m-0 font-sans">
      {!permissionsGranted && (
        <PermissionsView onProceed={() => setPermissionsGranted(true)} />
      )}
      
      {/* Mobile Top Header */}
      <header className="md:hidden bg-white border-b border-black/5 p-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <Wrench className="w-6 h-6 text-fugo" />
          <h1 className="text-xl font-black italic tracking-tighter leading-none">fugo repair & service</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center text-[10px] font-black italic text-orange-600">
            {activeProfile.displayName[0]}
          </div>
        </div>
      </header>

      {/* Sidebar / Nav */}
      <nav className="fixed bottom-0 left-0 right-0 md:relative md:w-80 bg-white md:bg-fugo-dark text-fugo-dark md:text-white p-2 md:p-6 flex md:flex-col justify-around md:justify-start gap-1 md:gap-2 z-50 border-t md:border-t-0 md:border-r-8 border-gray-100 md:border-fugo-dark shadow-2xl md:shadow-none">
        <div className="hidden md:flex flex-col mb-12 px-2">
          <span className="text-xs font-black uppercase tracking-[0.3em] text-fugo mb-1">Terminal</span>
          <h1 className="text-4xl font-black tracking-tighter leading-none italic text-white">fugo repair & service</h1>
          <div className="h-1 w-full bg-fugo mt-2"></div>
          <p className="text-[8px] font-black uppercase opacity-40 mt-1 tracking-widest">Integrated with Fugo Fuel App</p>
        </div>

        <NavItem icon={LayoutDashboard} label="Home" active={view === 'home'} onClick={() => setView('home')} />
        {isShiftStarted && (
          <NavItem icon={Wrench} label="Repair Logbook" active={view === 'repairs'} onClick={() => setView('repairs')} />
        )}
        <NavItem icon={Clock} label="Slots" active={view === 'slots'} onClick={() => setView('slots')} />
        <NavItem icon={UserIcon} label="Profile" active={view === 'profile'} onClick={() => setView('profile')} />
        
        <div className="mt-auto hidden md:block pt-6 border-t-4 border-fugo">
          <div className="mb-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-fugo/50">Authorized User</p>
            <p className="text-sm font-bold truncate">{activeProfile.displayName}</p>
          </div>
          {user || isMockAuthenticated ? (
            <button 
              onClick={() => {
                logout();
                setIsMockAuthenticated(false);
              }}
              className="flex items-center gap-3 w-full px-4 py-3 bg-fugo text-fugo-dark hover:bg-white transition-all font-black uppercase text-xs"
            >
              <LogOut className="w-4 h-4" />
              <span>Log out</span>
            </button>
          ) : (
            <button 
              onClick={login}
              className="flex items-center gap-3 w-full px-4 py-3 bg-fugo text-fugo-dark hover:bg-white transition-all font-black uppercase text-xs"
            >
              <UserIcon className="w-4 h-4" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 bg-fugo-zinc p-0 md:p-0 pb-24 md:pb-0 overflow-y-auto">
        <div className="p-0">
          <AnimatePresence mode="wait">
            {view === 'home' && (
              <HomeView 
                key="home"
                profile={activeProfile} 
                requests={requests}
                onSelectRequest={(r) => {
                  setSelectedRequest(r);
                  setView('details');
                }}
                onBook={() => setView('slots')}
                bookedSlots={bookedSlots}
                onStartJob={() => setView('booking')}
                onOpenLogbook={() => setView('repairs')}
                isShiftStarted={isShiftStarted}
                onStartShift={() => setIsShiftStarted(true)}
              />
            )}
            {view === 'slots' && (
              <SlotsView 
                key="slots"
                onBack={() => setView('home')}
                onBook={(slot) => {
                  setSelectedSlots([slot]);
                  setView('review-slots');
                }}
              />
            )}
            {view === 'review-slots' && (
              <ReviewSlotsView 
                key="review-slots"
                slots={selectedSlots}
                onBack={() => setView('slots')}
                onToggleSlot={(slot) => {
                  setSelectedSlots(prev => prev.filter(s => s !== slot));
                }}
                onConfirm={() => {
                  setBookedSlots(prev => [...prev, ...selectedSlots.map(s => ({ ...s, bookedAt: new Date() }))]);
                  setView('home');
                }}
              />
            )}
            {view === 'repairs' && (
              <DetailSubPage 
                key={view}
                title="Repair Logbook" 
                onBack={() => setView('home')}
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-4 mb-8">
                     <div className="flex gap-2 overflow-x-auto no-scrollbar">
                      {['all', 'pending', 'repairing', 'ready'].map((s) => (
                        <button 
                          key={s}
                          onClick={() => {}} 
                          className="px-4 py-2 text-[10px] font-black uppercase bg-fugo-zinc text-black whitespace-nowrap"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                    <button 
                      onClick={() => setView('booking')}
                      className="flex-shrink-0 flex items-center gap-2 px-6 py-3 bg-black text-fugo rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-fugo hover:text-black transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Start Job</span>
                    </button>
                  </div>
                  {requests.length > 0 ? (
                    requests.map(req => (
                      <ActiveRepairCard 
                        key={req.id} 
                        request={req} 
                        onClick={() => {
                          setSelectedRequest(req);
                          setView('details');
                        }} 
                      />
                    ))
                  ) : (
                    <div className="py-20 text-center bg-black/5 rounded-[2.5rem] border-4 border-dashed border-black/10">
                      <Wrench className="w-12 h-12 mx-auto mb-4 opacity-20" />
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-40">No active repair manifests found in terminal</p>
                    </div>
                  )}
                </div>
              </DetailSubPage>
            )}
            {view === 'profile' && (
              <ProfileView 
                key="profile"
                profile={activeProfile} 
                user={user} 
                onLogin={login} 
                onLogout={logout} 
                onBack={() => setView('home')}
                onNavigate={(v: AppView) => setView(v)}
              />
            )}
            {view === 'personal-info' && <DetailSubPage key="personal-info" title="Personal Info" onBack={() => setView('profile')}>
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-3xl border border-black/5">
                  <p className="text-[10px] font-black uppercase opacity-40 mb-2">Full Name</p>
                  <p className="text-lg font-black uppercase italic">{activeProfile.displayName}</p>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-black/5">
                  <p className="text-[10px] font-black uppercase opacity-40 mb-2">Phone Number</p>
                  <p className="text-lg font-black italic">{activeProfile.phoneNumber || '9845330364'}</p>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-black/5">
                  <p className="text-[10px] font-black uppercase opacity-40 mb-2">Email Address</p>
                  <p className="text-lg font-black italic">{activeProfile.email}</p>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-black/5">
                  <p className="text-[10px] font-black uppercase opacity-40 mb-2">Employee ID</p>
                  <p className="text-lg font-black italic">FUGO-TECH-0{activeProfile.uid.slice(-4)}</p>
                </div>
              </div>
            </DetailSubPage>}
            {view === 'earnings' && <DetailSubPage key="earnings" title="My Earnings" onBack={() => setView('profile')}>
              <div className="space-y-6">
                <div className="bg-orange-600 p-8 rounded-[2.5rem] text-white shadow-xl shadow-orange-600/20">
                  <p className="text-xs font-black uppercase tracking-widest opacity-60">Total Balance</p>
                  <p className="text-6xl font-black italic tracking-tighter mt-2">₹12,800</p>
                </div>
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest opacity-40 px-2">Transaction History</h4>
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="bg-white p-4 rounded-3xl border border-black/5 flex justify-between items-center">
                      <div>
                        <p className="text-sm font-black uppercase italic">Service Payout</p>
                        <p className="text-[10px] font-bold opacity-40 mt-1">Order #REQ-9823-{i}</p>
                      </div>
                      <p className="text-sm font-black text-fugo-success">+₹450</p>
                    </div>
                  ))}
                </div>
              </div>
            </DetailSubPage>}
            {view === 'payout' && <DetailSubPage key="payout" title="Manage Payout" onBack={() => setView('profile')}>
              <div className="space-y-6">
                <div className="bg-white p-8 rounded-[2.5rem] border border-black/5 text-center">
                  <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Zap className="w-8 h-8 text-orange-600" />
                  </div>
                  <h4 className="text-xl font-black uppercase italic tracking-tighter">Instant Payout</h4>
                  <p className="text-xs font-bold opacity-40 uppercase tracking-widest mt-2">Transfer earnings to your bank account 24/7</p>
                </div>
                <div className="space-y-4">
                  <ProfileItem icon={CreditCard} title="Bank Account" subtitle="HDFC BANK •••• 9823" iconBg="bg-blue-50" iconColor="text-blue-500" />
                  <ProfileItem icon={Plus} title="Add New Account" iconBg="bg-slate-50" iconColor="text-slate-500" />
                </div>
              </div>
            </DetailSubPage>}
            {view === 'shifts' && <DetailSubPage key="shifts" title="Shift & Overtime" onBack={() => setView('profile')}>
               <div className="space-y-6">
                 <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white p-6 rounded-3xl border border-black/5">
                       <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Planned Hours</p>
                       <p className="text-2xl font-black italic tracking-tighter mt-1">32h</p>
                    </div>
                    <div className="bg-white p-6 rounded-3xl border border-black/5">
                       <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Extra Hours</p>
                       <p className="text-2xl font-black italic tracking-tighter mt-1 text-orange-600">+4.5h</p>
                    </div>
                 </div>
                 <div className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-widest opacity-40 px-2">Upcoming Shifts</h4>
                    {[1, 2, 3].map(i => (
                      <div key={i} className="bg-white p-4 rounded-3xl border border-black/5 flex items-center justify-between">
                         <div className="flex items-center gap-4">
                           <div className="w-10 h-10 bg-purple-50 rounded-2xl flex items-center justify-center">
                              <Clock className="w-5 h-5 text-purple-600" />
                           </div>
                           <div>
                              <p className="text-sm font-black uppercase italic">May 1{i+5}, 2026</p>
                              <p className="text-[10px] font-bold opacity-40">09:00 AM - 01:00 PM</p>
                           </div>
                         </div>
                         <ChevronRight className="w-4 h-4 opacity-10" />
                      </div>
                    ))}
                 </div>
               </div>
            </DetailSubPage>}
            {view === 'attendance' && <DetailSubPage key="attendance" title="Attendance Record" onBack={() => setView('profile')}>
               <div className="space-y-6">
                 <div className="bg-white p-8 rounded-[2.5rem] border border-black/5">
                    <div className="flex items-center justify-between mb-8">
                       <h4 className="text-xl font-black uppercase italic tracking-tighter">May 2026</h4>
                       <div className="flex gap-2">
                          <ChevronLeft className="w-5 h-5 opacity-20" />
                          <ChevronRight className="w-5 h-5 opacity-20" />
                       </div>
                    </div>
                    <div className="grid grid-cols-7 gap-2 mb-4">
                       {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(d => (
                         <div key={d} className="text-center text-[10px] font-black opacity-20">{d}</div>
                       ))}
                       {Array.from({ length: 31 }).map((_, i) => (
                         <div key={i} className={cn(
                           "aspect-square rounded-xl flex items-center justify-center text-xs font-bold",
                           (i + 1) === 15 ? "bg-orange-600 text-white" : (i % 3 === 0 ? "bg-fugo-zinc text-fugo-dark" : "opacity-40")
                         )}>
                           {i + 1}
                         </div>
                       ))}
                    </div>
                 </div>
                 <div className="flex gap-4">
                    <div className="flex items-center gap-2">
                       <div className="w-3 h-3 rounded-full bg-fugo-zinc" />
                       <span className="text-[10px] font-black uppercase opacity-40">Planned</span>
                    </div>
                    <div className="flex items-center gap-2">
                       <div className="w-3 h-3 rounded-full bg-orange-600" />
                       <span className="text-[10px] font-black uppercase opacity-40">Present</span>
                    </div>
                 </div>
               </div>
            </DetailSubPage>}
            {view === 'documents' && <DetailSubPage key="documents" title="Personal Document" onBack={() => setView('profile')}>
               <div className="space-y-4">
                  <div className="bg-white p-6 rounded-3xl border border-black/5 flex items-center justify-between">
                     <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center">
                           <Shield className="w-6 h-6 text-slate-500" />
                        </div>
                        <div>
                           <p className="text-sm font-black uppercase italic">Aadhar Card</p>
                           <p className="text-[10px] font-bold opacity-40">Verified • PDF (1.2 MB)</p>
                        </div>
                     </div>
                     <button onClick={() => setViewingDoc('Aadhar Card')} className="text-orange-600 text-[10px] font-black uppercase">View</button>
                  </div>
                  <div className="bg-white p-6 rounded-3xl border border-black/5 flex items-center justify-between">
                     <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center">
                           <Shield className="w-6 h-6 text-slate-500" />
                        </div>
                        <div>
                           <p className="text-sm font-black uppercase italic">Graduate Certificate</p>
                           <p className="text-[10px] font-bold opacity-40">Verified • JPG (800 KB)</p>
                        </div>
                     </div>
                     <button onClick={() => setViewingDoc('Graduate Certificate')} className="text-orange-600 text-[10px] font-black uppercase">View</button>
                  </div>
                  <div className="bg-orange-50 border-2 border-dashed border-orange-600/20 p-8 rounded-3xl flex flex-col items-center gap-4">
                     <Upload className="w-8 h-8 text-orange-600 opacity-40" />
                     <p className="text-xs font-black uppercase tracking-widest text-orange-600/60">Upload New Document</p>
                  </div>
               </div>

               {/* Document Preview Overlay */}
               {viewingDoc && (
                 <div className="fixed inset-0 bg-black/90 z-[100] p-6 flex flex-col items-center justify-center">
                    <button onClick={() => setViewingDoc(null)} className="absolute top-10 right-10 text-white">
                      <X className="w-10 h-10" />
                    </button>
                    <div className="w-full max-w-sm bg-white/10 aspect-[3/4] rounded-[2rem] border border-white/20 flex flex-col items-center justify-center p-10 text-center">
                      <Shield className="w-20 h-20 text-white/20 mb-6" />
                      <h4 className="text-2xl font-black uppercase italic text-white">{viewingDoc}</h4>
                      <p className="text-sm font-bold text-white/40 uppercase mt-4">Verified Digital Artifact</p>
                      <div className="mt-12 h-2 w-full bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full w-[80%] bg-fugo" />
                      </div>
                    </div>
                 </div>
               )}
            </DetailSubPage>}
            {view === 'app-settings' && <DetailSubPage key="app-settings" title="App Settings" onBack={() => setView('profile')}>
               <div className="space-y-8">
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-widest opacity-40 px-6 mb-4">Preferences</h4>
                    <div className="bg-white rounded-[2.5rem] overflow-hidden border border-black/5">
                       <ProfileItem icon={Bell} title="Push Notifications" subtitle="Shift alerts & updates" iconBg="bg-blue-50" iconColor="text-blue-500" />
                       <ProfileItem icon={Moon} title="Dark Mode" subtitle="System default" iconBg="bg-purple-50" iconColor="text-purple-500" />
                       <ProfileItem icon={Globe} title="Language" subtitle="English (Primary)" iconBg="bg-green-50" iconColor="text-green-500" />
                    </div>
                  </div>
                  <div className="px-6 space-y-4">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Version Info</p>
                    <div className="flex justify-between items-center bg-black/5 p-4 rounded-2xl">
                       <span className="text-xs font-black">FUGO-APP-V2</span>
                       <span className="text-[10px] font-bold opacity-40">BUILD ID: 98234-X</span>
                    </div>
                  </div>
               </div>
            </DetailSubPage>}
            {view === 'terms' && <DetailSubPage key="terms" title="Terms & Condition" onBack={() => setView('profile')}>
               <div className="bg-white p-8 rounded-[2.5rem] border border-black/5 space-y-6">
                  <h4 className="text-xl font-black uppercase italic tracking-tighter">Operating Protocol</h4>
                  <div className="space-y-4 text-xs font-bold opacity-60 leading-relaxed uppercase">
                    <p>1. The technician agrees to maintain professional standards during all service shifts.</p>
                    <p>2. Earnings are credited upon successful completion of the service manifest.</p>
                    <p>3. Cancellations within 2 hours of shift start may incur a penalty.</p>
                    <p>4. Data privacy is strictly enforced following GDPR and local industrial standards.</p>
                    <p>5. FUGO maintains the right to audit service quality at any time.</p>
                  </div>
               </div>
            </DetailSubPage>}
            {view === 'booking' && (
              <div className="max-w-4xl mx-auto p-6">
                <RepairForm profile={activeProfile} onSuccess={() => setView('repairs')} onCancel={() => setView('repairs')} />
              </div>
            )}
            {view === 'details' && selectedRequest && (
              <RepairDetails 
                request={selectedRequest} 
                profile={activeProfile}
                onBack={() => setView('home')} 
              />
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

const ActiveRepairCard: React.FC<{ request: RepairRequest, onClick: () => void }> = ({ request, onClick }) => {
  const [elapsed, setElapsed] = useState<string>('00:00:00');
  
  useEffect(() => {
    let interval: any;
    if (request.status === 'repairing' && request.repairStartTime) {
      interval = setInterval(() => {
        const start = (request.repairStartTime as any).toDate?.().getTime() || new Date(request.repairStartTime).getTime();
        const diff = Math.floor((Date.now() - start) / 1000);
        
        const hours = Math.floor(diff / 3600);
        const minutes = Math.floor((diff % 3600) / 60);
        const seconds = diff % 60;
        
        setElapsed(
          `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
        );
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [request.status, request.repairStartTime]);

  const statusConfig: Record<Status, { label: string, color: string, bg: string, progress: number }> = {
    pending: { label: 'Assessing', color: 'text-amber-800', bg: 'bg-amber-100', progress: 10 },
    transporting: { label: 'In Transit', color: 'text-blue-800', bg: 'bg-blue-100', progress: 30 },
    warehouse: { label: 'In Warehouse', color: 'text-slate-800', bg: 'bg-slate-100', progress: 50 },
    repairing: { label: 'Actively Repairing', color: 'text-orange-800', bg: 'bg-orange-100', progress: 75 },
    ready: { label: 'Fix Confirmed', color: 'text-green-800', bg: 'bg-green-100', progress: 95 },
    completed: { label: 'Service Finished', color: 'text-gray-800', bg: 'bg-gray-100', progress: 100 }
  };

  const config = statusConfig[request.status] || statusConfig.pending;

  return (
    <button 
      onClick={onClick}
      className="w-full bg-white rounded-[2.5rem] p-6 border border-black/5 shadow-[0_10px_30px_rgba(0,0,0,0.03)] text-left group"
    >
      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
             <span className={cn("px-2 py-0.5 rounded-lg text-[8px] font-black uppercase", config.bg, config.color)}>
               {config.label}
             </span>
             {request.status === 'repairing' && (
               <span className="text-[10px] font-mono font-black text-orange-600 animate-pulse">{elapsed}</span>
             )}
          </div>
          <h4 className="text-xl font-black uppercase italic tracking-tighter leading-none text-fugo-dark">{request.vehicleName}</h4>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-bold opacity-40 uppercase">{request.vehiclePlate}</p>
              <p className="text-[10px] font-bold opacity-20 uppercase">RC: {request.rcNumber}</p>
            </div>
            {request.rating && (
              <span className="text-fugo text-xs">{'★'.repeat(request.rating)}</span>
            )}
          </div>
          
          <div className="mt-4 space-y-1">
            <p className="text-[9px] font-black uppercase tracking-widest opacity-30">Client: {request.customerName || 'Standard User'}</p>
            {request.description && (
              <p className="text-[10px] font-bold opacity-60 line-clamp-1 italic">"{request.description}"</p>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Estimate</p>
          <p className="text-xl font-black italic tracking-tighter text-fugo-dark">
            {request.price ? `₹${request.price}` : 'Pending Quote'}
          </p>
        </div>
      </div>

      <div className="relative h-2 w-full bg-black/5 rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${config.progress}%` }}
          className={cn("absolute top-0 left-0 h-full", request.status === 'repairing' ? 'bg-orange-600' : 'bg-black')}
        />
      </div>
      
      <div className="flex justify-between items-center mt-4 pt-4 border-t border-black/5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-orange-50 rounded-lg flex items-center justify-center">
            <Zap className="w-3 h-3 text-orange-600" />
          </div>
          <span className="text-[10px] font-black uppercase opacity-60">Fugo Fuel App Order</span>
        </div>
        <ChevronRight className="w-4 h-4 opacity-20 group-hover:translate-x-1 transition-transform" />
      </div>
    </button>
  );
}

const HomeView: React.FC<{ 
  profile: UserProfile, 
  requests: RepairRequest[],
  onSelectRequest: (r: RepairRequest) => void,
  onBook: () => void, 
  bookedSlots?: any[], 
  onStartJob: () => void,
  onOpenLogbook: () => void,
  isShiftStarted: boolean,
  onStartShift: () => void
}> = ({ profile, requests, onSelectRequest, onBook, bookedSlots = [], onStartJob, onOpenLogbook, isShiftStarted, onStartShift }) => {
  const activeShift = bookedSlots.length > 0 ? bookedSlots[bookedSlots.length - 1] : null;
  const [earningsTab, setEarningsTab] = useState<'today' | 'week'>('today');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-xl mx-auto space-y-8 pb-32"
    >
      {/* Location Bar */}
      <div className="flex items-center justify-between px-6 py-6 bg-white border-b border-slate-100 sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-50 rounded-full flex items-center justify-center">
            <MapPin className="w-6 h-6 text-fugo" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xl font-black uppercase tracking-tight">{activeShift?.address || 'HYD-NALLAGANDLA NEW'}</h4>
              <ChevronRight className="w-4 h-4 rotate-90 opacity-20" />
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-1">
              Weekly payouts! Every Tuesday by 11:59 PM
            </p>
          </div>
        </div>
        <div className="flex gap-4">
          <Bell className="w-7 h-7 opacity-40" />
          <Clock className="w-7 h-7 opacity-40" />
        </div>
      </div>

      {/* Active Shift Banner */}
      {activeShift && (
        <div className="mx-6 p-6 bg-white rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden">
          {isShiftStarted && (
            <div className="absolute top-0 right-0 px-4 py-1 bg-green-500 text-white text-[10px] font-black uppercase tracking-widest rounded-bl-xl">
              Live Now
            </div>
          )}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-3xl font-black">{activeShift.time || '05:01 PM'} - 07:00 PM</h3>
            <span className={cn(
              "px-3 py-1 rounded-full text-xs font-bold uppercase",
              isShiftStarted ? "bg-green-100 text-green-600" : "bg-purple-50 text-purple-600"
            )}>
              {isShiftStarted ? 'Active Shift' : 'Upcoming'}
            </span>
          </div>
          
          <div className="flex gap-4 items-start bg-slate-50 p-4 rounded-2xl mb-4">
            <div className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center",
              isShiftStarted ? "bg-green-100" : "bg-slate-200"
            )}>
              <Clock className={cn("w-6 h-6", isShiftStarted ? "text-green-600" : "text-slate-500")} />
            </div>
            <div>
              <h5 className="font-bold">
                {isShiftStarted ? 'Shift In Progress' : `Shift starts at ${activeShift.time || '05:01 PM'}`}
              </h5>
              <p className="text-sm text-slate-400 font-medium">
                {isShiftStarted ? 'Good luck with your assignments!' : 'Reach your Store before shift start time'}
              </p>
            </div>
          </div>

          {!isShiftStarted ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-slate-500">
                <Info className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm font-medium">Please reach your store before slot start time.</p>
              </div>
              <button 
                onClick={onStartShift}
                className="w-full bg-fugo py-4 rounded-2xl text-lg font-black text-white hover:bg-fugo-accent transition-colors flex items-center justify-center gap-2"
              >
                Start Shift <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={onOpenLogbook}
                className="bg-black text-white py-4 rounded-2xl text-sm font-black uppercase tracking-widest flex items-center justify-center gap-2"
              >
                <Wrench className="w-4 h-4" /> Logbook
              </button>
              <button 
                onClick={onStartJob}
                className="bg-fugo text-white py-4 rounded-2xl text-sm font-black uppercase tracking-widest flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" /> Start Job
              </button>
            </div>
          )}
        </div>
      )}

      {/* My Earnings Segment */}
      <div className="px-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-black tracking-tight">My Earnings</h2>
        </div>

        <div className="bg-white rounded-[2.5rem] p-4 shadow-sm border border-slate-100">
          <div className="flex p-2 bg-slate-50 rounded-2xl mb-8">
            <button 
              onClick={() => setEarningsTab('today')}
              className={cn(
                "flex-1 py-4 px-6 rounded-xl text-lg font-black transition-all",
                earningsTab === 'today' ? "bg-white text-black shadow-sm" : "text-slate-400"
              )}
            >
              Today
            </button>
            <button 
              onClick={() => setEarningsTab('week')}
              className={cn(
                "flex-1 py-4 px-6 rounded-xl text-lg font-black transition-all",
                earningsTab === 'week' ? "bg-white text-black shadow-sm" : "text-slate-400"
              )}
            >
              This Week
            </button>
          </div>

          <div className="text-center py-12 px-6">
             <div className="relative inline-block mb-6">
                <div className="w-24 h-24 bg-purple-50 rounded-3xl rotate-12 flex items-center justify-center">
                   <Truck className="w-12 h-12 text-slate-200 -rotate-12" />
                </div>
             </div>
             <h4 className="text-2xl font-black mb-2">Nothing to see here, yet.</h4>
             <p className="text-slate-400 font-medium mb-10">Book Slots and Start Earning!</p>

             <div className="flex gap-4">
                <button 
                  onClick={onBook}
                  className="flex-1 bg-fugo py-5 rounded-2xl text-lg font-black text-white hover:bg-fugo-accent transition-colors flex items-center justify-center gap-2"
                >
                  Book Slots <ChevronRight className="w-5 h-5" />
                </button>
                <button 
                  className="flex-1 bg-slate-50 py-5 rounded-2xl text-lg font-black text-slate-600 hover:bg-slate-100 transition-colors flex items-center justify-center gap-2"
                >
                  Show Earnings <ChevronRight className="w-5 h-5" />
                </button>
             </div>
          </div>

          <div className="flex justify-center border-t border-slate-100 pt-6 mt-4">
             <p className="text-sm font-bold text-slate-300 uppercase tracking-widest">
               Last Updated at {new Date().toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
             </p>
          </div>
        </div>
      </div>

      {/* Bonus Card */}
      <div className="mx-6 bg-orange-50 rounded-[2.5rem] p-8 relative overflow-hidden border-2 border-orange-100 shadow-sm group">
        <div className="relative z-10 pr-24">
          <h3 className="text-3xl font-black text-orange-950 mb-2">Earn ₹1000 Joining Bonus</h3>
          <p className="text-sm font-medium text-orange-900/60 mb-8">Complete at least 300 orders in first 7 days</p>
          <button 
            onClick={onBook}
            className="flex items-center gap-2 bg-white text-orange-950 px-6 py-4 rounded-xl font-bold shadow-sm group-hover:bg-orange-950 group-hover:text-white transition-colors"
          >
            Book Slots <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        <div className="absolute right-[-10px] bottom-[-10px] w-40 h-40 group-hover:scale-110 transition-transform">
           <div className="w-full h-full bg-orange-200 rotate-12 flex items-center justify-center rounded-3xl">
              <Zap className="w-20 h-20 text-orange-400 -rotate-12" />
           </div>
        </div>
      </div>
    </motion.div>
  );
}

const SlotsView: React.FC<{ onBack: () => void, onBook: (slot: any) => void }> = ({ onBack, onBook }) => {
  const currentDate = new Date();
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  const dates = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(currentDate.getDate() + i);
    return {
      day: dayNames[d.getDay()],
      date: String(d.getDate()).padStart(2, '0'),
      fullDate: d
    };
  });

  const [selectedDate, setSelectedDate] = useState(dates[0].date);

  const slots = [
    { time: '08:00am – 10:00am', earning: 'Earn upto ₹350', positions: 12, address: 'Aparna Sarovar Grande, Nallagandla' },
    { time: '10:01am – 12:00pm', earning: 'Earn upto ₹400', positions: 8, address: 'Gulmohar Park Colony Hub' },
    { time: '12:01pm – 02:00pm', earning: 'Earn upto ₹300', positions: 15, address: 'Tellapur Main Road Station' },
    { time: '02:01pm – 04:00pm', earning: 'Earn upto ₹300', positions: 20, address: 'Citizen\'s Hospital Circle' },
    { time: '04:01pm – 06:00pm', earning: 'Earn upto ₹450', positions: 5, address: 'Nallagandla Bypass Terminal' },
    { time: '06:01pm – 08:00pm', earning: 'Earn upto ₹500', positions: 2, address: 'Lingampally X Roads Point' },
    { time: '08:01pm – 10:00pm', earning: 'Earn upto ₹600', positions: 4, address: 'BHEL Township Entry Node' },
    { time: '10:01pm – 12:00am', earning: 'Earn upto ₹700', positions: 10, address: 'Tara Nagar Junction, Serilingampally' },
  ];

  const [toggled, setToggled] = useState<Record<number, boolean>>({});

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="max-w-xl mx-auto flex flex-col h-screen"
    >
      {/* Header */}
      <div className="p-6 bg-white space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
             <h4 className="text-2xl font-black">Nallagandla</h4>
             <ChevronRight className="w-5 h-5 rotate-90 opacity-40" />
          </div>
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
             <Clock className="w-6 h-6 opacity-40" />
          </div>
        </div>
        <p className="text-sm text-slate-400 font-medium">Near Aparna Sarovar, Nallagandla, Hyderabad 500019</p>
      </div>

      {/* Date Scroll */}
      <div className="flex gap-4 overflow-x-auto px-6 py-4 border-b border-slate-100 bg-white scrollbar-none">
        {dates.map((d) => (
          <button
            key={d.date}
            onClick={() => setSelectedDate(d.date)}
            className={cn(
              "flex-shrink-0 w-16 flex flex-col items-center gap-2",
              selectedDate === d.date ? "text-black" : "text-slate-300"
            )}
          >
            <span className="text-sm font-bold">{d.day}</span>
            <span className={cn(
              "w-12 h-12 flex items-center justify-center rounded-2xl text-xl font-black transition-all",
              selectedDate === d.date ? "bg-slate-50 border-2 border-purple-600" : "bg-slate-50"
            )}>
              {d.date}
            </span>
            {selectedDate === d.date && <div className="h-1 w-8 bg-purple-600 rounded-full" />}
          </button>
        ))}
        <button className="flex-shrink-0 w-12 flex flex-col items-center justify-center text-slate-300">
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>

      {/* Filters */}
      <div className="p-6 flex gap-4">
         <button className="flex-1 flex items-center justify-between bg-purple-50 text-purple-600 p-4 rounded-2xl border border-purple-100 font-black text-sm uppercase">
            <div className="flex items-center gap-2">
               <ChevronRight className="w-4 h-4 -rotate-90" />
               Low to High Distance
            </div>
            <X className="w-4 h-4 opacity-40" />
         </button>
         <button className="w-24 flex items-center justify-center bg-slate-50 text-slate-600 p-4 rounded-2xl border border-slate-100 font-black text-sm uppercase gap-2">
            <Menu className="w-4 h-4" /> All
         </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-6 pb-32 space-y-4">
        {slots.map((slot, i) => (
          <div key={i} className="flex gap-6 items-start p-4 group">
             <div 
               onClick={() => setToggled(prev => ({ ...prev, [i]: !prev[i] }))}
               className={cn(
                 "w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all cursor-pointer",
                 toggled[i] ? "bg-purple-600 border-purple-600 text-white" : "border-slate-200"
               )}
             >
               {toggled[i] && <CheckCircle className="w-5 h-5" />}
             </div>
             <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                   <h4 className="text-2xl font-black">{slot.time}</h4>
                   <span className="bg-green-100 text-green-600 px-3 py-1 rounded-full text-xs font-bold uppercase">
                     {slot.positions} Free
                   </span>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-purple-600 font-bold underline decoration-2 underline-offset-4">{slot.earning}</p>
                  <span className="text-slate-300">•</span>
                  <p className="text-sm text-slate-400 font-bold uppercase tracking-tight">{slot.address}</p>
                </div>
                <div className="h-px bg-slate-100 w-full mt-4" />
             </div>
          </div>
        ))}
      </div>

      {/* Bottom Bar */}
      <div className="p-6 bg-white border-t border-slate-100 shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
         <div className="flex gap-6 items-center">
            <div className="flex-1">
               <p className="text-2xl font-black">Earn upto ₹800</p>
               <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">4 hours</p>
            </div>
            <button 
              onClick={() => {
                const selected = slots.filter((_, i) => toggled[i]);
                if (selected.length > 0) onBook(selected[0]);
              }}
              className="px-12 py-5 bg-fugo rounded-2xl text-lg font-black text-white hover:bg-fugo-accent transition-colors shadow-lg shadow-purple-600/20"
            >
              Book Now
            </button>
         </div>
      </div>
    </motion.div>
  );
}
const Menu: React.FC<{ className?: string }> = ({ className }) => <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 4H21M12 9H21M12 14H21M12 19H21M3 4H9V10H3V4ZM3 14H9V20H3V14Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;

function DetailSubPage({ title, onBack, children }: { title: string, onBack: () => void, children: React.ReactNode, key?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="max-w-xl mx-auto pb-20 mt-0"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-8">
        <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-black/5">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h2 className="text-xl font-black uppercase tracking-widest italic">{title}</h2>
        <Bell className="w-6 h-6 opacity-20" />
      </div>
      <div className="px-6">
        {children}
      </div>
    </motion.div>
  );
}

const ReviewSlotsView: React.FC<{ 
  slots: any[], 
  onBack: () => void, 
  onConfirm: () => void,
  onToggleSlot: (slot: any) => void
}> = ({ slots, onBack, onConfirm, onToggleSlot }) => {
  const totalHours = slots.length * 2; // Assuming 2 hours per slot

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-xl mx-auto flex flex-col h-screen"
    >
      <div className="flex items-center justify-between p-6">
        <div className="flex items-center gap-4">
          <h2 className="text-3xl font-black">Review Slots</h2>
          <span className="bg-purple-100 text-purple-600 px-3 py-1 rounded-full text-sm font-bold">
            {slots.length} Slots • {totalHours} h
          </span>
        </div>
        <button onClick={onBack} className="p-2 rounded-full hover:bg-black/5">
          <X className="w-8 h-8 opacity-40" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="flex items-center gap-4 text-slate-400">
          <ChevronRight className="w-5 h-5 rotate-90" />
          <p className="text-xl font-bold">Planned for {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <span className="bg-purple-50 text-purple-600 px-3 py-1 rounded-full text-xs font-bold">
            {slots.length} Slots • {totalHours} h
          </span>
        </div>

        <div className="space-y-4">
          {slots.map((slot, i) => (
            <div key={i} className="bg-white rounded-3xl p-6 border border-slate-100 flex gap-4">
              <div className="flex-shrink-0 pt-1">
                <input 
                  type="checkbox" 
                  checked={true} 
                  onChange={() => onToggleSlot(slot)}
                  className="w-6 h-6 rounded-md accent-fugo"
                />
              </div>
              <div className="flex-1">
                <h4 className="text-2xl font-bold mb-2">{slot.time} — {slot.endTime || '09:00 pm'}</h4>
                <div className="flex items-center gap-2 mb-1">
                  <span className="bg-green-100 text-green-600 px-2 py-0.5 rounded-lg text-xs font-bold uppercase">
                    {slot.positions || 27} Free Slot
                  </span>
                </div>
                <p className="text-slate-400 font-bold uppercase tracking-tight text-sm">
                  {slot.address.toUpperCase()} • 2 h • 20 mins break
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="p-6 pb-12">
        <button 
          onClick={onConfirm}
          className="w-full bg-fugo py-6 rounded-3xl text-xl font-black text-white hover:bg-fugo-accent transition-colors"
        >
          Confirm & Book
        </button>
      </div>
    </motion.div>
  );
};
const PermissionsView: React.FC<{ onProceed: () => void }> = ({ onProceed }) => {
  const permissions = [
    { icon: Bell, title: 'Push Notification', desc: 'Turn on notifications to get updates about your application' },
    { icon: Camera, title: 'Camera', desc: 'We need your camera to take pictures or upload documents' },
    { icon: Zap, title: 'Battery Usage', desc: 'We need you to allow unrestricted battery usage to connect you to nearby Stores' },
    { icon: MapPin, title: 'Location', desc: 'We need your location to connect you to nearby Stores' },
    { icon: MapPin, title: 'Background Location', desc: 'We require background location to accurate rider updates and geofence detection' },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-white z-[100] flex flex-col p-8 overflow-y-auto"
    >
      <div className="flex-1 flex flex-col items-center justify-center pt-12 pb-20">
        <div className="w-48 h-48 bg-purple-50 rounded-full flex items-center justify-center mb-12 relative">
          <div className="absolute inset-0 bg-purple-100 rounded-full scale-110 opacity-20 animate-pulse" />
          <div className="w-32 h-56 bg-purple-100/50 rounded-3xl border-4 border-purple-200 flex flex-col p-3 gap-2">
             <div className="w-full h-8 bg-purple-200/50 rounded-lg flex items-center justify-center">
               <MapPin className="w-4 h-4 text-purple-600" />
             </div>
             <div className="w-full h-8 bg-purple-200/50 rounded-lg flex items-center justify-center">
               <Shield className="w-4 h-4 text-purple-600" />
             </div>
             <div className="w-full h-8 bg-purple-200/50 rounded-lg flex items-center justify-center">
               <Camera className="w-4 h-4 text-purple-600" />
             </div>
          </div>
        </div>

        <h2 className="text-4xl font-black mb-4 text-center">Permissions Required</h2>
        <p className="text-lg text-slate-500 text-center mb-12 max-w-sm">
          Grant the required access to continue using the App
        </p>

        <div className="w-full max-w-md space-y-8">
          {permissions.map((p, i) => (
            <div key={i} className="flex gap-6">
              <div className="flex-shrink-0">
                <p.icon className="w-8 h-8 text-slate-600" />
              </div>
              <div>
                <h4 className="text-xl font-bold mb-1">{p.title}</h4>
                <p className="text-sm text-slate-500 leading-relaxed">{p.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button 
        onClick={onProceed}
        className="w-full bg-fugo py-6 rounded-2xl text-xl font-black text-white hover:bg-fugo-accent transition-colors mt-8"
      >
        Proceed
      </button>
    </motion.div>
  );
};

function ProfileItem({ 
  icon: Icon, 
  title, 
  subtitle, 
  iconBg, 
  iconColor, 
  onClick 
}: { 
  icon: any, 
  title: string, 
  subtitle?: string, 
  iconBg: string, 
  iconColor: string, 
  onClick?: () => void 
}) {
  return (
    <button 
      onClick={onClick}
      className="w-full flex items-center justify-between p-5 bg-white hover:bg-black/5 transition-colors group border-b border-black/5 last:border-b-0"
    >
      <div className="flex items-center gap-4">
        <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center", iconBg)}>
          <Icon className={cn("w-5 h-5", iconColor)} />
        </div>
        <div className="text-left">
          <p className="text-sm font-black uppercase tracking-tight text-fugo-dark">{title}</p>
          {subtitle && <p className="text-[10px] font-bold uppercase opacity-40">{subtitle}</p>}
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-black/20 group-hover:translate-x-1 transition-transform" />
    </button>
  );
}

const ProfileView: React.FC<{ profile: UserProfile, user: User | null, onLogin: () => void, onLogout: () => void, onBack: () => void, onNavigate: (v: any) => void }> = ({ profile, user, onLogin, onLogout, onBack, onNavigate }) => {
  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-black/40 mb-4 px-6">
      {children}
    </h3>
  );

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-xl mx-auto pb-20 mt-0"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-8">
        <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-black/5">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h2 className="text-xl font-black uppercase tracking-widest italic">Profile</h2>
        <Bell className="w-6 h-6 opacity-20" />
      </div>

      <div className="space-y-8">
        {/* User Info Card */}
        <div className="mx-6 bg-white rounded-[2.5rem] p-8 flex items-center gap-6 shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-black/5">
          <div className="w-20 h-20 bg-orange-600 rounded-[2rem] flex items-center justify-center shadow-lg shadow-orange-600/20">
            <span className="text-3xl font-black text-white italic">{profile.displayName[0]}</span>
          </div>
          <div>
            <h3 className="text-xl font-black uppercase tracking-tight leading-none mb-1">{profile.displayName}</h3>
            <p className="text-sm font-bold opacity-40">{profile.phoneNumber || '9845330364'}</p>
            <div className="mt-2 inline-block px-2 py-1 bg-orange-50 rounded-lg">
               <p className="text-[10px] font-black uppercase text-orange-600">Ready for your shift?</p>
            </div>
          </div>
        </div>

        {/* Information Group */}
        <div className="bg-white mx-6 rounded-[2.5rem] shadow-[0_10px_30px_rgba(0,0,0,0.03)] border border-black/5 overflow-hidden">
          <ProfileItem 
            icon={UserIcon} 
            title="Personal Information" 
            iconBg="bg-blue-50"
            iconColor="text-blue-500"
            onClick={() => onNavigate('personal-info')}
          />
          <ProfileItem 
            icon={CreditCard} 
            title="My Earnings" 
            iconBg="bg-green-50"
            iconColor="text-green-500"
            onClick={() => onNavigate('earnings')}
          />
          <ProfileItem 
            icon={Zap} 
            title="Manage Payout" 
            iconBg="bg-orange-50"
            iconColor="text-orange-500"
            onClick={() => onNavigate('payout')}
          />
          <ProfileItem 
            icon={Clock} 
            title="Shift & Overtime" 
            iconBg="bg-purple-50"
            iconColor="text-purple-500"
            onClick={() => onNavigate('shifts')}
          />
          <ProfileItem 
            icon={CircleDot} 
            title="Attendance Record" 
            iconBg="bg-red-50"
            iconColor="text-red-500"
            onClick={() => onNavigate('attendance')}
          />
          <ProfileItem 
            icon={Shield} 
            title="Personal Document" 
            iconBg="bg-slate-50"
            iconColor="text-slate-500"
            onClick={() => onNavigate('documents')}
          />
        </div>

        {/* Settings Group */}
        <div>
          <SectionTitle>Application</SectionTitle>
          <div className="bg-white mx-6 rounded-[2.5rem] shadow-[0_10px_30px_rgba(0,0,0,0.03)] border border-black/5 overflow-hidden">
            <ProfileItem 
              icon={Settings} 
              title="App Setting & Preference" 
              iconBg="bg-blue-50"
              iconColor="text-blue-500"
              onClick={() => onNavigate('app-settings')}
            />
            <ProfileItem 
              icon={Info} 
              title="Terms & Condition" 
              iconBg="bg-slate-50"
              iconColor="text-slate-500"
              onClick={() => onNavigate('terms')}
            />
          </div>
        </div>

        {/* Role Switcher for Developer/Tester */}
        <div className="mx-6 px-6 py-4 bg-fugo-zinc rounded-[2rem] border-2 border-dashed border-black/10">
          <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-4">Internal Station Toggle (For Testing)</p>
          <div className="flex gap-2">
            {(['customer', 'technician'] as Role[]).map(r => (
              <button 
                key={r}
                onClick={async () => {
                  if (!user) return;
                  const profileRef = doc(db, 'users', user.uid);
                  try {
                    await setDoc(profileRef, { ...profile, role: r });
                  } catch (err) {
                    handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
                  }
                }}
                className={cn(
                  "px-4 py-2 text-[10px] rounded-xl font-black uppercase border-2 transition-all",
                  profile.role === r ? "bg-black text-white border-black" : "bg-white border-black/10 opacity-40"
                )}
              >
                Set as {r}
              </button>
            ))}
          </div>
        </div>

        {user ? (
          <div className="px-6">
            <button 
              onClick={onLogout}
              className="w-full py-5 flex items-center justify-center gap-3 bg-red-50 text-red-600 rounded-3xl font-black uppercase text-xs hover:bg-black hover:text-white transition-all border border-red-100"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        ) : (
          <div className="px-6">
            <button 
              onClick={onLogin}
              className="w-full py-5 flex items-center justify-center gap-3 bg-black text-white rounded-3xl font-black uppercase text-xs hover:bg-fugo hover:text-black transition-all"
            >
              <UserIcon className="w-4 h-4" />
              Authenticate
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function SettingsView({ profile, user, onUpdateProfile }: { profile: UserProfile, user: User | null, onUpdateProfile: (updates: Partial<UserProfile>) => Promise<void> }) {
  const [name, setName] = useState(profile.displayName);
  const [role, setRole] = useState(profile.role);
  const [phone, setPhone] = useState(profile.phoneNumber || '');
  const [rank, setRank] = useState(profile.rank || '');
  const [headline, setHeadline] = useState(profile.headline || '');
  const [aboutMe, setAboutMe] = useState(profile.aboutMe || '');
  const [expertise, setExpertise] = useState((profile.expertise || []).join(', '));
  const [certifications, setCertifications] = useState((profile.certifications || []).join(', '));
  const [bioStatus, setBioStatus] = useState(profile.bioStatus || '');
  const [serviceGuarantee, setServiceGuarantee] = useState(profile.serviceGuarantee || '');
  const [isVerified, setIsVerified] = useState(profile.isVerified || false);
  const [isInsured, setIsInsured] = useState(profile.isInsured || false);
  const [liabilityAmount, setLiabilityAmount] = useState(profile.liabilityAmount || '');
  const [licenseNumber, setLicenseNumber] = useState(profile.licenseNumber || '');
  const [serviceNotes, setServiceNotes] = useState(profile.serviceNotes || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdateProfile({ 
        displayName: name, 
        role,
        phoneNumber: phone,
        rank,
        headline,
        aboutMe,
        expertise: expertise.split(',').map(s => s.trim()).filter(s => s),
        certifications: certifications.split(',').map(s => s.trim()).filter(s => s),
        bioStatus,
        serviceGuarantee,
        isVerified,
        isInsured,
        liabilityAmount,
        licenseNumber,
        serviceNotes
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-4xl mx-auto"
    >
      <div className="flex items-end gap-6 mb-12 border-b-8 border-black pb-8">
        <h2 className="text-8xl font-black text-fugo-dark uppercase tracking-tighter leading-none italic">Config</h2>
        <p className="text-xl font-black uppercase opacity-40 mb-2">Terminal Settings</p>
      </div>

      <div className="space-y-12">
        <div className="bg-white border-8 border-black p-10">
          <h3 className="text-2xl font-black uppercase mb-8 border-b-4 border-fugo inline-block">Profile Configuration</h3>
          
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-fugo mb-2">Public Designation (Name)</label>
                <input 
                  type="text"
                  className="w-full bg-fugo-zinc border-4 border-black px-6 py-4 text-xl font-black uppercase italic"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-fugo mb-2">Comm Link (Phone)</label>
                <input 
                  type="text"
                  className="w-full bg-fugo-zinc border-4 border-black px-6 py-4 text-xl font-black uppercase italic"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="000-000-0000"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-fugo mb-2">Service Rank</label>
                <input 
                  type="text"
                  className="w-full bg-fugo-zinc border-4 border-black px-6 py-4 text-xl font-black uppercase italic"
                  value={rank}
                  onChange={e => setRank(e.target.value)}
                  placeholder="Master Tech / Chief Admin"
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-fugo mb-2">Professional Headline</label>
                <input 
                  type="text"
                  className="w-full bg-fugo-zinc border-4 border-black px-6 py-4 text-xl font-black uppercase italic"
                  value={headline}
                  onChange={e => setHeadline(e.target.value)}
                  placeholder="Reliable & Certified Repair Specialist"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-fugo mb-2">About Me / Professional Bio</label>
              <textarea 
                className="w-full bg-fugo-zinc border-4 border-black px-6 py-4 text-xl font-black uppercase italic h-40 resize-none"
                value={aboutMe}
                onChange={e => setAboutMe(e.target.value)}
                placeholder="Describe your expertise and service philosophy..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-fugo mb-2">Core Expertise (Comma separated)</label>
                <input 
                  type="text"
                  className="w-full bg-fugo-zinc border-4 border-black px-6 py-4 text-xl font-black uppercase italic"
                  value={expertise}
                  onChange={e => setExpertise(e.target.value)}
                  placeholder="Diagnostic, Installation, Safety"
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-fugo mb-2">Certifications (Comma separated)</label>
                <input 
                  type="text"
                  className="w-full bg-fugo-zinc border-4 border-black px-6 py-4 text-xl font-black uppercase italic"
                  value={certifications}
                  onChange={e => setCertifications(e.target.value)}
                  placeholder="EPA Certified, Licensed"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-fugo mb-2">Short Settings Bio / Credentials</label>
              <div className="bg-fugo-zinc border-8 border-black p-8 space-y-8 mb-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest opacity-50 mb-2">Status Headline</label>
                    <input 
                      type="text"
                      className="w-full bg-white border-2 border-black px-4 py-2 text-sm font-black uppercase italic"
                      value={bioStatus}
                      onChange={e => setBioStatus(e.target.value)}
                      placeholder="Active & Accepting New Clients"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest opacity-50 mb-2">Service Guarantee Text</label>
                    <input 
                      type="text"
                      className="w-full bg-white border-2 border-black px-4 py-2 text-sm font-black uppercase italic"
                      value={serviceGuarantee}
                      onChange={e => setServiceGuarantee(e.target.value)}
                      placeholder="90-day warranty on parts and labor..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <label className="flex items-center gap-3 cursor-pointer bg-white p-4 border-2 border-black">
                    <input type="checkbox" checked={isVerified} onChange={e => setIsVerified(e.target.checked)} className="w-5 h-5 accent-fugo" />
                    <span className="text-[10px] font-black uppercase">Verified</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer bg-white p-4 border-2 border-black">
                    <input type="checkbox" checked={isInsured} onChange={e => setIsInsured(e.target.checked)} className="w-5 h-5 accent-fugo" />
                    <span className="text-[10px] font-black uppercase">Insured</span>
                  </label>
                  <div className="col-span-2">
                    <input 
                      type="text"
                      className="w-full bg-white border-2 border-black px-4 py-4 text-sm font-black uppercase italic h-full"
                      value={liabilityAmount}
                      onChange={e => setLiabilityAmount(e.target.value)}
                      placeholder="Liability Amount (e.g. ₹1M)"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest opacity-50 mb-2">License Number</label>
                    <input 
                      type="text"
                      className="w-full bg-white border-2 border-black px-4 py-2 text-sm font-black uppercase italic"
                      value={licenseNumber}
                      onChange={e => setLicenseNumber(e.target.value)}
                      placeholder="License #: 12345678"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest opacity-50 mb-2">Service Restrictions / Notes</label>
                    <input 
                      type="text"
                      className="w-full bg-white border-2 border-black px-4 py-2 text-sm font-black uppercase italic"
                      value={serviceNotes}
                      onChange={e => setServiceNotes(e.target.value)}
                      placeholder="No industrial equipment service..."
                    />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-fugo mb-2">Email Endpoint (Read Only)</label>
              <div className="w-full bg-black/5 border-4 border-black/10 px-6 py-4 text-xl font-black uppercase italic opacity-50">
                {profile.email}
              </div>
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-fugo mb-2">Access Permissions (Role)</label>
              <div className="flex gap-4">
                {(['customer', 'technician', 'admin'] as Role[]).map(r => (
                  <button
                    key={r}
                    onClick={() => setRole(r)}
                    className={cn(
                      "flex-1 py-4 border-4 border-black text-lg font-black uppercase transition-all",
                      role === r ? "bg-black text-white" : "bg-fugo-zinc text-black hover:bg-fugo/20"
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <button 
              onClick={handleSave}
              disabled={saving || !user}
              className="w-full bg-fugo text-black py-6 font-black uppercase text-2xl border-4 border-black hover:bg-black hover:text-white transition-all shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] disabled:opacity-50"
            >
              {saving ? 'Synchronizing...' : 'Save Changes'}
            </button>
          </div>
        </div>

        <div className="bg-black text-white p-10 border-8 border-fugo">
          <h3 className="text-2xl font-black uppercase mb-6 text-fugo">System Information</h3>
          <div className="space-y-4 font-mono text-sm">
            <div className="flex justify-between border-b border-white/20 pb-2">
              <span className="opacity-50 uppercase">Firmware</span>
              <span className="text-fugo">FUGO-OS v2.4.0-STABLE</span>
            </div>
            <div className="flex justify-between border-b border-white/20 pb-2">
              <span className="opacity-50 uppercase">Encryption</span>
              <span className="text-fugo">AES-256-INDUSTRIAL</span>
            </div>
            <div className="flex justify-between border-b border-white/20 pb-2">
              <span className="opacity-50 uppercase">Uptime</span>
              <span className="text-fugo">99.9% TARGET ACQUIRED</span>
            </div>
            <div className="flex justify-between">
              <span className="opacity-50 uppercase">Region</span>
              <span className="text-fugo">WAREHOUSE-01 GLOBAL</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function DetailInput({ label, value, onChange }: { label: string, value: string | undefined, onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-[10px] font-black uppercase tracking-widest text-fugo opacity-60 mb-1">{label}</label>
      <input 
        type="text"
        className="w-full bg-white border-2 border-black px-2 py-1 text-sm font-black uppercase italic"
        value={value || ''}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}

function NavItem({ icon: Icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col md:flex-row items-center justify-center md:justify-start gap-1 md:gap-4 px-2 md:px-4 py-2 md:py-5 transition-all flex-1 md:w-full rounded-2xl md:rounded-none",
        active 
          ? "text-orange-600 md:bg-fugo md:text-fugo-dark font-black" 
          : "text-black/20 md:text-white/60 hover:text-fugo hover:bg-black/5 md:hover:bg-white/5 font-bold"
      )}
    >
      <div className={cn(
        "p-1 rounded-xl transition-all",
        active && "bg-orange-50 md:bg-transparent"
      )}>
        <Icon className={cn("w-5 h-5 md:w-6 md:h-6", active ? "stroke-[3px]" : "stroke-[2px]")} />
      </div>
      <span className="text-[9px] md:text-lg uppercase tracking-tighter md:tracking-normal font-black md:font-black">{label}</span>
      {active && <span className="ml-auto hidden md:block text-2xl">→</span>}
    </button>
  );
}

function Dashboard({ profile, requests, onSelect }: { profile: UserProfile, requests: RepairRequest[], onSelect: (r: RepairRequest) => void }) {
  const [onDuty, setOnDuty] = useState(false);
  const stats = {
    pending: requests.filter(r => r.status === 'pending').length,
    active: requests.filter(r => ['transporting', 'warehouse', 'repairing'].includes(r.status)).length,
    completed: requests.filter(r => r.status === 'completed').length,
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-12 max-w-7xl mx-auto"
    >
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b-8 border-fugo-dark pb-8">
        <div className="flex-1">
          <p className="text-xs font-black uppercase tracking-[0.4em] text-fugo mb-2">User Identification</p>
          <h2 className="text-7xl font-black text-fugo-dark uppercase tracking-tighter leading-none">
            {profile.displayName.split(' ')[0]}
          </h2>
        </div>
        
        {profile.role === 'technician' && (
          <button 
            onClick={() => setOnDuty(!onDuty)}
            className={cn(
              "flex items-center gap-3 px-8 py-4 border-4 border-fugo-dark text-xl font-black uppercase transition-all",
              onDuty ? "bg-fugo-success text-white" : "bg-white text-fugo-dark"
            )}
          >
            <CircleDot className={cn("w-6 h-6", onDuty ? "fill-white" : "fill-fugo-dark")} /> 
            {onDuty ? 'Station Active' : 'Start Station'}
          </button>
        )}
      </header>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-0 border-4 border-fugo-dark">
        {profile.role === 'technician' ? (
          <>
            <StatCard label="Earnings" value={`₹${stats.completed * 450}`} icon={Plus} color="text-fugo-success" />
            <StatCard label="Tasks" value={stats.active} icon={Truck} color="text-fugo" />
            <StatCard label="Pending" value={stats.pending} icon={Clock} color="text-fugo-dark" />
          </>
        ) : (
          <>
            <StatCard label="Pending" value={stats.pending} icon={Clock} color="text-fugo-dark" />
            <StatCard label="In-Transit" value={stats.active} icon={Truck} color="text-fugo" />
            <StatCard label="Finished" value={stats.completed} icon={CheckCircle} color="text-fugo-success" />
          </>
        )}
      </div>

      {/* Active Repairs */}
      <section>
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-4xl font-black uppercase italic tracking-tighter">
            {profile.role === 'customer' ? 'Current Fleet Queue' : 'Repair Manifest'}
          </h3>
          <span className="bg-black text-white px-4 py-1 text-xl font-black tracking-tighter">{requests.length} ITEMS</span>
        </div>
        
        <div className="grid grid-cols-1 gap-0 border-t-4 border-fugo-dark">
          {requests.filter(r => r.status !== 'completed').map(req => (
            <div key={req.id}>
              <RepairCard request={req} onClick={() => onSelect(req)} />
            </div>
          ))}
          {requests.filter(r => r.status !== 'completed').length === 0 && (
            <div className="py-24 text-center border-b-4 border-fugo-dark">
              <History className="w-20 h-20 text-fugo-dark mx-auto mb-4 opacity-10" />
              <p className="text-2xl font-black uppercase opacity-30">No Active Manifests</p>
            </div>
          )}
        </div>
      </section>
    </motion.div>
  );
}

function StatCard({ label, value, icon: Icon, color }: { label: string, value: string | number, icon: any, color: string }) {
  return (
    <div className="bg-white p-10 border-r-4 border-fugo-dark last:border-r-0 flex flex-col justify-center">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-xs font-black uppercase tracking-widest text-fugo">{label}</span>
        <Icon className={cn("w-4 h-4", color)} />
      </div>
      <div className="text-7xl font-black tracking-tighter leading-none">{value}</div>
    </div>
  );
}

function RepairCard({ request, onClick }: { request: RepairRequest, onClick: () => void }) {
  const [elapsed, setElapsed] = useState<string>('00:00:00');
  
  useEffect(() => {
    let interval: any;
    if (request.status === 'repairing' && request.repairStartTime) {
      interval = setInterval(() => {
        const start = (request.repairStartTime as any).toDate?.().getTime() || new Date(request.repairStartTime).getTime();
        const diff = Math.floor((Date.now() - start) / 1000);
        
        const hours = Math.floor(diff / 3600);
        const minutes = Math.floor((diff % 3600) / 60);
        const seconds = diff % 60;
        
        setElapsed(
          `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
        );
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [request.status, request.repairStartTime]);

  const statusConfig: Record<Status, { color: string, bg: string }> = {
    pending: { color: 'text-black', bg: 'bg-amber-400' },
    transporting: { color: 'text-white', bg: 'bg-blue-600' },
    warehouse: { color: 'text-white', bg: 'bg-black' },
    repairing: { color: 'text-black', bg: 'bg-fugo' },
    ready: { color: 'text-white', bg: 'bg-fugo-success' },
    completed: { color: 'text-white', bg: 'bg-gray-400' }
  };

  const config = statusConfig[request.status];

  return (
    <button 
      onClick={onClick}
      className="w-full py-8 px-4 flex items-center justify-between border-b-2 border-fugo-dark hover:bg-fugo/5 transition-colors group"
    >
      <div className="flex items-center gap-8">
        <span className="text-xl font-black text-black/20 font-mono tracking-tighter">
          {request.id.slice(-4)}
        </span>
        <div>
          <h4 className="text-4xl font-black uppercase italic tracking-tighter leading-none">{request.vehicleName}</h4>
          <div className="flex items-center gap-4 mt-1">
            <p className="text-sm font-bold uppercase tracking-widest text-fugo">{request.vehiclePlate}</p>
            <p className="text-sm font-bold uppercase tracking-widest text-fugo/50 italic">{request.rcNumber}</p>
            {request.rating && (
              <span className="text-fugo text-sm">{'★'.repeat(request.rating)}</span>
            )}
          </div>
          {request.customerName && (
            <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mt-2">Client: {request.customerName}</p>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-12">
        <div className="hidden lg:block text-right">
          <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Service</p>
          <p className="text-sm font-black uppercase italic">{request.serviceType}</p>
        </div>
        <div className="hidden lg:block text-right">
          <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Sourcing</p>
          <p className="text-sm font-black uppercase italic">{request.partPreference === 'brand' ? 'OEM' : '3rd'}</p>
        </div>
        <div className="hidden lg:block text-right">
          <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Price</p>
          <p className="text-sm font-black uppercase italic text-fugo">{request.price ? `₹${request.price}` : 'Estimating'}</p>
        </div>
        <div className="hidden lg:block text-right">
          <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Origin</p>
          <p className="text-sm font-black uppercase italic text-orange-600">Fuel App</p>
        </div>
        <div className={cn("px-6 py-2 font-black uppercase tracking-tighter text-xl flex flex-col items-center", config.bg, config.color)}>
          <span>{request.status}</span>
          {request.status === 'repairing' && (
            <span className="text-xs font-mono">{elapsed}</span>
          )}
        </div>
        <ChevronRight className="w-8 h-8 text-fugo group-hover:translate-x-2 transition-transform" />
      </div>
    </button>
  );
}

function RepairForm({ profile, onSuccess, onCancel }: { profile: UserProfile, onSuccess: () => void, onCancel: () => void }) {
  const [loading, setLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [formData, setFormData] = useState({
    vehicleName: '',
    customerName: profile?.displayName || '',
    customerPhone: profile?.phoneNumber || '',
    rcNumber: '',
    vehiclePlate: '',
    make: '',
    model: '',
    year: '',
    fuelType: '',
    engineCapacity: '',
    registrationDate: '',
    description: '',
    estimatedTiming: '',
    serviceType: 'offline' as ServiceType,
    partPreference: 'brand' as PartPreference,
    photoUrl: '',
    parts: [] as { name: string, sourcing: PartPreference }[]
  });

  const addPartSuggestion = () => {
    setFormData(prev => ({
      ...prev,
      parts: [...prev.parts, { name: '', sourcing: prev.partPreference }]
    }));
  };

  const removePart = (index: number) => {
    setFormData(prev => ({
      ...prev,
      parts: prev.parts.filter((_, i) => i !== index)
    }));
  };

  const updatePart = (index: number, updates: Partial<{ name: string, sourcing: PartPreference }>) => {
    setFormData(prev => ({
      ...prev,
      parts: prev.parts.map((p, i) => i === index ? { ...p, ...updates } : p)
    }));
  };

  const lookupRC = async () => {
    if (!formData.rcNumber) return;
    setLookupLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `Lookup vehicle details for Indian Registration Certificate (RC) number: ${formData.rcNumber}. 
      Try to find the Make, Model, Manufacturing Year, Fuel Type, Engine Capacity, and Registration Date. 
      If you can't find specific details for this record, provide the most likely details for this series or placeholders.
      Return the data in a strict JSON format.`;

      const result = await ai.models.generateContent({
        model: "gemini-3-flash-latest",
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              make: { type: Type.STRING },
              model: { type: Type.STRING },
              year: { type: Type.STRING },
              fuelType: { type: Type.STRING },
              engineCapacity: { type: Type.STRING },
              registrationDate: { type: Type.STRING },
              vehicleName: { type: Type.STRING, description: "Display name like 'Toyota Camry'" }
            },
            required: ["make", "model", "vehicleName"]
          }
        }
      });

      const details = JSON.parse(result.text);
      setFormData(prev => ({
        ...prev,
        make: details.make || prev.make,
        model: details.model || prev.model,
        year: details.year || prev.year,
        fuelType: details.fuelType || prev.fuelType,
        engineCapacity: details.engineCapacity || prev.engineCapacity,
        registrationDate: details.registrationDate || prev.registrationDate,
        vehicleName: details.vehicleName || prev.vehicleName
      }));
    } catch (err) {
      console.error("RC Lookup failed", err);
    } finally {
      setLookupLoading(false);
    }
  };

  const handlePhotoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Basic size check (1MB limit for base64 in Firestore documents is tight, but okay for previews)
    if (file.size > 1024 * 1024) {
      alert("Photo too large. Please upload an image smaller than 1MB.");
      return;
    }

    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, photoUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Photo processing failed", err);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (!auth.currentUser) {
        alert("Session expired. Please Sign In again.");
        return;
      }
      const requestId = `REQ-${Date.now()}`;
      const newRequest: any = {
        id: requestId,
        userId: auth.currentUser.uid,
        customerName: formData.customerName,
        ...formData,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(doc(db, 'repair_requests', requestId), newRequest);
      onSuccess();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'repair_requests');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full bg-white border-4 border-fugo-dark px-6 py-4 text-xl font-black uppercase tracking-tighter focus:outline-none focus:bg-fugo transition-all italic";
  const labelClass = "block text-xs font-black text-fugo uppercase mb-2 tracking-[0.3em]";

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="max-w-4xl mx-auto"
    >
      <div className="mb-12">
        <h2 className="text-3xl font-black uppercase tracking-tighter italic">Service Registration</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div>
            <label className={labelClass}>Customer Name</label>
            <input 
              required
              placeholder="e.g. John Doe"
              className={inputClass}
              value={formData.customerName}
              onChange={e => setFormData({...formData, customerName: e.target.value})}
            />
          </div>

          <div>
            <label className={labelClass}>Contact Number</label>
            <input 
              required
              placeholder="e.g. 9845xxxxxx"
              className={inputClass}
              value={formData.customerPhone}
              onChange={e => setFormData({...formData, customerPhone: e.target.value})}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div>
            <label className={labelClass}>Vehicle Name</label>
            <input 
              required
              placeholder="e.g. Toyota Fortuner"
              className={inputClass}
              value={formData.vehicleName}
              onChange={e => setFormData({...formData, vehicleName: e.target.value})}
            />
          </div>

          <div>
            <label className={labelClass}>RC Number</label>
            <div className="flex gap-2">
              <input 
                required
                placeholder="e.g. MH12AB1234"
                className={cn(inputClass, "flex-1")}
                value={formData.rcNumber}
                onChange={e => setFormData({...formData, rcNumber: e.target.value})}
              />
              <button 
                type="button"
                onClick={lookupRC}
                disabled={lookupLoading || !formData.rcNumber}
                className="bg-black text-fugo px-6 hover:bg-fugo hover:text-black transition-all flex items-center gap-2 font-black uppercase text-xs disabled:opacity-50"
              >
                {lookupLoading ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                    < Zap className="w-4 h-4" />
                  </motion.div>
                ) : (
                  <Search className="w-4 h-4" />
                )}
                <span>Lookup</span>
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div>
            <label className={labelClass}>Plate Number</label>
            <input 
              required
              placeholder="e.g. MH 12 AB 1234"
              className={inputClass}
              value={formData.vehiclePlate}
              onChange={e => setFormData({...formData, vehiclePlate: e.target.value})}
            />
          </div>

          <div>
            <label className={labelClass}>Estimated Repair Time</label>
            <input 
              placeholder="e.g. 2-3 Days"
              className={inputClass}
              value={formData.estimatedTiming}
              onChange={e => setFormData({...formData, estimatedTiming: e.target.value})}
            />
          </div>
        </div>

        {/* Rich vehicle details fetched via RC */}
        <AnimatePresence>
          {(formData.make || formData.model || formData.year) && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="bg-fugo-zinc border-8 border-black p-8 space-y-8"
            >
              <div className="flex items-center gap-4 border-b-2 border-black/10 pb-4">
                <Info className="w-6 h-6 text-fugo" />
                <h4 className="text-xl font-black uppercase italic">Verified Vehicle Specs</h4>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
                <DetailInput label="Manufacturer" value={formData.make} onChange={v => setFormData({...formData, make: v})} />
                <DetailInput label="Model" value={formData.model} onChange={v => setFormData({...formData, model: v})} />
                <DetailInput label="Year" value={formData.year} onChange={v => setFormData({...formData, year: v})} />
                <DetailInput label="Fuel Type" value={formData.fuelType} onChange={v => setFormData({...formData, fuelType: v})} />
                <DetailInput label="Engine" value={formData.engineCapacity} onChange={v => setFormData({...formData, engineCapacity: v})} />
                <DetailInput label="Reg. Date" value={formData.registrationDate} onChange={v => setFormData({...formData, registrationDate: v})} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div>
            <label className={labelClass}>Repair Mode Select</label>
            <div className="flex gap-4">
              <button
                type="button"
                className={cn("flex-1 py-6 border-4 border-black text-2xl font-black uppercase transition-all", formData.serviceType === 'offline' ? "bg-black text-white" : "bg-white text-black hover:bg-fugo/10")}
                onClick={() => setFormData({...formData, serviceType: 'offline'})}
              >
                Warehouse Visit
              </button>
              <button
                type="button"
                className={cn("flex-1 py-6 border-4 border-black text-2xl font-black uppercase transition-all", formData.serviceType === 'online' ? "bg-black text-white" : "bg-white text-black hover:bg-fugo/10")}
                onClick={() => setFormData({...formData, serviceType: 'online'})}
              >
                Mobile Check-in (Diag: ₹450)
              </button>
            </div>
          </div>
          <div>
            <label className={labelClass}>Components Sourcing</label>
            <div className="flex gap-4">
              <button
                type="button"
                className={cn("flex-1 py-6 border-4 border-black text-2xl font-black uppercase transition-all", formData.partPreference === 'brand' ? "bg-black text-white" : "bg-white text-black hover:bg-fugo/10")}
                onClick={() => setFormData({...formData, partPreference: 'brand'})}
              >
                OEM Brand
              </button>
              <button
                type="button"
                className={cn("flex-1 py-6 border-4 border-black text-2xl font-black uppercase transition-all", formData.partPreference === 'third-party' ? "bg-black text-white" : "bg-white text-black hover:bg-fugo/10")}
                onClick={() => setFormData({...formData, partPreference: 'third-party'})}
              >
                3rd Party
              </button>
            </div>
          </div>
        </div>

        <div>
          <label className={labelClass}>Problem Description (Vehicle Issues)</label>
          <textarea 
            rows={4}
            required
            placeholder="Document all known critical issues..."
            className={cn(inputClass, "resize-none h-40")}
            value={formData.description}
            onChange={e => setFormData({...formData, description: e.target.value})}
          />
        </div>

        {/* Individual Parts Sourcing */}
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b-4 border-black pb-2">
            <label className={labelClass}>Identified Components & Sourcing Preference</label>
            <button 
              type="button"
              onClick={addPartSuggestion}
              className="bg-black text-fugo px-4 py-1 text-[10px] font-black uppercase hover:bg-fugo hover:text-black transition-all"
            >
              + Add Component
            </button>
          </div>
          
          <div className="space-y-4">
            {formData.parts.map((part, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col md:flex-row gap-4 items-end bg-white p-6 border-4 border-black group"
              >
                <div className="flex-1 w-full">
                  <label className="text-[10px] font-black uppercase opacity-40 mb-1 block">Component Name</label>
                  <input 
                    type="text"
                    required
                    placeholder="e.g. Brake Pads"
                    className="w-full bg-fugo-zinc border-2 border-black px-4 py-2 text-sm font-bold uppercase italic"
                    value={part.name}
                    onChange={e => updatePart(idx, { name: e.target.value })}
                  />
                </div>
                <div className="w-full md:w-64">
                  <label className="text-[10px] font-black uppercase opacity-40 mb-1 block">Sourcing</label>
                  <div className="flex border-2 border-black">
                    <button
                      type="button"
                      className={cn("flex-1 py-2 text-[10px] font-black uppercase transition-all", part.sourcing === 'brand' ? "bg-black text-white" : "bg-white text-black")}
                      onClick={() => updatePart(idx, { sourcing: 'brand' })}
                    >
                      OEM
                    </button>
                    <button
                      type="button"
                      className={cn("flex-1 py-2 text-[10px] font-black uppercase transition-all", part.sourcing === 'third-party' ? "bg-black text-white" : "bg-white text-black")}
                      onClick={() => updatePart(idx, { sourcing: 'third-party' })}
                    >
                      3rd Party
                    </button>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => removePart(idx)}
                  className="bg-red-500 text-white p-2 hover:bg-black transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
            {formData.parts.length === 0 && (
              <p className="text-[10px] font-bold uppercase opacity-30 italic">No specific parts listed. Technician will diagnose.</p>
            )}
          </div>
        </div>

        <div>
          <label className={labelClass}>Visual Documentation (Photo)</label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="relative group">
              <input 
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className="border-4 border-dashed border-fugo-dark/20 p-8 flex flex-col items-center justify-center bg-white group-hover:border-fugo transition-colors">
                <Upload className="w-8 h-8 text-fugo mb-2" />
                <span className="text-xs font-black uppercase tracking-widest text-fugo-dark/60">Upload Image</span>
                <span className="text-[10px] font-bold opacity-40 mt-1 italic">Max size: 1MB</span>
              </div>
            </div>
            
            {formData.photoUrl && (
              <div className="relative border-4 border-fugo-dark bg-black">
                <img 
                  src={formData.photoUrl} 
                  alt="Preview" 
                  className="w-full h-40 object-cover opacity-80" 
                />
                <button 
                  type="button"
                  onClick={() => setFormData({...formData, photoUrl: ''})}
                  className="absolute top-2 right-2 bg-black text-white p-1 hover:bg-fugo transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="absolute bottom-0 left-0 right-0 bg-fugo text-black px-2 py-1 text-[10px] font-black uppercase">
                  Image Staged
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="pt-8 flex flex-col md:flex-row gap-6">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-black text-white py-8 px-12 font-black uppercase text-3xl hover:bg-fugo hover:text-black transition-all shadow-[12px_12px_0px_0px_rgba(234,88,12,1)]"
          >
            {loading ? 'Processing...' : 'Authorize Service'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-12 py-8 bg-white border-4 border-black font-black uppercase text-xl hover:bg-black hover:text-white transition-all"
          >
            Abort
          </button>
        </div>
      </form>
    </motion.div>
  );
}

function RepairDetails({ request, profile, onBack }: { request: RepairRequest, profile: UserProfile, onBack: () => void }) {
  const steps: Status[] = ['pending', 'transporting', 'warehouse', 'repairing', 'ready', 'completed'];
  const currentIndex = steps.indexOf(request.status);

  // Timer logic
  const [elapsed, setElapsed] = useState<string>('00:00:00');
  
  useEffect(() => {
    let interval: any;
    if (request.status === 'repairing' && request.repairStartTime) {
      interval = setInterval(() => {
        const start = (request.repairStartTime as any).toDate?.().getTime() || new Date(request.repairStartTime).getTime();
        const diff = Math.floor((Date.now() - start) / 1000);
        
        const hours = Math.floor(diff / 3600);
        const minutes = Math.floor((diff % 3600) / 60);
        const seconds = diff % 60;
        
        setElapsed(
          `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
        );
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [request.status, request.repairStartTime]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="max-w-7xl mx-auto space-y-12"
    >
      <button onClick={onBack} className="bg-black text-white px-6 py-2 text-sm font-black uppercase tracking-widest hover:bg-fugo transition-colors">
        ← Return to Terminal
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-8 flex flex-col">
          <div className="bg-fugo p-12 border-8 border-black">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
              <div className="flex-1">
                <p className="text-xs font-black uppercase tracking-[0.4em] mb-2 bg-black text-fugo inline-block px-2">Manifest Record</p>
                <div className="flex items-center gap-4 mb-2">
                   <h2 className="text-8xl font-black uppercase tracking-tighter leading-none italic">{request.vehicleName}</h2>
                   {request.status === 'repairing' && (
                     <div className="bg-black text-fugo px-6 py-2 rounded-full flex items-center gap-3 ml-4 animate-pulse">
                        <Clock className="w-6 h-6" />
                        <span className="text-3xl font-black font-mono tracking-tighter">{elapsed}</span>
                     </div>
                   )}
                </div>
                <div className="flex flex-wrap items-center gap-4 mt-4">
                  <span className="text-2xl font-black font-mono bg-black text-white px-4">{request.vehiclePlate}</span>
                  <span className="text-2xl font-black font-mono border-4 border-black px-4">{request.rcNumber}</span>
                  <span className="text-xs font-black uppercase tracking-widest opacity-60">ID: {request.id}</span>
                </div>

                <div className="flex gap-12 mt-8 py-8 border-t-4 border-black">
                   <div>
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Client Name</p>
                      <p className="text-2xl font-black uppercase italic">{request.customerName || 'Standard User'}</p>
                   </div>
                   {request.customerPhone && (
                     <div>
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Contact Number</p>
                        <p className="text-2xl font-black uppercase italic">{request.customerPhone}</p>
                     </div>
                   )}
                </div>

                {/* Show rich vehicle data if available */}
                {(request.make || request.model || request.year) && (
                  <div className="mt-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 p-6 border-8 border-black/10 bg-white/40">
                    {request.make && <div className="space-y-1 font-black"><p className="text-[10px] uppercase opacity-40">Make</p><p className="text-xs uppercase italic">{request.make}</p></div>}
                    {request.model && <div className="space-y-1 font-black"><p className="text-[10px] uppercase opacity-40">Model</p><p className="text-xs uppercase italic">{request.model}</p></div>}
                    {request.year && <div className="space-y-1 font-black"><p className="text-[10px] uppercase opacity-40">Year</p><p className="text-xs uppercase italic">{request.year}</p></div>}
                    {request.fuelType && <div className="space-y-1 font-black"><p className="text-[10px] uppercase opacity-40">Fuel</p><p className="text-xs uppercase italic">{request.fuelType}</p></div>}
                    {request.engineCapacity && <div className="space-y-1 font-black"><p className="text-[10px] uppercase opacity-40">Engine</p><p className="text-xs uppercase italic">{request.engineCapacity}</p></div>}
                    {request.registrationDate && <div className="space-y-1 font-black"><p className="text-[10px] uppercase opacity-40">Registered</p><p className="text-xs uppercase italic">{request.registrationDate}</p></div>}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mt-12 bg-black text-white p-10">
              <div>
                <h4 className="text-xs font-black uppercase tracking-widest text-fugo mb-6">Problem Description (Vehicle Issues)</h4>
                <p className="text-2xl font-bold uppercase italic leading-tight">{request.description}</p>
              </div>
              <div className="flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex justify-between border-b border-white/20 pb-2">
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-50">Repair Mode</span>
                    <span className="text-sm font-black uppercase italic">{request.serviceType}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/20 pb-2">
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-50">Components</span>
                    <span className="text-sm font-black uppercase italic">
                      {request.partPreference === 'brand' ? 'OEM Brand' : '3rd Party'}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-white/20 pb-2">
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-50">Order Origin</span>
                    <span className="text-sm font-black uppercase italic text-fugo">FUGO FUEL APP</span>
                  </div>
                  {request.estimatedTiming && (
                    <div className="flex justify-between border-b border-white/20 pb-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-fugo">Estimated Delivery</span>
                      <span className="text-sm font-black uppercase italic text-fugo">{request.estimatedTiming}</span>
                    </div>
                  )}
                  {request.price && (
                    <div className="flex justify-between border-b border-white/20 pb-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-fugo">Fixed Price</span>
                      <span className="text-lg font-black uppercase text-fugo italic">₹{request.price}</span>
                    </div>
                  )}
                  {request.repairComplexity && (
                    <div className="flex justify-between border-b border-white/20 pb-2">
                      <span className="text-[10px] font-black uppercase tracking-widest opacity-50">Assessment</span>
                      <span className="text-sm font-black uppercase italic">{request.repairComplexity} Repair</span>
                    </div>
                  )}
                </div>

                <div className="mt-8">
                  <span className="text-[10px] font-black uppercase tracking-widest opacity-50 block mb-1">Time Initiated</span>
                  <p className="text-xl font-bold">{(request.createdAt as any).toDate?.().toLocaleString() || new Date(request.createdAt).toLocaleString()}</p>
                </div>

                {request.photoUrl && (
                  <div className="mt-12">
                    <h4 className="text-xs font-black uppercase tracking-widest text-fugo mb-4">Visual Evidence</h4>
                    <div className="border-8 border-black overflow-hidden bg-black">
                      <img 
                        src={request.photoUrl} 
                        alt="Vehicle Issue" 
                        className="w-full h-auto max-h-[400px] object-contain" 
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quote Selection (for Customer) */}
          {request.status === 'pending' && profile.role === 'customer' && (request.oemPrice || request.thirdPartyPrice) && !request.price && (
            <div className="mt-12 space-y-8">
              <h3 className="text-4xl font-black uppercase italic tracking-tighter">Quote Selection Required</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {request.oemPrice && (
                  <button 
                    onClick={async () => {
                      try {
                        await setDoc(doc(db, 'repair_requests', request.id), {
                          ...request,
                          price: request.oemPrice,
                          partPreference: 'brand',
                          status: 'repairing',
                          updatedAt: serverTimestamp()
                        });
                      } catch (err) {
                        handleFirestoreError(err, OperationType.UPDATE, `repair_requests/${request.id}`);
                      }
                    }}
                    className="p-8 border-8 border-black bg-white hover:bg-fugo transition-all text-left flex flex-col justify-between"
                  >
                    <div>
                      <span className="bg-black text-fugo px-2 py-1 text-xs font-black uppercase">OEM OPTION</span>
                      <h4 className="text-5xl font-black uppercase italic tracking-tighter mt-4">BRAND NEW</h4>
                    </div>
                    <div className="mt-12 flex justify-between items-end">
                      <span className="text-[10px] font-black uppercase opacity-60 italic">Certified Parts Guaranteed</span>
                      <span className="text-6xl font-black tracking-tighter">₹{request.oemPrice}</span>
                    </div>
                  </button>
                )}
                {request.thirdPartyPrice && (
                  <button 
                    onClick={async () => {
                      try {
                        await setDoc(doc(db, 'repair_requests', request.id), {
                          ...request,
                          price: request.thirdPartyPrice,
                          partPreference: 'third-party',
                          status: 'repairing',
                          updatedAt: serverTimestamp()
                        });
                      } catch (err) {
                        handleFirestoreError(err, OperationType.UPDATE, `repair_requests/${request.id}`);
                      }
                    }}
                    className="p-8 border-8 border-black bg-black text-white hover:bg-fugo hover:text-black transition-all text-left flex flex-col justify-between"
                  >
                    <div>
                      <span className="bg-fugo text-black px-2 py-1 text-xs font-black uppercase">3RD PARTY OPTION</span>
                      <h4 className="text-5xl font-black uppercase italic tracking-tighter mt-4">PERFORMANCE</h4>
                    </div>
                    <div className="mt-12 flex justify-between items-end">
                      <span className="text-[10px] font-black uppercase opacity-60 italic">High-Grade Verified Parts</span>
                      <span className="text-6xl font-black tracking-tighter text-fugo">₹{request.thirdPartyPrice}</span>
                    </div>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Financial Audit / Itemized Bill */}
          {((request.parts && request.parts.length > 0) || request.servicePrice || request.repairPrice) && (
            <div className="mt-12 bg-fugo-zinc border-8 border-black p-12">
              <div className="flex items-center justify-between mb-8 border-b-4 border-black pb-4">
                <h3 className="text-4xl font-black uppercase italic tracking-tighter">Financial Audit</h3>
                <span className="bg-black text-fugo px-3 py-1 text-sm font-black uppercase">Invoice #{(request.id).split('-')[1] || request.id}</span>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-12 gap-4 text-[10px] font-black uppercase tracking-widest opacity-40 border-b border-black/10 pb-2">
                  <div className="col-span-6">Description</div>
                  <div className="col-span-3 text-center">Sourcing</div>
                  <div className="col-span-3 text-right">Amount</div>
                </div>

                {request.parts?.map((part, i) => (
                  <div key={i} className="grid grid-cols-12 gap-4 items-center py-2 border-b border-black/5">
                    <div className="col-span-6 text-xl font-black uppercase tracking-tighter italic">{part.name}</div>
                    <div className="col-span-3 text-center">
                      <span className={cn(
                        "px-2 py-0.5 text-[10px] font-black uppercase border-2",
                        part.sourcing === 'brand' ? "border-fugo text-fugo bg-black" : "border-black text-black"
                      )}>
                        {part.sourcing === 'brand' ? 'OEM BRAND' : '3RD PARTY'}
                      </span>
                    </div>
                    <div className="col-span-3 text-right text-2xl font-black font-mono">
                      {part.price !== undefined ? `₹${part.price}` : 'QUOTE PENDING'}
                    </div>
                  </div>
                ))}

                {request.repairPrice && (
                  <div className="grid grid-cols-12 gap-4 items-center py-4 border-b border-black/20">
                    <div className="col-span-6 flex flex-col">
                      <span className="text-xl font-black uppercase tracking-tighter italic text-fugo-dark">Repair Labor</span>
                      <span className="text-[10px] uppercase font-bold opacity-40">Industrial grade servicing and alignment</span>
                    </div>
                    <div className="col-span-3 text-center text-[10px] font-bold opacity-40 italic">SERVICE</div>
                    <div className="col-span-3 text-right text-2xl font-black font-mono text-fugo-dark">₹{request.repairPrice}</div>
                  </div>
                )}

                {request.servicePrice && (
                  <div className="grid grid-cols-12 gap-4 items-center py-4 border-b border-black/20">
                    <div className="col-span-6 flex flex-col">
                      <span className="text-xl font-black uppercase tracking-tighter italic">Service / Visit Fee</span>
                      <span className="text-[10px] uppercase font-bold opacity-40">Logistics and mobile station deployment</span>
                    </div>
                    <div className="col-span-3 text-center text-[10px] font-bold opacity-40 italic">LOGISTICS</div>
                    <div className="col-span-3 text-right text-2xl font-black font-mono">₹{request.servicePrice}</div>
                  </div>
                )}

                <div className="pt-8 flex justify-between items-end">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase tracking-widest text-fugo-dark/40">Authorized Approval</span>
                    <div className="w-32 h-10 border-b-2 border-black/20 italic font-mono text-xs flex items-end pb-1 opacity-20">X________________</div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-black uppercase tracking-widest text-fugo">Terminal Grand Total</span>
                    <div className="text-8xl font-black tracking-tighter leading-none bg-black text-fugo px-6 py-2 -mr-12 shadow-[12px_12px_0px_0px_rgba(0,0,0,0.2)]">
                      ₹{(request.parts?.reduce((sum, p) => sum + (p.price || 0), 0) || 0) + (request.servicePrice || 0) + (request.repairPrice || 0)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="mt-12 bg-white border-4 border-black p-12">
            <h3 className="text-xs font-black uppercase tracking-[0.4em] text-fugo mb-12">Operational Timeline</h3>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-0">
                {steps.map((step, idx) => (
                  <div key={step} className={cn(
                    "p-6 border-4 border-black -ml-1 -mt-1 flex flex-col items-center text-center transition-all",
                    idx === currentIndex ? "bg-fugo-dark text-fugo scale-110 z-10 shadow-[8px_8px_0px_0px_rgba(234,88,12,1)]" : 
                    idx < currentIndex ? "bg-fugo text-black" : "bg-white opacity-20"
                  )}>
                    <div className="text-[10px] font-black uppercase tracking-widest mb-4">Step 0{idx+1}</div>
                    <div className="text-xs font-black uppercase whitespace-nowrap">{step}</div>
                  </div>
                ))}
            </div>
          </div>

          {/* Feedback Section */}
          {request.status === 'completed' && profile.role === 'customer' && (
            <div className="mt-12 bg-orange-600 text-white p-12 border-8 border-black">
              <h3 className="text-4xl font-black uppercase italic tracking-tighter mb-8">How was your station experience?</h3>
              <div className="flex gap-4">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button 
                    key={star}
                    onClick={async () => {
                      try {
                        await setDoc(doc(db, 'repair_requests', request.id), {
                          ...request,
                          rating: star,
                          updatedAt: serverTimestamp()
                        });
                      } catch (err) {
                        handleFirestoreError(err, OperationType.UPDATE, `repair_requests/${request.id}`);
                      }
                    }}
                    className={cn(
                      "text-6xl transition-all hover:scale-110",
                      (request.rating || 0) >= star ? "text-fugo" : "text-white/20"
                    )}
                  >
                    ★
                  </button>
                ))}
              </div>
              <p className="mt-8 text-xs font-black uppercase tracking-widest opacity-60">Terminal feedback helps us optimize protocols.</p>
            </div>
          )}
        </div>

        <div className="lg:col-span-4 space-y-12">
          {/* Admin Station */}
          {(profile.role === 'technician' || profile.role === 'admin') ? (
            <div className="bg-black text-white p-12 border-8 border-fugo">
              <h3 className="text-4xl font-black uppercase tracking-tighter mb-8 flex items-center gap-4">
                <LayoutDashboard className="w-8 h-8 text-fugo" /> 
                STATION
              </h3>
              
              <div className="space-y-8">
                {request.status !== 'repairing' && request.status !== 'completed' && request.status !== 'ready' && (
                  <button 
                    onClick={async () => {
                      try {
                        await setDoc(doc(db, 'repair_requests', request.id), {
                          ...request,
                          status: 'repairing',
                          repairStartTime: serverTimestamp(),
                          updatedAt: serverTimestamp()
                        });
                      } catch (err) {
                        handleFirestoreError(err, OperationType.UPDATE, `repair_requests/${request.id}`);
                      }
                    }}
                    className="w-full bg-fugo text-black py-8 font-black uppercase text-3xl border-4 border-black hover:bg-white transition-all shadow-[8px_8px_0px_0px_rgba(255,255,255,0.2)]"
                  >
                    Start Service
                  </button>
                )}

                <div>
                  <label className="text-xs font-black uppercase tracking-widest text-fugo mb-4 block">State Override</label>
                  <select 
                    className="w-full bg-fugo-dark border-4 border-fugo text-white p-5 text-2xl font-black uppercase tracking-tighter focus:outline-none appearance-none"
                    value={request.status}
                    onChange={async (e) => {
                      const newStatus = e.target.value as Status;
                      try {
                        await setDoc(doc(db, 'repair_requests', request.id), {
                          ...request,
                          status: newStatus,
                          updatedAt: serverTimestamp()
                        });
                      } catch (err) {
                        handleFirestoreError(err, OperationType.UPDATE, `repair_requests/${request.id}`);
                      }
                    }}
                  >
                    {steps.map(s => <option key={s} value={s} className="bg-fugo-dark text-white">{s}</option>)}
                  </select>
                </div>

                <div>
                   <label className="text-xs font-black uppercase tracking-widest text-fugo mb-4 block">Update Timing & Price</label>
                   <div className="flex flex-col gap-4">
                      <div className="flex gap-2">
                         <input 
                           type="text"
                           placeholder="e.g. 2 Hours"
                           className="flex-1 bg-fugo-dark border-4 border-fugo text-white px-4 py-2 font-black uppercase text-sm"
                           id="update-timing-input"
                           defaultValue={request.estimatedTiming}
                         />
                         <button 
                           onClick={async () => {
                             const el = document.getElementById('update-timing-input') as HTMLInputElement;
                             try {
                               await setDoc(doc(db, 'repair_requests', request.id), {
                                 ...request,
                                 estimatedTiming: el.value,
                                 updatedAt: serverTimestamp()
                               });
                             } catch (err) {
                               handleFirestoreError(err, OperationType.UPDATE, `repair_requests/${request.id}`);
                             }
                           }}
                           className="bg-fugo text-black px-4 font-black uppercase text-xs"
                         >
                           SET TIME
                         </button>
                      </div>
                      <div className="flex gap-2">
                         <input 
                           type="text"
                           placeholder="e.g. 1500"
                           className="flex-1 bg-fugo-dark border-4 border-fugo text-white px-4 py-2 font-black uppercase text-sm"
                           id="update-price-input"
                           defaultValue={request.price}
                         />
                         <button 
                           onClick={async () => {
                             const el = document.getElementById('update-price-input') as HTMLInputElement;
                             try {
                               await setDoc(doc(db, 'repair_requests', request.id), {
                                 ...request,
                                 price: el.value,
                                 updatedAt: serverTimestamp()
                               });
                             } catch (err) {
                               handleFirestoreError(err, OperationType.UPDATE, `repair_requests/${request.id}`);
                             }
                           }}
                           className="bg-orange-600 text-white px-4 font-black uppercase text-xs"
                         >
                           SET PRICE
                         </button>
                      </div>
                   </div>
                </div>

                {request.serviceType === 'online' && !request.repairComplexity && (
                   <div className="space-y-3">
                     <label className="text-xs font-black uppercase tracking-widest text-fugo block">Assessment (Mobile Check)</label>
                     <div className="flex gap-2">
                        <button 
                          onClick={async () => {
                            try {
                              await setDoc(doc(db, 'repair_requests', request.id), {
                                ...request,
                                repairComplexity: 'light',
                                status: 'repairing',
                                updatedAt: serverTimestamp()
                              });
                            } catch (err) {
                              handleFirestoreError(err, OperationType.UPDATE, `repair_requests/${request.id}`);
                            }
                          }}
                          className="flex-1 bg-fugo-success text-white py-2 font-black uppercase text-xs"
                        >
                          Light (Fix On Spot)
                        </button>
                        <button 
                          onClick={async () => {
                            try {
                              await setDoc(doc(db, 'repair_requests', request.id), {
                                ...request,
                                repairComplexity: 'heavy',
                                status: 'transporting',
                                updatedAt: serverTimestamp()
                              });
                            } catch (err) {
                              handleFirestoreError(err, OperationType.UPDATE, `repair_requests/${request.id}`);
                            }
                          }}
                          className="flex-1 bg-amber-600 text-white py-2 font-black uppercase text-xs"
                        >
                          Heavy (To Warehouse)
                        </button>
                     </div>
                   </div>
                )}

                {((request.serviceType === 'offline' && !request.price) || (request.serviceType === 'online' && request.repairComplexity === 'light' && !request.price)) && (
                   <div className="space-y-8">
                     <div className="space-y-6 p-6 border-2 border-fugo/30 bg-black/20">
                       <h4 className="text-xs font-black uppercase tracking-widest text-fugo border-b border-fugo/20 pb-2">Diagnostic Workbench</h4>
                       
                       <div className="space-y-6">
                         {/* Parts Entry */}
                         <div className="space-y-3">
                           <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Add Components</p>
                           <div className="flex flex-wrap gap-2">
                             <input 
                               type="text" 
                               placeholder="Part Name" 
                               className="flex-[2] min-w-[150px] bg-fugo-dark border-b border-fugo text-white px-2 py-1 text-sm font-bold uppercase"
                               id="part-name-input"
                             />
                             <input 
                               type="number" 
                               placeholder="Price" 
                               className="flex-1 min-w-[80px] bg-fugo-dark border-b border-fugo text-white px-2 py-1 text-sm font-bold"
                               id="part-price-input"
                             />
                             <select 
                               className="bg-fugo-dark border-b border-fugo text-white px-2 py-1 text-sm font-bold uppercase"
                               id="part-sourcing-input"
                               defaultValue={request.partPreference}
                             >
                               <option value="brand">OEM</option>
                               <option value="third-party">3RD</option>
                             </select>
                             <button 
                               onClick={async () => {
                                 const nameEl = document.getElementById('part-name-input') as HTMLInputElement;
                                 const priceEl = document.getElementById('part-price-input') as HTMLInputElement;
                                 const sourcingEl = document.getElementById('part-sourcing-input') as HTMLSelectElement;
                                 if (!nameEl.value || !priceEl.value) return;
                                 
                                 const newPart = { 
                                   name: nameEl.value, 
                                   price: Number(priceEl.value),
                                   sourcing: sourcingEl.value as PartPreference 
                                 };
                                 const updatedParts = [...(request.parts || []), newPart];
                                 
                                 try {
                                   await setDoc(doc(db, 'repair_requests', request.id), {
                                     ...request,
                                     parts: updatedParts,
                                     updatedAt: serverTimestamp()
                                   });
                                   nameEl.value = '';
                                   priceEl.value = '';
                                 } catch (err) {
                                   handleFirestoreError(err, OperationType.UPDATE, `repair_requests/${request.id}`);
                                 }
                               }}
                               className="bg-fugo text-black px-4 font-black text-xs h-10"
                             >
                               ADD
                             </button>
                           </div>
                         </div>

                         {/* Labor & Logistics */}
                         <div className="grid grid-cols-2 gap-4">
                           <div className="space-y-2">
                             <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Repair Labor</p>
                             <div className="flex gap-2">
                               <input 
                                 type="number" 
                                 placeholder="Amount" 
                                 className="flex-1 bg-fugo-dark border-b border-fugo text-white px-2 py-1 text-xs font-bold"
                                 id="repair-price-input"
                                 defaultValue={request.repairPrice}
                               />
                               <button 
                                 onClick={async () => {
                                   const el = document.getElementById('repair-price-input') as HTMLInputElement;
                                   if (!el.value) return;
                                   try {
                                     await setDoc(doc(db, 'repair_requests', request.id), {
                                       ...request,
                                       repairPrice: Number(el.value),
                                       updatedAt: serverTimestamp()
                                     });
                                   } catch (err) {
                                     handleFirestoreError(err, OperationType.UPDATE, `repair_requests/${request.id}`);
                                   }
                                 }}
                                 className="bg-fugo text-black px-2 font-black text-[10px]"
                               >
                                 SET
                               </button>
                             </div>
                           </div>
                           <div className="space-y-2">
                             <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Logistics Fee</p>
                             <div className="flex gap-2">
                               <input 
                                 type="number" 
                                 placeholder="Amount" 
                                 className="flex-1 bg-fugo-dark border-b border-fugo text-white px-2 py-1 text-xs font-bold"
                                 id="service-price-input"
                                 defaultValue={request.servicePrice}
                               />
                               <button 
                                 onClick={async () => {
                                   const el = document.getElementById('service-price-input') as HTMLInputElement;
                                   if (!el.value) return;
                                   try {
                                     await setDoc(doc(db, 'repair_requests', request.id), {
                                       ...request,
                                       servicePrice: Number(el.value),
                                       updatedAt: serverTimestamp()
                                     });
                                   } catch (err) {
                                     handleFirestoreError(err, OperationType.UPDATE, `repair_requests/${request.id}`);
                                   }
                                 }}
                                 className="bg-fugo text-black px-2 font-black text-[10px]"
                               >
                                 SET
                               </button>
                             </div>
                           </div>
                         </div>

                         {/* Quotes */}
                         <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                            <div className="space-y-2">
                              <p className="text-[10px] font-black uppercase text-fugo tracking-widest opacity-60">OEM Est.</p>
                              <div className="flex gap-1">
                                <input 
                                  type="number" 
                                  className="flex-1 bg-fugo-dark border-b border-fugo text-white px-2 py-1 text-xs"
                                  id="oem-price-input"
                                  defaultValue={request.oemPrice}
                                 />
                                <button 
                                  onClick={async () => {
                                    const el = document.getElementById('oem-price-input') as HTMLInputElement;
                                    try {
                                      await setDoc(doc(db, 'repair_requests', request.id), {
                                        ...request,
                                        oemPrice: Number(el.value),
                                        updatedAt: serverTimestamp()
                                      });
                                    } catch (err) {
                                      handleFirestoreError(err, OperationType.UPDATE, `repair_requests/${request.id}`);
                                    }
                                  }}
                                  className="bg-fugo text-black px-2 text-[10px] font-black"
                                >
                                  OK
                                </button>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <p className="text-[10px] font-black uppercase text-fugo tracking-widest opacity-60">3rd Est.</p>
                              <div className="flex gap-1">
                                <input 
                                  type="number" 
                                  className="flex-1 bg-fugo-dark border-b border-fugo text-white px-2 py-1 text-xs"
                                  id="3rd-price-input"
                                  defaultValue={request.thirdPartyPrice}
                                 />
                                <button 
                                  onClick={async () => {
                                    const el = document.getElementById('3rd-price-input') as HTMLInputElement;
                                    try {
                                      await setDoc(doc(db, 'repair_requests', request.id), {
                                        ...request,
                                        thirdPartyPrice: Number(el.value),
                                        updatedAt: serverTimestamp()
                                      });
                                    } catch (err) {
                                      handleFirestoreError(err, OperationType.UPDATE, `repair_requests/${request.id}`);
                                    }
                                  }}
                                  className="bg-fugo text-black px-2 text-[10px] font-black"
                                >
                                  OK
                                </button>
                              </div>
                            </div>
                         </div>
                       </div>
                     </div>

                     {/* Finalize Section */}
                     <div className="space-y-4">
                       <label className="text-xs font-black uppercase tracking-widest text-fugo block">Authorize Full Invoice</label>
                       <div className="flex gap-2">
                         <div className="flex-1 bg-fugo-dark border-2 border-fugo text-fugo px-4 py-3 text-2xl font-black flex items-center justify-between">
                            <span className="text-xs opacity-50">FINAL:</span>
                            <span>₹{(request.parts?.reduce((sum, p) => sum + (p.price || 0), 0) || 0) + (request.servicePrice || 0) + (request.repairPrice || 0)}</span>
                         </div>
                         <button 
                           onClick={async () => {
                              const total = (request.parts?.reduce((sum, p) => sum + (p.price || 0), 0) || 0) + (request.servicePrice || 0) + (request.repairPrice || 0);
                              if (total <= 0) return;
                              try {
                                await setDoc(doc(db, 'repair_requests', request.id), {
                                  ...request,
                                  price: total,
                                  status: 'repairing',
                                  updatedAt: serverTimestamp()
                                });
                              } catch (err) {
                                handleFirestoreError(err, OperationType.UPDATE, `repair_requests/${request.id}`);
                              }
                           }}
                           className="bg-fugo-success text-white px-6 font-black uppercase text-sm hover:bg-white hover:text-fugo-success transition-colors"
                         >
                           FIX BILL
                         </button>
                       </div>
                     </div>
                   </div>
                )}
                
                <button className="w-full border-4 border-fugo p-6 flex justify-between items-center bg-white text-black hover:bg-fugo transition-colors group">
                  <span className="text-xl font-black uppercase">Capture Diagnostic Image</span>
                  <Camera className="w-6 h-6 group-hover:rotate-12 transition-transform" />
                </button>
                
                <div className="p-6 bg-fugo text-black">
                  <h5 className="text-[10px] font-black uppercase tracking-widest mb-2">Protocol Warning</h5>
                  <p className="text-sm font-bold leading-tight">All state changes are permanently logged to the manifest history.</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-black text-fugo p-12 border-8 border-black">
              <h3 className="text-xs font-black uppercase tracking-widest mb-6">Repair Alert</h3>
              <p className="text-4xl font-black uppercase tracking-tighter leading-none italic mb-8">
                Direct Transit to Warehouse Active
              </p>
              <p className="text-sm font-bold text-white mb-8">
                {request.serviceType === 'online' ? (
                  request.status === 'pending' ? 
                    "Mobile technician dispatched. Estimated arrival for diagnostic: 15 MINUTES. Please ensure vehicle is accessible." :
                    request.repairComplexity === 'light' ?
                      "Diagnostic complete: LIGHT REPAIR identified. Technician is servicing the vehicle ON-SPOT." :
                      "Diagnostic complete: HEAVY REPAIR identified. Vehicle is being prepared for warehouse transit."
                ) : (
                  request.price ? 
                    "Warehouse inspection complete. FIXED PRICE SECURED. Vehicle is prioritized for high-speed industrial service." :
                    "Vehicle scheduled for warehouse induction. Technician will verify manifest and FIX PRICE on the spot."
                )}
              </p>
              <div className="h-4 w-full bg-white/20">
                <motion.div 
                   initial={{ width: 0 }}
                   animate={{ width: `${(currentIndex + 1) * (100/steps.length)}%` }}
                   className="h-full bg-fugo"
                />
              </div>
            </div>
          )}

          <div className="bg-white border-8 border-black p-8 flex flex-col items-center">
             <div className="text-[10px] font-black uppercase tracking-widest text-fugo mb-4">Authorized Service Terminal</div>
             <div className="flex gap-4">
                <div className="w-10 h-10 bg-black rounded-full"></div>
                <div className="w-10 h-10 border-4 border-black rounded-full"></div>
                <div className="w-10 h-10 bg-orange-600 rounded-full"></div>
             </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

const LoginView: React.FC<{ onLogin: (phone: string) => void }> = ({ onLogin }) => {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);

  const handlePhoneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.length === 10) {
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
        setStep('otp');
      }, 1000);
    }
  };

  const handleOtpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp === '123456' || otp === '000000') { // Mock OTPs
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
        onLogin(phone);
      }, 1000);
    }
  };

  return (
    <div className="min-h-screen bg-fugo-zinc flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-[2.5rem] p-10 shadow-2xl border border-black/5"
      >
        <div className="flex flex-col items-center mb-10">
          <Wrench className="w-16 h-16 text-fugo mb-4" />
          <h2 className="text-4xl font-black italic tracking-tighter leading-none text-center">FUGO TERMINAL ACCESS</h2>
          <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mt-4">Automated Repair & Service Hub</p>
        </div>

        {step === 'phone' ? (
          <form onSubmit={handlePhoneSubmit} className="space-y-6">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-2 block">Enterprise Phone Link</label>
              <div className="relative">
                <span className="absolute left-6 top-1/2 -translate-y-1/2 text-xl font-black italic text-black/20">+91</span>
                <input 
                  type="tel"
                  maxLength={10}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-fugo-zinc border-4 border-black/5 rounded-2xl py-6 pl-20 pr-6 text-2xl font-black italic tracking-tight focus:border-fugo outline-none transition-all placeholder:italic placeholder:opacity-20"
                  placeholder="98453 00000"
                  required
                />
              </div>
            </div>
            <button 
              type="submit"
              disabled={phone.length !== 10 || loading}
              className="w-full bg-black text-fugo py-6 rounded-2xl text-lg font-black uppercase tracking-widest hover:bg-fugo hover:text-black transition-all flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {loading ? "Authenticating..." : (
                <>
                  <span>Send OTP</span>
                  <ChevronRight className="w-6 h-6" />
                </>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleOtpSubmit} className="space-y-6">
            <div>
              <div className="flex justify-between items-end mb-2">
                <label className="text-[10px] font-black uppercase tracking-widest opacity-40 block">Verification Protocol</label>
                <button type="button" onClick={() => setStep('phone')} className="text-[8px] font-black uppercase text-orange-600">Change Number</button>
              </div>
              <input 
                type="text"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                className="w-full bg-fugo-zinc border-4 border-black/5 rounded-2xl py-6 px-6 text-center text-4xl font-black italic tracking-[0.5em] focus:border-fugo outline-none transition-all placeholder:text-black/5"
                placeholder="000000"
                autoFocus
                required
              />
              <p className="text-[10px] font-bold text-center mt-4 opacity-40 uppercase tracking-widest">Enter the 6-digit code sent to +91 {phone}</p>
            </div>
            <button 
              type="submit"
              disabled={otp.length !== 6 || loading}
              className="w-full bg-black text-fugo py-6 rounded-2xl text-lg font-black uppercase tracking-widest hover:bg-fugo hover:text-black transition-all flex items-center justify-center gap-3 disabled:opacity-50"
            >
               {loading ? "Verifying..." : (
                <>
                  <span>Initialize Terminal</span>
                  <CheckCircle className="w-6 h-6" />
                </>
              )}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
};

