"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Edit3, Trash2, Users, Route, MapPin, CalendarDays, Clock, Armchair, DollarSign, Loader2, AlertTriangle } from 'lucide-react';
import type { Trip } from '@/lib/storage';
import { getTrips, deleteTrip as deleteTripFromStorage, initializeMockData } from '@/lib/storage';
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

function TripCard({ trip, onDelete }: { trip: Trip; onDelete: (tripId: string) => void }) {
  const { toast } = useToast();

  const handleDelete = () => {
    onDelete(trip.id);
    toast({ title: "تم حذف الرحلة بنجاح" });
  };

  return (
    <Card className="mb-4 shadow-lg hover:shadow-xl transition-shadow duration-300">
      <CardHeader>
        <CardTitle className="flex items-center text-xl">
          <Route className="ms-2 h-6 w-6 text-primary" />
          {trip.startPoint} <ArrowLeftShort className="mx-1"/> {trip.destination}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {trip.stops && trip.stops.length > 0 && (
          <div className="flex items-center">
            <MapPin className="ms-2 h-4 w-4 text-muted-foreground" />
            محطات التوقف: {trip.stops.join('، ')}
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
          المقاعد المتاحة: {trip.availableSeats}
        </div>
        {trip.selectedSeats && trip.selectedSeats.length > 0 && (
          <div className="flex items-center">
            <Armchair className="ms-2 h-4 w-4 text-muted-foreground" />
            المقاعد المحجوزة: {trip.selectedSeats.join('، ')}
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
        <Button variant="outline" size="sm" asChild>
          <Link href={`/trips/edit/${trip.id}`}>
            <Edit3 className="ms-1 h-4 w-4" /> تعديل
          </Link>
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm">
              <Trash2 className="ms-1 h-4 w-4" /> حذف
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>هل أنت متأكد من حذف الرحلة؟</AlertDialogTitle>
              <AlertDialogDescription>
                لا يمكن التراجع عن هذا الإجراء. سيتم حذف الرحلة بشكل دائم.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>تأكيد الحذف</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <Button variant="secondary" size="sm" onClick={() => toast({title: "عرض الركاب (قيد التطوير)"})}>
          <Users className="ms-1 h-4 w-4" /> الركاب
        </Button>
      </CardFooter>
    </Card>
  );
}

// A simple ArrowLeft icon component for use within TripCard title
const ArrowLeftShort = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className={`inline-block ${className}`} viewBox="0 0 16 16">
    <path fillRule="evenodd" d="M12 8a.5.5 0 0 1-.5.5H5.707l2.147 2.146a.5.5 0 0 1-.708.708l-3-3a.5.5 0 0 1 0-.708l3-3a.5.5 0 1 1 .708.708L5.707 7.5H11.5a.5.5 0 0 1 .5.5z"/>
  </svg>
);

export default function TripsPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initializeMockData(); // Ensure mock data is there if needed
    const loadedTrips = getTrips().filter(trip => trip.status === 'upcoming' || trip.status === 'ongoing');
    setTrips(loadedTrips);
    setIsLoading(false);
  }, []);

  const handleDeleteTrip = (tripId: string) => {
    deleteTripFromStorage(tripId);
    setTrips(prevTrips => prevTrips.filter(trip => trip.id !== tripId));
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
        <h1 className="text-3xl font-bold h-underline">رحلاتك</h1>
        <Button asChild>
          <Link href="/trips/create">
            <Plus className="ms-2 h-5 w-5" /> إضافة رحلة جديدة
          </Link>
        </Button>
      </div>

      {trips.length === 0 ? (
        <Card className="text-center py-10">
          <CardContent className="flex flex-col items-center">
            <AlertTriangle className="w-16 h-16 text-muted-foreground mb-4" />
            <p className="text-xl text-muted-foreground">لا توجد رحلات متاحة حالياً.</p>
            <p className="text-sm text-muted-foreground mt-2">قم بإضافة رحلة جديدة لتبدأ!</p>
          </CardContent>
        </Card>
      ) : (
        <div>
          {trips.map(trip => (
            <TripCard key={trip.id} trip={trip} onDelete={handleDeleteTrip} />
          ))}
        </div>
      )}
    </div>
  );
}