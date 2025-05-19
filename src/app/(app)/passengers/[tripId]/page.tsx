
"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Users, AlertTriangle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { auth, onAuthUserChangedListener, getTripById, type Trip } from '@/lib/firebaseService';
import { SEAT_CONFIG } from '@/lib/constants';


interface SimplePassenger {
  id: string;
  name: string;
  phone?: string;
  seat: string; 
}


export default function TripPassengersPage() {
  const router = useRouter();
  const params = useParams();
  const tripId = params.id as string;

  const [trip, setTrip] = useState<Trip | null>(null);
  const [passengers, setPassengers] = useState<SimplePassenger[]>([]); 
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTripData = async (userId: string) => {
      if (tripId) {
        setIsLoading(true);
        const currentTrip = await getTripById(tripId);
        
        if (currentTrip && currentTrip.driverId === userId) {
            setTrip(currentTrip);
            // Mock passenger data for now, this should come from trip.passengers or a backend
            const mockPassengers: SimplePassenger[] = currentTrip.selectedSeats.map((seatId, index) => ({
              id: `passenger-${index + 1}-${seatId}`, 
              name: `راكب ${index + 1}`,
              phone: `079000000${index + 1}`, 
              seat: SEAT_CONFIG[seatId]?.name || seatId.replace(/_/g, ' '),
            }));
            setPassengers(mockPassengers);
        } else if (currentTrip && currentTrip.driverId !== userId) {
            setTrip(null); 
        } else {
            setTrip(null); 
        }
        setIsLoading(false);
      }
    };

    const unsubscribe = onAuthUserChangedListener(user => {
        if (user) {
            fetchTripData(user.uid);
        } else {
            router.push('/auth/signin');
            setIsLoading(false);
        }
    });
    return () => unsubscribe();

  }, [tripId, router]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!trip) {
    return (
      <Card className="text-center py-10">
        <CardContent className="flex flex-col items-center">
          <AlertTriangle className="w-16 h-16 text-muted-foreground mb-4" />
          <p className="text-xl text-muted-foreground">لم يتم العثور على الرحلة أو ليس لديك صلاحية لعرضها.</p>
          <Button asChild className="mt-4">
            <Link href="/trips">
              <ArrowLeft className="ms-2 h-4 w-4" /> العودة إلى الرحلات
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }
  
  const totalOfferedSeats = trip.offeredSeatsConfig ? Object.values(trip.offeredSeatsConfig).filter(isOffered => isOffered).length : 0;


  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold h-underline flex items-center">
          <Users className="me-3 h-8 w-8 text-primary" />
          ركاب الرحلة إلى {trip.destination}
        </h1>
        <Button asChild variant="outline">
          <Link href="/trips">
             <ArrowLeft className="ms-2 h-4 w-4" /> العودة
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>قائمة الركاب ({passengers.length} / {totalOfferedSeats} مقاعد مشغولة)</CardTitle>
        </CardHeader>
        <CardContent>
          {passengers.length === 0 ? (
            <p className="text-muted-foreground">لا يوجد ركاب مسجلين في هذه الرحلة بعد.</p>
          ) : (
            <ul className="space-y-3">
              {passengers.map(passenger => (
                <li key={passenger.id} className="flex justify-between items-center p-3 border rounded-md">
                  <div>
                    <p className="font-semibold">{passenger.name}</p>
                    <p className="text-sm text-muted-foreground">المقعد: {passenger.seat}</p>
                  </div>
                  {passenger.phone && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={`tel:${passenger.phone}`}>اتصال</a>
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-center text-sm text-orange-600">
            ملاحظة: هذه الصفحة قيد التطوير. بيانات الركاب المعروضة هي بيانات تجريبية.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
