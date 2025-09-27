
"use client";

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Plus, Edit3, Users, Route, MapPin, CalendarDays, Clock, Armchair, DollarSign, Loader2, AlertTriangle, Ban, CheckCircle, Play, Wallet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { JORDAN_GOVERNORATES, SEAT_CONFIG, type SeatID } from '@/lib/constants';
import { 
    auth, 
    getUpcomingAndOngoingTripsForDriver, 
    deleteTrip as fbDeleteTrip, 
    endTrip as fbEndTrip, 
    startTrip as fbStartTrip,
    type Trip, 
    getActiveTripForDriver, 
    onAuthUserChangedListener,
    type PassengerBookingDetails,
    getTripById 
} from '@/lib/firebaseService';
import { useRouter } from 'next/navigation';

interface DisplayPassengerDetails {
  seatId: string;
  seatName: string;
  passengerName: string;
  paymentType?: string;
  dropOffPoint?: string;
}

function TripCard({ 
    trip, 
    onDelete, 
    onEndTrip,
    onStartTrip,
    onShowPassengers 
}: { 
    trip: Trip; 
    onDelete: (tripId: string) => void; 
    onEndTrip: (trip: Trip) => void;
    onStartTrip: (tripId: string) => void;
    onShowPassengers: (trip: Trip) => void;
}) {
  const { toast } = useToast();
  const FIVE_MINUTES_IN_MS = 5 * 60 * 1000;
  const TEN_MINUTES_IN_MS = 10 * 60 * 1000;

  const tripCreationTime = typeof trip.createdAt === 'object' && trip.createdAt?.seconds ? trip.createdAt.seconds * 1000 : (typeof trip.createdAt === 'number' ? trip.createdAt : parseISO(trip.createdAt as string).getTime());
  
  const isEditable = Date.now() - tripCreationTime < TEN_MINUTES_IN_MS;

  const handleDelete = () => {
    if (trip.status !== 'upcoming') {
        toast({ title: "لا يمكن إلغاء رحلة ليست قادمة", variant: "destructive"});
        return;
    }
    
    if (Date.now() - tripCreationTime < FIVE_MINUTES_IN_MS) {
      onDelete(trip.id);
    } else {
      toast({
        title: "لا يمكن إلغاء الرحلة",
        description: "مر أكثر من 5 دقائق على إنشاء الرحلة. يرجى التواصل مع الدعم للإلغاء.",
        variant: "destructive",
        duration: 5000,
      });
    }
  };

  const handleEndTrip = () => {
    onEndTrip(trip);
  };

  const handleStartTrip = () => {
    onStartTrip(trip.id);
  };

  const startPointName = JORDAN_GOVERNORATES.find(g => g.id === trip.startPoint)?.name || trip.startPoint;
  const destinationName = JORDAN_GOVERNORATES.find(g => g.id === trip.destination)?.name || trip.destination;
  const stopNames = trip.stops?.map(s => JORDAN_GOVERNORATES.find(g => g.id === s)?.name || s).join('، ');

  let bookedSeatsCount = 0;
  if (trip.offeredSeatsConfig) {
    Object.values(trip.offeredSeatsConfig).forEach(seatValue => {
      if (typeof seatValue === 'object' && seatValue !== null) {
        bookedSeatsCount++;
      }
    });
  }
  const totalOfferedSeats = trip.offeredSeatsConfig ? Object.values(trip.offeredSeatsConfig).filter(isOffered => isOffered === true || typeof isOffered === 'object').length : 0;
  const currentAvailableSeats = totalOfferedSeats - bookedSeatsCount;

  const ArrowLeftShort = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className={`inline-block ${className}`} viewBox="0 0 16 16">
      <path fillRule="evenodd" d="M12 8a.5.5 0 0 1-.5.5H5.707l2.147 2.146a.5.5 0 0 1-.708.708l-3-3a.5.5 0 0 1 0-.708l3-3a.5.5 0 1 1 .708.708L5.707 7.5H11.5a.5.5 0 0 1 .5.5z"/>
    </svg>
  );

  const now = new Date();
  const tripDateTime = new Date(trip.dateTime);
  
  const canStartTrip = trip.status === 'upcoming' && now >= tripDateTime;

  return (
    <Card className="mb-4 shadow-lg hover:shadow-xl transition-shadow duration-300">
      <CardHeader>
        <CardTitle className="flex items-center text-xl">
          <Route className="ms-2 h-6 w-6 text-primary" />
          {startPointName} <ArrowLeftShort className="mx-1"/> {destinationName}
          {trip.status === 'ongoing' && <span className="me-auto text-sm font-medium bg-green-100 text-green-700 px-2 py-1 rounded-full">جارية</span>}
          {trip.status === 'upcoming' && <span className="me-auto text-sm font-medium bg-blue-100 text-blue-700 px-2 py-1 rounded-full">قادمة</span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {stopNames && (
          <div className="flex items-center">
            <MapPin className="ms-2 h-4 w-4 text-muted-foreground" />
            محطات التوقف: {stopNames}
          </div>
        )}
        <div className="flex items-center">
          <CalendarDays className="ms-2 h-4 w-4 text-muted-foreground" />
          التاريخ: {format(tripDateTime, "eeee, d MMMM yyyy - HH:mm", { locale: ar })}
        </div>
        <div className="flex items-center">
          <Clock className="ms-2 h-4 w-4 text-muted-foreground" />
          وقت الوصول المتوقع: {trip.expectedArrivalTime}
        </div>
        <div className="flex items-center">
          <Users className="ms-2 h-4 w-4 text-muted-foreground" />
          المقاعد المتاحة: {currentAvailableSeats} ({totalOfferedSeats} معروضة)
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
          <DollarSign className="ms-2 h-4 w-4 text-green-500" />
          السعر للراكب: {trip.pricePerPassenger} د.أ
        </div>
        <div className="flex items-center">
          <MapPin className="ms-2 h-4 w-4 text-muted-foreground" />
          مكان اللقاء: {trip.meetingPoint}
        </div>
      </CardContent>
      <CardFooter className="flex justify-end space-x-2 space-x-reverse">
        {trip.status === 'upcoming' && canStartTrip && (
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="default" size="sm" className="bg-accent hover:bg-accent/90">
                        <Play className="ms-1 h-4 w-4" /> بدء الرحلة
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>تأكيد بدء الرحلة</AlertDialogTitle>
                    <AlertDialogDescription>
                        هل أنت متأكد أنك تريد بدء هذه الرحلة؟ سيتم تغيير حالتها إلى "جارية".
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                    <AlertDialogCancel>تراجع</AlertDialogCancel>
                    <AlertDialogAction onClick={handleStartTrip} className="bg-accent hover:bg-accent/90">تأكيد البدء</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        )}
        {trip.status === 'upcoming' && ( // Edit and Cancel only for upcoming
          <>
            {isEditable ? (
                <Button variant="outline" size="sm" asChild>
                    <Link href={`/trips/edit/${trip.id}`}>
                        <Edit3 className="ms-1 h-4 w-4" /> تعديل
                    </Link>
                </Button>
            ) : (
                <Button variant="outline" size="sm" disabled title="لا يمكن تعديل الرحلة بعد مرور 10 دقائق على إنشائها">
                    <Edit3 className="ms-1 h-4 w-4" /> تعديل
                </Button>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Ban className="ms-1 h-4 w-4" /> إلغاء الرحلة
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>هل أنت متأكد من إلغاء الرحلة؟</AlertDialogTitle>
                  <AlertDialogDescription>
                    سيتم إشعار الركاب المسجلين بالإلغاء. لا يمكن التراجع عن هذا الإجراء إذا مر أكثر من 5 دقائق على إنشاء الرحلة.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>تراجع</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>تأكيد الإلغاء</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
         {trip.status === 'ongoing' && (
             <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="default" size="sm" className="bg-green-600 hover:bg-green-700">
                  <CheckCircle className="ms-1 h-4 w-4" /> إنهاء الرحلة
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>تأكيد إنهاء الرحلة</AlertDialogTitle>
                  <AlertDialogDescription>
                    هل أنت متأكد أنك تريد إنهاء هذه الرحلة؟ سيتم نقلها إلى السجل وحساب الأرباح.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>تراجع</AlertDialogCancel>
                  <AlertDialogAction onClick={handleEndTrip} className="bg-green-600 hover:bg-green-700">تأكيد الإنهاء</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
         )}
        <Button variant="secondary" size="sm" onClick={() => onShowPassengers(trip)}>
            <Users className="ms-1 h-4 w-4" /> الركاب
        </Button>
      </CardFooter>
    </Card>
  );
}


export default function TripsPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(true); 
  const [canCreateTrip, setCanCreateTrip] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const [isPassengerDialogOpen, setIsPassengerDialogOpen] = useState(false);
  const [currentTripForPassengers, setCurrentTripForPassengers] = useState<Trip | null>(null);
  const [passengerDetailsList, setPassengerDetailsList] = useState<DisplayPassengerDetails[]>([]);
  const [isLoadingPassengerDetails, setIsLoadingPassengerDetails] = useState(false);

  const fetchTripsData = useCallback(async (isInitialLoad = false) => {
    if (isInitialLoad) {
      setIsLoading(true);
    }
    const currentUser = auth.currentUser;
    if (currentUser) {
      let anUpcomingTripWasAutoStarted = false;
      try {
        const loadedTrips = await getUpcomingAndOngoingTripsForDriver(currentUser.uid);
        let tripsToUpdateLocally = [...loadedTrips];

        const now = new Date();
        for (const trip of loadedTrips) {
          if (trip.status === 'upcoming') {
            const tripDateTime = new Date(trip.dateTime);
            if (now >= tripDateTime) {
              try {
                await fbStartTrip(trip.id); // This updates DB
                toast({
                  title: "تم بدء الرحلة تلقائياً",
                  description: `بدأت رحلتك إلى ${JORDAN_GOVERNORATES.find(g => g.id === trip.destination)?.name || trip.destination}.`,
                });
                anUpcomingTripWasAutoStarted = true;
                tripsToUpdateLocally = tripsToUpdateLocally.map(t => 
                  t.id === trip.id ? { ...t, status: 'ongoing' as const } : t
                );
              } catch (startError: any) {
                console.error(`Error auto-starting trip ${trip.id}:`, startError);
                // Optionally, toast if it's not a 'trip already ongoing or not found' type error
                if (startError.message && !startError.message.toLowerCase().includes("upcoming") && !startError.message.toLowerCase().includes("found")) {
                    toast({ title: "خطأ في البدء التلقائي", description: startError.message, variant: "destructive"});
                }
              }
            }
          }
        }
        
        setTrips(tripsToUpdateLocally);

        const activeTrip = await getActiveTripForDriver(currentUser.uid);
        setCanCreateTrip(!activeTrip);

      } catch (error) {
        console.error("Error fetching trip data:", error);
        toast({ title: "خطأ في جلب بيانات الرحلات", description: "الرجاء المحاولة مرة أخرى لاحقاً.", variant: "destructive" });
      } finally {
        if (isInitialLoad) {
          setIsLoading(false);
        }
      }
    } else {
      setTrips([]);
      setCanCreateTrip(false);
      if (isInitialLoad) {
        setIsLoading(false);
      }
    }
  }, [toast]); 

  useEffect(() => {
    const unsubscribe = onAuthUserChangedListener(user => {
      if (user) {
        fetchTripsData(true); 
      } else {
        setTrips([]);
        setCanCreateTrip(false);
        setIsLoading(false); 
        router.push('/auth/signin');
      }
    });
    return () => unsubscribe();
  }, [router, fetchTripsData]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (auth.currentUser) { 
        fetchTripsData(false); 
      }
    }, 60000); 

    return () => {
      clearInterval(intervalId); 
    };
  }, [fetchTripsData]); 


  const fetchAndSetPassengerDetails = useCallback(async (tripId: string, isInitialLoadDialog: boolean) => {
    if (isInitialLoadDialog) {
        setIsLoadingPassengerDetails(true);
    }
    
    try {
      const freshlyFetchedTrip = await getTripById(tripId);
      const resolvedPassengers: DisplayPassengerDetails[] = [];

      if (freshlyFetchedTrip && freshlyFetchedTrip.offeredSeatsConfig) {
        for (const seatId in freshlyFetchedTrip.offeredSeatsConfig) {
          const bookingInfo = freshlyFetchedTrip.offeredSeatsConfig[seatId];
          if (typeof bookingInfo === 'object' && bookingInfo !== null) {
            const seatName = SEAT_CONFIG[seatId as SeatID]?.name || seatId.replace(/_/g, ' ');
            const passengerBooking = bookingInfo as PassengerBookingDetails;
            
            resolvedPassengers.push({
              seatId,
              seatName,
              passengerName: passengerBooking.fullName || 'اسم الراكب غير مسجل',
              paymentType: passengerBooking.paymentType,
              dropOffPoint: passengerBooking.dropOffPoint,
            });
          }
        }
      }
      setPassengerDetailsList(resolvedPassengers);
    } catch (error) {
      console.error("Error fetching passenger details:", error);
      toast({ title: "خطأ في جلب بيانات الركاب", variant: "destructive" });
      setPassengerDetailsList([]); 
    } finally {
      if (isInitialLoadDialog) {
        setIsLoadingPassengerDetails(false);
      }
    }
  }, [toast]);


  const showPassengerDetails = useCallback(async (trip: Trip) => {
    setCurrentTripForPassengers(trip);
    setIsPassengerDialogOpen(true);
    await fetchAndSetPassengerDetails(trip.id, true); 
  }, [fetchAndSetPassengerDetails]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    if (isPassengerDialogOpen && currentTripForPassengers) {
      intervalId = setInterval(() => {
        fetchAndSetPassengerDetails(currentTripForPassengers.id, false); 
      }, 30000); 
    }
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isPassengerDialogOpen, currentTripForPassengers, fetchAndSetPassengerDetails]);


  const handleDeleteTrip = async (tripId: string) => {
    try {
      await fbDeleteTrip(tripId); 
      toast({ title: "تم إلغاء الرحلة بنجاح" });
      fetchTripsData(true); 
    } catch (error) {
      console.error("Error cancelling trip:", error);
      toast({title: "خطأ في إلغاء الرحلة", variant: "destructive"});
    }
  };

  const handleStartTrip = async (tripId: string) => {
    try {
      await fbStartTrip(tripId);
      toast({ title: "تم بدء الرحلة بنجاح!"});
      fetchTripsData(true); // Re-fetch to update UI and potentially auto-start other trips
    } catch (error: any) {
      console.error("Error starting trip:", error);
      toast({ title: "خطأ في بدء الرحلة", description: error.message || "يرجى المحاولة مرة أخرى.", variant: "destructive" });
    }
  };

  const handleEndTrip = async (tripToEnd: Trip) => {
     try {
      let bookedSeatsCount = 0;
      if (tripToEnd.offeredSeatsConfig) {
        Object.values(tripToEnd.offeredSeatsConfig).forEach(seatValue => {
          if (typeof seatValue === 'object' && seatValue !== null) {
            bookedSeatsCount++;
          }
        });
      }
      const earnings = bookedSeatsCount * tripToEnd.pricePerPassenger;
      await fbEndTrip(tripToEnd, earnings);
      toast({ title: "تم إنهاء الرحلة بنجاح", description: `الأرباح: ${earnings.toFixed(2)} د.أ` });
      fetchTripsData(true); 
    } catch (error) {
      console.error("Error ending trip:", error);
      toast({title: "خطأ في إنهاء الرحلة", variant: "destructive"});
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  
  const destinationNameDialog = currentTripForPassengers?.destination 
    ? (JORDAN_GOVERNORATES.find(g => g.id === currentTripForPassengers.destination)?.name || currentTripForPassengers.destination)
    : '';

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-bold h-underline">رحلاتك القادمة والجارية</h1>
        {canCreateTrip ? (
          <Button asChild size="sm">
            <Link href="/trips/create">
              <Plus className="ms-2 h-4 w-4" /> إضافة رحلة جديدة
            </Link>
          </Button>
        ) : (
          <Button disabled size="sm">
            <Plus className="ms-2 h-4 w-4" /> إضافة رحلة جديدة
            <span className="text-xs me-2">(لديك رحلة نشطة)</span>
          </Button>
        )}
      </div>

      {trips.length === 0 ? (
        <Card className="text-center py-10">
          <CardContent className="flex flex-col items-center">
            <AlertTriangle className="w-16 h-16 text-muted-foreground mb-4" />
            <p className="text-xl text-muted-foreground">لا توجد رحلات قادمة أو جارية حالياً.</p>
            {canCreateTrip && <p className="text-sm text-muted-foreground mt-2">قم بإضافة رحلة جديدة لتبدأ!</p>}
          </CardContent>
        </Card>
      ) : (
        <div>
          {trips.map(trip => (
            <TripCard 
                key={trip.id} 
                trip={trip} 
                onDelete={handleDeleteTrip} 
                onEndTrip={handleEndTrip}
                onStartTrip={handleStartTrip}
                onShowPassengers={showPassengerDetails} 
            />
          ))}
        </div>
      )}

      <Dialog open={isPassengerDialogOpen} onOpenChange={setIsPassengerDialogOpen}>
        <DialogContent className="sm:max-w-[425px] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>ركاب الرحلة إلى {destinationNameDialog}</DialogTitle>
          </DialogHeader>
          {isLoadingPassengerDetails ? (
            <div className="flex justify-center items-center h-32">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : passengerDetailsList.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">لا يوجد ركاب مسجلين في هذه الرحلة بعد.</p>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto p-1">
              <ul className="space-y-3">
                {passengerDetailsList.map(passenger => (
                  <li key={passenger.seatId} className="flex flex-col p-3 border rounded-md shadow-sm space-y-2">
                    <div className="flex justify-between items-center w-full">
                      <p className="font-semibold">{passenger.passengerName}</p>
                      <p className="text-sm text-muted-foreground bg-secondary px-2 py-1 rounded">المقعد: {passenger.seatName}</p>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1 border-t pt-2 mt-2">
                      {passenger.paymentType && (
                          <div className="flex items-center gap-2">
                              <Wallet className="h-4 w-4 text-primary" />
                              <span>الدفع: {passenger.paymentType === 'cash' ? 'كاش' : 'كليك'}</span>
                          </div>
                      )}
                      {passenger.dropOffPoint && (
                          <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-primary" />
                              <span>نقطة النزول: {passenger.dropOffPoint}</span>
                          </div>
                      )}
                      {!passenger.paymentType && !passenger.dropOffPoint && (
                          <p className="text-xs italic">لا توجد تفاصيل إضافية.</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">إغلاق</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
