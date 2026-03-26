import { Component, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { environment } from '../../environments/environment';

interface CsvRow {
  [key: string]: string;
}

@Component({
  selector: 'app-file-upload',
  imports: [RouterLink],
  templateUrl: './file-upload.html',
  styleUrl: './file-upload.scss'
})
export class FileUpload {
  private readonly http = inject(HttpClient);
  private readonly uploadUrl = `${environment.apiBaseUrl}/uploadPricingFile`;
  private readonly modifyUrl = `${environment.apiBaseUrl}/modifyPricingData`;
  private readonly downloadUrl = `${environment.apiBaseUrl}/downloadPricingData`;

  protected readonly selectedFile = signal<File | null>(null);
  protected readonly csvHeaders = signal<string[]>([]);
  protected readonly csvRows = signal<CsvRow[]>([]);
  protected readonly isDragOver = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly uploadStatus = signal<'idle' | 'uploading' | 'success' | 'error'>('idle');
  protected readonly saveStatus = signal<'idle' | 'saving' | 'success' | 'error'>('idle');
  protected readonly downloadStatus = signal<'idle' | 'downloading' | 'error'>('idle');
  protected readonly canDownload = signal(false);
  protected readonly editingIndex = signal<number | null>(null);
  protected readonly editRow = signal<CsvRow>({});
  protected readonly hasLocalChanges = signal(false);
  protected readonly modifiedIndices = signal<Set<number>>(new Set());

  protected readonly pageSize = signal(50);
  protected readonly currentPage = signal(1);
  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.csvRows().length / this.pageSize()))
  );
  protected readonly paginatedRows = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize();
    return this.csvRows().slice(start, start + this.pageSize());
  });
  protected readonly pageOffset = computed(() =>
    (this.currentPage() - 1) * this.pageSize()
  );

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragOver.set(true);
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages()) {
      this.cancelEdit();
      this.currentPage.set(page);
    }
  }

  onDragLeave() {
    this.isDragOver.set(false);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragOver.set(false);
    const file = event.dataTransfer?.files[0];
    if (file) this.handleFile(file);
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files?.[0]) {
      this.handleFile(input.files[0]);
      input.value = '';
    }
  }

  removeFile() {
    this.selectedFile.set(null);
    this.csvHeaders.set([]);
    this.csvRows.set([]);
    this.errorMessage.set('');
    this.uploadStatus.set('idle');
    this.saveStatus.set('idle');
    this.hasLocalChanges.set(false);
    this.modifiedIndices.set(new Set());
    this.currentPage.set(1);
    this.canDownload.set(false);
    this.cancelEdit();
  }

  addRow() {
    const emptyRow: CsvRow = {};
    this.csvHeaders().forEach((h: string) => emptyRow[h] = '');
    this.csvRows.update((rows: CsvRow[]) => [...rows, emptyRow]);
    this.currentPage.set(this.totalPages());
    const globalIndex = this.csvRows().length - 1;
    this.startEdit(globalIndex);
  }

  deleteRow(index: number) {
    if (this.editingIndex() === index) this.cancelEdit();
    this.csvRows.update((rows: CsvRow[]) => rows.filter((_: CsvRow, i: number) => i !== index));
    this.modifiedIndices.update((s: Set<number>) => {
      const newSet = new Set<number>();
      s.forEach((i: number) => {
        if (i < index) newSet.add(i);
        else if (i > index) newSet.add(i - 1);
      });
      return newSet;
    });
    this.hasLocalChanges.set(true);
    this.saveStatus.set('idle');
  }

  startEdit(index: number) {
    this.editingIndex.set(index);
    this.editRow.set({ ...this.csvRows()[index] });
  }

  cancelEdit() {
    this.editingIndex.set(null);
    this.editRow.set({});
  }

  onEditChange(header: string, event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.editRow.update((row: CsvRow) => ({ ...row, [header]: value }));
  }

  confirmEdit() {
    const index = this.editingIndex();
    if (index === null) return;
    const updated = { ...this.editRow() };
    this.csvRows.update((rows: CsvRow[]) =>
      rows.map((r: CsvRow, i: number) => i === index ? updated : r)
    );
    this.modifiedIndices.update((s: Set<number>) => new Set(s).add(index));
    this.hasLocalChanges.set(true);
    this.saveStatus.set('idle');
    this.cancelEdit();
  }

  upload() {
    const headers = this.csvHeaders();
    const rows = this.csvRows();
    if (headers.length === 0 || rows.length === 0) return;

    const csvContent = [
      headers.join(','),
      ...rows.map((row: CsvRow) => headers.map((h: string) => row[h]).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const fileName = this.selectedFile()?.name || 'pricing_data.csv';

    this.errorMessage.set('');
    this.uploadStatus.set('uploading');

    const formData = new FormData();
    formData.append('file', blob, fileName);

    this.http.post<{ data?: CsvRow[] }>(this.uploadUrl, formData).subscribe({
      next: (res: { data?: CsvRow[] }) => {
        this.uploadStatus.set('success');
        this.canDownload.set(true);
        // Reload table with DB-generated IDs
        if (res.data?.length) {
          const keys = Object.keys(res.data[0]);
          this.csvHeaders.set(keys);
          this.csvRows.set(res.data);
          this.currentPage.set(1);
          this.hasLocalChanges.set(false);
          this.modifiedIndices.set(new Set());
        }
      },
      error: () => {
        this.uploadStatus.set('error');
        this.errorMessage.set('Failed to upload file.');
      }
    });
  }

  saveChanges() {
    const rows = this.csvRows();
    const modified = this.modifiedIndices();
    if (modified.size === 0) return;

    const payload = Array.from(modified).map((i) => {
      const row = rows[i];
      return {
        id: row['id'] ? parseInt(row['id'], 10) : null,
        store_id: row['store_id'],
        country: row['country'],
        sku: row['sku'],
        product_name: row['product_name'],
        price: parseFloat(row['price']) || 0,
        date: row['date']
      };
    });

    this.errorMessage.set('');
    this.saveStatus.set('saving');

    this.http.put(this.modifyUrl, payload).subscribe({
      next: () => {
        this.saveStatus.set('success');
        this.hasLocalChanges.set(false);
        this.modifiedIndices.set(new Set());
        this.canDownload.set(true);
      },
      error: () => {
        this.saveStatus.set('error');
        this.errorMessage.set('Failed to save changes.');
      }
    });
  }

  downloadCsv() {
    this.downloadStatus.set('downloading');
    this.errorMessage.set('');

    this.http.get(this.downloadUrl, { responseType: 'blob' }).subscribe({
      next: (blob: Blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'pricing_data.csv';
        a.click();
        URL.revokeObjectURL(url);
        this.downloadStatus.set('idle');
      },
      error: () => {
        this.downloadStatus.set('error');
        this.errorMessage.set('Failed to download file from database.');
      }
    });
  }

  private handleFile(file: File) {
    this.errorMessage.set('');
    this.uploadStatus.set('idle');
    this.saveStatus.set('idle');
    this.hasLocalChanges.set(false);
    this.modifiedIndices.set(new Set());
    this.currentPage.set(1);
    this.cancelEdit();

    if (!file.name.endsWith('.csv')) {
      this.errorMessage.set('Only CSV files are supported.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      this.errorMessage.set('File exceeds the 10MB size limit.');
      return;
    }

    this.selectedFile.set(file);
    this.parseCsv(file);
  }

  private parseCsv(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const lines = text.split('\n').filter((l: string) => l.trim());
      if (lines.length === 0) return;

      const delimiter = lines[0].includes('\t') ? '\t' : ',';
      const headers = lines[0].split(delimiter).map((h: string) => h.trim());
      this.csvHeaders.set(headers);

      const rows: CsvRow[] = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(delimiter).map((v: string) => v.trim());
        const row: CsvRow = {};
        headers.forEach((h: string, idx: number) => row[h] = values[idx] || '');
        rows.push(row);
      }
      this.csvRows.set(rows);
    };
    reader.readAsText(file);
  }
}
