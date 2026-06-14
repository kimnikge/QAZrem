-- Migration: Add print templates table
-- Up

CREATE TABLE IF NOT EXISTS print_templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Дефолтный шаблон «Акт приёма-передачи»
INSERT INTO print_templates (name, content, is_default) VALUES (
  'Акт приёма-передачи',
  '<div style="text-align:center;margin-bottom:24px">
  <h1 style="font-size:18px;margin:0">АКТ ПРИЁМА-ПЕРЕДАЧИ №#ЗАКАЗ-НОМЕР</h1>
  <p style="font-size:11px;color:#666">от #ДАТА-ЗАКАЗ-СОЗДАН</p>
</div>

<table>
  <tr><td style="width:200px"><strong>Клиент</strong></td><td>#КЛИЕНТ-ИМЯ</td></tr>
  <tr><td><strong>Телефон</strong></td><td>#КЛИЕНТ-ТЕЛЕФОН</td></tr>
  <tr><td><strong>Устройство</strong></td><td>#УСТРОЙСТВО-БРЕНД #УСТРОЙСТВО-МОДЕЛЬ</td></tr>
  <tr><td><strong>IMEI</strong></td><td><code>#УСТРОЙСТВО-IMEI</code></td></tr>
  <tr><td><strong>Серийный номер</strong></td><td><code>#УСТРОЙСТВО-SN</code></td></tr>
  <tr><td><strong>Статус</strong></td><td>#СТАТУС</td></tr>
  <tr><td><strong>Мастер</strong></td><td>#МАСТЕР</td></tr>
  <tr><td><strong>Локация</strong></td><td>#ЛОКАЦИЯ</td></tr>
</table>

<div style="margin-top:16px">
  <h3 style="font-size:14px">Описание проблемы:</h3>
  <p style="font-size:12px">#НЕИСПРАВНОСТЬ</p>
</div>

<div style="margin-top:12px">
  <h3 style="font-size:14px">Диагноз:</h3>
  <p style="font-size:12px">#ДИАГНОЗ</p>
</div>

<div style="margin-top:16px">
  <h3 style="font-size:14px">Запчасти:</h3>
  <p style="font-size:12px">#ТАБЛИЦА-ЗАПЧАСТЕЙ</p>
</div>

<div style="margin-top:16px;text-align:right">
  <table style="width:auto;margin-left:auto">
    <tr><td><strong>Стоимость</strong></td><td>#СТОИМОСТЬ ₸</td></tr>
    <tr><td><strong>Скидка</strong></td><td>#СКИДКА ₸</td></tr>
    <tr><td><strong>Итого</strong></td><td><strong>#ИТОГО ₸</strong></td></tr>
    <tr><td><strong>Предоплата</strong></td><td>#ПРЕДОПЛАТА ₸</td></tr>
    <tr><td><strong>К оплате</strong></td><td><strong>#К-ОПЛАТЕ ₸</strong></td></tr>
  </table>
</div>

<div style="margin-top:32px;display:flex;justify-content:space-between;font-size:12px">
  <div>Клиент: ___________________</div>
  <div>Мастер: ___________________</div>
</div>

<p style="margin-top:24px;font-size:10px;color:#999;text-align:center">
  #ПОДПИСЬ
</p>',
  TRUE
) ON CONFLICT DO NOTHING;
