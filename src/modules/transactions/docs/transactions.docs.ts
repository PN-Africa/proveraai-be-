import { applyDecorators } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiProduces, ApiResponse } from '@nestjs/swagger';

const ANALYST_ONLY = ApiResponse({ status: 403, description: 'Not an analyst' });
const NOT_FOUND = ApiResponse({ status: 404, description: 'Transaction not found' });

export class TransactionsDocs {
  static List() {
    return applyDecorators(
      ApiOperation({
        summary: 'List transactions',
        description:
          'Highest risk score first, then most recent. ' +
          'Review queue: flagged=true&reviewStatus=OPEN. My reviews: mine=true&reviewStatus=IN_REVIEW. ' +
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
        summary: 'Get a transaction with the reasons for its risk level',
        description:
          'indicators lists each rule that fired with a plain-language reason. ' +
          'Rule weights are included for admins only.',
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
          'Every transaction of the customer behind this flagged transaction, oldest first, ' +
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

  static Claim() {
    return applyDecorators(
      ApiOperation({
        summary: 'Claim a flagged transaction for review (analyst only)',
        description: 'Moves it from OPEN to IN_REVIEW. Claiming one you already hold returns it unchanged.',
      }),
      ApiCookieAuth(),
      ApiResponse({ status: 200, description: 'The review (status IN_REVIEW)' }),
      ApiResponse({ status: 400, description: 'The transaction is not flagged' }),
      ANALYST_ONLY,
      NOT_FOUND,
      ApiResponse({ status: 409, description: 'Claimed by another analyst, or already reviewed' }),
    );
  }

  static Decide() {
    return applyDecorators(
      ApiOperation({
        summary: 'Record the review decision (analyst only)',
        description:
          'CLEARED or ESCALATED, with notes of 10 to 2000 characters. ' +
          'Only the analyst who claimed the transaction can decide it, once.',
      }),
      ApiCookieAuth(),
      ApiResponse({ status: 200, description: 'The review (status CLOSED)' }),
      ApiResponse({ status: 400, description: 'Missing or invalid decision or notes' }),
      ApiResponse({ status: 403, description: 'Not an analyst, or claimed by another analyst' }),
      NOT_FOUND,
      ApiResponse({ status: 409, description: 'Not claimed yet, or already reviewed' }),
    );
  }
}
