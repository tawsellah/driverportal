
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
import { User, Mail, Phone, Star, Briefcase, Car, Edit3, Save, Loader2, Check, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import { VEHICLE_TYPES, JORDAN_GOVERNORATES } from '@/lib/constants';
import { format } from 'date-fns';
import { auth } from '@/lib/firebase';
import { getUserProfile, updateUserProfile, type UserProfile, simulateCloudinaryUpload } from '@/lib/firebaseService';
import { Checkbox } from "@/components/ui/checkbox"; // Import Checkbox

const profileSchema = z.object({
  fullName: z.string().min(3, "الاسم الكامل مطلوب"),
  phone: z.string().regex(/^07[789]\d{7}$/, "رقم هاتف أردني غير صالح"),
  paymentMethods: z.object({
    cash: z.boolean().optional().default(true),
    click: z.boolean().optional().default(false),
    clickCode: z.string().optional().nullable(), // Allow null
  }).optional(),
  idPhotoUrl: z.string().url().or(z.literal("")).optional().nullable(), // Allow empty string or null
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function ProfilePage() {
  const { toast } = useToast();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingProfile, setIsFetchingProfile] = useState(true);
  const [newPhotoFile, setNewPhotoFile] = useState<File | null>(null);


  const { control, handleSubmit, register, reset, watch, formState: { errors } } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
        fullName: '',
        phone: '',
        paymentMethods: {
            cash: true,
            click: false,
            clickCode: '',
        },
        idPhotoUrl: '',
    }
  });

  useEffect(() => {
    const fetchProfile = async () => {
      setIsFetchingProfile(true);
      const currentUser = auth.currentUser;
      if (currentUser) {
        const profile = await getUserProfile(currentUser.uid);
        setUserProfile(profile);
        if (profile) {
          reset({
            fullName: profile.fullName,
            phone: profile.phone,
            paymentMethods: profile.paymentMethods || { cash: true, click: false, clickCode: '' },
            idPhotoUrl: profile.idPhotoUrl || '',
          });
        }
      } else {
        toast({ title: "لم يتم العثور على الملف الشخصي أو المستخدم غير مسجل", variant: "destructive" });
      }
      setIsFetchingProfile(false);
    };
    fetchProfile();
  }, [reset, toast]);

  const paymentMethodsWatched = watch("paymentMethods");

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setNewPhotoFile(event.target.files[0]);
    }
  };

  const onSubmit = async (data: ProfileFormValues) => {
    if (!userProfile || !auth.currentUser) return;
    setIsLoading(true);
    
    let updatedPhotoUrl: string | null = userProfile.idPhotoUrl || null;
    if (newPhotoFile) {
      updatedPhotoUrl = simulateCloudinaryUpload(newPhotoFile.name);
    }

    const updates: Partial<UserProfile> = {
      fullName: data.fullName,
      phone: data.phone,
      paymentMethods: {
        cash: data.paymentMethods?.cash || false,
        click: data.paymentMethods?.click || false,
        clickCode: data.paymentMethods?.click ? (data.paymentMethods?.clickCode || '') : '', // Store empty string if click is false
      },
      idPhotoUrl: updatedPhotoUrl,
    };

    try {
      await updateUserProfile(auth.currentUser.uid, updates);
      const refreshedProfile = await getUserProfile(auth.currentUser.uid);
      setUserProfile(refreshedProfile);
       if (refreshedProfile) {
          reset({ 
            fullName: refreshedProfile.fullName,
            phone: refreshedProfile.phone,
            paymentMethods: refreshedProfile.paymentMethods || { cash: true, click: false, clickCode: '' },
            idPhotoUrl: refreshedProfile.idPhotoUrl || '',
          });
        }
      setNewPhotoFile(null);
      setIsEditing(false);
      toast({ title: "تم تحديث الملف الشخصي بنجاح!" });
    } catch (error) {
      console.error("Profile Update Error:", error);
      toast({ title: "خطأ في تحديث الملف الشخصي", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
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
  
  const vehicleTypeName = VEHICLE_TYPES.find(vt => vt.id === userProfile.vehicleType)?.name || userProfile.vehicleType || 'غير محدد';

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col items-center text-center">
          <Avatar className="w-24 h-24 mb-4 border-2 border-primary">
            <AvatarImage 
              src={newPhotoFile ? URL.createObjectURL(newPhotoFile) : userProfile.idPhotoUrl || "https://placehold.co/100x100.png?text=S"} 
              alt={userProfile.fullName} 
              data-ai-hint="driver portrait" />
            <AvatarFallback>{userProfile.fullName?.charAt(0) || 'S'}</AvatarFallback>
          </Avatar>
          {isEditing && (
            <div className="mb-2">
              <Label htmlFor="newIdPhoto">تغيير الصورة الشخصية</Label>
              <Input id="newIdPhoto" type="file" accept="image/*" onChange={handlePhotoChange} />
            </div>
          )}
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
                <Label htmlFor="email">البريد الإلكتروني (للدخول)</Label>
                <Input id="email" type="email" value={userProfile.email} disabled />
              </div>
              <div>
                <Label htmlFor="phone">رقم الهاتف (للتواصل)</Label>
                <Input id="phone" type="tel" {...register('phone')} disabled={!isEditing} />
                {errors.phone && <p className="mt-1 text-sm text-destructive">{errors.phone.message}</p>}
              </div>
               <div>
                <Label htmlFor="idNumber">رقم الهوية</Label>
                <Input id="idNumber" value={userProfile.idNumber || 'غير متوفر'} disabled />
              </div>
            </div>

            {/* Driver Info */}
             <h3 className="text-lg font-semibold border-b pb-2 mt-6 mb-3">معلومات الرخصة</h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="licenseNumber">رقم الرخصة</Label>
                    <Input id="licenseNumber" value={userProfile.licenseNumber || 'غير متوفر'} disabled />
                </div>
                <div>
                    <Label htmlFor="licenseExpiry">تاريخ انتهاء الرخصة</Label>
                    <Input id="licenseExpiry" value={userProfile.licenseExpiry ? format(new Date(userProfile.licenseExpiry), 'yyyy-MM-dd') : 'غير متوفر'} disabled />
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
                <Input id="vehicleMakeModel" value={userProfile.vehicleMakeModel || 'غير محدد'} disabled />
              </div>
              <div>
                <Label htmlFor="vehicleYear">سنة الصنع</Label>
                <Input id="vehicleYear" value={userProfile.vehicleYear || 'غير محدد'} disabled />
              </div>
              <div>
                <Label htmlFor="vehicleColor">اللون</Label>
                <Input id="vehicleColor" value={userProfile.vehicleColor || 'غير محدد'} disabled />
              </div>
              <div>
                <Label htmlFor="vehiclePlateNumber">رقم اللوحة</Label>
                <Input id="vehiclePlateNumber" value={userProfile.vehiclePlateNumber || 'غير محدد'} disabled />
              </div>
            </div>
            
            {/* Payment Methods */}
            <h3 className="text-lg font-semibold border-b pb-2 mt-6 mb-3">طرق الدفع المقبولة</h3>
            <div className="space-y-3">
              <div className="flex items-center space-x-2 space-x-reverse">
                <Controller
                  name="paymentMethods.cash"
                  control={control}
                  render={({ field }) => (
                    <Checkbox
                      id="paymentCash"
                      checked={field.value || false}
                      onCheckedChange={field.onChange}
                      disabled={!isEditing}
                    />
                  )}
                />
                <Label htmlFor="paymentCash" className="font-normal cursor-pointer">الدفع النقدي (كاش)</Label>
              </div>
              <div className="flex items-center space-x-2 space-x-reverse">
                <Controller
                  name="paymentMethods.click"
                  control={control}
                  render={({ field }) => (
                    <Checkbox
                      id="paymentClick"
                      checked={field.value || false}
                      onCheckedChange={field.onChange}
                      disabled={!isEditing}
                    />
                  )}
                />
                <Label htmlFor="paymentClick" className="font-normal cursor-pointer">CliQ (كليك)</Label>
              </div>
              {paymentMethodsWatched?.click && (
                <div className="ps-7 pt-2">
                  <Label htmlFor="clickCode">معرّف CliQ الخاص بك</Label>
                  <Input 
                    id="clickCode" 
                    {...register('paymentMethods.clickCode')} 
                    disabled={!isEditing} 
                    placeholder="اسمك أو رقم هاتفك على CliQ" 
                    className="mt-1"
                  />
                   {errors.paymentMethods?.clickCode && <p className="mt-1 text-sm text-destructive">{errors.paymentMethods.clickCode.message}</p>}
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
        <CardFooter className="flex flex-col gap-2">
          {!isEditing && (
            <Button onClick={() => { setIsEditing(true); }} className="w-full">
              <Edit3 className="ms-2 h-4 w-4" /> تعديل الملف الشخصي
            </Button>
          )}
          {isEditing && (
             <Button onClick={() => { 
                setIsEditing(false); 
                setNewPhotoFile(null); 
                if(userProfile) {
                    reset({ 
                        fullName: userProfile.fullName, 
                        phone: userProfile.phone, 
                        paymentMethods: userProfile.paymentMethods || { cash: true, click: false, clickCode: '' }, 
                        idPhotoUrl: userProfile.idPhotoUrl || '' 
                    });
                }
             }} variant="outline" className="w-full">
               إلغاء
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}

    