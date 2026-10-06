import React, { useState, useRef } from 'react';

export default function WorkspaceShareModal({
  isOpen,
  onClose,
  messages = [],
  currentUser = null,
  activeLanguage = 'en-US',
  currentTheme = 'visionos',
  onExportPdf,
  onImportSession
}) {
  const [copiedType, setCopiedType] = useState(null);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  // Generate GitHub-flavored Markdown transcript
  const generateMarkdownSummary = () => {
    const dateStr = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    let md = `# Lumen AI Session Transcript\n`;
    md += `**Date:** ${dateStr}  \n`;
    md += `**Participant:** ${currentUser?.name || 'Guest User'}  \n`;
    md += `**Language:** ${activeLanguage}  \n`;
    md += `**Theme:** ${currentTheme}  \n\n`;
    md += `---\n\n`;

    for (const msg of messages) {
      if (!msg || !msg.text) continue;
      const isUser = msg.role === 'user';
      const speaker = isUser ? (currentUser?.name || 'User') : 'Lumen AI';
      const timeStr = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      md += `### ${speaker} ${timeStr ? `(${timeStr})` : ''}\n\n`;
      md += `${msg.text}\n\n`;

      if (Array.isArray(msg.widgets) && msg.widgets.length > 0) {
        md += `*Attached Widgets:*  \n`;
        for (const w of msg.widgets) {
          if (w.widgetType === 'weather') {
            md += `- **Weather for ${w.city}:** ${w.temp}°C, ${w.condition}\n`;
          } else if (w.widgetType === 'crypto') {
            md += `- **Crypto ${w.symbol}:** $${w.price} (${w.change24h > 0 ? '+' : ''}${w.change24h}%)\n`;
          } else if (w.widgetType === 'pdf_document') {
            md += `- **PDF Document:** ${w.title} (${w.fileName})\n`;
          }
        }
        md += `\n`;
      }
    }
    return md;
  };

  // Copy Markdown to Clipboard
  const handleCopyMarkdown = async () => {
    try {
      const md = generateMarkdownSummary();
      await navigator.clipboard.writeText(md);
      setCopiedType('markdown');
      setTimeout(() => setCopiedType(null), 2500);
    } catch (err) {
      console.warn("Could not copy markdown:", err);
    }
  };

  // Download JSON Session Snapshot
  const handleDownloadSnapshot = () => {
    try {
      const snapshot = {
        meta: {
          app: 'Lumen AI',
          version: '1.0',
          exportedAt: new Date().toISOString(),
          language: activeLanguage,
          theme: currentTheme,
          user: currentUser ? { name: currentUser.name, email: currentUser.email } : null
        },
        messages: messages.map(m => ({
          id: m.id,
          role: m.role,
          text: m.text,
          timestamp: m.timestamp,
          widgets: m.widgets || null
        }))
      };

      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `lumen_session_${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setCopiedType('json');
      setTimeout(() => setCopiedType(null), 2500);
    } catch (err) {
      console.warn("Snapshot export error:", err);
    }
  };

  // Import JSON Session Snapshot
  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (parsed && Array.isArray(parsed.messages) && onImportSession) {
          onImportSession(parsed.messages);
          onClose();
        } else {
          alert("Invalid session snapshot format. Missing messages array.");
        }
      } catch (err) {
        alert("Failed to parse JSON session snapshot.");
      }
    };
    reader.readAsText(file);
  };

  const widgetCount = messages.reduce((acc, m) => acc + (Array.isArray(m.widgets) ? m.widgets.length : 0), 0);

  return (
    <div className="share-modal-backdrop animate-fade-in" onClick={onClose}>
      <div className="share-modal-card glass-panel" onClick={(e) => e.stopPropagation()}>
        <div className="share-modal-header">
          <div className="share-header-title">
            <span className="share-header-icon">🔗</span>
            <div>
              <h3>Share & Collaborate</h3>
              <p>Export conversation reports, snapshots, or collaborate across workspaces</p>
            </div>
          </div>
          <button type="button" className="share-close-btn" onClick={onClose} title="Close modal">
            ✕
          </button>
        </div>

        {/* Live Workspace Overview Stats */}
        <div className="share-stats-grid">
          <div className="share-stat-pill">
            <span className="stat-label">Messages</span>
            <span className="stat-val">{messages.length}</span>
          </div>
          <div className="share-stat-pill">
            <span className="stat-label">Active Widgets</span>
            <span className="stat-val">{widgetCount}</span>
          </div>
          <div className="share-stat-pill">
            <span className="stat-label">Language</span>
            <span className="stat-val">{activeLanguage}</span>
          </div>
          <div className="share-stat-pill">
            <span className="stat-label">Theme</span>
            <span className="stat-val" style={{ textTransform: 'capitalize' }}>{currentTheme}</span>
          </div>
        </div>

        {/* Action Options */}
        <div className="share-actions-list">
          {/* 1. Copy Markdown */}
          <button
            type="button"
            className="share-action-item"
            onClick={handleCopyMarkdown}
          >
            <div className="action-item-icon">📋</div>
            <div className="action-item-text">
              <h4>{copiedType === 'markdown' ? '✓ Copied to Clipboard!' : 'Copy Formatted Markdown'}</h4>
              <p>Clean report ready to paste into Slack, Notion, GitHub issues, or Jira</p>
            </div>
            <span className="action-item-badge">{copiedType === 'markdown' ? 'Copied' : 'Copy'}</span>
          </button>

          {/* 2. Export PDF Document */}
          <button
            type="button"
            className="share-action-item"
            onClick={() => {
              if (onExportPdf) onExportPdf();
              onClose();
            }}
          >
            <div className="action-item-icon">📄</div>
            <div className="action-item-text">
              <h4>Export PDF Document</h4>
              <p>Generate a professional multi-page branded PDF report with executive briefing</p>
            </div>
            <span className="action-item-badge">Export PDF</span>
          </button>

          {/* 3. Download JSON Snapshot */}
          <button
            type="button"
            className="share-action-item"
            onClick={handleDownloadSnapshot}
          >
            <div className="action-item-icon">💾</div>
            <div className="action-item-text">
              <h4>{copiedType === 'json' ? '✓ Download Started!' : 'Download Workspace Snapshot (.json)'}</h4>
              <p>Complete portable session data to backup or share with collaborators</p>
            </div>
            <span className="action-item-badge">Save JSON</span>
          </button>

          {/* 4. Import Session */}
          <button
            type="button"
            className="share-action-item"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="action-item-icon">📥</div>
            <div className="action-item-text">
              <h4>Import Shared Session</h4>
              <p>Load and resume a shared conversation snapshot (.json)</p>
            </div>
            <span className="action-item-badge">Upload</span>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportFile}
            accept=".json,application/json"
            style={{ display: 'none' }}
          />
        </div>

        <div className="share-modal-footer">
          <span>Lumen AI • Ambient Multimodal Workspace Collaboration</span>
        </div>
      </div>
    </div>
  );
}
