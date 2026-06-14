import { useRef, useState } from 'react';
import { search, searchDeviceCatalog, searchDeviceByImei, type CatalogItem, type ImeiSearchResult, type SearchResult } from '../api';

type Timer = ReturnType<typeof setTimeout>;

export function useOrderAutocomplete() {
  const [clientQuery, setClientQuery] = useState('');
  const [clientSuggestions, setClientSuggestions] = useState<SearchResult['clients']>([]);
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const clientTimer = useRef<Timer | null>(null);

  const [catalogSuggestions, setCatalogSuggestions] = useState<CatalogItem[]>([]);
  const [showCatalog, setShowCatalog] = useState(false);
  const [catalogField, setCatalogField] = useState<'brand' | 'model' | null>(null);
  const catalogTimer = useRef<Timer | null>(null);

  const [imeiSuggestions, setImeiSuggestions] = useState<ImeiSearchResult[]>([]);
  const [showImei, setShowImei] = useState(false);
  const imeiTimer = useRef<Timer | null>(null);

  function handleClientSearch(value: string) {
    setClientQuery(value);
    if (clientTimer.current) clearTimeout(clientTimer.current);
    if (value.trim().length < 2) { setShowClientSuggestions(false); return; }
    clientTimer.current = setTimeout(async () => {
      try {
        const res = await search(value.trim());
        setClientSuggestions(res.clients);
        setShowClientSuggestions(res.clients.length > 0);
      } catch { setShowClientSuggestions(false); }
    }, 350);
  }

  function selectClient(item: SearchResult['clients'][0]) {
    const c = item.client;
    setSelectedClientId(c.id);
    setClientQuery(c.name + ' · ' + c.phone);
    setShowClientSuggestions(false);
    return { name: c.name, phone: c.phone, email: (c as any).email || '', address: (c as any).address || '' };
  }

  function clearClient() {
    setSelectedClientId(null);
    setClientQuery('');
    return { name: '', phone: '', email: '', address: '' };
  }

  function handleCatalogInput(field: 'brand' | 'model', value: string) {
    if (catalogTimer.current) clearTimeout(catalogTimer.current);
    catalogTimer.current = setTimeout(async () => {
      try {
        const res = await searchDeviceCatalog(value);
        setCatalogSuggestions(res);
        setShowCatalog(res.length > 0);
        setCatalogField(field);
      } catch { setShowCatalog(false); }
    }, 200);
  }

  function selectCatalog(item: CatalogItem) {
    setShowCatalog(false);
    return { brand: item.brand, model: item.model };
  }

  function handleImeiInput(value: string) {
    if (imeiTimer.current) clearTimeout(imeiTimer.current);
    const last4 = value.replace(/\D/g, '').slice(-4);
    if (last4.length < 4) { setShowImei(false); return; }
    imeiTimer.current = setTimeout(async () => {
      try {
        const res = await searchDeviceByImei(last4);
        setImeiSuggestions(res);
        setShowImei(res.length > 0);
      } catch { setShowImei(false); }
    }, 400);
  }

  function selectImeiDevice(dev: ImeiSearchResult) {
    setSelectedClientId(dev.client_id);
    setClientQuery(dev.client_name + ' · ' + dev.client_phone);
    setShowImei(false);
    return {
      client: { name: dev.client_name, phone: dev.client_phone },
      device: { brand: dev.brand, model: dev.model, imei: dev.imei, serial_number: dev.serial_number || '' }
    };
  }

  function hideSuggestions() {
    setTimeout(() => {
      setShowClientSuggestions(false);
      setShowCatalog(false);
      setShowImei(false);
    }, 200);
  }

  return {
    clientQuery, setClientQuery,
    clientSuggestions, showClientSuggestions, selectedClientId,
    catalogSuggestions, showCatalog, catalogField,
    imeiSuggestions, showImei,
    handleClientSearch, selectClient, clearClient,
    handleCatalogInput, selectCatalog,
    handleImeiInput, selectImeiDevice,
    hideSuggestions
  };
}
