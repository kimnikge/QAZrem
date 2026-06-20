import { request } from './client';

export type PrintTemplate = {
  id: number;
  name: string;
  content: string;
  is_default: boolean;
  lang: string;
  created_at: string;
  updated_at: string;
};

export type PrintTemplateListItem = {
  id: number;
  name: string;
  is_default: boolean;
  lang: string;
  created_at: string;
  updated_at: string;
};

export type TemplateVariable = {
  key: string;
  label: string;
  group: string;
};

export function getPrintTemplates() {
  return request<PrintTemplateListItem[]>('/print-templates');
}

export function getPrintTemplate(id: number) {
  return request<PrintTemplate>(`/print-templates/${id}`);
}

export function getTemplateVariables() {
  return request<TemplateVariable[]>('/print-templates/variables');
}

export function createPrintTemplate(data: { name: string; content: string; is_default?: boolean }) {
  return request<PrintTemplate>('/print-templates', { method: 'POST', body: JSON.stringify(data) });
}

export function updatePrintTemplate(id: number, data: { name: string; content: string; is_default?: boolean }) {
  return request<PrintTemplate>(`/print-templates/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function deletePrintTemplate(id: number) {
  return request<{ message: string }>(`/print-templates/${id}`, { method: 'DELETE' });
}

export function previewPrintTemplate(orderId: number, templateId?: number) {
  const qs = templateId ? `?templateId=${templateId}` : '';
  return request<{ html: string }>(`/print-templates/preview/${orderId}${qs}`);
}

export function samplePreviewPrintTemplate(content: string) {
  return request<{ html: string }>(`/print-templates/sample-preview?content=${encodeURIComponent(content)}`);
}
