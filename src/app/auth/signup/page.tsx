
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm, type SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, ArrowLeft, User, Phone, Lock, CreditCard, Car, Image as ImageIcon, CalendarDays, Palette, Hash, Loader2 } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { IconInput as OriginalIconInputComponent } from '@/components/shared/icon-input';
import { VEHICLE_TYPES } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { auth } from '@/lib/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { saveUserProfile, type UserProfile } from '@/lib/firebaseService'; 
import { setAuthStatus } from '@/lib/storage';

const signUpSchema = z.object({
  fullName: z.string().min(3, { message: "الاسم الكامل مطلوب." }),
  phone: z.string().regex(/^07[789]\d{7}$/, { message: "رقم هاتف أردني غير صالح (مثال: 0791234567)." }),
  password: z.string().min(6, { message: "كلمة المرور يجب أن تكون 6 أحرف على الأقل." }),
  idNumber: z.string().min(10, { message: "رقم الهوية مطلوب." }).max(10, { message: "رقم الهوية يجب أن يكون 10 أرقام." }),
  idPhoto: z.instanceof(FileList).optional().nullable(), 
  licenseNumber: z.string().min(1, { message: "رقم الرخصة مطلوب." }),
  licenseExpiry: z.string().min(1, { message: "تاريخ انتهاء الرخصة مطلوب." }),
  licensePhoto: z.instanceof(FileList).optional().nullable(), 
  vehicleType: z.string().min(1, { message: "نوع المركبة مطلوب." }),
  makeModel: z.string().min(1, { message: "الصنع والموديل مطلوب." }),
  year: z.string().min(4, { message: "سنة الصنع مطلوبة (مثال: 2020)." }).max(4),
  color: z.string().min(1, { message: "لون المركبة مطلوب." }),
  plateNumber: z.string().min(1, { message: "رقم اللوحة مطلوب." }),
  vehiclePhoto: z.instanceof(FileList).optional().nullable(), 
});

type SignUpFormValues = z.infer<typeof signUpSchema>;

// Helper function to upload a single file to ImageKit
async function uploadFileToImageKitHelper(file: File | undefined | null): Promise<string | null> {
  if (!file) return null;
  try {
    const authResponse = await fetch('/api/imagekit-auth');
    if (!authResponse.ok) throw new Error('Failed to get ImageKit auth params');
    const authParams = await authResponse.json();

    const formData = new FormData();
    formData.append('file', file);
    formData.append('fileName', file.name);
    formData.append('publicKey', process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY || "public_IfRvA+ieL0CZzBuuO9i9cFceLn8=");
    formData.append('signature', authParams.signature);
    formData.append('expire', authParams.expire);
    formData.append('token', authParams.token);
    // formData.append('folder', '/user_uploads/'); // Optional

    const uploadResponse = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
      method: 'POST',
      body: formData,
    });

    if (!uploadResponse.ok) {
      const errorData = await uploadResponse.json();
      console.error('ImageKit Upload Error:', errorData);
      throw new Error(errorData.message || 'ImageKit upload failed for a file');
    }
    const uploadResult = await uploadResponse.json();
    return uploadResult.url;
  } catch (error) {
    console.error('Error uploading a file to ImageKit:', error);
    return null;
  }
}

const FileInput = ({ 
  label, id, error, register, fieldName 
}: { 
  label: string, id: string, error?: string, 
  register: any, // Use "any" for register type in this context
  fieldName: keyof SignUpFormValues 
}) => (
  <div>
    <Label htmlFor={id}>{label} <span className="text-muted-foreground">(اختياري)</span></Label>
    <Input id={id} type="file" accept="image/*" className={error ? 'border-destructive' : ''} {...register(fieldName)} />
    {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
    <p className="mt-1 text-xs text-muted-foreground">سيتم رفع الصورة إلى ImageKit عند إنشاء الحساب.</p>
  </div>
);

const PatchedIconInput = ({ error, className, ...props }: React.ComponentProps<typeof OriginalIconInputComponent> & { error?: string }) => (
  <OriginalIconInputComponent className={cn(className, error ? 'border-destructive focus:border-destructive focus-visible:ring-destructive' : '')} {...props} />
);
const IconInput = PatchedIconInput;


export default function SignUpPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const { register, handleSubmit, control, setValue, formState: { errors } } = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpSchema),
  });

  const onSubmit: SubmitHandler<SignUpFormValues> = async (data) => {
    setIsLoading(true);
    const constructedEmail = `t${data.phone}@tawsellah.com`;

    try {
      // 1. Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, constructedEmail, data.password);
      const user = userCredential.user;

      if (user) {
        // 2. Upload images to ImageKit and get URLs
        const idPhotoUrl = data.idPhoto && data.idPhoto.length > 0 ? await uploadFileToImageKitHelper(data.idPhoto[0]) : null;
        const licensePhotoUrl = data.licensePhoto && data.licensePhoto.length > 0 ? await uploadFileToImageKitHelper(data.licensePhoto[0]) : null;
        const vehiclePhotoUrl = data.vehiclePhoto && data.vehiclePhoto.length > 0 ? await uploadFileToImageKitHelper(data.vehiclePhoto[0]) : null;
        
        // 3. Prepare profile data for Firebase RTDB
        const profileData: Omit<UserProfile, 'id' | 'createdAt'> = {
          fullName: data.fullName,
          email: constructedEmail,
          phone: data.phone,
          idNumber: data.idNumber,
          idPhotoUrl: idPhotoUrl,
          licenseNumber: data.licenseNumber,
          licenseExpiry: data.licenseExpiry,
          licensePhotoUrl: licensePhotoUrl,
          vehicleType: data.vehicleType,
          vehicleMakeModel: data.makeModel,
          vehicleYear: data.year,
          vehicleColor: data.color,
          vehiclePlateNumber: data.plateNumber,
          vehiclePhotosUrl: vehiclePhotoUrl, // Assuming vehiclePhotosUrl maps to vehiclePhoto for now
          rating: 0, 
          tripsCount: 0, 
          paymentMethods: { cash: true, click: false }, 
        };

        // 4. Save profile to Firebase RTDB
        await saveUserProfile(user.uid, profileData);
        setAuthStatus(true); 

        toast({
          title: "تم إنشاء الحساب بنجاح!",
          description: "سيتم توجيهك إلى لوحة التحكم.",
        });
        router.push('/trips');
      }
    } catch (error: any) {
      console.error("Firebase Signup Error or ImageKit Upload Error:", error);
      toast({
        title: "خطأ في إنشاء الحساب",
        description: error.message || "يرجى المحاولة مرة أخرى أو التأكد من رفع الصور بشكل صحيح.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="form-card mb-10">
      <h2 className="mb-6 text-center text-2xl font-bold">إنشاء حساب جديد</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {!isMounted && (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i}>
                <Skeleton className="h-8 w-1/3 mb-2" /> 
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
            <Skeleton className="h-12 w-full mt-4" />
          </div>
        )}
        {isMounted && (
          <Accordion type="multiple" defaultValue={['basic-info', 'driver-info', 'vehicle-info']} className="w-full">
            <AccordionItem value="basic-info">
              <AccordionTrigger>
                <h3 className="text-lg font-semibold">البيانات الأساسية</h3>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-4">
                <div>
                  <Label htmlFor="fullName">الاسم الكامل <span className="text-destructive">*</span></Label>
                  <IconInput icon={User} id="fullName" {...register('fullName')} error={errors.fullName?.message} />
                  {errors.fullName && <p className="mt-1 text-sm text-destructive">{errors.fullName.message}</p>}
                </div>
                <div>
                  <Label htmlFor="phone">رقم الهاتف <span className="text-destructive">*</span></Label>
                  <IconInput icon={Phone} id="phone" type="tel" {...register('phone')} error={errors.phone?.message} />
                  {errors.phone && <p className="mt-1 text-sm text-destructive">{errors.phone.message}</p>}
                </div>
                <div>
                  <Label htmlFor="password">كلمة المرور <span className="text-destructive">*</span></Label>
                  <IconInput icon={Lock} id="password" type="password" {...register('password')} error={errors.password?.message} />
                  {errors.password && <p className="mt-1 text-sm text-destructive">{errors.password.message}</p>}
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="driver-info">
              <AccordionTrigger>
                <h3 className="text-lg font-semibold">معلومات السائق</h3>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-4">
                <div>
                  <Label htmlFor="idNumber">رقم الهوية <span className="text-destructive">*</span></Label>
                  <IconInput icon={CreditCard} id="idNumber" {...register('idNumber')} error={errors.idNumber?.message} />
                  {errors.idNumber && <p className="mt-1 text-sm text-destructive">{errors.idNumber.message}</p>}
                </div>
                <FileInput label="صورة الهوية" id="idPhoto" error={errors.idPhoto?.message as string} register={register} fieldName="idPhoto" />
                <div>
                  <Label htmlFor="licenseNumber">رقم الرخصة <span className="text-destructive">*</span></Label>
                  <IconInput icon={CreditCard} id="licenseNumber" {...register('licenseNumber')} error={errors.licenseNumber?.message} />
                  {errors.licenseNumber && <p className="mt-1 text-sm text-destructive">{errors.licenseNumber.message}</p>}
                </div>
                <div>
                  <Label htmlFor="licenseExpiry">تاريخ انتهاء الرخصة <span className="text-destructive">*</span></Label>
                  <IconInput icon={CalendarDays} id="licenseExpiry" type="date" {...register('licenseExpiry')} error={errors.licenseExpiry?.message} />
                  {errors.licenseExpiry && <p className="mt-1 text-sm text-destructive">{errors.licenseExpiry.message}</p>}
                </div>
                <FileInput label="صورة الرخصة" id="licensePhoto" error={errors.licensePhoto?.message as string} register={register} fieldName="licensePhoto"/>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="vehicle-info">
              <AccordionTrigger>
                <h3 className="text-lg font-semibold">بيانات المركبة</h3>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-4">
                 <div>
                  <Label htmlFor="vehicleType">نوع المركبة <span className="text-destructive">*</span></Label>
                   <Controller
                      control={control}
                      name="vehicleType"
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <SelectTrigger id="vehicleType" className={errors.vehicleType ? 'border-destructive' : ''}>
                            <Car className="me-2 h-4 w-4 text-muted-foreground inline-block" />
                            <SelectValue placeholder="اختر النوع" />
                          </SelectTrigger>
                          <SelectContent>
                            {VEHICLE_TYPES.map(type => (
                              <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  {errors.vehicleType && <p className="mt-1 text-sm text-destructive">{errors.vehicleType.message}</p>}
                </div>
                <div>
                  <Label htmlFor="makeModel">الصنع والموديل <span className="text-destructive">*</span></Label>
                  <IconInput icon={Car} id="makeModel" {...register('makeModel')} error={errors.makeModel?.message} />
                  {errors.makeModel && <p className="mt-1 text-sm text-destructive">{errors.makeModel.message}</p>}
                </div>
                <div>
                  <Label htmlFor="year">سنة الصنع <span className="text-destructive">*</span></Label>
                  <IconInput icon={CalendarDays} id="year" type="number" placeholder="YYYY" {...register('year')} error={errors.year?.message} />
                  {errors.year && <p className="mt-1 text-sm text-destructive">{errors.year.message}</p>}
                </div>
                <div>
                  <Label htmlFor="color">اللون <span className="text-destructive">*</span></Label>
                  <IconInput icon={Palette} id="color" {...register('color')} error={errors.color?.message} />
                  {errors.color && <p className="mt-1 text-sm text-destructive">{errors.color.message}</p>}
                </div>
                <div>
                  <Label htmlFor="plateNumber">رقم اللوحة <span className="text-destructive">*</span></Label>
                  <IconInput icon={Hash} id="plateNumber" {...register('plateNumber')} error={errors.plateNumber?.message} />
                  {errors.plateNumber && <p className="mt-1 text-sm text-destructive">{errors.plateNumber.message}</p>}
                </div>
                <FileInput label="صورة المركبة" id="vehiclePhoto" error={errors.vehiclePhoto?.message as string} register={register} fieldName="vehiclePhoto" />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}

        <Button type="submit" className="w-full mt-6" disabled={isLoading || !isMounted}>
           {isLoading ? (
            <Loader2 className="animate-spin" />
          ) : (
            <>
              <UserPlus className="ms-2 h-5 w-5" />
              إنشاء الحساب
            </>
           )}
        </Button>
      </form>
      <div className="mt-6 text-center">
        <Link href="/auth/signin" className="text-sm text-primary hover:underline">
          لديك حساب؟ سجل دخول
          <ArrowLeft className="me-1 inline-block h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}


    