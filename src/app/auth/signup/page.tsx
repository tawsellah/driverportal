"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, ArrowLeft, User, Mail, Phone, Lock, CreditCard, Car, Image as ImageIcon, CalendarDays, Palette, Hash, Loader2 } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { IconInput } from '@/components/shared/icon-input';
import { VEHICLE_TYPES } from '@/lib/constants';
import { saveUserProfile, setAuthStatus } from '@/lib/storage';


const signUpSchema = z.object({
  // Basic Info
  fullName: z.string().min(3, { message: "الاسم الكامل مطلوب." }),
  email: z.string().email({ message: "بريد إلكتروني غير صالح." }),
  phone: z.string().regex(/^07[789]\d{7}$/, { message: "رقم هاتف أردني غير صالح (مثال: 0791234567)." }),
  password: z.string().min(6, { message: "كلمة المرور يجب أن تكون 6 أحرف على الأقل." }),
  // Driver Info
  idNumber: z.string().min(10, { message: "رقم الهوية مطلوب." }).max(10, { message: "رقم الهوية يجب أن يكون 10 أرقام." }),
  // idPhoto: z.any().refine(files => files?.length === 1, "صورة الهوية مطلوبة."), // File handling needs server actions or client-side upload logic
  licenseNumber: z.string().min(1, { message: "رقم الرخصة مطلوب." }),
  licenseExpiry: z.string().min(1, { message: "تاريخ انتهاء الرخصة مطلوب." }),
  // licensePhotos: z.any().refine(files => files?.length > 0, "صور الرخصة مطلوبة."),
  // Vehicle Info
  vehicleType: z.string().min(1, { message: "نوع المركبة مطلوب." }),
  makeModel: z.string().min(1, { message: "الصنع والموديل مطلوب." }),
  year: z.string().min(4, { message: "سنة الصنع مطلوبة (مثال: 2020)." }).max(4),
  color: z.string().min(1, { message: "لون المركبة مطلوب." }),
  plateNumber: z.string().min(1, { message: "رقم اللوحة مطلوب." }),
  // vehiclePhotos: z.any().refine(files => files?.length > 0, "صور المركبة مطلوبة."),
});

type SignUpFormValues = z.infer<typeof signUpSchema>;

// Mock file input for now
const FileInput = ({ label, id, multiple, accept, required, error }: { label: string, id: string, multiple?: boolean, accept?: string, required?: boolean, error?: string }) => (
  <div>
    <Label htmlFor={id}>{label} {required && <span className="text-destructive">*</span>}</Label>
    <Input id={id} type="file" multiple={multiple} accept={accept} className={error ? 'border-destructive' : ''} />
    {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
    <p className="mt-1 text-xs text-muted-foreground">ملاحظة: تحميل الملفات هو للعرض فقط في هذا المثال.</p>
  </div>
);


export default function SignUpPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, control, formState: { errors } } = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpSchema),
  });

  const onSubmit: SubmitHandler<SignUpFormValues> = async (data) => {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate API
    
    const newUserProfile = {
      id: Date.now().toString(),
      fullName: data.fullName,
      email: data.email,
      phone: data.phone,
      idNumber: data.idNumber,
      licenseNumber: data.licenseNumber,
      licenseExpiry: data.licenseExpiry,
      vehicleType: data.vehicleType,
      vehicleMakeModel: data.makeModel,
      vehicleYear: data.year,
      vehicleColor: data.color,
      vehiclePlateNumber: data.plateNumber,
      rating: 0,
      tripsCount: 0,
      paymentMethods: { cash: true, click: false }
    };
    saveUserProfile(newUserProfile);
    setAuthStatus(true);

    toast({
      title: "تم إنشاء الحساب بنجاح!",
      description: "يمكنك الآن تسجيل الدخول.",
    });
    router.push('/trips');
    setIsLoading(false);
  };

  return (
    <div className="form-card mb-10">
      <h2 className="mb-6 text-center text-2xl font-bold">إنشاء حساب جديد</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
                <Label htmlFor="email">البريد الإلكتروني</Label>
                <IconInput icon={Mail} id="email" type="email" {...register('email')} error={errors.email?.message} />
                {errors.email && <p className="mt-1 text-sm text-destructive">{errors.email.message}</p>}
              </div>
              <div>
                <Label htmlFor="phone">رقم الهاتف</Label>
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
              <FileInput label="صورة الهوية" id="idPhoto" accept="image/*" required error={errors.idPhoto?.message as string} />
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
              <FileInput label="صور الرخصة" id="licensePhotos" accept="image/*" multiple required error={errors.licensePhotos?.message as string} />
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
              <FileInput label="صور المركبة" id="vehiclePhotos" accept="image/*" multiple required error={errors.vehiclePhotos?.message as string} />
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <Button type="submit" className="w-full mt-6" disabled={isLoading}>
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

// Helper for IconInput error prop
declare module 'react-hook-form' {
  interface FieldError {
    message?: string;
  }
}

// Modify IconInput to accept error prop for border styling
IconInput.defaultProps = {
  error: undefined,
};
const OriginalIconInput = IconInput;
const PatchedIconInput = ({ error, className, ...props }: React.ComponentProps<typeof OriginalIconInput> & { error?: string }) => (
  <OriginalIconInput className={cn(className, error ? 'border-destructive focus:border-destructive focus-visible:ring-destructive' : '')} {...props} />
);
export { PatchedIconInput as IconInput };