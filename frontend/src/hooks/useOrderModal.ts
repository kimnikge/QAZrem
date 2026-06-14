import { useEffect, useState } from 'react';
import { getOrder, getOrderStatuses, updateOrderStatus, updateOrder, getOrderGroups,
  type OrderDetail, type AvailableStatus, type OrderGroup, type Order } from '../api';
import { buildOrderPatchBody } from '../utils';

interface UseOrderModalProps {
  orderId: number;
  preload?: Order;
  onOrderUpdated?: () => void;
}

export function useOrderModal({ orderId, preload, onOrderUpdated }: UseOrderModalProps) {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [statuses, setStatuses] = useState<AvailableStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [groups, setGroups] = useState<OrderGroup[]>([]);

  // Editable fields
  const [editCost, setEditCost] = useState(preload ? String(Math.round(Number(preload.cost))) : '');
  const [editDiscount, setEditDiscount] = useState(preload ? String(Math.round(Number(preload.discount))) : '');
  const [editDiagnosis, setEditDiagnosis] = useState(preload?.diagnosis || '');
  const [editComment, setEditComment] = useState(preload?.internal_comment || '');
  const [editGroupId, setEditGroupId] = useState(preload?.group_id ? String(preload.group_id) : '');
  const [editClientName, setEditClientName] = useState(preload?.client_name || '');
  const [editClientPhone, setEditClientPhone] = useState(preload?.client_phone || '');
  const [editBrand, setEditBrand] = useState(preload?.brand || '');
  const [editModel, setEditModel] = useState(preload?.model || '');
  const [editImei, setEditImei] = useState(preload?.imei || '');
  const [editIssue, setEditIssue] = useState(preload?.issue_description || '');

  // Preload order
  const preloadOrder: OrderDetail | null = preload ? { ...preload, history: [], parts: [], payments: [], group_name: preload.group_name || null } : null;

  // Сброс edit-полей из данных заказа (используется везде)
  function syncEditFields(o: OrderDetail) {
    setEditCost(String(Math.round(Number(o.cost))));
    setEditDiscount(String(Math.round(Number(o.discount))));
    setEditDiagnosis(o.diagnosis || '');
    setEditComment(o.internal_comment || '');
    setEditGroupId(o.group_id ? String(o.group_id) : '');
    setEditClientName(o.client_name || '');
    setEditClientPhone(o.client_phone || '');
    setEditBrand(o.brand || '');
    setEditModel(o.model || '');
    setEditImei(o.imei || '');
    setEditIssue(o.issue_description || '');
  }

  // Загрузка
  useEffect(() => {
    if (preloadOrder) { setOrder(preloadOrder); setLoading(false); }
    async function fetchDetails() {
      try {
        const [o, s] = await Promise.all([getOrder(orderId), getOrderStatuses(orderId)]);
        setOrder(o); setStatuses(s.available); syncEditFields(o);
      } catch (err) {
        if (!preloadOrder) setError(err instanceof Error ? err.message : 'Ошибка');
      } finally { setLoading(false); }
    }
    fetchDetails();
    getOrderGroups().then(setGroups).catch(() => {});
  }, [orderId]);

  // Клавиатура
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (editing) { setEditing(false); return; }
      }
    }
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [editing]);

  async function handleStatus(slug: string) {
    try {
      await updateOrderStatus(orderId, slug);
      const [o, s] = await Promise.all([getOrder(orderId), getOrderStatuses(orderId)]);
      setOrder(o); setStatuses(s.available); syncEditFields(o);
      onOrderUpdated?.();
    } catch (err) { setError(err instanceof Error ? err.message : 'Ошибка'); }
  }

  async function handleSave() {
    if (!order) return;
    setSaving(true);
    try {
      const body = buildOrderPatchBody(order, {
        editCost, editDiscount, editDiagnosis, editComment, editIssue,
        editGroupId, editClientName, editClientPhone, editBrand, editModel, editImei,
      });
      if (Object.keys(body).length > 0) {
        await updateOrder(orderId, body);
      }
      setEditing(false);
      const [o, s] = await Promise.all([getOrder(orderId), getOrderStatuses(orderId)]);
      setOrder(o); setStatuses(s.available); syncEditFields(o);
    } catch (err) { setError(err instanceof Error ? err.message : 'Ошибка сохранения'); }
    finally { setSaving(false); }
  }

  async function refresh() {
    try {
      const [o, s] = await Promise.all([getOrder(orderId), getOrderStatuses(orderId)]);
      setOrder(o); setStatuses(s.available);
    } catch (err) { setError(err instanceof Error ? err.message : 'Ошибка'); }
  }

  return {
    order, statuses, loading, error, editing, setEditing, saving, groups,
    editCost, setEditCost, editDiscount, setEditDiscount,
    editDiagnosis, setEditDiagnosis, editComment, setEditComment,
    editGroupId, setEditGroupId, editClientName, setEditClientName,
    editClientPhone, setEditClientPhone, editBrand, setEditBrand,
    editModel, setEditModel, editImei, setEditImei, editIssue, setEditIssue,
    handleStatus, handleSave, refresh, setError
  };
}
