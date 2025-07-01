
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
import { UserPlus, ArrowLeft, User, Phone, Lock, CreditCard, Car, ImageIcon, CalendarDays, Palette, Hash, Loader2 } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { IconInput as OriginalIconInputComponent } from '@/components/shared/icon-input';
import { VEHICLE_TYPES } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { addDriverToWaitingList } from '@/lib/firebaseService';

const signUpSchema = z.object({
  fullName: z.string().min(3, { message: "الاسم الكامل مطلوب." }),
  phone: z.string().regex(/^07[789]\d{7}$/, { message: "رقم هاتف أردني غير صالح (مثال: 0791234567)." }),
  password: z.string().min(6, { message: "كلمة المرور يجب أن تكون 6 أحرف على الأقل." }),
  idNumber: z.string().regex(/^[A-Z0-9]{8}$/, { message: "رقم الهوية يجب أن يتكون من 8 أحرف إنجليزية كبيرة وأرقام." }),
  idPhoto: z.any().refine(files => files?.length > 0, { message: "صورة الهوية مطلوبة." }),
  licenseNumber: z.string().regex(/^[0-9]{8}$/, { message: "رقم الرخصة يجب أن يتكون من 8 أرقام." }),
  licenseExpiry: z.string().min(1, { message: "تاريخ انتهاء الرخصة مطلوب." }),
  licensePhoto: z.any().refine(files => files?.length > 0, { message: "صورة الرخصة مطلوبة." }),
  vehicleType: z.string().min(1, { message: "نوع المركبة مطلوب." }),
  year: z.string().min(4, { message: "سنة الصنع مطلوبة (مثال: 2020)." }).max(4),
  color: z.string().min(1, { message: "لون المركبة مطلوب." }),
  plateNumber: z.string().min(1, { message: "رقم اللوحة مطلوب." }),
  vehiclePhoto: z.any().refine(files => files?.length > 0, { message: "صورة المركبة مطلوبة." }),
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
  label, id, error, register, fieldName, isRequired = false
}: {
  label: string, id: string, error?: string,
  register: any,
  fieldName: keyof SignUpFormValues,
  isRequired?: boolean
}) => (
  <div>
    <Label htmlFor={id}>{label} {isRequired && <span className="text-destructive">*</span>}</Label>
    <Input id={id} type="file" accept="image/*" className={error ? 'border-destructive' : ''} {...register(fieldName)} />
    {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
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

  const { register, handleSubmit, control, formState: { errors } } = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpSchema),
  });

  const onSubmit: SubmitHandler<SignUpFormValues> = async (data) => {
    setIsLoading(true);

    try {
      // 1. Upload images to ImageKit and get URLs
      const idPhotoUrl = data.idPhoto?.[0] ? await uploadFileToImageKitHelper(data.idPhoto[0]) : null;
      const licensePhotoUrl = data.licensePhoto?.[0] ? await uploadFileToImageKitHelper(data.licensePhoto[0]) : null;
      const vehiclePhotoUrl = data.vehiclePhoto?.[0] ? await uploadFileToImageKitHelper(data.vehiclePhoto[0]) : null;

      // 2. Prepare profile data for the waiting list
      const waitingListData = {
        fullName: data.fullName,
        phone: data.phone,
        password: data.password, // This will be used by admin to create the account
        email: `t${data.phone}@tawsellah.com`,
        idNumber: data.idNumber,
        idPhotoUrl,
        licenseNumber: data.licenseNumber,
        licenseExpiry: data.licenseExpiry,
        licensePhotoUrl,
        vehicleType: data.vehicleType,
        vehicleYear: data.year,
        vehicleColor: data.color,
        vehiclePlateNumber: data.plateNumber,
        vehiclePhotosUrl: vehiclePhotoUrl,
      };

      // 3. Save data to the waiting list in Firebase RTDB
      await addDriverToWaitingList(waitingListData);

      toast({
        title: "تم استلام طلب التسجيل",
        description: "سيتم التواصل معك بأقرب وقت ممكن.",
        duration: 8000,
      });
      router.push('/auth/signin');
      
    } catch (error: any) {
      console.error("Signup Submission Error:", error);
      toast({
        title: "خطأ في إرسال الطلب",
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
                  <IconInput icon={CreditCard} id="idNumber" {...register('idNumber')} error={errors.idNumber?.message} maxLength={8} />
                  {errors.idNumber && <p className="mt-1 text-sm text-destructive">{errors.idNumber.message}</p>}
                </div>
                <FileInput label="صورة الهوية" id="idPhoto" error={errors.idPhoto?.message as string} register={register} fieldName="idPhoto" isRequired={true} />
                <div>
                  <Label htmlFor="licenseNumber">رقم الرخصة <span className="text-destructive">*</span></Label>
                  <IconInput icon={CreditCard} id="licenseNumber" {...register('licenseNumber')} error={errors.licenseNumber?.message} maxLength={8} />
                  {errors.licenseNumber && <p className="mt-1 text-sm text-destructive">{errors.licenseNumber.message}</p>}
                </div>
                <div>
                  <Label htmlFor="licenseExpiry">تاريخ انتهاء الرخصة <span className="text-destructive">*</span></Label>
                  <IconInput icon={CalendarDays} id="licenseExpiry" type="date" {...register('licenseExpiry')} error={errors.licenseExpiry?.message} />
                  {errors.licenseExpiry && <p className="mt-1 text-sm text-destructive">{errors.licenseExpiry.message}</p>}
                </div>
                <FileInput label="صورة الرخصة" id="licensePhoto" error={errors.licensePhoto?.message as string} register={register} fieldName="licensePhoto" isRequired={true}/>
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
                <FileInput label="صورة المركبة" id="vehiclePhoto" error={errors.vehiclePhoto?.message as string} register={register} fieldName="vehiclePhoto" isRequired={true} />
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
              إرسال طلب التسجيل
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
    

    
