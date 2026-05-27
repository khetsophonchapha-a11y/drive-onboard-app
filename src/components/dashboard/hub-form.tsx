"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const schema = z.object({
  name: z.string().min(2, {
    message: "ชื่อ Hub ต้องมีอย่างน้อย 2 ตัวอักษร",
  }),
});

interface HubFormProps {
  initialName?: string;
  onSubmit: (values: { name: string }) => void;
  isPending: boolean;
}

export function HubForm({ initialName, onSubmit, isPending }: HubFormProps) {
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initialName || "",
    },
  });

  const handleSubmit = (values: z.infer<typeof schema>) => {
    onSubmit(values);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>ชื่อ Hub</FormLabel>
              <FormControl>
                <Input placeholder="เช่น กทม., เชียงใหม่, ฯลฯ" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isPending}>
          {isPending ? "กำลังบันทึก..." : "บันทึก"}
        </Button>
      </form>
    </Form>
  );
}
