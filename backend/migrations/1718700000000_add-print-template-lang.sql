-- Migration: Add lang to print_templates + Kazakh default template
-- Up

ALTER TABLE print_templates ADD COLUMN IF NOT EXISTS lang VARCHAR(5) NOT NULL DEFAULT 'ru';

-- Казахский дефолтный шаблон
INSERT INTO print_templates (name, content, is_default, lang) VALUES (
  'Қабылдау-тапсыру актісі',
  '<div style="text-align:center;margin-bottom:24px">
  <h1 style="font-size:18px;margin:0">ҚАБЫЛДАУ-ТАПСЫРУ АКТІСІ №#ЗАКАЗ-НОМЕР</h1>
  <p style="font-size:11px;color:#666">#ДАТА-ЗАКАЗ-СОЗДАН ж.</p>
</div>

<table>
  <tr><td style="width:200px"><strong>Клиент</strong></td><td>#КЛИЕНТ-ИМЯ</td></tr>
  <tr><td><strong>Телефон</strong></td><td>#КЛИЕНТ-ТЕЛЕФОН</td></tr>
  <tr><td><strong>Құрылғы</strong></td><td>#УСТРОЙСТВО-БРЕНД #УСТРОЙСТВО-МОДЕЛЬ</td></tr>
  <tr><td><strong>IMEI</strong></td><td><code>#УСТРОЙСТВО-IMEI</code></td></tr>
  <tr><td><strong>Сериялық нөмір</strong></td><td><code>#УСТРОЙСТВО-SN</code></td></tr>
  <tr><td><strong>Мәртебе</strong></td><td>#СТАТУС</td></tr>
  <tr><td><strong>Шебер</strong></td><td>#МАСТЕР</td></tr>
  <tr><td><strong>Орналасу</strong></td><td>#ЛОКАЦИЯ</td></tr>
</table>

<div style="margin-top:16px">
  <h3 style="font-size:14px">Ақаулық сипаттамасы:</h3>
  <p style="font-size:12px">#НЕИСПРАВНОСТЬ</p>
</div>

<div style="margin-top:12px">
  <h3 style="font-size:14px">Диагноз:</h3>
  <p style="font-size:12px">#ДИАГНОЗ</p>
</div>

<div style="margin-top:16px">
  <h3 style="font-size:14px">Қосалқы бөлшектер:</h3>
  <p style="font-size:12px">#ТАБЛИЦА-ЗАПЧАСТЕЙ</p>
</div>

<div style="margin-top:16px;text-align:right">
  <table style="width:auto;margin-left:auto">
    <tr><td><strong>Құны</strong></td><td>#СТОИМОСТЬ ₸</td></tr>
    <tr><td><strong>Жеңілдік</strong></td><td>#СКИДКА ₸</td></tr>
    <tr><td><strong>Барлығы</strong></td><td><strong>#ИТОГО ₸</strong></td></tr>
    <tr><td><strong>Алдын ала төлем</strong></td><td>#ПРЕДОПЛАТА ₸</td></tr>
    <tr><td><strong>Төлеуге</strong></td><td><strong>#К-ОПЛАТЕ ₸</strong></td></tr>
  </table>
</div>

<div style="margin-top:32px;display:flex;justify-content:space-between;font-size:12px">
  <div>Клиент: ___________________</div>
  <div>Шебер: ___________________</div>
</div>

<p style="margin-top:24px;font-size:10px;color:#999;text-align:center">
  #ПОДПИСЬ
</p>',
  TRUE,
  'kz'
) ON CONFLICT DO NOTHING;
