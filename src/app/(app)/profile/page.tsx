
"use client";

import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { User, Mail, Phone, Star, Briefcase, CreditCard, Car, Palette, Hash, Edit3, Save, Loader2 } from 'lucide-react';
import type { UserProfile } from '@/lib/storage';
import { getUserProfile, saveUserProfile, initializeMockData } from '@/lib/storage';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import { VEHICLE_TYPES } from '@/lib/constants';

const profileSchema = z.object({
  fullName: z.string().min(3, "الاسم الكامل مطلوب"),
  email: z.string().email("بريد إلكتروني غير صالح"),
  phone: z.string().regex(/^07[789]\d{7}$/, "رقم هاتف أردني غير صالح"),
  paymentMethods: z.object({
    cash: z.boolean().optional(),
    click: z.boolean().optional(),
    clickCode: z.string().optional(),
  }).optional(),
  // Fields below are typically not editable by user in this simple form
  // but included for completeness if editing is expanded
  idNumber: z.string().optional(),
  licenseNumber: z.string().optional(),
  vehicleType: z.string().optional(),
  vehicleMakeModel: z.string().optional(),
  vehicleYear: z.string().optional(),
  vehicleColor: z.string().optional(),
  vehiclePlateNumber: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function ProfilePage() {
  const { toast } = useToast();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingProfile, setIsFetchingProfile] = useState(true);

  const { control, handleSubmit, register, reset, watch, formState: { errors } } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
  });

  useEffect(() => {
    initializeMockData();
    const profile = getUserProfile();
    setUserProfile(profile);
    if (profile) {
      reset(profile); // Populate form with profile data
    }
    setIsFetchingProfile(false);
  }, [reset]);

  const paymentMethods = watch("paymentMethods");

  const onSubmit = (data: ProfileFormValues) => {
    if (!userProfile) return;
    setIsLoading(true);
    
    const updatedProfile: UserProfile = {
      ...userProfile,
      fullName: data.fullName,
      email: data.email,
      phone: data.phone,
      paymentMethods: data.paymentMethods,
    };
    saveUserProfile(updatedProfile);
    setUserProfile(updatedProfile); // Update local state
    setIsEditing(false);
    toast({ title: "تم تحديث الملف الشخصي بنجاح!" });
    setIsLoading(false);
  };

  if (isFetchingProfile) {
     return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!userProfile) {
    return <p className="text-center text-muted-foreground">لم يتم العثور على الملف الشخصي.</p>;
  }
  
  const vehicleTypeName = VEHICLE_TYPES.find(vt => vt.id === userProfile.vehicleType)?.name || userProfile.vehicleType;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col items-center text-center">
          <Avatar className="w-24 h-24 mb-4 border-2 border-primary">
            <AvatarImage src={userProfile.idPhotoUrl || "https://placehold.co/100x100.png"} alt={userProfile.fullName} data-ai-hint="driver portrait" />
            <AvatarFallback>{userProfile.fullName?.charAt(0) || 'S'}</AvatarFallback>
          </Avatar>
          <CardTitle className="text-2xl">{userProfile.fullName}</CardTitle>
          <div className="text-muted-foreground flex items-center">
            <Star className="w-4 h-4 ms-1 text-yellow-400 fill-yellow-400" /> {userProfile.rating || 'N/A'}
            <span className="mx-2">|</span>
            <Briefcase className="w-4 h-4 ms-1" /> {userProfile.tripsCount || 0} رحلة
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Personal Info */}
            <h3 className="text-lg font-semibold border-b pb-2 mb-3">المعلومات الشخصية</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="fullName">الاسم الكامل</Label>
                <Input id="fullName" {...register('fullName')} disabled={!isEditing} />
                {errors.fullName && <p className="mt-1 text-sm text-destructive">{errors.fullName.message}</p>}
              </div>
              <div>
                <Label htmlFor="email">البريد الإلكتروني</Label>
                <Input id="email" type="email" {...register('email')} disabled={!isEditing} />
                {errors.email && <p className="mt-1 text-sm text-destructive">{errors.email.message}</p>}
              </div>
              <div>
                <Label htmlFor="phone">رقم الهاتف</Label>
                <Input id="phone" type="tel" {...register('phone')} disabled={!isEditing} />
                {errors.phone && <p className="mt-1 text-sm text-destructive">{errors.phone.message}</p>}
              </div>
               <div>
                <Label htmlFor="idNumber">رقم الهوية</Label>
                <Input id="idNumber" defaultValue={userProfile.idNumber} disabled />
              </div>
            </div>

            {/* Driver Info */}
             <h3 className="text-lg font-semibold border-b pb-2 mt-6 mb-3">معلومات الرخصة</h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="licenseNumber">رقم الرخصة</Label>
                    <Input id="licenseNumber" defaultValue={userProfile.licenseNumber} disabled />
                </div>
                <div>
                    <Label htmlFor="licenseExpiry">تاريخ انتهاء الرخصة</Label>
                    <Input id="licenseExpiry" defaultValue={userProfile.licenseExpiry ? format(new Date(userProfile.licenseExpiry), 'yyyy-MM-dd') : ''} disabled />
                </div>
            </div>


            {/* Vehicle Info */}
            <h3 className="text-lg font-semibold border-b pb-2 mt-6 mb-3">معلومات المركبة</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="vehicleType">نوع المركبة</Label>
                <Input id="vehicleType" value={vehicleTypeName} disabled />
              </div>
              <div>
                <Label htmlFor="vehicleMakeModel">الصنع والموديل</Label>
                <Input id="vehicleMakeModel" value={userProfile.vehicleMakeModel} disabled />
              </div>
              <div>
                <Label htmlFor="vehicleYear">سنة الصنع</Label>
                <Input id="vehicleYear" value={userProfile.vehicleYear} disabled />
              </div>
              <div>
                <Label htmlFor="vehicleColor">اللون</Label>
                <Input id="vehicleColor" value={userProfile.vehicleColor} disabled />
              </div>
              <div>
                <Label htmlFor="vehiclePlateNumber">رقم اللوحة</Label>
                <Input id="vehiclePlateNumber" value={userProfile.vehiclePlateNumber} disabled />
              </div>
            </div>
            
            {/* Payment Methods */}
            <h3 className="text-lg font-semibold border-b pb-2 mt-6 mb-3">طرق الدفع</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="paymentCash" className="flex items-center">
                  <input type="checkbox" id="paymentCash" className="ms-2 form-checkbox" {...register('paymentMethods.cash')} disabled={!isEditing} />
                  الدفع النقدي (كاش)
                </Label>
              </div>
              <div className="flex items-center justify-between">
                 <Label htmlFor="paymentClick" className="flex items-center">
                    <input type="checkbox" id="paymentClick" className="ms-2 form-checkbox" {...register('paymentMethods.click')} disabled={!isEditing} />
                    CliQ (كليك)
                </Label>
              </div>
              {paymentMethods?.click && (
                <div>
                  <Label htmlFor="clickCode">رمز CliQ (اختياري)</Label>
                  <Input id="clickCode" {...register('paymentMethods.clickCode')} disabled={!isEditing} placeholder="اسمك أو رقم هاتفك على CliQ" />
                </div>
              )}
            </div>

            {isEditing && (
              <Button type="submit" className="w-full mt-6" disabled={isLoading}>
                {isLoading ? <Loader2 className="animate-spin" /> : <><Save className="ms-2 h-4 w-4" /> حفظ التغييرات</>}
              </Button>
            )}
          </form>
        </CardContent>
        <CardFooter>
          {!isEditing && (
            <Button onClick={() => { setIsEditing(true); reset(userProfile); }} className="w-full">
              <Edit3 className="ms-2 h-4 w-4" /> تعديل الملف الشخصي
            </Button>
          )}
          {isEditing && (
             <Button onClick={() => { setIsEditing(false); reset(userProfile); }} variant="outline" className="w-full">
               إلغاء
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}

