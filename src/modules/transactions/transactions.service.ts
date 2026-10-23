import { BadRequestException, Injectable } from '@nestjs/common';
import type { AuthUser } from '../../common/decorators/current-user.decorator.js';
import { PaginationQueryDto } from './dtos/pagination-query.dto.js';
import { UploadStatus } from './enums/upload-status.enum.js';
import { CsvReaderService, UploadedCsvFile } from './services/csv-reader.service.js';
import { IngestionService } from './services/ingestion.service.js';
import { UploadBatchService } from './services/upload-batch.service.js';

@Injectable()
export class TransactionsService {
  constructor(
    private readonly csvReaderService: CsvReaderService,
    private readonly uploadBatchService: UploadBatchService,
    private readonly ingestionService: IngestionService,
  ) {}

  // Checks the header right away (400 if unusable), then processes the rows
  // in the background. The frontend polls GET /uploads/:id for the result.
  async upload(file: UploadedCsvFile | undefined, admin: AuthUser) {
    if (!file) throw new BadRequestException('Attach a CSV file in the "file" field');
    const columns = this.csvReaderService.readHeader(file.buffer);
    const upload = await this.uploadBatchService.create(file.originalname, admin.id);
    void this.ingestionService.process(upload.id, file.buffer, columns);
    return { uploadId: upload.id, status: UploadStatus.PENDING };
  }

  listUploads(query: PaginationQueryDto) {
    return this.uploadBatchService.list(query.page ?? 1, query.limit ?? 20);
  }

  getUpload(id: string) {
    return this.uploadBatchService.get(id);
  }

  listRejectedRows(id: string, query: PaginationQueryDto) {
    return this.uploadBatchService.listRejected(id, query.page ?? 1, query.limit ?? 20);
  }
}
