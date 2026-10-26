import { BadRequestException, Injectable } from '@nestjs/common';
import type { AuthUser } from '../../common/decorators/current-user.decorator.js';
import { DateRangeQueryDto } from './dtos/date-range-query.dto.js';
import { ListTransactionsQueryDto } from './dtos/list-transactions-query.dto.js';
import { PaginationQueryDto } from './dtos/pagination-query.dto.js';
import { ReviewDecisionDto } from './dtos/review-decision.dto.js';
import { UploadStatus } from './enums/upload-status.enum.js';
import { CsvReaderService, UploadedCsvFile } from './services/csv-reader.service.js';
import { CustomerHistoryExportService } from './services/customer-history-export.service.js';
import { IngestionService } from './services/ingestion.service.js';
import { ReviewService } from './services/review.service.js';
import { TransactionViewService } from './services/transaction-view.service.js';
import { UploadBatchService } from './services/upload-batch.service.js';

@Injectable()
export class TransactionsService {
  constructor(
    private readonly csvReaderService: CsvReaderService,
    private readonly uploadBatchService: UploadBatchService,
    private readonly ingestionService: IngestionService,
    private readonly transactionViewService: TransactionViewService,
    private readonly reviewService: ReviewService,
    private readonly customerHistoryExportService: CustomerHistoryExportService,
  ) {}

  // Checks the header (400) and that this exact file is new (409) right away,
  // then processes the rows in the background. The frontend polls
  // GET /uploads/:id for the result.
  async upload(file: UploadedCsvFile | undefined, admin: AuthUser) {
    if (!file) throw new BadRequestException('Attach a CSV file in the "file" field');
    const columns = this.csvReaderService.readHeader(file.buffer);
    const fileHash = await this.uploadBatchService.assertNotUploadedBefore(file.buffer);
    const upload = await this.uploadBatchService.create(file.originalname, fileHash, admin.id);
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

  listTransactions(query: ListTransactionsQueryDto, user: AuthUser) {
    return this.transactionViewService.list(query, user);
  }

  getTransaction(id: string, user: AuthUser) {
    return this.transactionViewService.get(id, user);
  }

  exportCustomerHistory(id: string, range: DateRangeQueryDto, user: AuthUser) {
    return this.customerHistoryExportService.export(id, range, user);
  }

  claimReview(id: string, analyst: AuthUser) {
    return this.reviewService.claim(id, analyst);
  }

  decideReview(id: string, dto: ReviewDecisionDto, analyst: AuthUser) {
    return this.reviewService.decide(id, dto, analyst);
  }
}
