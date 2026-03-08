import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NgxSonnerToaster } from 'ngx-sonner';
import { SessionLockStore } from 'src/app/features/seg/store/session-lock.store';
import { LockScreenComponent } from 'src/app/features/seg/pages/lock-screen/lock-screen.component';
import { NgIf } from '@angular/common';
import { SessionHeartbeatService } from 'src/app/core/services/session-heartbeat.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NgxSonnerToaster, LockScreenComponent, NgIf],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'KLAX SYSTEM';
  lockStore = inject(SessionLockStore);
  private heartbeat = inject(SessionHeartbeatService);
  constructor() {
    this.heartbeat.start();
  }
}
