import type { OrderDetail } from './api';

/** Поля, которые могут редактироваться в заказе */
export interface OrderEditFields {
  editCost: string;
  editDiscount: string;
  editDiagnosis: string;
  editComment: string;
  editIssue: string;
  editGroupId: string;
  editClientName: string;
  editClientPhone: string;
  editBrand: string;
  editModel: string;
  editImei: string;
  editSerialNumber: string;
}

/**
 * Сравнивает edit-поля с оригинальным заказом и возвращает
 * только изменённые поля в формате, который ожидает PATCH /orders/:id.
 */
export function buildOrderPatchBody(
  order: OrderDetail,
  fields: Partial<OrderEditFields>,
): Record<string, unknown> {
  const body: Record<string, unknown> = {};

  if (fields.editCost !== undefined && Math.round(Number(fields.editCost)) !== Math.round(Number(order.cost)))
    body.cost = Math.round(Number(fields.editCost));
  if (fields.editDiscount !== undefined && Math.round(Number(fields.editDiscount)) !== Math.round(Number(order.discount)))
    body.discount = Math.round(Number(fields.editDiscount));
  if (fields.editDiagnosis !== undefined && fields.editDiagnosis !== (order.diagnosis || ''))
    body.diagnosis = fields.editDiagnosis;
  if (fields.editComment !== undefined && fields.editComment !== (order.internal_comment || ''))
    body.internal_comment = fields.editComment;
  if (fields.editIssue !== undefined && fields.editIssue !== (order.issue_description || ''))
    body.issue_description = fields.editIssue;
  if (fields.editGroupId !== undefined && fields.editGroupId !== (order.group_id ? String(order.group_id) : ''))
    body.group_id = fields.editGroupId ? Number(fields.editGroupId) : null;
  if (fields.editClientName !== undefined && fields.editClientName !== (order.client_name || ''))
    body.client_name = fields.editClientName;
  if (fields.editClientPhone !== undefined && fields.editClientPhone !== (order.client_phone || ''))
    body.client_phone = fields.editClientPhone;
  if (fields.editBrand !== undefined && fields.editBrand !== (order.brand || ''))
    body.device_brand = fields.editBrand;
  if (fields.editModel !== undefined && fields.editModel !== (order.model || ''))
    body.device_model = fields.editModel;
  if (fields.editImei !== undefined && fields.editImei !== (order.imei || ''))
    body.device_imei = fields.editImei;
  if (fields.editSerialNumber !== undefined && fields.editSerialNumber !== (order.serial_number || ''))
    body.device_serial_number = fields.editSerialNumber || null;

  return body;
}
