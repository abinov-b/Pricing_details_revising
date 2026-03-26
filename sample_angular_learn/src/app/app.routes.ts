import { Routes } from '@angular/router';
import { Landing } from './landing/landing';
import { FileUpload } from './file-upload/file-upload';

export const routes: Routes = [
  { path: '', component: Landing },
  { path: 'upload', component: FileUpload },
];
