import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { SessionLandingService } from 'src/app/core/services/session-landing.service';

@Component({
  selector: 'app-landing-redirect',
  standalone: true,
  template: '',
})
export class LandingRedirectComponent implements OnInit {
  private router = inject(Router);
  private landing = inject(SessionLandingService);

  ngOnInit(): void {
    this.router.navigateByUrl(this.landing.getLandingUrl(), { replaceUrl: true });
  }
}
