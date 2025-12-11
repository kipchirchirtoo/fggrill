import { supabase } from '../config/database';
import crypto from 'crypto';

export interface IDocument {
  id: string;
  guestId: string;
  reservationId?: string;
  documentType: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  uploadedBy?: string;
  createdAt: Date;
}

export class Document implements IDocument {
  id: string;
  guestId: string;
  reservationId?: string;
  documentType: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  uploadedBy?: string;
  createdAt: Date;

  constructor(data: Partial<IDocument>) {
    this.id = data.id || crypto.randomUUID();
    this.guestId = data.guestId || '';
    this.reservationId = data.reservationId;
    this.documentType = data.documentType || 'OTHER';
    this.fileName = data.fileName || '';
    this.fileUrl = data.fileUrl || '';
    this.fileSize = data.fileSize || 0;
    this.mimeType = data.mimeType || 'application/octet-stream';
    this.uploadedBy = data.uploadedBy;
    this.createdAt = data.createdAt || new Date();
  }

  static async findByGuest(guestId: string): Promise<Document[]> {
    const { data, error } = await supabase
      .from('guest_documents')
      .select('*')
      .eq('guest_id', guestId)
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data.map(Document.fromDatabase);
  }

  static async findById(id: string): Promise<Document | null> {
    const { data, error } = await supabase
      .from('guest_documents')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return Document.fromDatabase(data);
  }

  async save(): Promise<Document> {
    const { data, error } = await supabase
      .from('guest_documents')
      .upsert([{
        id: this.id,
        guest_id: this.guestId,
        reservation_id: this.reservationId,
        document_type: this.documentType,
        file_name: this.fileName,
        file_url: this.fileUrl,
        file_size: this.fileSize,
        mime_type: this.mimeType,
        uploaded_by: this.uploadedBy,
        created_at: this.createdAt
      }])
      .select()
      .single();

    if (error) throw error;
    return Document.fromDatabase(data);
  }

  async delete(): Promise<void> {
    const { error } = await supabase
      .from('guest_documents')
      .delete()
      .eq('id', this.id);

    if (error) throw error;
  }

  static fromDatabase(data: any): Document {
    return new Document({
      id: data.id,
      guestId: data.guest_id,
      reservationId: data.reservation_id,
      documentType: data.document_type,
      fileName: data.file_name,
      fileUrl: data.file_url,
      fileSize: data.file_size,
      mimeType: data.mime_type,
      uploadedBy: data.uploaded_by,
      createdAt: new Date(data.created_at)
    });
  }
}
