import React, { useMemo, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

const baseStats = {
  total_recipients: 0,
  successful_deliveries: 0,
  failed_deliveries: 0,
  failed_contacts: []
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    padding: '32px 16px',
    zIndex: 1200,
    overflowY: 'auto',
    boxSizing: 'border-box'
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: '16px',
    width: 'min(640px, 100%)',
    boxShadow: '0 25px 60px rgba(15, 23, 42, 0.25)',
    animation: 'fadeInScale 0.25s ease-out',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    border: '1px solid rgba(15, 23, 42, 0.08)'
  },
  header: {
    padding: '20px 24px',
    borderBottom: '1px solid #eef2ff',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '16px',
    background: 'linear-gradient(135deg, #eef2ff 0%, #f5f3ff 100%)'
  },
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 700,
    color: '#1f2937',
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  headerContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    flex: 1
  },
  subtitle: {
    margin: 0,
    fontSize: '14px',
    fontWeight: 400,
    color: '#6b7280',
    marginTop: '4px'
  },
  closeBtn: {
    border: 'none',
    background: '#1d4ed8',
    color: '#fff',
    width: '32px',
    height: '32px',
    borderRadius: '999px',
    cursor: 'pointer',
    fontSize: '20px',
    lineHeight: 1,
    transition: 'background 0.2s ease, transform 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  body: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '12px'
  },
  metricCard: {
    borderRadius: '12px',
    padding: '16px',
    border: '1px solid #e5e7eb',
    backgroundColor: '#f9fafb',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  metricLabel: {
    fontSize: '13px',
    color: '#6b7280',
    fontWeight: 600
  },
  metricValue: {
    fontSize: '20px',
    color: '#111827',
    fontWeight: 700
  },
  contextBox: {
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
    backgroundColor: '#fff',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  contextRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '16px',
    fontSize: '14px',
    color: '#1f2937',
    flexWrap: 'wrap'
  },
  contextLabel: {
    fontWeight: 600,
    color: '#4b5563'
  },
  channelBox: {
    borderRadius: '12px',
    border: '1px solid #fee2e2',
    backgroundColor: '#fef2f2',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  channelRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '14px',
    color: '#b91c1c'
  },
  failedContactsBox: {
    borderRadius: '12px',
    border: '1px solid #fecaca',
    backgroundColor: '#fef2f2',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  failedContactsHeader: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#b91c1c',
    marginBottom: '8px',
    paddingBottom: '8px',
    borderBottom: '1px solid #fecaca',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  failedChannelRow: {
    fontSize: '14px',
    color: '#b91c1c',
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap'
  },
  failedChannelLabel: {
    fontWeight: 600,
    minWidth: '80px'
  },
  failedNamesList: {
    color: '#991b1b',
    flex: 1
  },
  tableWrapper: {
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    overflow: 'hidden'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse'
  },
  tableHeadCell: {
    backgroundColor: '#f8fafc',
    textAlign: 'left',
    fontSize: '13px',
    color: '#475467',
    fontWeight: 600,
    padding: '12px',
    borderBottom: '1px solid #e2e8f0'
  },
  tableCell: {
    fontSize: '14px',
    color: '#1f2937',
    padding: '12px',
    borderBottom: '1px solid #f1f5f9'
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    borderRadius: '999px',
    padding: '4px 10px',
    fontSize: '12px',
    fontWeight: 600
  },
  footer: {
    padding: '0 24px 24px',
    display: 'flex',
    justifyContent: 'flex-end'
  },
  actionBtn: {
    border: 'none',
    borderRadius: '10px',
    padding: '10px 18px',
    fontSize: '14px',
    fontWeight: 600,
    backgroundColor: '#1d4ed8',
    color: '#fff',
    cursor: 'pointer'
  }
}


const NotificationSummaryModal = ({
  isOpen,
  onClose,
  stats = {},
  title = 'Delivery Summary',
  contextDetails = [],
  extraContent,
  buttonText = 'Close',
  headerTitle,
  headerSubtitle
}) => {
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
    return () => setIsClient(false)
  }, [])

  const mergedStats = { ...baseStats, ...stats }
  const {
    email_successful = 0,
    whatsapp_successful = 0,
    failed_contacts = []
  } = mergedStats

  // Determine which channels are enabled based on successful counts or failed contacts
  const emailEnabled = email_successful > 0 || failed_contacts.some(c => 
    c?.channel_status?.email?.status && c.channel_status.email.status !== 'not_enabled'
  )
  const whatsappEnabled = whatsapp_successful > 0 || failed_contacts.some(c => 
    c?.channel_status?.whatsapp?.status && c.channel_status.whatsapp.status !== 'not_enabled'
  )

  // Process failed contacts to group by channel
  // Check each failed contact to see which specific channel(s) failed
  const emailFailedNames = []
  const whatsappFailedNames = []

  failed_contacts.forEach(contact => {
    const name = contact.name || contact.contact || 'Unknown'
    const emailStatus = contact?.channel_status?.email?.status
    const whatsappStatus = contact?.channel_status?.whatsapp?.status

    // Check if email channel failed or was skipped (exclude 'not_enabled' and 'success')
    if (emailStatus === 'failed' || emailStatus === 'skipped') {
      if (!emailFailedNames.includes(name)) {
        emailFailedNames.push(name)
      }
    }

    // Check if whatsapp channel failed or was skipped (exclude 'not_enabled' and 'success')
    if (whatsappStatus === 'failed' || whatsappStatus === 'skipped') {
      if (!whatsappFailedNames.includes(name)) {
        whatsappFailedNames.push(name)
      }
    }
  })

  const hasFailedDeliveries = emailFailedNames.length > 0 || whatsappFailedNames.length > 0


  if (!isOpen) {
    return null
  }

  const modalContent = (
    <div style={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div style={styles.modal} role="dialog" aria-modal="true" aria-label={title}>
        <div style={styles.header}>
          <div style={styles.headerContent}>
            <h3 style={styles.title}>
              {headerTitle ? (
                <>
                  <span role="img" aria-hidden="true">✅</span>
                  {headerTitle}
                </>
              ) : (
                <>
                  <span role="img" aria-hidden="true">📊</span>
                  {title}
                </>
              )}
            </h3>
            {headerSubtitle && (
              <p style={styles.subtitle}>{headerSubtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={styles.closeBtn}
            aria-label="Close summary"
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#2563eb'
              e.currentTarget.style.transform = 'scale(1.05)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#1d4ed8'
              e.currentTarget.style.transform = 'scale(1)'
            }}
          >
            ×
          </button>
        </div>

        <div style={styles.body}>
          {contextDetails?.length > 0 && (
            <div style={styles.contextBox}>
              {contextDetails.map(({ label, value }, idx) => (
                <div key={`${label}-${idx}`} style={styles.contextRow}>
                  <span style={styles.contextLabel}>{label}</span>
                  <span>{value || '—'}</span>
                </div>
              ))}
            </div>
          )}

          {(emailEnabled || whatsappEnabled) && (
            <div style={{
              ...styles.channelBox,
              border: '1px solid #dcfce7',
              backgroundColor: '#f0fdf4'
            }}>
              <div style={{
                ...styles.channelRow,
                color: '#166534',
                fontSize: '15px',
                fontWeight: 600,
                marginBottom: '8px',
                paddingBottom: '8px',
                borderBottom: '1px solid #bbf7d0'
              }}>
                <span>Channel Success Summary</span>
              </div>
              {emailEnabled && (
                <div style={{ ...styles.channelRow, color: '#166534' }}>
                  <span>📧 Emails sent successfully</span>
                  <strong style={{ fontSize: '16px' }}>{email_successful}</strong>
                </div>
              )}
              {whatsappEnabled && (
                <div style={{ ...styles.channelRow, color: '#166534' }}>
                  <span>📱 WhatsApp messages sent successfully</span>
                  <strong style={{ fontSize: '16px' }}>{whatsapp_successful}</strong>
                </div>
              )}
            </div>
          )}

          {hasFailedDeliveries && (
            <div style={styles.failedContactsBox}>
              <div style={styles.failedContactsHeader}>
                <span role="img" aria-hidden="true">⚠️</span>
                <span>Failed Deliveries</span>
              </div>
              {emailFailedNames.length > 0 && (
                <div style={styles.failedChannelRow}>
                  <span style={styles.failedChannelLabel}>Email:</span>
                  <span style={styles.failedNamesList}>{emailFailedNames.join(', ')}</span>
                </div>
              )}
              {whatsappFailedNames.length > 0 && (
                <div style={styles.failedChannelRow}>
                  <span style={styles.failedChannelLabel}>WhatsApp:</span>
                  <span style={styles.failedNamesList}>{whatsappFailedNames.join(', ')}</span>
                </div>
              )}
            </div>
          )}

          {extraContent}
        </div>

        <div style={styles.footer}>
          <button type="button" onClick={onClose} style={styles.actionBtn}>
            {buttonText}
          </button>
        </div>
      </div>
    </div>
  )

  if (isClient && typeof document !== 'undefined') {
    return createPortal(modalContent, document.body)
  }

  return modalContent
}

export default NotificationSummaryModal


