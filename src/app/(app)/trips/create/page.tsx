
"use client";

import type { SeatID } from '@/lib/constants';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DropdownSearch } from '@/components/shared/dropdown-search';
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { CalendarIcon, MapPin, Clock, Users, DollarSign, PlusCircle, Trash2, Armchair, Car, Loader2, AlertCircle } from 'lucide-react';
import { JORDAN_GOVERNORATES, SEAT_CONFIG } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { auth } from '@/lib/firebase';
import { addTrip, getActiveTripForDriver, type NewTripData } from '@/lib/firebaseService';

const tripSchema = z.object({
  startPoint: z.string().min(1, { message: "نقطة الانطلاق مطلوبة" }),
  destination: z.string().min(1, { message: "الوجهة مطلوبة" }),
  stops: z.array(z.string().min(1, { message: "اسم المحطة مطلوب" })).optional(),
  tripDate: z.date({ required_error: "تاريخ الرحلة مطلوب" }),
  tripTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "صيغة الوقت غير صحيحة (HH:MM)" }),
  expectedArrivalTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "صيغة الوقت غير صحيحة (HH:MM)" }),
  offeredSeatIds: z.array(z.string() as z.ZodType<SeatID>).min(1, { message: "يجب اختيار مقعد واحد على الأقل لتقديمه" }), // This will be used by the form
  meetingPoint: z.string().min(3, { message: "مكان اللقاء مطلوب (3 أحرف على الأقل)" }),
  pricePerPassenger: z.coerce.number().min(0, { message: "السعر يجب أن يكون رقمًا موجبًا" }),
  notes: z.string().optional(),
});

type TripFormValues = z.infer<typeof tripSchema>;

const governorateItems = JORDAN_GOVERNORATES.map(gov => ({ id: gov.id, name: gov.name }));
const passengerSeats = Object.values(SEAT_CONFIG).filter(seat => seat.id !== 'driver');

export default function CreateTripPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingActiveTrip, setIsCheckingActiveTrip] = useState(true);
  const [hasActiveTrip, setHasActiveTrip] = useState(false);
  const [minCalendarDate, setMinCalendarDate] = useState<Date | null>(null);

  useEffect(() => {
    const checkActiveTrip = async () => {
      const currentUser = auth.currentUser;
      if (currentUser) {
        const activeTrip = await getActiveTripForDriver(currentUser.uid);
        if (activeTrip) {
          setHasActiveTrip(true);
        }
      } else {
        router.push('/auth/signin');
      }
      setIsCheckingActiveTrip(false);
    };
    checkActiveTrip();
    setMinCalendarDate(new Date(new Date().setHours(0,0,0,0)));
  }, [router]);

  const { control, handleSubmit, register, setValue, watch, formState: { errors } } = useForm<TripFormValues>({
    resolver: zodResolver(tripSchema),
    defaultValues: {
      stops: [],
      offeredSeatIds: [], // Form uses this array
      pricePerPassenger: 0,
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "stops" });
  const offeredSeatIdsFromForm = watch("offeredSeatIds");

  const onSubmit = async (data: TripFormValues) => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      toast({ title: "المستخدم غير مسجل الدخول", variant: "destructive" });
      return;
    }
    if (hasActiveTrip) {
        toast({ title: "لا يمكنك إنشاء رحلة جديدة", description: "لديك رحلة نشطة بالفعل. قم بإنهائها أو إلغائها أولاً.", variant: "destructive" });
        return;
    }

    setIsLoading(true);
    const dateTime = new Date(data.tripDate);
    const [hours, minutes] = data.tripTime.split(':');
    dateTime.setHours(parseInt(hours), parseInt(minutes));

    // Convert offeredSeatIds (array from form) to offeredSeatsConfig (map for Firebase)
    const offeredSeatsConfig: Record<string, boolean> = {};
    passengerSeats.forEach(seat => {
      offeredSeatsConfig[seat.id] = data.offeredSeatIds.includes(seat.id as SeatID);
    });

    const newTripData: NewTripData = {
      startPoint: data.startPoint,
      destination: data.destination,
      stops: data.stops,
      dateTime: dateTime.toISOString(),
      expectedArrivalTime: data.expectedArrivalTime,
      offeredSeatsConfig: offeredSeatsConfig, // Use the map here
      meetingPoint: data.meetingPoint,
      pricePerPassenger: data.pricePerPassenger,
      notes: data.notes,
    };

    try {
      await addTrip(currentUser.uid, newTripData);
      toast({ title: "تم إنشاء الرحلة بنجاح!" });
      router.push('/trips');
    } catch (error) {
      console.error("Error creating trip:", error);
      toast({ title: "خطأ في إنشاء الرحلة", description: "يرجى المحاولة مرة أخرى.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSeat = (seatId: SeatID) => {
    const currentSeats = offeredSeatIdsFromForm || [];
    const newSeats = currentSeats.includes(seatId)
      ? currentSeats.filter(id => id !== seatId)
      : [...currentSeats, seatId];
    setValue("offeredSeatIds", newSeats, { shouldValidate: true });
  };
  
  if (isCheckingActiveTrip) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ms-3">جار التحقق من الرحلات النشطة...</p>
      </div>
    );
  }

  if (hasActiveTrip) {
    return (
      <Card className="max-w-2xl mx-auto text-center py-10">
        <CardContent className="flex flex-col items-center">
          <AlertCircle className="w-16 h-16 text-destructive mb-4" />
          <p className="text-xl font-semibold">لديك رحلة نشطة بالفعل</p>
          <p className="text-muted-foreground mt-2">
            لا يمكنك إنشاء رحلة جديدة حتى يتم إنهاء أو إلغاء رحلتك الحالية.
          </p>
          <Button onClick={() => router.push('/trips')} className="mt-6">
            العودة إلى رحلاتي
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl font-bold">إنشاء رحلة جديدة</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Start and Destination */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startPoint">نقطة الانطلاق</Label>
              <Controller
                name="startPoint"
                control={control}
                render={({ field }) => (
                  <DropdownSearch
                    id="startPoint"
                    items={governorateItems}
                    selectedItem={governorateItems.find(item => item.id === field.value) || null}
                    onSelectItem={(item) => field.onChange(item?.id || '')}
                    placeholder="اختر نقطة الانطلاق"
                    icon={MapPin}
                  />
                )}
              />
              {errors.startPoint && <p className="mt-1 text-sm text-destructive">{errors.startPoint.message}</p>}
            </div>
            <div>
              <Label htmlFor="destination">الوجهة</Label>
              <Controller
                name="destination"
                control={control}
                render={({ field }) => (
                  <DropdownSearch
                    id="destination"
                    items={governorateItems}
                    selectedItem={governorateItems.find(item => item.id === field.value) || null}
                    onSelectItem={(item) => field.onChange(item?.id || '')}
                    placeholder="اختر الوجهة"
                    icon={MapPin}
                  />
                )}
              />
              {errors.destination && <p className="mt-1 text-sm text-destructive">{errors.destination.message}</p>}
            </div>
          </div>

          {/* Stops */}
          <div>
            <Label>محطات التوقف (اختياري)</Label>
            {fields.map((field, index) => (
              <div key={field.id} className="flex items-center gap-2 mt-2">
                <Controller
                  name={`stops.${index}`}
                  control={control}
                  render={({ field: stopField }) => (
                    <DropdownSearch
                      items={governorateItems}
                      selectedItem={governorateItems.find(item => item.id === stopField.value) || null}
                      onSelectItem={(item) => stopField.onChange(item?.id || '')}
                      placeholder={`محطة توقف ${index + 1}`}
                      icon={MapPin}
                    />
                  )}
                />
                <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} aria-label="حذف محطة">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
            {errors.stops && errors.stops.map((error, index) => error && <p key={index} className="mt-1 text-sm text-destructive">{error.message}</p>)}
            <Button type="button" variant="outline" size="sm" onClick={() => append('')} className="mt-2">
              <PlusCircle className="ms-2 h-4 w-4" /> إضافة محطة توقف
            </Button>
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="tripDate">تاريخ الرحلة</Label>
              <Controller
                name="tripDate"
                control={control}
                render={({ field }) => (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-right font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="ms-2 h-4 w-4" />
                        {field.value ? format(field.value, "PPP", { locale: ar }) : <span>اختر تاريخاً</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        initialFocus
                        locale={ar}
                        disabled={(date) => minCalendarDate ? date < minCalendarDate : true}
                      />
                    </PopoverContent>
                  </Popover>
                )}
              />
              {errors.tripDate && <p className="mt-1 text-sm text-destructive">{errors.tripDate.message}</p>}
            </div>
            <div>
              <Label htmlFor="tripTime">وقت الانطلاق</Label>
              <Input id="tripTime" type="time" {...register('tripTime')} />
              {errors.tripTime && <p className="mt-1 text-sm text-destructive">{errors.tripTime.message}</p>}
            </div>
             <div>
              <Label htmlFor="expectedArrivalTime">وقت الوصول المتوقع</Label>
              <Input id="expectedArrivalTime" type="time" {...register('expectedArrivalTime')} />
              {errors.expectedArrivalTime && <p className="mt-1 text-sm text-destructive">{errors.expectedArrivalTime.message}</p>}
            </div>
          </div>
          
          {/* Seat Selection */}
          <div>
            <Label>المقاعد المعروضة (المتاحة)</Label>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 p-4 border rounded-md mt-1">
              {passengerSeats.map(seat => (
                <Button
                  key={seat.id}
                  type="button"
                  variant={offeredSeatIdsFromForm.includes(seat.id as SeatID) ? "default" : "outline"}
                  onClick={() => toggleSeat(seat.id as SeatID)}
                  className="flex flex-col items-center h-auto p-2 text-center"
                  aria-pressed={offeredSeatIdsFromForm.includes(seat.id as SeatID)}
                >
                  <Armchair className="h-6 w-6 mb-1"/>
                  <span className="text-xs">{seat.name}</span>
                </Button>
              ))}
            </div>
            {errors.offeredSeatIds && <p className="mt-1 text-sm text-destructive">{errors.offeredSeatIds.message}</p>}
            <p className="mt-1 text-sm text-muted-foreground">
              عدد المقاعد المتاحة: {offeredSeatIdsFromForm?.length || 0}
            </p>
          </div>

          {/* Meeting Point and Price */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="meetingPoint">مكان اللقاء</Label>
              <Input id="meetingPoint" {...register('meetingPoint')} placeholder="مثال: دوار الداخلية" />
              {errors.meetingPoint && <p className="mt-1 text-sm text-destructive">{errors.meetingPoint.message}</p>}
            </div>
            <div>
              <Label htmlFor="pricePerPassenger">السعر للراكب (د.أ)</Label>
              <Input id="pricePerPassenger" type="number" {...register('pricePerPassenger')} placeholder="مثال: 5" />
              {errors.pricePerPassenger && <p className="mt-1 text-sm text-destructive">{errors.pricePerPassenger.message}</p>}
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes">ملاحظات (اختياري)</Label>
            <Textarea id="notes" {...register('notes')} placeholder="أية معلومات إضافية عن الرحلة" />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? <Loader2 className="animate-spin" /> : 'إنشاء الرحلة'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
