import { Injectable } from '@angular/core';
import { toast } from 'ngx-sonner';

@Injectable({ providedIn: 'root' })
export class NotifyService {
  success(summary: string, detail?: string) {
    toast.success(summary, {
      description: detail,
    });
  }

  info(summary: string, detail?: string) {
    toast.info(summary, {
      description: detail,
    });
  }

  warn(summary: string, detail?: string) {
    toast.warning(summary, {
      description: detail,
    });
  }

  error(summary: string, detail?: string) {
    toast.error(summary, {
      description: detail,
    });
  }

  loading(summary: string, detail?: string) {
    toast.loading(summary, {
      description: detail,
    });
  }
}
