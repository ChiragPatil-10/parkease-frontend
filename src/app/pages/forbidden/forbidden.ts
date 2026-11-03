import { Component } from '@angular/core';
import { ErrorPage } from '../../shared/components/error-page/error-page';

/** 403 page. Kept at the existing `forbidden` folder and `/403` route that roleGuard already redirects to. */
@Component({
  selector: 'app-forbidden',
  imports: [ErrorPage],
  templateUrl: './forbidden.html',
  styleUrl: './forbidden.css',
})
export class Forbidden {}
