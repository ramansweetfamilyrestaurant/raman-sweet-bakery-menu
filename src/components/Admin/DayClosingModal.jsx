import React, { useState, useEffect, useMemo } from 'react';
import { X, Printer, Send, CheckCircle2, AlertTriangle, Clock, Calendar, RefreshCw, History, DollarSign, Smartphone, CreditCard, ChevronRight } from 'lucide-react';
import { fetchDayClosingSummary, submitDayClosing, fetchDayClosingHistory } from '../../api/client';
import { buildDayClosingSlipHtml, buildDayClosingWhatsAppMessage } from '../../utils/billingHelper';

export default function DayClosingModal({
  isOpen,
  onClose,
  token,
  restaurantInfo = {},
  settingsForm = {},
  onSilentPrint
}) {
  const [activeTab, setActiveTab] = useState('summary'); // 'summary' | 'history'
  const [selectedDate, setSelectedDate] = useState(() => {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    } catch (_) {
      return new Date().toISOString().slice(0, 10);
    }
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  // Cashier inputs
  const [actualCashInput, setActualCashInput] = useState('');
  const [closedByInput, setClosedByInput] = useState('Cashier');
  const [shiftName, setShiftName] = useState('Full Day');
  const [notesInput, setNotesInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // History state
  const [historyList, setHistoryList] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const currency = restaurantInfo?.currency_symbol || settingsForm?.currency_symbol || '₹';

  const loadSummary = async (date) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchDayClosingSummary(token, date);
      if (res && res.success) {
        setData(res);
        // Pre-fill if already closed previously
        if (res.latest_closing) {
          setActualCashInput(String(res.latest_closing.actual_cash_counted ?? res.summary?.cash_sales ?? 0));
          setClosedByInput(res.latest_closing.closed_by || 'Cashier');
          setShiftName(res.latest_closing.shift_name || 'Full Day');
          setNotesInput(res.latest_closing.notes || '');
        } else {
          setActualCashInput(String(res.summary?.cash_sales ?? 0));
        }
      } else {
        setError(res?.error || 'Could not load summary');
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch summary');
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetchDayClosingHistory(token);
      if (res && res.success) {
        setHistoryList(res.history || []);
      }
    } catch (_) {
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadSummary(selectedDate);
      loadHistory();
      setSaveSuccess(false);
    }
  }, [isOpen, selectedDate]);

  const summary = data?.summary || {
    total_orders: 0,
    gross_sales: 0,
    cash_sales: 0,
    upi_sales: 0,
    card_sales: 0,
    other_sales: 0,
    tax_amount: 0,
    top_items: [],
    dine_in_orders: 0,
    dine_in_sales: 0,
    takeaway_orders: 0,
    takeaway_sales: 0,
    delivery_orders: 0,
    delivery_sales: 0,
    room_orders: 0,
    room_sales: 0,
    cinema_orders: 0,
    cinema_sales: 0
  };

  const serviceModel = restaurantInfo?.service_model || settingsForm?.service_model || data?.restaurant?.service_model || '';
  const businessType = restaurantInfo?.business_type || settingsForm?.business_type || data?.restaurant?.business_type || '';
  const isCinema = serviceModel === 'cinema' || businessType === 'cinema_theatre' || Boolean(data?.restaurant?.is_cinema || data?.summary?.is_cinema);
  const isHotel = serviceModel === 'hotel' || businessType === 'hotel_resort' || Boolean(data?.restaurant?.is_hotel || data?.summary?.is_hotel);

  const expectedCash = Number(summary.cash_sales) || 0;
  const countedCash = actualCashInput === '' ? expectedCash : (parseFloat(String(actualCashInput).replace(/,/g, '')) || 0);
  const discrepancy = Math.round((countedCash - expectedCash) * 100) / 100;

  const isMatched = discrepancy === 0;
  const isOver = discrepancy > 0;
  const isShort = discrepancy < 0;

  const fallbackPrintWindow = (htmlContent) => {
    const printWindow = window.open('', '_blank', 'width=420,height=600');
    if (!printWindow) {
      alert('Please allow popups to print closing slips');
      return;
    }
    printWindow.document.open();
    printWindow.document.write(`
      ${htmlContent}
      <script>
        function doPrint() {
          window.focus();
          window.print();
        }
        if (document.readyState === 'complete') {
          setTimeout(doPrint, 250);
        } else {
          window.addEventListener('load', function() {
            setTimeout(doPrint, 250);
          });
        }
      </script>
    `);
    printWindow.document.close();
  };

  const handlePrintSlip = () => {
    const paperWidth = settingsForm?.printer_paper_width || '80mm';
    const htmlContent = buildDayClosingSlipHtml({
      restaurant: {
        ...(restaurantInfo?.name ? restaurantInfo : settingsForm),
        service_model: serviceModel,
        business_type: businessType,
        is_cinema: isCinema,
        is_hotel: isHotel
      },
      closingData: {
        ...summary,
        service_model: serviceModel,
        business_type: businessType,
        is_cinema: isCinema,
        is_hotel: isHotel,
        date: selectedDate
      },
      actualCash: countedCash,
      discrepancy,
      closedBy: closedByInput || 'Cashier',
      shiftName,
      notes: notesInput,
      paperWidth
    });

    if (typeof onSilentPrint === 'function') {
      onSilentPrint(htmlContent, null, 'day_closing').catch(() => {
        fallbackPrintWindow(htmlContent);
      });
    } else {
      fallbackPrintWindow(htmlContent);
    }
  };

  const handleSendWhatsApp = () => {
    const msg = buildDayClosingWhatsAppMessage({
      restaurant: {
        ...(restaurantInfo?.name ? restaurantInfo : settingsForm),
        service_model: serviceModel,
        business_type: businessType,
        is_cinema: isCinema,
        is_hotel: isHotel
      },
      closingData: {
        ...summary,
        service_model: serviceModel,
        business_type: businessType,
        is_cinema: isCinema,
        is_hotel: isHotel,
        date: selectedDate
      },
      actualCash: countedCash,
      discrepancy,
      closedBy: closedByInput || 'Cashier',
      shiftName,
      notes: notesInput
    });

    const rawPhone = restaurantInfo?.whatsapp_number || restaurantInfo?.phone || settingsForm?.whatsapp_number || settingsForm?.phone || '';
    const cleanPhone = String(rawPhone).replace(/[^0-9]/g, '');
    const targetPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

    const url = targetPhone
      ? `https://wa.me/${targetPhone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;

    window.open(url, '_blank');
  };

  const handleSaveClosingRecord = async () => {
    setSubmitting(true);
    try {
      const payload = {
        closing_date: selectedDate,
        shift_name: shiftName,
        closed_by: closedByInput || 'Cashier',
        actual_cash_counted: countedCash,
        notes: notesInput
      };
      const res = await submitDayClosing(token, payload);
      if (res && res.success) {
        setSaveSuccess(true);
        loadHistory();
        setTimeout(() => setSaveSuccess(false), 3500);
      } else {
        alert(res?.error || 'Failed to save closing record');
      }
    } catch (err) {
      alert(err.message || 'Error submitting day closing');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      padding: '16px'
    }}>
      <div style={{
        background: '#FFFFFF',
        borderRadius: '20px',
        width: '100%',
        maxWidth: '560px',
        maxHeight: '92vh',
        overflowY: 'auto',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box'
      }}>
        {/* MODAL HEADER */}
        <div style={{
          padding: '18px 20px',
          borderBottom: '1px solid #E2E8F0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#F8FAFC',
          borderTopLeftRadius: '20px',
          borderTopRightRadius: '20px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.25rem' }}>{isCinema ? '🎬' : isHotel ? '🏨' : '🌙'}</span>
              <strong style={{ fontSize: '1.05rem', color: '#0F172A', fontWeight: 900 }}>
                {isCinema
                  ? 'Cinema Concessions & Seat Shift Closing'
                  : isHotel
                  ? 'Hotel Day-End Closing & Night Audit'
                  : 'Day-End Closing & Cash Tally'}
              </strong>
            </div>
            <p style={{ margin: '3px 0 0 0', fontSize: '0.74rem', color: '#64748B' }}>
              {isCinema
                ? 'Audit screen seat deliveries, interval canteen counter, and cashier cash drawer'
                : isHotel
                ? 'Audit in-room dining, hotel restaurant billing, front desk cash, and daily guest revenue'
                : 'Audit daily cash in drawer, UPI collections, and sales summary'}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: '#FFFFFF',
              border: '1px solid #CBD5E1',
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#64748B'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* TABS (SUMMARY vs HISTORY) */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid #E2E8F0',
          padding: '0 20px',
          background: '#FFFFFF',
          gap: '16px'
        }}>
          <button
            onClick={() => setActiveTab('summary')}
            style={{
              padding: '12px 4px',
              fontSize: '0.84rem',
              fontWeight: activeTab === 'summary' ? 800 : 600,
              color: activeTab === 'summary' ? '#064E3B' : '#64748B',
              border: 'none',
              borderBottom: activeTab === 'summary' ? '2.5px solid #064E3B' : '2.5px solid transparent',
              background: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>Daily Audit & Reconciliation</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            style={{
              padding: '12px 4px',
              fontSize: '0.84rem',
              fontWeight: activeTab === 'history' ? 800 : 600,
              color: activeTab === 'history' ? '#064E3B' : '#64748B',
              border: 'none',
              borderBottom: activeTab === 'history' ? '2.5px solid #064E3B' : '2.5px solid transparent',
              background: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <History size={15} />
            <span>Past Closings History ({historyList.length})</span>
          </button>
        </div>

        {/* MODAL BODY */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {activeTab === 'summary' ? (
            <>
              {/* DATE PICKER & REFRESH */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#F1F5F9',
                padding: '8px 12px',
                borderRadius: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Calendar size={16} color="#475569" />
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155' }}>Closing Date:</span>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    style={{
                      border: '1px solid #CBD5E1',
                      borderRadius: '8px',
                      padding: '4px 8px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      color: '#0F172A',
                      outline: 'none',
                      background: '#FFFFFF'
                    }}
                  />
                </div>
                <button
                  onClick={() => loadSummary(selectedDate)}
                  disabled={loading}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    borderRadius: '8px',
                    padding: '5px 10px',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    color: '#0F172A',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <RefreshCw size={13} className={loading ? 'spin' : ''} />
                  <span>Refresh</span>
                </button>
              </div>

              {loading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#64748B', fontSize: '0.86rem' }}>
                  Calculating daily sales and payment channels...
                </div>
              ) : error ? (
                <div style={{ padding: '16px', background: '#FEF2F2', color: '#991B1B', borderRadius: '12px', fontSize: '0.82rem' }}>
                  ⚠️ {error}
                </div>
              ) : (
                <>
                  {/* KPI HIGHLIGHTS */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div style={{
                      background: 'linear-gradient(135deg, #064E3B 0%, #047857 100%)',
                      borderRadius: '14px',
                      padding: '14px',
                      color: '#FFFFFF'
                    }}>
                      <div style={{ fontSize: '0.72rem', opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Total Gross Sales
                      </div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 900, marginTop: '2px' }}>
                        {currency}{summary.gross_sales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                      <div style={{ fontSize: '0.72rem', opacity: 0.9, marginTop: '4px' }}>
                        ✓ {summary.total_orders} Orders Served Today
                      </div>
                    </div>

                    <div style={{
                      background: '#F8FAFC',
                      border: '1.5px solid #E2E8F0',
                      borderRadius: '14px',
                      padding: '14px'
                    }}>
                      <div style={{ fontSize: '0.72rem', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Tax Collected (GST)
                      </div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0F172A', marginTop: '2px' }}>
                        {currency}{summary.tax_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#059669', marginTop: '4px', fontWeight: 700 }}>
                        {restaurantInfo?.gst_enabled ? '5% Food GST Included' : 'GST Disabled (0%)'}
                      </div>
                    </div>
                  </div>

                  {/* SALES BY SERVICE CHANNEL (Dynamic for Cinema, Hotel, and Dine-In) */}
                  <div style={{
                    background: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: '14px',
                    padding: '14px'
                  }}>
                    <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#334155', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {isCinema ? '🎬 Cinema Sales Channels' : isHotel ? '🏨 Hotel Revenue Centers' : 'Sales by Service Channel'}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
                      {isCinema ? (
                        <>
                          <div style={{ background: '#F8FAFC', padding: '10px 12px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                            <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700 }}>
                              🎬 Seat Orders ({summary.cinema_orders || 0})
                            </div>
                            <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0F172A', marginTop: '2px' }}>
                              {currency}{(summary.cinema_sales || 0).toFixed(2)}
                            </div>
                          </div>

                          <div style={{ background: '#F8FAFC', padding: '10px 12px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                            <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700 }}>
                              🍿 Concession ({summary.takeaway_orders || 0})
                            </div>
                            <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#059669', marginTop: '2px' }}>
                              {currency}{(summary.takeaway_sales || 0).toFixed(2)}
                            </div>
                          </div>

                          {((summary.dine_in_orders || 0) > 0 || (summary.dine_in_sales || 0) > 0) && (
                            <div style={{ background: '#F8FAFC', padding: '10px 12px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                              <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700 }}>
                                🍽️ Lounge ({summary.dine_in_orders || 0})
                              </div>
                              <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#2563EB', marginTop: '2px' }}>
                                {currency}{(summary.dine_in_sales || 0).toFixed(2)}
                              </div>
                            </div>
                          )}
                        </>
                      ) : isHotel ? (
                        <>
                          <div style={{ background: '#F8FAFC', padding: '10px 12px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                            <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700 }}>
                              🏨 Room Service ({summary.room_orders || 0})
                            </div>
                            <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#7C3AED', marginTop: '2px' }}>
                              {currency}{(summary.room_sales || 0).toFixed(2)}
                            </div>
                          </div>

                          <div style={{ background: '#F8FAFC', padding: '10px 12px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                            <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700 }}>
                              🍽️ Restaurant ({summary.dine_in_orders || 0})
                            </div>
                            <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0F172A', marginTop: '2px' }}>
                              {currency}{(summary.dine_in_sales || 0).toFixed(2)}
                            </div>
                          </div>

                          <div style={{ background: '#F8FAFC', padding: '10px 12px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                            <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700 }}>
                              📦 Front Desk ({summary.takeaway_orders || 0})
                            </div>
                            <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#059669', marginTop: '2px' }}>
                              {currency}{(summary.takeaway_sales || 0).toFixed(2)}
                            </div>
                          </div>

                          {((summary.delivery_orders || 0) > 0 || (summary.delivery_sales || 0) > 0) && (
                            <div style={{ background: '#F8FAFC', padding: '10px 12px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                              <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700 }}>
                                🛵 Delivery ({summary.delivery_orders || 0})
                              </div>
                              <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#2563EB', marginTop: '2px' }}>
                                {currency}{(summary.delivery_sales || 0).toFixed(2)}
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <div style={{ background: '#F8FAFC', padding: '10px 12px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                            <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700 }}>
                              🍽️ Dine-In ({summary.dine_in_orders || 0})
                            </div>
                            <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0F172A', marginTop: '2px' }}>
                              {currency}{(summary.dine_in_sales || 0).toFixed(2)}
                            </div>
                          </div>

                          <div style={{ background: '#F8FAFC', padding: '10px 12px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                            <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700 }}>
                              📦 Takeaway ({summary.takeaway_orders || 0})
                            </div>
                            <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#059669', marginTop: '2px' }}>
                              {currency}{(summary.takeaway_sales || 0).toFixed(2)}
                            </div>
                          </div>

                          {((summary.delivery_orders || 0) > 0 || (summary.delivery_sales || 0) > 0) && (
                            <div style={{ background: '#F8FAFC', padding: '10px 12px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                              <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700 }}>
                                🛵 Delivery ({summary.delivery_orders || 0})
                              </div>
                              <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#2563EB', marginTop: '2px' }}>
                                {currency}{(summary.delivery_sales || 0).toFixed(2)}
                              </div>
                            </div>
                          )}

                          {((summary.room_orders || 0) > 0 || (summary.room_sales || 0) > 0) && (
                            <div style={{ background: '#F8FAFC', padding: '10px 12px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                              <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700 }}>
                                🏨 Room Srv ({summary.room_orders || 0})
                              </div>
                              <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#7C3AED', marginTop: '2px' }}>
                                {currency}{(summary.room_sales || 0).toFixed(2)}
                              </div>
                            </div>
                          )}

                          {((summary.cinema_orders || 0) > 0 || (summary.cinema_sales || 0) > 0) && (
                            <div style={{ background: '#F8FAFC', padding: '10px 12px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                              <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700 }}>
                                🎬 Seat Audi ({summary.cinema_orders || 0})
                              </div>
                              <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#D97706', marginTop: '2px' }}>
                                {currency}{(summary.cinema_sales || 0).toFixed(2)}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* PAYMENT CHANNEL BREAKDOWN */}
                  <div style={{
                    background: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: '14px',
                    padding: '14px'
                  }}>
                    <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#334155', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Payment Channel Breakdown
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: '#F8FAFC', borderRadius: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '1.1rem' }}>💵</span>
                          <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#0F172A' }}>Cash Collected</span>
                        </div>
                        <span style={{ fontSize: '0.92rem', fontWeight: 900, color: '#065F46' }}>
                          {currency}{summary.cash_sales.toFixed(2)}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: '#F8FAFC', borderRadius: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '1.1rem' }}>📲</span>
                          <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#0F172A' }}>UPI / Payment QR</span>
                        </div>
                        <span style={{ fontSize: '0.92rem', fontWeight: 900, color: '#1E40AF' }}>
                          {currency}{summary.upi_sales.toFixed(2)}
                        </span>
                      </div>

                      {summary.card_sales > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: '#F8FAFC', borderRadius: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '1.1rem' }}>💳</span>
                            <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#0F172A' }}>Card / POS Swipe</span>
                          </div>
                          <span style={{ fontSize: '0.92rem', fontWeight: 900, color: '#6B21A8' }}>
                            {currency}{summary.card_sales.toFixed(2)}
                          </span>
                        </div>
                      )}

                      {summary.other_sales > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: '#F8FAFC', borderRadius: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '1.1rem' }}>⚡</span>
                            <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#0F172A' }}>Other Payment Channels</span>
                          </div>
                          <span style={{ fontSize: '0.92rem', fontWeight: 900, color: '#374151' }}>
                            {currency}{summary.other_sales.toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* PHYSICAL CASH RECONCILIATION */}
                  <div style={{
                    background: isMatched ? '#F0FDF4' : (isOver ? '#EFF6FF' : '#FEF2F2'),
                    border: `1.5px solid ${isMatched ? '#86EFAC' : (isOver ? '#93C5FD' : '#FCA5A5')}`,
                    borderRadius: '16px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {isMatched ? (
                          <CheckCircle2 size={18} color="#15803D" />
                        ) : (
                          <AlertTriangle size={18} color={isOver ? '#2563EB' : '#B91C1C'} />
                        )}
                        <strong style={{ fontSize: '0.86rem', color: isMatched ? '#15803D' : (isOver ? '#1E40AF' : '#991B1B') }}>
                          Physical Cash Drawer Tally
                        </strong>
                      </div>
                      <span style={{
                        fontSize: '0.74rem',
                        fontWeight: 800,
                        padding: '3px 8px',
                        borderRadius: '6px',
                        background: '#FFFFFF',
                        color: isMatched ? '#15803D' : (isOver ? '#1D4ED8' : '#B91C1C')
                      }}>
                        {isMatched ? 'TALLIED (0.00)' : (isOver ? `+${currency}${discrepancy.toFixed(2)} OVER` : `${currency}${discrepancy.toFixed(2)} SHORT`)}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px', alignItems: 'center' }}>
                      <div>
                        <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '4px' }}>
                          Physical Cash Counted in Drawer ({currency})
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="e.g. 9200"
                          value={actualCashInput}
                          onChange={(e) => setActualCashInput(e.target.value)}
                          style={{
                            width: '100%',
                            height: '42px',
                            padding: '0 12px',
                            borderRadius: '10px',
                            border: '1.5px solid #CBD5E1',
                            fontSize: '1rem',
                            fontWeight: 800,
                            color: '#0F172A',
                            boxSizing: 'border-box',
                            outline: 'none',
                            background: '#FFFFFF'
                          }}
                        />
                      </div>

                      <div style={{
                        background: '#FFFFFF',
                        border: '1px solid #E2E8F0',
                        borderRadius: '10px',
                        padding: '8px 12px',
                        height: '42px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        boxSizing: 'border-box'
                      }}>
                        <div style={{ fontSize: '0.64rem', color: '#64748B', textTransform: 'uppercase' }}>Expected Cash</div>
                        <div style={{ fontSize: '0.94rem', fontWeight: 900, color: '#0F172A' }}>
                          {currency}{expectedCash.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    {/* Discrepancy explanation note */}
                    {!isMatched && (
                      <div>
                        <label style={{ fontSize: '0.70rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
                          Note / Reason for discrepancy (Optional)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. ₹50 paid to milk delivery boy, or petty cash expense"
                          value={notesInput}
                          onChange={(e) => setNotesInput(e.target.value)}
                          style={{
                            width: '100%',
                            height: '36px',
                            padding: '0 10px',
                            borderRadius: '8px',
                            border: '1px solid #CBD5E1',
                            fontSize: '0.78rem',
                            color: '#0F172A',
                            boxSizing: 'border-box',
                            background: '#FFFFFF'
                          }}
                        />
                      </div>
                    )}
                  </div>

                  {/* CLOSING AUDIT ATTRIBUTION */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '4px' }}>
                        Closed By (Cashier Name)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Cashier Amit"
                        value={closedByInput}
                        onChange={(e) => setClosedByInput(e.target.value)}
                        style={{
                          width: '100%',
                          height: '38px',
                          padding: '0 10px',
                          borderRadius: '8px',
                          border: '1px solid #CBD5E1',
                          fontSize: '0.80rem',
                          color: '#0F172A',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '4px' }}>
                        Shift Name
                      </label>
                      <select
                        value={shiftName}
                        onChange={(e) => setShiftName(e.target.value)}
                        style={{
                          width: '100%',
                          height: '38px',
                          padding: '0 10px',
                          borderRadius: '8px',
                          border: '1px solid #CBD5E1',
                          fontSize: '0.80rem',
                          color: '#0F172A',
                          boxSizing: 'border-box',
                          background: '#FFFFFF'
                        }}
                      >
                        <option value="Full Day">Full Day</option>
                        <option value="Morning Shift">Morning Shift</option>
                        <option value="Evening Shift">Evening Shift</option>
                      </select>
                    </div>
                  </div>

                  {/* SUCCESS NOTIFICATION */}
                  {saveSuccess && (
                    <div style={{
                      padding: '10px 14px',
                      background: '#D1FAE5',
                      border: '1px solid #6EE7B7',
                      borderRadius: '10px',
                      fontSize: '0.80rem',
                      color: '#065F46',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <CheckCircle2 size={16} />
                      <span>✓ Day Closing record saved to database successfully!</span>
                    </div>
                  )}

                  {/* ACTION BUTTONS */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '6px' }}>
                    <button
                      type="button"
                      onClick={handlePrintSlip}
                      style={{
                        padding: '12px',
                        borderRadius: '12px',
                        border: '1px solid #064E3B',
                        background: '#F0FDF4',
                        color: '#064E3B',
                        fontSize: '0.84rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      <Printer size={16} />
                      <span>Print Thermal Slip</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleSendWhatsApp}
                      style={{
                        padding: '12px',
                        borderRadius: '12px',
                        border: 'none',
                        background: '#25D366',
                        color: '#FFFFFF',
                        fontSize: '0.84rem',
                        fontWeight: 900,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        boxShadow: '0 2px 8px rgba(37, 211, 102, 0.3)'
                      }}
                    >
                      <Send size={15} />
                      <span>WhatsApp to Owner</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveClosingRecord}
                    disabled={submitting}
                    style={{
                      padding: '12px',
                      borderRadius: '12px',
                      border: 'none',
                      background: '#064E3B',
                      color: '#FFFFFF',
                      fontSize: '0.86rem',
                      fontWeight: 900,
                      cursor: submitting ? 'not-allowed' : 'pointer',
                      opacity: submitting ? 0.7 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      boxShadow: '0 4px 12px rgba(6, 78, 59, 0.25)'
                    }}
                  >
                    <span>{submitting ? 'Saving Snapshot...' : '💾 Save Official Closing Record'}</span>
                  </button>
                </>
              )}
            </>
          ) : (
            /* HISTORY TAB */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '0.78rem', color: '#64748B' }}>
                Review past daily closings and physical cash drawer audits:
              </div>

              {historyLoading ? (
                <div style={{ padding: '30px', textAlign: 'center', color: '#64748B' }}>
                  Loading closing history...
                </div>
              ) : historyList.length === 0 ? (
                <div style={{
                  padding: '30px',
                  textAlign: 'center',
                  background: '#F8FAFC',
                  borderRadius: '12px',
                  color: '#64748B',
                  fontSize: '0.82rem'
                }}>
                  No past day closings recorded yet. Submit your first closing report today!
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '420px', overflowY: 'auto' }}>
                  {historyList.map((rec) => {
                    const isDiff = Number(rec.cash_discrepancy) !== 0;
                    return (
                      <div
                        key={rec.id}
                        style={{
                          background: '#FFFFFF',
                          border: '1px solid #E2E8F0',
                          borderRadius: '12px',
                          padding: '12px 14px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <strong style={{ fontSize: '0.86rem', color: '#0F172A' }}>
                              {rec.closing_date}
                            </strong>
                            <span style={{ fontSize: '0.68rem', padding: '1px 6px', background: '#F1F5F9', borderRadius: '4px', color: '#475569' }}>
                              {rec.shift_name || 'Full Day'}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '3px' }}>
                            By {rec.closed_by || 'Cashier'} • {rec.total_orders || 0} Orders
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.94rem', fontWeight: 900, color: '#064E3B' }}>
                            {currency}{Number(rec.gross_sales || 0).toFixed(2)}
                          </div>
                          <div style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            color: isDiff ? '#B91C1C' : '#059669',
                            marginTop: '2px'
                          }}>
                            {isDiff ? `Diff: ${currency}${Number(rec.cash_discrepancy).toFixed(2)}` : '✓ Cash Matched'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
