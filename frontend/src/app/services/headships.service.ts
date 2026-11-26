import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { Jefaturas } from '../core/models';

@Injectable({ providedIn: 'root' })
export class HeadshipsService {
  private readonly http = inject(HttpClient);

  listar(): Promise<Jefaturas> {
    return firstValueFrom(this.http.get<Jefaturas>('/api/headships'));
  }
}
