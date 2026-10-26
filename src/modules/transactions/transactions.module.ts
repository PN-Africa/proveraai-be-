import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DetectionModule } from '../detection/detection.module.js';
import { RejectedRowModelAction } from './model-actions/rejected-row-model-action.js';
import { RiskIndicatorModelAction } from './model-actions/risk-indicator-model-action.js';
import { TransactionModelAction } from './model-actions/transaction-model-action.js';
import { UploadBatchModelAction } from './model-actions/upload-batch-model-action.js';
import { RejectedRowModel } from './models/rejected-row.model.js';
import { RiskIndicatorModel } from './models/risk-indicator.model.js';
import { TransactionModel } from './models/transaction.model.js';
import { UploadBatchModel } from './models/upload-batch.model.js';
import { CsvReaderService } from './services/csv-reader.service.js';
import { IngestionService } from './services/ingestion.service.js';
import { RowValidatorService } from './services/row-validator.service.js';
import { UploadBatchService } from './services/upload-batch.service.js';
import { UploadScoringService } from './services/upload-scoring.service.js';
import { TransactionsService } from './transactions.service.js';
import { UploadsController } from './uploads.controller.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UploadBatchModel,
      TransactionModel,
      RejectedRowModel,
      RiskIndicatorModel,
    ]),
    DetectionModule,
  ],
  controllers: [UploadsController],
  providers: [
    TransactionsService,
    CsvReaderService,
    RowValidatorService,
    IngestionService,
    UploadScoringService,
    UploadBatchService,
    UploadBatchModelAction,
    TransactionModelAction,
    RejectedRowModelAction,
    RiskIndicatorModelAction,
  ],
  exports: [TransactionsService],
})
export class TransactionsModule {}
