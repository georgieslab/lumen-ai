import React, { useEffect, useRef, useState } from 'react';
import {
  clearUserMemory,
  createUserMemory,
  deleteUserMemory,
  generateUserPersonaCard,
  getUserMemory,
  saveUserProfile,
  setAutoMemory,
  updateUserMemory
} from '../services/api';
import { getTranslations } from '../utils/translations';

const MAX_PROFILE_LENGTH = 10000;
const MAX_MEMORY_LENGTH = 280;

export default function UserMemoryModal({ isOpen, onClose, activeLanguage = 'en-US', statusNotice = '', isSignedIn = false }) {
  const labels = getTranslations(activeLanguage).memoryManager;
  const [profile, setProfile] = useState('');
  const [memories, setMemories] = useState([]);
  const [autoEnabled, setAutoEnabled] = useState(true);
  const [memoryPrompt, setMemoryPrompt] = useState(labels.aiExportPrompt);
  const [memoryPromptEdited, setMemoryPromptEdited] = useState(false);
  const [importedReply, setImportedReply] = useState('');
  const [promptCopied, setPromptCopied] = useState(false);
  const [newMemory, setNewMemory] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedProfile, setSavedProfile] = useState(false);
  const [profileIsDirty, setProfileIsDirty] = useState(false);
  const [personaCard, setPersonaCard] = useState(null);
  const [personaLoading, setPersonaLoading] = useState(false);
  const [personaError, setPersonaError] = useState('');
  const [importNotice, setImportNotice] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);
  const contentRef = useRef(null);
  const personaControllerRef = useRef(null);
  const hasPersonaKnowledge = Boolean(!profileIsDirty && (profile.trim() || memories.length));

  const invalidatePersonaCard = () => {
    personaControllerRef.current?.abort();
    personaControllerRef.current = null;
    setPersonaLoading(false);
    setPersonaCard(null);
    setPersonaError('');
  };

  useEffect(() => {
    if (!memoryPromptEdited) setMemoryPrompt(labels.aiExportPrompt);
  }, [labels.aiExportPrompt, memoryPromptEdited]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !isSignedIn) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError('');
    setPersonaCard(null);
    setPersonaError('');
    getUserMemory()
      .then(data => {
        if (!active) return;
        setProfile(data.profile || '');
        setProfileIsDirty(false);
        setMemories(data.memories || []);
        setAutoEnabled(data.autoMemoryEnabled !== false);
      })
      .catch(() => {
        if (active) setError(labels.loadError);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isOpen, isSignedIn]);

  useEffect(() => {
    if (isOpen) return;
    personaControllerRef.current?.abort();
    personaControllerRef.current = null;
    setPersonaLoading(false);
    setPersonaCard(null);
    setPersonaError('');
  }, [isOpen]);

  const handleProfileUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const validExtension = /\.(txt|md|json)$/i.test(file.name);
    if (!validExtension) {
      setError(labels.fileType);
      return;
    }
    try {
      let text = await file.text();
      if (text.length > MAX_PROFILE_LENGTH) {
        setError(labels.fileTooLarge);
        return;
      }
      if (file.name.toLowerCase().endsWith('.json')) {
        text = JSON.stringify(JSON.parse(text), null, 2);
      }
      setProfile(text);
      setProfileIsDirty(true);
      invalidatePersonaCard();
      setError('');
      setSavedProfile(false);
    } catch {
      setError(labels.fileType);
    }
  };

  const handleCopyMemoryPrompt = async () => {
    try {
      await navigator.clipboard.writeText(memoryPrompt);
      setPromptCopied(true);
      setError('');
      setTimeout(() => setPromptCopied(false), 2000);
    } catch {
      setError(labels.copyPromptError);
    }
  };

  const handleAddImportedContext = (event) => {
    const imported = importedReply.trim();
    if (!imported) return;
    const combined = profile.trim() ? `${profile.trim()}\n\n${imported}` : imported;
    if (combined.length > MAX_PROFILE_LENGTH) {
      setError(labels.importTooLarge);
      return;
    }
    setProfile(combined);
    setProfileIsDirty(true);
    invalidatePersonaCard();
    setImportedReply('');
    setSavedProfile(false);
    setImportNotice(labels.importAddedNotice);
    setError('');
    event.currentTarget.blur();
    requestAnimationFrame(() => {
      if (contentRef.current) contentRef.current.scrollTop = 0;
    });
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    setError('');
    setSavedProfile(false);
    try {
      await saveUserProfile(profile);
      setSavedProfile(true);
      setProfileIsDirty(false);
      invalidatePersonaCard();
      setImportNotice('');
    } catch {
      setError(labels.saveError);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAutoMemory = async () => {
    const next = !autoEnabled;
    setSaving(true);
    setError('');
    try {
      await setAutoMemory(next);
      setAutoEnabled(next);
    } catch {
      setError(labels.saveError);
    } finally {
      setSaving(false);
    }
  };

  const handleAddMemory = async (event) => {
    event.preventDefault();
    const text = newMemory.trim();
    if (!text) return;
    setSaving(true);
    setError('');
    try {
      const result = await createUserMemory(text);
      setMemories(previous => [result.memory, ...previous]);
      invalidatePersonaCard();
      setNewMemory('');
    } catch (saveError) {
      setError(saveError.message || labels.saveError);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async (memoryId) => {
    setSaving(true);
    setError('');
    try {
      const result = await updateUserMemory(memoryId, editingText);
      setMemories(previous => previous.map(memory => memory.id === memoryId ? result.memory : memory));
      invalidatePersonaCard();
      setEditingId(null);
      setEditingText('');
    } catch (saveError) {
      setError(saveError.message || labels.saveError);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMemory = async (memoryId) => {
    setSaving(true);
    setError('');
    try {
      await deleteUserMemory(memoryId);
      setMemories(previous => previous.filter(memory => memory.id !== memoryId));
      invalidatePersonaCard();
    } catch {
      setError(labels.saveError);
    } finally {
      setSaving(false);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm(labels.clearConfirm)) return;
    setSaving(true);
    setError('');
    try {
      await clearUserMemory();
      setProfile('');
      setProfileIsDirty(false);
      setMemories([]);
      invalidatePersonaCard();
      setAutoEnabled(true);
      setSavedProfile(false);
    } catch {
      setError(labels.saveError);
    } finally {
      setSaving(false);
    }
  };

  const handleCreatePersonaCard = async () => {
    personaControllerRef.current?.abort();
    const controller = new AbortController();
    personaControllerRef.current = controller;
    setPersonaLoading(true);
    setPersonaError('');
    try {
      const result = await generateUserPersonaCard(activeLanguage, controller.signal);
      if (!controller.signal.aborted) setPersonaCard(result.card);
    } catch (personaRequestError) {
      if (!controller.signal.aborted) setPersonaError(personaRequestError.message || labels.personaError);
    } finally {
      if (personaControllerRef.current === controller) personaControllerRef.current = null;
      if (!controller.signal.aborted) setPersonaLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="memory-modal-backdrop" onClick={onClose}>
      <section
        className="memory-modal-card glass-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="memory-modal-title"
        onClick={event => event.stopPropagation()}
      >
        <header className="memory-modal-header">
          <div>
            <h2 id="memory-modal-title">{labels.title}</h2>
            <p>{labels.subtitle}</p>
          </div>
          <button type="button" className="share-close-btn" onClick={onClose} aria-label={labels.close}>✕</button>
        </header>

        <p className="memory-privacy-note">{labels.privacyNote}</p>
        {statusNotice && <p className="memory-status-notice" role="status">{statusNotice}</p>}
        {error && <p className="memory-error" role="alert">{error}</p>}
        {!isSignedIn ? (
          <div className="memory-auth-required" role="status">
            <article className="memory-persona-card memory-persona-card--locked">
              <div className="persona-card-eyebrow">✦ {labels.personaHeading}</div>
              <span className="memory-auth-icon" aria-hidden="true">🔒</span>
              <h3>{labels.signInTitle}</h3>
              <p>{labels.signInHint}</p>
            </article>
          </div>
        ) : loading ? (
          <p className="memory-loading">{labels.loading}</p>
        ) : (
          <div className="memory-modal-content" ref={contentRef}>
            <section className="memory-section memory-persona-section">
              <div className="memory-section-heading memory-persona-heading">
                <h3>{labels.personaHeading}</h3>
                <button
                  type="button"
                  className="memory-primary-button"
                  onClick={handleCreatePersonaCard}
                  disabled={!hasPersonaKnowledge || saving || personaLoading}
                >
                  {personaLoading ? labels.personaCreating : personaCard ? labels.personaRefresh : labels.personaCreate}
                </button>
              </div>
              <p className="memory-hint">{labels.personaHint}</p>
              {profileIsDirty
                ? <p className="memory-empty">{labels.personaSaveFirst}</p>
                : !hasPersonaKnowledge && <p className="memory-empty">{labels.personaNeedsKnowledge}</p>}
              {personaError && <p className="memory-error persona-card-error" role="alert">{personaError}</p>}
              {personaCard && (
                <article className="memory-persona-card">
                  <div className="persona-card-eyebrow">✦ {labels.personaSummary}</div>
                  <p className="persona-card-summary">{personaCard.summary}</p>
                  <div className="persona-card-details">
                    {personaCard.preferences?.length > 0 && (
                      <section>
                        <h4>{labels.personaPreferences}</h4>
                        <ul>{personaCard.preferences.map((item, index) => <li key={`preference-${index}`}>{item}</li>)}</ul>
                      </section>
                    )}
                    {personaCard.currentFocus?.length > 0 && (
                      <section>
                        <h4>{labels.personaFocus}</h4>
                        <ul>{personaCard.currentFocus.map((item, index) => <li key={`focus-${index}`}>{item}</li>)}</ul>
                      </section>
                    )}
                    {personaCard.worksBest?.length > 0 && (
                      <section>
                        <h4>{labels.personaWorksBest}</h4>
                        <ul>{personaCard.worksBest.map((item, index) => <li key={`works-${index}`}>{item}</li>)}</ul>
                      </section>
                    )}
                  </div>
                </article>
              )}
            </section>

            <section className="memory-section">
              <div className="memory-section-heading">
                <h3>{labels.profileHeading}</h3>
                <button type="button" className="memory-upload-button" onClick={() => fileInputRef.current?.click()}>
                  {labels.upload}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.md,.json,text/plain,text/markdown,application/json"
                  onChange={handleProfileUpload}
                  hidden
                />
              </div>
              <textarea
                className="memory-profile-input"
                value={profile}
                maxLength={MAX_PROFILE_LENGTH}
                onChange={event => {
                  setProfile(event.target.value);
                  setProfileIsDirty(true);
                  invalidatePersonaCard();
                  setSavedProfile(false);
                  setImportNotice('');
                }}
                placeholder={labels.profilePlaceholder}
              />
              <div className="memory-profile-footer">
                <span>{profile.length}/{MAX_PROFILE_LENGTH}</span>
                <button type="button" className="memory-primary-button" onClick={handleSaveProfile} disabled={saving}>
                  {saving ? '…' : savedProfile ? labels.saved : labels.saveProfile}
                </button>
              </div>
              {importNotice && <p className="memory-status-notice" role="status">{importNotice}</p>}
            </section>

            <section className="memory-section">
              <h3>{labels.aiImportHeading}</h3>
              <p className="memory-hint">{labels.aiImportHint}</p>
              <textarea
                className="memory-profile-input memory-import-prompt"
                value={memoryPrompt}
                maxLength={3000}
                onChange={event => {
                  setMemoryPrompt(event.target.value);
                  setMemoryPromptEdited(true);
                  setPromptCopied(false);
                }}
                placeholder={labels.aiPromptPlaceholder}
                aria-label={labels.aiPromptPlaceholder}
              />
              <div className="memory-profile-footer">
                <span />
                <button type="button" className="memory-upload-button" onClick={handleCopyMemoryPrompt} disabled={!memoryPrompt.trim()}>
                  {promptCopied ? labels.promptCopied : labels.copyPrompt}
                </button>
              </div>
              <textarea
                className="memory-profile-input memory-import-reply"
                value={importedReply}
                maxLength={MAX_PROFILE_LENGTH}
                onChange={event => setImportedReply(event.target.value)}
                placeholder={labels.pasteAiReplyPlaceholder}
                aria-label={labels.pasteAiReplyPlaceholder}
              />
              <div className="memory-profile-footer">
                <span>{importedReply.length}/{MAX_PROFILE_LENGTH}</span>
                <button type="button" className="memory-primary-button" onClick={handleAddImportedContext} disabled={!importedReply.trim()}>
                  {labels.addAiContext}
                </button>
              </div>
            </section>

            <section className="memory-section">
              <div className="memory-section-heading">
                <h3>{labels.autoTitle}</h3>
                <button
                  type="button"
                  role="switch"
                  aria-checked={autoEnabled}
                  className={`memory-toggle ${autoEnabled ? 'is-on' : ''}`}
                  onClick={handleToggleAutoMemory}
                  disabled={saving}
                >
                  {autoEnabled ? labels.autoEnabled : labels.autoDisabled}
                </button>
              </div>
              <p className="memory-hint">{labels.autoHint}</p>
            </section>

            <section className="memory-section">
              <h3>{labels.memoriesTitle}</h3>
              <form className="memory-add-form" onSubmit={handleAddMemory}>
                <input
                  value={newMemory}
                  maxLength={MAX_MEMORY_LENGTH}
                  onChange={event => setNewMemory(event.target.value)}
                  placeholder={labels.addPlaceholder}
                  aria-label={labels.addPlaceholder}
                />
                <button type="submit" className="memory-primary-button" disabled={saving || !newMemory.trim()}>
                  {labels.addMemory}
                </button>
              </form>
              {memories.length === 0 ? (
                <p className="memory-empty">{labels.empty}</p>
              ) : (
                <ul className="memory-list">
                  {memories.map(memory => (
                    <li key={memory.id} className="memory-list-item">
                      {editingId === memory.id ? (
                        <div className="memory-edit-row">
                          <input
                            value={editingText}
                            maxLength={MAX_MEMORY_LENGTH}
                            onChange={event => setEditingText(event.target.value)}
                            aria-label={labels.edit}
                          />
                          <button type="button" onClick={() => handleSaveEdit(memory.id)} disabled={saving}>{labels.update}</button>
                          <button type="button" onClick={() => setEditingId(null)}>{labels.cancel}</button>
                        </div>
                      ) : (
                        <>
                          <span>{memory.text}</span>
                          <div className="memory-item-actions">
                            <button type="button" onClick={() => {
                              setEditingId(memory.id);
                              setEditingText(memory.text);
                            }}>{labels.edit}</button>
                            <button type="button" onClick={() => handleDeleteMemory(memory.id)} disabled={saving}>{labels.delete}</button>
                          </div>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <button type="button" className="memory-clear-button" onClick={handleClearAll} disabled={saving}>
              {labels.clearAll}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
