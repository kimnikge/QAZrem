/**
 * Тесты: domain types — проверяем консистентность констант.
 */

import { describe, it, expect } from 'vitest';
import {
  STATUS_TRANSITIONS,
  ORDER_STATUS_SLUGS,
  STATUS_LABELS,
  STATUS_LABELS_SHORT,
  STATUS_COLORS,
  PRIORITIES,
  PRIORITY_LABELS,
  USER_ROLES,
} from '../../src/types/domain.js';

describe('Domain constants', () => {
  it('STATUS_TRANSITIONS покрывает все статусы', () => {
    for (const slug of ORDER_STATUS_SLUGS) {
      expect(STATUS_TRANSITIONS).toHaveProperty(slug);
    }
  });

  it('STATUS_LABELS имеет перевод для каждого статуса', () => {
    for (const slug of ORDER_STATUS_SLUGS) {
      expect(STATUS_LABELS[slug]).toBeTruthy();
    }
  });

  it('STATUS_LABELS_SHORT имеет краткий перевод для каждого статуса', () => {
    for (const slug of ORDER_STATUS_SLUGS) {
      expect(STATUS_LABELS_SHORT[slug]).toBeTruthy();
    }
  });

  it('STATUS_COLORS имеет цвет для каждого статуса', () => {
    for (const slug of ORDER_STATUS_SLUGS) {
      expect(STATUS_COLORS[slug]).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('PRIORITY_LABELS имеет метку для каждого приоритета', () => {
    for (const p of PRIORITIES) {
      expect(PRIORITY_LABELS[p]).toBeTruthy();
    }
  });

  it('USER_ROLES содержит admin, master, reception', () => {
    expect(USER_ROLES).toContain('admin');
    expect(USER_ROLES).toContain('master');
    expect(USER_ROLES).toContain('reception');
  });
});
