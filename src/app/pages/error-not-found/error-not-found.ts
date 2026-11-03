import { Component } from '@angular/core';
import { ErrorPage } from '../../shared/components/error-page/error-page';

/** 404 page, routed as the wildcard route. */
@Component({
  selector: 'app-error-not-found',
  imports: [ErrorPage],
  templateUrl: './error-not-found.html',
  styleUrl: './error-not-found.css',
})
export class ErrorNotFound {}
