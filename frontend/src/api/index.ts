// ═══════════════════════════════════════════════════════════
// API — единая точка входа
// Импортируй как: import { getOrders, type Order } from '../api'
// ═══════════════════════════════════════════════════════════

export { request, buildQuery } from './client';

export { type UserInfo, type LoginResponse, login } from './auth';

export { type Client, getClients, getClient } from './clients';

export { type Device, type SearchResult, search } from './search';

export {
  type CatalogItem, type CatalogEntry, type CatalogListResponse,
  type ImeiSearchResult,
  searchDeviceCatalog, getCatalog, createCatalogEntry,
  updateCatalogEntry, deleteCatalogEntry, importCatalog,
  searchDeviceByImei,
} from './catalog';

export {
  type Order, type OrderListResponse, type OrderDetail,
  type CreateOrderInput, type AvailableStatus,
  getOrders, getOrder, getOrderStatuses,
  createOrder, updateOrder, updateOrderStatus,
  assignPartToOrder, deleteOrderPart,
  assignServiceToOrder, deleteOrderService,
} from './orders';

export {
  type Part, type CreatePartInput,
  getParts, writeoffPart, getPartsSummary, getPartMovements,
  createPart, updatePart, receivePart,
} from './parts';

export {
  type FinanceReport, type CreatePaymentInput,
  type MasterPayout, type MasterPayoutsResponse,
  getFinanceReport, getMasterPayouts,
  createPayment, deletePayment, updatePayment, refundPayment, getRefunds,
} from './finance';

export {
  getMasters, getAllUsers,
  type UserCreateInput, type UserUpdateInput,
  createUser, updateUser, deleteUser,
} from './users';

export {
  type SettingsData,
  getSettings, createPaymentMethod, deletePaymentMethod,
  createExpenseCategory, deleteExpenseCategory,
} from './settings';

export {
  type Supplier, type CreateSupplierInput,
  getSuppliers, createSupplier, updateSupplier, deleteSupplier,
} from './suppliers';

export {
  type Location,
  getLocations, createLocation, updateLocation, deleteLocation,
} from './locations';

export {
  type OrderGroup,
  getOrderGroups, createOrderGroup, updateOrderGroup, deleteOrderGroup,
} from './order-groups';

export {
  type Service,
  getServices, createService, updateService, deleteService,
} from './services';

export {
  type PrintTemplate, type PrintTemplateListItem, type TemplateVariable,
  getPrintTemplates, getPrintTemplate, getTemplateVariables,
  createPrintTemplate, updatePrintTemplate, deletePrintTemplate,
  previewPrintTemplate, samplePreviewPrintTemplate,
} from './print-templates';

export {
  type CompanyAccount, type CashTransfer, type AccountTransaction,
  type CashOperation,
  getAccounts, createAccount, updateAccount,
  getAccountTransactions, getTransfers, createTransfer,
  createCashOperation,
} from './accounts';
