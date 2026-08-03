import { AppError } from '../../../middleware/errorHandler';

export class InventoryDomainError extends AppError {
  code: string;
  details?: Record<string, unknown> | null;

  constructor(
    code: string,
    message: string,
    statusCode = 400,
    details?: Record<string, unknown> | null,
  ) {
    super(message, statusCode);
    this.code = code;
    this.details = details ?? null;
  }
}
