
"use client";

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, CalendarDays, DollarSign, MapPin, Route, Users, Armchair, ListChecks, Loader2, Wallet, Gift } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { JORDAN_GOVERNORATES, SEAT_CONFIG, type SeatID } from '@/lib/constants';
import { 
    auth, 
    onAuthUserChangedListener, 
    getCompletedTripsForDriver, 
    type Trip,
    type UserProfile,
    getUserProfile,
    chargeWalletWithCode
} from '@/lib/firebaseService';
import { useRouter } from 'next/navigation';


function CompletedTripCard({ trip }: { trip: Trip }) {
  const startPointName = JORDAN_GOVERNORATES.find(g => g.id === trip.startPoint)?.name || trip.startPoint;
  const destinationName = JORDAN_GOVERNORATES.find(g => g.id === trip.destination)?.name || trip.destination;
  const stopNames = trip.stops?.map(s => JORDAN_GOVERNORATES.find(g => g.id === s)?.name || s).join('، ');

  const bookedSeatsCount = trip.offeredSeatsConfig
    ? Object.values(trip.offeredSeatsConfig).filter(
        seatValue => typeof seatValue === 'object' && seatValue !== null
      ).length
    : 0;

  const totalOfferedSeats = trip.offeredSeatsConfig
    ? Object.values(trip.offeredSeatsConfig).filter(
        seatValue => seatValue === true || (typeof seatValue === 'object' && seatValue !== null)
      ).length
    : 0;


  const ArrowLeftShort = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className={`inline-block ${className}`} viewBox="0 0 16 16">
      <path fillRule="evenodd" d="M12 8a.5.5 0 0 1-.5.5H5.707l2.147 2.146a.5.5 0 0 1-.708.708l-3-3a.5.5 0 0 1 0-.708l3-3a.5.5 0 1 1 .708.708L5.707 7.5H11.5a.5.5 0 0 1 .5.5z"/>
    </svg>
  );

  return (
    <Card className="mb-4 shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center text-lg">
          <Route className="ms-2 h-5 w-5 text-primary" />
          {startPointName} <ArrowLeftShort className="mx-1"/> {destinationName}
          {trip.status === 'cancelled' && <span className="me-auto text-sm font-medium bg-red-100 text-red-700 px-2 py-1 rounded-full">ملغاة</span>}
          {trip.status === 'completed' && <span className="me-auto text-sm font-medium bg-green-100 text-green-700 px-2 py-1 rounded-full">مكتملة</span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm pb-4">
        {stopNames && (
          <div className="flex items-center">
            <MapPin className="ms-2 h-4 w-4 text-muted-foreground" />
            محطات التوقف: {stopNames}
          </div>
        )}
        <div className="flex items-center">
          <CalendarDays className="ms-2 h-4 w-4 text-muted-foreground" />
          التاريخ: {format(new Date(trip.dateTime), "eeee, d MMMM yyyy - HH:mm", { locale: ar })}
        </div>
        <div className="flex items-center">
          <Users className="ms-2 h-4 w-4 text-muted-foreground" />
          عدد الركاب: {bookedSeatsCount} / {totalOfferedSeats}
        </div>
         {bookedSeatsCount > 0 && (
          <div className="flex items-center">
            <Armchair className="ms-2 h-4 w-4 text-muted-foreground" />
            المقاعد المحجوزة: {
              Object.entries(trip.offeredSeatsConfig || {})
                .filter(([_, seatValue]) => typeof seatValue === 'object' && seatValue !== null)
                .map(([seatId, _]) => SEAT_CONFIG[seatId as SeatID]?.name || seatId.replace(/_/g, ' '))
                .join('، ')
            }
          </div>
        )}
        <div className="flex items-center">
          <DollarSign className="ms-2 h-4 w-4 text-green-600" />
          السعر للراكب: {trip.pricePerPassenger} د.أ
        </div>
        {trip.status === 'completed' && trip.earnings !== undefined && (
          <div className="flex items-center font-semibold">
            <DollarSign className="ms-2 h-4 w-4 text-green-600" />
            الأرباح من هذه الرحلة: {trip.earnings.toFixed(2)} د.أ
          </div>
        )}
         {trip.status === 'cancelled' && (
          <div className="flex items-center font-semibold text-red-600">
            <AlertTriangle className="ms-2 h-4 w-4" />
            تم إلغاء هذه الرحلة.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function HistoryPage() {
  const [allTrips, setAllTrips] = useState<Trip[]>([]);
  const [visibleTripsCount, setVisibleTripsCount] = useState(5);
  const [isLoading, setIsLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [chargeCodeInput, setChargeCodeInput] = useState('');
  const [isChargingWallet, setIsChargingWallet] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const { toast } = useToast();
  const router = useRouter();

  const fetchInitialData = useCallback(async (userId: string, initialLoad: boolean = true) => {
    if (initialLoad) setIsLoading(true);
    // Data fetching is disabled.
    setAllTrips([]);
    setUserProfile(null);
    setIsLoading(false);
    /*
    try {
      const [trips, profile] = await Promise.all([
        getCompletedTripsForDriver(userId),
        getUserProfile(userId)
      ]);
      setAllTrips(trips);
      setUserProfile(profile);
    } catch (error) {
      console.error("Error fetching history or profile:", error);
      if (initialLoad) toast({ title: "خطأ في تحميل البيانات", variant: "destructive" });
    } finally {
      if (initialLoad) setIsLoading(false);
    }
    */
  }, [toast]);

  useEffect(() => {
    const unsubscribe = onAuthUserChangedListener(user => {
        if (user) {
            setCurrentUserId(user.uid);
            fetchInitialData(user.uid, true);
        } else {
            setCurrentUserId(null);
            router.push('/auth/signin');
            setIsLoading(false);
        }
    });
    return () => unsubscribe();
  }, [router, fetchInitialData]);

  // Periodic fetching for completed trips is disabled.
  useEffect(() => {
    /*
    let intervalId: NodeJS.Timeout | null = null;
    const refreshCompletedTrips = async () => {
      if (currentUserId) {
        try {
          const trips = await getCompletedTripsForDriver(currentUserId);
          setAllTrips(trips);
        } catch (error) {
          console.warn("Polling completed trips failed:", error);
        }
      }
    };

    if (currentUserId) {
      intervalId = setInterval(refreshCompletedTrips, 60000); // Poll every 60 seconds
    }
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
    */
  }, [currentUserId]);

  // Periodic fetching for wallet balance is disabled.
  useEffect(() => {
    /*
    let intervalId: NodeJS.Timeout | null = null;
    const pollWalletBalance = async () => {
      if (currentUserId) {
        try {
          const freshProfile = await getUserProfile(currentUserId);
          if (freshProfile) {
            setUserProfile(freshProfile);
          }
        } catch (error) {
          console.warn("Polling wallet balance failed:", error);
        }
      }
    };

    if (currentUserId) {
      intervalId = setInterval(pollWalletBalance, 30000); // Poll every 30 seconds
    }
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
    */
  }, [currentUserId]);

  const handleChargeWallet = async () => {
    if (!chargeCodeInput.trim()) {
      toast({ title: "الرجاء إدخال كود الشحن", variant: "destructive" });
      return;
    }
    if (!currentUserId) {
      toast({ title: "المستخدم غير مسجل الدخول", variant: "destructive" });
      return;
    }

    setIsChargingWallet(true);
    // Functionality is disabled.
    const result = { success: false, message: "تم تعطيل هذه الميزة مؤقتًا." };
    /*
    const result = await chargeWalletWithCode(currentUserId, chargeCodeInput.trim());
    */
    setIsChargingWallet(false);

    toast({
      title: result.success ? "نجاح" : "خطأ",
      description: result.message,
      variant: result.success ? "default" : "destructive",
    });

    if (result.success) {
      if (result.newBalance !== undefined) {
        if (userProfile) { 
          setUserProfile(prev => prev ? ({ ...prev, walletBalance: result.newBalance! }) : null);
        } else { 
          try {
            // Data fetching is disabled.
            // const freshProfile = await getUserProfile(currentUserId);
            // setUserProfile(freshProfile);
          } catch (e) {
            console.error("Failed to refetch profile after successful charge when local was null", e);
            toast({title:"خطأ", description: "تم شحن الرصيد ولكن حدث خطأ في تحديث عرض الرصيد. حاول تحديث الصفحة.", variant: "destructive"});
          }
        }
      }
      setChargeCodeInput(''); 
    }
  };

  const displayedTrips = allTrips.slice(0, visibleTripsCount);
  const hasMoreTrips = allTrips.length > visibleTripsCount;

  if (isLoading && !userProfile) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center">
        <h1 className="text-3xl font-bold h-underline flex items-center">
          <ListChecks className="me-3 h-8 w-8 text-primary" />
          سجل الرحلات
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-xl">
            <Wallet className="ms-2 h-6 w-6 text-primary" />
            المحفظة
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-lg font-semibold">
            الرصيد الحالي: <span className="text-primary">{(userProfile?.walletBalance || 0).toFixed(2)} د.أ</span>
          </p>
          <div className="space-y-2">
            <Label htmlFor="chargeCode">كود الشحن</Label>
            <div className="flex items-center gap-2">
              <Input 
                id="chargeCode" 
                placeholder="أدخل كود الشحن هنا" 
                value={chargeCodeInput}
                onChange={(e) => setChargeCodeInput(e.target.value)}
                disabled={isChargingWallet}
              />
              <Button onClick={handleChargeWallet} disabled={isChargingWallet || !chargeCodeInput.trim() || !currentUserId}>
                {isChargingWallet ? <Loader2 className="animate-spin" /> : <Gift className="ms-2 h-4 w-4" />}
                شحن الرصيد
              </Button>
            </div>
             <p className="text-xs text-muted-foreground">
              يمكنك الحصول على أكواد الشحن من مسؤول النظام.
            </p>
          </div>
        </CardContent>
      </Card>


      {allTrips.length === 0 && !isLoading ? (
        <Card className="text-center py-10">
          <CardContent className="flex flex-col items-center">
            <AlertTriangle className="w-16 h-16 text-muted-foreground mb-4" />
            <p className="text-xl text-muted-foreground">لا يوجد رحلات في السجل.</p>
          </CardContent>
        </Card>
      ) : (
        <div>
          {displayedTrips.map(trip => (
            <CompletedTripCard key={trip.id} trip={trip} />
          ))}
          {hasMoreTrips && (
             <div className="text-center mt-4">
                <Button onClick={() => setVisibleTripsCount(allTrips.length)}>
                  مشاهدة المزيد
                </Button>
              </div>
          )}
        </div>
      )}
    </div>
  );
}
