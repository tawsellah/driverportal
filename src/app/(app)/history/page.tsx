
"use client";

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Briefcase, CalendarDays, Clock, DollarSign, Download, Filter, MapPin, Route, Users, Armchair, ListChecks, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { JORDAN_GOVERNORATES, SEAT_CONFIG, type SeatID } from '@/lib/constants';
import { auth, onAuthUserChangedListener, getCompletedTripsForDriver, type Trip } from '@/lib/firebaseService';
import { useRouter } from 'next/navigation';


function CompletedTripCard({ trip }: { trip: Trip }) {
  const { toast } = useToast();
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
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
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
      <CardFooter className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => toast({ title: "تفاصيل الركاب (قيد التطوير)"})}>
          <Users className="ms-1 h-4 w-4" /> عرض الركاب
        </Button>
      </CardFooter>
    </Card>
  );
}

export default function HistoryPage() {
  const [completedTrips, setCompletedTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    const fetchHistory = async (userId: string) => {
      setIsLoading(true);
      const trips = await getCompletedTripsForDriver(userId);
      setCompletedTrips(trips);
      setIsLoading(false);
    };

    const unsubscribe = onAuthUserChangedListener(user => {
        if (user) {
            fetchHistory(user.uid);
        } else {
            router.push('/auth/signin');
            setIsLoading(false);
        }
    });
    return () => unsubscribe();
  }, [router]);

  const totalEarnings = completedTrips
    .filter(trip => trip.status === 'completed' && trip.earnings !== undefined)
    .reduce((sum, trip) => sum + (trip.earnings || 0), 0);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <h1 className="text-3xl font-bold h-underline flex items-center">
          <ListChecks className="me-3 h-8 w-8 text-primary" />
          سجل الرحلات
        </h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => toast({ title: "فلترة الرحلات (قيد التطوير)"})}>
            <Filter className="ms-2 h-4 w-4" /> فلترة
          </Button>
          <Button onClick={() => toast({ title: "تصدير البيانات غير متوفر حالياً" })}>
            <Download className="ms-2 h-4 w-4" /> تصدير البيانات
          </Button>
        </div>
      </div>

      <Card className="mb-6 bg-secondary/50">
        <CardContent className="p-4">
          <p className="text-lg font-semibold">إجمالي الأرباح من الرحلات المكتملة: <span className="text-green-600">{totalEarnings.toFixed(2)} د.أ</span></p>
        </CardContent>
      </Card>

      {completedTrips.length === 0 ? (
        <Card className="text-center py-10">
          <CardContent className="flex flex-col items-center">
            <AlertTriangle className="w-16 h-16 text-muted-foreground mb-4" />
            <p className="text-xl text-muted-foreground">لا يوجد رحلات في السجل.</p>
          </CardContent>
        </Card>
      ) : (
        <div>
          {completedTrips.map(trip => (
            <CompletedTripCard key={trip.id} trip={trip} />
          ))}
        </div>
      )}
    </div>
  );
}
