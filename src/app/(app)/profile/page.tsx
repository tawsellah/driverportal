
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
import { User, Phone, Star, Briefcase, Edit3, Save, Loader2, LogOut, KeyRound } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { 
    getUserProfile, 
    updateUserProfile, 
    type UserProfile,
    getSupportContactNumberFromDb
} from '@/lib/firebaseService'; 
import { setAuthStatus } from '@/lib/storage';
import { Checkbox } from "@/components/ui/checkbox";
import { ChangePasswordDialog } from '@/components/profile/change-password-dialog';

const profileSchema = z.object({
  paymentMethods: z.object({
    cash: z.boolean().optional().default(true),
    click: z.boolean().optional().default(false),
    clickCode: z.string().optional().nullable(),
  }).optional(),
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

const WhatsAppIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm0 18.09c-1.5 0-2.96-.36-4.24-1.05L6.36 19.6l-1.02.27.27-1.02 1.44-1.44a8.08 8.08 0 0 1-1.16-4.49c0-4.53 3.69-8.21 8.21-8.21s8.21 3.69 8.21 8.21-3.69 8.21-8.21 8.21zm4.49-5.83c-.28-.14-1.64-.81-1.9-.9s-.45-.14-.64.14-.72.9-.88 1.08-.32.18-.59.06c-.28-.12-1.17-.43-2.23-1.38-.83-.73-1.38-1.63-1.54-1.9s-.17-.28-.07-.36c.08-.1.22-.22.3-.3.09-.09.12-.14.18-.24.06-.1.03-.18-.01-.32s-.64-1.54-.88-2.1c-.24-.58-.48-.48-.64-.48h-.4c-.14 0-.38.06-.59.32s-.81.78-.81 1.9c0 1.12.83 2.2 1.02 2.4s1.64 2.51 3.98 3.53c.55.24.93.38 1.25.48.52.16.99.14 1.37.08.42-.06 1.25-.51 1.42-.99.18-.49.18-.9.12-.99s-.22-.14-.49-.28z"/>
  </svg>
);


export default function ProfilePage() {
  const { toast } = useToast();
  const router = useRouter();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingProfile, setIsFetchingProfile] = useState(true);
  const [newPhotoFile, setNewPhotoFile] = useState<File | null>(null);
  const [supportPhoneNumber, setSupportPhoneNumber] = useState<string | null>(null);
  const [isLoadingSupportNumber, setIsLoadingSupportNumber] = useState(true);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  const { control, handleSubmit, register, reset, watch, formState: { errors } } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
        paymentMethods: {
            cash: true,
            click: false,
            clickCode: '',
        },
    }
  });

  useEffect(() => {
    const fetchProfileAndSupportNumber = async () => {
      setIsFetchingProfile(true);
      setIsLoadingSupportNumber(true);
      const currentUser = auth.currentUser;
      if (currentUser) {
        try {
            const profile = await getUserProfile(currentUser.uid);
            setUserProfile(profile);
            if (profile) {
              reset({
                paymentMethods: profile.paymentMethods || { cash: true, click: false, clickCode: '' },
              });
            }
        } catch (error) {
            console.error("Error fetching user profile:", error);
            toast({ title: "خطأ في تحميل الملف الشخصي", variant: "destructive" });
        }
      } else {
        toast({ title: "لم يتم العثور على الملف الشخصي أو المستخدم غير مسجل", variant: "destructive" });
        router.push('/auth/signin');
      }
      setIsFetchingProfile(false);

      try {
        const number = await getSupportContactNumberFromDb();
        setSupportPhoneNumber(number);
      } catch (error) {
        console.error("Error fetching support phone number:", error);
        setSupportPhoneNumber(null);
      } finally {
        setIsLoadingSupportNumber(false);
      }
    };
    fetchProfileAndSupportNumber();
  }, [reset, toast, router]);

  const paymentMethodsWatched = watch("paymentMethods");

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setNewPhotoFile(event.target.files[0]);
    }
  };

  const onSubmit = async (data: ProfileFormValues) => {
    if (!userProfile || !auth.currentUser) return;
    setIsLoading(true);
    
    let actualUploadedPhotoUrl: string | null = userProfile.idPhotoUrl || null;
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
      idPhotoUrl: actualUploadedPhotoUrl,
    };

    try {
      await updateUserProfile(auth.currentUser.uid, updates);
      const refreshedProfile = await getUserProfile(auth.currentUser.uid);
      setUserProfile(refreshedProfile); 
       if (refreshedProfile) {
          reset({ 
            paymentMethods: refreshedProfile.paymentMethods || { cash: true, click: false, clickCode: '' },
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
      const currentUser = auth.currentUser;
      if (currentUser) {
        // Clear the session token on sign out
        await updateUserProfile(currentUser.uid, { sessionToken: null });
      }
      await signOut(auth);
      setAuthStatus(false);
      localStorage.removeItem('sessionToken'); // Also clear from local storage
      toast({ title: "تم تسجيل الخروج بنجاح." });
      router.push('/auth/signin');
    } catch (error) {
      console.error("Sign Out Error:", error);
      toast({ title: "خطأ أثناء تسجيل الخروج", variant: "destructive" });
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
  
  let avatarSrc = "https://placehold.co/100x100.png?text=S"; 
  if (newPhotoFile) {
    avatarSrc = URL.createObjectURL(newPhotoFile); 
  } else if (userProfile && userProfile.idPhotoUrl) { 
    avatarSrc = userProfile.idPhotoUrl; 
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
                alt={userProfile.fullName || 'Driver'}
                data-ai-hint="driver portrait" />
              <AvatarFallback>{userProfile.fullName?.charAt(0) || 'S'}</AvatarFallback>
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
          
          <CardTitle className="text-2xl mt-2">{userProfile.fullName}</CardTitle>
          <div className="text-muted-foreground flex items-center">
            <Star className="w-4 h-4 ms-1 text-yellow-400 fill-yellow-400" /> {userProfile.rating || 'N/A'}
            <span className="mx-2">|</span>
            <Briefcase className="w-4 h-4 ms-1" /> {userProfile.tripsCount || 0} رحلة
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
                    <p className="text-foreground">{userProfile.fullName}</p>
                </div>
              </div>
               <div>
                <Label>رقم الهاتف</Label>
                <div className="flex items-center gap-2 mt-1 p-2 rounded-md bg-muted/50">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <p className="text-foreground">{userProfile.phone}</p>
                </div>
              </div>
            </div>
            
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
          {!isEditing ? (
            <Button onClick={() => { setIsEditing(true); }} className="w-full">
              <Edit3 className="ms-2 h-4 w-4" /> تعديل طرق الدفع والصورة
            </Button>
          ) : (
             <Button onClick={() => { 
                setIsEditing(false); 
                setNewPhotoFile(null); 
                if(userProfile) { 
                    reset({ 
                        paymentMethods: userProfile.paymentMethods || { cash: true, click: false, clickCode: '' }, 
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
          <Button
            asChild
            className="w-full mt-2 bg-green-500 hover:bg-green-600 text-white"
            disabled={isLoadingSupportNumber || !supportPhoneNumber}
            onClick={() => {
              if (!supportPhoneNumber && !isLoadingSupportNumber) {
                toast({ title: "رقم الدعم غير متوفر حالياً", variant: "destructive" });
              }
            }}
          >
            <a
              href={supportPhoneNumber ? `https://wa.me/${String(supportPhoneNumber).replace(/^\+/, '')}` : '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2"
            >
              {isLoadingSupportNumber ? (
                <Loader2 className="animate-spin h-5 w-5" />
              ) : (
                <>
                  <WhatsAppIcon className="h-5 w-5" />
                  <span>تواصل مع الدعم</span>
                </>
              )}
            </a>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
    
