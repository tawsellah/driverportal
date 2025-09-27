
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
import { Mail, Lock, LogIn, ArrowLeft, Loader2 } from 'lucide-react';
import { IconInput } from '@/components/shared/icon-input';
import { auth } from '@/lib/firebase';
import { signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'firebase/auth';
import { setAuthStatus } from '@/lib/storage';
import { getUserProfile, getUserByPhone } from '@/lib/firebaseService';

const signInSchema = z.object({
  email: z.string().email({ message: "الرجاء إدخال بريد إلكتروني صالح." }),
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
    
    try {
      // Sign in with email and password
      const userCredential = await signInWithEmailAndPassword(auth, data.email, data.password);
      const user = userCredential.user;
      
      // Get full profile and check status
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
        case 'auth/wrong-password':
        case 'auth/user-not-found':
          errorMessage = "البريد الإلكتروني أو كلمة المرور غير صحيحة. يرجى التحقق من البيانات المدخلة.";
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
    const email = getValues("email");

    if (!email || !z.string().email().safeParse(email).success) {
        toast({
            title: "البريد الإلكتروني مطلوب",
            description: "الرجاء إدخال بريدك الإلكتروني المسجل أولاً لإرسال رابط استعادة كلمة المرور.",
            variant: "destructive",
        });
        return;
    }

    setIsLoading(true);
    try {
        await sendPasswordResetEmail(auth, email);
        toast({
            title: "تم إرسال رابط استعادة كلمة المرور",
            description: `تم إرسال رابط إلى بريدك الإلكتروني المسجل. يرجى التحقق منه.`,
        });
    } catch(error: any) {
        console.error("Forgot Password Error:", error);
        let message = "حدث خطأ أثناء محاولة إرسال بريد استعادة كلمة المرور. يرجى المحاولة مرة أخرى.";
        if (error.code === 'auth/user-not-found') {
            message = "لم يتم العثور على حساب مرتبط بهذا البريد الإلكتروني.";
        }
        toast({
            title: "خطأ في إرسال البريد",
            description: message,
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
        <div className="space-y-4">
          <div>
            <Label htmlFor="email">البريد الإلكتروني</Label>
            <IconInput
              id="email"
              type="email"
              icon={Mail}
              placeholder="أدخل بريدك الإلكتروني"
              {...register('email')}
              className={`text-left ${errors.email ? 'border-destructive' : ''}`}
              dir="ltr"
              aria-invalid={errors.email ? "true" : "false"}
            />
            {errors.email && <p className="mt-1 text-sm text-destructive">{errors.email.message}</p>}
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

    