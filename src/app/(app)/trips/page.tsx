
"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button'; // Added buttonVariants
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Edit3, Trash2, Users, Route, MapPin, CalendarDays, Clock, Armchair, DollarSign, Loader2, AlertTriangle, Ban, CheckCircle } from 'lucide-react';
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
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { JORDAN_GOVERNORATES } from '@/lib/constants';
import { auth } from '@/lib/firebase';
import { getUpcomingAndOngoingTripsForDriver, deleteTrip as fbDeleteTrip, endTrip as fbEndTrip, type Trip, getActiveTripForDriver } from '@/lib/firebaseService';
import { useRouter } from 'next/navigation';

function TripCard({ trip, onDelete, onEndTrip }: { trip: Trip; onDelete: (tripId: string) => void; onEndTrip: (trip: Trip) => void; }) {
  const { toast } = useToast();

  const handleDelete = () => {
    onDelete(trip.id);
    toast({ title: "تم إلغاء الرحلة بنجاح" }); // Changed from "حذف" to "إلغاء"
  };

  const handleEndTrip = () => {
    onEndTrip(trip);
    toast({ title: "تم إنهاء الرحلة بنجاح", description: `الأرباح: ${trip.pricePerPassenger * (trip.selectedSeats?.length || 0)} د.أ` });
  };

  const startPointName = JORDAN_GOVERNORATES.find(g => g.id === trip.startPoint)?.name || trip.startPoint;
  const destinationName = JORDAN_GOVERNORATES.find(g => g.id === trip.destination)?.name || trip.destination;
  const stopNames = trip.stops?.map(s => JORDAN_GOVERNORATES.find(g => g.id === s)?.name || s).join('، ');

  const currentAvailableSeats = (trip.offeredSeatIds?.length || 0) - (trip.selectedSeats?.length || 0);

  const ArrowLeftShort = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className={`inline-block ${className}`} viewBox="0 0 16 16">
      <path fillRule="evenodd" d="M12 8a.5.5 0 0 1-.5.5H5.707l2.147 2.146a.5.5 0 0 1-.708.708l-3-3a.5.5 0 0 1 0-.708l3-3a.5.5 0 1 1 .708.708L5.707 7.5H11.5a.5.5 0 0 1 .5.5z"/>
    </svg>
  );

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
          التاريخ: {format(new Date(trip.dateTime), "eeee, d MMMM yyyy - HH:mm", { locale: ar })}
        </div>
        <div className="flex items-center">
          <Clock className="ms-2 h-4 w-4 text-muted-foreground" />
          وقت الوصول المتوقع: {trip.expectedArrivalTime}
        </div>
        <div className="flex items-center">
          <Users className="ms-2 h-4 w-4 text-muted-foreground" />
          المقاعد المتاحة: {currentAvailableSeats} ({trip.offeredSeatIds?.length || 0} معروضة)
        </div>
        {trip.selectedSeats && trip.selectedSeats.length > 0 && (
          <div className="flex items-center">
            <Armchair className="ms-2 h-4 w-4 text-muted-foreground" />
            المقاعد المحجوزة: {trip.selectedSeats.map(s => s.replace(/_/g, ' ')).join('، ')}
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
        {trip.status === 'upcoming' && (
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/trips/edit/${trip.id}`}>
                <Edit3 className="ms-1 h-4 w-4" /> تعديل
              </Link>
            </Button>
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
                    سيتم إشعار الركاب المسجلين بالإلغاء. لا يمكن التراجع عن هذا الإجراء.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>تراجع</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className={buttonVariants({variant: "destructive"})}>تأكيد الإلغاء</AlertDialogAction>
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
                  <AlertDialogAction onClick={handleEndTrip} className={buttonVariants({variant: "default", className: "bg-green-600 hover:bg-green-700"})}>تأكيد الإنهاء</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
         )}
        <Button variant="secondary" size="sm" asChild>
          <Link href={`/passengers/${trip.id}`}>
            <Users className="ms-1 h-4 w-4" /> الركاب
          </Link>
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

  const fetchTripsData = async () => {
    setIsLoading(true);
    const currentUser = auth.currentUser;
    if (currentUser) {
      const loadedTrips = await getUpcomingAndOngoingTripsForDriver(currentUser.uid);
      setTrips(loadedTrips);
      // User can create a new trip if there are no 'upcoming' or 'ongoing' trips.
      const activeTrip = await getActiveTripForDriver(currentUser.uid);
      setCanCreateTrip(!activeTrip);

    } else {
      router.push('/auth/signin'); // Should be protected by layout
    }
    setIsLoading(false);
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(user => {
      if (user) {
        fetchTripsData();
      } else {
        router.push('/auth/signin');
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleDeleteTrip = async (tripId: string) => {
    try {
      await fbDeleteTrip(tripId); // This now updates status to 'cancelled'
      fetchTripsData(); // Re-fetch to update list and canCreateTrip state
    } catch (error) {
      console.error("Error cancelling trip:", error);
      toast({title: "خطأ في إلغاء الرحلة", variant: "destructive"});
    }
  };

  const handleEndTrip = async (tripToEnd: Trip) => {
     try {
      await fbEndTrip(tripToEnd);
      fetchTripsData(); // Re-fetch to update list and canCreateTrip state
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
  
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold h-underline">رحلاتك القادمة والجارية</h1>
        {canCreateTrip ? (
          <Button asChild>
            <Link href="/trips/create">
              <Plus className="ms-2 h-5 w-5" /> إضافة رحلة جديدة
            </Link>
          </Button>
        ) : (
          <Button disabled>
            <Plus className="ms-2 h-5 w-5" /> إضافة رحلة جديدة
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
            <TripCard key={trip.id} trip={trip} onDelete={handleDeleteTrip} onEndTrip={handleEndTrip} />
          ))}
        </div>
      )}
    </div>
  );
}

