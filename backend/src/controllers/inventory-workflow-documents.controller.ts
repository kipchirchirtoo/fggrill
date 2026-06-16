import { Request, Response, NextFunction } from 'express';
import * as InventoryWorkflowDocuments from '../services/inventory-workflow-documents.service';

const actorId = (req: Request): string => String((req as { user?: { id?: string } }).user?.id || '');

export const printStockRequestDocument = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await InventoryWorkflowDocuments.streamStockRequestDocument(
      res,
      req.params.id,
      actorId(req),
      req.params.document === 'approval' ? 'auditor_approval' : 'branch_request'
    );
  } catch (error) {
    next(error);
  }
};

export const printDispatchDocument = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const document = req.params.document;
    await InventoryWorkflowDocuments.streamDispatchDocument(
      res,
      req.params.id,
      actorId(req),
      document === 'dispatch'
        ? 'dispatch_document'
        : document === 'receipt'
          ? 'receipt_verification'
          : 'packing_list'
    );
  } catch (error) {
    next(error);
  }
};

export const printDepartmentRequestDocument = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await InventoryWorkflowDocuments.streamDepartmentRequestDocument(res, req.params.id, actorId(req));
  } catch (error) {
    next(error);
  }
};

export const printMaterialIssueDocument = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await InventoryWorkflowDocuments.streamMaterialIssueDocument(res, req.params.id, actorId(req));
  } catch (error) {
    next(error);
  }
};
