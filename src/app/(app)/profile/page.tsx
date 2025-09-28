
"use client";

import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { User, Phone, Star, Briefcase, Edit3, Save, Loader2, LogOut, KeyRound, Banknote, Smartphone } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { 
    updateUserProfile, 
    type UserProfile,
    getUserProfile,
} from '@/lib/firebaseService'; 
import { setAuthStatus } from '@/lib/storage';
import { Checkbox } from "@/components/ui/checkbox";
import { ChangePasswordDialog } from '@/components/profile/change-password-dialog';
import { IconInput } from '@/components/shared/icon-input';
import { useUser } from '@/context/UserContext';
import { cn } from '@/lib/utils';


const profileSchema = z.object({
  paymentMethods: z.object({
    cash: z.boolean().optional().default(true),
    click: z.boolean().optional().default(false),
    clickCode: z.string().optional().nullable(),
  }).optional(),
  secondaryPhone: z.string().regex(/^07[789]\d{7}$/, { message: "رقم هاتف أردني غير صالح." }).optional().or(z.literal('')),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

async function uploadFileToImageKit(file: File): Promise<string | null> {
  try {
    const authResponse = await fetch('/api/imagekit-auth');
    if (!authResponse.ok) {
      throw new Error('Failed to get ImageKit auth params');
    }
    const authParams = await authResponse.json();

    const formData = new FormData();
    formData.append('file', file);
    formData.append('fileName', file.name);
    formData.append('publicKey', process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY || "public_IfRvA+ieL0CZzBuuO9i9cFceLn8=");
    formData.append('signature', authParams.signature);
    formData.append('expire', authParams.expire);
    formData.append('token', authParams.token);

    const uploadResponse = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
      method: 'POST',
      body: formData,
    });

    if (!uploadResponse.ok) {
      const errorData = await uploadResponse.json();
      console.error('ImageKit Upload Error:', errorData);
      throw new Error(errorData.message || 'ImageKit upload failed');
    }

    const uploadResult = await uploadResponse.json();
    return uploadResult.url;
  } catch (error) {
    console.error('Error uploading to ImageKit:', error);
    return null;
  }
}


export default function ProfilePage() {
  const { toast } = useToast();
  const router = useRouter();
  const { userProfile, isLoadingProfile } = useUser();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [newPhotoFile, setNewPhotoFile] = useState<File | null>(null);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  
  // Local state to manage profile for editing purposes without directly mutating context
  const [editableProfile, setEditableProfile] = useState<UserProfile | null>(null);

  const { control, handleSubmit, register, reset, watch, formState: { errors } } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
        paymentMethods: {
            cash: true,
            click: false,
            clickCode: '',
        },
        secondaryPhone: '',
    }
  });

  useEffect(() => {
    if (userProfile) {
        setEditableProfile(userProfile);
        reset({
            paymentMethods: userProfile.paymentMethods || { cash: true, click: false, clickCode: '' },
            secondaryPhone: userProfile.secondaryPhone || '',
        });
    }
  }, [userProfile, reset]);

  const paymentMethodsWatched = watch("paymentMethods");

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setNewPhotoFile(event.target.files[0]);
    }
  };

  const onSubmit = async (data: ProfileFormValues) => {
    if (!editableProfile || !auth.currentUser) return;
    setIsLoading(true);
    
    let actualUploadedPhotoUrl: string | null = editableProfile.idPhotoUrl || null;
    if (newPhotoFile) {
      const uploadedUrl = await uploadFileToImageKit(newPhotoFile);
      if (uploadedUrl) {
        actualUploadedPhotoUrl = uploadedUrl;
      } else {
        toast({ title: "فشل رفع الصورة", description: "حدث خطأ أثناء رفع الصورة الشخصية. تم حفظ البيانات الأخرى.", variant: "destructive" });
      }
    }

    const updates: Partial<UserProfile> = {
      paymentMethods: {
        cash: data.paymentMethods?.cash || false,
        click: data.paymentMethods?.click || false,
        clickCode: data.paymentMethods?.click ? (data.paymentMethods?.clickCode || '') : '',
      },
      secondaryPhone: data.secondaryPhone,
      idPhotoUrl: actualUploadedPhotoUrl,
    };

    try {
      await updateUserProfile(auth.currentUser.uid, updates);
      // The UserContext will automatically update the profile, so we just need to re-sync our local editable state
      const refreshedProfile = await getUserProfile(auth.currentUser.uid);
      setEditableProfile(refreshedProfile); 
       if (refreshedProfile) {
          reset({ 
            paymentMethods: refreshedProfile.paymentMethods || { cash: true, click: false, clickCode: '' }, 
            secondaryPhone: refreshedProfile.secondaryPhone || '',
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

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setAuthStatus(false);
      toast({ title: "تم تسجيل الخروج بنجاح." });
      router.push('/auth/signin');
    } catch (error) {
      console.error("Sign Out Error:", error);
      toast({ title: "خطأ أثناء تسجيل الخروج", variant: "destructive" });
    }
  };
  
  if (isLoadingProfile) {
     return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  // Use a default/mock profile to prevent crashes when userProfile is null
  const displayProfile = editableProfile || {
    fullName: 'اسم السائق',
    email: 'email@example.com',
    rating: 0,
    tripsCount: 0,
    phone: '0790000000',
    idPhotoUrl: null,
    paymentMethods: { cash: true, click: false, clickCode: '' },
    secondaryPhone: '',
  };


  let avatarSrc = "https://placehold.co/100x100.png?text=S"; 
  if (newPhotoFile) {
    avatarSrc = URL.createObjectURL(newPhotoFile); 
  } else if (displayProfile && displayProfile.idPhotoUrl) { 
    avatarSrc = displayProfile.idPhotoUrl; 
  }


  return (
    <div className="space-y-6">
      <ChangePasswordDialog isOpen={isChangePasswordOpen} onOpenChange={setIsChangePasswordOpen} />
      
      <Card>
        <CardHeader className="flex flex-col items-center text-center">
          <div className="relative">
            <Avatar className="w-24 h-24 mb-4 border-2 border-primary">
              <AvatarImage 
                key={avatarSrc} 
                src={avatarSrc} 
                alt={displayProfile.fullName || 'Driver'}
                data-ai-hint="driver portrait" />
              <AvatarFallback>{displayProfile.fullName?.charAt(0) || 'S'}</AvatarFallback>
            </Avatar>
            {isEditing && (
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-full flex justify-center">
                  <Label htmlFor="newIdPhoto" className="bg-background p-1 rounded-full border cursor-pointer hover:bg-accent">
                    <Edit3 className="h-5 w-5 text-primary" />
                    <Input id="newIdPhoto" type="file" accept="image/*" onChange={handlePhotoChange} className="hidden"/>
                  </Label>
              </div>
            )}
          </div>
          
          <CardTitle className="text-2xl mt-2">{displayProfile.fullName}</CardTitle>
          <div className="text-muted-foreground flex items-center">
            <Star className="w-4 h-4 ms-1 text-yellow-400 fill-yellow-400" /> {displayProfile.rating || 'N/A'}
            <span className="mx-2">|</span>
            <Briefcase className="w-4 h-4 ms-1" /> {displayProfile.tripsCount || 0} رحلة
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2 mb-3">المعلومات الشخصية</h3>
            <div className="space-y-4">
              <div>
                <Label>الاسم الكامل</Label>
                <div className="flex items-center gap-2 mt-1 p-2 rounded-md bg-muted/50">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <p className="text-foreground">{displayProfile.fullName}</p>
                </div>
              </div>
               <div>
                <Label>رقم الهاتف</Label>
                <div className="flex items-center gap-2 mt-1 p-2 rounded-md bg-muted/50">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <p className="text-foreground">{displayProfile.phone}</p>
                </div>
              </div>
              <div>
                <Label htmlFor="secondaryPhone">رقم هاتف إضافي (اختياري)</Label>
                <IconInput 
                    icon={Phone} 
                    id="secondaryPhone" 
                    type="tel"
                    {...register('secondaryPhone')}
                    disabled={!isEditing}
                    placeholder="أدخل رقم الهاتف الإضافي"
                    className="mt-1"
                />
                {errors.secondaryPhone && <p className="mt-1 text-sm text-destructive">{errors.secondaryPhone.message}</p>}
              </div>
            </div>
            
            <h3 className="text-lg font-semibold border-b pb-2 mt-6 mb-3">طرق الدفع المقبولة</h3>
            <div className="grid grid-cols-2 gap-3">
              <Controller
                name="paymentMethods.cash"
                control={control}
                render={({ field }) => (
                  <Label htmlFor="paymentCash"
                    className={cn(
                      "flex flex-col items-center justify-center gap-2 rounded-lg border-2 p-4 transition-colors hover:bg-accent/10",
                      field.value ? "border-primary bg-primary/5" : "border-muted",
                      isEditing ? "cursor-pointer" : "cursor-not-allowed opacity-70"
                    )}
                  >
                    <Checkbox
                      id="paymentCash"
                      checked={field.value || false}
                      onCheckedChange={field.onChange}
                      disabled={!isEditing}
                      className="hidden"
                    />
                    <Banknote className={cn("h-8 w-8", field.value ? "text-primary" : "text-muted-foreground")} />
                    <span className="font-semibold">الدفع النقدي (كاش)</span>
                  </Label>
                )}
              />
              <Controller
                name="paymentMethods.click"
                control={control}
                render={({ field }) => (
                  <Label htmlFor="paymentClick"
                    className={cn(
                      "flex flex-col items-center justify-center gap-2 rounded-lg border-2 p-4 transition-colors hover:bg-accent/10",
                      field.value ? "border-primary bg-primary/5" : "border-muted",
                      isEditing ? "cursor-pointer" : "cursor-not-allowed opacity-70"
                    )}
                  >
                     <Checkbox
                      id="paymentClick"
                      checked={field.value || false}
                      onCheckedChange={field.onChange}
                      disabled={!isEditing}
                      className="hidden"
                    />
                    <Smartphone className={cn("h-8 w-8", field.value ? "text-primary" : "text-muted-foreground")} />
                    <span className="font-semibold">CliQ (كليك)</span>
                  </Label>
                )}
              />
            </div>

            {paymentMethodsWatched?.click && (
              <div className="pt-2">
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
            
            {isEditing && (
              <Button type="submit" className="w-full mt-6" disabled={isLoading}>
                {isLoading ? <Loader2 className="animate-spin" /> : <><Save className="ms-2 h-4 w-4" /> حفظ التغييرات</>}
              </Button>
            )}
          </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          {!isEditing ? (
            <Button onClick={() => { setIsEditing(true); }} className="w-full">
              <Edit3 className="ms-2 h-4 w-4" /> تعديل الملف الشخصي
            </Button>
          ) : (
             <Button onClick={() => { 
                setIsEditing(false); 
                setNewPhotoFile(null); 
                if(userProfile) { 
                    reset({ 
                        paymentMethods: userProfile.paymentMethods || { cash: true, click: false, clickCode: '' }, 
                        secondaryPhone: userProfile.secondaryPhone || '',
                    });
                }
             }} variant="outline" className="w-full">
               إلغاء
            </Button>
          )}
          <Button onClick={() => setIsChangePasswordOpen(true)} variant="secondary" className="w-full">
              <KeyRound className="ms-2 h-4 w-4" /> تغيير كلمة المرور
          </Button>
           <Button onClick={handleSignOut} variant="destructive" className="w-full mt-2">
            <LogOut className="ms-2 h-4 w-4" /> تسجيل الخروج
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

    