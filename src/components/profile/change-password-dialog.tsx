
"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Loader2, LockKeyhole } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { reauthenticateAndChangePassword } from '@/lib/firebaseService';
import { IconInput } from '../shared/icon-input';

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "كلمة المرور الحالية مطلوبة."),
  newPassword: z.string().min(6, "كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل."),
  confirmPassword: z.string().min(6, "تأكيد كلمة المرور مطلوب."),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "كلمتا المرور الجديدتان غير متطابقتين.",
  path: ["confirmPassword"],
});

type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;

interface ChangePasswordDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function ChangePasswordDialog({ isOpen, onOpenChange }: ChangePasswordDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
  });

  const onSubmit = async (data: ChangePasswordFormValues) => {
    setIsLoading(true);
    try {
      await reauthenticateAndChangePassword(data.currentPassword, data.newPassword);
      toast({
        title: "نجاح",
        description: "تم تغيير كلمة المرور بنجاح.",
      });
      handleClose();
    } catch (error: any) {
      console.error("Password Change Error:", error);
      let description = "حدث خطأ أثناء تغيير كلمة المرور.";
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        description = "كلمة المرور الحالية غير صحيحة.";
      }
      toast({
        title: "خطأ",
        description,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleClose = () => {
    if (isLoading) return;
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]" onInteractOutside={(e) => {
          if (isLoading) e.preventDefault();
      }}>
        <DialogHeader>
          <DialogTitle>تغيير كلمة المرور</DialogTitle>
          <DialogDescription>
            أدخل كلمة المرور الحالية والجديدة لتحديث بياناتك.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4">
          <div>
            <Label htmlFor="currentPassword">كلمة المرور الحالية</Label>
            <IconInput
              id="currentPassword"
              type="password"
              icon={LockKeyhole}
              {...register('currentPassword')}
              disabled={isLoading}
            />
            {errors.currentPassword && <p className="mt-1 text-sm text-destructive">{errors.currentPassword.message}</p>}
          </div>
          <div>
            <Label htmlFor="newPassword">كلمة المرور الجديدة</Label>
            <IconInput
              id="newPassword"
              type="password"
              icon={LockKeyhole}
              {...register('newPassword')}
              disabled={isLoading}
            />
            {errors.newPassword && <p className="mt-1 text-sm text-destructive">{errors.newPassword.message}</p>}
          </div>
          <div>
            <Label htmlFor="confirmPassword">تأكيد كلمة المرور الجديدة</Label>
            <IconInput
              id="confirmPassword"
              type="password"
              icon={LockKeyhole}
              {...register('confirmPassword')}
              disabled={isLoading}
            />
            {errors.confirmPassword && <p className="mt-1 text-sm text-destructive">{errors.confirmPassword.message}</p>}
          </div>
           <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
              إلغاء
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? <Loader2 className="animate-spin" /> : "حفظ التغييرات"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
