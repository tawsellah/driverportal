
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Mail, Lock, LogIn, ArrowLeft, Loader2, Phone } from 'lucide-react';
import { IconInput } from '@/components/shared/icon-input';
import { auth } from '@/lib/firebase';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { setAuthStatus } from '@/lib/storage';
import { getEmailByPhone } from '@/lib/firebaseService';

const signInSchema = z.object({
  phone: z.string().regex(/^07[789]\d{7}$/, { message: "الرجاء إدخال رقم هاتف أردني صالح." }),
  password: z.string().min(6, { message: "كلمة المرور يجب أن تكون 6 أحرف على الأقل." }),
});

type SignInFormValues = z.infer<typeof signInSchema>;

export default function SignInPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const { register, handleSubmit, getValues, formState: { errors } } = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
  });

  const onSubmit: SubmitHandler<SignInFormValues> = async (data) => {
    setIsLoading(true);
    
    try {
      // Step 1: Get email from phone number
      const email = await getEmailByPhone(data.phone);

      if (!email) {
        toast({
          title: "خطأ في تسجيل الدخول",
          description: "رقم الهاتف غير مسجل. يرجى التحقق من الرقم أو إنشاء حساب جديد.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }
      
      // Step 2: Sign in with the retrieved email and password
      await signInWithEmailAndPassword(auth, email, data.password);
      
      // Step 3: Set auth status and redirect. Profile checking is now handled by UserProvider.
      setAuthStatus(true);
      toast({
        title: "تم تسجيل الدخول بنجاح!",
        description: "مرحباً بك مجدداً في توصيلة.",
      });
      router.push('/trips');

    } catch (error: any) {
      console.error("Firebase SignIn Error:", error);
      let errorMessage = "حدث خطأ غير متوقع. الرجاء المحاولة مرة أخرى.";

      switch (error.code) {
        case 'auth/invalid-credential':
        case 'auth/wrong-password':
          errorMessage = "كلمة المرور غير صحيحة. يرجى التحقق مرة أخرى.";
          break;
        case 'auth/user-not-found':
           errorMessage = "رقم الهاتف غير مسجل. يرجى التحقق من الرقم أو إنشاء حساب جديد.";
           break;
        case 'auth/user-disabled':
          errorMessage = "تم تعطيل هذا الحساب. يرجى التواصل مع الدعم.";
          break;
        case 'auth/too-many-requests':
          errorMessage = "تم حظر هذا الجهاز مؤقتًا بسبب كثرة محاولات تسجيل الدخول الفاشلة.";
          break;
        case 'auth/network-request-failed':
            errorMessage = "حدث خطأ في الشبكة. يرجى التحقق من اتصالك بالإنترنت.";
            break;
      }
      
      toast({
        title: "خطأ في تسجيل الدخول",
        description: errorMessage,
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };
  
  const handleForgotPassword = async (e: React.MouseEvent) => {
    e.preventDefault();
    const phone = getValues("phone");

    if (!phone || !z.string().regex(/^07[789]\d{7}$/).safeParse(phone).success) {
        toast({
            title: "رقم الهاتف مطلوب",
            description: "الرجاء إدخال رقم هاتفك المسجل أولاً لإرسال رابط استعادة كلمة المرور.",
            variant: "destructive",
        });
        return;
    }

    setIsLoading(true);
    try {
        const email = await getEmailByPhone(phone);
        if (!email) {
            toast({
                title: "خطأ",
                description: "لم يتم العثور على حساب مرتبط برقم الهاتف هذا.",
                variant: "destructive",
            });
            setIsLoading(false);
            return;
        }

        await sendPasswordResetEmail(auth, email);
        toast({
            title: "تم إرسال رابط استعادة كلمة المرور",
            description: `تم إرسال رابط إلى بريدك الإلكتروني المسجل. يرجى التحقق منه.`,
        });
    } catch(error: any) {
        console.error("Forgot Password Error:", error);
        toast({
            title: "خطأ في إرسال البريد",
            description: "حدث خطأ أثناء محاولة إرسال بريد استعادة كلمة المرور. يرجى المحاولة مرة أخرى.",
            variant: "destructive",
        });
    } finally {
        setIsLoading(false);
    }
  };

  if (!isClient) {
    return (
        <div className="form-card">
             <div className="flex justify-center items-center h-80">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        </div>
    );
  }

  return (
    <div className="form-card">
      <h2 className="mb-6 text-center text-2xl font-bold">تسجيل الدخول</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-4">
          <div>
            <Label htmlFor="phone">رقم الهاتف</Label>
            <IconInput
              id="phone"
              type="tel"
              icon={Phone}
              placeholder="أدخل رقم هاتفك"
              {...register('phone')}
              className={`text-left ${errors.phone ? 'border-destructive' : ''}`}
              dir="ltr"
              aria-invalid={errors.phone ? "true" : "false"}
            />
            {errors.phone && <p className="mt-1 text-sm text-destructive">{errors.phone.message}</p>}
          </div>

          <div>
            <Label htmlFor="password">كلمة المرور</Label>
            <IconInput
              id="password"
              type="password"
              icon={Lock}
              placeholder="أدخل كلمة المرور"
              {...register('password')}
              className={`text-left ${errors.password ? 'border-destructive' : ''}`}
              dir="ltr"
              aria-invalid={errors.password ? "true" : "false"}
            />
            {errors.password && <p className="mt-1 text-sm text-destructive">{errors.password.message}</p>}
          </div>
        </div>
        
        <div className="text-right">
          <Link href="#" onClick={handleForgotPassword} className="text-sm text-primary hover:underline">
            نسيت كلمة السر؟
          </Link>
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="animate-spin" />
          ) : (
            <>
              <LogIn className="ms-2 h-5 w-5" />
              تسجيل الدخول
            </>
          )}
        </Button>
      </form>
      <div className="mt-6 text-center">
        <Link href="/auth/signup" className="text-sm text-primary hover:underline">
          إنشاء حساب جديد
          <ArrowLeft className="me-1 inline-block h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
