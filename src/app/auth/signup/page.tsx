
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
import { UserPlus, ArrowLeft, User, Mail, Phone, Lock, CreditCard, Car, Image as ImageIcon, CalendarDays, Palette, Hash, Loader2 } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { IconInput as OriginalIconInputComponent } from '@/components/shared/icon-input';
import { VEHICLE_TYPES } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { auth } from '@/lib/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { saveUserProfile, simulateCloudinaryUpload, type UserProfile } from '@/lib/firebaseService';
import { setAuthStatus } from '@/lib/storage';


const signUpSchema = z.object({
  // Basic Info
  fullName: z.string().min(3, { message: "الاسم الكامل مطلوب." }),
  // email: z.string().email({ message: "بريد إلكتروني غير صالح." }), // Email will be constructed
  phone: z.string().regex(/^07[789]\d{7}$/, { message: "رقم هاتف أردني غير صالح (مثال: 0791234567)." }),
  password: z.string().min(6, { message: "كلمة المرور يجب أن تكون 6 أحرف على الأقل." }),
  // Driver Info
  idNumber: z.string().min(10, { message: "رقم الهوية مطلوب." }).max(10, { message: "رقم الهوية يجب أن يكون 10 أرقام." }),
  idPhoto: z.any().optional(), // File handling is mocked
  licenseNumber: z.string().min(1, { message: "رقم الرخصة مطلوب." }),
  licenseExpiry: z.string().min(1, { message: "تاريخ انتهاء الرخصة مطلوب." }),
  licensePhoto: z.any().optional(), // File handling is mocked
  // Vehicle Info
  vehicleType: z.string().min(1, { message: "نوع المركبة مطلوب." }),
  makeModel: z.string().min(1, { message: "الصنع والموديل مطلوب." }),
  year: z.string().min(4, { message: "سنة الصنع مطلوبة (مثال: 2020)." }).max(4),
  color: z.string().min(1, { message: "لون المركبة مطلوب." }),
  plateNumber: z.string().min(1, { message: "رقم اللوحة مطلوب." }),
  vehiclePhoto: z.any().optional(), // File handling is mocked
});

type SignUpFormValues = z.infer<typeof signUpSchema>;

// Mock file input that updates a hidden URL field or state
const FileInput = ({ 
  label, id, error, setValue, fieldName 
}: { 
  label: string, id: string, error?: string, 
  setValue: (name: keyof SignUpFormValues, value: any) => void,
  fieldName: keyof SignUpFormValues // To know which URL to update
}) => {
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // In a real app, upload to Cloudinary here and get URL
      // For mock, simulate and set a placeholder URL
      const mockUrl = simulateCloudinaryUpload(file.name);
      // This assumes fieldName corresponds to a URL field in the form schema or profile.
      // We are not directly storing the file object in form state for Firebase.
      // Instead, we'd store the URL. For this mock, we'll just log it.
      console.log(`Simulated upload for ${fieldName}: ${mockUrl}`);
      // To actually use this, you'd need hidden fields for URLs or manage URLs in a different state
      // For now, the schema expects 'any' for photo fields, but Firebase will store URLs.
    }
  };
  return (
    <div>
      <Label htmlFor={id}>{label} <span className="text-destructive">*</span></Label>
      <Input id={id} type="file" accept="image/*" onChange={handleFileChange} className={error ? 'border-destructive' : ''} />
      {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
      <p className="mt-1 text-xs text-muted-foreground">ملاحظة: تحميل الملفات هو للعرض والمحاكاة فقط.</p>
    </div>
  );
};


// Modify IconInput to accept error prop for border styling
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
      const userCredential = await createUserWithEmailAndPassword(auth, constructedEmail, data.password);
      const user = userCredential.user;

      if (user) {
        const profileData: Omit<UserProfile, 'id' | 'createdAt'> = {
          fullName: data.fullName,
          email: constructedEmail,
          phone: data.phone,
          idNumber: data.idNumber,
          idPhotoUrl: data.idPhoto ? simulateCloudinaryUpload(`${user.uid}_idPhoto.jpg`) : undefined,
          licenseNumber: data.licenseNumber,
          licenseExpiry: data.licenseExpiry,
          licensePhotoUrl: data.licensePhoto ? simulateCloudinaryUpload(`${user.uid}_licensePhoto.jpg`) : undefined,
          vehicleType: data.vehicleType,
          vehicleMakeModel: data.makeModel,
          vehicleYear: data.year,
          vehicleColor: data.color,
          vehiclePlateNumber: data.plateNumber,
          vehiclePhotosUrl: data.vehiclePhoto ? simulateCloudinaryUpload(`${user.uid}_vehiclePhoto.jpg`) : undefined,
          rating: 0, // Default
          tripsCount: 0, // Default
          paymentMethods: { cash: true, click: false }, // Default
        };

        await saveUserProfile(user.uid, profileData);
        setAuthStatus(true); // For client-side navigation

        toast({
          title: "تم إنشاء الحساب بنجاح!",
          description: "سيتم توجيهك إلى لوحة التحكم.",
        });
        router.push('/trips');
      }
    } catch (error: any) {
      console.error("Firebase Signup Error:", error);
      toast({
        title: "خطأ في إنشاء الحساب",
        description: error.message || "يرجى المحاولة مرة أخرى.",
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
            {/* Basic Information */}
            <AccordionItem value="basic-info">
              <AccordionTrigger>
                <h3 className="text-lg font-semibold">البيانات الأساسية</h3>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-4">
                <div>
                  <Label htmlFor="fullName">الاسم الكامل</Label>
                  <IconInput icon={User} id="fullName" {...register('fullName')} error={errors.fullName?.message} />
                  {errors.fullName && <p className="mt-1 text-sm text-destructive">{errors.fullName.message}</p>}
                </div>
                <div>
                  <Label htmlFor="phone">رقم الهاتف (سيستخدم للدخول مع t في البداية)</Label>
                  <IconInput icon={Phone} id="phone" type="tel" {...register('phone')} error={errors.phone?.message} />
                  {errors.phone && <p className="mt-1 text-sm text-destructive">{errors.phone.message}</p>}
                </div>
                <div>
                  <Label htmlFor="password">كلمة المرور</Label>
                  <IconInput icon={Lock} id="password" type="password" {...register('password')} error={errors.password?.message} />
                  {errors.password && <p className="mt-1 text-sm text-destructive">{errors.password.message}</p>}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Driver Information */}
            <AccordionItem value="driver-info">
              <AccordionTrigger>
                <h3 className="text-lg font-semibold">معلومات السائق</h3>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-4">
                <div>
                  <Label htmlFor="idNumber">رقم الهوية</Label>
                  <IconInput icon={CreditCard} id="idNumber" {...register('idNumber')} error={errors.idNumber?.message} />
                  {errors.idNumber && <p className="mt-1 text-sm text-destructive">{errors.idNumber.message}</p>}
                </div>
                <FileInput label="صورة الهوية" id="idPhoto" error={errors.idPhoto?.message as string} setValue={setValue} fieldName="idPhoto" />
                <div>
                  <Label htmlFor="licenseNumber">رقم الرخصة</Label>
                  <IconInput icon={CreditCard} id="licenseNumber" {...register('licenseNumber')} error={errors.licenseNumber?.message} />
                  {errors.licenseNumber && <p className="mt-1 text-sm text-destructive">{errors.licenseNumber.message}</p>}
                </div>
                <div>
                  <Label htmlFor="licenseExpiry">تاريخ انتهاء الرخصة</Label>
                  <IconInput icon={CalendarDays} id="licenseExpiry" type="date" {...register('licenseExpiry')} error={errors.licenseExpiry?.message} />
                  {errors.licenseExpiry && <p className="mt-1 text-sm text-destructive">{errors.licenseExpiry.message}</p>}
                </div>
                <FileInput label="صورة الرخصة" id="licensePhoto" error={errors.licensePhoto?.message as string} setValue={setValue} fieldName="licensePhoto"/>
              </AccordionContent>
            </AccordionItem>

            {/* Vehicle Information */}
            <AccordionItem value="vehicle-info">
              <AccordionTrigger>
                <h3 className="text-lg font-semibold">بيانات المركبة</h3>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-4">
                 <div>
                  <Label htmlFor="vehicleType">نوع المركبة</Label>
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
                  <Label htmlFor="makeModel">الصنع والموديل</Label>
                  <IconInput icon={Car} id="makeModel" {...register('makeModel')} error={errors.makeModel?.message} />
                  {errors.makeModel && <p className="mt-1 text-sm text-destructive">{errors.makeModel.message}</p>}
                </div>
                <div>
                  <Label htmlFor="year">سنة الصنع</Label>
                  <IconInput icon={CalendarDays} id="year" type="number" placeholder="YYYY" {...register('year')} error={errors.year?.message} />
                  {errors.year && <p className="mt-1 text-sm text-destructive">{errors.year.message}</p>}
                </div>
                <div>
                  <Label htmlFor="color">اللون</Label>
                  <IconInput icon={Palette} id="color" {...register('color')} error={errors.color?.message} />
                  {errors.color && <p className="mt-1 text-sm text-destructive">{errors.color.message}</p>}
                </div>
                <div>
                  <Label htmlFor="plateNumber">رقم اللوحة</Label>
                  <IconInput icon={Hash} id="plateNumber" {...register('plateNumber')} error={errors.plateNumber?.message} />
                  {errors.plateNumber && <p className="mt-1 text-sm text-destructive">{errors.plateNumber.message}</p>}
                </div>
                <FileInput label="صورة المركبة" id="vehiclePhoto" error={errors.vehiclePhoto?.message as string} setValue={setValue} fieldName="vehiclePhoto" />
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
