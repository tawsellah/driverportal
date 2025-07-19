
"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Loader2, User, Phone, MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { submitSupportRequest, type UserProfile } from '@/lib/firebaseService';
import { IconInput } from '../shared/icon-input';

const supportSchema = z.object({
  fullName: z.string().min(1, "الاسم الكامل مطلوب."),
  phone: z.string().regex(/^07[789]\d{7}$/, { message: "رقم هاتف أردني غير صالح." }),
  message: z.string().min(10, "الرجاء كتابة استفسار لا يقل عن 10 أحرف."),
});

type SupportFormValues = z.infer<typeof supportSchema>;

interface SupportDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  userProfile: UserProfile | null;
}

export function SupportDialog({ isOpen, onOpenChange, userProfile }: SupportDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<SupportFormValues>({
    resolver: zodResolver(supportSchema),
    defaultValues: {
      fullName: userProfile?.fullName || '',
      phone: userProfile?.phone || '',
      message: '',
    }
  });

  const onSubmit = async (data: SupportFormValues) => {
    if (!userProfile) {
        toast({ title: "خطأ", description: "لم يتم العثور على بيانات المستخدم.", variant: "destructive" });
        return;
    }
    setIsLoading(true);
    try {
      await submitSupportRequest({
        userId: userProfile.id,
        ...data,
      });
      toast({
        title: "تم إرسال طلبك بنجاح",
        description: "سيقوم فريق الدعم بالتواصل معك في أقرب وقت ممكن.",
      });
      handleClose();
    } catch (error: any) {
      console.error("Support Request Error:", error);
      toast({
        title: "خطأ في إرسال الطلب",
        description: "حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleClose = () => {
    if (isLoading) return;
    reset({
        fullName: userProfile?.fullName || '',
        phone: userProfile?.phone || '',
        message: '',
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg" onInteractOutside={(e) => {
          if (isLoading) e.preventDefault();
      }}>
        <DialogHeader>
          <DialogTitle>تواصل مع الدعم الفني</DialogTitle>
          <DialogDescription>
            املأ النموذج التالي وسيقوم فريقنا بالرد عليك في أقرب وقت.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4">
          <div>
            <Label htmlFor="fullName">الاسم الكامل</Label>
            <IconInput
              id="fullName"
              icon={User}
              {...register('fullName')}
              disabled={isLoading}
            />
            {errors.fullName && <p className="mt-1 text-sm text-destructive">{errors.fullName.message}</p>}
          </div>
          <div>
            <Label htmlFor="phone">رقم الهاتف</Label>
            <IconInput
              id="phone"
              type="tel"
              icon={Phone}
              {...register('phone')}
              disabled={isLoading}
            />
            {errors.phone && <p className="mt-1 text-sm text-destructive">{errors.phone.message}</p>}
          </div>
          <div>
            <Label htmlFor="message">الاستفسار</Label>
             <Textarea
                id="message"
                placeholder="اكتب استفسارك هنا..."
                className="min-h-[120px]"
                {...register('message')}
                disabled={isLoading}
            />
            {errors.message && <p className="mt-1 text-sm text-destructive">{errors.message.message}</p>}
          </div>
           <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
              إلغاء
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? <Loader2 className="animate-spin" /> : "إرسال الطلب"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

    