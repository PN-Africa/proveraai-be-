import { applyDecorators } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiProduces, ApiResponse } from '@nestjs/swagger';

const NOT_FOUND = ApiResponse({ status: 404, description: 'Transaction not found' });

export class TransactionsDocs {
  static List() {
    return applyDecorators(
      ApiOperation({
        summary: 'List your transactions',
        description:
          'Only transactions you uploaded. Highest risk score first, then most recent. ' +
          'Review queue: reviewStatus=OPEN. Reviewed: reviewStatus=CLOSED. ' +
          'reviewStatus is null for transactions that are not flagged.',
      }),
      ApiCookieAuth(),
      ApiResponse({ status: 200, description: 'A page of transactions with risk level and review' }),
      ApiResponse({ status: 400, description: 'Invalid filter' }),
    );
  }

  static Get() {
    return applyDecorators(
      ApiOperation({
        summary: 'Get one of your transactions with the reasons for its risk level',
        description:
          'indicators lists each rule that fired with a plain-language reason and its weight.',
      }),
      ApiCookieAuth(),
      ApiResponse({ status: 200, description: 'The transaction, its indicators and its review' }),
      NOT_FOUND,
    );
  }

  static CustomerHistory() {
    return applyDecorators(
      ApiOperation({
        summary: "Download the customer's transactions for a flagged transaction (CSV)",
        description:
          'Every transaction in your data of the customer behind this flagged transaction, oldest first, ' +
          'with risk level, review status, decision and reasons. Optional from/to. ' +
          'At most 10,000 rows. 10 downloads per minute. Every download is logged.',
      }),
      ApiCookieAuth(),
      ApiProduces('text/csv'),
      ApiResponse({ status: 200, description: 'customer-{customerId}-transactions.csv' }),
      ApiResponse({
        status: 400,
        description: 'Not flagged, no customer ID, invalid range, or more than 10,000 rows',
      }),
      NOT_FOUND,
      ApiResponse({ status: 429, description: 'Too many downloads' }),
    );
  }

  static Decide() {
    return applyDecorators(
      ApiOperation({
        summary: 'Review one of your flagged transactions',
        description:
          'CLEARED or ESCALATED, with notes of 10 to 2000 characters. Moves it from OPEN to CLOSED. ' +
          'A transaction can be reviewed once.',
      }),
      ApiCookieAuth(),
      ApiResponse({ status: 200, description: 'The review (status CLOSED)' }),
      ApiResponse({ status: 400, description: 'Missing or invalid decision or notes, or not flagged' }),
      NOT_FOUND,
      ApiResponse({ status: 409, description: 'Already reviewed' }),
    );
  }
}
