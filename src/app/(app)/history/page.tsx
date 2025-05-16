
"use client";

import type { SeatID } from '@/lib/constants';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Briefcase, CalendarDays, Clock, DollarSign, Download, Filter, MapPin, Route, Users, Armchair, ListChecks } from 'lucide-react';
import type { Trip } from '@/lib/storage';
import { getTrips, initializeMockData } from '@/lib/storage';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { JORDAN_GOVERNORATES } from '@/lib/constants';

function CompletedTripCard({ trip }: { trip: Trip }) {
  const { toast } = useToast();
  const startPointName = JORDAN_GOVERNORATES.find(g => g.id === trip.startPoint)?.name || trip.startPoint;
  const destinationName = JORDAN_GOVERNORATES.find(g => g.id === trip.destination)?.name || trip.destination;
  const stopNames = trip.stops?.map(s => JORDAN_GOVERNORATES.find(g => g.id === s)?.name || s).join('، ');

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
          عدد الركاب: {trip.selectedSeats.length} / {trip.offeredSeatIds.length}
        </div>
         {trip.selectedSeats && trip.selectedSeats.length > 0 && (
          <div className="flex items-center">
            <Armchair className="ms-2 h-4 w-4 text-muted-foreground" />
            المقاعد المحجوزة: {trip.selectedSeats.map(s => s.replace(/_/g, ' ')).join('، ')}
          </div>
        )}
        <div className="flex items-center">
          <DollarSign className="ms-2 h-4 w-4 text-green-600" />
          السعر للراكب: {trip.pricePerPassenger} د.أ
        </div>
        {trip.earnings !== undefined && (
          <div className="flex items-center font-semibold">
            <DollarSign className="ms-2 h-4 w-4 text-green-600" />
            الأرباح من هذه الرحلة: {trip.earnings} د.أ
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

  useEffect(() => {
    initializeMockData(); // Ensure mock data is there
    const allTrips = getTrips();
    setCompletedTrips(allTrips.filter(trip => trip.status === 'completed'));
    setIsLoading(false);
  }, []);

  const totalEarnings = completedTrips.reduce((sum, trip) => sum + (trip.earnings || 0), 0);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Briefcase className="h-12 w-12 animate-spin text-primary" /> {/* Using Briefcase for loading */}
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
          <p className="text-lg font-semibold">إجمالي الأرباح: <span className="text-green-600">{totalEarnings.toFixed(2)} د.أ</span></p>
        </CardContent>
      </Card>

      {completedTrips.length === 0 ? (
        <Card className="text-center py-10">
          <CardContent className="flex flex-col items-center">
            <AlertTriangle className="w-16 h-16 text-muted-foreground mb-4" />
            <p className="text-xl text-muted-foreground">لا يوجد رحلات مكتملة في السجل.</p>
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
