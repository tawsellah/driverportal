
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
import { setAuthStatus, initializeMockData } from '@/lib/storage';

const signInSchema = z.object({
  email: z.string().email({ message: "الرجاء إدخال بريد إلكتروني صحيح." }),
  password: z.string().min(6, { message: "كلمة المرور يجب أن تكون 6 أحرف على الأقل." }),
});

type SignInFormValues = z.infer<typeof signInSchema>;

export default function SignInPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
  });

  const onSubmit: SubmitHandler<SignInFormValues> = async (data) => {
    setIsLoading(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Mock authentication
    if (data.email === "driver@tawsellah.com" && data.password === "password") {
      setAuthStatus(true);
      initializeMockData(); // Initialize mock data on first successful login
      toast({
        title: "تم تسجيل الدخول بنجاح!",
        description: "مرحباً بك في توصيلة.",
      });
      router.push('/trips');
    } else {
      toast({
        title: "خطأ في تسجيل الدخول",
        description: "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
        variant: "destructive",
      });
    }
    setIsLoading(false);
  };

  return (
    <div className="form-card">
      <h2 className="mb-6 text-center text-2xl font-bold">تسجيل الدخول</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div>
          <Label htmlFor="email">البريد الإلكتروني</Label>
          <IconInput
            id="email"
            type="email"
            icon={Mail}
            placeholder="أدخل بريدك الإلكتروني"
            {...register('email')}
            className={errors.email ? 'border-destructive' : ''}
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
            className={errors.password ? 'border-destructive' : ''}
            aria-invalid={errors.password ? "true" : "false"}
          />
          {errors.password && <p className="mt-1 text-sm text-destructive">{errors.password.message}</p>}
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
