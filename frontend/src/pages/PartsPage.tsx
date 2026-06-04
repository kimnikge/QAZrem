import { useEffect, useState } from 'react';
import { Package } from 'lucide-react';
import { getParts, type Part } from '../api';

export function PartsPage() {
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getParts().then(setParts).catch(console.error).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="page-header">
        <div className="page-title">
          <Package size={24} />
          <h2>Склад запчастей</h2>
        </div>
      </div>
      {loading ? <div className="loading">Загрузка...</div> : (
        <table className="table">
          <thead>
            <tr>
              <th>Название</th>
              <th>Артикул</th>
              <th>Цена закуп</th>
              <th>Цена продажи</th>
              <th>Остаток</th>
              <th>Мин. уровень</th>
            </tr>
          </thead>
          <tbody>
            {parts.map(p => (
              <tr key={p.id} className={p.quantity <= p.min_quantity ? 'row-warning' : ''}>
                <td>{p.name}</td>
                <td><code>{p.sku}</code></td>
                <td>{Math.round(Number(p.purchase_price))} ₸</td>
                <td>{Math.round(Number(p.selling_price))} ₸</td>
                <td><strong>{p.quantity}</strong></td>
                <td>{p.min_quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
