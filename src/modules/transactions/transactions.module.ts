import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RejectedRowModelAction } from './model-actions/rejected-row-model-action.js';
import { TransactionModelAction } from './model-actions/transaction-model-action.js';
import { UploadBatchModelAction } from './model-actions/upload-batch-model-action.js';
import { RejectedRowModel } from './models/rejected-row.model.js';
import { TransactionModel } from './models/transaction.model.js';
import { UploadBatchModel } from './models/upload-batch.model.js';
import { CsvReaderService } from './services/csv-reader.service.js';
import { IngestionService } from './services/ingestion.service.js';
import { RowValidatorService } from './services/row-validator.service.js';
import { UploadBatchService } from './services/upload-batch.service.js';
import { TransactionsService } from './transactions.service.js';
import { UploadsController } from './uploads.controller.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([UploadBatchModel, TransactionModel, RejectedRowModel]),
  ],
  controllers: [UploadsController],
  providers: [
    TransactionsService,
    CsvReaderService,
    RowValidatorService,
    IngestionService,
    UploadBatchService,
    UploadBatchModelAction,
    TransactionModelAction,
    RejectedRowModelAction,
  ],
  exports: [TransactionsService],
})
export class TransactionsModule {}
