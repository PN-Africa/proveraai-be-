import { applyDecorators } from '@nestjs/common';
import {
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';

const ADMIN_ONLY = ApiResponse({ status: 403, description: 'Not an administrator' });
const ADMIN_OR_ANALYST = ApiResponse({ status: 403, description: 'Not an administrator or analyst' });

export class UploadsDocs {
  static Upload() {
    return applyDecorators(
      ApiOperation({
        summary: 'Upload a transactions CSV (admin or analyst)',
        description:
          'Required columns: transactionId, amount, currency, timestamp (date time), type. ' +
          'Optional: customerId, paymentMethod, location. Up to 20 extra columns are kept as attributes. ' +
          'Max 5 MB. Rows are processed in the background; poll GET /uploads/{id}.',
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
      ADMIN_OR_ANALYST,
      ApiResponse({
        status: 409,
        description:
          'This exact file was already uploaded (and did not fail). The message names the earlier upload',
      }),
      ApiResponse({ status: 413, description: 'File larger than 5 MB' }),
    );
  }

  static Rescore() {
    return applyDecorators(
      ApiOperation({
        summary: 'Re-run detection for an upload with the current rules (admin only)',
        description:
          'Replaces the score, level and reasons of every transaction in the upload, except those ' +
          'claimed or reviewed by an analyst, which keep the score the analyst saw. ' +
          'An upload that failed only at scoring becomes COMPLETED. Rule changes never rescore on their own.',
      }),
      ApiCookieAuth(),
      ApiResponse({ status: 200, description: '{ uploads, scored, flagged, skippedReviewed }' }),
      ADMIN_ONLY,
      ApiResponse({ status: 404, description: 'Upload not found' }),
      ApiResponse({
        status: 409,
        description: 'Still processing, no stored transactions, or another detection run is in progress',
      }),
    );
  }

  static ScoreUnscored() {
    return applyDecorators(
      ApiOperation({
        summary: 'Score every transaction that has no score yet (admin only)',
        description:
          'For data stored before detection ran, or uploads where scoring failed. ' +
          'Already scored transactions are not touched. Uploads still processing are skipped.',
      }),
      ApiCookieAuth(),
      ApiResponse({ status: 200, description: '{ uploads, scored, flagged, skippedReviewed: 0 }' }),
      ADMIN_ONLY,
      ApiResponse({ status: 409, description: 'Another detection run is in progress' }),
    );
  }

  static List() {
    return applyDecorators(
      ApiOperation({ summary: 'List uploads, newest first (admin or analyst)' }),
      ApiCookieAuth(),
      ApiResponse({ status: 200, description: 'A page of uploads' }),
      ADMIN_OR_ANALYST,
    );
  }

  static Get() {
    return applyDecorators(
      ApiOperation({
        summary: 'Get an upload (admin or analyst)',
        description:
          'status: PENDING, PROCESSING, COMPLETED or FAILED, with total, accepted and rejected row counts. ' +
          'error explains a FAILED upload.',
      }),
      ApiCookieAuth(),
      ApiResponse({ status: 200, description: 'The upload' }),
      ADMIN_OR_ANALYST,
      ApiResponse({ status: 404, description: 'Upload not found' }),
    );
  }

  static Rejected() {
    return applyDecorators(
      ApiOperation({
        summary: 'List rejected rows of an upload (admin or analyst)',
        description:
          'Each row: rowNumber (header is line 1), transactionId if present, and reasons. ' +
          'The first 1000 rejections are stored; rejectedRows on the upload counts all of them.',
      }),
      ApiCookieAuth(),
      ApiResponse({ status: 200, description: 'A page of rejected rows' }),
      ADMIN_OR_ANALYST,
      ApiResponse({ status: 404, description: 'Upload not found' }),
    );
  }
}
