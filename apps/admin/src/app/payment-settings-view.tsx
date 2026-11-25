'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, CircleAlert, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { api } from '@/lib/api';

type PaymentSettingsResponse = {
  baseDeliveryFeeMinor: number;
  deliveryFeePerKmMinor: number;
  serviceFeeMinor: number;
  isDefault: boolean;
  defaults: {
    baseDeliveryFeeMinor: number;
    deliveryFeePerKmMinor: number;
    serviceFeeMinor: number;
  };
  updatedAt: string | null;
  updatedBy: { id: string; name: string; email: string | null } | null;
};

type SavePayload = {
  baseDeliveryFeeMinor: number;
  deliveryFeePerKmMinor: number;
  serviceFeeMinor: number;
  reason?: string;
};

const ROUNDING_MINOR = 5_000;

const money = (minor: number) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: minor % 100 === 0 ? 0 : 2,
  }).format(minor / 100);

const toNairaInput = (minor: number) => {
  const naira = minor / 100;
  return Number.isInteger(naira) ? String(naira) : naira.toFixed(2);
};

function parseNairaToMinor(value: string, maxMinor: number, label: string): { minor: number | null; error?: string } {
  const trimmed = value.trim();
  if (!trimmed || !/^\d+(?:\.\d{1,2})?$/.test(trimmed)) {
    return { minor: null, error: `${label} must be a non-negative amount with up to 2 decimal places.` };
  }
  const minor = Math.round(Number(trimmed) * 100);
  if (!Number.isSafeInteger(minor) || minor < 0 || minor > maxMinor) {
    return { minor: null, error: `${label} must be between ₦0 and ${money(maxMinor)}.` };
  }
  return { minor };
}

function previewDeliveryFeeMinor(distanceKm: number, baseMinor: number, perKmMinor: number): number {
  const rawMinor = baseMinor + distanceKm * perKmMinor;
  const roundedMinor = Math.round(rawMinor / ROUNDING_MINOR) * ROUNDING_MINOR;
  return Math.max(baseMinor, roundedMinor);
}

const dateTime = (date: string) =>
  new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Lagos' }).format(new Date(date));

export function PaymentSettingsView({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient();
  const [baseFeeNaira, setBaseFeeNaira] = useState('500');
  const [perKmNaira, setPerKmNaira] = useState('150');
  const [chargesFeeNaira, setChargesFeeNaira] = useState('500');
  const [reason, setReason] = useState('');
  const [notice, setNotice] = useState('');
  const [noticeError, setNoticeError] = useState(false);

  const settingsQuery = useQuery({
    queryKey: ['payment-settings'],
    queryFn: () => api<PaymentSettingsResponse>('/admin/payment-settings'),
  });

  useEffect(() => {
    if (!settingsQuery.data) return;
    setBaseFeeNaira(toNairaInput(settingsQuery.data.baseDeliveryFeeMinor));
    setPerKmNaira(toNairaInput(settingsQuery.data.deliveryFeePerKmMinor));
    setChargesFeeNaira(toNairaInput(settingsQuery.data.serviceFeeMinor));
  }, [settingsQuery.data]);

  const notify = (message: string, isError = false) => {
    setNotice(message);
    setNoticeError(isError);
  };

  const saveSettings = useMutation({
    mutationFn: (payload: SavePayload) =>
      api<PaymentSettingsResponse>('/admin/payment-settings', {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    onSuccess: updated => {
      queryClient.setQueryData(['payment-settings'], updated);
      setReason('');
      notify('Payment settings saved. New quotes and orders now use these fees.');
    },
    onError: error => {
      notify(error instanceof Error ? error.message : 'Unable to save payment settings.', true);
    },
  });

  const parsed = useMemo(() => {
    const base = parseNairaToMinor(baseFeeNaira, 5_000_000, 'Base fee');
    const perKm = parseNairaToMinor(perKmNaira, 1_000_000, 'Fee per kilometer');
    const charges = parseNairaToMinor(chargesFeeNaira, 5_000_000, 'Charges fee');
    return { base, perKm, charges };
  }, [baseFeeNaira, perKmNaira, chargesFeeNaira]);

  const defaults = settingsQuery.data?.defaults ?? {
    baseDeliveryFeeMinor: 50_000,
    deliveryFeePerKmMinor: 15_000,
    serviceFeeMinor: 50_000,
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManage) return;
    const firstError = parsed.base.error ?? parsed.perKm.error ?? parsed.charges.error;
    if (firstError || parsed.base.minor === null || parsed.perKm.minor === null || parsed.charges.minor === null) {
      notify(firstError ?? 'Review the fee values and try again.', true);
      return;
    }
    saveSettings.mutate({
      baseDeliveryFeeMinor: parsed.base.minor,
      deliveryFeePerKmMinor: parsed.perKm.minor,
      serviceFeeMinor: parsed.charges.minor,
      ...(reason.trim() ? { reason: reason.trim() } : {}),
    });
  };

  const fillDefaults = () => {
    setBaseFeeNaira(toNairaInput(defaults.baseDeliveryFeeMinor));
    setPerKmNaira(toNairaInput(defaults.deliveryFeePerKmMinor));
    setChargesFeeNaira(toNairaInput(defaults.serviceFeeMinor));
    setNotice('');
  };

  const activeBaseMinor = parsed.base.minor ?? settingsQuery.data?.baseDeliveryFeeMinor ?? defaults.baseDeliveryFeeMinor;
  const activePerKmMinor = parsed.perKm.minor ?? settingsQuery.data?.deliveryFeePerKmMinor ?? defaults.deliveryFeePerKmMinor;
  const activeChargesMinor = parsed.charges.minor ?? settingsQuery.data?.serviceFeeMinor ?? defaults.serviceFeeMinor;
  const sample3KmDelivery = previewDeliveryFeeMinor(3, activeBaseMinor, activePerKmMinor);
  const sample5KmDelivery = previewDeliveryFeeMinor(5, activeBaseMinor, activePerKmMinor);
  const sampleFoodSubtotal = 500_000;

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">FINANCE &amp; PRICING</p>
          <h1>Payment settings</h1>
          <p className="page-description">
            Configure the base delivery fee, distance rate per kilometer, and platform charges fee used for checkout and payments.
          </p>
        </div>
      </div>

      {notice && (
        <div className={`notice-banner ${noticeError ? 'notice-error' : ''}`} role={noticeError ? 'alert' : 'status'}>
          {noticeError ? <CircleAlert size={16} /> : <Check size={16} />}
          {notice}
          <button onClick={() => setNotice('')} aria-label="Dismiss">×</button>
        </div>
      )}

      {settingsQuery.isLoading ? (
        <Card className="panel">
          <div className="loading-rows" aria-label="Loading"><span /><span /><span /><span /></div>
        </Card>
      ) : settingsQuery.error ? (
        <div className="error-state" role="alert">
          <CircleAlert size={18} />
          <span>{settingsQuery.error instanceof Error ? settingsQuery.error.message : 'Unable to load payment settings.'}</span>
        </div>
      ) : (
        <div className="payment-settings-grid">
          <Card className="panel payment-settings-card">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">ACTIVE CONFIGURATION</p>
                <h2>Fee schedule (NGN)</h2>
              </div>
              <span className={`status-badge ${settingsQuery.data?.isDefault ? 'status-pending' : 'status-approved'}`}>
                {settingsQuery.data?.isDefault ? 'Built-in defaults' : 'Custom saved'}
              </span>
            </div>

            <form className="payment-settings-form" onSubmit={handleSubmit} noValidate>
              <label>
                Base fee (₦)
                <input
                  type="number"
                  min={0}
                  max={50000}
                  step="0.01"
                  value={baseFeeNaira}
                  onChange={event => setBaseFeeNaira(event.target.value)}
                  disabled={!canManage || saveSettings.isPending}
                />
                <small className="field-hint">
                  Default: {money(defaults.baseDeliveryFeeMinor)} ({defaults.baseDeliveryFeeMinor.toLocaleString()} kobo). Applied as starting &amp; minimum delivery fee.
                </small>
                {parsed.base.error && <span className="field-error">{parsed.base.error}</span>}
              </label>

              <label>
                Fee per kilometer (₦ / km)
                <input
                  type="number"
                  min={0}
                  max={10000}
                  step="0.01"
                  value={perKmNaira}
                  onChange={event => setPerKmNaira(event.target.value)}
                  disabled={!canManage || saveSettings.isPending}
                />
                <small className="field-hint">
                  Default: {money(defaults.deliveryFeePerKmMinor)}/km ({defaults.deliveryFeePerKmMinor.toLocaleString()} kobo). Added per km of route distance, rounded to nearest ₦50.
                </small>
                {parsed.perKm.error && <span className="field-error">{parsed.perKm.error}</span>}
              </label>

              <label>
                Charges fee (₦)
                <input
                  type="number"
                  min={0}
                  max={50000}
                  step="0.01"
                  value={chargesFeeNaira}
                  onChange={event => setChargesFeeNaira(event.target.value)}
                  disabled={!canManage || saveSettings.isPending}
                />
                <small className="field-hint">
                  Default: {money(defaults.serviceFeeMinor)} ({defaults.serviceFeeMinor.toLocaleString()} kobo). Charged per order at checkout as service charge.
                </small>
                {parsed.charges.error && <span className="field-error">{parsed.charges.error}</span>}
              </label>

              {canManage && (
                <label>
                  Audit note (optional)
                  <input
                    value={reason}
                    onChange={event => setReason(event.target.value)}
                    maxLength={500}
                    placeholder="Reason for updating fee configuration"
                    disabled={saveSettings.isPending}
                  />
                </label>
              )}

              {canManage ? (
                <div className="payment-settings-actions">
                  <Button type="submit" disabled={saveSettings.isPending}>
                    {saveSettings.isPending ? 'Saving…' : 'Save payment settings'}
                  </Button>
                  <Button type="button" variant="outline" className="button button-secondary" onClick={fillDefaults} disabled={saveSettings.isPending}>
                    <RotateCcw size={14} /> Reset to defaults
                  </Button>
                </div>
              ) : (
                <p className="definition-note">Read-only access: only Super Admins and Finance Admins can update payment settings.</p>
              )}
            </form>

            <div className="payment-meta">
              <span>
                Last updated:{' '}
                <strong>{settingsQuery.data?.updatedAt ? dateTime(settingsQuery.data.updatedAt) : 'Not customized yet (using defaults)'}</strong>
              </span>
              {settingsQuery.data?.updatedBy && (
                <span>
                  Updated by: <strong>{settingsQuery.data.updatedBy.name}</strong>
                </span>
              )}
            </div>
          </Card>

          <Card className="panel payment-preview-card">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">CHECKOUT PREVIEW</p>
                <h2>Live fee breakdown</h2>
              </div>
              <SlidersHorizontal size={18} className="muted-icon" />
            </div>

            <div className="finance-row">
              <div>
                <span>Fallback / 0 km delivery fee</span>
                <small>When route distance is unavailable or 0 km</small>
              </div>
              <strong>{money(activeBaseMinor)}</strong>
            </div>
            <div className="finance-row">
              <div>
                <span>3 km delivery fee</span>
                <small>{money(activeBaseMinor)} + 3 × {money(activePerKmMinor)} (nearest ₦50)</small>
              </div>
              <strong>{money(sample3KmDelivery)}</strong>
            </div>
            <div className="finance-row">
              <div>
                <span>5 km delivery fee</span>
                <small>{money(activeBaseMinor)} + 5 × {money(activePerKmMinor)} (nearest ₦50)</small>
              </div>
              <strong>{money(sample5KmDelivery)}</strong>
            </div>
            <div className="finance-row">
              <div>
                <span>Charges fee per order</span>
                <small>Platform service charge added at checkout</small>
              </div>
              <strong>{money(activeChargesMinor)}</strong>
            </div>
            <div className="finance-row">
              <div>
                <span>Example ₦5,000 order (3 km)</span>
                <small>Food + delivery + charges fee</small>
              </div>
              <strong>{money(sampleFoodSubtotal + sample3KmDelivery + activeChargesMinor)}</strong>
            </div>

            <p className="definition-note">
              Changes take effect immediately for new quotes, orders, and payments. Existing orders keep the fee breakdown captured when they were placed.
            </p>
          </Card>
        </div>
      )}
    </>
  );
}
