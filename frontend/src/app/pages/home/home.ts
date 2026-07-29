import { Component, signal, computed, inject } from '@angular/core';
import { StatusService } from '../../../services/status.service';
@Component({
  selector: 'app-home',
  imports: [],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  protected readonly title = signal('Home');
  private readonly statusService = inject(StatusService);
  readonly health = this.statusService.health;
  readonly dbTime = this.statusService.dbTime;
  readonly unique = this.statusService.unique;
  readonly dbVersion = this.statusService.dbVersion;
  readonly status = computed(
    () => this.health.value()?.status ?? 'consultando go...',
  );
  readonly isLoading = computed(
    () => this.health.isLoading() && !this.health.hasValue(),
  );
  readonly error = computed(() => this.health.error());

  reload() {
    this.statusService.reload();
  }
  readonly resDbVersion = computed(
    () => {
      this.dbVersion.value()?.message
      this.dbVersion.value()?.status
      this.dbVersion.value()?.version_db
    }
  )
  readonly resUnique = computed(
    () => {
      this.unique.value()?.response
    } 
  )

  readonly resDbTime = computed(
    () => { 
      this.dbTime.value()?.message
      this.dbTime.value()?.db_time
     }
  )
}
