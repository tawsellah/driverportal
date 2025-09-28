
"use client";

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, CalendarDays, DollarSign, MapPin, Route, Users, Armchair, ListChecks, Loader2, Wallet, Gift, History as HistoryIcon, ArrowUpDown } from 'lucide-react';
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
    chargeWalletWithCode,
    getWalletTransactions,
    type WalletTransaction
} from '@/lib/firebaseService';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";


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

const getTransactionTypeLabel = (type: WalletTransaction['type']) => {
    switch (type) {
        case 'charge': return 'شحن رصيد';
        case 'trip_earning': return 'أرباح رحلة';
        case 'trip_fee': return 'رسوم رحلة';
        case 'system_adjustment': return 'تعديل من النظام';
        default: return 'حركة غير معروفة';
    }
};

function WalletTransactionsDialog({ isOpen, onOpenChange, transactions, isLoading }: { isOpen: boolean, onOpenChange: (open: boolean) => void, transactions: WalletTransaction[], isLoading: boolean }) {
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>حركات المحفظة</DialogTitle>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh] pr-4">
                    {isLoading ? (
                        <div className="flex justify-center items-center h-32">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : transactions.length === 0 ? (
                        <p className="text-muted-foreground text-center py-10">لا توجد حركات لعرضها.</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>التاريخ والوقت</TableHead>
                                    <TableHead>نوع الحركة</TableHead>
                                    <TableHead className="text-center">المبلغ (د.أ)</TableHead>
                                    <TableHead>تفاصيل</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {transactions.map((tx) => (
                                    <TableRow key={tx.id}>
                                        <TableCell className="text-xs">{format(new Date(tx.date), "Pp", { locale: ar })}</TableCell>
                                        <TableCell>{getTransactionTypeLabel(tx.type)}</TableCell>
                                        <TableCell className={`text-center font-mono ${tx.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {tx.amount >= 0 ? `+${tx.amount.toFixed(2)}` : tx.amount.toFixed(2)}
                                        </TableCell>
                                        <TableCell className="text-xs">{tx.description}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </ScrollArea>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="secondary">إغلاق</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
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

  // State for wallet transactions dialog
  const [isTransactionsOpen, setIsTransactionsOpen] = useState(false);
  const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);

  const fetchInitialData = useCallback(async (userId: string, initialLoad: boolean = true) => {
    if (initialLoad) setIsLoading(true);
    try {
        // Fetch profile first, handle potential errors (e.g. wallet not existing yet)
        try {
            const profile = await getUserProfile(userId);
            setUserProfile(profile);
        } catch(profileError) {
            console.error("Could not fetch user profile, maybe wallet doesn't exist yet:", profileError);
            // Don't crash, allow user to try and charge wallet
            setUserProfile(null); 
        }

        // Then, fetch trips, handling potential errors gracefully
        try {
            const trips = await getCompletedTripsForDriver(userId);
            setAllTrips(trips);
        } catch (tripError) {
            console.warn("Could not fetch completed trips, registry might be empty:", tripError);
            setAllTrips([]); // Set to empty array on error
        }
    } catch (error) {
        console.error("Error fetching initial page data:", error);
        toast({ 
            title: "خطأ في تحميل البيانات", 
            description: "فشل تحميل بعض البيانات. قد تحتاج لشحن رصيدك.", 
            variant: "destructive" 
        });
    } finally {
        if (initialLoad) setIsLoading(false);
    }
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

  useEffect(() => {
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
  }, [currentUserId]);

  const handleOpenTransactions = async () => {
    if (!currentUserId) return;
    setIsTransactionsOpen(true);
    setIsLoadingTransactions(true);
    try {
        const transactions = await getWalletTransactions(currentUserId);
        setWalletTransactions(transactions);
    } catch (error: any) {
        console.error("Error fetching wallet transactions:", error);
        setWalletTransactions([]);
        toast({ 
            title: "خطأ في جلب حركات المحفظة", 
            description: "قد لا يكون لديك أي حركات لعرضها. حاول مرة أخرى لاحقًا.",
            variant: "destructive" 
        });
    } finally {
        setIsLoadingTransactions(false);
    }
  };


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
    const result = await chargeWalletWithCode(currentUserId, chargeCodeInput.trim());
    setIsChargingWallet(false);

    toast({
      title: result.success ? "نجاح" : "خطأ",
      description: result.message,
      variant: result.success ? "default" : "destructive",
    });

    if (result.success) {
      if (result.newBalance !== undefined) {
          setUserProfile(prev => prev ? ({ ...prev, walletBalance: result.newBalance! }) : { walletBalance: result.newBalance!, id: currentUserId, fullName: 'مستخدم', email: '', phone: '', status: 'approved', createdAt: Date.now(), rating: 0, tripsCount: 0 });
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
      <WalletTransactionsDialog 
        isOpen={isTransactionsOpen} 
        onOpenChange={setIsTransactionsOpen}
        transactions={walletTransactions}
        isLoading={isLoadingTransactions}
      />
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
         <CardFooter>
            <Button variant="outline" className="w-full" onClick={handleOpenTransactions}>
                <HistoryIcon className="ms-2 h-4 w-4" />
                عرض حركات المحفظة
            </Button>
        </CardFooter>
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

    

    
