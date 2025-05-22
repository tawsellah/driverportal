
"use client";

import type { SeatID } from '@/lib/constants';
import { useState, useEffect, useMemo } from 'react';
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
import { addTrip, getActiveTripForDriver, type NewTripData, getStopStationsForRoute, addStopsToRoute } from '@/lib/firebaseService';

const tripSchema = z.object({
  startPoint: z.string().min(1, { message: "نقطة الانطلاق مطلوبة" }),
  destination: z.string().min(1, { message: "الوجهة مطلوبة" }),
  stops: z.array(z.string().min(1, { message: "اسم المحطة مطلوب (حرف واحد على الأقل)" })).optional(),
  tripDate: z.date({ required_error: "تاريخ الرحلة مطلوب" }),
  tripTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "صيغة الوقت غير صحيحة (HH:MM)" }),
  expectedArrivalTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "صيغة الوقت غير صحيحة (HH:MM)" }),
  offeredSeatsConfig: z.record(z.boolean()),
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

  // State for stop suggestions
  const [routeSpecificStopSuggestions, setRouteSpecificStopSuggestions] = useState<string[]>([]);
  const [activeStopInputIndex, setActiveStopInputIndex] = useState<number | null>(null);
  const [currentStopSearchTerm, setCurrentStopSearchTerm] = useState<string>('');


  const { control, handleSubmit, register, setValue, watch, formState: { errors }, getValues, resetField } = useForm<TripFormValues>({
    resolver: zodResolver(tripSchema),
    defaultValues: {
      stops: [],
      offeredSeatsConfig: passengerSeats.reduce((acc, seat) => {
        acc[seat.id as SeatID] = false;
        return acc;
      }, {} as Record<SeatID, boolean>),
      pricePerPassenger: 0,
    },
  });

  const { fields, append, remove, replace } = useFieldArray({ control, name: "stops" });
  const offeredSeatsConfigFromForm = watch("offeredSeatsConfig");
  const watchedStartPoint = watch("startPoint");
  const watchedDestination = watch("destination");

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
    const today = new Date();
    today.setHours(0,0,0,0);
    setMinCalendarDate(today);
  }, [router]);

  useEffect(() => {
    const fetchAndSetSuggestedStops = async () => {
      if (watchedStartPoint && watchedDestination) {
        const suggestedStops = await getStopStationsForRoute(watchedStartPoint, watchedDestination);
        if (suggestedStops && suggestedStops.length > 0) {
          const validSuggestedStops = suggestedStops.filter(stop => stop && stop.trim() !== '');
          setRouteSpecificStopSuggestions(validSuggestedStops);
          // DO NOT automatically fill stops: replace(validSuggestedStops.map(stopName => stopName));
          // toast({ title: "تم تحميل محطات التوقف المقترحة", description: "يمكنك تعديلها حسب الحاجة." });
        } else {
          setRouteSpecificStopSuggestions([]);
          // DO NOT automatically clear stops if none found for the route: replace([]);
        }
      } else {
         setRouteSpecificStopSuggestions([]);
         // DO NOT automatically clear stops if route is incomplete: replace([]);
      }
    };
    fetchAndSetSuggestedStops();
  }, [watchedStartPoint, watchedDestination, toast]); // Removed 'replace' from dependencies as it's no longer called here

  const filteredDynamicSuggestions = useMemo(() => {
    if (!currentStopSearchTerm.trim() || !routeSpecificStopSuggestions || routeSpecificStopSuggestions.length === 0) {
      return [];
    }
    return routeSpecificStopSuggestions.filter(suggestion =>
      suggestion.toLowerCase().includes(currentStopSearchTerm.toLowerCase())
    );
  }, [currentStopSearchTerm, routeSpecificStopSuggestions]);


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

    const selectedOfferedSeatsCount = Object.values(data.offeredSeatsConfig).filter(isOffered => isOffered).length;
    if (selectedOfferedSeatsCount === 0) {
      toast({ title: "خطأ في الإدخال", description: "يجب اختيار مقعد واحد على الأقل لعرضه.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    const dateTime = new Date(data.tripDate);
    const [hours, minutes] = data.tripTime.split(':');
    dateTime.setHours(parseInt(hours), parseInt(minutes));

    const newTripData: NewTripData = {
      startPoint: data.startPoint,
      destination: data.destination,
      stops: data.stops?.filter(stop => stop && stop.trim() !== '') || [],
      dateTime: dateTime.toISOString(),
      expectedArrivalTime: data.expectedArrivalTime,
      offeredSeatsConfig: data.offeredSeatsConfig,
      meetingPoint: data.meetingPoint,
      pricePerPassenger: data.pricePerPassenger,
      notes: data.notes,
    };

    try {
      await addTrip(currentUser.uid, newTripData);
      toast({ title: "تم إنشاء الرحلة بنجاح!" });

      if (data.startPoint && data.destination && newTripData.stops && newTripData.stops.length > 0) {
        await addStopsToRoute(data.startPoint, data.destination, newTripData.stops);
      }
      router.push('/trips');
    } catch (error) {
      console.error("Error creating trip:", error);
      toast({ title: "خطأ في إنشاء الرحلة", description: (error as Error).message || "يرجى المحاولة مرة أخرى.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSeat = (seatId: SeatID) => {
    const currentStatus = offeredSeatsConfigFromForm[seatId];
    setValue(`offeredSeatsConfig.${seatId}`, !currentStatus, { shouldValidate: true });
  };
  
  const offeredSeatsCount = Object.values(offeredSeatsConfigFromForm || {}).filter(isOffered => isOffered).length;


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
  
  const tripDateError = errors.tripDate && (errors.tripDate as any).message;


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
              <div key={field.id} className="flex items-center gap-2 mt-2 relative">
                <Controller
                  name={`stops.${index}`}
                  control={control}
                  defaultValue={field.value || ""} 
                  render={({ field: stopField }) => (
                    <Input
                      {...stopField}
                      placeholder={`محطة توقف ${index + 1}`}
                      className="flex-grow"
                      onFocus={() => {
                        setActiveStopInputIndex(index);
                        setCurrentStopSearchTerm(stopField.value || '');
                      }}
                      onChange={(e) => {
                        stopField.onChange(e); // RHF's onChange
                        setCurrentStopSearchTerm(e.target.value);
                        if (activeStopInputIndex !== index) setActiveStopInputIndex(index);
                      }}
                      onBlur={() => {
                        // Delay hiding suggestions to allow click
                        setTimeout(() => {
                          if (activeStopInputIndex === index) { // only blur if it's still the active one
                             setActiveStopInputIndex(null);
                          }
                        }, 150);
                      }}
                    />
                  )}
                />
                <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} aria-label="حذف محطة">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
                {/* Suggestions Box */}
                {activeStopInputIndex === index && filteredDynamicSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-10 mt-1 max-h-40 overflow-y-auto rounded-md border bg-popover shadow-lg">
                    {filteredDynamicSuggestions.map((suggestion, sIndex) => (
                      <div
                        key={sIndex}
                        className="cursor-pointer p-2 hover:bg-accent hover:text-accent-foreground"
                        onMouseDown={(e) => { // Use onMouseDown to prevent onBlur from firing first
                            e.preventDefault();
                            setValue(`stops.${index}`, suggestion, { shouldValidate: true });
                            setCurrentStopSearchTerm('');
                            setActiveStopInputIndex(null);
                        }}
                      >
                        {suggestion}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {errors.stops && errors.stops.length > 0 && errors.stops.map((stopError, index) => (
                stopError && <p key={`stop-error-${index}`} className="mt-1 text-sm text-destructive">{stopError.message}</p>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => append("")} className="mt-2">
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
                        disabled={(date) => minCalendarDate ? date < minCalendarDate : false}
                      />
                    </PopoverContent>
                  </Popover>
                )}
              />
              {tripDateError && <p className="mt-1 text-sm text-destructive">{tripDateError}</p>}
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
                  variant={offeredSeatsConfigFromForm[seat.id as SeatID] ? "default" : "outline"}
                  onClick={() => toggleSeat(seat.id as SeatID)}
                  className="flex flex-col items-center h-auto p-2 text-center"
                  aria-pressed={offeredSeatsConfigFromForm[seat.id as SeatID]}
                >
                  <Armchair className="h-6 w-6 mb-1"/>
                  <span className="text-xs">{seat.name}</span>
                </Button>
              ))}
            </div>
            {errors.offeredSeatsConfig && <p className="mt-1 text-sm text-destructive">{(errors.offeredSeatsConfig as any).message || "خطأ في اختيار المقاعد"}</p>}
            <p className="mt-1 text-sm text-muted-foreground">
              عدد المقاعد المتاحة: {offeredSeatsCount || 0}
            </p>
             {offeredSeatsCount === 0 && <p className="mt-1 text-sm text-destructive">يجب اختيار مقعد واحد على الأقل</p>}
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
    

    

    