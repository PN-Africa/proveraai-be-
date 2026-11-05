import { applyDecorators } from '@nestjs/common';
import {
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';

const NOT_FOUND = ApiResponse({ status: 404, description: 'Upload not found' });

export class UploadsDocs {
  static Upload() {
    return applyDecorators(
      ApiOperation({
        summary: 'Upload a transactions CSV',
        description:
          'Required columns: transactionId, amount, currency, timestamp (date time), type. ' +
          'Optional: customerId, paymentMethod, location. Up to 20 extra columns are kept as attributes. ' +
          'Max 5 MB. The data is yours only; other accounts may upload the same file. ' +
          'Rows are processed in the background; poll GET /uploads/{id}.',
      }),
      ApiCookieAuth(),
      ApiConsumes('multipart/form-data'),
      ApiBody({
        schema: {
          type: 'object',
          required: ['file'],
          properties: { file: { type: 'string', format: 'binary' } },
        },
      }),
      ApiResponse({ status: 202, description: '{ uploadId, status: "PENDING" }' }),
      ApiResponse({
        status: 400,
        description: 'No file, not a .csv, unreadable, or missing required columns',
      }),
      ApiResponse({
        status: 409,
        description:
          'You already uploaded this exact file (and it did not fail). The message names the earlier upload',
      }),
      ApiResponse({ status: 413, description: 'File larger than 5 MB' }),
    );
  }

  static Rescore() {
    return applyDecorators(
      ApiOperation({
        summary: 'Re-run detection for one of your uploads with your current rules',
        description:
          'Replaces the score, level and reasons of every transaction in the upload, except reviewed ones, ' +
          'which keep the score you saw. ' +
          'An upload that failed only at scoring becomes COMPLETED. Rule changes never rescore on their own.',
      }),
      ApiCookieAuth(),
      ApiResponse({ status: 200, description: '{ uploads, scored, flagged, skippedReviewed }' }),
      NOT_FOUND,
      ApiResponse({
        status: 409,
        description: 'Still processing, no stored transactions, or another of your detection runs is in progress',
      }),
    );
  }

  static ScoreUnscored() {
    return applyDecorators(
      ApiOperation({
        summary: 'Score every one of your transactions that has no score yet',
        description:
          'For uploads where scoring failed. Already scored transactions are not touched. ' +
          'Uploads still processing are skipped.',
      }),
      ApiCookieAuth(),
      ApiResponse({ status: 200, description: '{ uploads, scored, flagged, skippedReviewed: 0 }' }),
      ApiResponse({ status: 409, description: 'Another of your detection runs is in progress' }),
    );
  }

  static List() {
    return applyDecorators(
      ApiOperation({ summary: 'List your uploads, newest first' }),
      ApiCookieAuth(),
      ApiResponse({ status: 200, description: 'A page of uploads' }),
    );
  }

  static Get() {
    return applyDecorators(
      ApiOperation({
        summary: 'Get one of your uploads',
        description:
          'status: PENDING, PROCESSING, COMPLETED or FAILED, with total, accepted and rejected row counts. ' +
          'error explains a FAILED upload.',
      }),
      ApiCookieAuth(),
      ApiResponse({ status: 200, description: 'The upload' }),
      NOT_FOUND,
    );
  }

  static Rejected() {
    return applyDecorators(
      ApiOperation({
        summary: 'List rejected rows of one of your uploads',
        description:
          'Each row: rowNumber (header is line 1), transactionId if present, and reasons. ' +
          'The first 1000 rejections are stored; rejectedRows on the upload counts all of them.',
      }),
      ApiCookieAuth(),
      ApiResponse({ status: 200, description: 'A page of rejected rows' }),
      NOT_FOUND,
    );
  }
}
