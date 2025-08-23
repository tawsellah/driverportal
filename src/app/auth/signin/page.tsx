
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
import { Phone, Lock, LogIn, ArrowLeft, Loader2 } from 'lucide-react';
import { IconInput } from '@/components/shared/icon-input';
import { auth } from '@/lib/firebase';
import { signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'firebase/auth';
import { setAuthStatus } from '@/lib/storage';
import { getUserProfile, getUserByPhone } from '@/lib/firebaseService';

const signInSchema = z.object({
  phone: z.string().regex(/^07[789]\d{7}$/, { message: "الرجاء إدخال رقم هاتف أردني صالح." }),
  password: z.string().min(6, { message: "كلمة المرور يجب أن تكون 6 أحرف على الأقل." }),
});

type SignInFormValues = z.infer<typeof signInSchema>;

export default function SignInPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, getValues, formState: { errors } } = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
  });

  const onSubmit: SubmitHandler<SignInFormValues> = async (data) => {
    setIsLoading(true);
    const constructedEmail = `t${data.phone}@tawsellah.com`;
    
    try {
      const userCredential = await signInWithEmailAndPassword(auth, constructedEmail, data.password);
      const user = userCredential.user;
      
      const profile = await getUserProfile(user.uid);

      if (profile?.status === 'pending') {
        await signOut(auth);
        setAuthStatus(false);
        toast({
          title: "الحساب قيد المراجعة",
          description: "Your account is still under review. Please wait for approval.",
          variant: "destructive",
          duration: 5000,
        });
        setIsLoading(false);
        return;
      }

      if (profile?.status === 'suspended') {
        await signOut(auth);
        setAuthStatus(false);
        toast({
          title: "تم تعليق حسابك",
          description: "تم تعليق حسابك بسبب مخالفة السياسات. يرجى التواصل مع الدعم لمزيد من التفاصيل.",
          variant: "destructive",
          duration: 5000,
        });
        setIsLoading(false);
        return;
      }
      
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
          errorMessage = "رقم الهاتف أو كلمة المرور غير صحيحة. يرجى التحقق من البيانات المدخلة.";
          break;
        case 'auth/wrong-password':
          errorMessage = "رقم الهاتف أو كلمة المرور غير صحيحة. يرجى التحقق من البيانات المدخلة.";
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

    if (!phone || !/^07[789]\d{7}$/.test(phone)) {
        toast({
            title: "رقم الهاتف مطلوب",
            description: "الرجاء إدخال رقم هاتفك المسجل أولاً لإرسال رابط استعادة كلمة المرور.",
            variant: "destructive",
        });
        return;
    }

    setIsLoading(true);
    try {
        const userProfile = await getUserByPhone(phone);
        if (userProfile && userProfile.email) {
            await sendPasswordResetEmail(auth, userProfile.email);
            toast({
                title: "تم إرسال رابط استعادة كلمة المرور",
                description: `تم إرسال رابط إلى بريدك الإلكتروني ${userProfile.email}. يرجى التحقق منه.`,
            });
        } else {
             toast({
                title: "خطأ",
                description: "لم يتم العثور على حساب مرتبط برقم الهاتف هذا أو لا يوجد بريد إلكتروني مسجل له.",
                variant: "destructive",
            });
        }
    } catch(error) {
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

  return (
    <div className="form-card">
      <h2 className="mb-6 text-center text-2xl font-bold">تسجيل الدخول</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="phone">رقم الهاتف</Label>
            <IconInput
              id="phone"
              type="tel"
              icon={Phone}
              placeholder="أدخل رقم هاتفك"
              {...register('phone')}
              className={`text-right ${errors.phone ? 'border-destructive' : ''}`}
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
              className={`text-right ${errors.password ? 'border-destructive' : ''}`}
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
    
